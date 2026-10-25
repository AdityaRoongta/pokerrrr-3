// Clearly synthetic records: kept outside real session archives and balances.
export function historyExamples(now=Date.now()) {
 const names=['Dunzo','Ishita','Varun','Doshi','Panda','Saboo','Roongta'];
 const changes=[[700,-300,100,-200,-100,-100,-100],[-400,250,500,-200,-50,-100,0],[300,-100,-200,150,-50,-100,0],[100,-50,200,-150,-100,0,0]];
 return Array.from({length:8},(_,i)=>{
  const closedAt=now-(i*7+1)*86400000,changesForGame=changes[i%changes.length];
  return {code:`DEMO-${i+1}`,createdAt:closedAt-3*3600000,closedAt,completed:18+i,
   players:names.flatMap((name,n)=>i%4===3&&n>=5?[]:[{id:`dddddddd-dddd-4ddd-8ddd-${String(n+1).padStart(12,'0')}`,name,buyins:2500,cashout:2500+changesForGame[n]}])};
 });
}
