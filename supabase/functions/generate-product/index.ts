// generate-product function - Deterministic cataloguing engine without external AI APIs
// Generates marketplace-ready product listings strictly from genuine artisan voice transcripts and inputs.

import { classifyCategoryFromText } from './classifier.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Common introductory conversational voice prefixes to strip for a clean title
const VOICE_PREFIX_PATTERNS = [
  /^(?:this\s+is\s+(?:a|an)?\s*)/i,
  /^(?:here\s+is\s+(?:a|an)?\s*)/i,
  /^(?:i\s+have\s+made\s+(?:a|an)?\s*)/i,
  /^(?:i\s+made\s+(?:a|an)?\s*)/i,
  /^(?:we\s+have\s+made\s+(?:a|an)?\s*)/i,
  /^(?:we\s+make\s+(?:a|an)?\s*)/i,
  /^(?:my\s+product\s+is\s+(?:a|an)?\s*)/i,
  /^(?:introducing\s+(?:a|an)?\s*)/i,
  /^(?:it\s+is\s+(?:a|an)?\s*)/i,
  /^(?:today\s+i\s+am\s+showing\s+(?:a|an)?\s*)/i,
  /^(?:look\s+at\s+this\s*)/i,
];

// Patterns for detecting and stripping internal production/raw material costs from public description
const COST_PRIVACY_PATTERNS = [
  /\b(?:production\s*cost|making\s*cost|manufacturing\s*cost)\s*(?:is|was|of)?\s*(?:around|about|approx|approximately)?\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:rupees|rs))?/gi,
  /\b(?:cost\s*me|spent|spent\s*around|spent\s*about)\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:rupees|rs))?(?:\s*(?:to\s*make|for\s*making|for\s*materials|on\s*raw\s*materials|on\s*materials))?/gi,
  /\b(?:raw\s*material\s*cost|materials\s*cost)\s*(?:is|was|of)?\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:rupees|rs))?/gi,
  /\b(?:it\s*costs?\s*(?:me)?\s*(?:rs\.?|inr|₹)?\s*\d+\s*(?:to\s*make|for\s*making)?)/gi,
];

// Patterns to detect desired selling price if explicitly voiced by artisan
const SELLING_PRICE_PATTERNS = [
  /\b(?:selling\s*price|desired\s*price|price\s*is|sell\s*for|sell\s*it\s*for|selling\s*for|priced\s*at)\s*(?:is|at)?\s*(?:rs\.?|inr|₹)?\s*(\d{2,6})\b/i,
  /\b(?:i\s*want\s*to\s*sell\s*(?:it)?\s*for)\s*(?:rs\.?|inr|₹)?\s*(\d{2,6})\b/i,
];

// Patterns to detect explicit stock quantity mentions
const QUANTITY_PATTERNS = [
  /\b(?:stock(?:\s*of)?|quantity(?:\s*of)?|total(?:\s*of)?|i\s*have|we\s*have)\s*(\d{1,4})\s*(?:pieces|items|units|pcs|baskets|pots|sarees|shawls|vases|boxes)?\b/i,
  /\b(?:made)\s*(\d{1,4})\s*(?:pieces|items|units|pcs|baskets|pots|sarees|shawls|vases|boxes)?\b/i,
  /\b(\d{1,4})\s*(?:pieces|items|units|pcs)\s*(?:available|in\s*stock|ready)?\b/i,
];

// English stop words for keyword extraction
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren', 'as',
  'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'cannot',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
  'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i',
  'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no',
  'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out',
  'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
  'until', 'up', 'very', 'was', 'wasn', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who',
  'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves', 'also', 'made', 'make',
  'good', 'nice', 'product', 'item', 'handicraft', 'craft'
]);

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function generateCleanTitle(text: string, category: string): string {
  if (!text || text.trim() === '') {
    return category && category !== 'Other Handicrafts'
      ? `Handcrafted ${category} Product`
      : 'Handcrafted Artisan Product';
  }

  // Remove common conversational voice intros
  let cleaned = text.trim();
  for (const pat of VOICE_PREFIX_PATTERNS) {
    if (pat.test(cleaned)) {
      cleaned = cleaned.replace(pat, '').trim();
      break;
    }
  }

  // Split into sentences / phrases
  const firstSentence = cleaned.split(/[.\n!?]/)[0].trim() || cleaned;
  const words = firstSentence.split(/\s+/).filter(Boolean);

  // Take up to first 6-8 words
  const titleWords = words.slice(0, 7);
  let title = titleWords.join(' ');

  // Clean trailing punctuation
  title = title.replace(/[,;:-]+$/, '').trim();

  if (title.length < 3) {
    title = category !== 'Other Handicrafts' ? `Handcrafted ${category}` : 'Handcrafted Artisan Product';
  }

  return toTitleCase(title);
}

