// tests/voice_to_english_listing.test.js - Acceptance tests for Step 5: Reliable Voice-to-English Marketplace Listings
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractProductFacts,
  buildProductListing,
  interpretCorrectionCommand,
  isKannadaScript
} from '../src/lib/kannadaProductEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test 1: Kannada transcript to structured English listing using a controlled test fixture
test('1. Kannada transcript produces structured English listing with real facts', () => {
  const knFixture = 'ನಮಸ್ಕಾರ, ಇದು ನಮ್ಮ ಕುಂಬಾರಿಕೆ ಚಕ್ರದಲ್ಲಿ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಮಾಡಿದ ನೀರಿನ ಮಡಕೆ. ಕುಡಿಯುವ ನೀರು ತಂಪಾಗಿಡಲು ಉತ್ತಮ. ಬೆಲೆ 450 ರೂಪಾಯಿ. ದಾಸ್ತಾನು 20 ಸಂಖ್ಯೆಗಳಿವೆ.';
  const facts = extractProductFacts(knFixture);
  const listing = buildProductListing(knFixture, facts);

  // English title must be clean and noun-based
  assert.equal(listing.englishTitle, 'Handcrafted Terracotta Water Pot');

  // English description must be genuine English (no raw Kannada text substituted)
  assert.equal(isKannadaScript(listing.englishDescription), false, 'English description must not contain Kannada script');
  assert.ok(listing.englishDescription.toLowerCase().includes('water pot'), 'English description must reference the craft form');
  assert.ok(listing.englishDescription.includes('Terracotta') || listing.englishDescription.toLowerCase().includes('clay'), 'English description must reference material');
  assert.ok(listing.englishDescription.includes('Handcrafted') || listing.englishDescription.includes('handcrafted'), 'English description must describe craftsmanship');

  // Verified numeric values
  assert.equal(listing.price, 450);
  assert.equal(listing.stock_quantity, 20);
  assert.equal(listing.category, 'Pottery');
});

// Test 2: Product title extraction from a multi-sentence description (never first sentence/line)
test('2. Product title extraction from multi-sentence conversational description', () => {
  const multiSentenceTranscript = 'ನಮಸ್ಕಾರ ಸ್ವಾಮಿ, ನನ್ನ ಹೆಸರು ಬಸವರಾಜು. ನಾನು ಚನ್ನಪಟ್ಟಣದ ಕಲಾವಿದ. ಇಂದು ನಾನು ಸುಂದರ ಮರದ ಆಟಿಕೆ ಪರಿಚಯಿಸುತ್ತಿದ್ದೇನೆ. ಬೆಲೆ 600 ರೂಪಾಯಿ.';
  const facts = extractProductFacts(multiSentenceTranscript);
  const listing = buildProductListing(multiSentenceTranscript, facts);

  // Must not copy conversational intros
  assert.ok(!listing.localTitle.includes('ನಮಸ್ಕಾರ'), 'Local title must not start with greeting');
  assert.ok(!listing.localTitle.includes('ಬಸವರಾಜು'), 'Local title must not copy artisan introduction');
  assert.ok(!listing.englishTitle.includes('Hello'), 'English title must not include greetings');
  assert.ok(!listing.englishTitle.includes('Basavaraju'), 'English title must not include conversational names');

  // Title must be concise and noun-based
  assert.equal(listing.englishTitle, 'Handcrafted Channapatna Wooden Toy');
  assert.equal(listing.localTitle, 'ಕೈಯಿಂದ ಮಾಡಿದ ಮರದ ಚನ್ನಪಟ್ಟಣ ಆಟಿಕೆ');
});

