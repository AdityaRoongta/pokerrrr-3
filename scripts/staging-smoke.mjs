import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { validateStagingArtifact } from '../lib/staging-artifact.mjs';
const base = process.env.POKER_STAGING_TEST_URL || 'http://127.0.0.1:8787';
const url = new URL(base);
if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Staging smoke tests require a loopback preview; never run against a live group.');
validateStagingArtifact();
let server, logs='';
try {
if (!process.env.POKER_STAGING_TEST_URL) {
 server=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--ip','127.0.0.1','--port','8787','--inspector-port','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false'}});
 server.stdout.on('data',chunk=>logs+=chunk);server.stderr.on('data',chunk=>logs+=chunk);
 let ready=false;for(let i=0;i<90;i++){if(server.exitCode!==null)throw new Error(`Preview exited: ${logs}`);try{if((await fetch(new URL('/api/health',base))).ok){ready=true;break}}catch{}await setTimeout(500)}
 if(!ready)throw new Error(`Preview did not become ready: ${logs}`);
}
const health = await fetch(new URL('/api/health',base));assert.equal(health.status,200);
const data=await health.json();assert.equal(data.environment,'staging');assert.equal(data.mode,'practice-only');assert.equal(data.multiplayerReady,false);assert.match(data.version,/^[a-f0-9]{40}$/);
for (const method of ['GET','POST']) {
 const result=await fetch(new URL('/api/poker?code=ABC234',base),{method,...(method==='POST'?{headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'create',name:'No table should be created'})}:{})});
 assert.equal(result.status,503);assert.equal((await result.json()).code,'MULTIPLAYER_NOT_CONFIGURED');
}
const page=await fetch(base);assert.equal(page.status,200);const html=await page.text();assert.match(html,/STAGING/);assert.match(html,/PRACTICE ONLY/);assert.match(html,/Shared tables coming soon/);assert.match(html,/Try a practice hand/);
for (const asset of ['/manifest.webmanifest','/sw.js','/icon-192.png','/icon-512.png']) assert.equal((await fetch(new URL(asset,base))).status,200,asset);
console.log('Built Worker smoke passed: staging health/version, multiplayer GET/POST blocked, lobby rendered, PWA assets served.');

} finally { if(server) server.kill('SIGTERM'); }
