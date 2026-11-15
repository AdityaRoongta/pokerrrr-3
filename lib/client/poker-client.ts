import { commandEnvelope, PROTOCOL_VERSION } from '../protocol/poker.mjs';
type Snapshot = { code: string; version: number; handStartedAt?: number } & Record<string, any>;
export type Connection = 'connecting' | 'connected' | 'reconnecting' | 'offline';
type TableState = { lobby: any; room: Snapshot | null };
const RATE_LIMIT_RETRY_MS = 5000;
export class PokerClient {
  private socket?: WebSocket;
  private replies = new Map<string, { resolve: (value: Snapshot) => void; reject: (error: any) => void }>();
  private delivery?: Promise<Snapshot>;
  private changed?: (accepted?: Snapshot) => void;
  private roomCode = '';
  private retryAfter = 0;
  constructor(private playerId: string) { }
  static async auth(path: string, body?: Record<string, unknown>) {
    const response = await fetch(`/api/${path}`, {
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(8000)
    });
    const result = await response.json() as any;
    if (!response.ok) throw Object.assign(new Error(result.error || 'Could not reach the server'), { status: response.status });
    return result;
  }
  private async request(input?: Record<string, any>, code?: string, presence = false) {
    const response = await fetch(input ? '/api/poker' : `/api/poker?code=${encodeURIComponent(code || '')}`, {
      method: input ? 'POST' : 'GET',
      headers: { ...(input && { 'Content-Type': 'application/json' }), ...(presence && { 'X-Poker-Presence': 'poll' }) },
      ...(input && { body: JSON.stringify(input) }), signal: AbortSignal.timeout(4000)
    });
    const data = await response.json() as Snapshot & { error?: string };
    if (!response.ok) throw Object.assign(new Error(data.error || 'Could not reach the table'), { status: response.status });
    return data;
  }
  snapshot(code: string) { this.roomCode = code; return this.request(undefined, code); }
  private get pendingKey() { return `dunzo-club-command:${this.playerId}`; }
  hasPending() { return Boolean(localStorage.getItem(this.pendingKey)); }
  private forgetCommand(commandId: string) {
    const stored = localStorage.getItem(this.pendingKey);
    if (!stored) return;
    let input;
    try { input = JSON.parse(stored); } catch { return; }
    if (input?.commandId === commandId) localStorage.removeItem(this.pendingKey);
  }
  private clearSupersededBet(room: Snapshot | null) {
    if (!room || this.delivery) return false;
    const stored = localStorage.getItem(this.pendingKey);
    if (!stored) return false;
    let input;
    try { input = JSON.parse(stored); } catch { return false; }
    // The server checks receipts first, then requires the exact table version.
    // A newer view is authoritative even if the original reply was lost.
    if (!input || !['fold', 'check', 'call', 'raise'].includes(input.type) ||
        input.code !== room.code || !Number.isSafeInteger(input.version) || room.version <= input.version) return false;
    localStorage.removeItem(this.pendingKey);
    this.retryAfter = 0;
    return true;
  }
  async retryPending() {
    if (this.delivery) return this.delivery;
    if (Date.now() < this.retryAfter) throw new Error('The table is rate limiting requests. Retrying shortly.');
    const stored = localStorage.getItem(this.pendingKey);
    if (!stored) return null;
    return this.deliver(JSON.parse(stored));
  }
  async send(input: Record<string, any>, room?: Snapshot) {
    if (this.hasPending()) throw new Error('Restoring your connection… Your previous action is being checked automatically.');
    const envelope = commandEnvelope(input, room);
    this.roomCode = input.code || this.roomCode;
    localStorage.setItem(this.pendingKey, JSON.stringify(envelope));
    return this.deliver(envelope);
  }
  private socketRequest(input: Record<string, any>): Promise<Snapshot> {
    if (this.socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Live connection unavailable'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.replies.delete(input.commandId); reject(new Error('Live reply timed out')); }, 4000);
      this.replies.set(input.commandId, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); }
      });
      try { this.socket!.send(JSON.stringify({ protocol: PROTOCOL_VERSION, type: 'command', input })); }
      catch (error) { this.replies.get(input.commandId)?.reject(error); this.replies.delete(input.commandId); }
    });
  }
  private deliver(input: Record<string, any>): Promise<Snapshot> {
    if (this.delivery) return this.delivery;
    let accepted: Snapshot | undefined;
    const work = async () => {
      try {
        let result: Snapshot;
        try { result = await this.request(input); }
        catch (error: any) {
          if (error.status && error.status < 500) throw error;
          // Lost HTTP replies and WebSocket retries share the same durable receipt.
          result = await this.socketRequest(input);
        }
        this.forgetCommand(input.commandId);
        accepted = result;
        return result;
      } catch (error: any) {
        if (error.status === 429) this.retryAfter = Date.now() + RATE_LIMIT_RETRY_MS;
        else if (error.status && error.status < 500 && error.status !== 401) this.forgetCommand(input.commandId);
        if (!error.status || error.status >= 500) throw new Error('Reconnecting… Your action will be checked automatically.');
        throw error;
      }
    };
    this.delivery = work().finally(() => { this.delivery = undefined; this.changed?.(accepted); });
    return this.delivery;
  }
  connect(update: (state: TableState) => void, status: (state: Connection) => void, expired: () => void,
    reaction?: (event: any, serverTime: number) => void, social?: (entry: any) => void,
    recovered?: (message: string) => void) {
    let stopped = false, retry: ReturnType<typeof setTimeout> | undefined, attempts = 0;
    let lastContact = 0, lastHttpSnapshot = 0, lastPoll = 0, polling = false, recovering = false, dialing = false, authChecking = false;
    let lastLobby: any = { activeGame: null }, latestRoom: Snapshot | null = null, waitingForCommand = false;
    const publish = (state: TableState) => {
      if (stopped) return;
      lastLobby = state.lobby;
      if (state.room) {
        this.roomCode = state.room.code;
        if (latestRoom?.code !== state.room.code || state.room.version >= latestRoom.version) latestRoom = state.room;
      }
      update(state);
      if (this.clearSupersededBet(latestRoom)) recovered?.('Table updated. Check the current action before playing.');
      waitingForCommand = this.hasPending();
      status(waitingForCommand ? 'reconnecting' : 'connected');
    };
    const unavailable = () => {
      waitingForCommand = this.hasPending();
      status(!navigator.onLine ? 'offline' : !waitingForCommand && lastHttpSnapshot && Date.now() - lastHttpSnapshot < 6000 ? 'connected' : 'reconnecting');
    };
    const checkSession = async () => {
      if (authChecking || stopped) return;
      authChecking = true;
      try { const session = await PokerClient.auth('session'); if (!stopped && !session.player) expired(); }
      catch { /* Network failure is never proof that a session expired. */ }
      finally { authChecking = false; }
    };
    const recover = async () => {
      if (stopped || recovering || this.delivery || !this.hasPending()) return;
      if (this.clearSupersededBet(latestRoom)) {
        recovered?.('Table updated. Check the current action before playing.');
        refresh();
        return;
      }
      if (Date.now() < this.retryAfter) return;
      recovering = true;
      unavailable();
      try {
        const result = await this.retryPending();
        if (stopped) return;
        if (result) publish({ lobby: lastLobby, room: result });
        recovered?.('Connection restored. Your previous action was confirmed.');
      } catch (error: any) {
        if (stopped) return;
        if (error.status === 401) void checkSession();
        // A stale version/hand is a definitive rejection: unblock the next turn.
        if (!this.hasPending()) {
          recovered?.(error.status === 403 ? 'Table access changed. Review the latest state.' : 'Back at the table. Your previous action was not applied.');
          refresh();
        }
      } finally {
        recovering = false;
        if (!stopped && !this.hasPending()) { lastPoll = 0; void poll(); }
      }
    };
    const dial = () => {
      if (stopped || dialing || this.socket?.readyState === WebSocket.OPEN) return;
      dialing = true;
      unavailable();
      const url = new URL('/api/poker/socket', location.href);
      url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      // The socket authenticates its own cookie; an HTTP outage must not gate it.
      const socket = new WebSocket(url);
      this.socket = socket;
      const opening = setTimeout(() => socket.close(), 6000);
      socket.onmessage = event => {
        if (stopped || this.socket !== socket) return;
        try {
          const message = JSON.parse(event.data);
          if (message.protocol !== PROTOCOL_VERSION) { socket.close(); return; }
          clearTimeout(opening);
          lastContact = Date.now(); attempts = 0;
          if (message.type === 'command_result') {
            const reply = this.replies.get(message.commandId);
            this.replies.delete(message.commandId);
            if (message.error) reply?.reject(Object.assign(new Error(message.error), { status: message.status }));
            else reply?.resolve(message.snapshot);
          } else if (message.type === 'state' && (!message.room || Number.isSafeInteger(message.room.version))) publish(message);
          else if (message.type === 'social') social?.(message.entry);
          else if (message.type === 'reaction') reaction?.(message.event, message.serverTime);
          void recover();
        } catch { socket.close(); }
      };
      socket.onclose = event => {
        clearTimeout(opening);
        if (this.socket !== socket) return;
        this.socket = undefined; dialing = false;
        for (const reply of this.replies.values()) reply.reject(new Error('Live connection interrupted'));
        this.replies.clear();
        if (stopped) return;
        unavailable();
        if (event.code === 1008) void checkSession();
        retry = setTimeout(dial, Math.min(10000, 500 * 2 ** Math.min(attempts++, 5)) + Math.random() * 250);
        void poll();
      };
      socket.onerror = () => socket.close();
    };
    const poll = async () => {
      if (stopped || polling || Date.now() - lastPoll < 2500) return;
      polling = true; lastPoll = Date.now();
      try {
        const lobby = await PokerClient.auth('lobby');
        const code = this.roomCode || lobby.activeGame?.code;
        const room = code ? await this.request(undefined, code, true) : null;
        lastHttpSnapshot = Date.now();
        publish({ lobby, room });
        void recover();
      } catch (error: any) { if (error.status === 401) void checkSession(); }
      finally { polling = false; }
    };
    const heartbeat = () => {
      if (stopped) return;
      if (!navigator.onLine) status('offline');
      if (this.socket?.readyState === WebSocket.OPEN) {
        if (lastContact && Date.now() - lastContact > 10000) { unavailable(); this.socket.close(); }
        else this.socket.send(JSON.stringify({ protocol: PROTOCOL_VERSION, type: 'ping' }));
      } else if (!dialing) { clearTimeout(retry); dial(); }
      if (!lastContact || Date.now() - lastContact > 6000 || this.hasPending()) void poll();
      void recover();
    };
    const refresh = () => {
      lastPoll = 0;
      if (this.socket?.readyState === WebSocket.OPEN) {
        try { this.socket.send(JSON.stringify({ protocol: PROTOCOL_VERSION, type: 'resync' })); }
        catch { this.socket?.close(); }
      }
      void poll();
    };
    const resume = () => {
      if (document.hidden || !navigator.onLine) return;
      refresh();
      heartbeat();
    };
    this.changed = accepted => {
      if (stopped) return;
      if (this.hasPending()) unavailable();
      else if (waitingForCommand && accepted) publish({ lobby: lastLobby, room: accepted });
      else if (waitingForCommand) refresh();
    };
    const timer = setInterval(heartbeat, 3000);
    window.addEventListener('online', resume); window.addEventListener('offline', heartbeat);
    document.addEventListener('visibilitychange', resume);
    dial();
    return () => {
      stopped = true; this.changed = undefined;
      clearTimeout(retry); clearInterval(timer); this.socket?.close();
      for (const reply of this.replies.values()) reply.reject(new Error('Connection stopped'));
      this.replies.clear();
      window.removeEventListener('online', resume); window.removeEventListener('offline', heartbeat);
      document.removeEventListener('visibilitychange', resume);
    };
  }
}
