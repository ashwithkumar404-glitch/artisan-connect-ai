// Deno Serverless Edge Function for Artisan Connect AI Product Voice Transcription
// Supports Kannada Unicode and English audio transcription via Gemini or Whisper when configured.
// Zero frontend secret leakage; handles missing configuration gracefully with 503.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight options check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Only POST requests are supported.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request JSON parameters
    const body = await req.json();
    const { audio, mimeType = 'audio/webm', language = 'kn' } = body;

    if (!audio) {
      return new Response(
        JSON.stringify({ error: 'Audio data is missing from the payload.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check available server-side environment secrets
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    const groqApiKey = Deno.env.get('GROQ_API_KEY');

    // 1. Try Gemini API if configured (Supports Kannada multimodal audio natively)
    if (geminiApiKey) {
      try {
        const promptText = language === 'kn'
          ? 'You are an accurate speech-to-text transcriber for rural Indian artisans. Transcribe this audio recording into pure Kannada Unicode script (ಕನ್ನಡ ಲಿಪಿ). Do NOT transliterate to Latin/English letters. Transcribe only what the artisan said, without quotes, introductory text, explanations, or translation.'
          : 'You are an accurate speech-to-text transcriber for Indian artisans. Transcribe this audio recording into English text accurately. Transcribe only what was said, without commentary or quotes.';

        const cleanBase64 = audio.includes(',') ? audio.split(',')[1] : audio;
        const normalizedMime = mimeType.split(';')[0] || 'audio/webm';

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  {
                    inlineData: {
                      mimeType: normalizedMime,
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1000,
            },
          }),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          if (candidateText) {
            return new Response(
              JSON.stringify({ transcript: candidateText, language, provider: 'gemini' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          console.warn('Gemini audio transcription API returned error:', await geminiRes.text());
        }
      } catch (geminiErr) {
        console.warn('Gemini transcription attempt failed:', geminiErr);
      }
    }

    // 2. Try OpenAI or Groq Whisper API if configured
    const whisperKey = openAiApiKey || groqApiKey;
    const whisperEndpoint = openAiApiKey
      ? 'https://api.openai.com/v1/audio/transcriptions'
      : 'https://api.groq.com/openai/v1/audio/transcriptions';
    const whisperModel = openAiApiKey ? 'whisper-1' : 'whisper-large-v3';

    if (whisperKey) {
      try {
        const cleanBase64 = audio.includes(',') ? audio.split(',')[1] : audio;
        const binaryStr = atob(cleanBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const formData = new FormData();
        const audioBlob = new Blob([bytes], { type: mimeType });
        formData.append('file', audioBlob, 'recording.webm');
        formData.append('model', whisperModel);
        formData.append('language', language === 'kn' ? 'kn' : 'en');
        if (language === 'kn') {
          formData.append('prompt', 'ಕನ್ನಡ ಭಾಷೆಯಲ್ಲಿ ಕರಕುಶಲ ಉತ್ಪನ್ನದ ವಿವರಣೆ.');
        }

        const whisperRes = await fetch(whisperEndpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${whisperKey}` },
          body: formData,
        });

        if (whisperRes.ok) {
          const whisperData = await whisperRes.json();
          const transcript = whisperData.text?.trim() || '';
          if (transcript) {
            return new Response(
              JSON.stringify({ transcript, language, provider: openAiApiKey ? 'openai' : 'groq' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          console.warn('Whisper API returned error:', await whisperRes.text());
        }
      } catch (whisperErr) {
        console.warn('Whisper transcription attempt failed:', whisperErr);
      }
    }

    // 3. Fallback when no transcription provider is configured on server
    return new Response(
      JSON.stringify({
        error: 'Backend speech-to-text is not configured on this server (GEMINI_API_KEY or OPENAI_API_KEY required in Supabase secrets).',
        configured: false,
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in transcribe-voice function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
