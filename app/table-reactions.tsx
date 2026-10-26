'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { REACTIONS, reactionDefinition } from '../lib/reactions.mjs';
import { seatPosition } from '../lib/table-presentation.mjs';
import { type PokerAudio, type PokerSound } from '../lib/poker-audio';
import { type ReactionEvent, type ReactionRoom, type ReactionPlayer, useReactions } from '../lib/client/use-reactions';
import './table-reactions.css';

// Authored vector art stays crisp at every phone size and needs no image request.
function ChappalArt() {
  return <svg viewBox="0 0 80 120" aria-hidden="true" fill="none">
    <path d="M22 110C9 103 10 85 14 68L18 27C19 10 29 3 42 5C61 7 70 20 67 38L59 75C57 88 62 101 51 110C43 117 31 116 22 110Z" fill="#7e341c" stroke="#2b150f" strokeWidth="4" />
    <path d="M24 104C14 97 19 78 21 64L24 29C25 16 31 10 42 12C56 14 63 23 60 37L52 75C49 88 56 98 46 105C40 109 31 109 24 104Z" fill="#db9b52" />
    <path d="M23 55L40 37L58 55" stroke="#763b22" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M23 52L40 35L58 52" stroke="#f6c577" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M40 35L42 22" stroke="#763b22" strokeWidth="7" strokeLinecap="round" />
    <path d="M29 80L44 83M28 88L43 91M28 96L42 99" stroke="#b77639" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

function ChappalAnimation() {
  return <>
    <div className="reaction-projectile"><div className="reaction-projectile-art"><ChappalArt /></div></div>
    <div className="reaction-impact"><span>THWACK!</span><i /><b>✦</b></div>
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
  useEffect(() => {
    // Dropped/late effects never play a detached slap after the animation ends.
    if (renderer && Date.now() < event.startedAt + definition.impactAt) audio?.play(renderer.sound, event.startedAt - Date.now());
  }, [event.id, event.startedAt, definition.impactAt, renderer, audio]);
  if (!renderer || !definition) return null;
  const from = seatPosition(event.from.seat, mySeat, room.settings.seats);
  const to = seatPosition(event.to.seat, mySeat, room.settings.seats);
  const { Animation } = renderer;
  return <div className={`reaction-overlay reaction-${event.reaction}`} style={{
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
