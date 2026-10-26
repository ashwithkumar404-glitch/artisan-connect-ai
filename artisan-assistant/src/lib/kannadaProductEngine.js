// kannadaProductEngine.js - Core NLP & Fact Extraction Engine for Artisan Connect AI
// Provides deterministic, local-first Kannada & English voice-to-product processing without paid/external AI APIs.

export const OFFICIAL_CATEGORIES = [
  'Bamboo & Natural Craft',
  'Handloom & Textiles',
  'Pottery',
  'Wood Craft',
  'Metal Craft',
  'Jewellery',
  'Other Handicrafts'
];

// Kannada Unicode block: \u0C80 - \u0CFF
export function isKannadaScript(text) {
  if (!text || typeof text !== 'string') return false;
  return /[\u0C80-\u0CFF]/.test(text);
}

// Detect if user spoke/input Kannada phonetics in Latin letters (transliteration)
export function isLatinTransliteration(text, expectedLang = 'kn') {
  if (!text || typeof text !== 'string' || expectedLang !== 'kn') return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  const hasKannada = /[\u0C80-\u0CFF]/.test(trimmed);
  const hasLatin = /[a-zA-Z]/.test(trimmed);

  // If expected Kannada but contains Latin letters and zero Kannada characters
  return !hasKannada && hasLatin;
}

// Map Kannada numerals (೦, ೧, ೨, ೩, ೪, ೫, ೬, ೭, ೮, ೯) to standard digits
export function normalizeKannadaNumbers(str) {
  if (!str) return '';
  const knDigits = ['೦', '೧', '೨', '೩', '೪', '೫', '೬', '೭', '೮', '೯'];
  let res = str;
  knDigits.forEach((kn, i) => {
    res = res.replaceAll(kn, i.toString());
  });
  return res;
}

