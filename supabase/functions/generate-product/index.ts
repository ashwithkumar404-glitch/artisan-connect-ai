// generate-product function - Deterministic cataloguing engine without external AI APIs
// Generates marketplace-ready product listings strictly from genuine artisan voice transcripts and inputs.
// Supports Kannada Unicode script and English with strict cost privacy and fact grounding.

import { classifyCategoryFromText } from './classifier.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Conversational voice prefixes in English and Kannada
const VOICE_PREFIX_PATTERNS = [
  /^(?:hello|hi|namaste)\s*,?\s*/i,
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
  // Kannada prefixes
  /^(?:ನಮಸ್ಕಾರ\s*,?\s*)/iu,
  /^(?:ಇದು\s+(?:ಒಂದು)?\s*)/iu,
  /^(?:ನಾನು\s+(?:ಮಾಡಿದ|ತಯಾರಿಸಿದ|ಮಾಡಿದ್ದು|ಮಾಡಿರುವ|ತಯಾರಿಸಿರುವ)\s*(?:ಒಂದು)?\s*)/iu,
  /^(?:ನಮ್ಮ\s+(?:ಬಳಿ\s+ಇರುವ|ಉತ್ಪನ್ನ|ಕಲಾವಿದರ)\s*)/iu,
  /^(?:ನೋಡಿ\s+ಇದು\s*)/iu,
];

// Patterns for detecting and stripping internal production/raw material costs from public description
const COST_PRIVACY_PATTERNS = [
  // Kannada cost privacy
  /\b(?:ಖರ್ಚು|ವೆಚ್ಚ|ತಯಾರಿಕಾ\s*ವೆಚ್ಚ|ಕಚ್ಚಾ\s*ವಸ್ತುಗಳ?\s*ವೆಚ್ಚ)\s*(?:ಸುಮಾರು|ಅಂದಾಜು)?\s*(?:ರೂ\.?|ರೂಪಾಯಿ|₹)?\s*\d+(?:\s*ರೂಪಾಯಿ)?[^.!?\n]*[.!?\n]?/giu,
  /\b\d+\s*(?:ರೂಪಾಯಿ|ರೂ)\s*(?:ಖರ್ಚಾಗಿದೆ|ಖರ್ಚು|ವೆಚ್ಚ)[^.!?\n]*[.!?\n]?/giu,
  // English cost privacy
  /\b(?:(?:my|our|the)\s+)?(?:raw\s*material|production|making|manufacturing|materials?)\s*costs?\s*(?:is|was|of|came\s*to)?\s*(?:around|about|approx|approximately)?\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:rupees|rs))?(?:\s*(?:and|,)?\s*(?:(?:my|our|the)\s+)?(?:production|making|manufacturing|raw\s*material|materials?)\s*costs?\s*(?:is|was|of)?\s*(?:around|about|approx)?\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:rupees|rs))?)?[^.!?\n]*[.!?\n]?/gi,
  /\b(?:it\s+)?costs?\s*(?:me|us)?\s*(?:around|about)?\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:rupees|rs))?\s*(?:to\s*make|for\s*making|for\s*materials|on\s*raw\s*materials)[^.!?\n]*[.!?\n]?/gi,
  /\b(?:i|we)\s+spent\s*(?:around|about)?\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:rupees|rs))?\s*(?:on\s*(?:raw\s*)?materials|to\s*make|for\s*making)[^.!?\n]*[.!?\n]?/gi,
  /\b(?:production\s*cost|making\s*cost|manufacturing\s*cost|raw\s*material\s*cost|materials?\s*cost)\s*(?:is|was|of)?\s*(?:around|about|approx|approximately)?\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:rupees|rs))?/gi,
];

// Patterns to detect desired selling price if explicitly voiced by artisan
const SELLING_PRICE_PATTERNS = [
  /\b(?:selling\s*price|desired\s*price|price\s*is|sell\s*for|sell\s*it\s*for|selling\s*for|priced\s*at)\s*(?:is|at)?\s*(?:rs\.?|inr|₹)?\s*(\d{2,6})\b/i,
  /\b(?:i\s*want\s*to\s*sell\s*(?:it)?\s*for)\s*(?:rs\.?|inr|₹)?\s*(\d{2,6})\b/i,
  // Kannada price patterns
  /\b(?:ಮಾರಾಟ\s*ಬೆಲೆ|ಬೆಲೆ|ದರ)\s*(?:ಇದೆ)?\s*(?:ರೂ\.?|ರೂಪಾಯಿ|₹)?\s*(\d{2,6})\b/iu,
  /\b(\d{2,6})\s*(?:ರೂಪಾಯಿ|ರೂ)\b/iu,
];

