import { readFileSync } from 'node:fs';

export function validateProductionArtifact(path = 'dist/server/wrangler.json') {
  const config = JSON.parse(readFileSync(path, 'utf8'));
  if (config.name !== 'dunzo-club' || config.vars?.APP_ENV !== 'production') {
    throw new Error('Refusing non-production artifact. Run pnpm run build:production first.');
  }
  for (const key of ['d1_databases', 'r2_buckets', 'services']) {
    if (config[key]?.length) throw new Error(`Production must not bind ${key}.`);
  }
  const bindings = config.durable_objects?.bindings;
  if (bindings?.length !== 1 || bindings[0].name !== 'CLUB_TABLE' ||
      bindings[0].class_name !== 'ClubTable' || bindings[0].script_name || bindings[0].environment) {
    throw new Error('Production requires its own local ClubTable binding.');
  }
  if (!config.migrations?.some(m => m.tag === 'dunzo-club-v1' && m.new_sqlite_classes?.includes('ClubTable'))) {
    throw new Error('Missing production ClubTable SQLite migration.');
  }
  if (config.previews) throw new Error('Production must not include staging Preview configuration.');
  return config;
}
