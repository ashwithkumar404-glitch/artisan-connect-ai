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
    // Parse request JSON parameters
    const { audio, mimeType } = await req.json();
    if (!audio) {
      return new Response(
        JSON.stringify({ error: 'Audio data is missing from the payload.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No speech-to-text engine is configured. Return a clear unsupported-service response.
    return new Response(
      JSON.stringify({
        error: 'Voice transcription service is unavailable. Please provide manual product description.'
      }),
      { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in transcribe-voice function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
