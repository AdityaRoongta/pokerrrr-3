// Shared reaction catalogue. Add a renderer and sound with the same id on the client.
export const REACTIONS = Object.freeze({
  chappal: Object.freeze({ id: 'chappal', label: 'Chappal', duration: 800, impactAt: 280 })
});
export const REACTION_COOLDOWN_MS = 3000;
export const REACTION_LEAD_MS = 200;
export const reactionsEnabled = environment => environment === 'staging' || environment === 'local';

export function reactionDefinition(id) {
  return typeof id === 'string' && Object.hasOwn(REACTIONS, id) ? REACTIONS[id] : null;
}

// Never replay on reconnect, tab restore or repeated HTTP/socket delivery.
export function acceptReaction(event, code, seen, now = Date.now()) {
  const definition = reactionDefinition(event?.reaction);
  if (!definition || event.code !== code || typeof event.id !== 'string' || seen.has(event.id)
    || !Number.isFinite(event.startedAt) || now >= event.startedAt + definition.duration
    || event.startedAt > now + 2000 || !Number.isInteger(event.from?.seat)
    || !Number.isInteger(event.to?.seat) || event.from.seat === event.to.seat) return false;
  seen.set(event.id, event.startedAt + definition.duration);
  for (const [id, expiresAt] of seen) if (expiresAt < now - 5000) seen.delete(id);
  return true;
}
