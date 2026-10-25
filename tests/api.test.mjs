import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { pathToFileURL } from 'node:url';
import { commandEnvelope, PROTOCOL_VERSION } from '../lib/protocol/poker.mjs';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function localTarget(base) {
  const url = new URL(base);
  if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.protocol !== 'http:') throw new Error('API tests require an explicit disposable loopback HTTP server. Never test live balances.');
  return url;
}
export async function runApiSuite(base, key, restart) {
  localTarget(base);
  const host = crypto.randomUUID(), friend = crypto.randomUUID();
  const denied = await fetch(new URL('/api/poker', base)); assert.equal(denied.status, 401);
  const cross = await fetch(new URL('/api/club/access', base), {method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify({key})}); assert.equal(cross.status,403);
  const unlock = await fetch(new URL('/api/club/access', base), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})}); assert.equal(unlock.status,200);
  const cookie = unlock.headers.get('set-cookie').split(';')[0];
  for (const headers of [{Origin:new URL(base).origin}, {Cookie:cookie,Origin:'https://other.test'}]) {
    const status = await new Promise((resolve,reject) => {
      const socket = new WebSocket(new URL('/api/poker/socket',base).href.replace('http:','ws:'),{headers});
      socket.once('unexpected-response',(_,response)=>{response.resume();resolve(response.statusCode);socket.terminate()});
      socket.once('open',()=>{socket.terminate();reject(new Error('Unauthorized socket opened'))});
      socket.on('error',()=>{});
    });
    assert.equal(status,headers.Cookie?403:401);
  }
  async function api(token, input, code) {
    const res = await fetch(new URL(input ? '/api/poker' : `/api/poker?code=${code}`, base), {method:input?'POST':'GET',headers:{Cookie:cookie,Authorization:`Bearer ${token}`,...(input&&{'Content-Type':'application/json'})},...(input&&{body:JSON.stringify(input)})});
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(`${res.status}: ${data.error}`), {status:res.status});
    return data;
  }
  const create = commandEnvelope({type:'create',name:'Integration Host',rotation:2,seats:8,sb:5,bb:10,buyin:1000});
  let room = await api(host, create), code = room.code;
  assert.equal((await api(host,create)).code,code);
  await assert.rejects(api(friend,commandEnvelope({type:'create',name:'Duplicate'})),/already active/);
  await assert.rejects(api(crypto.randomUUID(),null,code),/Join/);
  await api(friend, commandEnvelope({type:'join',code,name:'Integration Friend',buyin:1750}));
  room = await api(host,null,code);
  const peers=[];
  async function peer(token) {
    const messages=[];
    const socket=new WebSocket(new URL('/api/poker/socket',base).href.replace('http:','ws:'),{headers:{Cookie:cookie,Origin:new URL(base).origin}});
    peers.push(socket);
    socket.on('message',value=>messages.push(JSON.parse(value.toString())));
    await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject)});
    socket.send(JSON.stringify({protocol:PROTOCOL_VERSION,type:'authenticate',token,code}));
    await waitFor(()=>messages.find(m=>m.type==='snapshot'));
    return {socket,messages};
  }
  async function waitFor(check, ms=5000) {
    const start=Date.now();while(Date.now()-start<ms){const value=check();if(value)return value;await sleep(25)}throw new Error('Timed out waiting for server push');
  }
  try {
    const unauthorized = new WebSocket(new URL('/api/poker/socket',base).href.replace('http:','ws:'), {headers:{Cookie:cookie,Origin:new URL(base).origin}});
    const rejected = new Promise((resolve,reject)=>{unauthorized.once('close',resolve);unauthorized.once('error',reject)});
    unauthorized.once('open',()=>unauthorized.send(JSON.stringify({protocol:PROTOCOL_VERSION,type:'authenticate',token:crypto.randomUUID(),code})));
    assert.equal(await rejected,1008);
    const h=await peer(host), f=await peer(friend);
    const reload=commandEnvelope({type:'rebuy',code,amount:100},room);
    const accepted=await api(host,reload); const retried=await api(host,reload);
    assert.deepEqual(accepted.ack,retried.ack);assert.equal(retried.players.find(p=>p.id===host).buyins,1100);
    await waitFor(()=>f.messages.find(m=>m.snapshot?.version===accepted.version));
    room=await api(host,null,code);
    if(restart){
      peers.forEach(s=>s.close()); await restart();
      const restored=await api(host,null,code);assert.equal(restored.version,room.version);assert.deepEqual(restored.players,room.players);
    }
    const liveHost=restart?await peer(host):h, liveFriend=restart?await peer(friend):f;
    const games=new Set();
    for(let i=0;i<7;i++){
      room=await api(host,null,code);
      if(room.phase==='showdown') await sleep(Math.max(0,room.payoutFinishedAt-Date.now()+50));
      // Pause prevents auto-deal racing this deterministic integration sequence.
      if(!room.paused){room=await api(host,commandEnvelope({type:'pause',code},room));}
      room=await api(host,commandEnvelope({type:'deal',code},room)); games.add(room.game);
      await waitFor(()=>liveFriend.messages.find(m=>m.snapshot?.version===room.version));
      const privateHost=await api(host,null,code),privateFriend=await api(friend,null,code);
      assert.equal(privateHost.players.find(p=>p.name==='Integration Friend').cards,undefined);
      assert.equal(privateFriend.players.find(p=>p.name==='Integration Host').cards,undefined);
      let steps=0;
      while(['preflop','flop','turn','river'].includes(room.phase)){
        assert.ok(++steps<40); const actor=room.turn===host?host:friend,own=await api(actor,null,code);
        room=await api(actor,commandEnvelope({type:i===2?(own.legal.call?'call':'check'):'fold',code},own));
        room=await api(host,null,code);
      }
      assert.equal(room.phase,'showdown');assert.equal(room.players.reduce((n,p)=>n+p.stack,0),2850);
      await assert.rejects(api(host,commandEnvelope({type:'deal',code},room)),/payouts/);
    }
    assert.equal(games.size,3);assert.equal(room.history.length,7);
    // No incoming requests or socket pings: the alarm alone must finish a turn.
    await sleep(Math.max(0,room.payoutFinishedAt-Date.now()+50));
    room=await api(host,commandEnvelope({type:'deal',code},room));
    const dealtVersion=room.version;
    const timed=await waitFor(()=>liveHost.messages.find(m=>m.snapshot?.version>dealtVersion&&m.snapshot?.phase==='showdown'),45_000);
    assert.equal(timed.snapshot.completed,8);
    room=await api(host,null,code);
    room=await api(host,commandEnvelope({type:'end',code},room));assert.equal(room.phase,'closed');
    assert.equal(room.players.reduce((n,p)=>n+p.cashout,0),2850);
    for(const message of liveHost.messages) assert.ok(!JSON.stringify(message).includes(friend));
    for(const message of liveFriend.messages) assert.ok(!JSON.stringify(message).includes(host));
    const next=await api(host,commandEnvelope({type:'create',name:'Next session'}));
    assert.notEqual(next.code,code);assert.equal((await api(host,null,code)).history.length,8);
    assert.equal((await api(friend,commandEnvelope({type:'join',code,name:'Existing friend'}))).phase,'closed');
    await api(host,commandEnvelope({type:'end',code:next.code},next));
    console.log('Dunzo Club API/WebSocket integration passed: group access, private push, retries, restart, 8 hands, 3 variants, independent alarm and retained sessions.');
  } finally { peers.forEach(s=>s.terminate()); }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.env.POKER_TEST_URL||!process.env.POKER_TEST_ACCESS_KEY)throw new Error('Set POKER_TEST_URL and POKER_TEST_ACCESS_KEY for a disposable local server.');
  await runApiSuite(process.env.POKER_TEST_URL,process.env.POKER_TEST_ACCESS_KEY);
}
