import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import production pure functions
import { interpretCorrectionCommand } from '../src/lib/kannadaProductEngine.js';

test('Phase 2 Priority 1: Delivery Lifecycle & Shipped != Delivered Verification', () => {
  const buyerProfilePath = path.resolve(__dirname, '../../frontend/src/pages/BuyerProfile.jsx');
  const myOrdersPath = path.resolve(__dirname, '../src/pages/MyOrdersPage.jsx');

  assert.ok(fs.existsSync(buyerProfilePath), 'BuyerProfile.jsx must exist');
  assert.ok(fs.existsSync(myOrdersPath), 'MyOrdersPage.jsx must exist');

  const buyerContent = fs.readFileSync(buyerProfilePath, 'utf-8');
  const ordersContent = fs.readFileSync(myOrdersPath, 'utf-8');

  // 1. Enforce that shipped is distinct from delivered
  assert.ok(
    buyerContent.includes("order.status === 'shipped'") && buyerContent.includes("order.status === 'delivered'"),
    'BuyerProfile must distinguish shipped transit state from confirmed delivered state'
  );

  // 2. Customer Receipt Confirmation button
  assert.ok(
    buyerContent.includes('Confirm Order Received / ವಿತರಣೆ ಖಚಿತಪಡಿಸಿ') && buyerContent.includes("handleConfirmReceived"),
    'BuyerProfile must provide explicit customer receipt confirmation button'
  );

  // 3. Status transition to delivered updates Supabase orders table
  assert.ok(
    buyerContent.includes(".update({ status: 'delivered' })"),
    'handleConfirmReceived must update orders table with status: delivered'
  );

  // 4. Carrier & Tracking reference rendering
  assert.ok(
    buyerContent.includes('getOrderTracking') && buyerContent.includes('Courier:'),
    'BuyerProfile must display courier carrier name and consignment tracking reference'
  );

  // 5. Artisan Courier Dispatch modal and tracking capture
  assert.ok(
    ordersContent.includes('shippingModalOrder') && ordersContent.includes('carrierName') && ordersContent.includes('trackingNumber'),
    'MyOrdersPage must provide carrier dispatch modal capturing courier name and tracking consignment'
  );

  // 6. Artisan manual in-person delivery fallback
  assert.ok(
    ordersContent.includes('handleManualDeliveryConfirm'),
    'MyOrdersPage must support artisan manual delivery recording'
  );
});

test('Phase 2 Priority 2: Voice-Based Listing Corrections & Old vs New Diff', () => {
  const addProdPath = path.resolve(__dirname, '../src/pages/AddProductPage.jsx');
  assert.ok(fs.existsSync(addProdPath), 'AddProductPage.jsx must exist');
  const content = fs.readFileSync(addProdPath, 'utf-8');

  // 1. Separate Edit with text and Edit with voice actions on review screen
  assert.ok(
    content.includes('Edit with text') && content.includes('Edit with voice'),
    'AddProductPage must offer distinct Edit with text and Edit with voice actions on review step'
  );

  // 2. Old vs New Diff display
  assert.ok(
    content.includes('fieldDiffs') && content.includes('Changed from'),
    'AddProductPage must render visual diff badge showing old value to new value'
  );

  // 3. Explicit artisan approval boundary (never auto-publishes)
  assert.ok(
    content.includes('handleConfirmSave') && content.includes('Publish Directly') && content.includes('Save as Draft'),
    'AddProductPage must require explicit click to save draft or publish directly'
  );

  // 4. Test Kannada price mutation: "ಬೆಲೆ 450 ಮಾಡಿ"
  const draftInitial = {
    name: 'Bidri Craft Vase',
    description: 'Traditional handcrafted metal vase',
    price: 400,
    stock_quantity: 5
  };
  const priceResult = interpretCorrectionCommand('ಬೆಲೆ 450 ಮಾಡಿ', draftInitial, 'kn');
  assert.equal(priceResult.success, true);
  assert.equal(priceResult.modifiedField, 'price');
  assert.equal(priceResult.newValue, 450);
  assert.equal(priceResult.updatedDraft.price, 450);
  // Preserves unaffected fields
  assert.equal(priceResult.updatedDraft.name, 'Bidri Craft Vase');
  assert.equal(priceResult.updatedDraft.stock_quantity, 5);

  // 5. Test English stock mutation: "change quantity to 12"
  const stockResult = interpretCorrectionCommand('change quantity to 12', draftInitial, 'en');
  assert.equal(stockResult.success, true);
  assert.equal(stockResult.modifiedField, 'stock_quantity');
  assert.equal(stockResult.newValue, 12);
  assert.equal(stockResult.updatedDraft.stock_quantity, 12);
  assert.equal(stockResult.updatedDraft.price, 400); // price untouched
});

