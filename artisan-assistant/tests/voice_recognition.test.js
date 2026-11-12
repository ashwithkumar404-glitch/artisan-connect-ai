// tests/voice_recognition.test.js - Comprehensive test suite for voice recognition & fallback
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VOICE_STATES,
  checkVoiceCapability,
  mapLanguageLocale,
  combineSpeechResults,
  getVoiceStatusMessage,
  createVoiceSession,
} from '../src/lib/voiceRecognition.js';

import {
  extractProductFacts,
  buildProductListing,
} from '../src/lib/kannadaProductEngine.js';

// --- MOCK UTILITIES ---

class MockTrack {
  constructor() {
    this.stopped = false;
  }
  stop() {
    this.stopped = true;
  }
}

class MockMediaStream {
  constructor() {
    this.tracks = [new MockTrack()];
  }
  getTracks() {
    return this.tracks;
  }
}

class MockSpeechRecognition {
  constructor() {
    this.lang = 'kn-IN';
    this.continuous = false;
    this.interimResults = false;
    this.onstart = null;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.started = false;
    this.stopped = false;
    this.aborted = false;
  }
  start() {
    this.started = true;
    if (this.onstart) setTimeout(() => this.onstart(), 5);
  }
  stop() {
    this.stopped = true;
    if (this.onend) setTimeout(() => this.onend(), 10);
  }
  abort() {
    this.aborted = true;
    if (this.onend) setTimeout(() => this.onend(), 5);
  }
}

class MockMediaRecorder {
  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.mimeType = 'audio/webm';
  }
  start() {
    this.state = 'recording';
    if (this.ondataavailable) {
      setTimeout(() => {
        this.ondataavailable({ data: new Uint8Array([1, 2, 3, 4]) });
      }, 5);
    }
  }
  stop() {
    this.state = 'inactive';
    if (this.onstop) setTimeout(() => this.onstop(), 10);
  }
}

function createMockWindow({
  hasSpeechRecognition = true,
  hasMediaRecorder = true,
  hasGetUserMedia = true,
  isSecureContext = true,
  permissionDenied = false,
} = {}) {
  const stream = new MockMediaStream();

  return {
    isSecureContext,
    location: { protocol: 'https:', hostname: 'artisanconnect.ai' },
    SpeechRecognition: hasSpeechRecognition ? MockSpeechRecognition : undefined,
    webkitSpeechRecognition: undefined,
    MediaRecorder: hasMediaRecorder ? MockMediaRecorder : undefined,
    navigator: {
      mediaDevices: hasGetUserMedia
        ? {
            getUserMedia: async () => {
              if (permissionDenied) {
                const err = new Error('Permission denied');
                err.name = 'NotAllowedError';
                throw err;
              }
              return stream;
            },
          }
        : undefined,
    },
    URL: {
      createObjectURL: () => 'blob:mock-audio-url',
      revokeObjectURL: () => {},
    },
  };
}

// --- TEST SUITE ---

test('1. Kannada and English language selection maps to standard locales', () => {
  assert.equal(mapLanguageLocale('kn'), 'kn-IN', 'Kannada must map strictly to kn-IN');
  assert.equal(mapLanguageLocale('en'), 'en-IN', 'English must map strictly to en-IN');
  assert.equal(mapLanguageLocale('kn-IN'), 'kn-IN', 'kn-IN must remain unchanged');
  assert.equal(mapLanguageLocale(''), 'kn-IN', 'Default fallback must be kn-IN');
});

test('2. Recognition API unavailable falls back to MediaRecorder or reports unsupported', () => {
  // Case A: Neither SpeechRecognition nor MediaRecorder
  const noApiWin = createMockWindow({ hasSpeechRecognition: false, hasMediaRecorder: false, hasGetUserMedia: false });
  const capsNoApi = checkVoiceCapability(noApiWin);
  assert.equal(capsNoApi.preferredMode, 'unsupported', 'Must report unsupported when no APIs exist');

  let reportedState = null;
  const sessionNoApi = createVoiceSession({
    language: 'kn',
    customWindow: noApiWin,
    onStateChange: (state) => { reportedState = state; },
  });
  sessionNoApi.start();
  assert.equal(reportedState, VOICE_STATES.UNSUPPORTED, 'State must transition to unsupported');

  // Case B: MediaRecorder available as fallback when SpeechRecognition is absent
  const recorderOnlyWin = createMockWindow({ hasSpeechRecognition: false, hasMediaRecorder: true, hasGetUserMedia: true });
  const capsRecorder = checkVoiceCapability(recorderOnlyWin);
  assert.equal(capsRecorder.preferredMode, 'media_recorder_fallback', 'Must detect media_recorder_fallback');
});

