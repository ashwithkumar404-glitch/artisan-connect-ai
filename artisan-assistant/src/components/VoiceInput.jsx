// VoiceInput.jsx - Reusable microphone input component for Artisan Connect AI
// Provides speech‑to‑text using the robust createVoiceSession manager.
// Displays clear recording state, handles permission errors, unsupported browsers,
// empty speech, and allows the user to edit the recognised text before sending.

import React, { useEffect, useState, useRef } from 'react';
import { createVoiceSession, VOICE_STATES, getVoiceStatusMessage } from '../lib/voiceRecognition';
import { isKannadaText } from '../lib/kannadaTranslator';

/**
 * Props
 *  - language: 'kn' | 'en'
 *  - value: current text value (controlled)
 *  - onChange: (newText) => void
 *  - placeholder: input placeholder
 *  - disabled: optional flag
 */
export default function VoiceInput({ language = 'kn', value, onChange, placeholder, disabled }) {
  const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const sessionRef = useRef(null);

  const isRecording = voiceState === VOICE_STATES.LISTENING ||
    voiceState === VOICE_STATES.REQUESTING_PERMISSION ||
    voiceState === VOICE_STATES.PROCESSING;

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop();
      }
    };
  }, []);

  const startVoice = async () => {
    if (disabled) return;
    // Ensure any previous session is stopped
    if (sessionRef.current) {
      sessionRef.current.stop();
    }
    const session = createVoiceSession({
      language,
      onStateChange: (state, details) => {
        setVoiceState(state);
        if (details?.secondsElapsed !== undefined) setSeconds(details.secondsElapsed);
      },
      onInterimResult: (interim, combined) => {
        setLiveTranscript(combined);
      },
      onFinalTranscript: (final) => {
        // Insert final transcript into the controlled input
        const newText = (value ? value + ' ' : '') + final.trim();
        onChange(newText.trim());
        setLiveTranscript('');
        setVoiceState(VOICE_STATES.IDLE);
      },
      onError: (reason, event) => {
        let msg = '';
        if (reason === 'no_speech') msg = isKannadaText ? '🔊 ಯಾವುದೇ ಧ್ವನಿ ಕಣ್ಮನಸ್ಸು ಕಂಡುಬರಲಿಲ್ಲ.' : '🔊 No speech detected.';
        else if (reason === 'permission_denied') msg = isKannadaText ? '⚠️ ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ನಿರಾಕರಿಸಲಾಯಿತು.' : '⚠️ Microphone permission denied.';
        else msg = isKannadaText ? '⚠️ ಧ್ವನಿ ಗುರುತಿಸುವಲ್ಲಿ ದೋಷ.' : '⚠️ Voice recognition error.';
        alert(msg);
        setVoiceState(VOICE_STATES.IDLE);
      }
    });
    sessionRef.current = session;
    await session.start();
  };

  const stopVoice = async () => {
    if (sessionRef.current) {
      await sessionRef.current.stop();
    }
    setVoiceState(VOICE_STATES.IDLE);
    setLiveTranscript('');
  };

  const toggle = () => {
    if (isRecording) {
      stopVoice();
    } else {
      startVoice();
    }
  };

  const statusMessage = getVoiceStatusMessage(voiceState, language, { secondsElapsed: seconds });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border)' }}
      />
      <button
        onClick={toggle}
        disabled={disabled}
        title={isRecording ? (language === 'kn' ? 'ಧ್ವನಿ ನಿಲ್ಲಿಸಿ' : 'Stop recording') : (language === 'kn' ? 'ಮೈಕ್ರೊಫೋನ್ ಆರಂಭಿಸಿ' : 'Start microphone')}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
      >
        {isRecording ? '⏹' : '🎙️'}
      </button>
      {isRecording && (
        <span style={{ fontSize: '0.85rem', color: 'var(--secondary-text)' }}>
          {statusMessage || `${seconds}s`}
        </span>
      )}
    </div>
  );
}