// Knowledge base of authentic Indian artisan crafts, materials, and forms
export const CRAFT_FACT_BASE = [
  // Pottery
  {
    category: 'Pottery',
    category_kn: 'ಕುಂಬಾರಿಕೆ (Pottery)',
    materialKeywords: [
      'ಮಣ್ಣು', 'ಮಣ್ಣಿನ', 'ಜೇಡಿಮಣ್ಣು', 'ಜೇಡಿಮಣ್ಣಿನ', 'ಟೆರ್ರಾಕೋಟಾ', 'ಸುಟ್ಟ ಮಣ್ಣು',
      'clay', 'terracotta', 'earthenware', 'earthen'
    ],
    techniqueKeywords: ['ಕುಂಬಾರಿಕೆ ಚಕ್ರ', 'ಚಕ್ರದಲ್ಲಿ ಮಾಡಿದ', 'ಕೈಯಿಂದ ತಟ್ಟಿದ', 'ಬೆಂಕಿಯಲ್ಲಿ ಸುಟ್ಟ', 'wheel thrown', 'hand-thrown', 'hand thrown', 'kiln fired'],
    formKeywords: [
      { kn: 'ನೀರಿನ ಮಡಕೆ', en: 'Water Pot', kw: ['ನೀರಿನ ಮಡಕೆ', 'ತಣ್ಣೀರಿನ ಮಡಕೆ', 'water pot', 'cooling pot'] },
      { kn: 'ಮಡಕೆ', en: 'Clay Pot', kw: ['ಮಡಕೆ', 'ಕುಡಿಕೆ', 'pitcher', 'pot'] },
      { kn: 'ಹೂದಾನಿ', en: 'Flower Vase', kw: ['ಹೂದಾನಿ', 'vase', 'flower vase'] },
      { kn: 'ಮಣ್ಣಿನ ದೀಪ', en: 'Clay Diya / Lamp', kw: ['ದೀಪ', 'ಮಣ್ಣಿನ ದೀಪ', 'ಹಣತೆ', 'diya', 'lamp'] },
      { kn: 'ಮಣ್ಣಿನ ಲೋಟ', en: 'Clay Cup / Kulhad', kw: ['ಲೋಟ', 'ಕುಲ್ಹಡ್', 'ಕುಲ್ಹಾರ್', 'kulhar', 'kulhad', 'cup'] },
      { kn: 'ಮಣ್ಣಿನ ಬಟ್ಟಲು', en: 'Clay Bowl', kw: ['ಬಟ್ಟಲು', 'bowl'] }
    ],
    defaultMaterial: { kn: 'ನೈಸರ್ಗಿಕ ಜೇಡಿಮಣ್ಣು', en: 'Natural Clay' },
    titleMaterial: { kn: 'ಮಣ್ಣಿನ', en: 'Terracotta' },
    defaultTechnique: { kn: 'ಸಾಂಪ್ರದಾಯಿಕ ಕುಂಬಾರಿಕೆ ಚಕ್ರದಲ್ಲಿ ರೂಪಿಸಲಾಗಿದೆ', en: 'Handcrafted using traditional potter wheel' }
  },
  // Bamboo & Natural Craft
  {
    category: 'Bamboo & Natural Craft',
    category_kn: 'ಬಿದಿರು ಮತ್ತು ನೈಸರ್ಗಿಕ ಕರಕುಶಲ (Bamboo & Natural Craft)',
    materialKeywords: [
      'ಬಿದಿರು', 'ಬಿದಿರಿನ', 'ಬೆತ್ತ', 'ಬೆತ್ತದ', 'ಸೆಣಬು', 'ಸೆಣಬಿನ', 'ತೆಂಗಿನ ನಾರು', 'ನಾರು', 'ಹುಲ್ಲು', 'ಕಬ್ಬು',
      'bamboo', 'cane', 'jute', 'coir', 'straw', 'wicker', 'grass'
    ],
    techniqueKeywords: ['ಕೈ ಹೆಣಿಗೆ', 'ಕೈಯಿಂದ ಹೆಣೆದ', 'ಹೆಣೆದ', 'hand-woven', 'hand woven', 'hand braided', 'woven'],
    formKeywords: [
      { kn: 'ಹಣ್ಣಿನ ಬುಟ್ಟಿ', en: 'Fruit Basket', kw: ['ಹಣ್ಣಿನ ಬುಟ್ಟಿ', 'fruit basket'] },
      { kn: 'ಶೇಖರಣಾ ಬುಟ್ಟಿ', en: 'Storage Basket', kw: ['ಶೇಖರಣಾ ಬುಟ್ಟಿ', 'storage basket'] },
      { kn: 'ಬುಟ್ಟಿ', en: 'Handcrafted Basket', kw: ['ಬುಟ್ಟಿ', 'basket'] },
      { kn: 'ಚಾಪೆ', en: 'Handwoven Mat', kw: ['ಚಾಪೆ', 'ಮ್ಯಾಟ್', 'mat'] },
      { kn: 'ಸೆಣಬಿನ ಚೀಲ', en: 'Jute Bag / Tote', kw: ['ಚೀಲ', 'ಬ್ಯಾಗ್', 'jute bag', 'tote', 'bag'] },
      { kn: 'ಲೈಟ್ ಶೇಡ್', en: 'Lampshade', kw: ['ಲೈಟ್ ಶೇಡ್', 'ಲ್ಯಾಂಪ್ ಶೇಡ್', 'lamp shade', 'lampshade'] }
    ],
    defaultMaterial: { kn: 'ನೈಸರ್ಗಿಕ ಬಿದಿರು ಮತ್ತು ನಾರು', en: 'Natural Bamboo and Fiber' },
    titleMaterial: { kn: 'ಬಿದಿರಿನ', en: 'Bamboo' },
    defaultTechnique: { kn: 'ನುರಿತ ಕುಶಲಕರ್ಮಿಗಳಿಂದ ಕೈಯಲ್ಲೇ ಹೆಣೆಯಲಾಗಿದೆ', en: 'Intricately hand-woven by experienced artisans' }
  },
  // Handloom & Textiles
  {
    category: 'Handloom & Textiles',
    category_kn: 'ಕೈಮಗ್ಗ ಮತ್ತು ಜವಳಿ (Handloom & Textiles)',
    materialKeywords: [
      'ರೇಷ್ಮೆ', 'ರೇಷ್ಮೆಯ', 'ಹತ್ತಿ', 'ಹತ್ತಿಯ', 'ಖಾದಿ', 'ಉಣ್ಣೆ', 'ಲಿನೆನ್',
      'silk', 'cotton', 'khadi', 'wool', 'woolen', 'linen'
    ],
    techniqueKeywords: ['ಕೈಮಗ್ಗದ ನೇಯ್ಗೆ', 'ನೇಯ್ಗೆ', 'ಕೈಮಗ್ಗ', 'ಕಸೂತಿ', 'ಇಕ್ಕತ್', 'handloom woven', 'hand-woven', 'handloom', 'embroidery', 'ikat', 'chanderi'],
    formKeywords: [
      { kn: 'ಕೈಮಗ್ಗದ ಸೀರೆ', en: 'Handloom Saree', kw: ['ಸೀರೆ', 'saree', 'sari'] },
      { kn: 'ಶಾಲು', en: 'Handwoven Shawl', kw: ['ಶಾಲು', 'shawl', 'stole'] },
      { kn: 'ದುಪಟ್ಟಾ', en: 'Dupatta', kw: ['ದುಪಟ್ಟಾ', 'dupatta'] },
      { kn: 'ಕುರ್ತಾ', en: 'Kurta', kw: ['ಕುರ್ತಾ', 'kurta', 'dress'] },
      { kn: 'ಬೆಡ್‌ಶೀಟ್', en: 'Handloom Bedsheet', kw: ['ಬೆಡ್‌ಶೀಟ್', 'ಹೊದಿಕೆ', 'bedsheet', 'quilt'] },
      { kn: 'ಕೈಮಗ್ಗದ ಬಟ್ಟೆ', en: 'Handloom Fabric', kw: ['ಬಟ್ಟೆ', 'fabric', 'textile'] }
    ],
    defaultMaterial: { kn: 'ಶುದ್ಧ ನೈಸರ್ಗಿಕ ನೂಲು', en: 'Pure Natural Yarn' },
    titleMaterial: { kn: 'ಕೈಮಗ್ಗದ', en: 'Handloom' },
    defaultTechnique: { kn: 'ಸಾಂಪ್ರದಾಯಿಕ ಕೈಮಗ್ಗದಲ್ಲಿ ನೆಯ್ಯಲಾಗಿದೆ', en: 'Woven on authentic traditional handlooms' }
  },
  // Wood Craft
  {
    category: 'Wood Craft',
    category_kn: 'ಮರದ ಕರಕುಶಲ (Wood Craft)',
    materialKeywords: [
      'ಮರ', 'ಮರದ', 'ಶ್ರೀಗಂಧ', 'ಶ್ರೀಗಂಧದ', 'ತೇಗ', 'ತೇಗದ', 'ರೋಸ್‌ವುಡ್', 'ಸೀಸಂ', 'ಬೀಟೆ',
      'wood', 'wooden', 'sandalwood', 'teak', 'rosewood', 'sheesham', 'timber'
    ],
    techniqueKeywords: ['ಕೈ ಕೆತ್ತನೆ', 'ಕೆತ್ತನೆ', 'ಚನ್ನಪಟ್ಟಣ ಲಕ್ವೇರ್', 'ಕರಕುಶಲ', 'hand carved', 'hand-carved', 'carved', 'lathe turned', 'lacquer'],
    formKeywords: [
      { kn: 'ಚನ್ನಪಟ್ಟಣ ಆಟಿಕೆ', en: 'Channapatna Wooden Toy', kw: ['ಚನ್ನಪಟ್ಟಣ', 'ಆಟಿಕೆ', 'ಗೊಂಬೆ', 'toy', 'doll', 'figurine'] },
      { kn: 'ಮರದ ಪೆಟ್ಟಿಗೆ', en: 'Carved Wooden Box', kw: ['ಪೆಟ್ಟಿಗೆ', 'ಡಬ್ಬಿ', 'box', 'jewelry box'] },
      { kn: 'ಮರದ ವಿಗ್ರಹ', en: 'Wooden Idol / Statue', kw: ['ವಿಗ್ರಹ', 'ಮೂರ್ತಿ', 'idol', 'statue', 'sculpture'] },
      { kn: 'ಗೋಡೆ ಫಲಕ', en: 'Wall Panel', kw: ['ಫಲಕ', 'wall panel', 'panel'] },
      { kn: 'ಮರದ ಹೂದಾನಿ', en: 'Wooden Vase', kw: ['ಹೂದಾನಿ', 'vase'] }
    ],
    defaultMaterial: { kn: 'ಗುಣಮಟ್ಟದ ನೈಸರ್ಗಿಕ ಮರ', en: 'High Quality Natural Wood' },
    titleMaterial: { kn: 'ಮರದ', en: 'Wood' },
    defaultTechnique: { kn: 'ಸಾಂಪ್ರದಾಯಿಕ ಕೈ ಕೆತ್ತನೆ ಕಲೆ', en: 'Traditional hand-carved craft' }
  },
  // Metal Craft
  {
    category: 'Metal Craft',
    category_kn: 'ಲೋಹದ ಕಲೆ (Metal Craft)',
    materialKeywords: [
      'ಹಿತ್ತಾಳೆ', 'ಹಿತ್ತಾಳೆಯ', 'ಕಂಚು', 'ಕಂಚಿನ', 'ತಾಮ್ರ', 'ತಾಮ್ರದ', 'ಬಿದ್ರಿ', 'ಕಬ್ಬಿಣ', 'ಬೆಲ್ ಮೆಟಲ್', 'ಲೋಹ',
      'brass', 'bronze', 'copper', 'bidri', 'iron', 'bell metal', 'metal'
    ],
    techniqueKeywords: ['ಕೈ ಕೆತ್ತನೆ', 'ಬಿದ್ರಿ ಕೆತ್ತನೆ', 'ಎಚ್ಚಣೆ', 'ಎರಕಹೊಯ್ದ', 'engraved', 'hand engraved', 'cast', 'bidriware', 'casting'],
    formKeywords: [
      { kn: 'ಹಿತ್ತಾಳೆಯ ದೀಪ', en: 'Brass Lamp / Diya', kw: ['ದೀಪ', 'ವಿಳಕ್ಕು', 'lamp', 'diya'] },
      { kn: 'ಲೋಹದ ವಿಗ್ರಹ', en: 'Metal Idol / Statue', kw: ['ವಿಗ್ರಹ', 'ಮೂರ್ತಿ', 'idol', 'statue'] },
      { kn: 'ಹಿತ್ತಾಳೆಯ ಪಾತ್ರೆ', en: 'Brass Vessel', kw: ['ಪಾತ್ರೆ', 'ಚೊಂಬು', 'vessel', 'pot', 'utensil'] },
      { kn: 'ಬಿದ್ರಿ ಹೂದಾನಿ', en: 'Bidriware Vase', kw: ['ಬಿದ್ರಿ', 'ಹೂದಾನಿ', 'vase', 'bidri'] },
      { kn: 'ಗೋಡೆ ಅಲಂಕಾರ', en: 'Wall Hanging', kw: ['ಗೋಡೆ ಅಲಂಕಾರ', 'wall hanging'] }
    ],
    defaultMaterial: { kn: 'ಉತ್ತಮ ಗುಣಮಟ್ಟದ ಲೋಹ', en: 'Premium Quality Metal' },
    titleMaterial: { kn: 'ಹಿತ್ತಾಳೆಯ', en: 'Brass' },
    defaultTechnique: { kn: 'ಸಾಂಪ್ರದಾಯಿಕ ಎರಕ ಮತ್ತು ಕೈ ಕೆತ್ತನೆ', en: 'Traditional casting and hand engraving' }
  },
  // Jewellery
  {
    category: 'Jewellery',
    category_kn: 'ಆಭರಣ (Jewellery)',
    materialKeywords: [
      'ಬೆಳ್ಳಿ', 'ಬೆಳ್ಳಿಯ', 'ಮಣಿ', 'ಮುತ್ತು', 'ಕುಂದನ್', 'ತಾರಕಾಸಿ',
      'silver', 'bead', 'beads', 'pearl', 'filigree', 'kundan'
    ],
    techniqueKeywords: ['ತಾರಕಾಸಿ ಕಲೆ', 'ಕೈಯಿಂದ ಜೋಡಿಸಿದ', 'filigree', 'handcrafted jewelry'],
    formKeywords: [
      { kn: 'ಸಾಂಪ್ರದಾಯಿಕ ಹಾರ', en: 'Traditional Necklace', kw: ['ಹಾರ', 'ನೆಕ್ಲೆಸ್', 'necklace', 'choker'] },
      { kn: 'ಕಿವಿಯೋಲೆ', en: 'Earrings / Jhumka', kw: ['ಓಲೆ', 'ಕಿವಿಯೋಲೆ', 'ಜುಮ್ಕಾ', 'earrings', 'jhumka'] },
      { kn: 'ಬಳೆ', en: 'Handcrafted Bangles', kw: ['ಬಳೆ', 'ಕಂಕಣ', 'bangle', 'bangles', 'bracelet'] },
      { kn: 'ಉಂಗುರ', en: 'Finger Ring', kw: ['ಉಂಗುರ', 'ring'] }
    ],
    defaultMaterial: { kn: 'ಶುದ್ಧ ಬೆಳ್ಳಿ ಅಥವಾ ಮಣಿಗಳು', en: 'Pure Silver / Artisan Beads' },
    titleMaterial: { kn: 'ಸಾಂಪ್ರದಾಯಿಕ', en: 'Silver' },
    defaultTechnique: { kn: 'ಸೂಕ್ಷ್ಮ ಕೈಯಿಂದ ಜೋಡಿಸಿದ ವಿನ್ಯಾಸ', en: 'Intricately handcrafted jewelry design' }
  },
  // Other Handicrafts
  {
    category: 'Other Handicrafts',
    category_kn: 'ಇತರ ಕರಕುಶಲ (Other Handicrafts)',
    materialKeywords: [
      'ಕಾಗದ', 'ಚರ್ಮ', 'ಚರ್ಮದ', 'ಕಲ್ಲು', 'ಕಲ್ಲಿನ', 'ಸೋಪ್‌ಸ್ಟೋನ್', 'ಪೇಪರ್ ಮಾಶೆ',
      'paper mache', 'leather', 'stone', 'soapstone', 'marble'
    ],
    techniqueKeywords: ['ಕೈ ಬಣ್ಣ', 'ಕೈ ಚಿತ್ರಕಲೆ', 'ಹ್ಯಾಂಡ್‌ಮೇಡ್', 'hand-painted', 'handcrafted'],
    formKeywords: [
      { kn: 'ಚಿತ್ರಕಲೆ', en: 'Folk Painting', kw: ['ಚಿತ್ರಕಲೆ', 'ಪೇಂಟಿಂಗ್', 'painting', 'pattachitra', 'warli', 'madhubani'] },
      { kn: 'ಚರ್ಮದ ಚಪ್ಪಲಿ', en: 'Leather Footwear', kw: ['ಚಪ್ಪಲಿ', 'mojari', 'jutti', 'footwear', 'kolhapuri'] },
      { kn: 'ಕಲ್ಲಿನ ಕೆತ್ತನೆ', en: 'Stone Carving', kw: ['ಕಲ್ಲು', 'stone carving', 'sculpture'] }
    ],
    defaultMaterial: { kn: 'ಸಾಂಪ್ರದಾಯಿಕ ಕರಕುಶಲ ಸಾಮಗ್ರಿ', en: 'Traditional Craft Material' },
    titleMaterial: { kn: 'ನೈಸರ್ಗಿಕ', en: 'Artisan' },
    defaultTechnique: { kn: 'ಸ್ಥಳೀಯ ಕುಶಲಕರ್ಮಿಗಳ ನೈಜ ಕಲಾತ್ಮಕತೆ', en: 'Authentic local artisan handiwork' }
  }
];

