// Presence is a short lease, independent of seat eligibility and poker state.
export const PRESENCE_LEASE_MS = 15000;
export function presenceView(peers, httpLeases = {}, now = Date.now()) {
  const seen = new Map(Object.entries(httpLeases));
  for (const peer of peers) if (peer?.playerId && peer.lastSeenAt) seen.set(peer.playerId, Math.max(seen.get(peer.playerId) || 0, peer.lastSeenAt));
  return {
    connected: new Set([...seen].filter(([, time]) => Number(time) + PRESENCE_LEASE_MS > now).map(([id]) => id)),
    deadline: Math.min(Infinity, ...[...seen.values()].map(time => Number(time) + PRESENCE_LEASE_MS).filter(time => time > now))
  };
}