// Patterns to detect explicit stock quantity mentions
const QUANTITY_PATTERNS = [
  /\b(?:stock(?:\s*of)?|quantity(?:\s*of)?|total(?:\s*of)?|i\s*have|we\s*have)\s*(\d{1,4})\s*(?:pieces|items|units|pcs|baskets|pots|sarees|shawls|vases|boxes)?\b/i,
  /\b(?:made)\s*(\d{1,4})\s*(?:pieces|items|units|pcs|baskets|pots|sarees|shawls|vases|boxes)?\b/i,
  /\b(\d{1,4})\s*(?:pieces|items|units|pcs)\s*(?:available|in\s*stock|ready)?\b/i,
  // Kannada quantity patterns
  /\b(\d{1,4})\s*(?:ತುಂಡುಗಳು|ಸಂಖ್ಯೆ|ಐಟಂಗಳು|ಪೀಸ್|ಮಡಕೆಗಳು|ಬುಟ್ಟಿಗಳು|ಸೀರೆಗಳು)\b/iu,
  /\b(?:ದಾಸ್ತಾನು|ಪ್ರಮಾಣ)\s*(\d{1,4})\b/iu,
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

function normalizeKannadaNumbers(str: string): string {
  if (!str) return '';
  const knDigits = ['೦', '೧', '೨', '೩', '೪', '೫', '೬', '೭', '೮', '೯'];
  let res = str;
  knDigits.forEach((kn, i) => {
    res = res.replaceAll(kn, i.toString());
  });
  return res;
}

// Generate English marketplace title derived from craft facts rather than first 7 words
function generateCleanTitle(text: string, category: string): string {
  if (!text || text.trim() === '') {
    return category && category !== 'Other Handicrafts'
      ? `Handcrafted ${category} Product`
      : 'Handcrafted Artisan Product';
  }

  const normalized = text.toLowerCase();

  // Craft-specific derived titles
  if (category === 'Pottery') {
    if (normalized.includes('water pot') || normalized.includes('ನೀರಿನ ಮಡಕೆ')) return 'Handcrafted Terracotta Water Pot';
    if (normalized.includes('pitcher') || normalized.includes('ಕುಡಿಕೆ')) return 'Traditional Terracotta Clay Pitcher';
    if (normalized.includes('vase') || normalized.includes('ಹೂದಾನಿ')) return 'Handcrafted Terracotta Flower Vase';
    if (normalized.includes('diya') || normalized.includes('ದೀಪ') || normalized.includes('ಹಣತೆ')) return 'Traditional Handcrafted Clay Diya';
    if (normalized.includes('kulhad') || normalized.includes('kulhar') || normalized.includes('ಕುಲ್ಹಡ್')) return 'Handcrafted Terracotta Clay Kulhad Cups';
    return 'Handcrafted Terracotta Clay Pottery';
  }

  if (category === 'Bamboo & Natural Craft') {
    if (normalized.includes('fruit basket') || normalized.includes('ಹಣ್ಣಿನ ಬುಟ್ಟಿ')) return 'Handwoven Bamboo Fruit Basket';
    if (normalized.includes('basket') || normalized.includes('ಬುಟ್ಟಿ')) return 'Handcrafted Bamboo Storage Basket';
    if (normalized.includes('mat') || normalized.includes('ಚಾಪೆ')) return 'Handwoven Natural Fiber Mat';
    if (normalized.includes('coir') || normalized.includes('ನಾರು')) return 'Handcrafted Natural Coir Craft Item';
    if (normalized.includes('jute') || normalized.includes('ಸೆಣಬು')) return 'Handcrafted Jute Craft Bag';
    return 'Handcrafted Bamboo and Natural Fiber Craft';
  }

  if (category === 'Handloom & Textiles') {
    if (normalized.includes('saree') || normalized.includes('sari') || normalized.includes('ಸೀರೆ')) {
      if (normalized.includes('silk') || normalized.includes('ರೇಷ್ಮೆ')) return 'Handloom Pure Silk Saree';
      return 'Traditional Handloom Cotton Saree';
    }
    if (normalized.includes('shawl') || normalized.includes('ಶಾಲು')) return 'Handwoven Traditional Shawl';
    if (normalized.includes('dupatta') || normalized.includes('ದುಪಟ್ಟಾ')) return 'Handcrafted Handloom Dupatta';
    return 'Authentic Handloom Textile Craft';
  }

  if (category === 'Wood Craft') {
    if (normalized.includes('toy') || normalized.includes('ಆಟಿಕೆ') || normalized.includes('channapatna') || normalized.includes('ಚನ್ನಪಟ್ಟಣ')) return 'Handcrafted Channapatna Wooden Toy';
    if (normalized.includes('box') || normalized.includes('ಪೆಟ್ಟಿಗೆ')) return 'Carved Teak Wood Storage Box';
    if (normalized.includes('sandalwood') || normalized.includes('ಶ್ರೀಗಂಧ')) return 'Hand-Carved Pure Sandalwood Figurine';
    return 'Hand-Carved Traditional Woodcraft';
  }

  if (category === 'Metal Craft') {
    if (normalized.includes('lamp') || normalized.includes('ದೀಪ')) return 'Handcrafted Traditional Brass Diya Lamp';
    if (normalized.includes('idol') || normalized.includes('statue') || normalized.includes('ವಿಗ್ರಹ')) return 'Lost-Wax Cast Brass Artisan Idol';
    if (normalized.includes('bidri') || normalized.includes('ಬಿದ್ರಿ')) return 'Authentic Bidriware Metal Inlay Vase';
    if (normalized.includes('copper') || normalized.includes('ತಾಮ್ರ')) return 'Handcrafted Pure Copper Vessel';
    return 'Authentic Handcrafted Metal Craft';
  }

  if (category === 'Jewellery') {
    if (normalized.includes('necklace') || normalized.includes('ಹಾರ')) return 'Handcrafted Filigree Artisan Necklace';
    if (normalized.includes('earring') || normalized.includes('jhumka') || normalized.includes('ಓಲೆ') || normalized.includes('ಜುಮ್ಕಾ')) return 'Handcrafted Silver Filigree Jhumka';
    if (normalized.includes('bangle') || normalized.includes('ಬಳೆ')) return 'Handcrafted Traditional Artisan Bangles';
    return 'Handmade Traditional Artisan Jewellery';
  }

  // Fallback title derived without first words
  return category !== 'Other Handicrafts' ? `Handcrafted ${category}` : 'Handcrafted Artisan Product';
}

function generateLocalTitle(text: string, category: string): string {
  const normalized = text.toLowerCase();

  if (category === 'Pottery') {
    if (normalized.includes('water pot') || normalized.includes('ನೀರಿನ ಮಡಕೆ')) return 'ಕೈಯಿಂದ ಮಾಡಿದ ಮಣ್ಣಿನ ನೀರಿನ ಮಡಕೆ';
    if (normalized.includes('vase') || normalized.includes('ಹೂದಾನಿ')) return 'ಕೈಯಿಂದ ಮಾಡಿದ ಮಣ್ಣಿನ ಹೂದಾನಿ';
    if (normalized.includes('diya') || normalized.includes('ದೀಪ') || normalized.includes('ಹಣತೆ')) return 'ಸಾಂಪ್ರದಾಯಿಕ ಮಣ್ಣಿನ ಹಣತೆ ದೀಪ';
    return 'ಕೈಯಿಂದ ಮಾಡಿದ ಟೆರ್ರಾಕೋಟಾ ಮಡಕೆ';
  }

  if (category === 'Bamboo & Natural Craft') {
    if (normalized.includes('fruit basket') || normalized.includes('ಹಣ್ಣಿನ ಬುಟ್ಟಿ')) return 'ಕೈಯಿಂದ ಹೆಣೆದ ಬಿದಿರಿನ ಹಣ್ಣಿನ ಬುಟ್ಟಿ';
    if (normalized.includes('mat') || normalized.includes('ಚಾಪೆ')) return 'ನೈಸರ್ಗಿಕ ನಾರಿನ ಕೈಚಾಪೆ';
    return 'ಕೈಯಿಂದ ಹೆಣೆದ ಬಿದಿರಿನ ಬುಟ್ಟಿ';
  }

  if (category === 'Handloom & Textiles') {
    if (normalized.includes('silk') || normalized.includes('ರೇಷ್ಮೆ')) return 'ಸಾಂಪ್ರದಾಯಿಕ ಕೈಮಗ್ಗದ ರೇಷ್ಮೆ ಸೀರೆ';
    if (normalized.includes('saree') || normalized.includes('ಸೀರೆ')) return 'ಕೈಮಗ್ಗದ ಹತ್ತಿ ಸೀರೆ';
    if (normalized.includes('shawl') || normalized.includes('ಶಾಲು')) return 'ಕೈಮಗ್ಗದ ಶಾಲು';
    return 'ಕೈಮಗ್ಗದ ಪಾರಂಪರಿಕ ಜವಳಿ';
  }

  if (category === 'Wood Craft') {
    if (normalized.includes('channapatna') || normalized.includes('ಚನ್ನಪಟ್ಟಣ') || normalized.includes('toy') || normalized.includes('ಆಟಿಕೆ')) return 'ಚನ್ನಪಟ್ಟಣದ ಮರದ ಸಾಂಪ್ರದಾಯಿಕ ಆಟಿಕೆ';
    if (normalized.includes('sandalwood') || normalized.includes('ಶ್ರೀಗಂಧ')) return 'ಶ್ರೀಗಂಧದ ಮರದ ಕೈ ಕೆತ್ತನೆ ಕಲಾಕೃತಿ';
    return 'ಕೈ ಕೆತ್ತನೆಯ ಮರದ ಕರಕುಶಲ ಕೃತಿ';
  }

  if (category === 'Metal Craft') {
    if (normalized.includes('lamp') || normalized.includes('ದೀಪ')) return 'ಸಾಂಪ್ರದಾಯಿಕ ಹಿತ್ತಾಳೆಯ ಪೂಜಾ ದೀಪ';
    if (normalized.includes('bidri') || normalized.includes('ಬಿದ್ರಿ')) return 'ಅಧಿಕೃತ ಬಿದ್ರಿ ಕಲೆಯ ಹೂದಾನಿ';
    if (normalized.includes('copper') || normalized.includes('ತಾಮ್ರ')) return 'ಶುದ್ಧ ತಾಮ್ರದ ಕೈ ಕಲಾಕೃತಿ';
    return 'ಸಾಂಪ್ರದಾಯಿಕ ಲೋಹದ ಕರಕುಶಲ ವಸ್ತು';
  }

  return 'ಅಧಿಕೃತ ಪಾರಂಪರಿಕ ಕರಕುಶಲ ಉತ್ಪನ್ನ';
}

function generateSanitizedDescription(text: string): string {
  if (!text || text.trim() === '') {
    return 'Authentic handmade handicraft created by local Indian artisan. High-quality craftsmanship and traditional heritage design.';
  }

  let sanitized = text.trim();

  // Redact internal production costs
  for (const pat of COST_PRIVACY_PATTERNS) {
    sanitized = sanitized.replace(pat, ' ');
  }

  sanitized = sanitized
    .replace(/\b(?:my|our|the|and|or|but)\s*([.,!?])/gi, '$1')
    .replace(/\b(?:my|our)\s+(?:and|or)\b/gi, '')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/([.,!?])\s*\1+/g, '$1')
    .replace(/^\s*[.,!?]+\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return sanitized || text.trim();
}

function extractKeywords(text: string, category: string, maxKeywords = 8): string[] {
  const words = (text + ' ' + category)
    .toLowerCase()
    .split(/[^a-z0-9\u0C80-\u0CFF]+/iu)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const unique = Array.from(new Set(words));
  return unique.slice(0, maxKeywords);
}

function detectQuantity(text: string): number | null {
  if (!text) return null;
  const normalized = normalizeKannadaNumbers(text);
  for (const pat of QUANTITY_PATTERNS) {
    const match = normalized.match(pat);
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
  if (text) {
    const normalized = normalizeKannadaNumbers(text);
    for (const pat of SELLING_PRICE_PATTERNS) {
      const match = normalized.match(pat);
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
    const voiceText = body.voiceText || body.voiceTranscript;
    const existingDescription = body.existingDescription || body.description;

    if (!image && !voiceText && !existingDescription) {
      return new Response(
        JSON.stringify({ error: 'At least one input (image, voiceText, or existingDescription) must be provided.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const combinedText = [voiceText, existingDescription].filter(Boolean).join(' ').trim();

    // 1. Category Classification via rule-based keyword engine (Kannada + English)
    const categoryResult = classifyCategoryFromText(combinedText);
    const category = categoryResult.category;

    // 2. Title Generation strictly derived from craft facts rather than first words
    const product_name = generateCleanTitle(combinedText, category);
    const local_title = generateLocalTitle(combinedText, category);

    // 3. Description Generation with strict cost privacy
    const description = generateSanitizedDescription(combinedText);
    const local_description = `ಸಾಂಪ್ರದಾಯಿಕ ಕಲೆಯ ನೈಜ ಸೃಷ್ಟಿ: ಈ ಸುಂದರ ಕರಕುಶಲ ಉತ್ಪನ್ನವನ್ನು ಸ್ಥಳೀಯ ನುರಿತ ಕುಶಲಕರ್ಮಿಗಳು ರೂಪಿಸಿದ್ದಾರೆ. ${description}`;

    // 4. Quantity Detection
    const quantity = detectQuantity(combinedText);

    // 5. Keywords Extraction
    const keywords = extractKeywords(combinedText, category);

    // 6. Price Suggestion
    const price_suggestion = detectPriceSuggestion(combinedText, category);

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (combinedText && categoryResult.confidence !== 'low') {
      confidence = 'high';
    } else if (combinedText || image) {
      confidence = 'medium';
    }

    const response = {
      product_name,
      local_title,
      category,
      description,
      local_description,
      keywords,
      price_suggestion,
      confidence,
      quantity,
    };

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
