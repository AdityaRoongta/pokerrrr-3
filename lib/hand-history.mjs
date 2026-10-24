const ranks=['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const suits=['c','d','h','s'];
export const cardText=card=>Number.isInteger(card)?`${ranks[card%13]}${suits[Math.floor(card/13)]}`:'';
const cards=values=>(values||[]).map(cardText).join(' ');
const csvCell=value=>`"${String(value??'').replaceAll('"','""')}"`;

// Completed-hand records must never contain player bearer tokens. Seats and display
// names are stable within a session and are sufficient for a hand-history export.
export function publicHandRecord(roomCode,hand){
 const {result=[],...rest}=structuredClone(hand);
 return {sessionCode:roomCode,handNumber:hand.number,...rest,result:result.map(({id,...winner})=>winner)};
}

export function handHistoryCsv(records){
 const header=['session_code','hand_number','started_at','completed_at','game','participants','board','run_boards','pot','run_count','actions','showdown','voluntary_reveals','rabbit_hunt_board','winners'];
 const rows=records.map(h=>[
  h.sessionCode,h.handNumber,h.startedAt,h.completedAt,h.game,
  (h.seats||[]).map(p=>`Seat ${p.seat + 1}: ${p.name}`).join(' | '),cards(h.board),
  (h.boards||[]).map(cards).join(' / '),h.pot,h.runCount,
  JSON.stringify(h.actionLog||[]),(h.showdown||[]).map(p=>`${p.name}: ${cards(p.cards)}`).join(' | '),
  (h.reveals||[]).map(p=>`${p.name}: ${cards(p.cards)}`).join(' | '),cards(h.rabbitHunt?.cards),
  (h.result||[]).map(w=>`${w.name} +${w.wonAmount??w.amount}`).join(' | ')
 ]);
 return [header,...rows].map(row=>row.map(csvCell).join(',')).join('\n');
}

export function handHistoryJson(records){return JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),hands:records},null,2)};