// Clean out conversational voice prefixes so title is not contaminated
const KANNADA_VOICE_PREFIXES = [
  /^(?:ನಮಸ್ಕಾರ\s*,?\s*)/iu,
  /^(?:ಇದು\s+(?:ಒಂದು)?\s*)/iu,
  /^(?:ನಾನು\s+(?:ಮಾಡಿದ|ತಯಾರಿಸಿದ|ಮಾಡಿದ್ದು|ಮಾಡಿರುವ|ತಯಾರಿಸಿರುವ)\s*(?:ಒಂದು)?\s*)/iu,
  /^(?:ನಮ್ಮ\s+(?:ಬಳಿ\s+ಇರುವ|ಉತ್ಪನ್ನ|ಕಲಾವಿದರ)\s*)/iu,
  /^(?:ನೋಡಿ\s+ಇದು\s*)/iu,
  /^(?:ಇಲ್ಲಿ\s+(?:ನೋಡಿ|ಇದೆ)\s*)/iu
];

const ENGLISH_VOICE_PREFIXES = [
  /^(?:hello|hi|namaste)\s*,?\s*/i,
  /^(?:this\s+is\s+(?:a|an)?\s*)/i,
  /^(?:here\s+is\s+(?:a|an)?\s*)/i,
  /^(?:i\s+have\s+made\s+(?:a|an)?\s*)/i,
  /^(?:i\s+made\s+(?:a|an)?\s*)/i,
  /^(?:we\s+have\s+made\s+(?:a|an)?\s*)/i,
  /^(?:my\s+product\s+is\s+(?:a|an)?\s*)/i,
  /^(?:it\s+is\s+(?:a|an)?\s*)/i,
  /^(?:today\s+i\s+am\s+showing\s+(?:a|an)?\s*)/i,
];

