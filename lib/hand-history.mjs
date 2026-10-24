const ranks=['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const suits=['c','d','h','s'];
export const cardText=card=>Number.isInteger(card)?`${ranks[card%13]}${suits[Math.floor(card/13)]}`:'';
const cards=values=>(values||[]).map(cardText).join(' ');
const csvCell=value=>`"${String(value??'').replaceAll('"','""')}"`;
const dateOf=timestamp=>timestamp?new Date(timestamp).toISOString().slice(0,10):'';
const streetName=street=>({preflop:'Preflop',flop:'Flop',turn:'Turn',river:'River',runout:'Runout',posthand:'Posthand'}[street]||street||'Preflop');
function positionMap(hand){
 const started=(hand.actionLog||[]).find(event=>event.type==='hand_started'),seats=started?.seats||hand.seats||[],dealerSeat=started?.dealerSeat;
 if(!seats.length||dealerSeat===undefined)return new Map();const order=[...seats].sort((a,b)=>((a.seat-dealerSeat+100)%100)-((b.seat-dealerSeat+100)%100)),positions=new Map();
 if(order.length===2){positions.set(order[0].seat,'BTN/SB');positions.set(order[1].seat,'BB');return positions}
 const labels=['BTN','SB','BB','UTG','UTG+1','LJ','HJ','CO'];order.forEach((player,index)=>positions.set(player.seat,labels[index]||`Seat ${player.seat+1}`));return positions;
}

// Completed-hand records must never contain player bearer tokens. Explicitly
// whitelisting public fields also prevents a future private-card field from being
// copied to an export by accident. Seats and display names are stable within a
// session and are sufficient for a hand-history export.
export function publicHandRecord(roomCode,hand){
 const {number,startedAt,completedAt,game,board=[],boards=[],runCount,runDecision,pot,result=[],actions=[],actionLog=[],seats=[],showdown=[],reveals=[],rabbitHunt=null}=structuredClone(hand);
 return {sessionCode:roomCode,handNumber:number,number,startedAt,completedAt,game,board,boards,runCount,runDecision,pot,actions,actionLog,seats,showdown,reveals,rabbitHunt,result:result.map(({id,...winner})=>winner)};
}

export function handHistoryCsv(records){
 const header=['Hand ID','Date','Session','Street','Seq','Player','Pos','Action','Size','Stack After'],rows=[];
 for(const hand of records){
  const date=dateOf(hand.startedAt||hand.completedAt),handId=`${date.replaceAll('-','')}-${hand.sessionCode}-H${String(hand.handNumber).padStart(3,'0')}`,session=`Home Game ${hand.sessionCode}`,positions=positionMap(hand),stacks=new Map((hand.seats||[]).map(player=>[player.seat,player.startingStack])),sequences=new Map();
  const add=(street,seat,name,action,size='',stackAfter='')=>{const label=streetName(street),sequence=(sequences.get(label)||0)+1;sequences.set(label,sequence);rows.push([handId,date,session,label,sequence,name||'',seat===undefined?'':positions.get(seat)||`Seat ${seat+1}`,action,size,stackAfter])};
  for(const event of hand.actionLog||[]){
   if(event.type==='blinds_posted'){
    for(const [blind,player] of [['smallBlind',event.smallBlind],['bigBlind',event.bigBlind]])if(player)add('preflop',player.seat,player.name,'post',player.amount,(stacks.get(player.seat)??'')===''?'':stacks.get(player.seat)-player.amount);
   }else if(['fold','check','call','raise','allin'].includes(event.type)){
    const size=event.type==='fold'||event.type==='check'?'':event.amount,stack=stacks.has(event.seat)?stacks.get(event.seat)-event.total:'';add(event.street,event.seat,event.name,event.type,size,stack);
   }else if(event.type==='runout_resolved'){
    for(const choice of event.choices||[])add('runout',choice.seat,choice.name,choice.choice===2?'run_twice':'run_once');
   }else if(event.type==='voluntary_reveal')add('posthand',event.seat,event.name,'voluntary_reveal');
   else if(event.type==='rabbit_hunt')add('posthand',event.requestedBy?.seat,event.requestedBy?.name,'rabbit_hunt');
  }
 }
 return [header,...rows].map(row=>row.map(csvCell).join(',')).join('\n');
}

export function handHistoryJson(records){return JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),hands:records},null,2)};
