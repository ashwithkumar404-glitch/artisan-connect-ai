// tests/kannada_pipeline.test.js - Comprehensive test suite for Kannada Voice-to-Product Workflow (Phase 1)
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isKannadaScript,
  isLatinTransliteration,
  normalizeKannadaNumbers,
  extractProductFacts,
  buildProductListing,
  interpretCorrectionCommand,
  sanitizeCostPrivacy
} from '../src/lib/kannadaProductEngine.js';

test('1. Kannada Unicode transcription and display verification', () => {
  const genuineKannada = 'ನೈಸರ್ಗಿಕ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಮಾಡಿದ ನೀರಿನ ಮಡಕೆ';
  assert.equal(isKannadaScript(genuineKannada), true, 'Genuine Kannada text must be identified as Kannada script');

  const englishText = 'Handcrafted terracotta water pot';
  assert.equal(isKannadaScript(englishText), false, 'English text should not be identified as Kannada script');
});

test('2. English-letter transliteration is rejected and not mistaken for verified Kannada script', () => {
  const transliteratedLatin = 'nanu ondu madike madiddini price 400';
  assert.equal(isLatinTransliteration(transliteratedLatin, 'kn'), true, 'Latin transliteration must be detected and flagged');

  const nativeKannada = 'ನಾನು ಒಂದು ಮಡಕೆ ಮಾಡಿದ್ದೇನೆ ಬೆಲೆ ೪೦೦';
  assert.equal(isLatinTransliteration(nativeKannada, 'kn'), false, 'Native Kannada script must not be flagged as transliteration');

  const emptyText = '   ';
  assert.equal(isLatinTransliteration(emptyText, 'kn'), false, 'Empty text must not trigger false positive transliteration');
});

test('3. Title generation does NOT copy the first words of the transcript', () => {
  // Transcripts beginning with conversational chatter
  const transcriptWithChatter = 'ನಮಸ್ಕಾರ ಸ್ನೇಹಿತರೆ ನಾನು ಮೈಸೂರಿನಿಂದ ಕುಂಬಾರ ರಾಮಣ್ಣ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ. ಇದು ನೈಸರ್ಗಿಕ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಮಾಡಿದ ನೀರಿನ ಮಡಕೆ.';
  const facts = extractProductFacts(transcriptWithChatter);
  const listing = buildProductListing(transcriptWithChatter, facts);

  // The title must be derived from genuine craft facts, NOT "ನಮಸ್ಕಾರ ಸ್ನೇಹಿತರೆ ನಾನು ಮೈಸೂರಿನಿಂದ..."
  assert.ok(!listing.localTitle.includes('ನಮಸ್ಕಾರ'), 'Title must not copy conversational greetings');
  assert.ok(!listing.localTitle.includes('ಸ್ನೇಹಿತರೆ'), 'Title must not copy conversational words');
  assert.ok(!listing.localTitle.includes('ಮೈಸೂರಿನಿಂದ'), 'Title must not copy conversational location intro');
  assert.equal(listing.localTitle, 'ಕೈಯಿಂದ ಮಾಡಿದ ಮಣ್ಣಿನ ನೀರಿನ ಮಡಕೆ', 'Title must be cleanly derived from craft facts');

  // English title should also be cleanly derived from craft facts
  assert.equal(listing.englishTitle, 'Handcrafted Terracotta Water Pot', 'English title must be cleanly derived');
});

test('4. Natural Kannada description generation from structured facts', () => {
  const transcript = 'ನಮ್ಮ ಕುಂಬಾರಿಕೆ ಚಕ್ರದಲ್ಲಿ ನೈಸರ್ಗಿಕ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಮಾಡಿದ ನೀರಿನ ಮಡಕೆ. ಕುಡಿಯುವ ನೀರು ತಂಪಾಗಿಸಲು ಉತ್ತಮ. ಮಾರಾಟ ಬೆಲೆ 450 ರೂಪಾಯಿ.';
  const facts = extractProductFacts(transcript);
  const listing = buildProductListing(transcript, facts);

  assert.ok(listing.localDescription.includes('ಜೇಡಿಮಣ್ಣು') || listing.localDescription.includes('ಮಣ್ಣು'), 'Description must include verified material');
  assert.ok(listing.localDescription.includes('ಕುಂಬಾರಿಕೆ ಚಕ್ರ'), 'Description must include verified technique');
  assert.ok(listing.localDescription.includes('ತಂಪಾಗಿಸಲು'), 'Description must include verified intended use');
});

