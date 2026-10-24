import { readFileSync } from 'node:fs';
import { STAGING_WORKER_NAME } from './staging-handler.mjs';
export function validateStagingArtifact(path = 'dist/server/wrangler.json') {
  const config = JSON.parse(readFileSync(path, 'utf8'));
  if (config.name !== STAGING_WORKER_NAME || config.vars?.APP_ENV !== 'staging') {
    throw new Error('Refusing non-staging artifact. Run pnpm run build:staging first.');
  }
  for (const key of ['d1_databases', 'r2_buckets', 'services']) {
    if (config[key]?.length) throw new Error(`Practice staging must not bind ${key}.`);
  }
  if (config.durable_objects?.bindings?.length) throw new Error('Practice staging must not bind a game database.');
  return config;
}
