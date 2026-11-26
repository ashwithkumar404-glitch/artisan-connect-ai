/**
 * kannadaTranslator.js - Specialized Customer Message Translation Engine
 * Translates customer inquiries, feedback, order questions, and complaints into authentic Kannada Unicode script.
 * Preserves original message integrity, numbers, measurements, and handles already-Kannada messages gracefully.
 */

// Kannada Unicode character range check (\u0C80 - \u0CFF)
export function isKannadaText(text) {
  if (!text || typeof text !== 'string') return false;
  return /[\u0C80-\u0CFF]/.test(text);
}

// In-memory cache to prevent repeated translations of identical messages
const translationCache = new Map();

/**
 * Common high-frequency customer intent sentence patterns
 */
const SENTENCE_PATTERNS = [
  // 1. Sizing inquiries
  {
    pattern: /^is this (?:product|item|craft)?\s*available in (?:a\s+)?larger size\??$/i,
    translation: 'ಈ ಉತ್ಪನ್ನವು ದೊಡ್ಡ ಗಾತ್ರದಲ್ಲಿ ಲಭ್ಯವಿದೆಯೇ?'
  },
  {
    pattern: /^is this (?:product|item|craft)?\s*available in (?:a\s+)?smaller size\??$/i,
    translation: 'ಈ ಉತ್ಪನ್ನವು ಚಿಕ್ಕ ಗಾತ್ರದಲ್ಲಿ ಲಭ್ಯವಿದೆಯೇ?'
  },
  {
    pattern: /^is (?:a\s+)?(?:larger|bigger) size available\??$/i,
    translation: 'ದೊಡ್ಡ ಗಾತ್ರ ಲಭ್ಯವಿದೆಯೇ?'
  },
  {
    pattern: /^is (?:a\s+)?smaller size available\??$/i,
    translation: 'ಚಿಕ್ಕ ಗಾತ್ರ ಲಭ್ಯವಿದೆಯೇ?'
  },
  {
    pattern: /^can you (?:make|customize) (?:this in )?(?:a\s+)?custom size\??$/i,
    translation: 'ಇದನ್ನು ಕಸ್ಟಮ್ ಗಾತ್ರದಲ್ಲಿ ತಯಾರಿಸಲು ಸಾಧ್ಯವೇ?'
  },

  // 2. Pricing & Cost inquiries
  {
    pattern: /^what is the price of this (?:handmade|handcrafted)?\s*(?:product|item|craft)\??$/i,
    translation: 'ಈ ಕರಕುಶಲ ಉತ್ಪನ್ನದ ಬೆಲೆ ಎಷ್ಟು?'
  },
  {
    pattern: /^what is the price\??$/i,
    translation: 'ಇದರ ಬೆಲೆ ಎಷ್ಟು?'
  },
  {
    pattern: /^how much (?:does this cost|is this product|is this item|is this)\??$/i,
    translation: 'ಇದರ ಬೆಲೆ ಎಷ್ಟು ರೂಪಾಯಿ?'
  },
  {
    pattern: /^what is (?:your|the) best price\??$/i,
    translation: 'ನಿಮ್ಮ ಉತ್ತಮ ರಿಯಾಯಿತಿ ಬೆಲೆ ಎಷ್ಟು?'
  },
  {
    pattern: /^is (?:any\s+)?discount available (?:for|on) bulk (?:order|purchase)\??$/i,
    translation: 'ಸಗಟು ಖರೀದಿಗೆ ರಿಯಾಯಿತಿ ಲಭ್ಯವಿದೆಯೇ?'
  },

  // 3. Positive feedback & Quality
  {
    pattern: /^i received the product\.?\s*the quality is very good\.?$/i,
    translation: 'ನನಗೆ ಉತ್ಪನ್ನ ತಲುಪಿದೆ. ಗುಣಮಟ್ಟ ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ.'
  },
  {
    pattern: /^i received the (?:item|package|craft)\.?\s*(?:the\s+)?quality is (?:very\s+)?good\.?$/i,
    translation: 'ನನಗೆ ವಸ್ತು ತಲುಪಿದೆ. ಗುಣಮಟ್ಟ ತುಂಬಾ ಒಳ್ಳೆಯದಾಗಿದೆ.'
  },
  {
    pattern: /^the (?:product|item|craft) is (?:very\s+)?beautiful\.?\s*thank you\.?$/i,
    translation: 'ಉತ್ಪನ್ನವು ತುಂಬಾ ಸುಂದರವಾಗಿದೆ. ಧನ್ಯವಾದಗಳು.'
  },
  {
    pattern: /^excellent (?:craftsmanship|quality|work)\.?$/i,
    translation: 'ಅತ್ಯುತ್ತಮ ಕರಕುಶಲತೆ ಮತ್ತು ಗುಣಮಟ್ಟ.'
  },

  // 4. Shipping & Delivery inquiries
  {
    pattern: /^when will my order be shipped\??$/i,
    translation: 'ನನ್ನ ಆರ್ಡರ್ ಯಾವಾಗ ರವಾನೆಯಾಗುತ್ತದೆ?'
  },
  {
    pattern: /^when will (?:the|my)?\s*order be (?:dispatched|shipped)\??$/i,
    translation: 'ಆರ್ಡರ್ ಯಾವಾಗ ರವಾನೆಯಾಗುತ್ತದೆ?'
  },
  {
    pattern: /^when will my order (?:reach|arrive|be delivered)\??$/i,
    translation: 'ನನ್ನ ಆರ್ಡರ್ ಯಾವಾಗ ತಲುಪುತ್ತದೆ?'
  },
  {
    pattern: /^how many days (?:will it take|for delivery)\??$/i,
    translation: 'ವಿತರಣೆಗೆ ಎಷ್ಟು ದಿನಗಳು ಬೇಕಾಗುತ್ತವೆ?'
  },
  {
    pattern: /^can you provide (?:the\s+)?tracking number\??$/i,
    translation: 'ದಯವಿಟ್ಟು ಟ್ರ್ಯಾಕಿಂಗ್ ಸಂಖ್ಯೆಯನ್ನು ನೀಡುವಿರಾ?'
  },

  // 5. Problems, Complaints & Issues
  {
    pattern: /^i have a problem with the product\.?$/i,
    translation: 'ಉತ್ಪನ್ನದಲ್ಲಿ ನನಗೆ ಒಂದು ಸಮಸ್ಯೆಯಿದೆ.'
  },
  {
    pattern: /^i have (?:an\s+)?issue with (?:the|my)\s*(?:product|order|package)\.?$/i,
    translation: 'ನನ್ನ ಆರ್ಡರ್ ಅಥವಾ ಉತ್ಪನ್ನದೊಂದಿಗೆ ಸಮಸ್ಯೆಯಿದೆ.'
  },
  {
    pattern: /^the (?:product|item|package) arrived damaged\.?$/i,
    translation: 'ಉತ್ಪನ್ನವು ಹಾನಿಗೊಳಗಾಗಿ ತಲುಪಿದೆ.'
  },
  {
    pattern: /^the item is broken\.?$/i,
    translation: 'ವಸ್ತುವು ಮುರಿದಿದೆ.'
  },
  {
    pattern: /^i received (?:the\s+)?wrong (?:item|product)\.?$/i,
    translation: 'ನನಗೆ ತಪ್ಪು ಉತ್ಪನ್ನ ತಲುಪಿದೆ.'
  },
  {
    pattern: /^can i (?:get a\s+)?refund or return\??$/i,
    translation: 'ಹಣ ವಾಪಸ್ ಅಥವಾ ರಿಟರ್ನ್ ಪಡೆಯಲು ಸಾಧ್ಯವೇ?'
  }
];