test('5. Unsupported facts (dimensions, certifications, materials) are NOT invented', () => {
  // Artisan mentions only basket form and bamboo material without dimensions or certification
  const transcript = 'ಇದು ಕೈಯಿಂದ ಹೆಣೆದ ಬಿದಿರಿನ ಹಣ್ಣಿನ ಬುಟ್ಟಿ. ಬೆಲೆ 300 ರೂಪಾಯಿ.';
  const facts = extractProductFacts(transcript);
  const listing = buildProductListing(transcript, facts);

  assert.equal(facts.dimensions, null, 'Dimensions must be null if not stated in voice');
  assert.ok(!listing.localDescription.includes('ಇಂಚು'), 'Dimensions must not be invented in Kannada description');
  assert.ok(!listing.englishDescription.includes('inches') && !listing.englishDescription.includes('cm'), 'Dimensions must not be invented in English description');
  assert.ok(!listing.localDescription.includes('ಪ್ರಮಾಣೀಕೃತ'), 'Certifications must not be fabricated');
  assert.ok(!listing.englishDescription.includes('certified'), 'Certifications must not be fabricated');
});

test('6. Follow-up clarification is triggered when essential details (price, material) are missing', () => {
  // Voice input without price or clear material
  const vagueInput = 'ನಾನು ಒಂದು ಸುಂದರ ಬುಟ್ಟಿ ಮಾಡಿದ್ದೇನೆ.';
  const facts = extractProductFacts(vagueInput);
  const listing = buildProductListing(vagueInput, facts);

  assert.equal(facts.price, null, 'Price must be null when unvoiced');
  assert.ok(listing.missingDetails.length > 0, 'Missing details must be detected');
  assert.ok(listing.missingDetails.some(d => d.field === 'price'), 'Missing price follow-up must be flagged');
  assert.ok(listing.needsClarification, 'needsClarification must be true');
});

test('7. Cost privacy: Internal raw material and production costs are redacted', () => {
  const transcriptWithInternalCosts = 'ನನ್ನ ತಯಾರಿಕಾ ವೆಚ್ಚ 80 ರೂಪಾಯಿ ಆಗಿದೆ. ಆದರೆ ಮಾರಾಟ ಬೆಲೆ 350 ರೂಪಾಯಿ. ಇದು ಶುದ್ಧ ಮಣ್ಣಿನ ಮಡಕೆ.';
  const sanitized = sanitizeCostPrivacy(transcriptWithInternalCosts);

  assert.ok(!sanitized.includes('ತಯಾರಿಕಾ ವೆಚ್ಚ 80'), 'Internal production cost must be redacted');
  assert.ok(sanitized.includes('350'), 'Public selling price must be preserved');
});

test('8. Kannada-to-English marketplace preparation preserves meaning and correct category', () => {
  const knInput = 'ಬಿದಿರಿನಿಂದ ಕೈಯಿಂದ ಹೆಣೆದ ಸುಂದರ ಹಣ್ಣಿನ ಬುಟ್ಟಿ. ದಾಸ್ತಾನು 10 ತುಂಡುಗಳು. ಬೆಲೆ 350 ರೂಪಾಯಿ.';
  const facts = extractProductFacts(knInput);
  const listing = buildProductListing(knInput, facts);

  assert.equal(listing.category, 'Bamboo & Natural Craft', 'Category must accurately match official marketplace categories');
  assert.equal(listing.englishTitle, 'Handcrafted Bamboo Fruit Basket', 'English title must preserve authentic artisan meaning');
  assert.equal(listing.price, 350, 'Price must be correctly parsed');
  assert.equal(listing.stock_quantity, 10, 'Stock quantity must be correctly parsed');
});

