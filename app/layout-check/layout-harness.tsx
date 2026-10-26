'use client';
import { useSearchParams } from 'next/navigation';
import Home from '../page';
import { PlayerLobby } from '../player-lobby';
const devices = [
  { name: 'Small phone', width: 320, height: 568, top: 0, bottom: 0 },
  { name: 'iPhone portrait', width: 390, height: 844, top: 59, bottom: 34 },
  { name: 'Large iPhone', width: 430, height: 932, top: 59, bottom: 34 },
  { name: 'Landscape phone', width: 844, height: 390, top: 0, bottom: 21 }
];
// Isolated viewport fixtures use the real UI. The lobby has local props only:
// its button cannot create a game, and no real account is signed in for it.
export function LayoutHarness() {
  const query = useSearchParams();
  if (!query) return null;
  const scenario = query.get('case');
  const device = devices.find(d => d.name === query.get('device')) || devices[1];
  if (scenario) return <>
    <style>{`:root { --table-safe-top: ${device.top}px; --table-safe-bottom: ${device.bottom}px; }`}</style>
    {scenario === 'table' ? <Home /> : <div className="app">
      <header className="topbar"><strong>Dunzo Club · Local layout fixture</strong></header>
      <main className="lobby simple-lobby">
        <PlayerLobby player={{ id: 'layout-only', name: 'Layout tester' }} players={[]} activeGame={null} loading={false} busy={false} error="" onLogin={async () => {}} onOpen={async () => {}} onRetry={async () => {}} hasPending={false} />
        <section className="game-history"><div className="history-toolbar"><h2>Previous Games</h2><button className="secondary">Settle Up</button></div></section>
      </main>
    </div>}
  </>;
  return <main style={{ padding: 20 }}><h1 style={{fontSize:24}}>Mobile layout checks</h1><p>Staging-only UI fixtures. Lobby actions are disabled; table checks use local practice.</p>
    {devices.map(d => <section key={d.name} style={{marginBottom:24}}><h2 style={{fontSize:18}}>{d.name} · {d.width} × {d.height}</h2><div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
      {['lobby','table'].map(kind => <iframe key={kind} title={`${d.name} ${kind}`} width={d.width} height={d.height} src={`/layout-check?case=${kind}&device=${encodeURIComponent(d.name)}`} style={{border:0,outline:'1px solid #d9bb82',flexShrink:0}} />)}
    </div></section>)}
  </main>;
}
