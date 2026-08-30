import { generateGeminiContent } from '../_shared/gemini.ts';

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
    // 1. Deno environment key checks are now managed by the shared helper.


    // 2. Parse request JSON parameters
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Only POST requests are supported.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const image = body.image;
    const mimeType = body.mimeType;
    const voiceText = body.voiceText || body.voiceTranscript;
    const existingDescription = body.existingDescription || body.description;

    // Validate that at least one product input parameter exists
    if (!image && !voiceText && !existingDescription) {
      return new Response(
        JSON.stringify({ error: 'At least one input (image, voiceText, or existingDescription) must be provided.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Input attributes received:");
    console.log("- Image present:", !!image);
    if (image) console.log("  - Image MIME type:", mimeType);
    console.log("- Voice text present:", !!voiceText);
    console.log("- Existing description present:", !!existingDescription);

    // 3. Configure Gemini Multimodal Prompt and Payload
    const promptText = `You are a product cataloguing assistant for Artisan Connect AI, a marketplace for traditional Indian artisans.
Analyze the provided product information (which may include a product photo, an audio transcript, and/or a manually typed description) and generate high-quality product cataloguing metadata.

You must output a valid JSON object matching the following structure:
{
  "product_name": <string: descriptive, clean title describing the product>,
  "category": <string: exactly one of the valid categories below>,
  "description": <string: detailed, clear, and professional English product description outlining craftsmanship, material, utility, and style>,
  "keywords": [
    <array of 5 to 10 search-relevant tag strings based on the product characteristics>
  ],
  "price_suggestion": {
    "min": <integer: estimated minimum price in INR ₹ based on materials, complexity, and product type>,
    "max": <integer: estimated maximum price in INR ₹>,
    "currency": "INR"
  },
  "confidence": "high" | "medium" | "low",
  "quantity": <integer or null: the exact quantity if the user/artisan explicitly mentioned a quantity as a number, otherwise null. Do NOT guess, assume, or invent quantity under any circumstances. Only populate if explicitly mentioned in the transcription or description. For example, "I made 10 baskets" -> 10, "this is a basket" -> null.>
}

The category field MUST be exactly one of:
- "Bamboo & Natural Craft"
- "Handloom & Textiles"
- "Pottery"
- "Wood Craft"
- "Metal Craft"
- "Jewellery"
- "Other Handicrafts"

The price suggestion is an estimate. If the information provided is insufficient to estimate a price range, return a conservative range (e.g. min: 100, max: 500) and set the confidence to "low".

Do not write markdown format (no \`\`\`json wrappers), no comment lines, and no extra text outside the JSON object. All values must be derived dynamically from the supplied image and text parts.`;

    const parts = [{ text: promptText }];

    if (voiceText) {
      parts.push({ text: `Voice recording transcription details: "${voiceText}"` });
    }

    if (existingDescription) {
      parts.push({ text: `Manually entered existing description: "${existingDescription}"` });
    }

    if (image && mimeType) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: image,
        }
      });
    }

    const apiBody = {
      contents: [
        {
          parts: parts
        }
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
      console.error("Gemini completion is empty.");
      throw new Error('Gemini API returned an empty completion.');
    }

    console.log("Raw Gemini completion text:", textResult.trim());

    // Verify correct JSON syntax before returning
    const parsedData = JSON.parse(textResult.trim());
    
    // Clean and validate quantity: only accept positive integers or explicitly mentioned zero
    let finalQuantity = null;
    if (parsedData.quantity !== undefined && parsedData.quantity !== null) {
      const parsedQty = parseInt(parsedData.quantity, 10);
      if (!isNaN(parsedQty) && parsedQty > 0) {
        finalQuantity = parsedQty;
      } else if (parsedQty === 0) {
        const fullText = ((voiceText || '') + ' ' + (existingDescription || '')).toLowerCase();
        const explicitlyMentionedZero = fullText.includes('0') || fullText.includes('zero') || fullText.includes('no stock') || fullText.includes('zero quantity');
        if (explicitlyMentionedZero) {
          finalQuantity = 0;
        }
      }
    }
    parsedData.quantity = finalQuantity;

    console.log("Successfully parsed and cleaned JSON response:", parsedData);

    return new Response(
      JSON.stringify(parsedData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-product function:', error);
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
