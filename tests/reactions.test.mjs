import test from 'node:test';
import assert from 'node:assert/strict';
import { ReactionService } from '../server/reaction-service.mjs';
import { acceptReaction, reactionsEnabled } from '../lib/reactions.mjs';

function fixture() {
  const room = { code: 'ABC234', phase: 'preflop', version: 17, deadline: 12345,
    players: [{ id: 'a', name: 'Alice', seat: 6 }, { id: 'b', name: 'Bob', seat: 2 },
      { id: 'gone', name: 'Left', seat: 4, left: true }] };
  const data = new Map([['active', room.code], [`room:${room.code}`, structuredClone(room)]]);
  const storage = {
    get: async key => structuredClone(data.get(key)),
    put: async (key, value) => data.set(key, structuredClone(value)),
    transaction: async work => work(storage)
  };
  return { room, data, service: new ReactionService(storage), storage };
}
const input = (extra = {}) => ({ code: 'ABC234', requestId: crypto.randomUUID(), reaction: 'chappal', targetSeat: 2, ...extra });

test('one authenticated sender, one target, one event; retry survives restart without a second broadcast', async () => {
  const f = fixture(), request = input();
  const result = await f.service.send('a', request, 10000);
  assert.equal(result.replayed, false);
  assert.deepEqual(result.event.from, { seat: 6, name: 'Alice' });
  assert.deepEqual(result.event.to, { seat: 2, name: 'Bob' });
  assert.equal(result.event.startedAt, 10200);
  assert.ok(!JSON.stringify(result.event).includes('playerId'));
  const retry = await new ReactionService(f.storage).send('a', request, 10020);
  assert.equal(retry.replayed, true);
  assert.deepEqual(retry.event, result.event);
  assert.deepEqual(f.data.get('room:ABC234'), f.room, 'Poker version, state and deadlines stay untouched');
  await assert.rejects(f.service.send('a', { ...request, targetSeat: 6 }, 10050));
});

test('rejects spectators, self-targeting, empty/left seats, unknown effects and spoofed fields', async () => {
  const f = fixture();
  for (const [player, request] of [
    ['stranger', input()], ['a', input({ targetSeat: 6 })], ['a', input({ targetSeat: 1 })],
    ['a', input({ targetSeat: 4 })], ['a', input({ reaction: 'toString' })],
    ['a', input({ targetSeat: [2, 6] })], ['a', input({ from: 'b' })], ['gone', input()]
  ]) await assert.rejects(f.service.send(player, request, 10000));
  assert.equal(f.data.size, 2);
});

test('cooldown and one-animation table slot persist; storage stays bounded', async () => {
  const f = fixture();
  await f.service.send('a', input(), 10000);
  await assert.rejects(f.service.send('a', input(), 12001), /Wait a moment/);
  await assert.rejects(f.service.send('b', input({ targetSeat: 6 }), 10500), /reaction is playing/);
  await f.service.send('b', input({ targetSeat: 6 }), 12001);
  for (let i = 0; i < 30; i++) await f.service.send('a', input(), 15000 + i * 3000);
  assert.equal(f.data.size, 5);
});

test('ended/old games reject reactions', async () => {
  const f = fixture();
  await assert.rejects(f.service.send('a', input({ code: 'XYZ234' })), /no longer active/);
  f.data.get('room:ABC234').phase = 'closed';
  await assert.rejects(f.service.send('a', input()));
});

test('receiver drops duplicates, stale/foreign events and future events; production fails closed', async () => {
  const f = fixture(), { event } = await f.service.send('a', input(), 10000), seen = new Map();
  assert.equal(acceptReaction(event, 'ABC234', seen, 10050), true);
  assert.equal(acceptReaction(event, 'ABC234', seen, 10060), false);
  assert.equal(acceptReaction({ ...event, id: 'stale' }, 'ABC234', seen, 12000), false);
  assert.equal(acceptReaction({ ...event, id: 'foreign' }, 'XYZ234', seen, 10050), false);
  assert.equal(acceptReaction({ ...event, id: 'future', startedAt: 50000 }, 'ABC234', seen, 10050), false);
  for (const env of ['production', 'prod', undefined, 'unknown']) assert.equal(reactionsEnabled(env), false);
  assert.equal(reactionsEnabled('staging'), true);
});
