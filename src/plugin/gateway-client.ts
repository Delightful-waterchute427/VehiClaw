// src/plugin/gateway-client.ts
// Manages the WebSocket connection to the OpenClaw Gateway daemon.
// Protocol: { type:"req", id, method, params } / { type:"res", id, ok, payload|error } / { type:"event", event, payload }

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../logger.js';
import { config } from '../config.js';

interface GatewayRequest {
  type: 'req';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface GatewayResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
}

interface GatewayEvent {
  type: 'event';
  event: string;
  payload: unknown;
  seq?: number;
  stateVersion?: number;
}

type GatewayMessage = GatewayResponse | GatewayEvent;

type PendingCallback = (res: GatewayResponse) => void;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingCallback>();
  private eventHandlers = new Map<string, ((payload: unknown) => void)[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private connected = false;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = config.gatewayUrl;
      log(`Connecting to OpenClaw Gateway at ${url}`);

      this.ws = new WebSocket(url, {
        headers: config.gatewayToken
          ? { Authorization: `Bearer ${config.gatewayToken}` }
          : {},
      });

      this.ws.once('open', () => {
        this.connected = true;
        this.reconnectDelay = 2000;
        log('Connected to OpenClaw Gateway');
        resolve();
      });

      this.ws.once('error', (err) => {
        log(`Gateway connection error: ${err.message}`, 'error');
        if (!this.connected) reject(err);
      });

      this.ws.on('message', (raw) => {
        try {
          const msg: GatewayMessage = JSON.parse(raw.toString());
          if (msg.type === 'res') {
            const cb = this.pending.get(msg.id);
            if (cb) {
              this.pending.delete(msg.id);
              cb(msg);
            }
          } else if (msg.type === 'event') {
            const handlers = this.eventHandlers.get(msg.event) ?? [];
            handlers.forEach((h) => h(msg.payload));
          }
        } catch (e) {
          log(`Failed to parse Gateway message: ${e}`, 'warn');
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        log('Gateway connection closed — reconnecting...', 'warn');
        this.scheduleReconnect();
      });
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        this.scheduleReconnect();
      }
    }, this.reconnectDelay);
  }

  /** Send a request and wait for the matching response. */
  request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('Not connected to OpenClaw Gateway'));
        return;
      }

      const id = uuidv4();
      const msg: GatewayRequest = { type: 'req', id, method, params };

      this.pending.set(id, (res) => {
        if (res.ok) resolve(res.payload as T);
        else reject(new Error(res.error ?? 'Gateway request failed'));
      });

      this.ws.send(JSON.stringify(msg));
    });
  }

  /** Register a handler for a Gateway server-push event. */
  on(event: string, handler: (payload: unknown) => void) {
    const handlers = this.eventHandlers.get(event) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  isConnected() {
    return this.connected;
  }

  close() {
    this.ws?.close();
  }
}

export const gateway = new GatewayClient();