// Test 3: Stock extraction when the artisan states 60 units
test('3. Stock extraction when artisan states 60 units', () => {
  // Kannada with "60 units" or "60 ಸಂಖ್ಯೆ"
  const transcriptWith60Units = 'ಇದು ಕೈಯಿಂದ ಹೆಣೆದ ಬಿದಿರಿನ ಹಣ್ಣಿನ ಬುಟ್ಟಿ. ನನ್ನ ಬಳಿ 60 units ದಾಸ್ತಾನು ಇದೆ. ಮಾರಾಟ ಬೆಲೆ 350 ರೂಪಾಯಿ.';
  const facts = extractProductFacts(transcriptWith60Units);
  const listing = buildProductListing(transcriptWith60Units, facts);

  assert.equal(facts.stockQuantity, 60, 'Fact extractor must parse 60 units correctly');
  assert.equal(listing.stock_quantity, 60, 'Product listing stock_quantity must equal 60');
  assert.equal(listing.isStockProvisional, false, 'Explicit 60 stock must not be flagged as provisional');

  // English with 60 units
  const enTranscript = 'Handmade bamboo storage basket. I have 60 units ready in stock. Selling price is 400 rupees.';
  const enFacts = extractProductFacts(enTranscript);
  const enListing = buildProductListing(enTranscript, enFacts);
  assert.equal(enListing.stock_quantity, 60, 'English stock extractor must parse 60 units correctly');
});

// Test 4: Missing price requiring clarification rather than a fabricated ₹500
test('4. Missing price requires clarification and never defaults to fabricated ₹500', () => {
  // Transcript with material and craft form but NO selling price
  const transcriptWithoutPrice = 'ನಮ್ಮ ಕೈಮಗ್ಗದಲ್ಲಿ ನೆಯ್ದ ಶುದ್ಧ ಹತ್ತಿ ಸೀರೆ. ದಾಸ್ತಾನು 10 ಸೀರೆಗಳು ಇವೆ.';
  const facts = extractProductFacts(transcriptWithoutPrice);
  const listing = buildProductListing(transcriptWithoutPrice, facts);

  // Price must be null or clearly marked provisional, NEVER fabricated 500!
  assert.equal(facts.price, null, 'Extracted price must be null');
  assert.equal(listing.price, null, 'Listing price must not be fabricated 500');
  assert.equal(listing.isPriceProvisional, true, 'isPriceProvisional must be true');

  // Must detect missing details and flag clarification
  assert.ok(listing.missingDetails.some((m) => m.field === 'price'), 'Missing price must be flagged');
  assert.equal(listing.needsClarification, true, 'needsClarification must be true');
});

