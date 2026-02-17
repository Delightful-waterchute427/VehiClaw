// src/plugin/session-store.ts
// In-memory session store: maps car UI clientIds to OpenClaw session IDs and context.

import { v4 as uuidv4 } from 'uuid';
import { gateway } from './gateway-client.js';
import { log } from '../logger.js';

interface SessionContext {
  drivingMode: boolean;
  location?: { lat: number; lng: number };
  connectedAt: Date;
}

const sessions = new Map<string, string>();           // clientId → OpenClaw sessionId
const contexts = new Map<string, SessionContext>();   // clientId → driving context

/** Get or create an OpenClaw session ID for a car UI client. */
export async function getSessionId(clientId: string): Promise<string> {
  const existing = sessions.get(clientId);
  if (existing) return existing;

  try {
    const result = await gateway.request<{ sessionId: string }>('sessions.create', {
      name: `vehiclaw-${clientId.slice(0, 8)}`,
      metadata: { source: 'vehiclaw-car-ui' },
    });
    sessions.set(clientId, result.sessionId);
    log(`Created OpenClaw session ${result.sessionId} for client ${clientId.slice(0, 8)}`);
    return result.sessionId;
  } catch (err) {
    // Gateway unavailable — use a local fallback session ID
    const fallback = `local-${uuidv4()}`;
    sessions.set(clientId, fallback);
    log(`Gateway unavailable, using local session ${fallback}`, 'warn');
    return fallback;
  }
}

export function setSessionContext(clientId: string, update: Partial<SessionContext>) {
  const existing = contexts.get(clientId) ?? { drivingMode: false, connectedAt: new Date() };
  contexts.set(clientId, { ...existing, ...update });
}

export function getSessionContext(clientId: string): SessionContext {
  return contexts.get(clientId) ?? { drivingMode: false, connectedAt: new Date() };
}

export function removeSession(clientId: string) {
  sessions.delete(clientId);
  contexts.delete(clientId);
}

export function getActiveSessions(): number {
  return sessions.size;
}
