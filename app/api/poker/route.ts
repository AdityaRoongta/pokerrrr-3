import { env } from 'cloudflare:workers';
import { newRoom, command, view, tick, resolveAlias } from '../../../lib/poker.mjs';
import { publicHandRecord, handHistoryCsv, handHistoryJson } from '../../../lib/hand-history.mjs';
export const dynamic = 'force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','Vary':'Authorization'}});
export async function GET(request:Request){return handle(request,false)}
export async function POST(request:Request){return handle(request,true)}
async function participantKey(token:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function ensureSession(db:any,r:any){
 await db.prepare('INSERT OR IGNORE INTO poker_sessions(code,created_at,settings) VALUES(?,?,?)').bind(r.code,r.createdAt,JSON.stringify(r.settings)).run();
}
async function persistHand(db:any,r:any,hand:any){
 const record=publicHandRecord(r.code,hand),payload=JSON.stringify(record);
 await db.prepare('INSERT INTO poker_hand_history(room_code,hand_number,started_at,completed_at,payload) VALUES(?,?,?,?,?) ON CONFLICT(room_code,hand_number) DO UPDATE SET completed_at=excluded.completed_at,payload=excluded.payload').bind(r.code,record.handNumber,record.startedAt,record.completedAt,payload).run();
 for(const [eventIndex,event] of (record.actionLog||[]).entries()){
  await db.prepare('INSERT INTO poker_hand_events(room_code,hand_number,event_index,event_type,happened_at,payload) VALUES(?,?,?,?,?,?) ON CONFLICT(room_code,hand_number,event_index) DO UPDATE SET event_type=excluded.event_type,happened_at=excluded.happened_at,payload=excluded.payload').bind(r.code,record.handNumber,eventIndex,event.type,event.at??null,JSON.stringify(event)).run();
 }
 for(const seat of record.seats||[]){
  const player=r.players.find((candidate:any)=>candidate.seat===seat.seat&&candidate.name===seat.name);if(player)await db.prepare('INSERT OR IGNORE INTO poker_hand_participants(room_code,hand_number,player_key) VALUES(?,?,?)').bind(r.code,record.handNumber,await participantKey(player.id)).run();
 }
}
async function persistHistory(db:any,r:any){await ensureSession(db,r);for(const hand of r.history||[])await persistHand(db,r,hand)}
function exportResponse(records:any[],format:string,code:string){
 if(format==='csv')return new Response(handHistoryCsv(records),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="home-game-${code}-hands.csv"`,'Cache-Control':'no-store, private'}});
 return new Response(handHistoryJson(records),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="home-game-${code}-hands.json"`,'Cache-Control':'no-store, private'}});
}
async function handle(request:Request,write:boolean){
 try {
  const db:any=env.DB;if(!db)return response({error:'Table storage is not connected yet.'},503);
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token||!/^[a-f0-9-]{36,80}$/i.test(token))return response({error:'Player session required'},401);
  const url=new URL(request.url),input:any=write?await request.json():{},code=String(write?input.code:url.searchParams.get('code')||'').toUpperCase().trim(),exportFormat=url.searchParams.get('export')==='hands'?(url.searchParams.get('format')||'json').toLowerCase():null;
  if(exportFormat&&exportFormat!=='json'&&exportFormat!=='csv')return response({error:'Export format must be json or csv'},400);
  if(write&&input.type==='create'){
   for(let i=0;i<4;i++){
    const bytes=crypto.getRandomValues(new Uint8Array(6)),alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',newCode=[...bytes].map(b=>alphabet[b%32]).join(''),r=newRoom(newCode,token,input);
    const result=await db.prepare('INSERT OR IGNORE INTO poker_rooms(code,state,version,updated_at) VALUES(?,?,0,?)').bind(newCode,JSON.stringify(r),Date.now()).run();
    if(result.meta.changes){await ensureSession(db,r);return response(view(r,token));}
   }return response({error:'Could not open a table; try again'},503);
  }
  if(!/^[A-Z2-9]{6}$/.test(code))return response({error:'Enter the six-character room code'},400);
  for(let attempt=0;attempt<5;attempt++){
   const row=await db.prepare('SELECT state, version FROM poker_rooms WHERE code=?').bind(code).first() as {state:string,version:number}|null;if(!row)return response({error:'Table not found. Check your code.'},404);
   const r=JSON.parse(row.state);const changed=tick(r,Date.now(),!write);
   if(exportFormat){
    if(!r.players.some((player:any)=>player.id===token))return response({error:'Join this table before exporting your hands.'},403);
    await persistHistory(db,r);
    const saved=await db.prepare('SELECT h.payload FROM poker_hand_history h INNER JOIN poker_hand_participants p ON p.room_code=h.room_code AND p.hand_number=h.hand_number WHERE h.room_code=? AND p.player_key=? ORDER BY h.hand_number ASC').bind(code,await participantKey(token)).all();
    return exportResponse(saved.results.map((row:any)=>JSON.parse(row.payload)),exportFormat,code);
   }
   if(write){if(input.version!==undefined&&input.version!==row.version&&['fold','call','check','raise','deal'].includes(input.type))return response({error:'The table changed. Review your turn and try again.'},409);if(input.player)input.player=resolveAlias(r,input.player);command(r,token,input)}
   if(write||changed){r.version=row.version+1;const update=await db.prepare('UPDATE poker_rooms SET state=?, version=?, updated_at=? WHERE code=? AND version=?').bind(JSON.stringify(r),r.version,Date.now(),code,row.version).run();if(!update.meta.changes)continue;await persistHistory(db,r);if(r.phase==='closed')await db.prepare('UPDATE poker_sessions SET ended_at=? WHERE code=?').bind(Date.now(),code).run();}
   return response(view(r,token));
  }
  return response({error:'Table is busy. Please retry.'},409);
 }catch(e){return response({error:e instanceof Error?e.message:'Request failed'},400)}
}
