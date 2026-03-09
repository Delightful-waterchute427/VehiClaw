// public/js/main.js — VehiClaw app bootstrap
// Wires together: auth, socket, voice engine, wake word, and UI

import { CarSocket } from './socket.js';
import { VoiceEngine } from './voice.js';
import { WakeWordDetector } from './wake-word.js';
import {
  showScreen, showAuthOverlay, hideAuthOverlay,
  setConnectionStatus, setDrivingMode, startClock,
  setInterimTranscript, setUserQuery, showResponse,
  clearCards, showReminderAlert,
} from './ui.js';

// ── State ─────────────────────────────────────────────────────────────────────
const socket  = new CarSocket();
const voice   = new VoiceEngine();
let drivingMode = false;
let wakeWord;

// ── Clock ─────────────────────────────────────────────────────────────────────
startClock();

// ── Auth flow ─────────────────────────────────────────────────────────────────
const savedToken = localStorage.getItem('vehiclaw_token');

if (savedToken) {
  socket.connect(savedToken);
  hideAuthOverlay();
} else {
  showAuthOverlay((token) => {
    localStorage.setItem('vehiclaw_token', token);
    socket.connect(token);
    hideAuthOverlay();
  });
}

socket.on('auth_failed', () => {
  localStorage.removeItem('vehiclaw_token');
  showAuthOverlay((token) => {
    localStorage.setItem('vehiclaw_token', token);
    socket.connect(token);
    hideAuthOverlay();
  });
});

// ── Connection status ──────────────────────────────────────────────────────────
socket.on('auth_result', (msg) => {
  if (msg.success) {
    setConnectionStatus(true);
    showScreen('idle');
    // Start wake word detection after connection
    wakeWord?.start();
  }
});

socket.on('disconnected', () => setConnectionStatus(false));

// ── Incoming messages from server ─────────────────────────────────────────────
socket.on('status', (msg) => {
  switch (msg.state) {
    case 'thinking': showScreen('thinking'); break;
    case 'idle':
      // Only return to idle if no card is displayed
      if (!document.querySelector('.card')) showScreen('idle');
      break;
  }
});

socket.on('speak', (msg) => {
  voice.speak(msg.text, { priority: msg.priority });
});

socket.on('display_card', (msg) => {
  // Merge with any existing spoken text in the response screen
  const spokenEl = document.getElementById('spoken-text');
  showResponse(spokenEl?.textContent || '', msg.card);
});

// Combined: when we get both speak + display_card in quick succession,
// show them together on the response screen
socket.on('*', (msg) => {
  if (msg.type === 'speak') {
    const cardContainer = document.getElementById('card-container');
    const hasCard = cardContainer && cardContainer.children.length > 0;
    if (!hasCard) {
      // Show spoken text on response screen even without a card
      showResponse(msg.text, null);
    } else {
      const spokenEl = document.getElementById('spoken-text');
      if (spokenEl) spokenEl.textContent = msg.text;
    }
  }
});

socket.on('reminder_alert', (msg) => {
  voice.speak(msg.message, { priority: 'urgent' });
  showReminderAlert(msg.message);
});

// ── Voice flow ────────────────────────────────────────────────────────────────
function startListening() {
  if (!voice.isSupported()) {
    console.warn('[VehiClaw] Voice not supported');
    return;
  }

  wakeWord?.pause();
  showScreen('listening');
  setInterimTranscript('');

  voice.startListening();
}

voice.onInterim((text) => {
  setInterimTranscript(text);
});

voice.onTranscript((text) => {
  if (!text) return;
  setUserQuery(text);
  showScreen('thinking');

  // Send to server
  socket.send('voice_input', { text });
  socket.send('set_context', { payload: { drivingMode } });
});

voice.onEnd(() => {
  // If recognition ended without a transcript and we're still on listening screen
  const listeningScreen = document.getElementById('listening-screen');
  if (listeningScreen?.classList.contains('screen--active')) {
    showScreen('idle');
  }
  wakeWord?.resume();
});

voice.onSpeechEnd(() => {
  // After TTS finishes speaking, return to idle after brief pause
  setTimeout(() => {
    const responseScreen = document.getElementById('response-screen');
    if (responseScreen?.classList.contains('screen--active')) {
      const hasCard = document.getElementById('card-container')?.children.length > 0;
      if (!hasCard) showScreen('idle');
    }
    wakeWord?.resume();
  }, 1500);
});

// ── Wake word ─────────────────────────────────────────────────────────────────
wakeWord = new WakeWordDetector(() => {
  if (!voice.isListening()) {
    startListening();
  }
});

// Don't auto-start wake word — wait for connection confirmation (see auth_result handler above)

// ── Mic button ────────────────────────────────────────────────────────────────
const micBtn = document.getElementById('mic-btn');

micBtn?.addEventListener('click', () => {
  if (voice.isListening()) {
    voice.stopListening();
    micBtn.classList.remove('mic-btn--listening');
  } else {
    startListening();
    micBtn.classList.add('mic-btn--listening');
  }
});

// Remove listening class when voice ends
voice.onEnd(() => micBtn?.classList.remove('mic-btn--listening'));

// ── Driving mode toggle ───────────────────────────────────────────────────────
const drivingBtn = document.getElementById('driving-toggle');

drivingBtn?.addEventListener('click', () => {
  drivingMode = !drivingMode;
  setDrivingMode(drivingMode);
  drivingBtn.classList.toggle('ctrl-btn--active', drivingMode);
  socket.setContext(drivingMode, null);

  const msg = drivingMode ? 'Driving mode on.' : 'Driving mode off.';
  voice.speak(msg);
});

// ── Dismiss button ────────────────────────────────────────────────────────────
const dismissBtn = document.getElementById('dismiss-btn');

dismissBtn?.addEventListener('click', () => {
  voice.cancelSpeech();
  clearCards();
  showScreen('idle');
});