test('9. Voice corrections: Updates ONLY intended field (Price, Stock, Title, Description, Material)', () => {
  const initialDraft = {
    name: 'Handcrafted Terracotta Water Pot',
    local_title: 'ಕೈಯಿಂದ ಮಾಡಿದ ಮಣ್ಣಿನ ನೀರಿನ ಮಡಕೆ',
    price: 300,
    stock_quantity: 2,
    description: 'Authentic handmade terracotta pottery.',
    local_description: 'ನೈಸರ್ಗಿಕ ಮಣ್ಣಿನ ನೀರಿನ ಮಡಕೆ.',
    category: 'Pottery'
  };

  // A. Price correction in Kannada
  const priceCorr = interpretCorrectionCommand('ಬೆಲೆ 450 ಮಾಡಿ', initialDraft, 'kn');
  assert.equal(priceCorr.success, true);
  assert.equal(priceCorr.modifiedField, 'price');
  assert.equal(priceCorr.updatedDraft.price, 450, 'Price must be updated to 450');
  assert.equal(priceCorr.updatedDraft.stock_quantity, 2, 'Stock quantity must remain unchanged');
  assert.equal(priceCorr.updatedDraft.name, initialDraft.name, 'Title must remain unchanged');

  // B. Stock quantity correction in Kannada
  const stockCorr = interpretCorrectionCommand('ಪ್ರಮಾಣ 15 ಮಾಡಿ', priceCorr.updatedDraft, 'kn');
  assert.equal(stockCorr.success, true);
  assert.equal(stockCorr.modifiedField, 'stock_quantity');
  assert.equal(stockCorr.updatedDraft.stock_quantity, 15, 'Stock quantity must be updated to 15');
  assert.equal(stockCorr.updatedDraft.price, 450, 'Price must remain unchanged from previous step');

  // C. Title correction in Kannada
  const titleCorr = interpretCorrectionCommand('ಹೆಸರು ತಣ್ಣೀರಿನ ಮಡಕೆ ಮಾಡಿ', stockCorr.updatedDraft, 'kn');
  assert.equal(titleCorr.success, true);
  assert.equal(titleCorr.modifiedField, 'name');
  assert.equal(titleCorr.updatedDraft.local_title, 'ತಣ್ಣೀರಿನ ಮಡಕೆ', 'Local title must be updated');
  assert.equal(titleCorr.updatedDraft.price, 450, 'Price must remain unchanged');
  assert.equal(titleCorr.updatedDraft.stock_quantity, 15, 'Stock must remain unchanged');

  // D. Material correction in Kannada
  const matCorr = interpretCorrectionCommand('ವಸ್ತು ಹಿತ್ತಾಳೆ ಅಲ್ಲ ತಾಮ್ರ ಮಾಡಿ', initialDraft, 'kn');
  assert.equal(matCorr.success, true);
  assert.equal(matCorr.modifiedField, 'material');
  assert.equal(matCorr.updatedDraft.category, 'Metal Craft');
});

test('10. Uncertain or ambiguous commands request clarification without mutating draft', () => {
  const initialDraft = {
    name: 'Handcrafted Terracotta Water Pot',
    price: 300,
    stock_quantity: 2
  };

  const ambiguous = interpretCorrectionCommand('ಬದಲಾಯಿಸಿ', initialDraft, 'kn');
  assert.equal(ambiguous.success, false, 'Ambiguous command must return success: false');
  assert.equal(ambiguous.modifiedField, null, 'No field should be modified');
  assert.ok(ambiguous.message_kn.includes('ಕ್ಷಮಿಸಿ'), 'Must ask for clarification politely');
  assert.equal(ambiguous.updatedDraft.price, 300, 'Draft price must be untouched');
});

test('11. Normalizing Kannada numerals to Arabic digits', () => {
  const knNumStr = 'ಬೆಲೆ ೪೫೦ ರೂಪಾಯಿ ಮತ್ತು ದಾಸ್ತಾನು ೧೦';
  const normalized = normalizeKannadaNumbers(knNumStr);
  assert.equal(normalized, 'ಬೆಲೆ 450 ರೂಪಾಯಿ ಮತ್ತು ದಾಸ್ತಾನು 10');
});