/**
 * Phrase-level replacements for compound sentence clauses
 */
const CLAUSE_REPLACEMENTS = [
  // Bulk order inquiries with numbers
  { re: /can you make (\d+) pieces/gi, rep: '$1 ತುಂಡುಗಳನ್ನು ತಯಾರಿಸಲು ಸಾಧ್ಯವೇ' },
  { re: /can you make (\d+) (?:items|units|pcs)/gi, rep: '$1 ವಸ್ತುಗಳನ್ನು ತಯಾರಿಸಲು ಸಾಧ್ಯವೇ' },
  { re: /(\d+)\s*(?:pieces|pcs|units|items)/gi, rep: '$1 ತುಂಡುಗಳು' },
  { re: /(\d+)\s*days/gi, rep: '$1 ದಿನಗಳು' },

  // Key phrases
  { re: /\bcan you deliver to\b/gi, rep: 'ವಿತರಣೆ ಮಾಡಲು ಸಾಧ್ಯವೇ:' },
  { re: /\bis this product available\b/gi, rep: 'ಈ ಉತ್ಪನ್ನ ಲಭ್ಯವಿದೆಯೇ' },
  { re: /\bis this available\b/gi, rep: 'ಇದು ಲಭ್ಯವಿದೆಯೇ' },
  { re: /\bwhat is the price of\b/gi, rep: 'ಬೆಲೆ ಎಷ್ಟು:' },
  { re: /\bwhat is the price\b/gi, rep: 'ಬೆಲೆ ಎಷ್ಟು' },
  { re: /\bhow much is\b/gi, rep: 'ಎಷ್ಟು ಬೆಲೆ' },
  { re: /\bin a larger size\b/gi, rep: 'ದೊಡ್ಡ ಗಾತ್ರದಲ್ಲಿ' },
  { re: /\bin a smaller size\b/gi, rep: 'ಚಿಕ್ಕ ಗಾತ್ರದಲ್ಲಿ' },
  { re: /\blarger size\b/gi, rep: 'ದೊಡ್ಡ ಗಾತ್ರ' },
  { re: /\bsmaller size\b/gi, rep: 'ಚಿಕ್ಕ ಗಾತ್ರ' },
  { re: /\bcustom size\b/gi, rep: 'ಕಸ್ಟಮ್ ಗಾತ್ರ' },
  { re: /\bcustom order\b/gi, rep: 'ಕಸ್ಟಮ್ ಆರ್ಡರ್' },
  { re: /\bbulk order\b/gi, rep: 'ಸಗಟು ಆರ್ಡರ್' },
  { re: /\bbulk purchase\b/gi, rep: 'ಸಗಟು ಖರೀದಿ' },
  { re: /\burgent delivery\b/gi, rep: 'ತುರ್ತು ವಿತರಣೆ' },
  { re: /\bready to ship\b/gi, rep: 'ರವಾನೆಗೆ ಸಿದ್ಧ' },
  { re: /\btracking number\b/gi, rep: 'ಟ್ರ್ಯಾಕಿಂಗ್ ಸಂಖ್ಯೆ' },
  { re: /\bcourier details\b/gi, rep: 'ಕೊರಿಯರ್ ವಿವರ' },
  { re: /\bdelivery address\b/gi, rep: 'ವಿತರಣಾ ವಿಳಾಸ' },
  { re: /\bquality is very good\b/gi, rep: 'ಗುಣಮಟ್ಟ ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ' },
  { re: /\bquality is good\b/gi, rep: 'ಗುಣಮಟ್ಟ ಒಳ್ಳೆಯದಾಗಿದೆ' },
  { re: /\bvery good quality\b/gi, rep: 'ಅತ್ಯುತ್ತಮ ಗುಣಮಟ್ಟ' },
  { re: /\bhandmade product\b/gi, rep: 'ಕರಕುಶಲ ಉತ್ಪನ್ನ' },
  { re: /\bhandcrafted product\b/gi, rep: 'ಕರಕುಶಲ ಉತ್ಪನ್ನ' },
  { re: /\bproblem with the product\b/gi, rep: 'ಉತ್ಪನ್ನದಲ್ಲಿ ಸಮಸ್ಯೆ' },
  { re: /\barrived damaged\b/gi, rep: 'ಹಾನಿಗೊಳಗಾಗಿ ತಲುಪಿದೆ' },
  { re: /\bwrong item\b/gi, rep: 'ತಪ್ಪು ವಸ್ತು' },
  { re: /\bwhen will my order be shipped\b/gi, rep: 'ನನ್ನ ಆರ್ಡರ್ ಯಾವಾಗ ರವಾನೆಯಾಗುತ್ತದೆ' },
  { re: /\bwhen will my order be dispatched\b/gi, rep: 'ನನ್ನ ಆರ್ಡರ್ ಯಾವಾಗ ರವಾನೆಯಾಗುತ್ತದೆ' },
  { re: /\bwhen will it be shipped\b/gi, rep: 'ಯಾವಾಗ ರವಾನೆಯಾಗುತ್ತದೆ' },
  { re: /\bwhen will it arrive\b/gi, rep: 'ಯಾವಾಗ ತಲುಪುತ್ತದೆ' },
  { re: /\bwhen will my order reach\b/gi, rep: 'ನನ್ನ ಆರ್ಡರ್ ಯಾವಾಗ ತಲುಪುತ್ತದೆ' },
  { re: /\bi received the product\b/gi, rep: 'ನನಗೆ ಉತ್ಪನ್ನ ತಲುಪಿದೆ' },
  { re: /\bi have a problem\b/gi, rep: 'ನನಗೆ ಒಂದು ಸಮಸ್ಯೆಯಿದೆ' },
  { re: /\bthank you very much\b/gi, rep: 'ತುಂಬಾ ಧನ್ಯವಾದಗಳು' },
  { re: /\bthank you\b/gi, rep: 'ಧನ್ಯವಾದಗಳು' },
  { re: /\bthanks\b/gi, rep: 'ಧನ್ಯವಾದಗಳು' },
  { re: /\bplease\b/gi, rep: 'ದಯವಿಟ್ಟು' },
  { re: /\bhello\b/gi, rep: 'ನಮಸ್ಕಾರ' },
  { re: /\bhi\b/gi, rep: 'ನಮಸ್ಕಾರ' },
  { re: /\bnamaste\b/gi, rep: 'ನಮಸ್ಕಾರ' },

  // Colors & Materials
  { re: /\bblue lacquer finish\b/gi, rep: 'ನೀಲಿ ಲ್ಯಾಕರ್ ಫಿನಿಶಿಂಗ್' },
  { re: /\brosewood\b/gi, rep: 'ಬೀಟೆ ಮರ (ರೋಸ್‌ವುಡ್)' },
  { re: /\bsandalwood\b/gi, rep: 'ಶ್ರೀಗಂಧ' },
  { re: /\bteak wood\b/gi, rep: 'ತೇಗದ ಮರ' },
  { re: /\bterracotta\b/gi, rep: 'ಟೆರ್ರಾಕೋಟಾ ಮಣ್ಣು' },
  { re: /\bclay\b/gi, rep: 'ಜೇಡಿಮಣ್ಣು' },
  { re: /\bbamboo\b/gi, rep: 'ಬಿದಿರು' },
  { re: /\bsilk\b/gi, rep: 'ರೇಷ್ಮೆ' },
  { re: /\bbrass\b/gi, rep: 'ಹಿತ್ತಾಳೆ' },
  { re: /\bbronze\b/gi, rep: 'ಕಂಚು' },
  { re: /\bdiscount\b/gi, rep: 'ರಿಯಾಯಿತಿ' },
  { re: /\bbudget\b/gi, rep: 'ಬಜೆಟ್' }
];

