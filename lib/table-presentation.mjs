// Shared timing and geometry keep sound, cards, and the first action clock aligned.
export const SHUFFLE_MS=480, DEAL_STEP_MS=90, FLIGHT_MS=180;
export function dealPlan(room){
 const players=room.players.filter(p=>p.inHand).sort((a,b)=>((a.seat-room.dealer+room.settings.seats-1)%room.settings.seats)-((b.seat-room.dealer+room.settings.seats-1)%room.settings.seats));
 const count=room.game==='NLH'?2:room.game==='PLO4'?4:5;
 const flights=[];for(let round=0;round<count;round++)players.forEach((p,index)=>flights.push({seat:p.seat,round,at:SHUFFLE_MS+(round*players.length+index)*DEAL_STEP_MS,arrival:SHUFFLE_MS+(round*players.length+index)*DEAL_STEP_MS+FLIGHT_MS}));
 return {flights,duration:flights.length?flights.at(-1).arrival+160:0};
}
export function seatPosition(seat,mySeat,seats){const theta=Math.PI/2+((seat-mySeat+seats)%seats)*(Math.PI*2/seats);return {x:50+44*Math.cos(theta),y:49+43*Math.sin(theta)}}
export function boardPlan(from,to){const events=[];let at=0;for(let index=from;index<to;index++){if(index>from)at+=index<3?160:520;events.push({index,at})}return events}
export const AUTO_DEAL_MS=3000;
export const RUNOUT_VOTE_MS=5000;
export const RUNOUT_ANNOUNCEMENT_MS=2000;
export const PAYOUT_FLIGHT_MS=1400;
export function slowBoardPlan(from,to){const events=[];let at=0;for(let index=from;index<to;index++){if(index>from)at+=index<3?450:1100;events.push({index,at})}return events}
export function showdownTiming(boardFrom,boardTo,recipients=1,runCount=1,runRecipients=[],hasVote=false){
 const slow=hasVote||runCount===2,announcementDuration=hasVote?RUNOUT_ANNOUNCEMENT_MS:0,runs=[];let cursor=announcementDuration;
 for(let i=0;i<runCount;i++){
  const events=slow?slowBoardPlan(boardFrom,boardTo):boardPlan(boardFrom,boardTo),resultAt=cursor+(events.at(-1)?.at||0)+(events.length?700:240),count=runRecipients[i]??recipients,payoutStart=resultAt+350,payoutEnd=payoutStart+Math.max(0,count-1)*260+PAYOUT_FLIGHT_MS,endAt=Math.max(resultAt+2800,payoutEnd+450);
  runs.push({run:i+1,boardStart:cursor,events,resultAt,payoutStart,payoutEnd,endAt});cursor=endAt+(i<runCount-1?600:0);
 }
 return {announcementDuration,runs,revealDelay:runs[0].resultAt,summaryAt:cursor,payoutDuration:cursor};
}
export function presentationAt(plan,elapsed){
 if(elapsed<plan.announcementDuration)return {phase:'announcement',run:null};
 for(const run of plan.runs){if(elapsed<run.resultAt)return {phase:'dealing',run:run.run};if(elapsed<run.endAt)return {phase:'award',run:run.run}}
 return {phase:'summary',run:null};
}
export function payoutEvents(room,startedAt,plan){
 const events=[];
 for(const run of plan.runs){let index=0;for(const winner of room.result||[]){const hand=winner.runHands?.find(h=>h.run===run.run),amount=hand?.wonAmount??(room.runCount!==2?(winner.wonAmount??winner.amount-(winner.returnedAmount||0)):0);if(amount>0)events.push({id:winner.id,name:winner.name,run:run.run,amount,at:startedAt+run.payoutStart+index++*260,duration:PAYOUT_FLIGHT_MS,returned:false})}}
 for(const winner of room.result||[])if(winner.returnedAmount>0)events.push({id:winner.id,name:winner.name,run:0,amount:winner.returnedAmount,at:startedAt+150,duration:PAYOUT_FLIGHT_MS,returned:true});
 return events.sort((a,b)=>a.at-b.at);
}
export function visibleStack(player,payouts,now){return player.stack-payouts.filter(e=>e.id===player.id&&now<e.at+e.duration).reduce((sum,e)=>sum+e.amount,0)}
