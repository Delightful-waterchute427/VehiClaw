// public/js/voice.js — Web Speech API wrapper (STT + TTS)

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const SS = window.speechSynthesis;

export class VoiceEngine {
  constructor() {
    this._recognition = SR ? new SR() : null;
    this._listening = false;
    this._onTranscript = null;
    this._onInterim = null;
    this._onEnd = null;
    this._onSpeechEnd = null;
    this._preferredVoice = null;

    if (this._recognition) {
      this._setupRecognition();
    } else {
      console.warn('[VehiClaw] SpeechRecognition not supported on this browser');
    }

    this._loadVoice();
  }

  _setupRecognition() {
    const r = this._recognition;
    r.lang = 'en-US';
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.continuous = false;  // Single utterance mode for better reliability

    r.addEventListener('result', (event) => {
      let interim = '';
      let final = '';

      for (const result of event.results) {
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim && this._onInterim) this._onInterim(interim);
      if (final && this._onTranscript) this._onTranscript(final.trim());
    });

    r.addEventListener('end', () => {
      this._listening = false;
      if (this._onEnd) this._onEnd();
    });

    r.addEventListener('error', (event) => {
      this._listening = false;
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[VehiClaw] SpeechRecognition error:', event.error);
      }
      if (this._onEnd) this._onEnd();
    });
  }

  _loadVoice() {
    const pickVoice = () => {
      const voices = SS.getVoices();
      // Prefer a clear English voice
      this._preferredVoice =
        voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
        voices.find(v => v.lang === 'en-US' && !v.localService) ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0] ||
        null;
    };

    if (SS.getVoices().length) {
      pickVoice();
    } else {
      SS.addEventListener('voiceschanged', pickVoice, { once: true });
    }
  }

  startListening() {
    if (!this._recognition || this._listening) return;
    // Cancel any ongoing speech before listening
    SS.cancel();

    try {
      this._recognition.start();
      this._listening = true;
    } catch (e) {
      console.warn('[VehiClaw] Could not start recognition:', e);
    }
  }

  stopListening() {
    if (!this._listening) return;
    this._recognition?.stop();
    this._listening = false;
  }

  speak(text, { priority = 'normal', rate = 1.0, pitch = 1.0 } = {}) {
    if (!SS) return;

    // High priority: cancel current speech
    if (priority === 'urgent') SS.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1.0;
    if (this._preferredVoice) utterance.voice = this._preferredVoice;

    utterance.addEventListener('end', () => {
      if (this._onSpeechEnd) this._onSpeechEnd();
    });

    utterance.addEventListener('error', (e) => {
      console.warn('[VehiClaw] TTS error:', e.error);
      if (this._onSpeechEnd) this._onSpeechEnd();
    });

    SS.speak(utterance);
  }

  cancelSpeech() {
    SS.cancel();
  }

  onTranscript(cb)  { this._onTranscript = cb; }
  onInterim(cb)     { this._onInterim = cb; }
  onEnd(cb)         { this._onEnd = cb; }
  onSpeechEnd(cb)   { this._onSpeechEnd = cb; }

  isListening()     { return this._listening; }
  isSupported()     { return !!this._recognition; }
}
