// Optional browser regression suite. Uses only disposable, intercepted local data.
// Run after build:staging; Playwright and a Chromium executable must be available.
const { chromium } = require(process.env.POKER_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), cp = require('child_process');
(async () => {
  const root = require('path').resolve(__dirname, '..');
  process.chdir(root);
  const { newRoom, command, startHand, view, finish } = await import(root + '/lib/poker.mjs'), { PROTOCOL_VERSION } = await import(root + '/lib/protocol/poker.mjs');
  const srv = cp.spawn(process.execPath, ['scripts/staging.mjs', 'preview'], { env: { ...process.env, CLOUDFLARE_CF_FETCH_ENABLED: 'false', WRANGLER_SEND_METRICS: 'false' }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  srv.stdout.on('data', d => logs += d);
  srv.stderr.on('data', d => logs += d);
  process.on('exit', () => { try {
    process.kill(-srv.pid, 'SIGTERM');
  }
  catch { } });
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch('http://127.0.0.1:8787/api/health');
      if (r.ok) {
        ready = true;
        break;
      }
    }
    catch { }
    await new Promise(r => setTimeout(r, 500));
  }
  assert(ready, logs);
  const b = await chromium.launch({ headless: true, ...(process.env.POKER_BROWSER_EXECUTABLE ? { executablePath: process.env.POKER_BROWSER_EXECUTABLE } : {}), args: ['--no-sandbox'] });
  for (const [width, height, game, runs] of [[320, 568, 'PLO5', 1], [390, 844, 'PLO5', 2], [430, 932, 'NLH', 1], [844, 390, 'PLO4', 1]]) {
    const p = await b.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
    let errs = [];
    p.on('pageerror', e => errs.push(e.message));
    const r = newRoom('UITEST', 'me', { name: 'Layout tester', sb: 25, bb: 50, buyin: 2500, seats: 8, games: [game], rotation: 3, timer: 30 });
    for (let i = 1; i < 8; i++)
      command(r, 'p' + i, { type: 'join', name: 'Player ' + i, buyin: 2500 });
    r.paused = true;
    startHand(r, Date.now() - 10000);
    r.players[0].bet = 200;
    r.players[0].total = 200;
    r.players[0].stack = 2300;
    r.phase = 'flop'; r.board = r.deck.splice(-3);
    r.players[1].bet = 250; r.players[1].total = 250; r.players[1].stack = 2250; r.currentBet = 250;
    const lobby = { activeGame: { code: r.code, joined: true, players: r.players, settings: r.settings } }, state = () => ({ type: 'state', protocol: PROTOCOL_VERSION, lobby, room: view(r, 'me') });
    let socket;
    let bettingCommands = 0;
    const entries = [];
    await p.route('**/api/**', async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname === '/api/poker' && request.method() === 'POST') bettingCommands++;
      if (url.pathname === '/api/chat' && request.method() === 'POST') {
        const message = request.postDataJSON();
        const entry = { code: r.code, id: crypto.randomUUID(), sequence: entries.length + 1, kind: 'message', text: message.text, at: Date.now(), sender: { key: 'me', name: 'Layout tester', seat: 0 } };
        entries.push(entry);
        return route.fulfill({ json: { entry } });
      }
      const data = url.pathname === '/api/players' ? { players: [{ id: 'me', name: 'Layout tester' }] } : url.pathname === '/api/session' ? { player: { id: 'me', name: 'Layout tester' } } : url.pathname === '/api/lobby' ? lobby : url.pathname.includes('history') ? { games: [], nextCursor: null } : url.pathname === '/api/chat' ? { entries, nextCursor: null } : view(r, 'me');
      return route.fulfill({ json: data });
    });
    await p.routeWebSocket('**/api/poker/socket', ws => { socket = ws; ws.send(JSON.stringify(state())); });
    await p.goto('http://127.0.0.1:8787');
    await p.waitForTimeout(1500);
    await p.locator('.personal-hole-cards .card').first().waitFor({ timeout: 5000 });
    await p.waitForTimeout(200);
    assert.equal(await p.locator('.topbar .chat-toggle').count(), 0);
    const wager = await p.locator('.your-seat .seat-bet').boundingBox(), hero = await p.locator('.your-seat .seat-info').boundingBox();
    assert(wager && wager.y + wager.height <= hero.y, 'Hero bet is above nameplate');
    const peek = await p.locator('.cards-concealed:not(.your-seat)').first().evaluate(e => { const card = e.querySelector('.card.back').getBoundingClientRect(), name = e.querySelector('.seat-info').getBoundingClientRect(); return name.top - card.top; });
    assert(peek >= 6 && peek <= 14, 'Card-back peek: ' + peek);
    assert.equal(await p.locator('.turn-beam.is-active').count(), 1);
    const firstAngle = await p.locator('.turn-beam-direction').getAttribute('style');
    r.turn = r.players[4].id;
    r.version++;
    socket.send(JSON.stringify(state()));
    await p.waitForTimeout(350);
    const lastAngle = await p.locator('.turn-beam-direction').getAttribute('style');
    assert.notEqual(firstAngle, lastAngle, 'Beam rotates when actor changes');
    await p.screenshot({ path: `/tmp/dunzo-ui-${width}-normal.png` });
    await p.getByRole('button', { name: 'Table menu', exact: true }).click();
    assert.equal(await p.locator('.menu-list>button').count(), 6);
    await p.getByRole('button', { name: 'Terminate Game', exact: true }).click();
    const box = await p.getByRole('dialog').getByRole('button', { name: 'Terminate Game', exact: true }).boundingBox();
    assert(box.y >= 0 && box.y + box.height <= height, 'Confirmation visible');
    await p.getByRole('button', { name: 'Cancel', exact: true }).click();
    await p.getByRole('button', { name: 'Close', exact: true }).click();
    r.turn = 'me'; r.deadline = Date.now() + 30000; r.version++; socket.send(JSON.stringify(state()));
    await p.waitForTimeout(100);
    await p.getByRole('button', { name: 'Write a message', exact: true }).click();
    await p.locator('#chat-message').fill('Keep this draft');
    if (height > 600)
      await p.setViewportSize({ width, height: 460 });
    await p.waitForTimeout(200);
    const bounds = await p.locator('.action-buttons,.chat-composer,.personal-hand,.table-stage').evaluateAll(es => es.map(e => ({ cls: e.className, top: e.getBoundingClientRect().top, bottom: e.getBoundingClientRect().bottom, client: e.clientHeight, scroll: e.scrollHeight })));
    const vh = p.viewportSize().height;
    for (const e of bounds)
      assert(e.top >= 0 && e.bottom <= vh, JSON.stringify({ width, height, vh, e }));
    const composer = await p.locator('.chat-composer').boundingBox();
    assert(composer.width <= width * .95, 'Composer fits inside the typing view');
    assert.equal(await p.locator('.topbar').isVisible(), false, 'Brand header hidden while typing');
    assert.equal(await p.locator('.slider-shortcuts').isVisible(), false, 'Raise slider hidden while typing');
    assert.equal(await p.locator('.seat-info').first().isVisible(), false, 'Seat arrangement hidden while typing');
    assert.equal(await p.locator('.action-buttons').evaluate(e => getComputedStyle(e).boxShadow), 'none', 'No group selection outline');
    const boardBounds = await p.locator('.table-stage').boundingBox();
    const cards = await p.locator('.table-stage .board-cards .card').evaluateAll(es => es.map(e => { const b = e.getBoundingClientRect(); return {top:b.top,bottom:b.bottom,left:b.left,right:b.right}; }));
    assert.equal(cards.length, 5);
    for (const card of cards) assert(card.top >= boardBounds.y && card.bottom <= boardBounds.y + boardBounds.height && card.left >= 0 && card.right <= width, 'Entire community board visible');
    // A native keyboard can pan as well as resize the visual viewport.
    await p.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'offsetTop', { configurable:true, get:()=>25 });
      Object.defineProperty(window.visualViewport, 'height', { configurable:true, get:()=>window.innerHeight-25 });
      window.visualViewport.dispatchEvent(new Event('resize'));
    });
    await p.waitForTimeout(100);
    const panned = await p.locator('.app').boundingBox();
    assert.equal(panned.y,25,'App follows native visual viewport panning');
    assert(panned.y+panned.height<=vh,'Panned app remains above keyboard');
    await p.evaluate(() => {
      delete window.visualViewport.offsetTop; delete window.visualViewport.height;
      window.visualViewport.dispatchEvent(new Event('resize'));
    });
    await p.waitForTimeout(100);
    await p.screenshot({ path: `/tmp/dunzo-ui-${width}-typing.png` });
    await p.getByRole('button', { name: 'Expand chat history' }).click();
    assert.equal(await p.getByRole('dialog', { name: 'Game chat history' }).count(), 1);
    await p.getByRole('button', { name: 'Back to game', exact: true }).click();
    await p.getByRole('button', { name: 'Write a message', exact: true }).click();
    assert.equal(await p.locator('#chat-message').inputValue(), 'Keep this draft');
    await p.getByRole('button', { name: 'Raise…', exact: true }).click();
    assert.equal(await p.locator('#chat-message').count(), 0, 'Raise closes the composer');
    assert.equal(await p.locator('.slider-shortcuts').isVisible(), true, 'Raise opens normal amount selection');
    assert.equal(bettingCommands, 0, 'First Raise tap never sends a bet');
    await p.getByRole('button', { name: 'Write a message', exact: true }).click();
    assert.equal(await p.locator('#chat-message').inputValue(), 'Keep this draft', 'Raise handoff retains draft');
    const actionReply = p.waitForResponse(response => response.url().endsWith('/api/poker') && response.request().method()==='POST');
    await p.getByRole('button', {name:'Call 50',exact:true}).click();
    await actionReply;
    assert.equal(bettingCommands,1,'Call works on the first tap while typing');
    assert.equal(await p.locator('#chat-message').inputValue(),'Keep this draft','Betting retains the draft');
    const sent = p.waitForResponse(response => response.url().includes('/api/chat') && response.request().method() === 'POST');
    await p.getByRole('button', { name: 'Send message' }).click();
    assert.equal(await p.locator('#chat-message').count(), 0, 'Composer closes immediately after Send');
    await sent;
    assert.equal(entries.length, 1);
    await p.setViewportSize({ width, height });
    r.board = r.deck.slice(0, 5);
    if (runs === 2) {
      r.runBoards = [r.board, r.deck.slice(5, 10)];
      r.runCount = 2;
    }
    for (const player of r.players) {
      player.total = 100;
      player.bet = 100;
      player.stack = 2400;
    }
    finish(r, false, Date.now() - 30000);
    r.serverTime = Date.now();
    socket.send(JSON.stringify(state()));
    await p.waitForTimeout(500);
    assert(await p.locator('.table-winning-hand').count() > 0);
    assert.equal(await p.locator('.card.winning-card').count(), 5);
    assert.equal(await p.locator('.seat.acting').count(), 0);
    const placement = await p.locator('.runout-board').first().evaluate(e => { const cards = e.querySelector('.board-cards').getBoundingClientRect(), award = e.querySelector('.table-awards').getBoundingClientRect(); return { cards: cards.bottom, result: award.top, bottom: award.bottom }; });
    assert(placement.result >= placement.cards, 'Win info below board');
    assert.equal(await p.locator('.action-zone .table-awards').count(), 0);
    assert.equal(await p.locator('.turn-beam.is-active').count(), 0);
    await p.screenshot({ path: `/tmp/dunzo-ui-${width}-winner.png` });
    assert.deepEqual(errs, []);
    await p.close();
    console.log(`PASS ${width}×${height} ${game}, ${runs} board(s)`);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
