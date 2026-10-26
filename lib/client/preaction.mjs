// A queued choice belongs to one player, table, hand and betting street.
export function preactionValid(queued, room) {
  const me = room?.players.find(p => p.id === room.me);
  return Boolean(queued && me?.inHand && !me.folded && !me.away && me.stack > 0
    && queued.player === room.me && queued.code === room.code
    && queued.hand === room.handStartedAt && queued.phase === room.phase
    && ['preflop', 'flop', 'turn', 'river'].includes(room.phase));
}
export function resolvePreaction(choice, call) {
  if (choice === 'fold') return 'fold';
  if (!call) return 'check';
  return choice === 'check-fold' ? 'fold' : null;
}
