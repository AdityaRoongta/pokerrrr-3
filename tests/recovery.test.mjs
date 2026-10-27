import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { presenceView, PRESENCE_LEASE_MS } from '../lib/presence.mjs';
import { TableService } from '../server/table-service.mjs';
import { MemoryStorage } from './memory-storage.mjs';
import { commandEnvelope } from '../lib/protocol/poker.mjs';
const source = ts.transpileModule(readFileSync(new URL('../lib/client/poker-client.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('../protocol/poker.mjs', new URL('../lib/protocol/poker.mjs', import.meta.url).href);
const { PokerClient } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const host = crypto.randomUUID(), friend = crypto.randomUUID();
function browser(t, handler, socketCommand) {
  const originals = Object.fromEntries(['fetch','localStorage','WebSocket','navigator','document','window','location'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const stored = new Map(), sockets = [];
  const room = {code:'ABC234', version:4,handStartedAt:123};
  const state = {protocol:4,type:'state',lobby:{activeGame:{code:room.code,joined:true}},room};
  const statuses=[], updates=[], notices=[]; let expired=0;
  class FakeSocket {
    static OPEN=1; static CLOSED=3;
    readyState=1;
    constructor(){sockets.push(this);queueMicrotask(()=>this.emit(state));}
    emit(data){this.onmessage?.({data:JSON.stringify(data)});}
    send(raw){const data=JSON.parse(raw); if(data.type==='command') socketCommand?.(this,data.input); else if(data.type==='ping')this.emit({protocol:4,type:'pong'}); else if(data.type==='resync')this.emit(state);}
    close(code=1000){this.readyState=3;this.onclose?.({code});}
  }
  const fakeFetch=async(url,options={})=>{
    const result=await handler(String(url),options,room);
    return new Response(JSON.stringify(result?.data ?? (String(url).includes('session')?{player:{id:host}}:String(url).includes('lobby')?state.lobby:room)),{status:result?.status||200});
  };
  const vars={fetch:fakeFetch,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},WebSocket:FakeSocket,navigator:{onLine:true},document:Object.assign(new EventTarget(),{hidden:false}),window:new EventTarget(),location:{href:'https://table.test/',protocol:'https:'}};
  for(const [k,value] of Object.entries(vars))Object.defineProperty(globalThis,k,{value,writable:true,configurable:true});
  t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:100000});
  const client=new PokerClient(host);
  const stop=client.connect(s=>updates.push(s),s=>statuses.push(s),()=>expired++,undefined,undefined,s=>notices.push(s));
  t.after(()=>{stop();t.mock.timers.reset();for(const [k,d]of Object.entries(originals))d?Object.defineProperty(globalThis,k,d):delete globalThis[k];});
  return {client,room,state,sockets,statuses,updates,notices,stored,get expired(){return expired;}};
}
test('HTTP reply lost after acceptance: WebSocket reuses command ID, applies once and unlocks',async t=>{
  const receipts=new Map();let applied=0;const ids=[];
  const accept=input=>{ids.push(input.commandId);if(!receipts.has(input.commandId)){applied++;receipts.set(input.commandId,{code:'ABC234',version:5});}return receipts.get(input.commandId);};
  const f=browser(t,async(url,o)=>{if(o.method==='POST'){accept(JSON.parse(o.body));throw new TypeError('Reply lost');}},(socket,input)=>socket.emit({protocol:4,type:'command_result',commandId:input.commandId,snapshot:accept(input)}));
  await settle();await f.client.send({type:'call',code:'ABC234'},f.room);
  assert.equal(applied,1);assert.equal(ids[0],ids[1]);assert.equal(f.client.hasPending(),false);
});
test('HTTP unavailable with healthy WebSocket: fallback accepts action without HTTP session preflight',async t=>{
  let calls=0;
  const f=browser(t,async()=>{throw new TypeError('HTTP unavailable');},(socket,input)=>{calls++;socket.emit({protocol:4,type:'command_result',commandId:input.commandId,snapshot:{code:'ABC234',version:5}});});
  await settle();await f.client.send({type:'check',code:'ABC234'},f.room);
  assert.equal(calls,1);assert.equal(f.expired,0);assert.equal(f.client.hasPending(),false);
});
test('both transports fail, turn passes: automatic stale rejection clears pending and restores next turn',async t=>{
  let offline=true;
  const f=browser(t,async(url,o)=>{if(offline)throw new TypeError('Disconnected');if(o.method==='POST')return {status:409,data:{error:'The table changed'}};},socket=>socket.close());
  await settle();await assert.rejects(f.client.send({type:'call',code:'ABC234'},f.room),/Reconnecting/);
  assert.equal(f.client.hasPending(),true);offline=false;
  t.mock.timers.tick(3100);await settle();
  assert.equal(f.client.hasPending(),false);assert.equal(f.expired,0);assert.ok(f.notices.some(n=>n.includes('not applied')));
  assert.equal(f.statuses.at(-1),'connected');
});
test('socket policy close does not sign out on a failed HTTP session check; valid session reconnects',async t=>{
  let httpDown=true;
  const f=browser(t,async()=>{if(httpDown)throw new TypeError('offline');});
  await settle();f.sockets[0].close(1008);await settle();assert.equal(f.expired,0);
  httpDown=false;t.mock.timers.tick(3100);await settle();assert.ok(f.sockets.length>1);assert.equal(f.expired,0);
});
test('confirmed expired session signs out, ordinary socket closure does not',async t=>{
  const f=browser(t,async url=>url.includes('session')?{data:{player:null}}:undefined);
  await settle();f.sockets[0].close(1008);await settle();assert.equal(f.expired,1);
});
test('HTTP snapshot fallback supplies fresh state when socket is unavailable',async t=>{
  const f=browser(t,async()=>undefined);await settle();f.sockets[0].close();
  await settle();assert.ok(f.updates.length>=2);assert.equal(f.statuses.at(-1),'connected');
});
test('reload restores a persisted pending action automatically without another tap',async t=>{
  const pending=commandEnvelope({type:'call',code:'ABC234'},{version:4,handStartedAt:123});let delivered;
  const f=browser(t,async(url,o)=>{if(o.method==='POST'){delivered=JSON.parse(o.body);return {data:{code:'ABC234',version:5}};}});
  f.stored.set('dunzo-club-command:'+host,JSON.stringify(pending));
  await settle();assert.equal(delivered.commandId,pending.commandId);assert.equal(f.client.hasPending(),false);
  assert.ok(f.notices.some(n=>n.includes('confirmed')));
});
test('presence expires, survives restart and honors another device or HTTP fallback lease',()=>{
  const peer={playerId:host,lastSeenAt:1000};
  assert.equal(presenceView([peer],{},1001).connected.has(host),true);
  assert.equal(presenceView([peer],{},1000+PRESENCE_LEASE_MS).connected.has(host),false);
  assert.equal(presenceView([peer,{playerId:host,lastSeenAt:9000}],{},17000).connected.has(host),true);
  assert.equal(presenceView([],{[host]:10000},17000).connected.has(host),true);
  assert.equal(presenceView([],{},17000).deadline,Infinity);
});
test('missed turn expires normally; old unaccepted action cannot execute in the next hand',async()=>{
  const storage=new MemoryStorage(), service=new TableService(storage);
  let r=(await service.execute(host,commandEnvelope({type:'create',name:'Host',timer:10}),1000)).snapshot;
  await service.execute(friend,commandEnvelope({type:'join',code:r.code,name:'Friend'}),1001);
  r=await service.snapshot(host,r.code);
  r=(await service.execute(host,commandEnvelope({type:'deal',code:r.code},r),2000)).snapshot;
  const actor=r.turn===host?host:friend, own=await service.snapshot(actor,r.code);
  const stale=commandEnvelope({type:own.legal.call?'call':'check',code:r.code},own);
  await service.advance(r.deadline+1);
  await assert.rejects(service.execute(actor,stale,r.deadline+2),/table changed|hand has changed/i);
  const latest=await service.snapshot(actor,r.code);
  assert.equal(latest.players.find(p=>p.id===actor).away,false);
  assert.equal(latest.players.find(p=>p.id===actor).left,false);
  const nextAt=Math.max(latest.nextDealAt||0,latest.payoutFinishedAt+5000);
  await service.advance(nextAt);
  let raw=await storage.get('room:'+r.code);
  assert.notEqual(raw.handStartedAt,r.handStartedAt);
  assert.equal(raw.players.find(p=>p.id===actor).inHand,true);
  assert.equal(raw.players.find(p=>p.id===actor).folded,false);
  if(raw.turn!==actor){
    const other=await service.snapshot(raw.turn,r.code);
    await service.execute(raw.turn,commandEnvelope({type:other.legal.call?'call':'check',code:r.code},other),nextAt+1);
  }
  const back=await service.snapshot(actor,r.code);
  assert.ok(back.legal,'Returned player can act on their next turn');
  await service.execute(actor,commandEnvelope({type:back.legal.call?'call':'check',code:r.code},back),nextAt+2);
});
