import { z } from 'zod';
import { roomCode } from '../lib/protocol/poker.mjs';
import { reactionDefinition, REACTION_COOLDOWN_MS, REACTION_LEAD_MS } from '../lib/reactions.mjs';
import { TableError } from './table-service.mjs';

const inputSchema = z.object({
  code: roomCode,
  requestId: z.string().uuid(),
  reaction: z.string().max(32),
  targetSeat: z.number().int().min(0).max(7)
}).strict();

// Fixed-size receipts: at most one per player plus one table slot. No poker state,
// accounting receipts, versions, archives or alarms are written by this service.
export class ReactionService {
  constructor(storage) { this.storage = storage; }

  async send(playerId, raw, now = Date.now()) {
    const input = inputSchema.parse(raw);
    const definition = reactionDefinition(input.reaction);
    if (!definition) throw new TableError('Unknown reaction', 400);
    return this.storage.transaction(async tx => {
      const active = await tx.get('active');
      if (active !== input.code) throw new TableError('This game is no longer active');
      const room = await tx.get(`room:${input.code}`);
      const from = room?.players.find(p => p.id === playerId && !p.left && Number.isInteger(p.seat));
      const to = room?.players.find(p => p.seat === input.targetSeat && !p.left);
      if (!room || room.phase === 'closed' || !from) throw new TableError('Join a seat at this table first', 403);
      if (!to || to.id === playerId) throw new TableError('Choose another seated player', 400);
      const key = `reaction:sender:${playerId}`;
      const previous = await tx.get(key);
      if (previous?.requestId === input.requestId) {
        if (previous.event.code !== input.code || previous.event.reaction !== input.reaction
          || previous.event.to.seat !== input.targetSeat) throw new TableError('Reaction request already used');
        return { event: previous.event, replayed: true };
      }
      if (previous && now < previous.sentAt + REACTION_COOLDOWN_MS) throw new TableError('Wait a moment before sending another reaction', 429);
      const slot = await tx.get('reaction:table');
      if (slot?.code === input.code && now < slot.until) throw new TableError('A reaction is playing. Try again in a moment', 429);
      const event = {
        id: crypto.randomUUID(), code: input.code, reaction: definition.id,
        startedAt: now + REACTION_LEAD_MS,
        from: { seat: from.seat, name: from.name },
        to: { seat: to.seat, name: to.name }
      };
      await tx.put(key, { requestId: input.requestId, sentAt: now, event });
      await tx.put('reaction:table', { code: input.code, until: event.startedAt + definition.duration });
      return { event, replayed: false };
    });
  }
}