function generateSanitizedDescription(text: string): string {
  if (!text || text.trim() === '') {
    return 'Authentic handmade handicraft created by local Indian artisan. High-quality craftsmanship and traditional heritage design.';
  }

  let sanitized = text.trim();

  // Redact internal production costs to maintain strict cost privacy
  for (const pat of COST_PRIVACY_PATTERNS) {
    sanitized = sanitized.replace(pat, '');
  }

  // Clean up any double spaces or orphan punctuation left behind
  sanitized = sanitized
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/([.,!?])\1+/g, '$1')
    .trim();

  return sanitized || text.trim();
}

function extractKeywords(text: string, category: string, maxKeywords = 8): string[] {
  const words = (text + ' ' + category)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const unique = Array.from(new Set(words));
  // Guarantee category words are included if relevant
  return unique.slice(0, maxKeywords);
}

function detectQuantity(text: string): number | null {
  if (!text) return null;
  for (const pat of QUANTITY_PATTERNS) {
    const match = text.match(pat);
    if (match && match[1]) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val > 0 && val < 50000) {
        return val;
      }
    }
  }
  return null;
}

function detectPriceSuggestion(text: string, category: string): { min: number; max: number; currency: string } {
  // 1. Check if artisan explicitly voiced their desired selling price
  if (text) {
    for (const pat of SELLING_PRICE_PATTERNS) {
      const match = text.match(pat);
      if (match && match[1]) {
        const price = parseInt(match[1], 10);
        if (!isNaN(price) && price > 0) {
          const min = Math.round(price * 0.9);
          const max = Math.round(price * 1.1);
          return { min, max, currency: 'INR' };
        }
      }
    }
  }

  // 2. Default estimated market range by category
  const categoryDefaults: Record<string, { min: number; max: number }> = {
    'Bamboo & Natural Craft': { min: 250, max: 750 },
    'Handloom & Textiles': { min: 600, max: 2200 },
    'Pottery': { min: 200, max: 650 },
    'Wood Craft': { min: 450, max: 1500 },
    'Metal Craft': { min: 500, max: 1800 },
    'Jewellery': { min: 350, max: 1200 },
    'Other Handicrafts': { min: 300, max: 900 },
  };

  const range = categoryDefaults[category] || categoryDefaults['Other Handicrafts'];
  return { min: range.min, max: range.max, currency: 'INR' };
}

Deno.serve(async (req) => {
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

    console.log('Deterministic Product Listing Generator started:');
    console.log('- Image present:', !!image);
    console.log('- Voice text present:', !!voiceText);
    console.log('- Existing description present:', !!existingDescription);

    const combinedText = [voiceText, existingDescription].filter(Boolean).join(' ').trim();

    // 1. Category Classification via rule-based keyword engine
    const categoryResult = classifyCategoryFromText(combinedText);
    const category = categoryResult.category;

    // 2. Title Generation strictly from genuine text
    const product_name = generateCleanTitle(combinedText, category);

    // 3. Description Generation with strict cost privacy
    const description = generateSanitizedDescription(combinedText);

    // 4. Quantity Detection (unambiguous numbers only, otherwise null)
    const quantity = detectQuantity(combinedText);

    // 5. Keywords Extraction strictly from transcript
    const keywords = extractKeywords(combinedText, category);

    // 6. Separate Price Suggestion (never in public description)
    const price_suggestion = detectPriceSuggestion(combinedText, category);

    // Confidence level based on input completeness
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (combinedText && image && categoryResult.confidence !== 'low') {
      confidence = 'high';
    } else if (combinedText || image) {
      confidence = 'medium';
    }

    const response = {
      product_name,
      category,
      description,
      keywords,
      price_suggestion,
      confidence,
      quantity,
    };

    console.log('Successfully generated product listing:', response);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-product function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
