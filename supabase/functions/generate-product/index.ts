// generate-product function - deterministic implementation without Gemini

import { classifyCategory } from './classifier.ts';

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

    console.log('Input attributes received:');
    console.log('- Image present:', !!image);
    if (image) console.log('  - Image MIME type:', mimeType);
    console.log('- Voice text present:', !!voiceText);
    console.log('- Existing description present:', !!existingDescription);

    // Deterministic product metadata generation (Gemini removed)
    const combinedText = [voiceText, existingDescription].filter(Boolean).join(' ').trim();

    // Category – use classifier if image provided, otherwise fallback
    let category = 'Other Handicrafts';
    let categoryConfidence: 'high' | 'medium' | 'low' = 'low';
    if (image) {
      const classResult = await classifyCategory(image, mimeType);
      if (classResult && classResult.category) {
        category = classResult.category;
        categoryConfidence = classResult.confidence;
      }
    }

    // Simple utilities for title, description, keywords, quantity, price suggestion
    const extractKeywords = (text: string, max = 10) => {
      const stopWords = new Set([
        'the','and','or','a','an','of','in','to','for','with','by','on','at','is','are','was','were','it','this','that'
      ]);
      const words = text.toLowerCase().split(/[^a-z0-9]+/i).filter(w => w.length > 2 && !stopWords.has(w));
      return Array.from(new Set(words)).slice(0, max);
    };
    const detectQuantity = (text: string): number | null => {
      const m = text.match(/\b(\d+)\b/);
      return m ? parseInt(m[1], 10) : null;
    };
    const generateTitle = (text: string) => {
      const words = text.split(/\s+/);
      return words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '');
    };
    const generateDescription = (text: string) => {
      const trimmed = text.trim();
      return trimmed.length > 300 ? trimmed.slice(0, 297) + '...' : trimmed;
    };
    const priceSuggestion = () => ({ min: 100, max: 500, currency: 'INR' });

    const product_name = combinedText ? generateTitle(combinedText) : 'Untitled Product';
    const description = combinedText ? generateDescription(combinedText) : 'No description provided.';
    const keywords = combinedText ? extractKeywords(combinedText) : [];
    const quantity = combinedText ? detectQuantity(combinedText) : null;
    const price = priceSuggestion();

    const response = {
      product_name,
      category,
      description,
      keywords,
      price_suggestion: price,
      confidence: categoryConfidence,
      quantity,
    };

    console.log('Generated product metadata:', response);
    return new Response(JSON.stringify(response), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
