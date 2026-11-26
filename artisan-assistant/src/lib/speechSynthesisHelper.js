// speechSynthesisHelper.js – robust text‑to‑speech wrapper for Artisan Connect AI
// Provides speak(id, text, lang) with voice loading, fallback handling, stop, and state callbacks.

export const SPEAK_STATES = {
  IDLE: 'idle',
  SPEAKING: 'speaking',
  STOPPED: 'stopped',
  UNSUPPORTED: 'unsupported',
  ERROR: 'error'
};

let voices = [];
let voicesLoaded = false;

function loadVoices(callback) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    voicesLoaded = false;
    callback && callback();
    return;
  }
  const synth = window.speechSynthesis;
  const attempt = () => {
    voices = synth.getVoices();
    if (voices.length) {
      voicesLoaded = true;
      callback && callback();
    } else {
      // Safari/Chrome may need a short delay
      setTimeout(attempt, 100);
    }
  };
  // Listen for the voiceschanged event (fires once voices are ready)
  synth.addEventListener('voiceschanged', () => {
    voices = synth.getVoices();
    voicesLoaded = true;
    callback && callback();
  });
  attempt();
}

export function speak({ id, text, language = 'kn', onStart, onEnd, onError, onFallback }) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError && onError('unsupported');
    return { state: SPEAK_STATES.UNSUPPORTED };
  }
  // Cancel any ongoing speech to avoid overlap
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  const locale = language === 'kn' ? 'kn-IN' : 'en-IN';
  utter.lang = locale;

  // Ensure voices are loaded before picking a voice
  loadVoices(() => {
    if (!voicesLoaded) {
      // No voices available – fallback to default language only
      onFallback && onFallback();
    } else {
      const matched = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(language));
      if (matched) {
        utter.voice = matched;
        utter.lang = matched.lang || locale;
      } else {
        // No matching voice – keep default voice but inform user
        onFallback && onFallback();
      }
    }
    // Event handlers
    utter.onstart = () => onStart && onStart(id);
    utter.onend = () => onEnd && onEnd(id);
    utter.onerror = (e) => onError && onError('synthesis_error', e);
    // Speak
    window.speechSynthesis.speak(utter);
  });
  return { state: SPEAK_STATES.SPEAKING };
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

