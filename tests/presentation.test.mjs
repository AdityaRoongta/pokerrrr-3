import test from 'node:test';
import assert from 'node:assert/strict';
import {showdownTiming,presentationAt,payoutEvents,visibleStack,boardPlan,slowBoardPlan} from '../lib/table-presentation.mjs';
test('all-in announcement precedes a slow runout and each run waits for the previous payout',()=>{
 const p=showdownTiming(0,5,2,2,[1,1],true),[a,b]=p.runs;
 assert.equal(p.announcementDuration,2000);assert.equal(a.boardStart,2000);
 assert.deepEqual(presentationAt(p,1999),{phase:'announcement',run:null});
 assert.ok(slowBoardPlan(0,5).at(-1).at>boardPlan(0,5).at(-1).at);
 assert.ok(b.boardStart>a.payoutEnd);assert.ok(b.boardStart>a.endAt);
 assert.deepEqual(presentationAt(p,a.resultAt),{phase:'award',run:1});
 assert.deepEqual(presentationAt(p,b.boardStart),{phase:'dealing',run:2});
 assert.deepEqual(presentationAt(p,b.resultAt),{phase:'award',run:2});
 assert.deepEqual(presentationAt(p,p.payoutDuration),{phase:'summary',run:null});
});
test('payments and displayed stacks advance per run, including a player winning both runs',()=>{
 const p=showdownTiming(3,5,2,2,[2,1],true),r={runCount:2,result:[{id:'a',name:'A',runHands:[{run:1,wonAmount:250},{run:2,wonAmount:500}]},{id:'b',name:'B',runHands:[{run:1,wonAmount:250}]}]},events=payoutEvents(r,1000,p);
 assert.deepEqual(events.map(e=>[e.id,e.run,e.amount]),[['a',1,250],['b',1,250],['a',2,500]]);
 assert.ok(events[2].at>events[1].at+events[1].duration);
 const a={id:'a',stack:750};assert.equal(visibleStack(a,events,1000),0);
 assert.equal(visibleStack(a,events,events[0].at+events[0].duration),250);
 assert.equal(visibleStack(a,events,events[2].at+events[2].duration),750);
});
test('two different winners get separate sequential chip transfers',()=>{
 const p=showdownTiming(4,5,2,2,[1,1],true),events=payoutEvents({runCount:2,result:[{id:'x',name:'X',runHands:[{run:1,wonAmount:2500}]},{id:'y',name:'Y',runHands:[{run:2,wonAmount:2500}]}]},0,p);
 assert.deepEqual(events.map(e=>[e.id,e.run,e.amount]),[['x',1,2500],['y',2,2500]]);assert.ok(events[1].at>events[0].at+events[0].duration);
});

test('uncalled chips share the winning transfer with no separate return animation',()=>{
 const plan=showdownTiming(0,0,1),room={runCount:1,result:[{id:'winner',name:'Winner',amount:150,wonAmount:100,returnedAmount:50}]},events=payoutEvents(room,0,plan);assert.equal(events.length,1);assert.equal(events[0].amount,150);assert.equal(events[0].returned,false);assert.equal(visibleStack({id:'winner',stack:300},events,0),150);assert.equal(visibleStack({id:'winner',stack:300},events,events[0].at+events[0].duration),300);
});
