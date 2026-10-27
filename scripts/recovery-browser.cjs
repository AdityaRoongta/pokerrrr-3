// Fault injection against the actual compiled React client and real TableService.
// All requests are intercepted locally; no remote accounts or games are touched.
module.exports = async function recoveryBrowser(browser, root) {
  const assert = require('node:assert/strict');
  const {TableService} = await import(root+'/server/table-service.mjs');
  const {MemoryStorage} = await import(root+'/tests/memory-storage.mjs');
  const {commandEnvelope} = await import(root+'/lib/protocol/poker.mjs');
  for (const scenario of ['http_down','lost_reply','both_down','socket_down','offline_reload']) {
    const host=crypto.randomUUID(), other=crypto.randomUUID(), third=crypto.randomUUID();
    const storage=new MemoryStorage(), service=new TableService(storage);
    let room=(await service.execute(host,commandEnvelope({type:'create',name:'Recovery tester',sb:5,bb:10,seats:3,buyin:1000,games:['NLH'],timer:10}))).snapshot;
    const code=room.code;
    await service.execute(other,commandEnvelope({type:'join',code,name:'Other'}));
    await service.execute(third,commandEnvelope({type:'join',code,name:'Third'}));
    room=await service.snapshot(host,code);
    room=(await service.execute(host,commandEnvelope({type:'deal',code},room))).snapshot;
    assert.equal(room.turn,host);
    const raw=await storage.get('room:'+code); raw.paused=true; await storage.put('room:'+code,raw);
    const lobby={activeGame:{code,joined:true,players:room.players,settings:room.settings}};
    const sockets=new Set(), commandIds=[]; let fault=scenario==='offline_reload'?'both_down':'none', httpAccepted=0;
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const errors=[], consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
    async function state(){return {protocol:4,type:'state',lobby,room:await service.snapshot(host,code)};}
    async function broadcast(){const msg=JSON.stringify(await state());for(const ws of sockets)try{ws.send(msg);}catch{}}
    async function execute(input){await service.advance();const result=await service.execute(host,input);return {...result.snapshot,ack:result.ack};}
    await page.route('**/api/**',async route=>{
      const req=route.request(),path=new URL(req.url()).pathname;
      if(fault==='both_down')return route.abort();
      if(path==='/api/poker' && req.method()==='POST'){
        const input=req.postDataJSON();commandIds.push(input.commandId);
        if(fault==='http_down')return route.abort();
        if(fault==='lost_reply'){await execute(input);httpAccepted++;await broadcast();return route.abort();}
        try {const json=await execute(input);await broadcast();return route.fulfill({json});}
        catch(error){return route.fulfill({status:error.status||400,json:{error:error.message}});}
      }
      const data=path==='/api/history'?{games:[],nextCursor:null,demo:false,demoAvailable:false,viewerKey:host}:path==='/api/players'?{players:[{id:host,name:'Recovery tester'}]}:path==='/api/session'?{player:{id:host,name:'Recovery tester'}}:path==='/api/lobby'?lobby:path==='/api/chat'?{entries:[],nextCursor:null}:await service.snapshot(host,code);
      return route.fulfill({json:data});
    });
    await page.routeWebSocket('**/api/poker/socket',async ws=>{
      if(fault==='both_down'||fault==='socket_down'){ws.close();return;}
      sockets.add(ws);ws.onClose(()=>sockets.delete(ws));ws.send(JSON.stringify(await state()));
      ws.onMessage(async raw=>{
        const message=JSON.parse(raw);
        if(message.type==='ping')ws.send(JSON.stringify({protocol:4,type:'pong'}));
        if(message.type==='resync')ws.send(JSON.stringify(await state()));
        if(message.type==='command'){
          commandIds.push(message.input.commandId);
          try{const snapshot=await execute(message.input);ws.send(JSON.stringify({protocol:4,type:'command_result',commandId:message.input.commandId,snapshot}));await broadcast();}
          catch(error){ws.send(JSON.stringify({protocol:4,type:'command_result',commandId:message.input.commandId,status:error.status||400,error:error.message}));}
        }
      });
    });
    if(scenario==='offline_reload') setTimeout(()=>{fault='none';},1000);
    await page.goto('http://127.0.0.1:8787');
    try { await page.locator('.personal-hole-cards .card').first().waitFor(); } catch(error) { console.error({scenario,errors,consoleErrors,text:await page.locator('body').innerText()}); await page.screenshot({path:'/tmp/dunzo-recovery-failure.png'}); throw error; }
    await page.waitForFunction(()=>{const b=document.querySelector('.check-call');return b&&!b.disabled;});
    fault=scenario==='offline_reload'?'none':scenario;
    if(scenario==='socket_down'){
      for(const ws of sockets)ws.close();
      await page.waitForTimeout(1500);
      await page.waitForFunction(()=>{const b=document.querySelector('.check-call');return b&&!b.disabled;});
    }
    if(scenario==='both_down')for(const ws of sockets)ws.close();
    // Force the interrupted action while the last received state is still usable.
    // For total disconnection, seed the exact envelope a tapped call would retain.
    if(scenario==='both_down'){
      const stale=commandEnvelope({type:'call',code},await service.snapshot(host,code));
      await page.evaluate(([id,input])=>localStorage.setItem('dunzo-club-command:'+id,JSON.stringify(input)),[host,stale]);
      const before=await service.snapshot(host,code);
      await service.advance(before.deadline+1);
      fault='none';
      await page.evaluate(()=>window.dispatchEvent(new Event('online')));
      await page.waitForFunction(id=>!localStorage.getItem('dunzo-club-command:'+id),host,{timeout:15000});
      const current=await service.snapshot(host,code);
      assert.equal(current.players.find(p=>p.id===host).folded,true);
      assert.equal(current.players.find(p=>p.id===host).away,false);
      assert.equal(current.players.find(p=>p.id===host).left,false);
      assert.match(await page.locator('body').innerText(),/Back at the table|Connection restored|Your turn|turn/i);
    } else {
      const before=await service.snapshot(host,code);
      await page.locator('.check-call').tap();
      await page.waitForFunction(id=>!localStorage.getItem('dunzo-club-command:'+id),host,{timeout:15000});
      await page.waitForTimeout(500);
      const after=await service.snapshot(host,code);
      assert.equal(after.version,before.version+1,'Exactly one call was applied');
      assert.equal(after.players.find(p=>p.id===host).stack,990);
      if(scenario==='lost_reply'){assert.equal(httpAccepted,1);assert.equal(new Set(commandIds).size,1);assert.equal(commandIds.length,2);}
      if(scenario==='http_down')assert.equal(commandIds.length,2);
    }
    assert.equal(await page.getByRole('button',{name:'Sign in',exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    assert.deepEqual(consoleErrors.filter(e=>/TypeError|above error occurred/i.test(e)),[]);
    await page.screenshot({path:'/tmp/dunzo-recovery-'+scenario+'.png'});
    await page.close();console.log('PASS browser recovery: '+scenario);
  }
};
