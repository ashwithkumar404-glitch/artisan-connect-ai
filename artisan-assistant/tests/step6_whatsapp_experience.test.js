import { test } from 'node:test';
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

// 1. Navigation & Route Integrity
test('1. App routing and SideMenu include all required artisan screens and WhatsApp channel', () => {
  const appSrc = fs.readFileSync(path.resolve(__dirname, '../src/App.jsx'), 'utf8');
  const sideMenuSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/SideMenu.jsx'), 'utf8');
  const whatsAppPageSrc = fs.readFileSync(path.resolve(__dirname, '../src/pages/WhatsAppPlaceholderPage.jsx'), 'utf8');

  // App routes
  assert.ok(appSrc.includes('path="/" element={<HomePage />}'), 'App must route / to HomePage');
  assert.ok(appSrc.includes('path="/add-product" element={<AddProductPage />}'), 'App must route /add-product to AddProductPage');
  assert.ok(appSrc.includes('path="/my-products" element={<MyProductsPage />}'), 'App must route /my-products to MyProductsPage');
  assert.ok(appSrc.includes('path="/my-orders" element={<MyOrdersPage />}'), 'App must route /my-orders to MyOrdersPage');
  assert.ok(appSrc.includes('path="/my-earnings" element={<MyEarningsPage />}'), 'App must route /my-earnings to MyEarningsPage');
  assert.ok(appSrc.includes('path="/whatsapp" element={<WhatsAppPlaceholderPage />}'), 'App must route /whatsapp to WhatsAppPlaceholderPage');

  // SideMenu navigation links
  assert.ok(sideMenuSrc.includes('to="/"'), 'SideMenu must link to / (Assistant Chat)');
  assert.ok(sideMenuSrc.includes('to="/my-products"'), 'SideMenu must link to /my-products');
  assert.ok(sideMenuSrc.includes('to="/add-product"'), 'SideMenu must link to /add-product');
  assert.ok(sideMenuSrc.includes('to="/my-orders"'), 'SideMenu must link to /my-orders');
  assert.ok(sideMenuSrc.includes('to="/my-earnings"'), 'SideMenu must link to /my-earnings');
  assert.ok(sideMenuSrc.includes('to="/whatsapp"'), 'SideMenu must link to /whatsapp');

  // WhatsApp Channel page content
  assert.ok(whatsAppPageSrc.includes('WhatsApp'), 'WhatsApp page must clearly represent the WhatsApp channel');
  assert.ok(whatsAppPageSrc.includes('to="/"'), 'WhatsApp page must provide quick launch back to Web Assistant');
});

// 2. Mobile Camera vs Gallery Input Separation
test('2. Photo controls provide rear camera and separate gallery file picker', () => {
  const homeSrc = fs.readFileSync(path.resolve(__dirname, '../src/pages/HomePage.jsx'), 'utf8');

  // Camera input
  assert.ok(homeSrc.includes('ref={cameraInputRef}'), 'HomePage must have camera ref');
  assert.ok(homeSrc.includes('capture="environment"'), 'Camera input must set capture="environment" for mobile rear camera');

  // Gallery input
  assert.ok(homeSrc.includes('ref={galleryInputRef}'), 'HomePage must have gallery ref');
  assert.ok(!homeSrc.includes('ref={galleryInputRef}\n        accept="image/*"\n        capture='), 'Gallery input must not set capture attribute');

  // Action sheet options
  assert.ok(homeSrc.includes('btn-choose-camera'), 'Action sheet must have camera option');
  assert.ok(homeSrc.includes('btn-choose-gallery'), 'Action sheet must have gallery option');
});

// 3. Audio Recording & Feedback States
test('3. Audio recording UI has live timer, preview, stop, cancel and permission error states', () => {
  const homeSrc = fs.readFileSync(path.resolve(__dirname, '../src/pages/HomePage.jsx'), 'utf8');

  assert.ok(homeSrc.includes('className="recording-bar"'), 'Must render recording bar when recording');
  assert.ok(homeSrc.includes('recordingSeconds'), 'Must track recording seconds timer');
  assert.ok(homeSrc.includes('liveTranscript'), 'Must display live transcript preview');
  assert.ok(homeSrc.includes('stopVoiceRecording'), 'Must provide stop recording handler');
  assert.ok(homeSrc.includes('cancelVoiceRecording'), 'Must provide cancel recording handler');
  assert.ok(homeSrc.includes('PERMISSION_DENIED'), 'Must handle PERMISSION_DENIED state gracefully');
});

