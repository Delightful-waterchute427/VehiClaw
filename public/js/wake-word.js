// public/js/wake-word.js — Software wake word detection ("hey claw")
// Uses continuous SpeechRecognition listening for the trigger phrase.
// Low-overhead: only activates the full VoiceEngine when wake word is detected.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

const WAKE_WORDS = ['hey claw', 'hey claw,', 'hey clawed', 'vehiclaw', 'veh claw'];

export class WakeWordDetector {
  constructor(onWake) {
    this._onWake = onWake;
    this._recognition = null;
    this._active = false;
    this._paused = false;

    if (!SR) {
      console.warn('[WakeWord] SpeechRecognition not supported');
      return;
    }

    this._setup();
  }

  _setup() {
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.continuous = true;

    r.addEventListener('result', (event) => {
      if (this._paused) return;

      // Collect all transcripts from this event
      let transcript = '';
      for (const result of event.results) {
        transcript += result[0].transcript.toLowerCase();
      }

      if (WAKE_WORDS.some(w => transcript.includes(w))) {
        console.log('[WakeWord] Wake word detected');
        this._onWake();
        // Brief pause to avoid double-trigger
        this._paused = true;
        setTimeout(() => { this._paused = false; }, 3000);
      }
    });

    r.addEventListener('end', () => {
      // Automatically restart continuous listening
      if (this._active) {
        setTimeout(() => {
          try { r.start(); } catch { /* already started */ }
        }, 500);
      }
    });

    r.addEventListener('error', (event) => {
      if (event.error === 'not-allowed') {
        console.warn('[WakeWord] Microphone permission denied');
        this._active = false;
        return;
      }
      // Other errors: retry
      if (this._active) {
        setTimeout(() => {
          try { r.start(); } catch { /* ok */ }
        }, 1000);
      }
    });

    this._recognition = r;
  }

  start() {
    if (!this._recognition || this._active) return;
    this._active = true;
    try {
      this._recognition.start();
      console.log('[WakeWord] Listening for "Hey Claw"');
    } catch (e) {
      console.warn('[WakeWord] Could not start:', e);
    }
  }

  stop() {
    this._active = false;
    this._recognition?.stop();
  }

  /** Temporarily suspend wake word detection (e.g. while VoiceEngine is active) */
  pause() { this._paused = true; }
  resume() { this._paused = false; }
}
