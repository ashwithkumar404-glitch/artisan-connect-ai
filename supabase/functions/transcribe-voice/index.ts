// Deno Serverless Edge Function for Artisan Connect AI Product Voice Transcription and Translation
// Access-Control CORS headers for cross-origin resource requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight options check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Fetch Google Gemini API key from environment vault
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY secret is not set in the Supabase workspace.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse request JSON parameters
    const { audio, mimeType } = await req.json();
    if (!audio) {
      return new Response(
        JSON.stringify({ error: 'Audio data is missing from the payload.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean MIME type (remove codecs parameter which causes Gemini API error)
    let cleanMimeType = (mimeType || 'audio/webm').split(';')[0].trim();
    if (cleanMimeType === 'audio/x-m4a') {
      cleanMimeType = 'audio/mp4';
    }

    console.log("Original audio MIME type:", mimeType);
    console.log("Cleaned audio MIME type for Gemini:", cleanMimeType);
    console.log("Audio payload base64 size (approx):", Math.round(audio.length / 1024) + " KB");

    // 3. Configure Gemini Multimodal Prompt and Payload
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

    const promptText = `You are assisting traditional Indian artisans.

Listen carefully to the attached audio.

Identify the language being spoken.
Transcribe the speech accurately in the original language.
Then translate the meaning into natural English.

The speech may describe:
- what the artisan made
- materials used
- traditional techniques
- product purpose
- size
- color
- cultural information
- craftsmanship
- other product details

Do not invent information that was not spoken.

Return ONLY a valid JSON object matching the following structure:
{
  "detected_language": "...",
  "transcript": "...",
  "english_translation": "...",
  "confidence": "high" | "medium" | "low"
}

Preserve the artisan's meaning. Do not add marketing claims that were not spoken. Do not wrap in markdown code blocks.`;

    const apiBody = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: cleanMimeType,
                data: audio,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    };

    console.log("Sending audio request to Google Gemini API using model 'gemini-2.5-flash'...");
    
    // 4. Send request to Google Gemini API
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiBody),
    });

    console.log("Gemini API response status:", response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", errText);
      throw new Error(`Gemini API returned error ${response.status}: ${errText}`);
    }

    const resJson = await response.json();
    const textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      console.error("Gemini completion is empty.");
      throw new Error('Gemini API returned an empty completion.');
    }

    console.log("Raw Gemini completion text:", textResult.trim());

    // Clean markdown wrappers if any
    let cleanedText = textResult.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(?:json)?\n?/, '');
      cleanedText = cleanedText.replace(/\n?```$/, '');
      cleanedText = cleanedText.trim();
    }

    // Verify correct JSON syntax before returning
    const parsedData = JSON.parse(cleanedText);
    console.log("Successfully parsed JSON response:", parsedData);

    return new Response(
      JSON.stringify(parsedData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in transcribe-voice function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
