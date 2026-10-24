import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stagingResponse } from '../lib/staging-handler.mjs';
import { validateStagingArtifact } from '../lib/staging-artifact.mjs';

test('health identifies practice-only staging without exposing environment secrets', async () => {
  const r = stagingResponse(new Request('https://example.test/api/health'), 'staging', 'a'.repeat(40));
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await r.json(), {app:'pokerrrr-3',environment:'staging',version:'a'.repeat(40),mode:'practice-only',multiplayerReady:false});
});
test('every existing multiplayer method is blocked at the Worker boundary', async () => {
  for (const method of ['GET','POST','PUT','DELETE']) for (const path of ['/api/poker','/api/poker/','/api/poker/anything']) {
    const r = stagingResponse(new Request(`https://example.test${path}?code=ABC234`, {method}), 'staging', 'commit');
    assert.equal(r.status, 503); assert.equal((await r.json()).code, 'MULTIPLAYER_NOT_CONFIGURED');
  }
  assert.equal(stagingResponse(new Request('https://example.test/'), 'staging', 'commit'), null);
  assert.equal(stagingResponse(new Request('https://example.test/api/poker-other'), 'staging', 'commit'), null);
});
test('deploy guard rejects another environment or any persistent game/service binding', () => {
  const directory = mkdtempSync(join(tmpdir(), 'poker-staging-')), path = join(directory, 'wrangler.json');
  const valid = {name:'pokerrr-3-staging',vars:{APP_ENV:'staging'}};
  try {
    for (const invalid of [
      {...valid,name:'pokerrr-3-prod'}, {...valid,vars:{APP_ENV:'production'}},
      ...['d1_databases','r2_buckets','services'].map(key=>({...valid,[key]:[{}]})),
      {...valid,durable_objects:{bindings:[{}]}},
    ]) { writeFileSync(path,JSON.stringify(invalid)); assert.throws(()=>validateStagingArtifact(path)); }
    writeFileSync(path,JSON.stringify(valid));assert.equal(validateStagingArtifact(path).name,valid.name);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
