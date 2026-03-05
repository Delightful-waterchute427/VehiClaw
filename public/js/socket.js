// public/js/socket.js — WebSocket client with auto-reconnect and auth

const WS_PATH = '/ws';
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS  = 30000;
const PING_INTERVAL_MS  = 20000;

export class CarSocket {
  constructor() {
    this._ws = null;
    this._handlers = new Map();       // type → [handler]
    this._reconnectDelay = RECONNECT_BASE_MS;
    this._pingTimer = null;
    this._connected = false;
    this._token = null;
    this._clientId = null;
  }

  /** Connect using a saved token (from localStorage). */
  connect(token) {
    this._token = token;
    this._open();
  }

  _open() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${location.host}${WS_PATH}`;

    this._ws = new WebSocket(url);

    this._ws.addEventListener('open', () => {
      console.log('[VehiClaw] WebSocket connected');
      this._connected = true;
      this._reconnectDelay = RECONNECT_BASE_MS;
      this._startPing();

      // Authenticate immediately
      this._send({ type: 'auth', token: this._token });
    });

    this._ws.addEventListener('message', (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.type === 'auth_result') {
        if (msg.success) {
          this._clientId = msg.clientId;
          console.log('[VehiClaw] Authenticated as', this._clientId?.slice(0, 8));
        } else {
          console.error('[VehiClaw] Auth failed — clear token and re-setup');
          localStorage.removeItem('vehiclaw_token');
          this._emit('auth_failed', {});
          return;
        }
      }

      this._emit(msg.type, msg);
    });

    this._ws.addEventListener('close', () => {
      this._connected = false;
      this._stopPing();
      this._emit('disconnected', {});
      console.log(`[VehiClaw] Disconnected — reconnecting in ${this._reconnectDelay}ms`);
      setTimeout(() => {
        this._reconnectDelay = Math.min(this._reconnectDelay * 1.5, RECONNECT_MAX_MS);
        this._open();
      }, this._reconnectDelay);
    });

    this._ws.addEventListener('error', (err) => {
      console.error('[VehiClaw] WebSocket error', err);
    });
  }

  send(type, payload = {}) {
    if (!this._connected || !this._clientId) return;
    this._send({ type, clientId: this._clientId, requestId: crypto.randomUUID(), ...payload });
  }

  _send(obj) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(obj));
    }
  }

  on(type, handler) {
    const list = this._handlers.get(type) ?? [];
    list.push(handler);
    this._handlers.set(type, list);
  }

  off(type, handler) {
    const list = this._handlers.get(type) ?? [];
    this._handlers.set(type, list.filter(h => h !== handler));
  }

  _emit(type, payload) {
    (this._handlers.get(type) ?? []).forEach(h => h(payload));
    // Also emit to wildcard handlers
    (this._handlers.get('*') ?? []).forEach(h => h({ type, ...payload }));
  }

  _startPing() {
    this._pingTimer = setInterval(() => this._send({ type: 'ping' }), PING_INTERVAL_MS);
  }

  _stopPing() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
  }

  setContext(drivingMode, location) {
    this.send('set_context', { payload: { drivingMode, location } });
  }

  isConnected() { return this._connected; }
  getClientId() { return this._clientId; }
}
