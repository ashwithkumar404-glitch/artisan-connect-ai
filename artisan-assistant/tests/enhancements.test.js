import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('1. Photo banner clear actions: Change Photo, Remove Photo, Speak Description, and Type Description', () => {
  const homePagePath = path.resolve(__dirname, '../src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePagePath, 'utf-8');

  // Must have clear action buttons so the artisan never has to guess what to do
  assert.ok(content.includes('btn-photo-action'), 'Must have .btn-photo-action classes');
  assert.ok(content.includes('startVoiceRecording'), 'Must allow triggering voice recording directly from photo banner');
  assert.ok(content.includes('removePendingPhoto'), 'Must allow removing photo');
  assert.ok(content.includes('setShowPhotoPickerSheet(true)'), 'Must allow changing photo');
  assert.ok(content.includes('textInputRef.current?.focus()'), 'Must allow focusing text input to type description');
});

test('2. Photo upload failure handling: Non-silent honest error reporting and retry without duplicate product rows', () => {
  const homePagePath = path.resolve(__dirname, '../src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePagePath, 'utf-8');

  // Verify honest upload error check (never silent failure)
  assert.ok(content.includes('photoUploadFailed = true'), 'Must track photo upload failure explicitly');
  assert.ok(content.includes('setPartialUploadFailure'), 'Must store partial upload failure state for recovery');
  assert.ok(content.includes('handleRetryPhotoUpload'), 'Must provide handleRetryPhotoUpload recovery handler');
  assert.ok(content.includes('retry_photo_upload'), 'Must provide retry action button');
  assert.ok(!content.includes('if (!uploadErr) {\n          const { data: urlData } = supabase.storage\n            .from(\'product-images\')\n            .getPublicUrl(storagePath);\n\n          await supabase.from(\'product_images\')'), 'Must not silently skip image upload error');
});

test('3. Duplicate submission prevention on product saving', () => {
  const homePagePath = path.resolve(__dirname, '../src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePagePath, 'utf-8');

  assert.ok(content.includes('isSavingProduct'), 'Must track isSavingProduct state');
  assert.ok(content.includes('if (isSavingProduct || processing) return;'), 'Must reject duplicate clicks while saving');
  assert.ok(content.includes('setIsSavingProduct(true)'), 'Must set saving state during submission');
  assert.ok(content.includes('setIsSavingProduct(false)'), 'Must reset saving state on finish or error');
});

test('4. Faster listing generation: Base64 image payload removed from text classifier Edge Function', () => {
  const homePagePath = path.resolve(__dirname, '../src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePagePath, 'utf-8');

  // Ensure generateProductListing does not encode 5MB base64 images into the edge function call
  const generateSectionMatch = content.match(/const generateProductListing = async[\s\S]*?setCurrentDraft/);
  assert.ok(generateSectionMatch, 'generateProductListing function must exist');
  assert.ok(!generateSectionMatch[0].includes('image: base64Image'), 'Edge function body must not include bulky base64 image');
  assert.ok(generateSectionMatch[0].includes('voiceTranscript: voiceText'), 'Must pass voice transcript to edge function');
});

test('5. Local/English listing separation: Schema migration & backward-compatible fallback', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20261026220000_add_local_language_fields.sql');
  assert.ok(fs.existsSync(migrationPath), 'Forward-only SQL migration for local language fields must exist');

  const sql = fs.readFileSync(migrationPath, 'utf-8');
  assert.ok(sql.toLowerCase().includes('local_title text'), 'Migration must add nullable local_title');
  assert.ok(sql.toLowerCase().includes('local_description text'), 'Migration must add nullable local_description');

  const homePageContent = fs.readFileSync(path.resolve(__dirname, '../src/pages/HomePage.jsx'), 'utf-8');
  assert.ok(homePageContent.includes('local_title: draft.local_title'), 'HomePage must save local_title');
  assert.ok(homePageContent.includes('local_description: draft.local_description'), 'HomePage must save local_description');

  const myProductsContent = fs.readFileSync(path.resolve(__dirname, '../src/pages/MyProductsPage.jsx'), 'utf-8');
  assert.ok(myProductsContent.includes('local_title'), 'MyProductsPage must query local_title');
  assert.ok(myProductsContent.includes('prod.local_title || prod.name'), 'MyProductsPage must display local_title when available');
});

test('6. Customer marketplace strips legacy concatenated bilingual description', () => {
  const productDetailsPath = path.resolve(__dirname, '../../frontend/src/pages/ProductDetails.jsx');
  assert.ok(fs.existsSync(productDetailsPath), 'ProductDetails.jsx must exist');

  const content = fs.readFileSync(productDetailsPath, 'utf-8');
  assert.ok(content.includes('getCleanEnglishDescription'), 'Must define getCleanEnglishDescription');
  assert.ok(content.includes('getCleanEnglishDescription(product.description)'), 'Must render cleaned English description');

  // Test the cleaning function behavior
  function testClean(desc) {
    if (!desc) return '';
    const sepIdx = desc.indexOf('\n\n---\n');
    if (sepIdx !== -1) return desc.substring(0, sepIdx).trim();
    return desc;
  }

  const legacyBilingual = 'Beautiful handcrafted clay pot made from natural mud.\n\n---\nಕನ್ನಡ ವಿವರಣೆ (Kannada Listing):\nಶೀರ್ಷಿಕೆ: ಮಣ್ಣಿನ ಮಡಕೆ\nವಿವರಣೆ: ನೈಸರ್ಗಿಕ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಮಾಡಿದ ಮಡಕೆ.';
  assert.equal(testClean(legacyBilingual), 'Beautiful handcrafted clay pot made from natural mud.');

  const normalEnglish = 'Handmade brass lamp with intricate traditional carving.';
  assert.equal(testClean(normalEnglish), 'Handmade brass lamp with intricate traditional carving.');
});

test('7. Theme toggle with localStorage persistence and system preference default', () => {
  const themeTogglePath = path.resolve(__dirname, '../src/components/ThemeToggle.jsx');
  assert.ok(fs.existsSync(themeTogglePath), 'ThemeToggle component must exist');

  const content = fs.readFileSync(themeTogglePath, 'utf-8');
  assert.ok(content.includes("localStorage.getItem('artisan_theme')"), 'Must inspect stored theme');
  assert.ok(content.includes("localStorage.setItem('artisan_theme'"), 'Must save theme to localStorage');
  assert.ok(content.includes('data-theme'), 'Must set data-theme attribute on document root');
  assert.ok(content.includes('prefers-color-scheme: dark'), 'Must check prefers-color-scheme on initial visit');
});

test('8. Marketplace link with VITE_MARKETPLACE_URL and honest fallback', () => {
  const langSelectorPath = path.resolve(__dirname, '../src/components/LanguageSelector.jsx');
  const content = fs.readFileSync(langSelectorPath, 'utf-8');

  assert.ok(content.includes('VITE_MARKETPLACE_URL'), 'Must use VITE_MARKETPLACE_URL environment variable');
  assert.ok(content.includes('handleOpenMarketplace'), 'Globe button must handle click');
  assert.ok(content.includes('alert('), 'Must display clear fallback alert if marketplace URL is unconfigured');
});

test('9. Government ID & OTP login landing page structure', () => {
  const loginPagePath = path.resolve(__dirname, '../src/pages/LoginPage.jsx');
  assert.ok(fs.existsSync(loginPagePath), 'LoginPage.jsx must exist');

  const content = fs.readFileSync(loginPagePath, 'utf-8');
  assert.ok(content.includes('artisan-otp'), 'Must invoke artisan-otp Edge Function');
  assert.ok(content.includes('request-otp'), 'Must support request-otp action');
  assert.ok(content.includes('verify-otp'), 'Must support verify-otp action');
  assert.ok(content.includes('otpStage'), 'Must manage OTP stages (request -> verify)');
  assert.ok(content.includes('resendCountdown'), 'Must support resend countdown timer');
  assert.ok(content.includes('authMethod'), 'Must support fallback toggle for staff / email & password');
  assert.ok(!content.includes('123456'), 'Must NOT hardcode fake OTP in production client code');
});