// Test 5: Translation or generation failure and retry handling
test('5. Generation or edge function failure provides recoverable state without Kannada in English field', () => {
  const homePagePath = path.resolve(__dirname, '../src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePagePath, 'utf-8');

  // Guard: Never substitute Kannada script into English fields
  assert.ok(
    content.includes('!isKannadaScript(edgeData.product_name)'),
    'HomePage must verify edgeData product_name is not Kannada before assigning to englishTitle'
  );
  assert.ok(
    content.includes('!isKannadaScript(edgeData.description)'),
    'HomePage must verify edgeData description is not Kannada before assigning to englishDescription'
  );

  // Error handling and recovery
  assert.ok(content.includes('Generate product error:'), 'Must log product generation errors');
  assert.ok(content.includes('⚠️ ಪಟ್ಟಿ ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ'), 'Must show honest user-facing recovery error');
});

// Test 6: Gallery selection and existing image-upload behavior
test('6. Gallery selection provides separate accessible picker without capture attribute', () => {
  const homePagePath = path.resolve(__dirname, '../src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePagePath, 'utf-8');

  // Verify gallery input configuration: accept="image/*" WITHOUT capture attribute
  const galleryMatch = content.match(/<input[^>]*ref=\{galleryInputRef\}[^>]*\/>/s);
  assert.ok(galleryMatch, 'galleryInputRef element must exist');
  assert.ok(galleryMatch[0].includes('accept="image/*"'), 'Gallery input must accept images');
  assert.ok(!galleryMatch[0].includes('capture='), 'Gallery input must not have capture attribute to allow file picker');

  // Verify action sheet options
  assert.ok(content.includes('id="btn-choose-camera"'), 'Must have accessible camera trigger button');
  assert.ok(content.includes('id="btn-choose-gallery"'), 'Must have accessible gallery trigger button');
});

// Test 7: English marketplace rendering using the actual saved English fields
test('7. Customer marketplace ProductDetails queries and renders English fields with local language toggle', () => {
  const detailsPath = path.resolve(__dirname, '../../frontend/src/pages/ProductDetails.jsx');
  assert.ok(fs.existsSync(detailsPath), 'ProductDetails.jsx must exist');
  const content = fs.readFileSync(detailsPath, 'utf-8');

  // Query must select both English and local fields
  assert.ok(content.includes('name,') && content.includes('local_title,'), 'ProductDetails must query name and local_title');
  assert.ok(content.includes('description,') && content.includes('local_description,'), 'ProductDetails must query description and local_description');

  // Must render English product.name as primary h1 title
  assert.ok(content.includes('{product.name}'), 'Marketplace must render English name as primary title');

  // Must provide localized original description view option
  assert.ok(content.includes('setActiveDescLang'), 'Marketplace must support description language selection');
  assert.ok(content.includes('getCleanEnglishDescription(product.description)'), 'Marketplace must render clean English description by default');
});

// Test 8: Original-language review and correction
test('8. Artisan can review in local language and correct details via voice commands', () => {
  const initialDraft = {
    name: 'Handcrafted Terracotta Water Pot',
    local_title: 'ಕೈಯಿಂದ ಮಾಡಿದ ಮಣ್ಣಿನ ನೀರಿನ ಮಡಕೆ',
    price: null,
    isPriceProvisional: true,
    missingDetails: [{ field: 'price' }],
    stock_quantity: 1,
    isStockProvisional: true,
    category: 'Pottery'
  };

  // Voice correction adds the missing price
  const priceCorrection = interpretCorrectionCommand('ಬೆಲೆ 450 ಮಾಡಿ', initialDraft, 'kn');
  assert.equal(priceCorrection.success, true);
  assert.equal(priceCorrection.updatedDraft.price, 450);
  assert.equal(priceCorrection.updatedDraft.isPriceProvisional, false);
  assert.equal(priceCorrection.updatedDraft.missingDetails.length, 0, 'Price must be removed from missingDetails');

  // Voice correction updates stock
  const stockCorrection = interpretCorrectionCommand('ದಾಸ್ತಾನು 60 ಮಾಡಿ', priceCorrection.updatedDraft, 'kn');
  assert.equal(stockCorrection.success, true);
  assert.equal(stockCorrection.updatedDraft.stock_quantity, 60);
  assert.equal(stockCorrection.updatedDraft.isStockProvisional, false);
});

// Test 9: Draft saving and publishing compatibility
test('9. Draft saving permits provisional price while publishing strictly requires confirmed price', () => {
  const homePagePath = path.resolve(__dirname, '../src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePagePath, 'utf-8');

  // Publishing validation requires confirmed price
  assert.ok(
    content.includes("targetStatus === 'published' && (!draft.price || Number(draft.price) <= 0)"),
    'Publishing must require a confirmed positive price'
  );

  // Saving as draft permits provisional price
  assert.ok(
    content.includes('price: Number(draft.price) || 0'),
    'Draft saving must permit 0 price for incomplete provisional drafts'
  );
});

// Test 10: Regression of existing continuous voice-description workflow
test('10. Continuous voice description lifecycle and single continuous workflow remains intact', () => {
  const homePagePath = path.resolve(__dirname, '../src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePagePath, 'utf-8');

  assert.ok(content.includes('startVoiceRecording'), 'startVoiceRecording handler must be present');
  assert.ok(content.includes('stopVoiceRecording'), 'stopVoiceRecording handler must be present');
  assert.ok(content.includes('cancelVoiceRecording'), 'cancelVoiceRecording handler must be present');
  assert.ok(content.includes('handleVoiceTranscriptReady'), 'handleVoiceTranscriptReady must bridge voice to product listing');
  assert.ok(content.includes('createVoiceSession'), 'createVoiceSession must be used for dual-engine voice transcription');
});

