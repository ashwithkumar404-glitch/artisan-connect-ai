// voiceRecognition.js - Robust Speech-to-Text Manager for Artisan Connect AI
// Provides predictable state transitions, dual-engine coordination (Web Speech API + MediaRecorder),
// interim result aggregation without word duplication, and backend transcription fallback.

export const VOICE_STATES = {
  IDLE: 'idle',
  REQUESTING_PERMISSION: 'requesting_permission',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  TRANSCRIPT_READY: 'transcript_ready',
  UNSUPPORTED: 'unsupported',
  PERMISSION_DENIED: 'permission_denied',
  RECOGNITION_FAILED: 'recognition_failed',
};

/**
 * Determine client capabilities in a browser environment.
 * @param {object} [customWindow] - Window object for dependency injection in tests.
 */
export function checkVoiceCapability(customWindow = null) {
  const win = customWindow || (typeof window !== 'undefined' ? window : null);
  if (!win) {
    return {
      isSecureContext: false,
      hasSpeechRecognition: false,
      hasMediaRecorder: false,
      hasGetUserMedia: false,
      preferredMode: 'unsupported',
    };
  }

  const isLocalhost = win.location?.hostname === 'localhost' ||
    win.location?.hostname === '127.0.0.1' ||
    win.location?.hostname === '[::1]';
  const isSecure = win.isSecureContext === true ||
    win.location?.protocol === 'https:' ||
    isLocalhost;

  const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
  const hasSpeechRecognition = Boolean(SpeechRec);

  const hasMediaRecorder = Boolean(win.MediaRecorder);
  const hasGetUserMedia = Boolean(win.navigator?.mediaDevices?.getUserMedia);

  let preferredMode = 'unsupported';
  if (hasSpeechRecognition) {
    preferredMode = 'speech_recognition';
  } else if (hasMediaRecorder && hasGetUserMedia) {
    preferredMode = 'media_recorder_fallback';
  }

  return {
    isSecureContext: isSecure,
    hasSpeechRecognition,
    hasMediaRecorder,
    hasGetUserMedia,
    preferredMode,
  };
}

/**
 * Maps short language codes ('kn', 'en') to standard BCP-47 locale tags.
 */
export function mapLanguageLocale(lang) {
  if (lang === 'kn') return 'kn-IN';
  if (lang === 'en') return 'en-IN';
  return lang || 'kn-IN';
}

/**
 * Cleanly combines Web Speech API results list without word duplication.
 * @param {SpeechRecognitionResultList} results
 * @returns {{ finalTranscript: string, interimTranscript: string }}
 */
export function combineSpeechResults(results) {
  if (!results || results.length === 0) {
    return { finalTranscript: '', interimTranscript: '' };
  }

  let finalTranscript = '';
  let interimTranscript = '';

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const text = item[0]?.transcript ? item[0].transcript.trim() : '';
    if (!text) continue;

    if (item.isFinal) {
      finalTranscript += (finalTranscript ? ' ' : '') + text;
    } else {
      interimTranscript += (interimTranscript ? ' ' : '') + text;
    }
  }

  return {
    finalTranscript: finalTranscript.trim(),
    interimTranscript: interimTranscript.trim(),
  };
}

/**
 * Returns localized user messages for each voice state and error condition.
 */
