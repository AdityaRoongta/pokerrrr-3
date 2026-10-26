'use client';

import { useEffect, useRef, useState } from 'react';
import { acceptReaction, reactionDefinition, REACTION_COOLDOWN_MS, REACTION_LEAD_MS } from '../reactions.mjs';
import { PokerClient } from './poker-client';

export type ReactionEvent = {
  id: string; code: string; reaction: string; startedAt: number;
  from: { seat: number; name: string }; to: { seat: number; name: string };
};

export type ReactionPlayer = { id: string; name: string; seat: number; left?: boolean };
export type ReactionRoom = { code: string; phase: string; me: string; players: ReactionPlayer[]; settings: { seats: number } };

export function useReactions(current: React.RefObject<ReactionRoom | null>, practice: React.RefObject<ReactionRoom | null>, enabled: boolean) {
  const [event, setEvent] = useState<ReactionEvent | null>(null);
  const [selection, setSelection] = useState<{ code: string; seat: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const seen = useRef(new Map<string, number>());
  const inFlight = useRef(false);
  const nextSend = useRef(0);
  const code = current.current?.code;
  const target = selection?.code === code ? selection?.seat ?? null : null;
  const setTarget = (seat: number | null) => {
    setError('');
    setSelection(seat === null || !current.current ? null : { code: current.current.code, seat });
  };

  const receive = (incoming: ReactionEvent, serverTime: number) => {
    if (!enabled || document.hidden || !Number.isFinite(serverTime)) return;
    const room = current.current;
    if (!room || room.phase === 'closed') return;
    // Convert server timestamps once; animation and audio then use the same clock.
    const local = { ...incoming, startedAt: Date.now() + incoming.startedAt - serverTime };
    if (acceptReaction(local, room.code, seen.current)) setEvent(local);
  };

  useEffect(() => {
    if (!event) return;
    const definition = reactionDefinition(event.reaction);
    const timer = setTimeout(() => setEvent(value => value?.id === event.id ? null : value),
      Math.max(0, event.startedAt + definition.duration - Date.now()));
    const hide = () => { if (document.hidden) { setEvent(null); setSelection(null); } };
    document.addEventListener('visibilitychange', hide);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', hide); };
  }, [event]);

  async function send(reaction: string) {
    const room = current.current;
    if (!enabled || !room || target === null || inFlight.current) return;
    setError('');
    if (Date.now() < nextSend.current) { setError('Wait a moment before sending another.'); return; }
    const from = room.players.find((p: ReactionPlayer) => p.id === room.me && !p.left);
    const to = room.players.find((p: ReactionPlayer) => p.seat === target && !p.left);
    if (!from || !to || from.seat === to.seat) { setTarget(null); return; }
    inFlight.current = true;
    setSending(true);
    try {
      if (practice.current) {
        const now = Date.now();
        receive({ id: crypto.randomUUID(), code: room.code, reaction, startedAt: now + REACTION_LEAD_MS,
          from: { seat: from.seat, name: from.name }, to: { seat: to.seat, name: to.name } }, now);
      } else {
        // Deliberately no poker command envelope or automatic network retry.
        // Socket delivery and the HTTP acknowledgement share one event id.
        const result = await PokerClient.auth('reactions', {
          code: room.code, requestId: crypto.randomUUID(), reaction, targetSeat: target
        });
        receive(result.event, result.serverTime);
      }
      nextSend.current = Date.now() + REACTION_COOLDOWN_MS;
      setTarget(null);
    } catch (e) {
      const failure = e as Error & { status?: number };
      setError(failure.status ? failure.message : 'Could not confirm the reaction. Wait a moment before trying again.');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }
  return { event, target, setTarget, sending, error, send, receive };
}
