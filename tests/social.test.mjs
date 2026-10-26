import test from 'node:test';
import assert from 'node:assert/strict';
import { SocialService } from '../server/social-service.mjs';
import { MemoryStorage } from './memory-storage.mjs';
const a = { id: 'alice', name: 'Alice' }, b = { id: 'bob', name: 'Bob' }, observer = { id: 'spectator', name: 'Observer' };
async function fixture() {
  const storage = new MemoryStorage();
  const room = { code: 'ABC234', phase: 'flop', version: 11, deadline: 50000,
    players: [{ ...a, seat: 0, folded: true }, { ...b, seat: 1 }] };
  await storage.put('active', room.code); await storage.put(`room:${room.code}`, room);
  return { storage, room, social: new SocialService(storage) };
}
const message = (text = 'hello', extra = {}) => ({ code: 'ABC234', requestId: crypto.randomUUID(), text, ...extra });
const reaction = (targetSeat = 1, extra = {}) => ({ code: 'ABC234', requestId: crypto.randomUUID(), reaction: 'chappal', targetSeat, ...extra });
test('concurrent chat is ordered, plain text is preserved and same-id retry survives closure/restart', async () => {
  const f = await fixture(), input = message('<img src=x onerror=alert(1)>');
  const results = await Promise.all([f.social.send(a, input, 'message', 10000), f.social.send(b, message(), 'message', 10000)]);
  assert.deepEqual(results.map(r => r.entry.sequence), [1, 2]);
  assert.equal(results[0].entry.text, input.text);
  const raw = await f.storage.get('room:ABC234'); raw.phase = 'closed'; await f.storage.put('room:ABC234', raw);
  const retry = await new SocialService(f.storage).send(a, input, 'message', 11000);
  assert.equal(retry.replayed, true); assert.equal(retry.entry.sequence, 1);
  assert.equal((await f.social.history('ABC234')).entries.length, 2);
  await assert.rejects(f.social.send(a, message('closed'), 'message', 12000), /ended/);
  await assert.rejects(f.social.send(a, { ...input, text: 'changed' }), /already used/);
  assert.equal(JSON.stringify(results).includes('alice'), false, 'No private account ID leaves social service');
});
test('folded players and standing observers retain access; server enforces size/rate/schema', async () => {
  const f = await fixture();
  await f.social.send(a, message(), 'message', 10000);
  await assert.rejects(f.social.send(a, message(), 'message', 10999), /Wait/);
  await f.social.send(a, message('next'), 'message', 11000);
  const entry = await f.social.send(observer, message('watching'), 'message', 11000);
  assert.equal(entry.entry.sender.seat, null);
  for (const request of [message(' '), message('x'.repeat(501)), message('ok', { from: 'spoof' })]) await assert.rejects(f.social.send(b, request));
  const effect = await f.social.send(observer, reaction(), 'reaction', 12000);
  assert.equal(effect.entry.kind, 'reaction');
  assert.equal((await f.social.drain('ABC234', 12000))[0].from.seat, null);
  assert.deepEqual(await f.storage.get('room:ABC234'), f.room, 'No social operation changes poker state');
});
test('history pages have no gaps/duplicates and stay isolated by game', async () => {
  const f = await fixture();
  for (let i = 0; i < 123; i++) await f.social.send(a, message(`Message ${i}`), 'message', 10000 + 1000 * i);
  const first = await f.social.history('ABC234'), second = await f.social.history('ABC234', first.nextCursor), third = await f.social.history('ABC234', second.nextCursor);
  assert.equal(first.entries.length, 50); assert.equal(second.entries.length, 50); assert.equal(third.entries.length, 23); assert.equal(third.nextCursor, null);
  assert.deepEqual([...third.entries, ...second.entries, ...first.entries].map(e => e.sequence), Array.from({ length: 123 }, (_, i) => i + 1));
  await f.storage.put('room:XYZ234', { ...f.room, code: 'XYZ234', phase: 'closed' });
  assert.equal((await f.social.history('XYZ234')).entries.length, 0);
  await assert.rejects(f.social.history('ABC234', 'bad'), /cursor/);
});
test('runout queues persist, expire in five seconds and skip a reassigned target', async () => {
  const f = await fixture();
  await f.storage.put('room:ABC234', { ...f.room, phase: 'runout_vote', runVote: { deadline: 13000 } });
  await f.social.send(a, reaction(), 'reaction', 10000);
  assert.equal((await f.social.drain('ABC234', 12000)).length, 0);
  assert.equal(await f.social.deadline('ABC234', 12000), 13000);
  await f.storage.put('room:ABC234', { ...f.room, phase: 'showdown', payoutFinishedAt: 14000 });
  assert.equal((await f.social.drain('ABC234', 13999)).length, 0);
  const events = await new SocialService(f.storage).drain('ABC234', 14000);
  assert.equal(events.length, 1); assert.equal(events[0].startedAt, 14200);
  assert.equal('targetId' in events[0], false);
  await f.social.send(a, reaction(), 'reaction', 15000);
  assert.equal((await f.social.drain('ABC234', 20000)).length, 0);
  await f.social.send(a, reaction(), 'reaction', 22000);
  await f.storage.put('room:ABC234', { ...f.room, players: [f.room.players[0], { id: 'new', name: 'New', seat: 1 }] });
  assert.equal((await f.social.drain('ABC234', 22001)).length, 0);
});
test('only two effects play concurrently, sender cooldown persists and closure clears queue', async () => {
  const f = await fixture();
  for (const sender of [a, observer, { id: 'fourth', name: 'Fourth' }]) await f.social.send(sender, reaction(), 'reaction', 10000);
  assert.equal((await f.social.drain('ABC234', 10000)).length, 2);
  assert.equal(await f.social.deadline('ABC234', 10000), 11000);
  await assert.rejects(new SocialService(f.storage).send(a, reaction(), 'reaction', 12999), /Wait/);
  assert.equal((await f.social.drain('ABC234', 10999)).length, 0);
  assert.equal((await f.social.drain('ABC234', 11000)).length, 1);
  await f.social.send(a, reaction(), 'reaction', 13000);
  await f.storage.put('room:ABC234', { ...f.room, phase: 'closed' });
  assert.equal((await f.social.drain('ABC234', 13001)).length, 0);
  assert.equal((await f.social.history('ABC234')).entries.length, 4);
});

test('all eight reactions persist, broadcast their own effect and leave poker unchanged', async () => {
  const f = await fixture();
  const catalogue = ['chappal', 'cheers', 'money', 'tomato', 'crown', 'laugh', 'duck', 'punch'];
  for (const [index, id] of catalogue.entries()) {
    const now = 10000 + index * 3000;
    const sent = await f.social.send(a, reaction(1, { reaction: id }), 'reaction', now);
    assert.equal(sent.entry.reaction, id);
    const effects = await f.social.drain('ABC234', now);
    assert.equal(effects.length, 1); assert.equal(effects[0].reaction, id);
    assert.equal(effects[0].to.name, 'Bob');
  }
  assert.deepEqual((await f.social.history('ABC234')).entries.map(e => e.reaction), catalogue);
  assert.deepEqual(await f.storage.get('room:ABC234'), f.room);
});
