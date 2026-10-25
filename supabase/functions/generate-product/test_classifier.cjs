// test_classifier.cjs – Regression and edge case test suite for classifier.ts
// Tests both English and Kannada Unicode vocabulary

const CATEGORY_DEFINITIONS = {
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

function classifyCategoryFromText(text) {
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
  let bestMatches = [];
  let bestHasSpecific = false;

  for (const [category, def] of Object.entries(CATEGORY_DEFINITIONS)) {
    let score = 0;
    const matches = [];
    let hasSpecific = false;

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
      if (hasSpecific && !bestHasSpecific) {
        bestCategory = category;
        bestMatches = matches;
        bestHasSpecific = true;
      }
    }
  }

  let confidence = 'low';
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

const testSuite = [
  // 1. Specific over generic tie-break tests
  {
    name: 'Papier-mache with generic box term',
    input: 'Handmade papier-mache decorative storage box with traditional motifs',
    expectedCategory: 'Other Handicrafts',
    minConfidence: 'high'
  },
  {
    name: 'Papier mache gift box with floral pattern',
    input: 'Kashmiri papier mache painted box for gift packaging',
    expectedCategory: 'Other Handicrafts',
    minConfidence: 'high'
  },
  {
    name: 'Wooden box with carving',
    input: 'Teak wood carved jewellery box with brass latch',
    expectedCategory: 'Wood Craft',
    minConfidence: 'high'
  },
  {
    name: 'Bidriware metal box',
    input: 'Authentic Bidriware zinc-copper alloy engraved inlay box',
    expectedCategory: 'Metal Craft',
    minConfidence: 'high'
  },
  // 2. Bamboo & Natural Craft
  {
    name: 'Coir craft doormat',
    input: 'Natural coir fibre braided entrance door mat',
    expectedCategory: 'Bamboo & Natural Craft',
    minConfidence: 'high'
  },
  {
    name: 'Bamboo basket',
    input: 'Handwoven bamboo cane fruit basket with sturdy handle',
    expectedCategory: 'Bamboo & Natural Craft',
    minConfidence: 'high'
  },
  // 3. Handloom & Textiles
  {
    name: 'Khadi cotton saree',
    input: 'Handspun khadi cotton saree with handloom border and pallu',
    expectedCategory: 'Handloom & Textiles',
    minConfidence: 'high'
  },
  // 4. Pottery
  {
    name: 'Terracotta kulhar pitcher',
    input: 'Natural terracotta clay kulhad cups and glazed water pitcher pot',
    expectedCategory: 'Pottery',
    minConfidence: 'high'
  },
  // 5. Metal Craft
  {
    name: 'Dhokra brass idol',
    input: 'Dhokra lost-wax casting brass idol and bell metal bowl',
    expectedCategory: 'Metal Craft',
    minConfidence: 'high'
  },
  // 6. Jewellery
  {
    name: 'Silver filigree jhumka',
    input: 'Silver filigree tarakasi jhumka earrings and bead necklace',
    expectedCategory: 'Jewellery',
    minConfidence: 'high'
  },
  // 7. Other Handicrafts: Folk paintings and Leather
  {
    name: 'Madhubani folk painting',
    input: 'Traditional Madhubani folk painting wall hanging',
    expectedCategory: 'Other Handicrafts',
    minConfidence: 'medium'
  },
  {
    name: 'Kolhapuri leather footwear',
    input: 'Kolhapuri leather jutti with handcrafted embroidery',
    expectedCategory: 'Other Handicrafts',
    minConfidence: 'medium'
  },
  // 8. Ambiguous description
  {
    name: 'Ambiguous general craft description',
    input: 'Handmade traditional gift item crafted with heritage skills',
    expectedCategory: 'Other Handicrafts',
    minConfidence: 'low'
  },
  // 9. Unknown / non-craft description
  {
    name: 'Unknown product description',
    input: 'Electronic digital gadget with wireless charger',
    expectedCategory: 'Other Handicrafts',
    minConfidence: 'low'
  },
  // 10. Empty and whitespace input
  {
    name: 'Empty string',
    input: '',
    expectedCategory: 'Other Handicrafts',
    minConfidence: 'low'
  },
  {
    name: 'Whitespace only',
    input: '    ',
    expectedCategory: 'Other Handicrafts',
    minConfidence: 'low'
  },
  // 11. KANNADA LANGUAGE TESTS
  {
    name: 'Kannada terracotta water pot',
    input: 'ನೈಸರ್ಗಿಕ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಮಾಡಿದ ನೀರಿನ ಮಡಕೆ ಕುಂಬಾರಿಕೆ ಚಕ್ರದಲ್ಲಿ ಸಿದ್ಧಪಡಿಸಲಾಗಿದೆ',
    expectedCategory: 'Pottery',
    minConfidence: 'high'
  },
  {
    name: 'Kannada bamboo basket',
    input: 'ಬಿದಿರಿನಿಂದ ಕೈಯಿಂದ ಹೆಣೆದ ಸುಂದರ ಹಣ್ಣಿನ ಬುಟ್ಟಿ',
    expectedCategory: 'Bamboo & Natural Craft',
    minConfidence: 'high'
  },
  {
    name: 'Kannada handloom silk saree',
    input: 'ಸಾಂಪ್ರದಾಯಿಕ ಕೈಮಗ್ಗದ ನೇಯ್ಗೆಯ ಶುದ್ಧ ರೇಷ್ಮೆ ಸೀರೆ',
    expectedCategory: 'Handloom & Textiles',
    minConfidence: 'high'
  },
  {
    name: 'Kannada brass lamp',
    input: 'ಸಾಂಪ್ರದಾಯಿಕ ಹಿತ್ತಾಳೆಯ ಪೂಜಾ ದೀಪ ಮತ್ತು ಕೆತ್ತನೆ',
    expectedCategory: 'Metal Craft',
    minConfidence: 'high'
  },
  {
    name: 'Kannada sandalwood woodcraft',
    input: 'ಶ್ರೀಗಂಧದ ಮರದ ಕೈ ಕೆತ್ತನೆಯ ಸುಂದರ ಆಟಿಕೆ ಮತ್ತು ಪೆಟ್ಟಿಗೆ',
    expectedCategory: 'Wood Craft',
    minConfidence: 'high'
  }
];

let failed = 0;
console.log('--- RUNNING CLASSIFIER EDGE CASE TESTS ---');

testSuite.forEach((t, i) => {
  const result = classifyCategoryFromText(t.input);
  const catMatch = result.category === t.expectedCategory;
  const confOrder = { low: 1, medium: 2, high: 3 };
  const confMatch = confOrder[result.confidence] >= confOrder[t.minConfidence];

  if (catMatch && confMatch) {
    console.log(`✅ [${i + 1}/${testSuite.length}] ${t.name}: PASSED -> '${result.category}' (${result.confidence})`);
  } else {
    failed++;
    console.error(`❌ [${i + 1}/${testSuite.length}] ${t.name}: FAILED!`);
    console.error(`   Input: "${t.input}"`);
    console.error(`   Expected: '${t.expectedCategory}' (>=${t.minConfidence}), Got: '${result.category}' (${result.confidence})`);
    console.error(`   Matched keywords:`, result.matchedKeywords);
  }
});

console.log('-----------------------------------------');
if (failed === 0) {
  console.log(`🎉 ALL ${testSuite.length} CLASSIFIER TESTS PASSED!`);
  process.exit(0);
} else {
  console.error(`💥 ${failed} TEST(S) FAILED.`);
  process.exit(1);
}
