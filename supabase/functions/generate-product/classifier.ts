// classifier.ts – Deterministic rule-based category classifier for Artisan Connect AI
// Classifies products into one of the 7 supported marketplace categories:
// - Bamboo & Natural Craft
// - Handloom & Textiles
// - Pottery
// - Wood Craft
// - Metal Craft
// - Jewellery
// - Other Handicrafts
// Supports both English craft vocabulary and authentic Kannada Unicode script terms.

export interface CategoryClassificationResult {
  category: string;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords: string[];
}

interface CategoryKeywordDefinition {
  specific: string[];
  generic: string[];
}

export const CATEGORY_DEFINITIONS: Record<string, CategoryKeywordDefinition> = {
  'Bamboo & Natural Craft': {
    specific: [
      'bamboo', 'cane', 'reed', 'jute', 'coir', 'grass', 'straw', 'wicker',
      'rattan', 'palm', 'leaf', 'basketry', 'twine', 'fiber', 'fibre', 'sisal', 'sabai', 'kauna',
      // Kannada stems & inflections
      'ಬಿದಿರು', 'ಬಿದಿರಿನ', 'ಬೆತ್ತ', 'ಬೆತ್ತದ', 'ಸೆಣಬು', 'ಸೆಣಬಿನ', 'ತೆಂಗಿನ ನಾರು', 'ನಾರು', 'ಹುಲ್ಲು'
    ],
    generic: ['mat', 'mats', 'basket', 'baskets', 'ಬುಟ್ಟಿ', 'ಚಾಪೆ']
  },
  'Handloom & Textiles': {
    specific: [
      'handloom', 'textile', 'textiles', 'fabric', 'saree', 'sari', 'shawl',
      'scarf', 'cotton', 'silk', 'wool', 'woolen', 'khadi', 'linen', 'weaving',
      'woven', 'weave', 'embroidered', 'embroidery', 'dupatta', 'stole', 'quilt',
      'kantha', 'ikat', 'chanderi', 'bandhani', 'kalamkari', 'tussar', 'pashmina',
      'carpet', 'rug', 'apparel', 'dress', 'kurta',
      // Kannada stems & inflections
      'ಕೈಮಗ್ಗ', 'ಕೈಮಗ್ಗದ', 'ನೇಯ್ಗೆ', 'ಬಟ್ಟೆ', 'ಸೀರೆ', 'ಶಾಲು', 'ಹತ್ತಿ', 'ಹತ್ತಿಯ', 'ರೇಷ್ಮೆ', 'ರೇಷ್ಮೆಯ', 'ಖಾದಿ', 'ದುಪಟ್ಟಾ', 'ಕುರ್ತಾ'
    ],
    generic: ['towel', 'bedsheet', 'bag', 'tote', 'ಬೆಡ್‌ಶೀಟ್']
  },
  'Pottery': {
    specific: [
      'pottery', 'ceramic', 'ceramics', 'clay', 'terracotta', 'terra-cotta',
      'earthen', 'earthenware', 'stoneware', 'glazed', 'fired clay', 'mud',
      // Kannada stems & inflections
      'ಮಣ್ಣು', 'ಮಣ್ಣಿನ', 'ಕುಂಬಾರಿಕೆ', 'ಟೆರ್ರಾಕೋಟಾ', 'ಜೇಡಿಮಣ್ಣು', 'ಜೇಡಿಮಣ್ಣಿನ'
    ],
    generic: [
      'pot', 'pots', 'vase', 'vases', 'pitcher', 'planter', 'planters', 'diya', 'diyas', 'kulhar', 'kulhad', 'wheel',
      // Kannada generic
      'ಮಡಕೆ', 'ಕುಡಿಕೆ', 'ಹೂದಾನಿ', 'ದೀಪ', 'ಹಣತೆ', 'ಕುಲ್ಹಡ್'
    ]
  },
  'Wood Craft': {
    specific: [
      'wood', 'wooden', 'timber', 'teak', 'sheesham', 'rosewood', 'sandalwood',
      'carved', 'carving', 'carvings', 'lathe', 'lacquer', 'channapatna', 'woodenware', 'carpentry',
      // Kannada stems & inflections
      'ಮರ', 'ಮರದ', 'ಶ್ರೀಗಂಧ', 'ಶ್ರೀಗಂಧದ', 'ತೇಗ', 'ತೇಗದ', 'ರೋಸ್‌ವುಡ್', 'ಕೆತ್ತನೆ', 'ಚನ್ನಪಟ್ಟಣ'
    ],
    generic: ['box', 'boxes', 'toy', 'toys', 'sculpture', 'panel', 'figurine', 'furniture', 'ಆಟಿಕೆ', 'ಗೊಂಬೆ', 'ಪೆಟ್ಟಿಗೆ']
  },
  'Metal Craft': {
    specific: [
      'metal', 'brass', 'bronze', 'copper', 'bell metal', 'iron', 'wrought iron',
      'dokra', 'dhokra', 'bidri', 'bidriware', 'moradabad', 'engraving', 'engraved',
      'casting', 'cast', 'sheet metal', 'metalware', 'tinned',
      // Kannada stems & inflections
      'ಹಿತ್ತಾಳೆ', 'ಹಿತ್ತಾಳೆಯ', 'ಕಂಚು', 'ಕಂಚಿನ', 'ತಾಮ್ರ', 'ತಾಮ್ರದ', 'ಬಿದ್ರಿ', 'ಕಬ್ಬಿಣ', 'ಬೆಲ್ ಮೆಟಲ್', 'ಲೋಹ'
    ],
    generic: ['vessel', 'utensil', 'lamp', 'idol', 'statue', 'ಪಾತ್ರೆ', 'ವಿಗ್ರಹ', 'ದೀಪ']
  },
  'Jewellery': {
    specific: [
      'jewellery', 'jewelry', 'necklace', 'earring', 'earrings', 'bangle',
      'bangles', 'bracelet', 'ring', 'rings', 'pendant', 'anklet', 'bead',
      'beads', 'filigree', 'tarakasi', 'silver', 'kundan', 'meenakari',
      'ornament', 'choker', 'jhumka',
      // Kannada stems & inflections
      'ಆಭರಣ', 'ಒಡವೆ', 'ಬೆಳ್ಳಿ', 'ಬೆಳ್ಳಿಯ', 'ಹಾರ', 'ಓಲೆ', 'ಕಿವಿಯೋಲೆ', 'ಬಳೆ', 'ಉಂಗುರ', 'ಜುಮ್ಕಾ', 'ತಾರಕಾಸಿ'
    ],
    generic: []
  },
  'Other Handicrafts': {
    specific: [
      'papier-mâché', 'papier-mache', 'papier mache', 'paper mache', 'papier mâché',
      'leather', 'mojari', 'mojri', 'juttis', 'jutti', 'kolhapuri',
      'marble', 'marble inlay', 'soapstone', 'stone craft', 'alabaster',
      'coconut shell', 'horn craft', 'bone craft',
      'pattachitra', 'madhubani', 'scroll painting', 'folk painting', 'warli', 'gond',
      // Kannada stems & inflections
      'ಕಾಗದದ ಕಲೆ', 'ಪೇಪರ್ ಮಾಶೆ', 'ಚರ್ಮ', 'ಚರ್ಮದ', 'ಕಲ್ಲು', 'ಕಲ್ಲಿನ', 'ಚಿತ್ರಕಲೆ', 'ಸೋಪ್‌ಸ್ಟೋನ್'
    ],
    generic: []
  }
};

