import { commandEnvelope, PROTOCOL_VERSION } from '../protocol/poker.mjs';

type Snapshot = { code: string; version: number; handStartedAt?: number } & Record<string, any>;
export type Connection = 'connecting' | 'connected' | 'reconnecting' | 'offline';
export class PokerClient {
  constructor(private token: string) {}

  async unlock(key?: string) {
    const response = await fetch('/api/club/access', key ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) } : {});
    const result = await response.json() as { authorized?: boolean; error?: string };
    if (!response.ok || !result.authorized) throw new Error(result.error || 'Enter the club access code to play');
  }

  private async request(input?: Record<string, any>, code?: string) {
    const response = await fetch(input ? '/api/poker' : `/api/poker?code=${encodeURIComponent(code || '')}`, {
      method: input ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${this.token}`, ...(input && { 'Content-Type': 'application/json' }) },
      ...(input && { body: JSON.stringify(input) }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json() as Snapshot & { error?: string };
    if (!response.ok) throw Object.assign(new Error(data.error || 'Could not reach the table'), { status: response.status });
    return data as Snapshot;
  }

  snapshot(code: string) { return this.request(undefined, code); }
  private get pendingKey() { return `dunzo-club-command:${this.token}`; }
  hasPending() { return Boolean(localStorage.getItem(this.pendingKey)); }
  async retryPending() {
    const stored = localStorage.getItem(this.pendingKey);
    if (!stored) return null;
    return this.deliver(JSON.parse(stored));
  }
  async send(input: Record<string, any>, room?: Snapshot) {
    if (this.hasPending()) throw new Error('An earlier action is unconfirmed. Use Retry last action before sending another.');
    const envelope = commandEnvelope(input, room);
    // Retain the same command ID across lost replies, reloads and manual retries.
    localStorage.setItem(this.pendingKey, JSON.stringify(envelope));
    return this.deliver(envelope);
  }
  private async deliver(input: Record<string, any>) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const snapshot = await this.request(input);
        localStorage.removeItem(this.pendingKey);
        return snapshot;
      } catch (error: any) {
        if (error.status && error.status < 500) {
          // Authentication/rate failures happen before receipt lookup; preserve
          // an earlier, possibly accepted command until it can be checked.
          if (![401, 403, 429].includes(error.status)) localStorage.removeItem(this.pendingKey);
          throw error;
        }
        if (attempt === 2) throw new Error('Action unconfirmed. Reconnect and use Retry last action; it will not apply twice.');
        await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
    throw new Error('Connection failed');
  }

  connect(code: string, update: (room: Snapshot) => void, status: (state: Connection) => void) {
    let stopped = false, socket: WebSocket | undefined, retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0, lastVersion = -1, watchdog: ReturnType<typeof setTimeout> | undefined;
    const dial = () => {
      if (stopped) return;
      status(navigator.onLine ? (attempts ? 'reconnecting' : 'connecting') : 'offline');
      const url = new URL('/api/poker/socket', location.href); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(url);
      watchdog = setTimeout(() => socket?.close(), 15_000);
      socket.onopen = () => socket?.send(JSON.stringify({ protocol: PROTOCOL_VERSION, type: 'authenticate', code, token: this.token }));
      socket.onmessage = event => {
        if (stopped) return;
        try {
          const message = JSON.parse(event.data);
          if (message.protocol !== PROTOCOL_VERSION) { socket?.close(); return; }
          if (message.type === 'pong') { clearTimeout(watchdog); return; }
          if (message.type !== 'snapshot' || message.snapshot.code !== code || !Number.isSafeInteger(message.snapshot.version)) return;
          clearTimeout(watchdog); attempts = 0; status('connected');
          if (message.snapshot.version >= lastVersion) { lastVersion = message.snapshot.version; update(message.snapshot); }
        } catch { socket?.close(); }
      };
      socket.onclose = () => {
        clearTimeout(watchdog);
        if (stopped) return;
        status(navigator.onLine ? 'reconnecting' : 'offline');
        retry = setTimeout(dial, Math.min(15_000, 500 * 2 ** Math.min(attempts++, 5)) + Math.random() * 300);
      };
      socket.onerror = () => socket?.close();
    };
    const resume = () => {
      if (document.hidden || stopped) return;
      if (socket?.readyState === WebSocket.OPEN) {
        // A ping detects half-open mobile connections; reconnect sends a full view.
        socket.send(JSON.stringify({ protocol: PROTOCOL_VERSION, type: 'ping' }));
        clearTimeout(watchdog); watchdog = setTimeout(() => socket?.close(), 10_000);
      } else if (!socket || socket.readyState === WebSocket.CLOSED) { clearTimeout(retry); dial(); }
    };
    const heartbeat = setInterval(resume, 20_000);
    window.addEventListener('online', resume); document.addEventListener('visibilitychange', resume);
    dial();
    return () => {
      stopped = true; clearTimeout(retry); clearTimeout(watchdog); clearInterval(heartbeat); socket?.close();
      window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume);
    };
  }
}