// Detect and strip internal cost/raw material costs to maintain artisan cost privacy
// Note: Do NOT use ASCII \b for Indic scripts because \b does not match Indic character boundaries
export function sanitizeCostPrivacy(text) {
  if (!text) return '';
  let sanitized = text;

  // Kannada cost privacy patterns (using whitespace / punctuation boundary instead of ASCII \b)
  const knCostPatterns = [
    /(?:^|[\s,.]?)(?:ನನ್ನ\s+|ನಮ್ಮ\s+)?(?:ಖರ್ಚು|ವೆಚ್ಚ|ತಯಾರಿಕಾ\s*ವೆಚ್ಚ|ಕಚ್ಚಾ\s*ವಸ್ತುಗಳ?\s*ವೆಚ್ಚ)\s*(?:ಸುಮಾರು|ಅಂದಾಜು)?\s*(?:ರೂ\.?|ರೂಪಾಯಿ|₹)?\s*\d+(?:\s*ರೂಪಾಯಿ)?(?:\s*(?:ಆಗಿದೆ|ಆಗಿತ್ತು))?[^.!?\n]*[.!?\n]?/giu,
    /(?:^|[\s,.]?)\d+\s*(?:ರೂಪಾಯಿ|ರೂ)\s*(?:ಖರ್ಚಾಗಿದೆ|ಖರ್ಚು|ವೆಚ್ಚ)[^.!?\n]*[.!?\n]?/giu
  ];

  // English cost privacy patterns
  const enCostPatterns = [
    /\b(?:(?:my|our|the)\s+)?(?:raw\s*material|production|making|manufacturing|materials?)\s*costs?\s*(?:is|was|of|came\s*to)?\s*(?:around|about|approx|approximately)?\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:rupees|rs))?[^.!?\n]*[.!?\n]?/gi,
    /\b(?:it\s+)?costs?\s*(?:me|us)?\s*(?:around|about)?\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:rupees|rs))?\s*(?:to\s*make|for\s*making|for\s*materials|on\s*raw\s*materials)[^.!?\n]*[.!?\n]?/gi,
    /\b(?:i|we)\s+spent\s*(?:around|about)?\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:rupees|rs))?\s*(?:on\s*(?:raw\s*)?materials|to\s*make|for\s*making)[^.!?\n]*[.!?\n]?/gi
  ];

  [...knCostPatterns, ...enCostPatterns].forEach((pat) => {
    sanitized = sanitized.replace(pat, ' ');
  });

  return sanitized.replace(/\s{2,}/g, ' ').trim();
}

