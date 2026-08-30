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

  console.log("Price Intelligence function started.");

  try {
    // 1. Deno environment key checks are now managed by the shared helper.


    // 2. Parse request JSON parameters
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Only POST requests are supported.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("Failed to parse request JSON body:", e);
      return new Response(
        JSON.stringify({ error: 'Malformed JSON payload in request body.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { productName, category, description, quantity, currentPrice, similarProducts = [] } = body;

    console.log("Request payload received:", {
      productName: productName || 'N/A',
      category: category || 'N/A',
      hasDescription: !!description,
      quantity: quantity !== undefined ? quantity : 'N/A',
      currentPrice: currentPrice !== undefined ? currentPrice : 'N/A',
      similarProductsCount: similarProducts.length
    });

    // Validate the request contains required fields
    if (!productName || typeof productName !== 'string' || productName.trim() === '') {
      console.warn("Validation failed: missing or empty productName.");
      return new Response(
        JSON.stringify({ error: 'productName field is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!category || typeof category !== 'string' || category.trim() === '') {
      console.warn("Validation failed: missing or empty category.");
      return new Response(
        JSON.stringify({ error: 'category field is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert and filter comparable prices safely with Number()
    const validSimilarProducts = similarProducts.filter((p: any) => {
      if (!p || (p.price === undefined || p.price === null)) return false;
      const priceVal = Number(p.price);
      return !isNaN(priceVal) && priceVal > 0;
    });

    const comparable_products_count = validSimilarProducts.length;
    console.log("Number of comparable products received:", similarProducts.length);
    console.log("Number of valid prices:", comparable_products_count);

    // Calculate confidence based on sample count
    let confidence: "low" | "medium" | "high" = "low";
    if (comparable_products_count > 5) {
      confidence = "high";
    } else if (comparable_products_count >= 3) {
      confidence = "medium";
    }

    // Return useful 200 response when there are zero valid comparable products
    if (comparable_products_count === 0) {
      console.log("Zero valid comparable products. Returning early 200 response without invoking Gemini.");
      return new Response(
        JSON.stringify({
          comparable_products_count: 0,
          market_min: 0,
          market_max: 0,
          market_average: 0,
          market_median: 0,
          confidence: "low",
          recommendation: null,
          warning: "No comparable published products are currently available. Please enter your price manually."
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sort valid prices to calculate min, max, average, median
    const prices = validSimilarProducts
      .map((p: any) => Number(p.price))
      .sort((a: number, b: number) => a - b);

    const market_min = prices[0];
    const market_max = prices[prices.length - 1];
    const sum = prices.reduce((acc: number, val: number) => acc + val, 0);
    const market_average = Math.round(sum / prices.length);

    // Median price calculation
    const mid = Math.floor(prices.length / 2);
    const market_median = prices.length % 2 !== 0 
      ? prices[mid] 
      : Math.round((prices[mid - 1] + prices[mid]) / 2);

    console.log("Calculated statistics:", {
      market_min,
      market_max,
      market_average,
      market_median,
      confidence
    });

    // Configure Gemini Multimodal Prompt and Payload
    const promptText = `You are a pricing intelligence assistant for Artisan Connect AI, a marketplace for traditional Indian artisans.
Analyze the following product details and the current marketplace statistics of published products in the same category to recommend a fair price (integer) in INR.

Product Details:
- Name: "${productName}"
- Category: "${category}"
- Description: "${description || ''}"
- Quantity: ${quantity !== undefined && quantity !== null ? quantity : 'Not specified'}

Marketplace Statistics:
- Comparable Products Count: ${comparable_products_count}
- Minimum Price: ₹${market_min}
- Maximum Price: ₹${market_max}
- Average Price: ₹${market_average}
- Median Price: ₹${market_median}

Comparable Products:
${validSimilarProducts.slice(0, 10).map((p: any) => `- Name: "${p.name || 'Unnamed'}", Price: ₹${p.price}, Description: "${p.description || ''}"`).join('\n')}

Guidelines for Recommendation:
1. The recommended_price must be a positive integer in INR that fits reasonably within the calculated statistics.
2. The confidence level is "${confidence}". Make sure the confidence field is strictly set to "${confidence}".
3. Provide a concise explanation (under 3 sentences) in the "reasoning" field. Explain why this price is recommended based on the comparable items. Refer to it as an estimate based on available marketplace data. Do NOT search for external market data or claim it is an official Indian market price.
4. Output must be a valid JSON object matching this structure:
{
  "recommended_price": <integer>,
  "reasoning": "<string>",
  "confidence": "${confidence}"
}
Do not write markdown wrappers (no \`\`\`json wrappers), no comments, and no extra text outside the JSON object.`;

    const apiBody = {
      contents: [
        {
          parts: [{ text: promptText }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    };

    let resJson;
    let fallbackTriggered = false;

    try {
      console.log("Sending request to Google Gemini API...");
      resJson = await generateGeminiContent(apiBody);
    } catch (err) {
      if (err.message === 'AI_QUOTA_EXHAUSTED') {
        console.log("Gemini rate limit detected (All fallback keys exhausted). Using marketplace statistics fallback.");
        fallbackTriggered = true;
      } else {
        throw err;
      }
    }

    if (fallbackTriggered) {
      let fallbackPrice = market_median !== undefined && market_median !== null ? market_median : market_average;
      fallbackPrice = Math.round(fallbackPrice);
      if (fallbackPrice < market_min) fallbackPrice = market_min;
      if (fallbackPrice > market_max) fallbackPrice = market_max;

      console.log(`Fallback recommended price: ${fallbackPrice}`);

      const reasoning = `Gemini pricing analysis was temporarily unavailable due to API rate limits. The suggested price was calculated from ${comparable_products_count} comparable published products in the same category using the marketplace median price as the primary baseline.`;

      const fallbackResponse = {
        comparable_products: comparable_products_count,
        comparable_products_count,
        market_min,
        market_max,
        market_average,
        market_median,
        recommended_price: fallbackPrice,
        confidence,
        reasoning,
        source: "market_statistics_fallback",
        recommendation: {
          recommended_price: fallbackPrice,
          reasoning,
          confidence
        },
        warning: null
      };

      return new Response(
        JSON.stringify(fallbackResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      console.error("Gemini completion output is empty or null.");
      throw new Error('Gemini API returned an empty completion.');
    }

    const rawText = textResult.trim();
    console.log("Raw Gemini completion text:", rawText);

    // Stripping markdown wrappers if present
    let cleanedText = rawText;
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```(json)?/, "");
      cleanedText = cleanedText.replace(/```$/, "");
      cleanedText = cleanedText.trim();
    }

    // Verify correct JSON syntax before returning
    let parsedRecommendation;
    try {
      parsedRecommendation = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON. Cleaned Text:", cleanedText, "Error:", parseError);
      throw new Error(`Gemini response is not valid JSON: ${parseError.message}`);
    }

    console.log("Parsed recommendation:", parsedRecommendation);

    // Enforce backend-computed confidence
    parsedRecommendation.confidence = confidence;

    const finalResponse = {
      comparable_products_count,
      market_min,
      market_max,
      market_average,
      market_median,
      confidence,
      recommendation: parsedRecommendation,
      warning: null
    };

    return new Response(
      JSON.stringify(finalResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in price-intelligence function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