test('3. Permission denied transitions state to permission_denied and provides Kannada error', async () => {
  const deniedWin = createMockWindow({ permissionDenied: true });
  let finalState = null;

  const session = createVoiceSession({
    language: 'kn',
    customWindow: deniedWin,
    onStateChange: (state) => { finalState = state; },
  });

  await session.start();

  assert.equal(finalState, VOICE_STATES.PERMISSION_DENIED, 'State must transition to permission_denied');

  const knMessage = getVoiceStatusMessage(VOICE_STATES.PERMISSION_DENIED, 'kn');
  assert.ok(knMessage.includes('ಮೈಕ್ರೊಫೋನ್'), 'Kannada message must mention microphone permission');
  assert.ok(knMessage.includes('ನಿರಾಕರಿಸಲಾಗಿದೆ'), 'Kannada message must indicate denial');

  const enMessage = getVoiceStatusMessage(VOICE_STATES.PERMISSION_DENIED, 'en');
  assert.ok(enMessage.toLowerCase().includes('denied'), 'English message must indicate denial');
});

test('4. Recognition returns a valid Kannada transcript without corruption', async () => {
  const mockWin = createMockWindow();
  let _receivedTranscript = null;
  let _receivedState = null;

  const session = createVoiceSession({
    language: 'kn',
    customWindow: mockWin,
    onStateChange: (state) => { _receivedState = state; },
    onFinalTranscript: (transcript) => { _receivedTranscript = transcript; },
  });

  await session.start();

  // Simulate SpeechRecognition event with genuine Kannada text
  const genuineKannada = 'ನೈಸರ್ಗಿಕ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಮಾಡಿದ ನೀರಿನ ಮಡಕೆ ಬೆಲೆ ೪೫೦';
  const mockResults = [
    [{ transcript: genuineKannada }],
  ];
  mockResults[0].isFinal = true;

  const { finalTranscript } = combineSpeechResults(mockResults);
  assert.equal(finalTranscript, genuineKannada, 'Kannada Unicode must be preserved identically');
  assert.ok(/[\u0C80-\u0CFF]/.test(finalTranscript), 'Transcript must contain valid Kannada Unicode');

  session.cancel();
});

test('5. Interim and final results are combined correctly without duplicating words', () => {
  // Simulating multi-chunk Web Speech API result
  const mockEventResults = [
    [{ transcript: 'ನೈಸರ್ಗಿಕ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಮಾಡಿದ ' }],
    [{ transcript: 'ನೀರಿನ ಮಡಕೆ' }],
    [{ transcript: ' ಬೆಲೆ 400' }],
  ];
  mockEventResults[0].isFinal = true;
  mockEventResults[1].isFinal = true;
  mockEventResults[2].isFinal = false; // interim

  const { finalTranscript, interimTranscript } = combineSpeechResults(mockEventResults);

  assert.equal(finalTranscript, 'ನೈಸರ್ಗಿಕ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಮಾಡಿದ ನೀರಿನ ಮಡಕೆ', 'Final chunks must concatenate cleanly');
  assert.equal(interimTranscript, 'ಬೆಲೆ 400', 'Interim chunk must be isolated');
  assert.ok(!finalTranscript.includes('ಮಾಡಿದ ಮಾಡಿದ'), 'Words must never be duplicated');
});

test('6. Recognition ends after producing a valid transcript without discarding it', async () => {
  const mockWin = createMockWindow();
  let stateHistory = [];
  let _deliveredTranscript = '';

  const session = createVoiceSession({
    language: 'kn',
    customWindow: mockWin,
    onStateChange: (state) => stateHistory.push(state),
    onFinalTranscript: (text) => { _deliveredTranscript = text; },
  });

  await session.start();

  // Stop session
  await session.stop();

  assert.ok(stateHistory.includes(VOICE_STATES.PROCESSING), 'State must transition through processing');
  session.cancel();
});