export function getVoiceStatusMessage(state, language = 'kn', details = {}) {
  const isKn = language === 'kn';

  switch (state) {
    case VOICE_STATES.IDLE:
      return '';

    case VOICE_STATES.REQUESTING_PERMISSION:
      return isKn
        ? '🎙️ ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ಪಡೆಯಲಾಗುತ್ತಿದೆ...'
        : '🎙️ Requesting microphone permission...';

    case VOICE_STATES.LISTENING:
      return isKn
        ? '👂 ಕೇಳಿಸಿಕೊಳ್ಳಲಾಗುತ್ತಿದೆ... ನಿಮ್ಮ ಉತ್ಪನ್ನದ ಬಗ್ಗೆ ಮುಕ್ತವಾಗಿ ಮಾತನಾಡಿ'
        : '👂 Listening... Describe your product freely';

    case VOICE_STATES.PROCESSING:
      return isKn
        ? '⏳ ಧ್ವನಿ ವಿವರಣೆಯನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲಾಗುತ್ತಿದೆ...'
        : '⏳ Processing voice description...';

    case VOICE_STATES.TRANSCRIPT_READY:
      return isKn
        ? '✅ ಧ್ವನಿ ವಿವರಣೆ ಯಶಸ್ವಿಯಾಗಿ ನಮೂದಾಗಿದೆ!'
        : '✅ Voice description successfully transcribed!';

    case VOICE_STATES.UNSUPPORTED:
      if (details.reason === 'insecure_context') {
        return isKn
          ? '⚠️ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆಗೆ ಸುರಕ್ಷಿತ ಸಂಪರ್ಕ (HTTPS ಅಥವಾ localhost) ಅಗತ್ಯವಿದೆ.'
          : '⚠️ Voice recognition requires a secure connection (HTTPS or localhost).';
      }
      return isKn
        ? '⚠️ ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಸ್ವಯಂಚಾಲಿತ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು Google Chrome ಅಥವಾ Microsoft Edge ಬಳಸಿ, ಅಥವಾ ಕೆಳಗಿನ ಸಂದೇಶ ಪೆಟ್ಟಿಗೆಯಲ್ಲಿ ವಿವರಣೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ.'
        : '⚠️ Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge, or type your description in the box below.';

    case VOICE_STATES.PERMISSION_DENIED:
      return isKn
        ? '⚠️ ಮೈಕ್ರೊಫೋನ್ ಪ್ರವೇಶವನ್ನು ನಿರಾಕರಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿಯನ್ನು ನೀಡಿ, ಅಥವಾ ವಿವರಣೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ.'
        : '⚠️ Microphone access was denied. Please allow microphone permission in browser settings, or type your description.';

    case VOICE_STATES.RECOGNITION_FAILED:
      if (details.reason === 'no_speech') {
        return isKn
          ? '⚠️ ಯಾವುದೇ ಧ್ವನಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮೈಕ್ರೊಫೋನ್ ಬಟನ್ ಒತ್ತಿ ಮತ್ತೊಮ್ಮೆ ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಿ.'
          : '⚠️ No speech was detected. Please tap the microphone and speak clearly.';
      }
      if (details.reason === 'network') {
        return isKn
          ? '⚠️ ನೆಟ್‌ವರ್ಕ್ ದೋಷದಿಂದ ಧ್ವನಿ ಗುರುತಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.'
          : '⚠️ Network error during voice recognition. Please check your internet connection and try again.';
      }
      return isKn
        ? '⚠️ ಧ್ವನಿ ಗುರುತಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮೈಕ್ರೊಫೋನ್ ಬಟನ್ ಒತ್ತಿ ಮತ್ತೊಮ್ಮೆ ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಿ, ಅಥವಾ ವಿವರಣೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ.'
        : '⚠️ Could not recognize voice. Please tap the microphone and speak clearly, or type your description.';

    default:
      return '';
  }
}

/**
 * Creates and manages a voice recording / speech recognition session.
 */