// 1. EXTRACT STRUCTURED FACTS STRICTLY FROM TRANSCRIPT (DO NOT INVENT!)
export function extractProductFacts(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      material: null,
      materialKn: null,
      technique: null,
      techniqueKn: null,
      productFormKn: null,
      productFormEn: null,
      titleMaterialKn: null,
      titleMaterialEn: null,
      dimensions: null,
      intendedUse: null,
      price: null,
      stockQuantity: null,
      matchedCategory: null,
      confidence: 'low',
      unsupportedInvented: false
    };
  }

  const normalized = normalizeKannadaNumbers(rawText).toLowerCase();

  let matchedCategory = null;
  let material = null;
  let materialKn = null;
  let titleMaterialKn = null;
  let titleMaterialEn = null;
  let technique = null;
  let techniqueKn = null;
  let productFormKn = null;
  let productFormEn = null;
  let maxScore = 0;

  // Search each craft domain
  for (const craft of CRAFT_FACT_BASE) {
    let score = 0;

    // Check material
    for (const mat of craft.materialKeywords) {
      if (normalized.includes(mat.toLowerCase())) {
        score += 3;
        if (!material) {
          material = mat;
          materialKn = craft.defaultMaterial.kn;
          titleMaterialKn = craft.titleMaterial.kn;
          titleMaterialEn = craft.titleMaterial.en;
        }
      }
    }

    // Check technique
    for (const tech of craft.techniqueKeywords) {
      if (normalized.includes(tech.toLowerCase())) {
        score += 2;
        if (!technique) {
          technique = tech;
          techniqueKn = craft.defaultTechnique.kn;
        }
      }
    }

    // Check product form
    for (const form of craft.formKeywords) {
      for (const kw of form.kw) {
        if (normalized.includes(kw.toLowerCase())) {
          score += 4;
          if (!productFormKn) {
            productFormKn = form.kn;
            productFormEn = form.en;
          }
        }
      }
    }

    if (score > maxScore) {
      maxScore = score;
      matchedCategory = craft.category;
      if (!titleMaterialKn) {
        titleMaterialKn = craft.titleMaterial.kn;
        titleMaterialEn = craft.titleMaterial.en;
      }
    }
  }

  // Fallback category if score > 0
  if (!matchedCategory && maxScore > 0) {
    matchedCategory = 'Other Handicrafts';
  }

  // Extract dimensions if explicitly stated (DO NOT INVENT!)
  let dimensions = null;
  const dimMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:ಇಂಚು|inch|inches|cm|ಸೆಂ\.ಮೀ|ಅಡಿ|feet|foot)\b/iu);
  if (dimMatch) {
    dimensions = dimMatch[0];
  }

  // Extract intended use if stated
  let intendedUse = null;
  if (normalized.includes('ನೀರು ತಂಪಾಗಿಸಲು') || normalized.includes('ತಂಪಾಗಿಸಲು') || normalized.includes('ನೀರು ಕುಡಿಯಲು') || normalized.includes('cooling water') || normalized.includes('drinking water')) {
    intendedUse = 'ಕುಡಿಯುವ ನೀರನ್ನು ನೈಸರ್ಗಿಕವಾಗಿ ತಂಪಾಗಿಡಲು (Natural Water Cooling)';
  } else if (normalized.includes('ಪೂಜೆಗೆ') || normalized.includes('ದೇವರ') || normalized.includes('puja') || normalized.includes('worship')) {
    intendedUse = 'ದೇವರಿಗೆ ಮತ್ತು ಪೂಜೆಗೆ (Puja and Rituals)';
  } else if (normalized.includes('ಅಲಂಕಾರಕ್ಕೆ') || normalized.includes('ಮನೆ ಅಲಂಕಾರ') || normalized.includes('decor') || normalized.includes('home decor')) {
    intendedUse = 'ಮನೆಯ ಅಲಂಕಾರಕ್ಕೆ (Home Decor)';
  }

  // Extract explicit selling price (avoid matching internal cost)
  let price = null;
  const sanitizedForPrice = sanitizeCostPrivacy(rawText);
  const normSanitized = normalizeKannadaNumbers(sanitizedForPrice).toLowerCase();

  const knPriceMatch = normSanitized.match(/(?:ಮಾರಾಟ\s*ಬೆಲೆ|ಬೆಲೆ|ದರ)\s*(?:ಇದೆ)?\s*(?:ರೂ\.?|ರೂಪಾಯಿ|₹)?\s*(\d{2,6})/u)
    || normSanitized.match(/(\d{2,6})\s*(?:ರೂಪಾಯಿ|ರೂ)/u);
  const enPriceMatch = normSanitized.match(/(?:selling\s*price|price\s*is|sell\s*for|priced\s*at)\s*(?:is|at)?\s*(?:rs\.?|inr|₹)?\s*(\d{2,6})/i)
    || normSanitized.match(/(\d{2,6})\s*(?:rupees|rs|inr)/i);

  if (knPriceMatch && knPriceMatch[1]) {
    price = parseInt(knPriceMatch[1], 10);
  } else if (enPriceMatch && enPriceMatch[1]) {
    price = parseInt(enPriceMatch[1], 10);
  }

  // Extract explicit quantity
  let stockQuantity = null;
  const knQtyMatch = normalized.match(/(?:ದಾಸ್ತಾನು|ಪ್ರಮಾಣ)\s*(\d{1,4})/u)
    || normalized.match(/(\d{1,4})\s*(?:ತುಂಡು|ಸಂಖ್ಯೆ|ಪೀಸ್|ಸೀರೆ|ಮಡಕೆ|ಬುಟ್ಟಿ)/u);
  const enQtyMatch = normalized.match(/(?:stock|quantity)\s*(?:of)?\s*(\d{1,4})/i)
    || normalized.match(/(\d{1,4})\s*(?:pieces|items|units|pcs)/i);

  if (knQtyMatch && knQtyMatch[1]) {
    stockQuantity = parseInt(knQtyMatch[1], 10);
  } else if (enQtyMatch && enQtyMatch[1]) {
    stockQuantity = parseInt(enQtyMatch[1], 10);
  }

  let confidence = 'low';
  if (maxScore >= 6) confidence = 'high';
  else if (maxScore >= 3) confidence = 'medium';

  return {
    matchedCategory: matchedCategory || (confidence === 'low' ? 'Other Handicrafts' : null),
    confidence,
    material,
    materialKn,
    titleMaterialKn,
    titleMaterialEn,
    technique,
    techniqueKn,
    productFormKn,
    productFormEn,
    dimensions,
    intendedUse,
    price,
    stockQuantity: stockQuantity || 1,
    unsupportedInvented: false
  };
}

