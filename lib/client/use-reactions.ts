'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { acceptReaction, reactionDefinition, REACTION_COOLDOWN_MS, REACTION_LEAD_MS } from '../reactions.mjs';
import { PokerClient } from './poker-client';

export type ReactionEvent = {
  id: string; code: string; reaction: string; startedAt: number;
  from: { seat: number | null; name: string }; to: { seat: number; name: string };
};

export type ReactionPlayer = { id: string; name: string; seat: number; left?: boolean };
export type ReactionRoom = { code: string; phase: string; me: string; players: ReactionPlayer[]; settings: { seats: number }; payoutFinishedAt?: number };

export function useReactions(current: React.RefObject<ReactionRoom | null>, practice: React.RefObject<ReactionRoom | null>, enabled: boolean) {
  const [events, setEvents] = useState<ReactionEvent[]>([]);
  const [queued, setQueued] = useState(false);
  const practiceQueue = useRef<{ event: ReactionEvent; expiresAt: number }[]>([]);
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

  const receive = useCallback((incoming: ReactionEvent, serverTime: number) => {
    if (!enabled || document.hidden || !Number.isFinite(serverTime)) return;
    const room = current.current;
    if (!room || room.phase === 'closed') return;
    // Convert server timestamps once; animation and audio then use the same clock.
    const local = { ...incoming, startedAt: Date.now() + incoming.startedAt - serverTime };
    if (acceptReaction(local, room.code, seen.current)) setEvents(previous => [...previous.filter(e => e.code === room.code && e.startedAt + reactionDefinition(e.reaction).duration > Date.now()), local].slice(-2));
  }, [enabled, current]);

  useEffect(() => {
    const timer = setInterval(() => {
      const room = current.current;
      const now = Date.now();
      setEvents(previous => previous.filter(e => e.code === room?.code && e.startedAt + reactionDefinition(e.reaction).duration > now));
      if (!room || !practice.current) return;
      practiceQueue.current = practiceQueue.current.filter(q => q.event.code === room.code && q.expiresAt > now);
      const blocked = room.phase === 'runout_vote' || room.phase === 'showdown' && now < (room.payoutFinishedAt || 0);
      if (!blocked && practiceQueue.current.length) {
        const next = practiceQueue.current.shift()!;
        const to = room.players.find(p => !p.left && p.seat === next.event.to.seat && p.name === next.event.to.name);
        if (to) receive({ ...next.event, startedAt: now + REACTION_LEAD_MS }, now);
      }
    }, 200);
    const hide = () => { if (document.hidden) { setEvents([]); setSelection(null); } };
    document.addEventListener('visibilitychange', hide);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', hide); };
  }, [enabled, current, practice, receive]);
  // Clear effects when the external table changes; history never replays effects.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setEvents([]); setQueued(false); setSelection(null); setError(''); }, [code]);

  async function send(reaction: string) {
    const room = current.current;
    if (!enabled || !room || target === null || inFlight.current) return;
    setError('');
    if (Date.now() < nextSend.current) { setError('Wait a moment before sending another.'); return; }
    const from = room.players.find((p: ReactionPlayer) => p.id === room.me && !p.left);
    const to = room.players.find((p: ReactionPlayer) => p.seat === target && !p.left);
    if (!to || to.id === room.me) { setTarget(null); return; }
    inFlight.current = true;
    setSending(true);
    try {
      if (practice.current) {
        const now = Date.now();
        const event = { id: crypto.randomUUID(), code: room.code, reaction, startedAt: now + REACTION_LEAD_MS,
          from: { seat: from?.seat ?? null, name: from?.name || 'You' }, to: { seat: to.seat, name: to.name } };
        practiceQueue.current.push({ event, expiresAt: now + 5000 });
      } else {
        // Deliberately no poker command envelope or automatic network retry.
        // Socket delivery and the HTTP acknowledgement share one event id.
        const result = await PokerClient.auth('reactions', {
          code: room.code, requestId: crypto.randomUUID(), reaction, targetSeat: target
        });
        if (result.event) receive(result.event, result.serverTime);
      }
      nextSend.current = Date.now() + REACTION_COOLDOWN_MS;
      setTarget(null);
      setQueued(true);
      setTimeout(() => setQueued(false), 2500);
      return true;
    } catch (e) {
      const failure = e as Error & { status?: number };
      setError(failure.status ? failure.message : 'Could not confirm the reaction. Wait a moment before trying again.');
      return false;
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }
  return { events, queued, target, setTarget, sending, error, send, receive };
}
