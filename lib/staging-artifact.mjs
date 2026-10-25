import { readFileSync } from 'node:fs';
import { STAGING_WORKER_NAME } from './staging-handler.mjs';
export function validateStagingArtifact(path = 'dist/server/wrangler.json') {
  const config = JSON.parse(readFileSync(path, 'utf8'));
  if (config.name !== STAGING_WORKER_NAME || config.vars?.APP_ENV !== 'staging') {
    throw new Error('Refusing non-staging artifact. Run pnpm run build:staging first.');
  }
  for (const key of ['d1_databases', 'r2_buckets', 'services']) {
    if (config[key]?.length) throw new Error(`Dunzo Club staging must not bind ${key}.`);
  }
  const bindings = config.durable_objects?.bindings;
  if (bindings?.length !== 1 || bindings[0].name !== 'CLUB_TABLE' || bindings[0].class_name !== 'ClubTable' || bindings[0].script_name) throw new Error('Expected only the local ClubTable coordinator binding.');
  if (!config.migrations?.some(m => m.tag === 'dunzo-club-v1' && m.new_sqlite_classes?.includes('ClubTable'))) throw new Error('Missing ClubTable SQLite migration.');
  return config;
}
