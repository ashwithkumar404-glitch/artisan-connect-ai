// classifier.ts – Deterministic rule-based category classifier for Artisan Connect AI
// Classifies products into one of the 7 supported marketplace categories:
// - Bamboo & Natural Craft
// - Handloom & Textiles
// - Pottery
// - Wood Craft
// - Metal Craft
// - Jewellery
// - Other Handicrafts

export interface CategoryClassificationResult {
  category: string;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords: string[];
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Bamboo & Natural Craft': [
    'bamboo', 'cane', 'reed', 'jute', 'coir', 'grass', 'straw', 'wicker',
    'rattan', 'palm', 'leaf', 'mat', 'mats', 'basket', 'baskets', 'basketry',
    'twine', 'fiber', 'fibre', 'sisal', 'sabai'
  ],
  'Handloom & Textiles': [
    'handloom', 'textile', 'textiles', 'fabric', 'saree', 'sari', 'shawl',
    'scarf', 'cotton', 'silk', 'wool', 'woolen', 'khadi', 'linen', 'weaving',
    'woven', 'weave', 'embroidered', 'embroidery', 'dupatta', 'stole', 'quilt',
    'kantha', 'ikat', 'chanderi', 'bandhani', 'kalamkari', 'tussar', 'pashmina',
    'carpet', 'rug', 'towel', 'bedsheet', 'apparel', 'dress', 'kurta'
  ],
  'Pottery': [
    'pottery', 'ceramic', 'ceramics', 'clay', 'terracotta', 'terra-cotta',
    'earthen', 'earthenware', 'pot', 'pots', 'vase', 'vases', 'pitcher',
    'planter', 'planters', 'diya', 'diyas', 'kulhar', 'stoneware', 'glazed',
    'wheel', 'mud', 'fired clay'
  ],
  'Wood Craft': [
    'wood', 'wooden', 'timber', 'teak', 'sheesham', 'rosewood', 'sandalwood',
    'carved', 'carving', 'carvings', 'lathe', 'lacquer', 'channapatna', 'toy',
    'toys', 'sculpture', 'panel', 'box', 'boxes', 'figurine', 'furniture',
    'woodenware', 'carpentry'
  ],
  'Metal Craft': [
    'metal', 'brass', 'bronze', 'copper', 'bell metal', 'iron', 'wrought iron',
    'dokra', 'dhokra', 'bidri', 'moradabad', 'engraving', 'engraved', 'casting',
    'cast', 'sheet metal', 'vessel', 'utensil', 'lamp', 'idol', 'statue',
    'metalware', 'tinned'
  ],
  'Jewellery': [
    'jewellery', 'jewelry', 'necklace', 'earring', 'earrings', 'bangle',
    'bangles', 'bracelet', 'ring', 'rings', 'pendant', 'anklet', 'bead',
    'beads', 'filigree', 'tarakasi', 'silver', 'kundan', 'meenakari',
    'ornament', 'choker', 'jhumka'
  ]
};

/**
 * Classifies product into a marketplace category using genuine text features.
 * Evaluates keywords and counts matches deterministically.
 */
export function classifyCategoryFromText(text: string): CategoryClassificationResult {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return {
      category: 'Other Handicrafts',
      confidence: 'low',
      matchedKeywords: []
    };
  }

  const normalized = text.toLowerCase();
  const tokenList = normalized.split(/[^a-z0-9]+/i).filter(t => t.length > 2);
  const tokenSet = new Set(tokenList);

  let bestCategory = 'Other Handicrafts';
  let maxScore = 0;
  let bestMatches: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches: string[] = [];
    for (const kw of keywords) {
      if (kw.includes(' ')) {
        // Multi-word phrase check
        if (normalized.includes(kw)) {
          matches.push(kw);
        }
      } else if (tokenSet.has(kw)) {
        matches.push(kw);
      }
    }

    if (matches.length > maxScore) {
      maxScore = matches.length;
      bestCategory = category;
      bestMatches = matches;
    }
  }

  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (maxScore >= 3) {
    confidence = 'high';
  } else if (maxScore >= 1) {
    confidence = 'medium';
  }

  return {
    category: bestCategory,
    confidence,
    matchedKeywords: bestMatches
  };
}

/**
 * Backward-compatible async helper for image-based category classifier stub.
 */
export async function classifyCategory(
  imageBase64?: string | null,
  mimeType?: string
): Promise<{ category: string | null; confidence: 'high' | 'medium' | 'low' }> {
  // If no text is available, category cannot be reliably inferred from raw base64 alone
  return {
    category: null,
    confidence: 'low',
  };
}
