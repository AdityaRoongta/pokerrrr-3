'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, Download, History, Layers3, MoreHorizontal, Plus, Smartphone, X, Volume2, VolumeX, Trophy, Pause, Play, ChevronRight, CheckCircle2 } from 'lucide-react';
import { PokerAudio } from '../lib/poker-audio';
import { useTableEffects } from '../lib/use-table-effects';
import { seatPosition } from '../lib/table-presentation.mjs';
import { RunoutVote, RunoutDecision, RunoutAnnouncement } from './runout-vote';
import { TableMotion } from './table-motion';
import { newRoom, command, startHand, act, legal, view, resolveAlias, tick, shortcutRaiseTo } from '../lib/client/practice.mjs';
import { PokerClient, type Connection } from '../lib/client/poker-client';
import { GameHistory } from './game-history';
import { PlayerLobby, PinSettings } from './player-lobby';
import { nextRaise } from '../lib/client/raise-selection.mjs';
type Room = any;
// Temporary identities for local practice; multiplayer identity comes from the server.
function playerId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = b[6] & 15 | 64;
  b[8] = b[8] & 63 | 128;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);
const gameName: Record<string, string> = {
  NLH: 'Texas Hold’em',
  PLO4: '4-card Omaha',
  PLO5: '5-card Omaha'
};
function Card({
  value,
  small = false,
  back = false,
  highlight = false,
  dim = false
}: {
  value?: number;
  small?: boolean;
  back?: boolean;
  highlight?: boolean;
  dim?: boolean;
}) {
  if (back) return <div className={`card back ${small ? 'small' : ''}`}>
    <span>♠</span>
  </div>;
  if (value === undefined) return <div className="card empty" />;
  const rank = '23456789TJQKA'[value % 13],
    suit = ['♣', '♦', '♥', '♠'][Math.floor(value / 13)];
  return <div className={`card ${small ? 'small' : ''} ${'♦♥'.includes(suit) ? 'red' : ''} ${highlight ? 'winning-card' : ''} ${dim ? 'dimmed-card' : ''}`} aria-label={`${rank === 'T' ? '10' : rank} ${['clubs', 'diamonds', 'hearts', 'spades'][Math.floor(value / 13)]}${highlight ? ', winning card' : ''}`}>
    <b>
      {rank === 'T' ? '10' : rank}
    </b>
    <span>
      {suit}
    </span>
  </div>;
}
const isStaging = process.env.NEXT_PUBLIC_APP_ENV === 'staging';
export default function Home() {
  const [room, setRoom] = useState<Room>(null),
    [name, setName] = useState(''),
    [rotation] = useState(3),
    [sb] = useState(25),
    [bb] = useState(50),
    [buyin] = useState(2500),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [panel, setPanel] = useState(''),
    [raise, setRaise] = useState(0),
    [rebuy, setRebuy] = useState(2500),
    [install, setInstall] = useState<any>(null),
    [clock, setClock] = useState(Date.now()),
    [confirm, setConfirm] = useState(''),
    [sound, setSound] = useState(true),
    [selectedWinner, setSelectedWinner] = useState(''),
    [selectedShortcut, setSelectedShortcut] = useState(''),
    [selectedRun, setSelectedRun] = useState(1),
    [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const audio = useRef<PokerAudio | null>(null);
  if (!audio.current) audio.current = new PokerAudio();
  const effects = useTableEffects(room, audio.current),
    animationBusy = useRef(false);
  animationBusy.current = effects.presentationBusy;
  const [player, setPlayer] = useState<{
    id: string;
    name: string;
  } | null>(null),
    [players, setPlayers] = useState<any[]>([]),
    [lobby, setLobby] = useState<any>({
      activeGame: null
    }),
    [authLoading, setAuthLoading] = useState(true),
    [authEpoch, setAuthEpoch] = useState(0);
  const autoResume = useRef(true);
  const [connection, setConnection] = useState<Connection>('connecting');
  const transport = useRef<PokerClient | null>(null);
  const token = useRef(''),
    demo = useRef<Room>(null),
    current = useRef<Room>(null),
    pending = useRef(false),
    offset = useRef(0);
  // HTTP replies and socket pushes can race. Never replace a newer snapshot.
  function update(r: Room) {
    if (current.current?.code === r.code && current.current.version > r.version) return;
    const selection = nextRaise(current.current, r, raiseRef.current);
    current.current = r;
    offset.current = (r.serverTime || Date.now()) - Date.now();
    setRoom(r);
    if (r.legal) {
      setRaise(selection.amount);
      raiseRef.current = selection.amount;
    }
    if (selection.reset) setSelectedShortcut('');
  }
  const raiseRef = useRef(raise);
  raiseRef.current = raise;
  // Restore the HttpOnly login before subscribing to the table.
  async function refreshIdentity() {
    try {
      const [list, session] = await Promise.all([PokerClient.auth('players'), PokerClient.auth('session')]);
      setPlayers(list.players);
      setPlayer(session.player);
      if (session.player) {
        token.current = session.player.id;
        setName(session.player.name);
        transport.current = new PokerClient(session.player.id);
        if (transport.current.hasPending()) setError('An earlier action is unconfirmed. Retry last action to check its saved result.');
        setLobby(await PokerClient.auth('lobby'));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAuthLoading(false);
    }
  }
  function expired() {
    demo.current = null;
    transport.current = null;
    setPlayer(null);
    current.current = null;
    setRoom(null);
    setPanel('');
    setError('Please sign in again.');
  }
  async function login(id: string, pin: string) {
    setBusy(true);
    setError('');
    try {
      const result = await PokerClient.auth('login', {
        playerId: id,
        pin
      });
      autoResume.current = false;
      setPlayer(result.player);
      token.current = result.player.id;
      setName(result.player.name);
      transport.current = new PokerClient(result.player.id);
      setLobby(await PokerClient.auth('lobby'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await PokerClient.auth('logout', {});
      demo.current = null;
      expired();
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function changePin(currentPin: string, newPin: string) {
    setBusy(true);
    setError('');
    try {
      await PokerClient.auth('pin', {
        currentPin,
        newPin
      });
      setAuthEpoch(n => n + 1);
      setPanel('');
      setNotice('PIN updated.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function api(input?: any, roomCode?: string) {
    if (!transport.current) throw new Error('Player identity is loading');
    return input ? transport.current.send(input, current.current || undefined) : transport.current.snapshot(roomCode || current.current?.code || '');
  }
  useEffect(() => {
    const enabled = localStorage.getItem('hg-sound') !== 'off';
    setSound(enabled);
    audio.current?.setEnabled(enabled);
    token.current = playerId();
    void refreshIdentity();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
    const installer = (e: any) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener('beforeinstallprompt', installer);
    const timer = setInterval(() => setClock(Date.now()), 500);
    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeinstallprompt', installer);
    };
  }, []);
  useEffect(() => {
    if (!player || !transport.current) return;
    return transport.current.connect(state => {
      setLobby(state.lobby);
      const r = state.room;
      if (r && !demo.current && (current.current && current.current.code === r.code || !current.current && autoResume.current && state.lobby.activeGame?.joined && state.lobby.activeGame?.code === r.code)) update(r);
    }, setConnection, expired);
  }, [player?.id, authEpoch]);
  useEffect(() => {
    const id = setInterval(() => {
      const r = demo.current;
      if (r?.phase === 'runout_vote') {
        for (const voter of r.runVote.voters) {
          if (voter.id !== token.current && voter.choice === null && Date.now() >= r.runVote.opensAt && Date.now() < r.runVote.deadline) command(r, voter.id, {
            type: 'runout_vote',
            choice: r.runVote.canTwice ? 2 : 1
          });
        }
        update(view(r, token.current));
        return;
      }
      if (!r || !r.turn || r.turn === token.current || pending.current || animationBusy.current) return;
      const l = legal(r, r.turn);
      if (!l) return;
      try {
        const roll = Math.random();
        if (l.canRaise && roll < .16) act(r, r.turn, 'raise', Math.min(l.min, l.max));
  else if (l.call && roll < .2) act(r, r.turn, 'fold');
  else act(r, r.turn, l.call ? 'call' : 'check');
        update(view(r, token.current));
      } catch (e: any) {
        setError(e.message);
      }
    }, 850);
    return () => clearInterval(id);
  }, []);
  useLayoutEffect(() => {
    if (!room) return;
    const html = document.documentElement,
      body = document.body,
      oldHtml = html.style.overflow,
      oldBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = oldHtml;
      body.style.overflow = oldBody;
    };
  }, [Boolean(room)]);
  useEffect(() => {
    const id = setInterval(() => {
      const r = demo.current;
      if (!r || pending.current) return;
      try {
        if (tick(r)) update(view(r, token.current));
      } catch (e: any) {
        setError(e.message);
      }
    }, 200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 3500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  function toggleSound() {
    const enabled = !sound;
    setSound(enabled);
    audio.current?.setEnabled(enabled);
    localStorage.setItem('hg-sound', enabled ? 'on' : 'off');
    if (enabled) {
      audio.current?.unlock();
      audio.current?.play('deal', 100);
    }
  }
  function previewShowdown() {
    const r = demo.current;
    if (!r || r.phase === 'showdown') return;
    let steps = 0;
    while (r.turn && steps++ < 200) {
      const l = legal(r, r.turn);
      if (!l) break;
      act(r, r.turn, l.call ? 'call' : 'check');
    }
    update(view(r, token.current));
  }
  // Block duplicate taps and wait for a fresh connection before submitting actions.
  async function send(type: string, extra: any = {}) {
    if (pending.current) return false;
    if (!demo.current && connection !== 'connected') {
      setError('Reconnecting to the table. Wait for a fresh view.');
      return false;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (demo.current) {
        command(demo.current, token.current, {
          type,
          ...extra,
          player: extra.player ? resolveAlias(demo.current, extra.player) : undefined
        });
        update(view(demo.current, token.current));
      } else {
        const r = await api({
          type,
          code: current.current?.code,
          version: current.current?.version,
          ...extra
        });
        update(r);
      }
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }
  async function openTable(settings: any) {
    if (!player) return;
    setBusy(true);
    setError('');
    try {
      const active = lobby.activeGame;
      const r = active ? await api(undefined, active.code) : await api({
        type: 'create',
        ...settings,
        seats: 8,
        takeSeat: false
      });
      autoResume.current = true;
      update(r);
    } catch (e: any) {
      setError(e.message);
      try {
        setLobby(await PokerClient.auth('lobby'));
      } catch { }
    } finally {
      setBusy(false);
    }
  }
  // Practice is isolated in demo.current and never sends multiplayer commands.
  function practice() {
    setError('');
    const r = newRoom('DEMO', token.current, {
      name: name.trim() || 'You',
      sb,
      bb,
      buyin,
      seats: 8,
      rotation
    });
    for (const n of ['Alex', 'Sam', 'Jamie', 'Rohan', 'Priya']) {
      const id = playerId();
      command(r, id, {
        type: 'join',
        name: n,
        buyin
      });
    }
    demo.current = r;
    startHand(r);
    update(view(r, token.current));
  }
  function previewAllIn() {
    const r: Room = newRoom('DEMO', token.current, {
      name: name.trim() || 'You',
      sb,
      bb,
      buyin,
      seats: 2,
      rotation
    }),
      other = playerId();
    command(r, other, {
      type: 'join',
      name: 'Alex',
      buyin
    });
    r.paused = true;
    startHand(r, Date.now() - 6000);
    act(r, r.turn, 'raise', legal(r, r.turn)!.max);
    act(r, r.turn, 'call');
    demo.current = r;
    setPanel('');
    setError('');
    update(view(r, token.current));
  }
  async function retryLastAction() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const r = await transport.current?.retryPending();
      if (r) {
        update(r);
      }
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function exit() {
    demo.current = null;
    current.current = null;
    setRoom(null);
    setPanel('');
    setError('');
    autoResume.current = false;
  }
  async function installApp() {
    if (install) {
      await install.prompt();
      setInstall(null);
    } else setPanel('install');
  }
  const controlsBusy = busy || !demo.current && connection !== 'connected';
  const me = room?.players.find((p: any) => p.id === room.me),
    live = room && ['preflop', 'flop', 'turn', 'river'].includes(room.phase),
    myTurn = room?.turn === room?.me,
    l = room?.legal,
    seconds = room?.deadline ? Math.max(0, Math.ceil((room.deadline - clock - offset.current) / 1000)) : 0;
  const voting = room?.phase === 'runout_vote',
    handActive = live || voting;
  useEffect(() => {
    if (!voting) return;
    const id = setInterval(() => setClock(Date.now()), 100);
    return () => clearInterval(id);
  }, [voting]);
  const stackLabel = (p: any) => effects.playerStack(p) > 0 ? fmt(effects.playerStack(p)) : room?.phase === 'closed' ? 'Cashed out' : (handActive || room?.phase === 'showdown' && !effects.settled) && p.inHand && !p.folded ? 'All-in' : p.buyins === 0 ? 'Buy-in pending' : 'Busted';
  const openReload = () => {
    if (room?.phase === 'closed' || room?.terminationPending || me?.pendingSeatAction === 'leave') return;
    setRebuy(Math.max(room.settings.bb, Math.min(room.settings.buyin, room.settings.maxBuyin)));
    setPanel('buyin');
  };
  const seated = Boolean(me && !me.left);
  function chooseSeat(seat: number) {
    setSelectedSeat(seat);
    setRebuy(room.settings.buyin);
    setError('');
    setPanel('seat');
  }
  const visiblePlayers = room?.players.filter((p: any) => !p.left) || [],
    gameIndex = room?.rotationIndex || 0;
  const awardRun = effects.activeAwardRun,
    allWinners = room?.phase === 'showdown' ? (room.result || []).filter((w: any) => (w.wonAmount ?? w.amount) > 0) : [],
    winners = awardRun ? allWinners.flatMap((w: any) => {
      const h = w.runHands?.find((h: any) => h.run === awardRun);
      return h?.wonAmount > 0 ? [{
        ...w,
        ...h,
        runHands: [h],
        pots: w.pots?.filter((p: any) => p.run === awardRun)
      }] : [];
    }) : allWinners,
    focusedWinner = winners.find((w: any) => w.id === selectedWinner) || winners[0],
    focusedHand = focusedWinner?.runHands?.find((h: any) => h.run === (awardRun || selectedRun)) || focusedWinner?.runHands?.[0] || focusedWinner,
    focusedRunNumber = focusedHand?.run || 1;
  const raiseMin = l ? Math.min(l.min, l.max) : 0,
    raiseMax = l?.max || 0,
    raiseValid = Boolean(l && Number.isSafeInteger(raise) && raise >= raiseMin && raise <= raiseMax),
    raiseValue = Math.min(raiseMax, Math.max(raiseMin, raise || raiseMin));
  const autoSeconds = room?.nextDealAt ? Math.max(0, Math.min(3, Math.ceil((room.nextDealAt - clock - offset.current) / 1000))) : null;
  const readyPlayers = visiblePlayers.filter((p: any) => p.stack > 0 && !p.away).length;
  const autoStatus = room?.terminationPending ? 'Terminating after payout' : room?.paused ? 'Auto-deal paused' : readyPlayers < 2 ? 'Waiting for two ready players' : room?.nextDealAt && clock + offset.current < room.nextDealAt - 3000 ? 'Winner reveal…' : autoSeconds !== null ? `Next hand in ${autoSeconds}…` : 'Preparing the next hand…';
  const clampRaise = (v: number) => Math.min(raiseMax, Math.max(raiseMin, Math.round(v || raiseMin)));
  return <div className={`app ${room ? 'in-game' : ''}`} onPointerDownCapture={() => audio.current?.unlock()} onKeyDownCapture={() => audio.current?.unlock()}>

    <header className="topbar">
      <button className="brand" onClick={room ? exit : undefined} aria-label="Dunzo Club">
        <span className="brand-icon">♠</span>
        <span>Dunzo Club<span className="brand-dot">.</span>{isStaging && <small className="staging-badge">STAGING</small>}</span>
      </button>
      <div className="top-right">
        <button className="icon-button sound-toggle" onClick={toggleSound} aria-label={sound ? 'Mute sound effects' : 'Enable sound effects'} aria-pressed={sound} title={sound ? 'Sound on' : 'Sound off'}>
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        {player && <button className="text-button" onClick={() => {
          setError('');
          setPanel('account');
        }}>
          {player.name}
        </button>}
        {room ? <>
          <span className="connection">
            <i />
            {demo.current ? 'Practice table' : connection === 'connected' ? 'Live table' : connection === 'offline' ? 'Offline' : 'Reconnecting…'}
          </span>
          <button className="icon-button" onClick={() => setPanel('menu')} aria-label="Table menu">
            <MoreHorizontal size={22} />
          </button>
        </> : <>
          <button className="install-top" onClick={installApp}>
            <Download size={15} />
            <span>Install app</span>
          </button>
        </>}
      </div>
    </header>

    {!room ? <main className="lobby simple-lobby">

      <PlayerLobby player={player} players={players} activeGame={lobby.activeGame} loading={authLoading} busy={busy} error={error} onLogin={login} onOpen={openTable} onPractice={practice} onRetry={retryLastAction} hasPending={transport.current?.hasPending() || false} />

      {player && <GameHistory key={player.id} refreshKey={lobby.activeGame?.code || ''} />}



    </main> : <main className="game-layout">

      <div className="table-heading">
        <div>
          {demo.current && <div className="eyebrow">Practice</div>}
          <h2>
            {room.phase === 'closed' ? 'Game Ended' : 'Poker Table'}
          </h2>
        </div>
        <div className="heading-actions">
          {demo.current && live && <button className="secondary preview-showdown" disabled={effects.presentationBusy} onClick={previewShowdown}>Preview showdown <ArrowUpRight size={14} /></button>}
          <span className="stakes">{fmt(room.settings.sb)} / {fmt(room.settings.bb)} <small>BLINDS</small></span>
        </div>
      </div>

      <div className="game-main">
        <section className="play-area">
          <div className="rotation-bar">
            {(room.settings.games || ['NLH', 'PLO4', 'PLO5']).map((g: string, i: number) => <div className={i === gameIndex ? 'active' : ''} key={g}>
              <span>
                {g}
              </span>
              {i === gameIndex && <small>
                {room.phase === 'lobby' ? 'Up first' : `${room.handsIntoRotation + (['showdown', 'closed'].includes(room.phase) ? 0 : 1)} / ${room.settings.rotation} hands`}
              </small>}
              {i < (room.settings.games || ['NLH', 'PLO4', 'PLO5']).length - 1 && <ChevronRight size={13} />}
            </div>)}
          </div>

          <div className={`table-stage ${room.runCount === 2 ? 'two-runouts' : ''} ${room.runVote ? 'has-run-vote' : ''}`}>
            <div className="felt">
              <div className="felt-inner" />
              <div className="felt-brand">Dunzo Club</div>
              <div className="board-zone">
                {room.phase === 'lobby' ? <div className="waiting">
                  <span>♠</span>
                  <h3>Waiting for players</h3>
                  <p>Two seated players with chips are required.</p>
                </div> : room.phase === 'closed' ? <div className="waiting">
                  <span>♠</span>
                  <h3>Game Ended</h3>
                  <button className="secondary" onClick={() => setPanel('ledger')}>Current Game Rankings</button>
                </div> : <>
                  <div className="pot-label">
                    {room.phase === 'showdown' ? 'LAST POT' : 'TOTAL POT'}
                  </div>
                  <div className="pot-amount">
                    {fmt(room.phase === 'showdown' ? room.lastPot : room.players.reduce((s: number, p: any) => s + (p.inHand ? p.total : 0), 0))}
                  </div>
                  <div className="runout-boards">
                    {(room.runCount === 2 ? room.runBoards : [room.board]).map((board: number[], runIndex: number) => <div className={`runout-board ${effects.activeRun === runIndex + 1 ? 'active-run' : ''}`} key={runIndex}>
                      {room.runCount === 2 && <span className="run-board-label">RUN {runIndex + 1}</span>}
                      <div className="board-cards">
                        {Array.from({
                          length: 5
                        }, (_, i) => {
                          const shown = effects.boardVisible(i, runIndex),
                            value = shown ? board[i] : undefined,
                            winningBoard = effects.resultReady && runIndex + 1 === focusedRunNumber ? focusedHand?.boardCards || [] : [],
                            timeline = runIndex === 1 ? effects.board2 : effects.board;
                          return <div key={`${room.handStartedAt || 0}:${runIndex}:${i}:${shown}`} className={value !== undefined && timeline?.events.some((e: any) => e.index === i) ? 'board-card-wrap board-dealt' : 'board-card-wrap'}>
                            <Card value={value} highlight={value !== undefined && winningBoard.includes(value)} dim={effects.resultReady && winningBoard.length > 0 && value !== undefined && !winningBoard.includes(value)} />
                          </div>;
                        })}
                      </div>
                    </div>)}
                  </div>
                  <div className="street">
                    {room.phase === 'showdown' ? effects.activeRun ? `RUN ${effects.activeRun} · ${effects.activeAwardRun ? 'WINNER' : 'DEALING'}` : 'HAND COMPLETE' : voting ? 'ALL-IN' : room.phase.toUpperCase()}
                    <span> · </span>
                    {gameName[room.game]}
                  </div>
                  {room.phase === 'showdown' && effects.resultReady && <div className="winner-line">
                    {winners.map((w: any) => <span key={w.id}>♛ {w.name} +{fmt(w.wonAmount ?? w.amount)}</span>)}
                  </div>}
                </>}
              </div>
            </div>

            {Array.from({
              length: room.settings.seats
            }, (_, s) => {
              const p = visiblePlayers.find((p: any) => p.seat === s),
                {
                  x,
                  y
                } = seatPosition(s, me?.seat || 0, room.settings.seats),
                win = effects.resultReady ? winners.find((w: any) => w.id === p?.id) : null,
                seatHand = win?.runHands?.find((h: any) => h.run === focusedRunNumber) || win?.runHands?.[0] || win,
                cardCount = room.game === 'NLH' ? 2 : room.game === 'PLO4' ? 4 : 5,
                visibleCount = effects.visibleHoleCards(s, cardCount);
              return <div key={s} className={`seat ${p ? 'occupied' : 'open'} ${p?.id === room.turn ? 'acting' : ''} ${p?.folded && handActive ? 'folded' : ''} ${p?.id === room.me ? 'your-seat' : ''} ${win ? 'winner-seat' : ''}`} style={{
                left: `clamp(var(--seat-edge-x), ${x}%, calc(100% - var(--seat-edge-x)))`,
                top: `clamp(var(--seat-edge-y), ${y}%, calc(100% - var(--seat-edge-y)))`
              }}>
                {p ? <>
                  {win && <div className="winner-badge"><Trophy size={10} /> +{fmt(win.wonAmount ?? win.amount)}</div>}
                  <div className="seat-top">
                    {p.inHand && p.cards?.length ? <div className="hole-cards">
                      {p.cards.slice(0, visibleCount).map((c: number, i: number) => <span className={effects.dealing ? 'arriving-hole-card' : ''} key={`${room.handStartedAt || 0}:${i}`}>
                        <Card value={c} small highlight={Boolean(seatHand?.holeCards?.includes(c))} dim={Boolean(seatHand?.holeCards?.length && !seatHand.holeCards.includes(c))} />
                      </span>)}
                    </div> : p.inHand && handActive ? <div className="hole-cards">
                      {Array.from({
                        length: visibleCount
                      }, (_, i) => <span className={effects.dealing ? 'arriving-hole-card' : ''} key={`${room.handStartedAt || 0}:${i}`}>
                        <Card small back />
                      </span>)}
                    </div> : <div className="avatar">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>}
                  </div>
                  <div className="seat-info" role={p.id === room.me && room.phase !== 'closed' ? 'button' : undefined} tabIndex={p.id === room.me && room.phase !== 'closed' ? 0 : undefined} aria-label={p.id === room.me && room.phase !== 'closed' ? `${p.name}, ${stackLabel(p)}, reload chips` : undefined} onClick={p.id === room.me ? openReload : undefined} onKeyDown={p.id === room.me ? e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openReload();
                    }
                  } : undefined}>
                    <span>
                      {p.name}
                      {p.id === room.me && <small> YOU</small>}
                    </span>
                    <strong className={stackLabel(p) === 'Busted' ? 'busted-label' : ''}>
                      {stackLabel(p)}
                    </strong>
                    {p.seat === room.dealer && <b className="dealer-chip">D</b>}
                  </div>
                  <div className="seat-caption">
                    {win ? `WINNER · ${[...new Set(win.pots?.map((p: any) => room.runCount === 2 ? `Run ${p.run}` : p.label))].join(' / ') || 'Pot'}` : effects.dealing && p.inHand ? 'Dealing…' : p.id === room.turn ? `${seconds}s · Thinking` : room.phase === 'closed' ? '' : p.pendingSeatAction === 'leave' ? 'Getting up after hand' : p.pendingSeatAction === 'sit_out' ? 'Sitting out after hand' : p.away ? 'Sitting out' : p.stack === 0 && !p.inHand ? p.buyins > 0 ? 'Busted' : 'Buy-in pending' : p.inHand && handActive ? p.folded ? 'Folded' : p.stack === 0 ? 'All-in' : p.action || 'Ready' : 'Ready'}
                  </div>
                  {handActive && p.bet > 0 && <div className="seat-bet">● {fmt(p.bet)}</div>}
                </> : <button className="seat-choice" aria-label={`Choose seat ${s + 1}`} disabled={controlsBusy || seated || room.phase === 'closed' || room.terminationPending} onClick={() => chooseSeat(s)}>
                  <span className="empty-seat">
                    <Plus size={15} />
                  </span>
                  <small>Seat {s + 1}</small>
                </button>}
              </div>;
            })}

            <TableMotion room={room} mySeat={me?.seat || 0} effects={effects} />

            <RunoutAnnouncement room={room} effects={effects} />
            <RunoutVote room={room} now={clock + offset.current} busy={busy} send={send} />

            {room.phase === 'showdown' && effects.resultReady && focusedWinner && <section className="showdown-result table-win-card" aria-label="Hand result" aria-live="polite">
              <div className="result-heading">
                <Trophy size={22} />
                <div>
                  <span className="eyebrow">
                    {awardRun ? `RUN ${awardRun} · ${winners.length > 1 ? 'POT AWARDS' : 'WINNER'}` : room.runCount === 2 ? 'FINAL RESULT' : winners.length > 1 ? 'POT AWARDS' : 'WINNER'}
                  </span>
                  <h3>
                    {focusedWinner.name}
                    {focusedWinner.name === 'You' ? ' win ' : ' wins '}
                    <strong>
                      {fmt(focusedWinner.wonAmount ?? focusedWinner.amount)}
                    </strong>
                  </h3>
                  <p>
                    {focusedHand.description || focusedHand.hand}
                  </p>
                </div>
              </div>
              {winners.length > 1 && <div className="winner-choices">
                {winners.map((w: any) => <button key={w.id} className={focusedWinner.id === w.id ? 'selected' : ''} onClick={() => setSelectedWinner(w.id)}>{w.name} +{fmt(w.wonAmount ?? w.amount)} <small>
                  {w.pots?.map((p: any) => `${room.runCount === 2 ? `Run ${p.run} · ` : ''}${p.label}${p.tied ? ' · split' : ''}`).join(' / ')}
                </small></button>)}
              </div>}
              {room.runCount === 2 && focusedWinner.runHands?.length > 0 && <div className="run-hand-tabs">
                {focusedWinner.runHands.map((h: any) => <button key={h.run} aria-pressed={h.run === focusedRunNumber} onClick={() => setSelectedRun(h.run)}>Run {h.run} · +{fmt(h.wonAmount)}</button>)}
              </div>}
              {focusedHand.winningCards?.length > 0 && <div className="best-five">
                <span>
                  {room.runCount === 2 ? `RUN ${focusedRunNumber} · WINNING FIVE` : 'WINNING FIVE'}
                </span>
                <div>
                  {focusedHand.winningCards.map((c: number) => <Card key={c} value={c} small highlight />)}
                </div>
              </div>}
              <div className="pot-award-notes">
                {focusedWinner.pots?.map((p: any, i: number) => <span key={i}>{room.runCount === 2 ? `Run ${p.run} · ` : ''}{p.label}{p.tied ? ' · split' : ''}: {fmt(p.amount)}</span>)}
                {room.result?.filter((w: any) => w.returnedAmount > 0).map((w: any) => <span className="returned-note" key={w.id}>{fmt(w.returnedAmount)} uncalled returned to {w.name}</span>)}
              </div>
            </section>}

          </div>

          <div className="action-zone">
            {room.terminationPending && <p className="game-status" role="status">Game will terminate after this hand.</p>}
            {!seated && room.phase !== 'closed' ? <>
              <p className="game-status">
                {room.terminationPending ? 'Game termination pending.' : 'Select an empty seat, then load chips.'}
              </p>
              {error && <p className="error" role="alert">
                {error}
              </p>}
              {room.host && room.phase === 'lobby' && <button className="primary" disabled={controlsBusy || readyPlayers < 2} onClick={() => send('deal')}>Deal Hand</button>}
            </> : <>
              <RunoutDecision room={room} />
              {room.requests.some((q: any) => q.id === room.me) && <button className="pending-buyins" onClick={openReload}><Plus size={14} /> Your reload will be added automatically after this hand.</button>}
              {error && <div className="error" role="alert">
                {error}
                {transport.current?.hasPending() && <button type="button" onClick={retryLastAction}>Retry last action</button>}
              </div>}
              {voting ? <div className="between-hands">
                <div>
                  <strong>Once / Twice vote</strong>
                  <span>Private choices · five seconds · no choice means Once.</span>
                </div>
                <div className="auto-deal-status">
                  <b>
                    {Math.max(0, Math.min(5, Math.ceil((room.runVote.deadline - clock - offset.current) / 1000)))}
                  </b>
                </div>
              </div> : live ? <>
                <div className="turn-status">
                  <i className={myTurn ? 'your-turn' : ''} />
                  {effects.dealing ? 'Shuffling & dealing…' : myTurn ? 'Your turn' : `${room.players.find((p: any) => p.id === room.turn)?.name || 'Player'} is thinking…`}
                  <span>
                    {effects.dealing ? '' : `${seconds}s`}
                  </span>
                </div>
                {myTurn && l && !effects.presentationBusy ? <>
                  <div className="betting-controls">
                    <div className="betting-main">
                      <div className="quick-bets">
                        {l.canRaise && [['½ pot', .5], ['Pot', 1]].map(([label, n]) => <button className="bet-shortcut" key={label} aria-pressed={selectedShortcut === label} title={`Raise to ${fmt(shortcutRaiseTo(current.current, token.current, Number(n)))}`} onClick={() => {
                          setSelectedShortcut(String(label));
                          setRaise(shortcutRaiseTo(current.current, token.current, Number(n)));
                        }}>
                          {label}
                        </button>)}
                        {l.canRaise && l.max === me.bet + me.stack && <button className="bet-shortcut" aria-pressed={selectedShortcut === 'All-in'} onClick={() => {
                          setSelectedShortcut('All-in');
                          setRaise(l.max);
                        }}>All-in</button>}
                        {l.canRaise && <label>Raise to<input type="number" value={raise} min={Math.min(l.min, l.max)} max={l.max} step={1} onBlur={() => setRaise(clampRaise(raise))} onChange={e => {
                          setSelectedShortcut('');
                          setRaise(Number(e.target.value));
                        }} /></label>}
                      </div>
                      <div className="action-buttons">
                        <button className="fold" disabled={controlsBusy} onClick={() => send('fold')}>Fold</button>
                        <button className="secondary" disabled={controlsBusy} onClick={() => send(l.call ? 'call' : 'check')}>
                          {l.call ? `Call ${fmt(l.call)}` : 'Check'}
                        </button>
                        <button className="primary" disabled={controlsBusy || !l.canRaise || !raiseValid} onClick={() => send('raise', {
                          amount: raise
                        })}>
                          {l.canRaise ? `Raise to ${fmt(raise)}` : 'Raise unavailable'}
                        </button>
                      </div>
                    </div>
                    {l.canRaise && <div className="raise-slider-control">
                      <span>
                        {fmt(raiseMax)}
                      </span>
                      <input type="range" aria-label="Raise amount slider" aria-orientation="vertical" min={raiseMin} max={raiseMax} step={1} value={raiseValue} disabled={busy || raiseMin === raiseMax} onChange={e => {
                        setSelectedShortcut('');
                        setRaise(Number(e.target.value));
                      }} style={{
                        '--range-fill': `${raiseMax > raiseMin ? (raiseValue - raiseMin) / (raiseMax - raiseMin) * 100 : 100}%`
                      } as React.CSSProperties} />
                      <span>
                        {fmt(raiseMin)}
                      </span>
                    </div>}
                  </div>
                </> : <div className="waiting-actions">
                  <span>
                    {effects.dealing ? 'Cards are being dealt clockwise.' : 'Waiting for your turn.'}
                  </span>
                </div>}
              </> : <div className="between-hands">
                <div>
                  <strong>
                    {room.phase === 'closed' ? 'Session complete' : room.phase === 'showdown' ? autoStatus : 'Waiting for players'}
                  </strong>
                  <span>
                    {room.phase === 'closed' ? 'Review the ledger and track payments.' : room.phase === 'showdown' ? room.terminationPending ? '' : 'Tap your player card to reload.' : room.host ? 'Two seated players with chips are required.' : 'Waiting for the first deal.'}
                  </span>
                </div>
                {room.phase === 'closed' ? <button className="primary" onClick={() => setPanel('ledger')}>Current Game Rankings <ArrowUpRight size={16} /></button> : room.phase === 'showdown' ? <div className="auto-deal-status" role="status">
                  {room.nextDealAt && clock + offset.current >= room.nextDealAt - 3000 ? <b>
                    {autoSeconds}
                  </b> : <span>↻</span>}
                  {room.host && <button className="secondary pause-deal" disabled={controlsBusy} onClick={() => send('pause')} aria-label={room.paused ? 'Resume auto-deal' : 'Pause auto-deal'}>
                    {room.paused ? <Play size={16} /> : <Pause size={16} />}
                  </button>}
                </div> : room.host ? <button className="primary" disabled={controlsBusy || effects.presentationBusy || visiblePlayers.filter((p: any) => p.stack > 0 && !p.away).length < 2} onClick={() => send('deal')}>{room.phase === 'lobby' ? 'Deal first hand' : 'Deal next hand'} <ArrowUpRight size={17} /></button> : <button className="secondary" onClick={openReload}><Plus size={16} /> Load Chips</button>}
              </div>}
            </>}
          </div>

        </section>
        <aside className="sidebar">
          <div className="side-tabs">
            <button className="active">Players</button>
            <button onClick={() => setPanel('history')}><History size={16} /> History</button>
          </div>
          <div className="side-section">
            <div className="side-title">PLAYERS <span>{visiblePlayers.length}/{room.settings.seats}</span></div>
            {visiblePlayers.map((p: any) => <div className="lineup" key={p.id}>
              <div className="avatar tiny">
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <strong>
                  {p.name}
                  {p.id === room.me ? ' (you)' : ''}
                </strong>
                <small>
                  {room.phase === 'closed' ? 'Cashed out' : p.away ? 'Sitting out' : effects.playerStack(p) > 0 ? 'At the table' : stackLabel(p)}
                </small>
              </div>
              <span className={stackLabel(p) === 'Busted' ? 'busted-label' : ''}>
                {stackLabel(p)}
              </span>
            </div>)}
          </div>
          {room.requests.length > 0 && <div className="side-section requests">
            <div className="side-title">QUEUED RELOADS</div>
            {room.requests.map((q: any) => <div className="request" key={q.id}>
              <span>
                {q.name}
                <small>{fmt(q.amount)} chips · automatic after this hand</small>
              </span>
            </div>)}
          </div>}
          <div className="side-section">
            <div className="side-title">ACTIVITY</div>
            <div className="event-list">
              {room.events.filter((e: string) => !(room.phase === 'showdown' && !effects.settled && e.startsWith(`Hand ${room.completed}:`))).slice(-7).reverse().map((e: string, i: number) => <div key={`${i}-${e}`}>
                <span className="event-dot" />
                {e}
              </div>)}
            </div>
          </div>
          <button className="ledger-button" onClick={() => setPanel('ledger')}>
            <span>Current Game Rankings<small>Buy-ins, cash-outs & settlement</small></span>
            <ArrowUpRight size={18} />
          </button>
        </aside>
      </div>

      <footer className="table-footer">
        {demo.current && <span>Practice</span>}
        <div>
          <button onClick={() => setPanel('ledger')}>Rankings</button>
          <button onClick={() => setPanel('history')}>History</button>
          {seated && room.phase !== 'closed' && !room.terminationPending && me.pendingSeatAction !== 'leave' && <button onClick={openReload}>Load Chips</button>}
          <button onClick={installApp}>Install</button>
        </div>
      </footer>

    </main>}

    {notice && <div className="toast" role="status">
      <CheckCircle2 size={18} />
      {notice}
    </div>}

    {panel && <div className="modal-backdrop" onClick={() => {
      setPanel('');
      setConfirm('');
    }}>
      <section className={`modal ${panel === 'ledger' ? 'wide' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close icon-button" onClick={() => {
          setPanel('');
          setConfirm('');
        }} aria-label="Close">
          <X size={20} />
        </button>

        {panel === 'install' && <>
          <h2>Install App</h2>
          <div className="instruction">
            <Smartphone size={24} />
            <div>
              <h3>iPhone / iPad</h3>
              <p>Open this site in Safari. Tap Share → Add to Home Screen → Add.</p>
            </div>
          </div>
          <div className="instruction">
            <Download size={24} />
            <div>
              <h3>Android</h3>
              <p>Open this site in Chrome. Tap the ⋮ menu → Add to Home screen or Install app.</p>
            </div>
          </div>
          <small>You’ll need an internet connection to play. Sign in with your name and PIN to recover your seat on any device.</small>
        </>}

        {panel === 'account' && <>
          <h2>
            {player?.name}
          </h2>
          <div className="menu-list">
            <button onClick={() => {
              setError('');
              setPanel('pin');
            }}>Change PIN</button>
            <button disabled={busy} onClick={logout}>Sign out</button>
            {room && <button onClick={exit}>Return to Lobby</button>}
          </div>
        </>}

        {panel === 'pin' && <PinSettings onChange={changePin} busy={busy} error={error} />}


        {panel === 'buyin' && <>
          <h2>Load Chips</h2>
          <p>
            {handActive && me?.inHand ? 'Choose your amount. Chips are added automatically after this hand.' : 'Choose how many chips to add. Reloads are automatic.'}
          </p>
          <label>Chips<input type="number" min={room.settings.bb} max={room.settings.maxBuyin} value={rebuy} onChange={e => setRebuy(Number(e.target.value))} /></label>
          <button className="primary full" disabled={controlsBusy || room.requests.some((q: any) => q.id === room.me)} onClick={async () => {
            if (await send('rebuy', {
              amount: rebuy
            })) {
              setNotice(handActive && me?.inHand ? 'Reload queued for next hand' : 'Chips reloaded');
              setPanel('');
            }
          }}>{handActive && me?.inHand ? 'Load Chips After Hand' : 'Load Chips'} <Plus size={17} /></button>
          {room.requests.some((q: any) => q.id === room.me) && <p className="success">Your reload will be added automatically when this hand ends.</p>}
          {error && <p className="error">
            {error}
          </p>}
        </>}

        {panel === 'seat' && <>
          <h2>Load Chips</h2>
          <p>Seat {(selectedSeat ?? 0) + 1}{handActive ? ' · Join from the next hand' : ''}</p>
          <form onSubmit={async e => {
            e.preventDefault();
            if (selectedSeat === null) return;
            if (await send('join', {
              seat: selectedSeat,
              buyin: rebuy,
              name: player?.name || name || 'You'
            })) {
              setSelectedSeat(null);
              setPanel('');
            }
          }}>
            <label>Chips<input type="number" min={room.settings.bb * 2} max={room.settings.maxBuyin} step={1} required value={rebuy} onChange={e => setRebuy(Number(e.target.value))} /></label>
            <button className="primary full" disabled={controlsBusy || selectedSeat === null || room.players.some((p: any) => !p.left && p.seat === selectedSeat) || room.terminationPending}>Load Chips</button>
          </form>
          {selectedSeat !== null && room.players.some((p: any) => !p.left && p.seat === selectedSeat) && <p role="status">That seat is taken. Close this dialog and choose another seat.</p>}
          {error && <p className="error" role="alert">
            {error}
          </p>}
        </>}

        {panel === 'menu' && <>
          <h2>Table Menu</h2>
          <div className="menu-list">
            {demo.current && <button onClick={previewAllIn}><Layers3 size={18} /> Preview all-in vote</button>}
            {room.host && room.phase !== 'closed' && <button disabled={room.terminationPending} onClick={() => send('pause')}>{room.paused ? <Play size={18} /> : <Pause size={18} />} {room.paused ? 'Resume Auto-deal' : 'Pause Auto-deal'}</button>}
            {seated && room.phase !== 'closed' && <>
              <button onClick={openReload} disabled={room.terminationPending || me.pendingSeatAction === 'leave'}>Load Chips</button>
              <button onClick={() => send('ready')} disabled={controlsBusy || me.pendingSeatAction === 'leave' || room.terminationPending}>
                {me.pendingSeatAction === 'sit_out' ? 'Cancel Sit Out' : me.away ? 'Sit In' : 'Sit Out'}
              </button>
            </>}
            <button onClick={() => setPanel('ledger')}>Current Game Rankings</button>
            {room.phase !== 'closed' && <button className="danger" disabled={controlsBusy || room.terminationPending} onClick={() => setConfirm('end')}>
              {room.terminationPending ? 'Termination Pending' : 'Terminate Game'}
            </button>}
            <button onClick={exit}>Return to Lobby</button>
          </div>
          {confirm && <div className="confirm">
            <p>
              {handActive ? 'Terminate the game after this hand?' : 'Terminate the game and cash out all chips?'}
            </p>
            <button className="primary" disabled={controlsBusy} onClick={async () => {
              if (await send(confirm)) {
                setConfirm('');
                setPanel('');
              }
            }}>Confirm Terminate Game</button>
          </div>}
          {error && <p className="error" role="alert">
            {error}
          </p>}
        </>}

        {panel === 'ledger' && <>
          <h2>Current Game Rankings</h2>
          <p>
            {room.phase === 'closed' ? 'Final balances. Payments happen outside the app.' : 'Live balances. Final settlement is calculated when the game ends.'}
          </p>
          <div className="ledger-scroll">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Buy-ins</th>
                  <th>
                    {room.phase === 'closed' ? 'Cash-out' : 'Stack + out'}
                  </th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {[...room.players].sort((a: any, b: any) => b.net - a.net).map((p: any) => <tr key={p.id}>
                  <td>
                    {p.name}
                    {p.left ? ' · left' : ''}
                  </td>
                  <td>
                    {fmt(p.buyins)}
                  </td>
                  <td>
                    {fmt(p.stack + p.cashout)}
                  </td>
                  <td className={p.net >= 0 ? 'positive' : 'negative'}>
                    {p.net > 0 ? '+' : ''}
                    {fmt(p.net)}
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
          {live && <small>Chips in the current pot are excluded from player stacks until the hand ends.</small>}
          <button className="secondary full" onClick={() => {
            const lines = [['Player', 'Buy-ins', 'Stack', 'Cash-out', 'Net'], ...room.players.map((p: any) => [p.name, p.buyins, p.stack, p.cashout, p.net])];
            const csv = lines.map(row => row.map((v: any) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n'),
              url = URL.createObjectURL(new Blob([csv], {
                type: 'text/csv'
              })),
              a = document.createElement('a');
            a.href = url;
            a.download = `dunzo-club-${room.code}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}><Download size={16} /> Export Rankings CSV</button>
        </>}

        {panel === 'history' && <>
          <h2>Hand History</h2>
          {room.history.length === 0 ? <p>No completed hands.</p> : <div className="history-list">
            {room.history.map((h: any) => <details key={h.number}>
              <summary>
                <span>#{h.number} <b>
                  {h.game}
                </b></span>
                <span>{fmt(h.pot)} pot <ChevronRight size={14} /></span>
              </summary>
              <div className="history-body">
                <div className="history-run-boards">
                  {(h.boards?.length ? h.boards : [h.board]).map((board: number[], run: number) => <div className="board-cards" key={run}>
                    {h.runCount === 2 && <small>Run {run + 1}</small>}
                    {board.map((c: number, i: number) => <Card key={i} value={c} small />)}
                  </div>)}
                </div>
                {h.result.map((w: any) => <p key={w.id}>{w.name} +{fmt(w.wonAmount ?? w.amount)} · {h.runCount === 2 && w.runHands?.length > 0 ? w.runHands.map((rh: any) => `Run ${rh.run}: ${rh.description} (+${fmt(rh.wonAmount)})`).join(' · ') : w.description || w.hand}{w.returnedAmount > 0 ? ` · ${fmt(w.returnedAmount)} returned` : ''}</p>)}
                {h.showdown.map((p: any) => <div className="history-hole" key={p.name}>
                  <span>
                    {p.name}
                  </span>
                  {p.cards.map((c: number, i: number) => <Card key={i} value={c} small />)}
                </div>)}
                <div className="history-actions">
                  {h.actions.map((a: string, i: number) => <div key={i}>
                    {a}
                  </div>)}
                </div>
              </div>
            </details>)}
          </div>}
        </>}

      </section>
    </div>}

  </div>;
}
