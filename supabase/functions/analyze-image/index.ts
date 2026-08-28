// Deno Serverless Edge Function for Artisan Connect AI Product Image Analysis
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
    console.log("Edge Function 'analyze-image' invocation started.");
    
    // 1. Fetch Google Gemini API key from environment vault
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      console.error("GEMINI_API_KEY secret is not set in Deno environment.");
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY secret is not set in the Supabase workspace.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse request JSON parameters
    const { image, mimeType } = await req.json();
    if (!image) {
      console.warn("Image data is missing from payload.");
      return new Response(
        JSON.stringify({ error: 'Image data is missing from the payload.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Image MIME type:", mimeType);
    console.log("Image payload base64 size (approx):", Math.round(image.length / 1024) + " KB");

    // 3. Configure Gemini Multimodal Prompt and Payload
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

    const promptText = `Analyze the attached product image. Assess the image quality, blur, lighting, background, product positioning, and visibility. 
You must output a valid JSON object containing your actual audit findings for this specific image.

The JSON output must conform EXACTLY to the following structure:
{
  "quality_score": <integer score from 0 to 100 based on image quality>,
  "blur_detected": <boolean true if blurry, false if clear/sharp>,
  "lighting": "good" | "average" | "poor",
  "background": "clean" | "busy" | "distracting",
  "product_visibility": "high" | "medium" | "low",
  "recommendations": [
    <at least two specific recommendations based on lighting, blur, focus, background, or positioning>
  ]
}

Do not include any markdown formatting (no \`\`\`json wrappers), no comments, and no text outside the JSON object.`;

    const apiBody = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    };

    console.log("Sending request to Google Gemini API using model 'gemini-2.5-flash'...");

    // 4. Send request to Google Gemini API
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiBody),
    });

    console.log("Gemini API response status received:", response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error text:", errText);
      throw new Error(`Gemini API returned error ${response.status}: ${errText}`);
    }

    const resJson = await response.json();
    const textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      console.error("Gemini response is empty, missing candidate text.");
      throw new Error('Gemini API returned an empty completion.');
    }

    console.log("Gemini completion raw response text:", textResult.trim());

    // Verify correct JSON syntax before returning
    const parsedData = JSON.parse(textResult.trim());
    console.log("Successfully parsed Gemini response:", parsedData);

    return new Response(
      JSON.stringify(parsedData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-image function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
