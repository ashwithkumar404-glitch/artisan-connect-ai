// Deno Serverless Edge Function for Artisan Connect AI Price Intelligence

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
    // Parse request JSON parameters
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
      console.error('Failed to parse request JSON body:', e);
      return new Response(
        JSON.stringify({ error: 'Malformed JSON payload in request body.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { productName, category, description, quantity, currentPrice, similarProducts = [] } = body;

    console.log('Request payload received:', {
      productName: productName || 'N/A',
      category: category || 'N/A',
      hasDescription: !!description,
      quantity: quantity !== undefined ? quantity : 'N/A',
      currentPrice: currentPrice !== undefined ? currentPrice : 'N/A',
      similarProductsCount: similarProducts.length,
    });

    // Validate required fields
    if (!productName || typeof productName !== 'string' || productName.trim() === '') {
      console.warn('Validation failed: missing or empty productName.');
      return new Response(
        JSON.stringify({ error: 'productName field is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!category || typeof category !== 'string' || category.trim() === '') {
      console.warn('Validation failed: missing or empty category.');
      return new Response(
        JSON.stringify({ error: 'category field is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter and validate comparable product prices
    const validSimilarProducts = similarProducts.filter((p: any) => {
      if (!p || p.price === undefined || p.price === null) return false;
      const priceVal = Number(p.price);
      return !isNaN(priceVal) && priceVal > 0;
    });

    const comparable_products_count = validSimilarProducts.length;
    console.log('Number of comparable products received:', similarProducts.length);
    console.log('Number of valid prices:', comparable_products_count);

    // Compute confidence based on sample size
    let confidence: "low" | "medium" | "high" = "low";
    if (comparable_products_count > 5) {
      confidence = "high";
    } else if (comparable_products_count >= 3) {
      confidence = "medium";
    }

    // Early return if no comparable data
    if (comparable_products_count === 0) {
      console.log('Zero valid comparable products. Returning early 200 response.');
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

    // Calculate market statistics
    const prices = validSimilarProducts
      .map((p: any) => Number(p.price))
      .sort((a: number, b: number) => a - b);
    const market_min = prices[0];
    const market_max = prices[prices.length - 1];
    const sum = prices.reduce((acc: number, val: number) => acc + val, 0);
    const market_average = Math.round(sum / prices.length);
    const mid = Math.floor(prices.length / 2);
    const market_median = prices.length % 2 !== 0
      ? prices[mid]
      : Math.round((prices[mid - 1] + prices[mid]) / 2);

    console.log('Calculated statistics:', { market_min, market_max, market_average, market_median, confidence });

    // Deterministic recommendation based on statistics
    let recommendedPrice = market_median !== undefined && market_median !== null ? market_median : market_average;
    if (recommendedPrice < market_min) recommendedPrice = market_min;
    if (recommendedPrice > market_max) recommendedPrice = market_max;
    recommendedPrice = Math.round(recommendedPrice);

    const reasoning = `Based on ${comparable_products_count} comparable products, the recommended price is set to \u20B9${recommendedPrice}, which falls within the observed market range (\u20B9${market_min}–\u20B9${market_max}).`;

    const finalResponse = {
      comparable_products_count,
      market_min,
      market_max,
      market_average,
      market_median,
      confidence,
      recommendation: {
        recommended_price: recommendedPrice,
        reasoning,
        confidence,
      },
      warning: null,
    };

    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in price-intelligence function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
