'use client';
import { useEffect, useRef, useState } from 'react';
import { indiaDate } from '../lib/game-history.mjs';
const fmt=(n:number)=>new Intl.NumberFormat('en-IN',{signDisplay:'exceptZero'}).format(n);
const unsigned=(n:number)=>new Intl.NumberFormat('en-IN').format(n);
const date=(time:number)=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(time);
async function read(path:string,signal:AbortSignal){
 const response=await fetch(path,{signal,cache:'no-store'}),body=await response.json() as any;
 if(!response.ok)throw new Error(body.error||'Could not load game history');return body;
}
export function GameHistory({refreshKey}:{refreshKey:string}){
 const [games,setGames]=useState<any[]>([]),[cursor,setCursor]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [demo,setDemo]=useState(false),[demoAvailable,setDemoAvailable]=useState(false),[open,setOpen]=useState(false);
 const [from,setFrom]=useState(()=>indiaDate(Date.now()-30*86400000)),[to,setTo]=useState(()=>indiaDate()),[result,setResult]=useState<any>(null),[calculating,setCalculating]=useState(false),[settleError,setSettleError]=useState('');
 const historyRequest=useRef<AbortController|null>(null),settlementRequest=useRef<AbortController|null>(null);
 async function load(next?:string){
  historyRequest.current?.abort();const controller=new AbortController();historyRequest.current=controller;setLoading(true);setError('');
  try{const query=new URLSearchParams({...demo&&{demo:'1'},...next&&{cursor:next}});const data=await read(`/api/history?${query}`,controller.signal);if(controller.signal.aborted)return;setGames(old=>next?[...old,...data.games]:data.games);setCursor(data.nextCursor);setDemoAvailable(data.demoAvailable)}
  catch(e:any){if(!controller.signal.aborted)setError(e.message)}finally{if(!controller.signal.aborted)setLoading(false)}
 }
 function clearSettlement(){settlementRequest.current?.abort();setResult(null);setSettleError('');setCalculating(false)}
 useEffect(()=>{setGames([]);setCursor(null);clearSettlement();void load();return()=>{historyRequest.current?.abort();settlementRequest.current?.abort()}},[demo,refreshKey]);
 async function settle(event:React.FormEvent){
  event.preventDefault();clearSettlement();const controller=new AbortController();settlementRequest.current=controller;setCalculating(true);
  try{const query=new URLSearchParams({from,to,...demo&&{demo:'1'}}),data=await read(`/api/settlement?${query}`,controller.signal);if(!controller.signal.aborted)setResult(data)}
  catch(e:any){if(!controller.signal.aborted)setSettleError(e.message)}finally{if(!controller.signal.aborted)setCalculating(false)}
 }
 const players=new Map<string,string>();for(const g of games)for(const p of g.players)if(!players.has(p.key))players.set(p.key,p.name);
 const columns=[...players].sort((a,b)=>a[1].localeCompare(b[1]));
 return <section className="game-history" aria-label="Previous games">
  <div className="history-toolbar"><h2>Previous Games</h2><button className="primary" onClick={()=>setOpen(true)}>Settle Up</button></div>
  {demoAvailable&&<label className="demo-history-toggle"><input type="checkbox" checked={demo} onChange={e=>setDemo(e.target.checked)}/>Show Simulated History</label>}
  {demo&&<p className="demo-notice" role="status">Simulated data only. Real games are excluded from this view and its settlement.</p>}
  {error&&<div className="error" role="alert">{error}<button className="text-button" onClick={()=>load()}>Retry</button></div>}
  {loading&&!games.length?<p role="status">Loading game history…</p>:!games.length&&!error?<p>No completed games.</p>:games.length>0&&<><div className="history-table-scroll"><table><caption>Win / loss in chips · Dates in India time</caption><thead><tr><th>Game Ended</th>{columns.map(([key,name])=><th key={key}>{name}</th>)}</tr></thead><tbody>{games.map(g=><tr key={g.code}><td>{date(g.closedAt)}</td>{columns.map(([key])=>{const p=g.players.find((p:any)=>p.key===key);return <td key={key} className={p?(p.net>0?'positive':p.net<0?'negative':''):''}>{p?fmt(p.net):'—'}</td>})}</tr>)}</tbody></table></div>{cursor&&<button className="secondary" disabled={loading} onClick={()=>load(cursor)}>{loading?'Loading…':'Load More'}</button>}</>}
  {open&&<div className="modal-backdrop" onClick={()=>{clearSettlement();setOpen(false)}}><section className="modal wide" role="dialog" aria-modal="true" aria-labelledby="settle-heading" onClick={e=>e.stopPropagation()}><button className="modal-close icon-button" aria-label="Close settlement" onClick={()=>{clearSettlement();setOpen(false)}}>×</button><h2 id="settle-heading">Settle Up{demo?' · Simulated':''}</h2><form onSubmit={settle}><div className="field-row"><label>From<input type="date" value={from} max={to} required onChange={e=>{clearSettlement();setFrom(e.target.value)}}/></label><label>To<input type="date" value={to} min={from} required onChange={e=>{clearSettlement();setTo(e.target.value)}}/></label></div><p className="settlement-note">Includes games completed on these dates in India time. Suggested payments only; nothing is marked paid.</p><button className="primary full" disabled={calculating}>{calculating?'Calculating…':'Settle Up'}</button></form>
   {settleError&&<p className="error" role="alert">{settleError}</p>}
   {result&&<div className="settlement-result" role="status"><h3>{result.gameCount} completed {result.gameCount===1?'game':'games'}</h3>{result.gameCount>0&&<><h3>Suggested Payments</h3>{result.payments.length?result.payments.map((p:any,i:number)=><div className="payment" key={i}><span><strong>{p.fromName}</strong> → <strong>{p.toName}</strong></span><b>{unsigned(p.amount)} chips</b></div>):<p>Nothing to settle.</p>}<details className="settlement-totals"><summary>Player Win / Loss Totals</summary><div className="history-table-scroll"><table><caption>Totals in chips</caption><thead><tr><th>Player</th><th>Games</th><th>Win / Loss</th></tr></thead><tbody>{result.totals.map((p:any)=><tr key={p.key}><td>{p.name}</td><td>{p.games}</td><td className={p.net>0?'positive':p.net<0?'negative':''}>{fmt(p.net)}</td></tr>)}</tbody></table></div></details></>}</div>}
  </section></div>}
 </section>;
}