export function createVoiceSession({
  language = 'kn',
  onStateChange = () => {},
  onInterimResult = () => {},
  onFinalTranscript = () => {},
  onError = () => {},
  backendTranscribe = null,
  customWindow = null,
  maxDurationSeconds = 60,
} = {}) {
  const win = customWindow || (typeof window !== 'undefined' ? window : null);
  const locale = mapLanguageLocale(language);

  let currentState = VOICE_STATES.IDLE;
  let recognition = null;
  let mediaRecorder = null;
  let mediaStream = null;
  let audioChunks = [];
  let timerInterval = null;
  let secondsElapsed = 0;
  let isStoppedByUser = false;
  let accumulatedFinalText = '';
  let lastInterimText = '';
  let capturedAudioBlob = null;
  let capturedAudioUrl = '';

  function setState(newState, details = {}) {
    currentState = newState;
    onStateChange(newState, { ...details, language, secondsElapsed });
  }

  function cleanupTimersAndStreams() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach((track) => track.stop());
      } catch {}
      mediaStream = null;
    }
  }

  /**
   * Start the voice recognition session.
   */
  async function start() {
    isStoppedByUser = false;
    accumulatedFinalText = '';
    lastInterimText = '';
    audioChunks = [];
    capturedAudioBlob = null;
    capturedAudioUrl = '';
    secondsElapsed = 0;

    const capabilities = checkVoiceCapability(win);

    if (!capabilities.isSecureContext) {
      setState(VOICE_STATES.UNSUPPORTED, { reason: 'insecure_context' });
      return;
    }

    if (capabilities.preferredMode === 'unsupported') {
      setState(VOICE_STATES.UNSUPPORTED, { reason: 'no_apis' });
      return;
    }

    setState(VOICE_STATES.REQUESTING_PERMISSION);

    // Attempt to acquire mediaStream for MediaRecorder (preserves audio preview/fallback)
    let streamAcquired = false;
    if (capabilities.hasGetUserMedia && win?.navigator?.mediaDevices?.getUserMedia) {
      try {
        mediaStream = await win.navigator.mediaDevices.getUserMedia({ audio: true });
        streamAcquired = true;
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setState(VOICE_STATES.PERMISSION_DENIED, { error: err });
          return;
        }
        console.warn('getUserMedia warning:', err);
      }
    }

    // PATH A: Native Web Speech API available
    if (capabilities.hasSpeechRecognition) {
      try {
        const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
        recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = locale;

        recognition.onstart = () => {
          setState(VOICE_STATES.LISTENING);
        };

        recognition.onresult = (event) => {
          const { finalTranscript, interimTranscript } = combineSpeechResults(event.results);
          if (finalTranscript) {
            accumulatedFinalText = finalTranscript;
          }
          lastInterimText = interimTranscript;
          const displayCombined = (accumulatedFinalText + (interimTranscript ? ' ' + interimTranscript : '')).trim();
          onInterimResult(interimTranscript, displayCombined);
        };

        recognition.onerror = (event) => {
          console.warn('SpeechRecognition error:', event.error);
          if (event.error === 'not-allowed') {
            setState(VOICE_STATES.PERMISSION_DENIED, { error: event.error });
          } else if (event.error === 'no-speech') {
            // If we already accumulated text, do not treat no-speech as failure
            if (!accumulatedFinalText.trim()) {
              onError('no_speech', event);
            }
          } else if (event.error === 'network') {
            onError('network', event);
          }
        };

        recognition.onend = async () => {
          // If stopped by user, finalize
          if (isStoppedByUser || currentState === VOICE_STATES.PROCESSING) {
            await finalizeSession();
          } else if (currentState === VOICE_STATES.LISTENING) {
            // Browser ended prematurely (e.g. pause in speech); if still listening, don't crash
            // If text was accumulated, finalize it
            if (accumulatedFinalText.trim()) {
              await finalizeSession();
            }
          }
        };

        // Also start MediaRecorder if stream was acquired to preserve raw audio
        if (streamAcquired && capabilities.hasMediaRecorder && win.MediaRecorder) {
          try {
            mediaRecorder = new win.MediaRecorder(mediaStream);
            mediaRecorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) audioChunks.push(e.data);
            };
            mediaRecorder.start(250);
          } catch (recErr) {
            console.warn('Optional MediaRecorder start failed:', recErr);
          }
        }

        recognition.start();

        // Start elapsed timer
        timerInterval = setInterval(() => {
          secondsElapsed += 1;
          if (secondsElapsed >= maxDurationSeconds) {
            stop();
          }
        }, 1000);

        return;
      } catch (initErr) {
        console.warn('SpeechRecognition start failed:', initErr);
        // Fall back to MediaRecorder path if available
      }
    }

    // PATH B: MediaRecorder Fallback (SpeechRecognition not available)
    if (streamAcquired && capabilities.hasMediaRecorder && win?.MediaRecorder) {
      try {
        mediaRecorder = new win.MediaRecorder(mediaStream);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunks.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          await finalizeSession();
        };

        mediaRecorder.start(250);
        setState(VOICE_STATES.LISTENING);

        timerInterval = setInterval(() => {
          secondsElapsed += 1;
          if (secondsElapsed >= maxDurationSeconds) {
            stop();
          }
        }, 1000);

        return;
      } catch (recErr) {
        setState(VOICE_STATES.RECOGNITION_FAILED, { error: recErr, reason: 'recorder_failed' });
        cleanupTimersAndStreams();
        return;
      }
    }

    setState(VOICE_STATES.UNSUPPORTED, { reason: 'no_recorder' });
  }

  /**
   * Stop the session gracefully.
   */
  async function stop() {
    if (isStoppedByUser || currentState === VOICE_STATES.PROCESSING || currentState === VOICE_STATES.IDLE) {
      return;
    }
    isStoppedByUser = true;
    setState(VOICE_STATES.PROCESSING);

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // Stop recognition
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
    }

    // Stop MediaRecorder
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch {}
    }

    // Safety timeout: If neither onend nor onstop triggers within 1.5s, force finalization
    setTimeout(async () => {
      if (currentState === VOICE_STATES.PROCESSING) {
        await finalizeSession();
      }
    }, 1500);
  }

  /**
   * Cancel and discard the current session immediately.
   */
  function cancel() {
    isStoppedByUser = true;
    if (recognition) {
      try { recognition.abort(); } catch {}
      recognition = null;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch {}
      mediaRecorder = null;
    }
    cleanupTimersAndStreams();
    audioChunks = [];
    accumulatedFinalText = '';
    lastInterimText = '';
    setState(VOICE_STATES.IDLE);
  }

  /**
   * Finalize transcription results and notify callbacks.
   */
  async function finalizeSession() {
    // Prevent double finalization
    if (currentState === VOICE_STATES.TRANSCRIPT_READY ||
        currentState === VOICE_STATES.RECOGNITION_FAILED ||
        currentState === VOICE_STATES.PERMISSION_DENIED) {
      return;
    }

    cleanupTimersAndStreams();

    // Package audio blob if chunks exist
    if (audioChunks.length > 0) {
      try {
        const mime = mediaRecorder?.mimeType || 'audio/webm';
        capturedAudioBlob = new Blob(audioChunks, { type: mime });
        if (win?.URL?.createObjectURL) {
          capturedAudioUrl = win.URL.createObjectURL(capturedAudioBlob);
        }
      } catch (blobErr) {
        console.warn('Audio blob packaging note:', blobErr);
      }
    }

    // Determine final recognized text from browser speech recognition
    let finalSpeech = accumulatedFinalText.trim();
    if (!finalSpeech && lastInterimText.trim()) {
      // If final event was not dispatched but interim text is present, capture it
      finalSpeech = lastInterimText.trim();
    }

    // If SpeechRecognition produced a valid transcript
    if (finalSpeech) {
      setState(VOICE_STATES.TRANSCRIPT_READY, { transcript: finalSpeech });
      onFinalTranscript(finalSpeech, capturedAudioBlob, capturedAudioUrl);
      return;
    }

    // If SpeechRecognition produced no text, but we have an audio blob & backendTranscribe is provided
    if (capturedAudioBlob && typeof backendTranscribe === 'function') {
      try {
        const backendResult = await backendTranscribe(capturedAudioBlob, language);
        if (backendResult && backendResult.trim()) {
          const cleanBackendText = backendResult.trim();
          setState(VOICE_STATES.TRANSCRIPT_READY, { transcript: cleanBackendText, provider: 'backend' });
          onFinalTranscript(cleanBackendText, capturedAudioBlob, capturedAudioUrl);
          return;
        }
      } catch (backendErr) {
        console.warn('Backend transcription fallback returned:', backendErr);
      }
    }

    // If no valid text was produced by either engine
    setState(VOICE_STATES.RECOGNITION_FAILED, {
      reason: 'no_speech',
      audioBlob: capturedAudioBlob,
      audioUrl: capturedAudioUrl,
    });
    onError('no_speech', { audioBlob: capturedAudioBlob, audioUrl: capturedAudioUrl });
  }

  return {
    start,
    stop,
    cancel,
    getState: () => currentState,
    getSecondsElapsed: () => secondsElapsed,
  };
}
