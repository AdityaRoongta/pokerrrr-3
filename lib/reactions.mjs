// Shared reaction catalogue. Add a renderer and sound with the same id on the client.
export const REACTIONS = Object.freeze({
  chappal: Object.freeze({ id: 'chappal', label: 'Chappal', icon: '🩴', duration: 800, impactAt: 280, jolt: true }),
  cheers: Object.freeze({ id: 'cheers', label: 'Cheers', icon: '🍷', duration: 1400, impactAt: 500, jolt: false }),
  money: Object.freeze({ id: 'money', label: 'Money Flying', icon: '💸', duration: 1600, impactAt: 180, jolt: false }),
  tomato: Object.freeze({ id: 'tomato', label: 'Tomato Splat', icon: '🍅', duration: 1200, impactAt: 340, jolt: true }),
  crown: Object.freeze({ id: 'crown', label: 'Crown', icon: '👑', duration: 1600, impactAt: 550, jolt: false }),
  laugh: Object.freeze({ id: 'laugh', label: 'Laughing Face', icon: '😂', duration: 1500, impactAt: 400, jolt: false }),
  duck: Object.freeze({ id: 'duck', label: 'Duck', icon: '🦆', duration: 1400, impactAt: 650, jolt: false }),
  punch: Object.freeze({ id: 'punch', label: 'Punch', icon: '🥊', duration: 800, impactAt: 240, jolt: true })
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
    || event.startedAt > now + 2000 || !(event.from?.seat === null || Number.isInteger(event.from?.seat))
    || !Number.isInteger(event.to?.seat) || event.from.seat !== null && event.from.seat === event.to.seat) return false;
  seen.set(event.id, event.startedAt + definition.duration);
  for (const [id, expiresAt] of seen) if (expiresAt < now - 5000) seen.delete(id);
  return true;
}