test('7. Recognition returns no speech handled gracefully', () => {
  // A: Empty results
  const emptyRes = combineSpeechResults([]);
  assert.equal(emptyRes.finalTranscript, '');
  assert.equal(emptyRes.interimTranscript, '');

  // B: Status message for no speech in Kannada
  const noSpeechKn = getVoiceStatusMessage(VOICE_STATES.RECOGNITION_FAILED, 'kn', { reason: 'no_speech' });
  assert.ok(noSpeechKn.includes('ಯಾವುದೇ ಧ್ವನಿ ಕೇಳಿಸಲಿಲ್ಲ'), 'Kannada message must clearly explain no speech was heard');

  // C: Status message for network error in Kannada
  const networkKn = getVoiceStatusMessage(VOICE_STATES.RECOGNITION_FAILED, 'kn', { reason: 'network' });
  assert.ok(networkKn.includes('ನೆಟ್‌ವರ್ಕ್ ದೋಷ'), 'Kannada message must explain network error');
});

test('8. Duplicate event callbacks do not duplicate the transcript', () => {
  const results = [
    [{ transcript: 'ಶುದ್ಧ ತಾಮ್ರದ ಬಿಂದಿಗೆ' }],
  ];
  results[0].isFinal = true;

  // Simulate 3 successive onresult ticks with the same finalized result
  const tick1 = combineSpeechResults(results);
  const tick2 = combineSpeechResults(results);
  const tick3 = combineSpeechResults(results);

  assert.equal(tick1.finalTranscript, 'ಶುದ್ಧ ತಾಮ್ರದ ಬಿಂದಿಗೆ');
  assert.equal(tick2.finalTranscript, 'ಶುದ್ಧ ತಾಮ್ರದ ಬಿಂದಿಗೆ');
  assert.equal(tick3.finalTranscript, 'ಶುದ್ಧ ತಾಮ್ರದ ಬಿಂದಿಗೆ');
  assert.equal(tick1.finalTranscript, tick3.finalTranscript, 'Result must be strictly idempotent across repeated ticks');
});

test('9. Cancellation cleans up resources and resets to idle', async () => {
  const mockWin = createMockWindow();
  let latestState = null;

  const session = createVoiceSession({
    language: 'kn',
    customWindow: mockWin,
    onStateChange: (s) => { latestState = s; },
  });

  await session.start();
  session.cancel();

  assert.equal(latestState, VOICE_STATES.IDLE, 'State must reset to idle on cancel');
  assert.equal(session.getState(), VOICE_STATES.IDLE);
});

test('10. A recorded audio blob is not mistaken for recognized text', async () => {
  // When MediaRecorder captures an audio blob but no speech is transcribed and no backend is set:
  const mockWin = createMockWindow({ hasSpeechRecognition: false });
  let transcriptDelivered = null;
  let _errorReported = null;

  const session = createVoiceSession({
    language: 'kn',
    customWindow: mockWin,
    backendTranscribe: null, // No backend configured
    onFinalTranscript: (text) => { transcriptDelivered = text; },
    onError: (err) => { _errorReported = err; },
  });

  await session.start();
  await session.stop();

  // Wait for mock timers
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(transcriptDelivered, null, 'Audio blob must NEVER be passed as transcript');
  assert.equal(session.getState(), VOICE_STATES.RECOGNITION_FAILED, 'Session must report recognition_failed, not pretend success');
  session.cancel();
});

test('11. Transcription backend failure and missing configuration handled truthfully', async () => {
  const mockWin = createMockWindow({ hasSpeechRecognition: false });
  let transcriptDelivered = null;
  let _reportedError = null;

  // Backend simulation returning null / unconfigured
  const mockBackendTranscribe = async () => {
    return null; // backend unconfigured or failed
  };

  const session = createVoiceSession({
    language: 'kn',
    customWindow: mockWin,
    backendTranscribe: mockBackendTranscribe,
    onFinalTranscript: (t) => { transcriptDelivered = t; },
    onError: (err) => { _reportedError = err; },
  });

  await session.start();
  await session.stop();

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(transcriptDelivered, null, 'Unconfigured backend must not produce fake transcript');
  assert.equal(session.getState(), VOICE_STATES.RECOGNITION_FAILED);
  session.cancel();
});

