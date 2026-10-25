import { historyExamples } from '../tests/history-fixtures.mjs';
import { resolve } from 'node:path';
const args = process.argv.slice(2),
  clear = args.includes('--clear'),
  at = args.indexOf('--database'),
  file = at >= 0 ? args[at + 1] : null;
if (args.some((a, i) => !['--clear', '--database'].includes(a) && !(at >= 0 && i === at + 1)) || at >= 0 && !file || args.filter(a => a === '--database').length > 1 || args.filter(a => a === '--clear').length > 1) throw new Error('Usage: node scripts/create-history-examples.mjs [--clear] [--database /path/to/stopped/local/ClubTable/object.sqlite]');
const records = historyExamples(),
  quote = value => `'${value.replaceAll("'", "''")}'`;
const sql = clear ? "DELETE FROM history_examples WHERE id LIKE 'demo-%';" : `INSERT INTO history_examples(id,record) VALUES ${records.map((record, i) => `('demo-${i + 1}',${quote(JSON.stringify(record))})`).join(',\n')} ON CONFLICT(id) DO UPDATE SET record=excluded.record;`;
if (!file) {
  console.log(sql);
  process.exit(0);
}
const path = resolve(file);
if (!/\/v3\/do\/[^/]*ClubTable\/[a-f0-9]{64}\.sqlite$/.test(path) || !(/^(\/private)?\/tmp\//.test(path) || path.includes('/.wrangler/'))) throw new Error('Only stopped disposable local Wrangler databases are accepted. For staging, review SQL in the preview namespace Data Studio.');
const {
  DatabaseSync
} = await import('node:sqlite');
const db = new DatabaseSync(path);
try {
  if (!db.prepare("SELECT name FROM sqlite_master WHERE name='history_examples'").get()) throw new Error('Open the local staging app once, then stop it before seeding');
  db.exec(sql);
} finally {
  db.close();
}
console.log(clear ? 'Removed simulated history.' : 'Saved eight simulated games; real archives unchanged.');
