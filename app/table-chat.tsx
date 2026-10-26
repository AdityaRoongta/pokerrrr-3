'use client';
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { seatPosition } from '../lib/table-presentation.mjs';
import { type SocialRoom, type useSocial } from '../lib/client/use-social';
import './table-chat.css';
type Social = ReturnType<typeof useSocial>;
export function ChatButton({ social }: { social: Social }) {
  return <button className="icon-button chat-toggle" aria-label={`Game chat${social.unread ? `, ${social.unread} unread` : ''}`} aria-expanded={social.open} onClick={() => social.setOpen(!social.open)}>
    <MessageCircle size={21} />{social.unread > 0 && <span>{social.unread > 9 ? '9+' : social.unread}</span>}
  </button>;
}
export function SpeechBubbles({ room, social }: { room: SocialRoom; social: Social }) {
  const me = room.players.find((p) => p.id === room.me && !p.left);
  return <div className="speech-layer" aria-hidden="true">{social.bubbles.map(entry => {
    const player = room.players.find((p) => !p.left && p.seat === entry.sender.seat && p.name === entry.sender.name);
    const pos = player ? seatPosition(player.seat, me?.seat || 0, room.settings.seats) : { x: 50, y: 15 };
    return <div key={entry.id} className={`speech-bubble ${pos.y > 60 ? 'bubble-above' : 'bubble-below'}`} style={{ left: `clamp(80px, ${pos.x}%, calc(100% - 80px))`, top: `clamp(45px, ${pos.y}%, calc(100% - 45px))` }}>
      {!player && <b>{entry.sender.name} · </b>}{entry.text}
    </div>;
  })}</div>;
}
export function ChatDrawer({ room, social, myTurn }: { room: SocialRoom; social: Social; myTurn: boolean }) {
  const [draft, setDraft] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastSequence = social.entries.at(-1)?.sequence;
  useEffect(() => {
    if (social.open && atBottom.current) scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
  }, [lastSequence, social.open]);
  useEffect(() => {
    if (!social.open) return;
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') social.setOpen(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [social]);
  if (!social.open) return null;
  return <aside className="chat-drawer" role="region" aria-label="Game chat">
    <header><div><h2>Game chat</h2><small>{room.phase === 'closed' ? 'Read-only · Game ended' : 'This game only'}</small></div><button className="icon-button" aria-label="Close game chat" onClick={() => social.setOpen(false)}><X size={20} /></button></header>
    {myTurn && <button className="chat-turn" onClick={() => social.setOpen(false)}>Your turn · Return to the table</button>}
    <div className="chat-messages" ref={scroll} onScroll={() => { const el = scroll.current; if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64; }}>
      {social.cursor && <button className="chat-older" disabled={social.loading} onClick={async () => {
        const el = scroll.current, height = el?.scrollHeight || 0, top = el?.scrollTop || 0;
        atBottom.current = false;
        await social.loadMore();
        requestAnimationFrame(() => { if (el) el.scrollTop = top + el.scrollHeight - height; });
      }}>{social.loading ? 'Loading…' : 'Earlier messages'}</button>}
      {!social.entries.length && <p className="chat-empty">{social.loading ? 'Loading conversation…' : 'Say something to the table.'}</p>}
      {social.entries.map(entry => entry.kind === 'reaction' ? <div className="chat-activity" key={entry.id}>🩴 {entry.sender.name} → {entry.to?.name}</div> : <article className="chat-message" key={entry.id}>
        <div><b>{entry.sender.name}</b><time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
        <p>{entry.text}</p>
      </article>)}
    </div>
    {social.error && <p className="chat-error" role="status">{social.error}<button onClick={() => void social.loadMore()}>Refresh</button></p>}
    {room.phase !== 'closed' && <form className="chat-compose" onSubmit={async e => { e.preventDefault(); if (await social.send(draft)) setDraft(''); }}>
      <label className="sr-only" htmlFor="chat-message">Message</label><input id="chat-message" value={draft} onChange={e => setDraft(e.target.value)} maxLength={500} placeholder="Message the table…" autoComplete="off" enterKeyHint="send" />
      <button aria-label="Send message" disabled={social.sending || !draft.trim()}><Send size={20} /></button><small>{draft.length}/500</small>
    </form>}
  </aside>;
}