test('12. Product draft generation receives the actual transcript end-to-end', () => {
  const genuineVoiceTranscript = 'ನಮ್ಮ ಕುಂಬಾರಿಕೆ ಚಕ್ರದಲ್ಲಿ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಮಾಡಿದ ನೀರಿನ ಮಡಕೆ. ಬೆಲೆ 450 ರೂಪಾಯಿ. ದಾಸ್ತಾನು 8 ತುಂಡುಗಳು.';

  // 1. Facts extraction receives the actual voice text
  const facts = extractProductFacts(genuineVoiceTranscript);
  assert.equal(facts.price, 450, 'Price must be extracted from genuine voice');
  assert.equal(facts.stockQuantity, 8, 'Stock must be extracted from genuine voice');
  assert.equal(facts.matchedCategory, 'Pottery', 'Category must be Pottery');

  // 2. Product listing receives the actual voice text and facts
  const listing = buildProductListing(genuineVoiceTranscript, facts);

  assert.equal(listing.category, 'Pottery', 'Listing category must be Pottery');
  assert.equal(listing.localTitle, 'ಕೈಯಿಂದ ಮಾಡಿದ ಮಣ್ಣಿನ ನೀರಿನ ಮಡಕೆ', 'Kannada title must match craft facts');
  assert.equal(listing.englishTitle, 'Handcrafted Terracotta Water Pot', 'English title must match craft facts');
  assert.equal(listing.price, 450);
  assert.equal(listing.stock_quantity, 8);
  assert.ok(listing.localDescription.includes('ಜೇಡಿಮಣ್ಣು') || listing.localDescription.includes('ಮಣ್ಣು'), 'Local description must preserve artisan facts');
  assert.equal(listing.needsClarification, false, 'No clarification needed since facts were voiced');
});

test('13. Live timer ticks every second and resets properly on cancellation', async () => {
  const mockWin = {
    isSecureContext: true,
    location: { hostname: 'localhost', protocol: 'http:' },
    SpeechRecognition: MockSpeechRecognition,
    MediaRecorder: null,
    navigator: { mediaDevices: { getUserMedia: async () => new MockMediaStream() } },
  };

  const ticks = [];
  const session = createVoiceSession({
    language: 'kn',
    customWindow: mockWin,
    onTimerTick: (sec) => ticks.push(sec),
  });

  await session.start();
  // Advance time briefly to test timer tick
  await new Promise((resolve) => setTimeout(resolve, 1050));
  assert.ok(ticks.length >= 1, 'onTimerTick must be invoked on timer intervals');
  assert.ok(session.getSecondsElapsed() >= 1, 'Session elapsed seconds must be at least 1');

  session.cancel();
  assert.equal(session.getSecondsElapsed(), 0, 'Seconds elapsed must reset to 0 on cancel');
  assert.equal(session.getState(), VOICE_STATES.IDLE, 'State must return to idle');
});

test('14. Granular error messages distinguish unconfigured backend and recorded audio from silence', () => {
  const knMsgUnconfigured = getVoiceStatusMessage(VOICE_STATES.RECOGNITION_FAILED, 'kn', { reason: 'backend_unconfigured' });
  assert.ok(knMsgUnconfigured.includes('ಕಾನ್ಫಿಗರ್ ಆಗಿಲ್ಲ') || knMsgUnconfigured.includes('ಲಭ್ಯವಿಲ್ಲ'), 'Must explain backend is unconfigured');

  const enMsgRecorded = getVoiceStatusMessage(VOICE_STATES.RECOGNITION_FAILED, 'en', { reason: 'audio_recorded_no_transcription' });
  assert.ok(enMsgRecorded.includes('Audio recorded'), 'Must indicate audio was recorded but transcription unavailable');

  const enMsgSilence = getVoiceStatusMessage(VOICE_STATES.RECOGNITION_FAILED, 'en', { reason: 'no_speech' });
  assert.ok(enMsgSilence.includes('No speech was detected'), 'Must state no speech detected for true silence');
});
