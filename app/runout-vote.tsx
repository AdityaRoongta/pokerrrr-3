'use client';

export function RunoutVote({
  room,
  now,
  busy,
  send
}: {
  room: any;
  now: number;
  busy: boolean;
  send: (type: string, input?: any) => Promise<boolean>;
}) {
  const vote = room.runVote;
  if (!vote || vote.revealed || room.phase !== 'runout_vote') return null;
  const mine = vote.voters.find((p: any) => p.id === room.me),
    seconds = Math.max(0, Math.min(5, Math.ceil((vote.deadline - now) / 1000))),
    open = now >= vote.opensAt && now < vote.deadline;
  return <section className="runout-vote-card" aria-label="Choose runout count">
    <div className="vote-heading">
      <div>
        <span className="eyebrow">BETTING IS COMPLETE</span>
        <h3>Once or twice?</h3>
      </div>
      <b className="vote-timer" role="timer" aria-label={`${seconds} seconds remaining`}>
        {seconds}
      </b>
    </div>
    <p>
      {now < vote.opensAt ? 'Voting opens in a moment…' : 'Choices stay private until the timer ends.'}
    </p>
    {mine ? <>
      <div className="runout-buttons">
        {[1, 2].map(n => <button key={n} aria-pressed={mine.choice === n} disabled={busy || !open || n === 2 && !vote.canTwice} onClick={() => send('runout_vote', {
          choice: n
        })}>
          {n === 1 ? 'Once' : 'Twice'}
        </button>)}
      </div>
      <small>
        {mine.choice ? `${mine.choice === 2 ? 'Twice' : 'Once'} saved. You can change it before time runs out.` : 'No selection means Once.'}
      </small>
    </> : <p className="vote-spectator">Waiting for the players in this hand.</p>}
    {!vote.canTwice && <p className="vote-deck-note">Twice unavailable: not enough undealt cards remain.</p>}
    <div className="voter-list">
      {vote.voters.map((p: any) => <div key={p.id}>
        <span>
          {p.name}
          {p.id === room.me ? ' (you)' : ''}
        </span>
        <small>
          {p.id === room.me && p.choice ? p.choice === 2 ? 'Twice' : 'Once' : p.hasVoted ? 'Choice saved' : 'Choosing…'}
        </small>
      </div>)}
    </div>
  </section>;
}
export function RunoutDecision({
  room
}: {
  room: any;
}) {
  const vote = room.runVote;
  if (!vote?.revealed || room.phase !== 'showdown') return null;
  return <div className="runout-decision" aria-label="Revealed runout choices">
    <strong>Running it {room.runCount === 2 ? 'Twice' : 'Once'}</strong>
    <div>
      {vote.voters.map((p: any) => <span key={p.id}>{p.name}: <b>
        {p.choice === 2 ? 'Twice' : 'Once'}
      </b></span>)}
    </div>
  </div>;
}
export function RunoutAnnouncement({
  room,
  effects
}: {
  room: any;
  effects: any;
}) {
  if (room.phase !== 'showdown' || effects.stage.phase !== 'announcement') return null;
  return <div className="runout-announcement" role="status">
    <span className="eyebrow">THE CHOICES ARE IN</span>
    <h3>Running it {room.runCount === 2 ? 'Twice' : 'Once'}</h3>
    <p>
      {room.runCount === 2 ? 'Run 1 is up first.' : 'Here comes the runout.'}
    </p>
  </div>;
}
