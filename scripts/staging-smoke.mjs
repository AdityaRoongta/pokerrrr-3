import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { validateStagingArtifact } from '../lib/staging-artifact.mjs';
import { runApiSuite, localTarget } from '../tests/api.test.mjs';
const base = process.env.POKER_STAGING_TEST_URL || 'http://127.0.0.1:8787';
localTarget(base); validateStagingArtifact();
const external = Boolean(process.env.POKER_STAGING_TEST_URL);
const key = external ? process.env.POKER_TEST_ACCESS_KEY : `disposable-test-${crypto.randomUUID()}`;
if (!key) throw new Error('Set POKER_TEST_ACCESS_KEY for the disposable external preview.');
const directory = mkdtempSync(join(tmpdir(),'dunzo-club-test-'));
let server, logs='';
async function stop() {
  if(server&&server.exitCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited;}
  server=undefined;
}
async function start() {
  server=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to',directory,'--ip','127.0.0.1','--port',String(new URL(base).port||8787),'--inspector-port','0','--var',`CLUB_ACCESS_KEY:${key}`],{stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false'}});
  server.stdout.on('data',chunk=>logs+=chunk);server.stderr.on('data',chunk=>logs+=chunk);
  for(let i=0;i<90;i++){
    if(server.exitCode!==null) throw new Error(`Preview exited: ${logs}`);
    try{if((await fetch(new URL('/api/health',base))).ok)return}catch{}
    await setTimeout(500);
  }
  throw new Error(`Preview did not become ready: ${logs}`);
}
try {
  if(!external)await start();
  const health=await fetch(new URL('/api/health',base)),data=await health.json();
  assert.equal(health.status,200);assert.equal(data.app,'Dunzo Club');assert.equal(data.environment,'staging');assert.equal(data.mode,'multiplayer');assert.equal(data.multiplayerReady,true);assert.match(data.version,/^[a-f0-9]{40}$/);
  const page=await fetch(base),html=await page.text();assert.equal(page.status,200);assert.match(html,/Dunzo Club/);assert.match(html,/Club access code/);assert.match(html,/Open your table/);
  for(const asset of ['/manifest.webmanifest','/sw.js','/icon-192.png','/icon-512.png'])assert.equal((await fetch(new URL(asset,base))).status,200,asset);
  await runApiSuite(base,key,external?undefined:async()=>{await stop();await start()});
  console.log('Built multiplayer Worker smoke passed; no remote resources used.');
} finally {await stop();rmSync(directory,{recursive:true,force:true});}