/**
 * Classifies product into a marketplace category using genuine text features.
 * Specific craft & material terms are weighted heavily (3 pts) over generic form terms (1 pt).
 * Supports both English and Kannada Unicode text.
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
  const tokenList = normalized.split(/[^a-z0-9\u00C0-\u017F\u0C80-\u0CFF]+/iu).filter(t => t.length > 1);
  const tokenSet = new Set(tokenList);

  let bestCategory = 'Other Handicrafts';
  let maxScore = 0;
  let bestMatches: string[] = [];
  let bestHasSpecific = false;

  for (const [category, def] of Object.entries(CATEGORY_DEFINITIONS)) {
    let score = 0;
    const matches: string[] = [];
    let hasSpecific = false;

    // 1. Specific craft & material keywords (Weight = 3)
    for (const kw of def.specific) {
      const kwLower = kw.toLowerCase();
      if (kwLower.includes(' ') || kwLower.includes('-')) {
        if (normalized.includes(kwLower)) {
          score += 3;
          matches.push(kw);
          hasSpecific = true;
        }
      } else if (tokenSet.has(kwLower) || normalized.includes(kwLower)) {
        score += 3;
        matches.push(kw);
        hasSpecific = true;
      }
    }

    // 2. Generic product form/container keywords (Weight = 1)
    for (const kw of def.generic) {
      const kwLower = kw.toLowerCase();
      if (kwLower.includes(' ') || kwLower.includes('-')) {
        if (normalized.includes(kwLower)) {
          score += 1;
          matches.push(kw);
        }
      } else if (tokenSet.has(kwLower) || normalized.includes(kwLower)) {
        score += 1;
        matches.push(kw);
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
      bestMatches = matches;
      bestHasSpecific = hasSpecific;
    } else if (score === maxScore && score > 0) {
      // Tie-breaker: prioritize category with specific material/craft matches
      if (hasSpecific && !bestHasSpecific) {
        bestCategory = category;
        bestMatches = matches;
        bestHasSpecific = true;
      }
    }
  }

  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (maxScore >= 6 || (bestHasSpecific && maxScore >= 3)) {
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
  return {
    category: null,
    confidence: 'low',
  };
}
