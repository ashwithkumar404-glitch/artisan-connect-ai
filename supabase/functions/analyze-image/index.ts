import { generateGeminiContent } from '../_shared/gemini.ts';

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
    
    // 1. Deno environment key checks are now managed by the shared helper.

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

    console.log("Sending request to Google Gemini API...");

    // 4. Send request using shared helper
    const resJson = await generateGeminiContent(apiBody);
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
    if (error.message === 'AI_QUOTA_EXHAUSTED') {
      return new Response(
        JSON.stringify({
          code: 'AI_QUOTA_EXHAUSTED',
          message: 'AI service is temporarily unavailable. Please try again shortly.'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
