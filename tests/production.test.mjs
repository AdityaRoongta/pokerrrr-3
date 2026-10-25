import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateProductionArtifact } from '../lib/production-artifact.mjs';
import { validateStagingArtifact } from '../lib/staging-artifact.mjs';

test('production guard rejects staging, shared storage and preview artifacts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dunzo-production-'));
  const path = join(directory, 'wrangler.json');
  const valid = {
    name: 'dunzo-club', vars: { APP_ENV: 'production' },
    durable_objects: { bindings: [{ name: 'CLUB_TABLE', class_name: 'ClubTable' }] },
    migrations: [{ tag: 'dunzo-club-v1', new_sqlite_classes: ['ClubTable'] }]
  };
  try {
    for (const invalid of [
      { ...valid, name: 'dunzo-club-staging' },
      { ...valid, vars: { APP_ENV: 'staging' } },
      { ...valid, vars: {} },
      { ...valid, durable_objects: { bindings: [{ ...valid.durable_objects.bindings[0], script_name: 'dunzo-club-staging' }] } },
      { ...valid, durable_objects: { bindings: [{ ...valid.durable_objects.bindings[0], environment: 'staging' }] } },
      { ...valid, durable_objects: { bindings: [] } },
      { ...valid, migrations: [] },
      { ...valid, previews: {} },
      ...['d1_databases', 'r2_buckets', 'services'].map(key => ({ ...valid, [key]: [{}] }))
    ]) {
      writeFileSync(path, JSON.stringify(invalid));
      assert.throws(() => validateProductionArtifact(path));
    }
    writeFileSync(path, JSON.stringify(valid));
    assert.equal(validateProductionArtifact(path).name, 'dunzo-club');
    assert.throws(() => validateStagingArtifact(path), /non-staging/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
