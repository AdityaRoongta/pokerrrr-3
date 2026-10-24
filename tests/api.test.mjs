import assert from 'node:assert/strict';
const base=process.env.POKER_TEST_URL||'http://127.0.0.1:4173';
const host=crypto.randomUUID(),friend=crypto.randomUUID(),stranger=crypto.randomUUID();
async function api(token,input,code){const res=await fetch(input?`${base}/api/poker`:`${base}/api/poker?code=${code}`,{method:input?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(input?{'Content-Type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})});const data=await res.json();if(!res.ok)throw new Error(`${res.status}: ${data.error}`);return data}
let r=await api(host,{type:'create',name:'Integration Host',rotation:2,seats:8,sb:5,bb:10,buyin:1000});const code=r.code;
await assert.rejects(api(stranger,undefined,code),/Join/);
let f=await api(friend,{type:'join',code,name:'Integration Friend',buyin:1750});assert.equal(f.players.find(p=>p.id===friend).stack,1750);assert.ok(!JSON.stringify(f).includes(host));
r=await api(host,undefined,code);assert.equal(r.requests.length,0);assert.equal(r.players.find(p=>p.name==='Integration Friend').stack,1750);
const games=new Set();
for(let i=0;i<7;i++){
 r=await api(host,{type:'deal',code,version:r.version});games.add(r.game);
 const [h,v]=await Promise.all([api(host,undefined,code),api(friend,undefined,code)]);assert.ok(!JSON.stringify(h).includes(friend));assert.ok(!JSON.stringify(v).includes(host));assert.equal(h.players.find(p=>p.name==='Integration Friend').cards,undefined);assert.equal(v.players.find(p=>p.name==='Integration Host').cards,undefined);
 // One hand checks through to showdown. Others fold to exercise rotation quickly.
 let steps=0;while(['preflop','flop','turn','river'].includes(r.phase)){
  assert.ok(++steps<40);const player=r.turn===host?host:friend;const pv=await api(player,undefined,code);const action=i===2?(pv.legal.call?'call':'check'):'fold';
  await api(player,{type:action,code,version:pv.version});r=await api(host,undefined,code);
 }
 assert.equal(r.phase,'showdown');assert.equal(r.players.reduce((s,p)=>s+p.stack,0),2750);
}
assert.equal(games.size,3);assert.equal(r.history.length,7);
r=await api(host,{type:'end',code});assert.equal(r.phase,'closed');assert.equal(r.players.reduce((s,p)=>s+p.cashout,0),2750);
if(r.settlements.length){r=await api(host,{type:'paid',code,index:0});assert.equal(r.settlements[0].paid,true)}
console.log('API integration passed: two independent players, durable room, player-selected stacks, private cards, 7 hands, 3 variants, showdown, balanced cash-outs and settlement.');
