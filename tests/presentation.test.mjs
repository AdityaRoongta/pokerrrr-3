import test from 'node:test';
import assert from 'node:assert/strict';
import { showdownTiming, presentationAt, payoutAwards, payoutEvents, visibleStack, boardPlan, slowBoardPlan } from '../lib/table-presentation.mjs';
test('all-in announcement precedes a slow runout and each run waits for the previous payout', () => {
  const p = showdownTiming(0, 5, 2, 2, [1, 1], true),
    [a, b] = p.runs;
  assert.equal(p.announcementDuration, 2000);
  assert.equal(a.boardStart, 2000);
  assert.deepEqual(presentationAt(p, 1999), {
    phase: 'announcement',
    run: null
  });
  assert.ok(slowBoardPlan(0, 5).at(-1).at > boardPlan(0, 5).at(-1).at);
  assert.ok(b.boardStart > a.payoutEnd);
  assert.ok(b.boardStart > a.endAt);
  assert.deepEqual(presentationAt(p, a.resultAt), {
    phase: 'award',
    run: 1
  });
  assert.deepEqual(presentationAt(p, b.boardStart), {
    phase: 'dealing',
    run: 2
  });
  assert.deepEqual(presentationAt(p, b.resultAt), {
    phase: 'award',
    run: 2
  });
  assert.deepEqual(presentationAt(p, p.payoutDuration), {
    phase: 'summary',
    run: null
  });
});
test('payments and displayed stacks advance per run, including a player winning both runs', () => {
  const p = showdownTiming(3, 5, 2, 2, [2, 1], true),
    r = {
      runCount: 2,
      result: [{
        id: 'a',
        name: 'A',
        runHands: [{
          run: 1,
          wonAmount: 250
        }, {
          run: 2,
          wonAmount: 500
        }]
      }, {
        id: 'b',
        name: 'B',
        runHands: [{
          run: 1,
          wonAmount: 250
        }]
      }]
    },
    events = payoutEvents(r, 1000, p);
  assert.deepEqual(events.map(e => [e.id, e.run, e.amount]), [['a', 1, 250], ['b', 1, 250], ['a', 2, 500]]);
  assert.ok(events[2].at > events[1].at + events[1].duration);
  const a = {
    id: 'a',
    stack: 750
  };
  assert.equal(visibleStack(a, events, 1000), 0);
  assert.equal(visibleStack(a, events, events[0].at + events[0].duration), 250);
  assert.equal(visibleStack(a, events, events[2].at + events[2].duration), 750);
});
test('two different winners get separate sequential chip transfers', () => {
  const p = showdownTiming(4, 5, 2, 2, [1, 1], true),
    events = payoutEvents({
      runCount: 2,
      result: [{
        id: 'x',
        name: 'X',
        runHands: [{
          run: 1,
          wonAmount: 2500
        }]
      }, {
        id: 'y',
        name: 'Y',
        runHands: [{
          run: 2,
          wonAmount: 2500
        }]
      }]
    }, 0, p);
  assert.deepEqual(events.map(e => [e.id, e.run, e.amount]), [['x', 1, 2500], ['y', 2, 2500]]);
  assert.ok(events[1].at > events[0].at + events[0].duration);
});
test('uncalled chips share the winning transfer with no separate return animation', () => {
  const plan = showdownTiming(0, 0, 1),
    room = {
      runCount: 1,
      result: [{
        id: 'winner',
        name: 'Winner',
        amount: 150,
        wonAmount: 100,
        returnedAmount: 50
      }]
    },
    events = payoutEvents(room, 0, plan);
  assert.equal(events.length, 1);
  assert.equal(events[0].amount, 150);
  assert.equal(events[0].returned, false);
  assert.equal(visibleStack({
    id: 'winner',
    stack: 300
  }, events, 0), 150);
  assert.equal(visibleStack({
    id: 'winner',
    stack: 300
  }, events, events[0].at + events[0].duration), 300);
});


test('side pots settle largest tier first, then tied main pot shares, before the next run', () => {
  const result = [
    {id: 'a', name: 'A', returnedAmount: 30, pots: [
      {run: 1, label: 'Main pot', amount: 100, tied: true},
      {run: 1, label: 'Side pot 1', amount: 200},
      {run: 2, label: 'Main pot', amount: 150, tied: true}
    ]},
    {id: 'b', name: 'B', pots: [
      {run: 1, label: 'Side pot 2', amount: 300},
      {run: 2, label: 'Side pot 1', amount: 200}
    ]},
    {id: 'c', name: 'C', pots: [
      {run: 1, label: 'Main pot', amount: 100, tied: true},
      {run: 2, label: 'Main pot', amount: 150, tied: true}
    ]}
  ];
  const awards = payoutAwards(result, 2),
    counts = [1, 2].map(run => awards.filter(a => a.run === run).length),
    plan = showdownTiming(3, 5, awards.length, 2, counts, true),
    events = payoutEvents({result, runCount: 2}, 1000, plan);
  assert.deepEqual(events.map(e => [e.run, e.label, e.id, e.amount]), [
    [1, 'Side pot 2', 'b', 300], [1, 'Side pot 1', 'a', 230],
    [1, 'Main pot', 'a', 100], [1, 'Main pot', 'c', 100],
    [2, 'Side pot 1', 'b', 200], [2, 'Main pot', 'a', 150], [2, 'Main pot', 'c', 150]
  ]);
  assert.equal(events.reduce((sum, e) => sum + e.amount, 0), 1230);
  events.forEach((e, i) => {
    if (i) assert.ok(e.at > events[i - 1].at + events[i - 1].duration);
    assert.ok(e.at + e.duration <= 1000 + plan.runs[e.run - 1].payoutEnd);
  });
  assert.ok(events.filter(e => e.run === 1).every(e => e.at + e.duration < 1000 + plan.runs[1].boardStart));
  const player = {id: 'a', stack: 480};
  assert.equal(visibleStack(player, events, 1000), 0);
  assert.equal(visibleStack(player, events, events[1].at + events[1].duration), 230);
  assert.equal(visibleStack(player, events, events[2].at + events[2].duration), 330);
  assert.equal(visibleStack(player, events, events[5].at + events[5].duration), 480);
});

test('a returned-only player gets their chips, and persisted legacy timelines keep aggregate transfers', () => {
  const result = [
    {id: 'winner', name: 'Winner', amount: 300, wonAmount: 300, pots: [
      {run: 1, label: 'Main pot', amount: 100}, {run: 1, label: 'Side pot 1', amount: 200}
    ]},
    {id: 'return', name: 'Return', amount: 50, wonAmount: 0, returnedAmount: 50, pots: []}
  ],
    awards = payoutAwards(result),
    plan = showdownTiming(0, 0, awards.length),
    events = payoutEvents({result, runCount: 1}, 0, plan);
  assert.deepEqual(events.map(e => e.amount), [200, 100, 50]);
  assert.equal(events[2].returned, true);
  assert.equal(visibleStack({id: 'return', stack: 50}, events, 0), 0);
  assert.equal(visibleStack({id: 'return', stack: 50}, events, events[2].at + events[2].duration), 50);
  const legacyPlan = {runs: [{run: 1, payoutStart: 500}]};
  assert.deepEqual(payoutEvents({result, runCount: 1}, 0, legacyPlan).map(e => [e.at, e.amount]), [[500, 300]]);
});
