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
const exportUrl=`${base}/api/poker?code=${code}&export=hands&format=`;
let exported=await fetch(`${exportUrl}json`,{headers:{Authorization:`Bearer ${host}`}});assert.equal(exported.status,200);const archive=await exported.json();assert.equal(archive.schemaVersion,1);assert.equal(archive.hands.length,7);assert.ok(archive.hands.every(h=>!JSON.stringify(h).includes(host)));
exported=await fetch(`${exportUrl}csv`,{headers:{Authorization:`Bearer ${host}`}});assert.equal(exported.status,200);assert.match(await exported.text(),/"session_code","hand_number"/);
exported=await fetch(`${exportUrl}json`,{headers:{Authorization:`Bearer ${friend}`}});assert.equal(exported.status,200);assert.equal((await exported.json()).hands.length,7);
const denied=await fetch(`${exportUrl}json`,{headers:{Authorization:`Bearer ${stranger}`}});assert.equal(denied.status,403);
r=await api(host,{type:'end',code});assert.equal(r.phase,'closed');assert.equal(r.players.reduce((s,p)=>s+p.cashout,0),2750);
if(r.settlements.length){r=await api(host,{type:'paid',code,index:0});assert.equal(r.settlements[0].paid,true)}

const fourHost=crypto.randomUUID(),fourPlayers=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()],latePlayer=crypto.randomUUID();
let four=await api(fourHost,{type:'create',name:'Four Host',seats:5,sb:5,bb:10,buyin:1000});const fourCode=four.code;
for(const [index,player] of fourPlayers.entries())await api(player,{type:'join',code:fourCode,name:`Four Player ${index+1}`,buyin:1000});
four=await api(fourHost,undefined,fourCode);four=await api(fourHost,{type:'deal',code:fourCode,version:four.version});
for(let turns=0;['preflop','flop','turn','river'].includes(four.phase);turns++){
 assert.ok(turns<8,'four-player hand should finish after three folds');let actor=null;
 for(const player of [fourHost,...fourPlayers]){const candidate=await api(player,undefined,fourCode);if(candidate.turn===player){actor={player,candidate};break}}
 assert.ok(actor,'one four-player client must own the current turn');await api(actor.player,{type:'fold',code:fourCode,version:actor.candidate.version});four=await api(fourHost,undefined,fourCode);
}
assert.equal(four.phase,'showdown');const fourExportUrl=`${base}/api/poker?code=${fourCode}&export=hands&format=json`;
for(const player of [fourHost,...fourPlayers]){const exportedFour=await fetch(fourExportUrl,{headers:{Authorization:`Bearer ${player}`}});assert.equal(exportedFour.status,200);const playerArchive=await exportedFour.json();assert.equal(playerArchive.hands.length,1);assert.ok(!JSON.stringify(playerArchive).includes(player));}
await api(latePlayer,{type:'join',code:fourCode,name:'Late Player',buyin:1000});const lateExport=await fetch(fourExportUrl,{headers:{Authorization:`Bearer ${latePlayer}`}});assert.equal(lateExport.status,200);assert.equal((await lateExport.json()).hands.length,0);
console.log('API integration passed: two-player exports plus a four-player hand, player-scoped exports, late-join filtering, private cards, rotations, showdown and settlement.');