// 4. End-to-End AI Listing: Kannada speech to clean English listing with facts
test('4. End-to-end AI listing produces clean English title and description without Kannada leakage', () => {
  const knTranscript = 'ಇದು ನೈಸರ್ಗಿಕ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಕುಂಬಾರಿಕೆ ಚಕ್ರದಲ್ಲಿ ಮಾಡಿದ ನೀರಿನ ಮಡಕೆ. ನೈಸರ್ಗಿಕವಾಗಿ ನೀರು ತಂಪಾಗಿಸಲು ಉತ್ತಮ. ದಾಸ್ತಾನು 60 units ಇದೆ. ಬೆಲೆ 350 ರೂಪಾಯಿ.';
  const facts = extractProductFacts(knTranscript);
  const listing = buildProductListing(knTranscript, facts);

  // Accurate fact extraction
  assert.equal(facts.stockQuantity, 60, 'Stated stock of 60 units must be preserved as 60');
  assert.equal(facts.price, 350, 'Price of 350 must be extracted');
  assert.ok(facts.materialKn && facts.materialKn.includes('ಜೇಡಿಮಣ್ಣು'), 'Clay material recognized');

  // Clean English Title & Description
  assert.equal(listing.englishTitle, 'Handcrafted Terracotta Water Pot');
  assert.equal(isKannadaScript(listing.englishDescription), false, 'English description must NOT contain any Kannada script');
  assert.ok(listing.englishDescription.toLowerCase().includes('water pot'), 'English description references craft form');
  assert.ok(listing.englishDescription.includes('Terracotta') || listing.englishDescription.toLowerCase().includes('clay'), 'English description references material');

  // Local Title & Description
  assert.equal(isKannadaScript(listing.localTitle), true, 'Local title must be in Kannada script');
  assert.equal(isKannadaScript(listing.localDescription), true, 'Local description must be in Kannada script');
});

// 5. Price confirmation enforcement on publishing
test('5. Publishing strictly enforces price confirmation while draft saving permits provisional drafts', () => {
  const unpricedTranscript = 'ಇದು ಕೈಯಿಂದ ಮಾಡಿದ ಶ್ರೀಗಂಧದ ಮರದ ಪೆಟ್ಟಿಗೆ. ದಾಸ್ತಾನು 10 ಇದೆ.';
  const facts = extractProductFacts(unpricedTranscript);
  const listing = buildProductListing(unpricedTranscript, facts);

  // Price must be null (never 500)
  assert.equal(listing.price, null, 'Unvoiced price must remain null');
  assert.equal(listing.isPriceProvisional, true, 'Unvoiced price must be flagged provisional');
  assert.ok(listing.missingDetails.some(m => m.field === 'price'), 'Missing details must include price prompt');

  // Verify HomePage guards
  const homeSrc = fs.readFileSync(path.resolve(__dirname, '../src/pages/HomePage.jsx'), 'utf8');
  assert.ok(
    homeSrc.includes("targetStatus === 'published' && (!draft.price || Number(draft.price) <= 0)"),
    'Publishing must require price > 0'
  );
});

// 6. Voice Correction Workflow
test('6. Voice correction updates only specified field and resolves provisional state', () => {
  const initialDraft = {
    name: 'Handcrafted Sandalwood Box',
    local_title: 'ಕೈಯಿಂದ ಮಾಡಿದ ಶ್ರೀಗಂಧದ ಮರದ ಪೆಟ್ಟಿಗೆ',
    price: null,
    isPriceProvisional: true,
    stock_quantity: 10,
    isStockProvisional: false,
    missingDetails: [{ field: 'price', prompt_kn: 'ದಯವಿಟ್ಟು ಬೆಲೆ ತಿಳಿಸಿ' }],
    category: 'Wood Craft',
    description: 'Authentic handcrafted wooden box.'
  };

  const correction = interpretCorrectionCommand('ಬೆಲೆ 750 ರೂಪಾಯಿ ಮಾಡಿ', initialDraft, 'kn');
  assert.equal(correction.success, true, 'Voice correction must succeed');
  assert.equal(correction.updatedDraft.price, 750, 'Price must be updated to 750');
  assert.equal(correction.updatedDraft.isPriceProvisional, false, 'isPriceProvisional must become false');
  assert.equal(correction.updatedDraft.stock_quantity, 10, 'Stock must remain untouched');
  assert.equal(correction.updatedDraft.missingDetails.length, 0, 'Price must be removed from missingDetails');
});

// 7. Customer Marketplace localized view toggle
test('7. Customer marketplace ProductDetails supports English primary view and Kannada toggle', () => {
  const detailsSrc = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/pages/ProductDetails.jsx'), 'utf8');

  assert.ok(detailsSrc.includes('local_title'), 'ProductDetails must query local_title');
  assert.ok(detailsSrc.includes('local_description'), 'ProductDetails must query local_description');
  assert.ok(detailsSrc.includes('activeDescLang'), 'ProductDetails must maintain active description language state');
  assert.ok(detailsSrc.includes("setActiveDescLang('local')") || detailsSrc.includes('setActiveDescLang'), 'ProductDetails must support switching description language');
});
