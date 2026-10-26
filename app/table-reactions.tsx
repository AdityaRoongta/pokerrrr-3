'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { REACTIONS, reactionDefinition } from '../lib/reactions.mjs';
import { seatPosition } from '../lib/table-presentation.mjs';
import { type PokerAudio, type PokerSound } from '../lib/poker-audio';
import { type ReactionEvent, type ReactionRoom, type ReactionPlayer, useReactions } from '../lib/client/use-reactions';
import './table-reactions.css';

// Authored vector art stays crisp at every phone size and needs no image request.
function ChappalArt() {
  return <svg viewBox="0 0 80 120" aria-hidden="true" fill="none">
    <path d="M24 113C13 109 12 98 15 83L20 30C21 13 29 5 42 6C57 7 65 18 63 35L57 78C56 91 59 104 49 112C42 117 31 117 24 113Z" fill="#211c18" />
    <path d="M24 109C16 105 17 94 19 81L24 29C25 16 31 9 42 10C54 11 61 21 59 35L53 78C52 92 55 101 46 108C39 112 31 112 24 109Z" fill="#684b35" />
    <path d="M26 103C21 100 22 89 24 78L28 30C29 20 33 15 41 16C50 17 56 23 54 35L49 78C47 92 51 99 43 104C37 107 31 107 26 103Z" fill="#806047" />
    <path d="M24 109C34 115 45 113 51 105" stroke="#ad8b67" strokeWidth=".8" />
    <path d="M23 59L40 36L58 56L54 68L40 47L24 70Z" fill="#302820" />
    <path d="M24 57L40 34L58 55L55 62L40 43L24 65Z" fill="#4a3527" />
    <path d="M26 56L40 37L55 54" stroke="#967355" strokeWidth="1.2" />
    <path d="M39 35L41 23" stroke="#302820" strokeWidth="5" strokeLinecap="round" />
    <path d="M26 84L44 86M26 91L43 93M27 99L42 100" stroke="#5d432f" strokeWidth="1" opacity=".5" />
  </svg>;
}

function ChappalAnimation() {
  return <>
    <div className="reaction-projectile"><div className="reaction-projectile-art"><ChappalArt /></div></div>
    <div className="reaction-impact"><i /><i /><i /></div>
  </>;
}

// Each reaction owns its art, animation and sound. The transport, targeting,
// freshness rules and overlay lifecycle remain the same for future additions.
const renderers: Record<string, { Icon: typeof ChappalArt; Animation: typeof ChappalAnimation; sound: PokerSound }> = {
  chappal: { Icon: ChappalArt, Animation: ChappalAnimation, sound: 'chappal' }
};

function ReactionAnimation({ event, room, mySeat, audio }: {
  event: ReactionEvent; room: ReactionRoom; mySeat: number; audio: PokerAudio | null;
}) {
  const definition = reactionDefinition(event.reaction);
  const renderer = renderers[event.reaction];
  const [delay] = useState(() => event.startedAt - Date.now());
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = overlay.current?.closest('.table-stage')?.querySelector(`[data-seat-index="${event.to.seat}"] .seat-info`);
    if (!target || Date.now() > event.startedAt + definition.impactAt + 100) return;
    // A short physical jolt at contact sells the hit without moving the seat's
    // layout or interrupting the player clock, cards or betting controls.
    const hit = target.animate([
      { translate: '0 0', offset: 0 }, { translate: '5px 1px', offset: .18 },
      { translate: '-3px -1px', offset: .42 }, { translate: '2px 0', offset: .7 },
      { translate: '0 0', offset: 1 }
    ], { duration: 130, delay: Math.max(0, event.startedAt + definition.impactAt - Date.now()), easing: 'ease-out' });
    return () => hit.cancel();
  }, [event.id, event.startedAt, event.to.seat, definition.impactAt]);
  useEffect(() => {
    // Dropped/late effects never play a detached slap after the animation ends.
    if (renderer && Date.now() < event.startedAt + definition.impactAt) audio?.play(renderer.sound, event.startedAt - Date.now());
  }, [event.id, event.startedAt, definition.impactAt, renderer, audio]);
  if (!renderer || !definition) return null;
  const from = seatPosition(event.from.seat, mySeat, room.settings.seats);
  const to = seatPosition(event.to.seat, mySeat, room.settings.seats);
  const { Animation } = renderer;
  return <div ref={overlay} className={`reaction-overlay reaction-${event.reaction}`} style={{
    '--strike-angle': `${Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI + 90}deg`,
    '--reaction-from-x': `clamp(var(--seat-edge-x), ${from.x}%, calc(100% - var(--seat-edge-x)))`,
    '--reaction-from-y': `clamp(var(--seat-edge-y), ${from.y}%, calc(100% - var(--seat-edge-y)))`,
    '--reaction-to-x': `clamp(var(--seat-edge-x), ${to.x}%, calc(100% - var(--seat-edge-x)))`,
    '--reaction-to-y': `clamp(var(--seat-edge-y), ${to.y}%, calc(100% - var(--seat-edge-y)))`,
    '--reaction-delay': `${delay}ms`, '--reaction-duration': `${definition.duration}ms`
  } as CSSProperties} aria-hidden="true">
    <Animation />
    <div className="reaction-caption">{event.from.name} <span>→</span> {event.to.name} · {definition.label}</div>
  </div>;
}

export function TableReactions({ room, mySeat, reactions, audio }: {
  room: ReactionRoom; mySeat: number; reactions: ReturnType<typeof useReactions>; audio: PokerAudio | null;
}) {
  const target = room.players.find((p: ReactionPlayer) => p.seat === reactions.target && !p.left && p.id !== room.me);
  useEffect(() => {
    if (!target) return;
    const dismiss = (e: PointerEvent) => {
      if (!(e.target as Element).closest('[data-reaction-picker], [data-reaction-target]')) reactions.setTarget(null);
    };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') reactions.setTarget(null); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [target, reactions]);
  const pos = target ? seatPosition(target.seat, mySeat, room.settings.seats) : null;
  return <>
    {target && pos && room.phase !== 'closed' && <div className={`reaction-picker ${pos.y > 60 ? 'above-seat' : 'below-seat'}`} data-reaction-picker role="dialog" aria-label={`Reactions for ${target.name}`} style={{
      left: `clamp(90px, ${pos.x}%, calc(100% - 90px))`,
      top: `clamp(var(--seat-edge-y), ${pos.y}%, calc(100% - var(--seat-edge-y)))`
    }}>
      <div className="reaction-picker-heading"><span>Send to <b>{target.name}</b></span><button type="button" aria-label="Close reactions" onClick={() => reactions.setTarget(null)}>×</button></div>
      <div className="reaction-choices">{Object.values(REACTIONS).map(definition => {
        const renderer = renderers[definition.id];
        if (!renderer) return null;
        return <button type="button" key={definition.id} disabled={reactions.sending} onClick={() => void reactions.send(definition.id)} aria-label={`Send ${definition.label} to ${target.name}`}>
          <renderer.Icon /><span>{reactions.sending ? 'Sending…' : definition.label}</span>
        </button>;
      })}</div>
      {reactions.error && <p role="status">{reactions.error}</p>}
    </div>}
    {reactions.event?.code === room.code && <ReactionAnimation key={reactions.event.id} event={reactions.event} room={room} mySeat={mySeat} audio={audio} />}
    <span className="reaction-announcement" role="status" aria-live="polite">{reactions.event ? `${reactions.event.from.name} sent ${reactions.event.to.name} a ${reactions.event.reaction}` : ''}</span>
  </>;
}
