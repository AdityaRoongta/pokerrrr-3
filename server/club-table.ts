import { DurableObject } from 'cloudflare:workers';
import { TableService, TableError } from './table-service.mjs';
import { accessCookie, hasAccess, matchesAccessKey } from './access.mjs';
import { PROTOCOL_VERSION, playerToken, roomCode } from '../lib/protocol/poker.mjs';

type Peer = { token?: string; code?: string; cookie: string };
const json = (data: unknown, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie, Authorization', ...headers } });

export class ClubTable extends DurableObject<Cloudflare.Env> {
  private service: TableService;
  private queue: Promise<unknown> = Promise.resolve();
  private rates = new Map<string, { count: number; until: number }>();

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.service = new TableService(ctx.storage);
  }

  // Serialize fetches, alarms and socket callbacks across asynchronous awaits.
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }

  private limit(key: string, max: number) {
    const now = Date.now();
    for (const [k, value] of this.rates) if (value.until < now) this.rates.delete(k);
    const value = this.rates.get(key) || { count: 0, until: now + 60_000 };
    this.rates.set(key, value);
    if (++value.count > max) throw new TableError('Too many requests. Try again in a minute.', 429);
  }

  private async body(request: Request) {
    // Read incrementally to bound chunked payloads as well as Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new TableError('JSON body required');
    let bytes = 0, text = '';
    const decoder = new TextDecoder();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new TableError('Request timed out', 408)), 5000); });
    try {
      for (;;) {
        const { done, value } = await Promise.race([reader.read(), timeout]);
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 4096) throw new TableError('Request too large', 413);
        text += decoder.decode(value, { stream: true });
      }
      return JSON.parse(text + decoder.decode());
    } finally { clearTimeout(timer); await reader.cancel(); }
  }

  fetch(request: Request) {
    return this.serial(async () => {
      try {
        const url = new URL(request.url);
        if (url.pathname === '/api/club/access') {
          if (request.method === 'GET') return json({ authorized: await hasAccess(request, this.env.CLUB_ACCESS_KEY) });
          if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
          this.limit(`access:${request.headers.get('CF-Connecting-IP') || 'local'}`, 10);
          this.limit('access:club', 60);
          const { key } = await this.body(request);
          if (!await matchesAccessKey(key, this.env.CLUB_ACCESS_KEY)) return json({ error: 'Club access code is incorrect' }, 401);
          return json({ authorized: true }, 200, { 'Set-Cookie': await accessCookie(this.env.CLUB_ACCESS_KEY!, url.protocol === 'https:') });
        }
        if (!await hasAccess(request, this.env.CLUB_ACCESS_KEY)) return json({ error: 'Enter the club access code to play', code: 'CLUB_ACCESS_REQUIRED' }, 401);
        if (url.pathname === '/api/poker/socket') {
          if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'WebSocket upgrade required' }, 426);
          if (this.ctx.getWebSockets().length >= 32) return json({ error: 'Too many table connections' }, 429);
          const pair = new WebSocketPair();
          this.ctx.acceptWebSocket(pair[1]);
          pair[1].serializeAttachment({ cookie: request.headers.get('Cookie') || '' });
          setTimeout(() => {
            if (!(pair[1].deserializeAttachment() as Peer)?.token) try { pair[1].close(1008, 'Authentication timed out'); } catch {}
          }, 10_000);
          return new Response(null, { status: 101, webSocket: pair[0] });
        }
        const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
        playerToken.parse(token);
        this.limit(`player:${token}`, 180);
        if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
        // Catch overdue work before accepting any new player action.
        const advanced = await this.service.advance();
        if (advanced) await this.broadcast(advanced);
        if (request.method === 'GET') return json(await this.service.snapshot(token, url.searchParams.get('code') || ''));
        const result = await this.service.execute(token, await this.body(request));
        await this.broadcast(result.snapshot.code);
        return json({ ...result.snapshot, ack: result.ack });
      } catch (error) {
        if (error instanceof TableError) return json({ error: error.message }, error.status);
        // Engine validation messages are safe; parser/storage details are not.
        if (error instanceof SyntaxError || (error as Error)?.name === 'ZodError') return json({ error: 'Invalid request' }, 400);
        if (error instanceof Error && !/SQL|storage|internal/i.test(error.message)) return json({ error: error.message }, 400);
        return json({ error: 'Table unavailable. Reconnect and try again.' }, 503);
      }
    });
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    return this.serial(async () => {
      try {
        if (typeof message !== 'string' || message.length > 1024) throw new Error('Invalid message');
        const input = JSON.parse(message);
        if (input.protocol !== PROTOCOL_VERSION) throw new Error('Unsupported protocol');
        const peer = socket.deserializeAttachment() as Peer | null;
        if (!peer || !await this.authorized(peer)) throw new Error('Access expired');
        if (peer.token) this.limit(`message:${peer.token}`, 120);
        if (input.type === 'ping' && peer.token) { socket.send(JSON.stringify({ type: 'pong', protocol: PROTOCOL_VERSION })); return; }
        if (input.type !== 'authenticate' || peer.token) throw new Error('Authentication required');
        const token = playerToken.parse(input.token), code = roomCode.parse(input.code);
        this.limit(`socket:${token}`, 60);
        const snapshot = await this.service.snapshot(token, code);
        // Device bearer IDs never appear in URLs, logs or other players' views.
        socket.serializeAttachment({ token, code, cookie: peer.cookie });
        socket.send(JSON.stringify({ protocol: PROTOCOL_VERSION, type: 'snapshot', snapshot }));
      } catch { socket.close(1008, 'Connection not authorized'); }
    });
  }

  private async broadcast(code: string) {
    for (const socket of this.ctx.getWebSockets()) {
      const peer = socket.deserializeAttachment() as Peer | null;
      if (!peer?.token || peer.code !== code) continue;
      try {
        if (!await this.authorized(peer)) { socket.close(1008, 'Club access expired'); continue; }
        socket.send(JSON.stringify({ protocol: PROTOCOL_VERSION, type: 'snapshot', snapshot: await this.service.snapshot(peer.token, code) }));
      } catch { try { socket.close(1011, 'Please reconnect'); } catch {} }
    }
  }

  private authorized(peer: Peer) {
    return hasAccess(new Request('https://dunzo-club.invalid', { headers: { Cookie: peer.cookie } }), this.env.CLUB_ACCESS_KEY);
  }

  webSocketClose(socket: WebSocket, code: number) { try { socket.close(code); } catch {} }
  webSocketError(socket: WebSocket) { try { socket.close(1011, 'Please reconnect'); } catch {} }
  alarm() {
    return this.serial(async () => {
      const code = await this.service.advance();
      if (code) await this.broadcast(code);
    });
  }
}
