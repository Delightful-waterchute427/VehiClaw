// src/plugin/server.ts
// Express + WebSocket bridge server.
// Serves the car UI static files and proxies voice/text commands to the OpenClaw Gateway.

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../logger.js';
import { config } from '../config.js';
import { validateToken, loadOrCreateToken, printQRCode } from './auth.js';
import { handleUIMessage, UIMessage, UIResponse } from './message-adapter.js';
import { removeSession, getActiveSessions } from './session-store.js';
import { startReminderScheduler, stopReminderScheduler, ReminderBroadcastFn } from '../skills/vehiclaw-reminders/impl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public');

// Per-client connection state
interface Client {
  ws: WebSocket;
  clientId: string;
  authenticated: boolean;
}

const clients = new Map<string, Client>();

// ── Express app ───────────────────────────────────────────────────────────────

export function createServer() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],  // needed for inline car UI scripts
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        mediaSrc: ["'self'"],
      },
    },
  }));

  app.use(cors({ origin: false }));
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      clients: getActiveSessions(),
      gatewayConnected: true,
    });
  });

  // Serve car UI
  app.use(express.static(PUBLIC_DIR));

  // Catch-all: serve index.html for any unknown route (SPA behavior)
  app.get('*', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  return app;
}

// ── WebSocket server ──────────────────────────────────────────────────────────

export function attachWebSocket(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Broadcast function used by the reminder scheduler
  const broadcast: ReminderBroadcastFn = (payload) => {
    clients.forEach(({ ws, authenticated }) => {
      if (authenticated && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    });
  };

  startReminderScheduler(broadcast);

  wss.on('connection', (ws) => {
    const clientId = uuidv4();
    const client: Client = { ws, clientId, authenticated: false };
    clients.set(clientId, client);

    log(`Client connected: ${clientId.slice(0, 8)}`);

    // Auth timeout: disconnect if not authenticated within 10s
    const authTimeout = setTimeout(() => {
      if (!client.authenticated) {
        log(`Client ${clientId.slice(0, 8)} auth timeout — disconnecting`, 'warn');
        ws.close(4001, 'Authentication timeout');
      }
    }, 10000);

    // Send initial status
    send(ws, { type: 'status', state: 'idle' });

    ws.on('message', async (raw) => {
      let msg: UIMessage;
      try {
        msg = JSON.parse(raw.toString()) as UIMessage;
      } catch {
        send(ws, { type: 'error', code: 'PARSE_ERROR', message: 'Invalid JSON' });
        return;
      }

      // Auth handshake
      if (msg.type === 'auth') {
        if (msg.token && validateToken(msg.token)) {
          client.authenticated = true;
          clearTimeout(authTimeout);
          send(ws, { type: 'auth_result', success: true, clientId });
          send(ws, { type: 'status', state: 'idle' });
          log(`Client ${clientId.slice(0, 8)} authenticated`);
        } else {
          send(ws, { type: 'auth_result', success: false });
          ws.close(4003, 'Invalid token');
        }
        return;
      }

      // All other messages require auth
      if (!client.authenticated) {
        send(ws, { type: 'error', code: 'UNAUTHENTICATED', message: 'Authenticate first' });
        return;
      }

      // Inject clientId from server (not trusted from client)
      msg.clientId = clientId;

      // Rate limiting: simple per-client counter
      if (isRateLimited(clientId)) {
        send(ws, { type: 'error', code: 'RATE_LIMITED', message: 'Too many requests' });
        return;
      }

      // Show "thinking" status for voice/text inputs
      if (msg.type === 'voice_input' || msg.type === 'text_input') {
        send(ws, { type: 'status', state: 'thinking' });
      }

      const responses = await handleUIMessage(msg);
      responses.forEach((r) => send(ws, r));
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      clients.delete(clientId);
      removeSession(clientId);
      log(`Client disconnected: ${clientId.slice(0, 8)}`);
    });

    ws.on('error', (err) => {
      log(`WebSocket error for ${clientId.slice(0, 8)}: ${err.message}`, 'error');
    });
  });

  return wss;
}

function send(ws: WebSocket, payload: UIResponse) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

// ── Simple rate limiter ───────────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) return true;
  return false;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export async function startServer(): Promise<void> {
  loadOrCreateToken();

  const app = createServer();
  const server = http.createServer(app);
  attachWebSocket(server);

  await new Promise<void>((resolve) => {
    server.listen(config.port, config.bindHost, () => {
      const host = config.bindHost === '0.0.0.0' ? getLocalIP() : config.bindHost;
      const serverUrl = `http://${host}:${config.port}`;
      log(`VehiClaw server running at ${serverUrl}`);
      printQRCode(serverUrl);
      resolve();
    });
  });

  process.on('SIGTERM', () => {
    stopReminderScheduler();
    server.close();
    process.exit(0);
  });
}

function getLocalIP(): string {
  try {
    const { networkInterfaces } = await import('os');
    // This is sync fallback only — returns placeholder
    return 'YOUR_SERVER_IP';
  } catch {
    return 'YOUR_SERVER_IP';
  }
}
