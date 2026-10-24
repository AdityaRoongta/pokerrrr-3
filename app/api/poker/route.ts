import { env } from 'cloudflare:workers';
import { newRoom, command, view, tick, resolveAlias } from '../../../lib/poker.mjs';
export const dynamic = 'force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','Vary':'Authorization'}});
export async function GET(request:Request){return handle(request,false)}
export async function POST(request:Request){return handle(request,true)}
async function handle(request:Request,write:boolean){
 try {
  const db=env.DB;if(!db)return response({error:'Table storage is not connected yet.'},503);
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token||!/^[a-f0-9-]{36,80}$/i.test(token))return response({error:'Player session required'},401);
  const input:any=write?await request.json():{},code=String(write?input.code:new URL(request.url).searchParams.get('code')||'').toUpperCase().trim();
  if(write&&input.type==='create'){
   for(let i=0;i<4;i++){
    const bytes=crypto.getRandomValues(new Uint8Array(6)),alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',newCode=[...bytes].map(b=>alphabet[b%32]).join(''),r=newRoom(newCode,token,input);
    const result=await db.prepare('INSERT OR IGNORE INTO poker_rooms(code,state,version,updated_at) VALUES(?,?,0,?)').bind(newCode,JSON.stringify(r),Date.now()).run();
    if(result.meta.changes)return response(view(r,token));
   }return response({error:'Could not open a table; try again'},503);
  }
  if(!/^[A-Z2-9]{6}$/.test(code))return response({error:'Enter the six-character room code'},400);
  for(let attempt=0;attempt<5;attempt++){
   const row=await db.prepare('SELECT state, version FROM poker_rooms WHERE code=?').bind(code).first<{state:string,version:number}>();if(!row)return response({error:'Table not found. Check your code.'},404);
   const r=JSON.parse(row.state);const changed=tick(r,Date.now(),!write);
   if(write){if(input.version!==undefined&&input.version!==row.version&&['fold','call','check','raise','deal'].includes(input.type))return response({error:'The table changed. Review your turn and try again.'},409);if(input.player)input.player=resolveAlias(r,input.player);command(r,token,input)}
   if(write||changed){r.version=row.version+1;const update=await db.prepare('UPDATE poker_rooms SET state=?, version=?, updated_at=? WHERE code=? AND version=?').bind(JSON.stringify(r),r.version,Date.now(),code,row.version).run();if(!update.meta.changes)continue;}
   return response(view(r,token));
  }
  return response({error:'Table is busy. Please retry.'},409);
 }catch(e){return response({error:e instanceof Error?e.message:'Request failed'},400)}
}
