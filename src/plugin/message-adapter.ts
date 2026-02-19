// src/plugin/message-adapter.ts
// Translates between VehiClaw car UI WebSocket protocol and OpenClaw Gateway protocol.

import { v4 as uuidv4 } from 'uuid';
import { gateway } from './gateway-client.js';
import { log } from '../logger.js';
import { config } from '../config.js';
import { getSessionId, setSessionContext, getSessionContext } from './session-store.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CardAction {
  label: string;
  action: string;
  style: 'primary' | 'secondary' | 'danger';
}

export interface CardData {
  cardType:
    | 'navigation'
    | 'weather'
    | 'restaurant_list'
    | 'restaurant_detail'
    | 'calendar_list'
    | 'calendar_new'
    | 'contact_call'
    | 'reminder_set'
    | 'generic';
  title: string;
  subtitle?: string;
  items?: { label: string; sublabel?: string; value?: string }[];
  actions?: CardAction[];
  deeplink?: string;
  imageUrl?: string;
  expiresIn?: number;
}

export interface AgentResponse {
  spokenText: string;
  displayCard?: CardData;
}

export interface UIMessage {
  type: 'voice_input' | 'text_input' | 'set_context' | 'auth' | 'ping' | 'card_action';
  clientId?: string;
  requestId?: string;
  text?: string;
  token?: string;
  payload?: Record<string, unknown>;
  action?: string;
  data?: unknown;
}

export interface UIResponse {
  type: 'speak' | 'display_card' | 'status' | 'auth_result' | 'reminder_alert' | 'pong' | 'error';
  requestId?: string;
  text?: string;
  priority?: 'normal' | 'urgent';
  card?: CardData;
  state?: 'listening' | 'thinking' | 'speaking' | 'idle' | 'error';
  success?: boolean;
  clientId?: string;
  message?: string;
  code?: string;
}

// ── Core adapter ──────────────────────────────────────────────────────────────

/**
 * Process a message from the car UI, route it through OpenClaw Gateway,
 * and return the responses to send back to the UI.
 */
export async function handleUIMessage(msg: UIMessage): Promise<UIResponse[]> {
  switch (msg.type) {
    case 'ping':
      return [{ type: 'pong' }];

    case 'set_context': {
      if (msg.clientId && msg.payload) {
        setSessionContext(msg.clientId, msg.payload as { drivingMode?: boolean; location?: { lat: number; lng: number } });
      }
      return [];
    }

    case 'voice_input':
    case 'text_input': {
      if (!msg.text || !msg.clientId) {
        return [{ type: 'error', code: 'MISSING_FIELDS', message: 'text and clientId required' }];
      }
      return await routeToAgent(msg.clientId, msg.text, msg.requestId ?? uuidv4());
    }

    case 'card_action': {
      if (msg.action === 'open_deeplink' && msg.data) {
        // Deeplinks are opened client-side; server just acknowledges
        return [];
      }
      return [];
    }

    default:
      return [{ type: 'error', code: 'UNKNOWN_TYPE', message: `Unknown message type: ${msg.type}` }];
  }
}

// ── Agent routing ─────────────────────────────────────────────────────────────

async function routeToAgent(clientId: string, text: string, requestId: string): Promise<UIResponse[]> {
  const sessionCtx = getSessionContext(clientId);
  const sessionId = await getSessionId(clientId);

  // Build context string injected into the agent prompt
  const now = new Date().toLocaleString('en-US', { timeZone: config.userTimezone });
  const contextNote = [
    `drivingMode: ${sessionCtx.drivingMode}`,
    `userName: ${config.userName}`,
    `localTime: ${now}`,
    `locationCity: ${sessionCtx.location ? `${sessionCtx.location.lat.toFixed(2)},${sessionCtx.location.lng.toFixed(2)}` : config.locationCity}`,
    `timezone: ${config.userTimezone}`,
  ].join(' | ');

  const augmentedText = `[Context: ${contextNote}]\n${text}`;

  try {
    // Ask OpenClaw Gateway to invoke the agent for this session
    const result = await gateway.request<{ content: string }>('agent.invoke', {
      sessionId,
      message: augmentedText,
      agentsFile: 'AGENTS.md',
      soulFile: 'SOUL.md',
    });

    return parseAgentResult(result.content, requestId);
  } catch (err) {
    log(`Agent invocation failed: ${err}`, 'error');
    return [
      { type: 'speak', text: "Something went wrong. Try again in a moment.", priority: 'normal', requestId },
      { type: 'status', state: 'idle' },
    ];
  }
}

function parseAgentResult(content: string, requestId: string): UIResponse[] {
  const responses: UIResponse[] = [];

  try {
    // Agent should return JSON per AGENTS.md format
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in agent response');

    const parsed: AgentResponse = JSON.parse(jsonMatch[0]);

    if (parsed.spokenText) {
      responses.push({ type: 'speak', text: parsed.spokenText, priority: 'normal', requestId });
    }
    if (parsed.displayCard) {
      responses.push({ type: 'display_card', card: parsed.displayCard, requestId });
    }
  } catch {
    // Fallback: treat entire content as spoken text, truncate to 2 sentences
    const sentences = content.split(/[.!?]+/).filter(Boolean);
    const spoken = sentences.slice(0, 2).join('. ').trim() + '.';
    responses.push({ type: 'speak', text: spoken, priority: 'normal', requestId });
  }

  responses.push({ type: 'status', state: 'idle' });
  return responses;
}