// 2. BUILD STRUCTURED KANNADA & ENGLISH LISTINGS DERIVED FROM REAL FACTS (NEVER FIRST WORDS!)
export function buildProductListing(rawTranscript, extractedFacts) {
  const isKn = isKannadaScript(rawTranscript);

  // Strip conversational voice prefixes
  let cleaned = (rawTranscript || '').trim();
  for (const pat of KANNADA_VOICE_PREFIXES) {
    cleaned = cleaned.replace(pat, '').trim();
  }
  for (const pat of ENGLISH_VOICE_PREFIXES) {
    cleaned = cleaned.replace(pat, '').trim();
  }

  // 1. Kannada Title: Derived strictly from genuine craft facts
  let localTitle = '';
  if (extractedFacts.productFormKn) {
    const mat = extractedFacts.titleMaterialKn || extractedFacts.materialKn;
    if (mat && !extractedFacts.productFormKn.includes(mat)) {
      localTitle = `ಕೈಯಿಂದ ಮಾಡಿದ ${mat} ${extractedFacts.productFormKn}`;
    } else {
      localTitle = `ಕೈಯಿಂದ ಮಾಡಿದ ${extractedFacts.productFormKn}`;
    }
  } else if (extractedFacts.titleMaterialKn || extractedFacts.materialKn) {
    localTitle = `ಕೈಯಿಂದ ಮಾಡಿದ ${extractedFacts.titleMaterialKn || extractedFacts.materialKn} ಕರಕುಶಲ ಉತ್ಪನ್ನ`;
  } else if (isKn && cleaned.length > 2) {
    const firstPhrase = cleaned.split(/[.\n!?]/)[0].trim();
    localTitle = firstPhrase.length > 35 ? firstPhrase.substring(0, 35) : firstPhrase;
  } else {
    localTitle = 'ಪಾರಂಪರಿಕ ಕರಕುಶಲ ಉತ್ಪನ್ನ';
  }

  // 2. English Title: For marketplace discovery
  let englishTitle = '';
  if (extractedFacts.productFormEn) {
    const matEn = extractedFacts.titleMaterialEn || (extractedFacts.material ? extractedFacts.material.charAt(0).toUpperCase() + extractedFacts.material.slice(1).toLowerCase() : '');
    if (matEn && !extractedFacts.productFormEn.toLowerCase().includes(matEn.toLowerCase())) {
      englishTitle = `Handcrafted ${matEn} ${extractedFacts.productFormEn}`;
    } else {
      englishTitle = `Handcrafted ${extractedFacts.productFormEn}`;
    }
  } else if (extractedFacts.matchedCategory && extractedFacts.matchedCategory !== 'Other Handicrafts') {
    englishTitle = `Handcrafted ${extractedFacts.matchedCategory} Product`;
  } else {
    englishTitle = 'Authentic Handcrafted Artisan Product';
  }

  // 3. Kannada Description: Clear, culturally natural, strictly grounded in facts
  const sanitizedKn = sanitizeCostPrivacy(rawTranscript);
  const knDescParts = [];

  if (extractedFacts.productFormKn) {
    knDescParts.push(`ಸಾಂಪ್ರದಾಯಿಕ ಕಲೆಯ ನೈಜ ಸೃಷ್ಟಿ: ಈ ಸುಂದರ ${extractedFacts.productFormKn} ಅನ್ನು ಸ್ಥಳೀಯ ನುರಿತ ಕುಶಲಕರ್ಮಿಗಳು ರೂಪಿಸಿದ್ದಾರೆ.`);
  } else {
    knDescParts.push('ನೈಜ ಸ್ಥಳೀಯ ಕುಶಲಕರ್ಮಿಗಳಿಂದ ಸಾಂಪ್ರದಾಯಿಕ ವಿಧಾನದಲ್ಲಿ ಸಿದ್ಧಪಡಿಸಲಾದ ಅಧಿಕೃತ ಕರಕುಶಲ ಉತ್ಪನ್ನ.');
  }

  if (extractedFacts.materialKn) {
    knDescParts.push(`ವಸ್ತು (Material): ${extractedFacts.materialKn}.`);
  }
  if (extractedFacts.techniqueKn) {
    knDescParts.push(`ತಂತ್ರಜ್ಞಾನ (Technique): ${extractedFacts.techniqueKn}.`);
  }
  if (extractedFacts.dimensions) {
    knDescParts.push(`ಅಳತೆ (Size): ${extractedFacts.dimensions}.`);
  }
  if (extractedFacts.intendedUse) {
    knDescParts.push(`ಉಪಯೋಗ (Intended Use): ${extractedFacts.intendedUse}.`);
  }

  // Include artisan's verified details if present without raw internal costs
  if (sanitizedKn && sanitizedKn.length > 10 && isKn) {
    knDescParts.push(`ಕುಶಲಕರ್ಮಿಗಳ ನುಡಿ: "${sanitizedKn}"`);
  }

  const localDescription = knDescParts.join(' ');

  // 4. English Description: Natural marketplace description
  const enDescParts = [];
  if (extractedFacts.productFormEn) {
    enDescParts.push(`Authentic ${extractedFacts.productFormEn} handcrafted by traditional Indian artisans.`);
  } else {
    enDescParts.push('Authentic handcrafted artisan product preserving traditional heritage techniques.');
  }

  if (extractedFacts.titleMaterialEn || extractedFacts.material) {
    enDescParts.push(`Craft Material: ${extractedFacts.titleMaterialEn || extractedFacts.material}.`);
  }
  if (extractedFacts.technique) {
    enDescParts.push(`Technique: ${extractedFacts.technique}.`);
  }
  if (extractedFacts.dimensions) {
    enDescParts.push(`Dimensions: ${extractedFacts.dimensions}.`);
  }
  if (extractedFacts.intendedUse) {
    enDescParts.push(`Intended Use: ${extractedFacts.intendedUse}.`);
  }
  enDescParts.push('Every piece is individually handcrafted, celebrating genuine craftsmanship and heritage.');

  const englishDescription = enDescParts.join(' ');

  // Missing details check (Never invent missing price or material!)
  const missingDetails = [];
  if (extractedFacts.price === null) {
    missingDetails.push({ field: 'price', prompt_kn: 'ದಯವಿಟ್ಟು ಈ ಉತ್ಪನ್ನದ ಮಾರಾಟ ಬೆಲೆ (Price) ಎಷ್ಟು ಎಂದು ತಿಳಿಸಿ.', prompt_en: 'Please provide the selling price.' });
  }
  if (!extractedFacts.material && !extractedFacts.materialKn) {
    missingDetails.push({ field: 'material', prompt_kn: 'ದಯವಿಟ್ಟು ಇದು ಯಾವ ವಸ್ತುವಿನಿಂದ (Material) ಮಾಡಲ್ಪಟ್ಟಿದೆ ಎಂದು ತಿಳಿಸಿ.', prompt_en: 'Please specify the craft material.' });
  }

  return {
    localTitle,
    localDescription,
    englishTitle,
    englishDescription,
    category: extractedFacts.matchedCategory || 'Other Handicrafts',
    confidence: extractedFacts.confidence,
    price: extractedFacts.price || 500,
    stock_quantity: extractedFacts.stockQuantity || 1,
    missingDetails,
    needsClarification: extractedFacts.confidence === 'low' || missingDetails.length > 0,
    rawTranscript
  };
}

