'use client';

import { useState } from 'react';

type Award = {
  id: string;
  name: string;
  run: number;
  label: string;
  amount: number;
  wonAmount: number;
  at: number;
  description?: string;
  returnedAmount?: number;
  returned?: boolean;
  tied?: boolean;
};
const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export function TableAwards({room, effects, run, onFocus}: {
  room: {phase: string; runCount: number};
  effects: {
    now: number;
    settled: boolean;
    payouts: Award[];
    showdown?: {startedAt: number; plan: {runs: {run: number; resultAt: number}[]}};
  };
  run: number;
  onFocus: (id: string, run: number) => void;
}) {
  const [selectedPot, setSelectedPot] = useState('');
  const timeline = effects.showdown?.plan.runs.find(p => p.run === run),
    payments = effects.payouts.filter(p => p.run === run);
  if (room.phase !== 'showdown') return null;
  if (!timeline || !payments.length || effects.now < effects.showdown!.startedAt + timeline.resultAt) return <div className="table-awards" aria-hidden="true" />;
  const current = payments.filter(p => p.at <= effects.now).at(-1) || payments[0],
    labels = [...new Set(payments.map(p => p.label))],
    label = effects.settled && labels.includes(selectedPot) ? selectedPot : current.label,
    potAwards = payments.filter(p => p.label === label),
    awards = effects.settled ? potAwards : potAwards.filter(p => p.id === current.id);
  return <div className="table-awards" aria-label={`${room.runCount === 2 ? `Run ${run} ` : ''}pot results`}>
    {labels.length > 1 ? <div className="table-pot-tabs" aria-label={`Run ${run} pots`}>
      {labels.map(pot => <button key={pot} disabled={!effects.settled} aria-pressed={pot === label} onClick={() => {
        setSelectedPot(pot);
        onFocus(payments.find(p => p.label === pot)!.id, run);
      }}>{pot}</button>)}
    </div> : <span className="table-pot-label">{label}{potAwards.some(p => p.tied) ? ' · Split' : ''}</span>}
    <div className="table-award-winners" aria-live="polite">
      {awards.map(award => <div key={award.id}>
        <button className="table-winner-name" disabled={!effects.settled || award.returned} onClick={() => onFocus(award.id, run)}>
          <strong>{award.name}</strong> <b>+{fmt(award.wonAmount || award.amount)}</b>
        </button>
        {!award.returned && award.description && <span className="table-winning-hand">{award.description}</span>}
        {Boolean(award.returnedAmount) && <small>{fmt(award.returnedAmount!)} uncalled returned</small>}
      </div>)}
    </div>
  </div>;
}