/**
 * Word dictionary for fallback tokenized matching
 */
const WORD_DICT = {
  price: 'ಬೆಲೆ',
  cost: 'ದರ',
  rate: 'ದರ',
  size: 'ಗಾತ್ರ',
  large: 'ದೊಡ್ಡ',
  larger: 'ದೊಡ್ಡ',
  small: 'ಚಿಕ್ಕ',
  smaller: 'ಚಿಕ್ಕ',
  quality: 'ಗುಣಮಟ್ಟ',
  order: 'ಆರ್ಡರ್',
  product: 'ಉತ್ಪನ್ನ',
  item: 'ವಸ್ತು',
  products: 'ಉತ್ಪನ್ನಗಳು',
  items: 'ವಸ್ತುಗಳು',
  pieces: 'ತುಂಡುಗಳು',
  shipped: 'ರವಾನಿಸಲಾಗಿದೆ',
  shipping: 'ರವಾನೆ',
  delivered: 'ತಲುಪಿಸಲಾಗಿದೆ',
  delivery: 'ವಿತರಣೆ',
  problem: 'ಸಮಸ್ಯೆ',
  issue: 'ತೊಂದರೆ',
  damaged: 'ಹಾನಿಯಾಗಿದೆ',
  broken: 'ಮುರಿದಿದೆ',
  color: 'ಬಣ್ಣ',
  colors: 'ಬಣ್ಣಗಳು',
  blue: 'ನೀಲಿ',
  red: 'ಕೆಂಪು',
  green: 'ಹಸಿರು',
  yellow: 'ಹಳದಿ',
  black: 'ಕಪ್ಪು',
  white: 'ಬಿಳಿ',
  good: 'ಉತ್ತಮ',
  beautiful: 'ಸುಂದರ',
  authentic: 'ಅಸಲಿ',
  genuine: 'ನೈಜ',
  available: 'ಲಭ್ಯವಿದೆ',
  yes: 'ಹೌದು',
  no: 'ಇಲ್ಲ',
  days: 'ದಿನಗಳು',
  urgent: 'ತುರ್ತು',
  discount: 'ರಿಯಾಯಿತಿ'
};

