import { currentSettlementWeek, historyRange, gameResults } from './game-history.mjs';

const names = ['Dunzo', 'Ishita', 'Varun', 'Doshi', 'Panda', 'Saboo', 'Roongta'];
const changes = [
  [700, -300, 100, -200, -100, -100, -100],
  [-400, 250, 500, -200, -50, -75, -25],
  [300, -100, -200, 150, -50, -125, 25],
  [100, -50, 200, -150, -100, 75, -75]
];

// Use the actual staging roster so personal history and settlement share login IDs.
export function stagingHistoryGames(roster, now = Date.now()) {
  const players = names.map(name => {
    const matches = roster.filter(p => p.name === name || name === 'Dunzo' && p.name === 'Arun');
    if (matches.length !== 1) throw new Error(`Expected one staging account for ${name}`);
    return {id: matches[0].id, name};
  });
  if (new Set(players.map(p => p.id)).size !== names.length) throw new Error('Staging players must have distinct IDs');
  const {from} = currentSettlementWeek(now), {start} = historyRange(from, from);
  return changes.map((net, i) => {
    const closedAt = start + Math.floor((now - start) * (i + 1) / changes.length);
    return gameResults({
      code: `STG00${i + 1}`, createdAt: closedAt - 3 * 3600000, closedAt, completed: 24 + i * 6,
      players: players.map((p, n) => ({...p, buyins: 2500, cashout: 2500 + net[n]}))
    });
  });
}

// Only a console-inserted SQL request invokes this; there is no public reset API.
// The durable receipt and replacement records commit together, making retries safe.
export async function resetStagingHistory(storage, {environment, requestId, roster, now = Date.now()}) {
  if (environment !== 'staging') throw new Error('History reset is staging-only');
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(requestId)) throw new Error('Invalid staging reset request');
  return storage.transaction(async tx => {
    const receiptKey = `staging-history-reset:${requestId}`, receipt = await tx.get(receiptKey);
    if (receipt) return receipt;
    const games = stagingHistoryGames(roster, now), entries = new Map();
    let startAfter;
    for (;;) {
      const page = await tx.list({limit: 128, ...(startAfter && {startAfter})});
      for (const entry of page) entries.set(...entry);
      if (page.size < 128) break;
      startAfter = [...page.keys()].at(-1);
    }
    const active = entries.get('active'), closed = new Set();
    for (const [key, value] of entries) {
      if (key.startsWith('session:')) closed.add(key.slice(8));
      if (key.startsWith('room:') && value.phase === 'closed') closed.add(key.slice(5));
    }
    if (closed.has(active)) throw new Error('Active table appears in archived history; reset aborted');
    if (games.some(g => entries.has(`room:${g.code}`) && !closed.has(g.code))) throw new Error('Sample game code conflicts with a live table');
    for (const [key, value] of entries) {
      const remove = key.startsWith('session:') || key.startsWith('room:') && closed.has(key.slice(5))
        || key.startsWith('hand:') && closed.has(key.split(':')[1])
        || key.startsWith('command:') && closed.has(value.code);
      if (remove) await tx.delete(key);
    }
    for (const game of games) await tx.put(`session:${game.code}`, game);
    const result = {completedAt: now, removedGames: closed.size, seededGames: games.length};
    await tx.put(receiptKey, result);
    return result;
  });
}