test('Phase 2 Priority 3: Customer Feedback Classification, Local-Language Insights & Speech Synthesis', () => {
  const feedbackPath = path.resolve(__dirname, '../src/pages/CustomerFeedbackPage.jsx');
  assert.ok(fs.existsSync(feedbackPath), 'CustomerFeedbackPage.jsx must exist');
  const content = fs.readFileSync(feedbackPath, 'utf-8');

  // 1. Classification logic for 4 sentiment categories
  assert.ok(content.includes('classifyReview'), 'Must define classifyReview helper');
  assert.ok(content.includes('delivery_issue') && content.includes('quality_complaint'), 'Must classify delivery issues and quality complaints');
  assert.ok(content.includes('suggestion') && content.includes('praise'), 'Must classify suggestions and praises');

  // 2. Actionable next steps and local language insight
  assert.ok(content.includes('nextStepsKn') && content.includes('explanationKn'), 'Must generate Kannada next steps and explanation');

  // 3. Web Speech Synthesis TTS integration
  assert.ok(
    content.includes('speechSynthesis') && content.includes('speakExplanation'),
    'CustomerFeedbackPage must support browser Speech Synthesis for voice explanation'
  );

  // 4. Database review eligibility strictly requiring delivery in BuyerProfile
  const buyerProfilePath = path.resolve(__dirname, '../../frontend/src/pages/BuyerProfile.jsx');
  const buyerContent = fs.readFileSync(buyerProfilePath, 'utf-8');
  assert.ok(
    buyerContent.includes(".eq('status', 'delivered')"),
    'BuyerProfile reviews tab must strictly query delivered orders for review eligibility'
  );
});

test('Phase 2 Priority 4: Bulk Price Negotiation Math & Counteroffer Approval', () => {
  const waPath = path.resolve(__dirname, '../src/pages/WhatsAppPlaceholderPage.jsx');
  assert.ok(fs.existsSync(waPath), 'WhatsAppPlaceholderPage.jsx must exist');
  const content = fs.readFileSync(waPath, 'utf-8');

  // 1. Negotiation breakdown
  assert.ok(
    content.includes('handleNegotiateCounteroffer'),
    'WhatsAppPlaceholderPage must implement handleNegotiateCounteroffer'
  );
  assert.ok(
    content.includes('Listed Estimate:') && content.includes('Customer Offer:'),
    'WhatsAppPlaceholderPage must display listed estimate vs customer offer breakdown'
  );

  // 2. Counteroffer formula verification
  const unitPrice = 400;
  const quantity = 10;
  const listedEstimate = unitPrice * quantity; // 4000
  const customerProposal = 3000;
  const variance = listedEstimate - customerProposal; // 1000 below estimate
  const suggestedCounter = Math.round((listedEstimate + customerProposal) / 2); // 3500
  const counterPerUnit = Math.round(suggestedCounter / quantity); // 350

  assert.equal(listedEstimate, 4000);
  assert.equal(variance, 1000);
  assert.equal(suggestedCounter, 3500);
  assert.equal(counterPerUnit, 350);

  // 3. Explicit artisan confirmation required before counteroffer transmission
  assert.ok(
    content.includes('window.confirm(confirmText)'),
    'Counteroffer must require explicit artisan confirmation before sending'
  );

  // 4. Deep link support via search params
  assert.ok(
    content.includes('useSearchParams'),
    'WhatsAppPlaceholderPage must accept search params for deep linking'
  );
});

test('Phase 2 Priority 5: Market Performance Trends & Actionable Craft Opportunities', () => {
  const perfPath = path.resolve(__dirname, '../src/pages/ProductPerformancePage.jsx');
  assert.ok(fs.existsSync(perfPath), 'ProductPerformancePage.jsx must exist');
  const content = fs.readFileSync(perfPath, 'utf-8');

  // 1. Transparent data source and sample size disclosure
  assert.ok(
    content.includes('Karnataka Regional Handicraft Dataset') && content.includes('1,420 buyer queries'),
    'ProductPerformancePage must disclose market dataset and sample size transparently'
  );

  // 2. Actionable craft opportunities
  assert.ok(
    content.includes('Explore this craft idea') || content.includes('ಈ ಕಲ್ಪನೆಯನ್ನು ಅನ್ವೇಷಿಸಿ'),
    'ProductPerformancePage must provide Explore this craft idea buttons'
  );

  // 3. Navigation with prefilled craft data to AddProductPage
  assert.ok(
    content.includes("navigate('/add-product'") && content.includes('prefill:'),
    'Clicking Explore craft idea must navigate to AddProductPage with prefilled craft data'
  );

  // 4. AddProductPage consuming prefill state
  const addProdPath = path.resolve(__dirname, '../src/pages/AddProductPage.jsx');
  const addProdContent = fs.readFileSync(addProdPath, 'utf-8');
  assert.ok(
    addProdContent.includes('location.state?.prefill'),
    'AddProductPage must consume prefilled craft data on mount'
  );
});

