import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Master Integration & Repair Verification Suite', () => {

  test('1. Failure A Fix: ProductPerformancePage queries stock_quantity and status (no nonexistent stock column)', () => {
    const perfFilePath = path.join(rootDir, 'src/pages/ProductPerformancePage.jsx');
    const content = fs.readFileSync(perfFilePath, 'utf8');

    // Must select stock_quantity and status
    assert.match(content, /select\(['"]id, name, price, stock_quantity, status/);
    assert.doesNotMatch(content, /select\(['"]id, name, price, stock, is_active/);

    // Maps stock_quantity to stock property
    assert.match(content, /stock:\s*p\.stock_quantity/);

    // Performance table headers: | Product | Orders | Units Sold | Completed Revenue | Stock | Status |
    assert.match(content, /Product/i);
    assert.match(content, /Orders/i);
    assert.match(content, /Units Sold/i);
    assert.match(content, /Completed/i);
    assert.match(content, /Stock/i);
    assert.match(content, /Status/i);
  });

  test('2. Failure B Fix: CustomerFeedbackPage queries product_reviews directly without invalid profiles join', () => {
    const feedbackFilePath = path.join(rootDir, 'src/pages/CustomerFeedbackPage.jsx');
    const content = fs.readFileSync(feedbackFilePath, 'utf8');

    // Must not join profiles inside product_reviews query
    assert.doesNotMatch(content, /\.from\('product_reviews'\)\s*\.select\([\s\S]*profiles\s*\(/);

    // Must directly select required columns
    assert.match(content, /\.from\('product_reviews'\)\s*\.select\('id, product_id, customer_id, rating, review_text, photo_url, created_at'\)/);

    // Must have safe fallback for Verified Buyer
    assert.match(content, /Verified Buyer/);
    assert.match(content, /ಪರಿಶೀಲಿತ ಖರೀದಿದಾರ/);

    // Must implement artisan reply save workflow with localStorage persistence
    assert.match(content, /handleSaveReply/);
    assert.match(content, /artisan_saved_review_replies/);
  });

  test('3. Failure C Fix: Customer Marketplace ProductDetails enquiry validation and safe storage handling', () => {
    const detailsPath = path.resolve(rootDir, '../frontend/src/pages/ProductDetails.jsx');
    const content = fs.readFileSync(detailsPath, 'utf8');

    // Authenticated check
    assert.match(content, /if\s*\(!user\)\s*\{\s*throw new Error\(['"]Please login/);

    // Artisan ID verification before submitting
    assert.match(content, /if\s*\(!product\s*\|\|\s*!product\.artisan_id\)/);

    // Storage upload error must be caught gracefully and not crash the enquiry
    assert.match(content, /try\s*\{[\s\S]*supabase\.storage[\s\S]*upload\(filePath[\s\S]*catch\s*\(uploadErr\)/);

    // Informative user-facing RLS violation message
    assert.match(content, /row-level security/);
  });

  test('4. Order Acceptance/Rejection Workflow in MyOrdersPage', () => {
    const ordersFilePath = path.join(rootDir, 'src/pages/MyOrdersPage.jsx');
    const content = fs.readFileSync(ordersFilePath, 'utf8');

    // Safe product selection without local_title column
    assert.match(content, /supabase\s*\.from\('products'\)\s*\.select\('id, name'\)/);
    assert.doesNotMatch(content, /supabase\s*\.from\('products'\)\s*\.select\('id, name, local_title'\)/);

    // Placed order acceptance and rejection buttons
    assert.match(content, /ord\.status === 'placed'/);
    assert.match(content, /Accept Order/);
    assert.match(content, /Reject/);
    assert.match(content, /handleRejectOrder/);
    assert.match(content, /ಆರ್ಡರ್ ಸ್ವೀಕರಿಸಿ/);
  });

  test('5. WhatsApp Assistant: Native Order Cards and Customer Enquiries', () => {
    const waPath = path.join(rootDir, 'src/pages/WhatsAppPlaceholderPage.jsx');
    const content = fs.readFileSync(waPath, 'utf8');

    // Order & Enquiry actions supported
    assert.match(content, /check_orders/);
    assert.match(content, /check_enquiries/);
    assert.match(content, /handleWhatsAppOrderAction/);
    assert.match(content, /handleReplyToEnquiry/);

    // Interactive cards rendered in chat
    assert.match(content, /msg\.orderCard/);
    assert.match(content, /msg\.enquiryCard/);

    // Accept / Reject buttons on order card
    assert.match(content, /handleWhatsAppOrderAction\(msg\.orderCard\.id,\s*'confirmed'\)/);
    assert.match(content, /handleWhatsAppOrderAction\(msg\.orderCard\.id,\s*'cancelled'\)/);
  });

  test('6. Kannada Engine Speed and Timing Benchmark', async () => {
    const enginePath = path.join(rootDir, 'src/lib/kannadaProductEngine.js');
    const engine = await import(pathToFileURL(enginePath).href);

    // Warm-up to trigger JIT optimization and regex compilation
    engine.extractProductFacts("warmup");

    const testTranscript = "ನಾನು ನೈಸರ್ಗಿಕ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಕೈಯಿಂದ ಮಾಡಿದ ಸಾಂಪ್ರದಾಯಿಕ ನೀರು ಕುಡಿಯುವ ಮಡಕೆ ತಯಾರಿಸಿದ್ದೇನೆ. ಇದರ ಬೆಲೆ 350 ರೂಪಾಯಿ. ನನ್ನ ಬಳಿ 25 ಮಡಕೆಗಳು ದಾಸ್ತಾನು ಇವೆ.";

    const startExtract = performance.now();
    const facts = engine.extractProductFacts(testTranscript);
    const extractDuration = performance.now() - startExtract;

    assert.equal(facts.price, 350, 'Price must be extracted as 350');
    assert.equal(facts.stockQuantity, 25, 'Stock must be extracted as 25');
    assert.ok(extractDuration < 100, `Fact extraction should complete under 100ms (took ${extractDuration.toFixed(2)}ms)`);

    const startListing = performance.now();
    const listing = await engine.buildProductListing(testTranscript, facts, 'kn');
    const listingDuration = performance.now() - startListing;

    assert.ok(listing.localTitle, 'Generated local title must exist');
    assert.ok(listing.englishTitle, 'Generated English title must exist');
    assert.ok(listing.englishDescription, 'Generated English description must exist');
    assert.equal(listing.price, 350, 'Listing price must match extracted price');
    assert.equal(listing.stock_quantity, 25, 'Listing stock must match extracted stock');
    assert.ok(extractDuration < 100, `Fact extraction should complete under 100ms (took ${extractDuration.toFixed(2)}ms)`);
    assert.ok(listingDuration < 500, `Bilingual draft build should complete under 500ms (took ${listingDuration.toFixed(2)}ms)`);
  });

});