/**
 * Translates customer inquiry/message into accurate Kannada script.
 * 
 * @param {string} text - Original customer message
 * @returns {object} { original: string, translation: string, isAlreadyKannada: boolean }
 */
export function translateCustomerMessageToKannada(text) {
  if (!text || typeof text !== 'string') {
    return { original: '', translation: '', isAlreadyKannada: false };
  }

  const cleanText = text.trim();
  if (!cleanText) {
    return { original: '', translation: '', isAlreadyKannada: false };
  }

  // Check cache first to avoid re-computing
  if (translationCache.has(cleanText)) {
    return translationCache.get(cleanText);
  }

  // 1. Detect if the message is already written in Kannada script
  if (isKannadaText(cleanText)) {
    const result = {
      original: cleanText,
      translation: cleanText, // Keep unchanged in Kannada
      isAlreadyKannada: true
    };
    translationCache.set(cleanText, result);
    return result;
  }

  // 2. High-precision full sentence pattern matching
  const normalized = cleanText.toLowerCase().replace(/\s+/g, ' ');
  for (const item of SENTENCE_PATTERNS) {
    if (item.pattern.test(normalized)) {
      const result = {
        original: cleanText,
        translation: item.translation,
        isAlreadyKannada: false
      };
      translationCache.set(cleanText, result);
      return result;
    }
  }

  // 3. Clause & phrase replacement
  let translated = cleanText;
  let hasReplaced = false;

  for (const clause of CLAUSE_REPLACEMENTS) {
    if (clause.re.test(translated)) {
      translated = translated.replace(clause.re, clause.rep);
      hasReplaced = true;
    }
  }

  // 4. Token-level dictionary translation for remaining English words
  if (!hasReplaced) {
    const words = cleanText.split(/(\s+|[.,!?;:()])/);
    let knCount = 0;
    const translatedTokens = words.map((token) => {
      const lower = token.toLowerCase();
      if (WORD_DICT[lower]) {
        knCount++;
        return WORD_DICT[lower];
      }
      return token;
    });

    if (knCount > 0) {
      translated = translatedTokens.join('');
      hasReplaced = true;
    }
  }

  // 5. Final fallback formatting: Ensure the output is clearly identified as customer text in Kannada context
  let finalTranslation = translated;
  if (!hasReplaced || translated === cleanText) {
    // If untranslatable words remain, wrap in a clear, polite Kannada domain context
    finalTranslation = `ಗ್ರಾಹಕರ ಸಂದೇಶ: "${cleanText}"`;
  }

  const result = {
    original: cleanText,
    translation: finalTranslation,
    isAlreadyKannada: false
  };

  translationCache.set(cleanText, result);
  return result;
}

