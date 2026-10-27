import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const run = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const files = run('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').split('\n')
  .filter(path => /^docs\/releases\/v\d+\.\d+\.\d+-deployment\.json$/.test(path));
if (files.length !== 1) throw new Error('Expected exactly one production deployment receipt');
const receipt = JSON.parse(readFileSync(files[0], 'utf8'));
if (!/^v\d+\.\d+\.\d+$/.test(receipt.tag) || !/^[a-f0-9]{40}$/.test(receipt.commit)) throw new Error('Invalid release identity');
if (files[0] !== `docs/releases/${receipt.tag}-deployment.json`) throw new Error('Receipt/tag mismatch');
run('merge-base', '--is-ancestor', receipt.commit, 'HEAD');
const health = await fetch('https://dunzo-club.arun-devanathan.workers.dev/api/health').then(response => {
  if (!response.ok) throw new Error(`Health returned ${response.status}`);
  return response.json();
});
if (health.environment !== 'production' || health.version !== receipt.commit || health.multiplayerReady !== true) {
  throw new Error(`Live production does not match release: ${JSON.stringify(health)}`);
}
const notes = run('show', `${receipt.commit}:docs/releases/${receipt.tag}.md`);
const body = `${notes}\n\n## Deployment receipt\n\n- Deployed source: \`${receipt.commit}\`\n- Production Worker version: \`${receipt.workerVersion}\`\n- Rollback Worker version: \`${receipt.rollbackVersion}\`\n- Production verified at: ${receipt.verifiedAt}\n`;
writeFileSync('/tmp/dunzo-release-notes.md', body);
execFileSync('gh', ['release', 'create', receipt.tag, '--target', receipt.commit, '--title', `Dunzo Club ${receipt.tag}`, '--notes-file', '/tmp/dunzo-release-notes.md', '--latest'], { stdio: 'inherit' });