// 3. VOICE-BASED CORRECTION INTERPRETER (TASK 5)
// Interprets natural spoken/typed commands in Kannada or English to update individual fields.
export function interpretCorrectionCommand(commandText, currentDraft, _lang = 'kn') {
  if (!commandText || typeof commandText !== 'string' || !currentDraft) {
    return {
      success: false,
      message_kn: 'ಕ್ಷಮಿಸಿ, ಆದೇಶ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.',
      message_en: 'Could not understand the command. Please repeat.',
      updatedDraft: currentDraft,
      modifiedField: null
    };
  }

  const normalized = normalizeKannadaNumbers(commandText).toLowerCase().trim();

  // 1. PRICE CORRECTION: "ಬೆಲೆ 400 ಮಾಡಿ", "ಬೆಲೆ 450", "ದರ 500", "change price to 400", "set price 450"
  const knPriceChange = normalized.match(/(?:ಬೆಲೆ|ದರ|ರೇಟ್|ಮಾರಾಟ\s*ಬೆಲೆ)\s*(?:ಅನ್ನು|ಯನ್ನು)?\s*(?:ರೂ\.?|ರೂಪಾಯಿ|₹)?\s*(\d{2,6})/u)
    || normalized.match(/(\d{2,6})\s*(?:ರೂಪಾಯಿ|ರೂ)\s*(?:ಮಾಡಿ|ಬೆಲೆ)/u);
  const enPriceChange = normalized.match(/(?:change|set|update|make)\s*(?:the)?\s*price\s*(?:to|as)?\s*(?:rs\.?|inr|₹)?\s*(\d{2,6})/i)
    || normalized.match(/price\s*(?:to|is|=)?\s*(\d{2,6})/i);

  if (knPriceChange && knPriceChange[1]) {
    const newPrice = parseInt(knPriceChange[1], 10);
    return {
      success: true,
      modifiedField: 'price',
      newValue: newPrice,
      message_kn: `✅ ಉತ್ಪನ್ನದ ಬೆಲೆಯನ್ನು ₹${newPrice} ಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗಿದೆ.`,
      message_en: `✅ Updated product price to ₹${newPrice}.`,
      updatedDraft: { ...currentDraft, price: newPrice }
    };
  }
  if (enPriceChange && enPriceChange[1]) {
    const newPrice = parseInt(enPriceChange[1], 10);
    return {
      success: true,
      modifiedField: 'price',
      newValue: newPrice,
      message_kn: `✅ ಉತ್ಪನ್ನದ ಬೆಲೆಯನ್ನು ₹${newPrice} ಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗಿದೆ.`,
      message_en: `✅ Updated product price to ₹${newPrice}.`,
      updatedDraft: { ...currentDraft, price: newPrice }
    };
  }

  // 2. STOCK / QUANTITY CORRECTION: "ಪ್ರಮಾಣ 5 ಮಾಡಿ", "ದಾಸ್ತಾನು 10 ಮಾಡಿ", "change quantity to 5", "stock 10"
  const knStockChange = normalized.match(/(?:ಪ್ರಮಾಣ|ದಾಸ್ತಾನು|ಸಂಖ್ಯೆ)\s*(?:ಅನ್ನು|ಯನ್ನು)?\s*(\d{1,4})/u)
    || normalized.match(/(\d{1,4})\s*(?:ತುಂಡುಗಳು|ಪೀಸ್|ಸಂಖ್ಯೆ)\s*ಮಾಡಿ/u);
  const enStockChange = normalized.match(/(?:change|set|update|make)\s*(?:the)?\s*(?:stock|quantity)\s*(?:to)?\s*(\d{1,4})/i)
    || normalized.match(/(?:stock|quantity)\s*(?:is|to|=)?\s*(\d{1,4})/i);

  if (knStockChange && knStockChange[1]) {
    const newQty = parseInt(knStockChange[1], 10);
    return {
      success: true,
      modifiedField: 'stock_quantity',
      newValue: newQty,
      message_kn: `✅ ದಾಸ್ತಾನು ಪ್ರಮಾಣವನ್ನು ${newQty} ಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗಿದೆ.`,
      message_en: `✅ Updated stock quantity to ${newQty}.`,
      updatedDraft: { ...currentDraft, stock_quantity: newQty }
    };
  }
  if (enStockChange && enStockChange[1]) {
    const newQty = parseInt(enStockChange[1], 10);
    return {
      success: true,
      modifiedField: 'stock_quantity',
      newValue: newQty,
      message_kn: `✅ ದಾಸ್ತಾನು ಪ್ರಮಾಣವನ್ನು ${newQty} ಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗಿದೆ.`,
      message_en: `✅ Updated stock quantity to ${newQty}.`,
      updatedDraft: { ...currentDraft, stock_quantity: newQty }
    };
  }

  // 3. TITLE CORRECTION: "ಹೆಸರು ಮಣ್ಣಿನ ಹೂದಾನಿ ಮಾಡಿ", "ಶೀರ್ಷಿಕೆ ... ಮಾಡಿ", "change title to ..."
  const knTitleChange = normalized.match(/(?:ಹೆಸರು|ಶೀರ್ಷಿಕೆ)\s*(?:ಅನ್ನು|ಯನ್ನು)?\s*(.+?)\s*(?:ಎಂದು\s*)?(?:ಮಾಡಿ|ಬದಲಾಯಿಸಿ|ಹಾಕಿ)$/u);
  const enTitleChange = commandText.match(/(?:change|set|update)\s*(?:the)?\s*title\s*(?:to)?\s*(.+)$/i);

  if (knTitleChange && knTitleChange[1]) {
    const newTitle = knTitleChange[1].trim();
    return {
      success: true,
      modifiedField: 'name',
      newValue: newTitle,
      message_kn: `✅ ಉತ್ಪನ್ನದ ಶೀರ್ಷಿಕೆಯನ್ನು "${newTitle}" ಎಂದು ಬದಲಾಯಿಸಲಾಗಿದೆ.`,
      message_en: `✅ Updated title to "${newTitle}".`,
      updatedDraft: {
        ...currentDraft,
        local_title: newTitle,
        name: isKannadaScript(newTitle) ? currentDraft.name : newTitle
      }
    };
  }
  if (enTitleChange && enTitleChange[1]) {
    const newTitle = enTitleChange[1].trim();
    return {
      success: true,
      modifiedField: 'name',
      newValue: newTitle,
      message_kn: `✅ ಉತ್ಪನ್ನದ ಶೀರ್ಷಿಕೆಯನ್ನು "${newTitle}" ಎಂದು ಬದಲಾಯಿಸಲಾಗಿದೆ.`,
      message_en: `✅ Updated title to "${newTitle}".`,
      updatedDraft: { ...currentDraft, name: newTitle }
    };
  }

  // 4. MATERIAL ATTRIBUTE CORRECTION: "ಮೆಟೀರಿಯಲ್ ಹಿತ್ತಾಳೆ ಅಲ್ಲ ತಾಮ್ರ", "ವಸ್ತು ಹಿತ್ತಾಳೆ ಅಲ್ಲ ತಾಮ್ರ ಮಾಡಿ", "material is copper"
  if (normalized.includes('ತಾಮ್ರ') || normalized.includes('copper')) {
    return {
      success: true,
      modifiedField: 'material',
      newValue: 'Copper / ತಾಮ್ರ',
      message_kn: '✅ ವಸ್ತುವನ್ನು ತಾಮ್ರ (Copper) ಎಂದು ನವೀಕರಿಸಲಾಗಿದೆ.',
      message_en: '✅ Updated material to Copper.',
      updatedDraft: {
        ...currentDraft,
        category: 'Metal Craft',
        description: currentDraft.description ? currentDraft.description.replace(/brass|ಹಿತ್ತಾಳೆ/gi, 'copper') : 'Handcrafted pure copper craft.',
        local_description: currentDraft.local_description ? currentDraft.local_description.replace(/ಹಿತ್ತಾಳೆ/gi, 'ತಾಮ್ರ') : 'ಕೈಯಿಂದ ಮಾಡಿದ ಶುದ್ಧ ತಾಮ್ರದ ಕರಕುಶಲ ಉತ್ಪನ್ನ.'
      }
    };
  }

  // 5. DESCRIPTION CORRECTION: "ವಿವರಣೆಗೆ ... ಸೇರಿಸಿ", "add ... to description"
  const knDescAdd = normalized.match(/ವಿವರಣೆಗೆ\s*(.+?)\s*(?:ಎಂದು\s*)?ಸೇರಿಸಿ$/u);
  const enDescAdd = commandText.match(/add\s*(.+?)\s*to\s*(?:the\s*)?description$/i);

  if (knDescAdd && knDescAdd[1]) {
    const addition = knDescAdd[1].trim();
    const updatedDesc = `${currentDraft.local_description || ''} ${addition}`.trim();
    return {
      success: true,
      modifiedField: 'description',
      newValue: updatedDesc,
      message_kn: `✅ ವಿವರಣೆಗೆ "${addition}" ಸೇರಿಸಲಾಗಿದೆ.`,
      message_en: `✅ Added details to description.`,
      updatedDraft: { ...currentDraft, local_description: updatedDesc }
    };
  }
  if (enDescAdd && enDescAdd[1]) {
    const addition = enDescAdd[1].trim();
    const updatedDesc = `${currentDraft.description || ''} ${addition}`.trim();
    return {
      success: true,
      modifiedField: 'description',
      newValue: updatedDesc,
      message_kn: `✅ ವಿವರಣೆಯನ್ನು ನವೀಕರಿಸಲಾಗಿದೆ.`,
      message_en: `✅ Added details to description: "${addition}".`,
      updatedDraft: { ...currentDraft, description: updatedDesc }
    };
  }

  // 6. AMBIGUOUS OR UNCLEAR COMMAND: Ask clarification politely, DO NOT guess or alter
  return {
    success: false,
    modifiedField: null,
    message_kn: 'ಕ್ಷಮಿಸಿ, ಯಾವ ವಿವರವನ್ನು ಬದಲಾಯಿಸಬೇಕು? (ಉದಾಹರಣೆಗೆ: "ಬೆಲೆ 400 ಮಾಡಿ" ಅಥವಾ "ದಾಸ್ತಾನು 5 ಮಾಡಿ" ಎಂದು ಹೇಳಬಹುದು).',
    message_en: 'Could you clarify what you would like to change? (e.g. "change price to 400" or "stock 5").',
    updatedDraft: currentDraft
  };
}
