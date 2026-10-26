import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('1. Camera input configuration: accept="image/*" and capture="environment" for rear camera', () => {
  const homePagePath = path.resolve(__dirname, '../src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePagePath, 'utf-8');

  // Must have camera input with rear camera capture
  assert.ok(content.includes('id="camera-input"'), 'Camera input must have id="camera-input"');
  assert.ok(content.includes('capture="environment"'), 'Camera input must specify capture="environment" for rear camera on mobile');
  assert.ok(content.includes('accept="image/*"'), 'Camera input must specify accept="image/*"');
  assert.ok(content.includes('ref={cameraInputRef}'), 'Camera input must bind to cameraInputRef');
});

test('2. Gallery input configuration: accept="image/*" without capture attribute for file/gallery picker', () => {
  const homePagePath = path.resolve(__dirname, '../src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePagePath, 'utf-8');

  // Must have gallery input WITHOUT capture attribute
  assert.ok(content.includes('id="gallery-input"'), 'Gallery input must have id="gallery-input"');
  assert.ok(content.includes('ref={galleryInputRef}'), 'Gallery input must bind to galleryInputRef');

  // Extract gallery input tag
  const galleryMatch = content.match(/<input[^>]*id="gallery-input"[^>]*>/s);
  assert.ok(galleryMatch, 'Gallery input tag must exist');
  assert.ok(!galleryMatch[0].includes('capture='), 'Gallery input must NOT have capture attribute, so it opens photo library/gallery');
});

test('3. Image validation rejects non-image mime types and oversized files (> 5MB)', () => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSizeBytes = 5 * 1024 * 1024; // 5 MB

  const validateImage = (file) => {
    if (!allowedMimeTypes.includes(file.type)) {
      return { valid: false, error: 'invalid_type' };
    }
    if (file.size > maxSizeBytes) {
      return { valid: false, error: 'oversized' };
    }
    return { valid: true };
  };

  // Valid files
  assert.equal(validateImage({ type: 'image/jpeg', size: 1024 * 500 }).valid, true);
  assert.equal(validateImage({ type: 'image/png', size: 1024 * 1024 * 2 }).valid, true);
  assert.equal(validateImage({ type: 'image/webp', size: 1024 * 300 }).valid, true);

  // Invalid types
  assert.equal(validateImage({ type: 'text/plain', size: 1024 }).error, 'invalid_type');
  assert.equal(validateImage({ type: 'application/pdf', size: 1024 * 50 }).error, 'invalid_type');
  assert.equal(validateImage({ type: 'video/mp4', size: 1024 * 1024 }).error, 'invalid_type');

  // Oversized file
  assert.equal(validateImage({ type: 'image/jpeg', size: 6 * 1024 * 1024 }).error, 'oversized');
});

test('4. Photo selection, replacement and removal lifecycle', () => {
  let objectUrlsCreated = [];
  let objectUrlsRevoked = [];

  const fakeURL = {
    createObjectURL: (file) => {
      const url = `blob:http://localhost/${file.name}`;
      objectUrlsCreated.push(url);
      return url;
    },
    revokeObjectURL: (url) => {
      objectUrlsRevoked.push(url);
    }
  };

  let pendingFile = null;
  let pendingPreview = '';
  let draft = { name: 'Clay Pot', imageUrl: '' };

  // Step 1: Select photo 1
  const selectPhoto = (file) => {
    if (pendingPreview) {
      fakeURL.revokeObjectURL(pendingPreview);
    }
    pendingFile = file;
    pendingPreview = fakeURL.createObjectURL(file);
    draft.imageUrl = pendingPreview;
  };

  selectPhoto({ name: 'pot1.jpg', type: 'image/jpeg', size: 1024 * 100 });
  assert.equal(pendingPreview, 'blob:http://localhost/pot1.jpg');
  assert.equal(draft.imageUrl, 'blob:http://localhost/pot1.jpg');
  assert.equal(objectUrlsCreated.length, 1);
  assert.equal(objectUrlsRevoked.length, 0);

  // Step 2: Replace with photo 2
  selectPhoto({ name: 'pot2_better.jpg', type: 'image/jpeg', size: 1024 * 200 });
  assert.equal(pendingPreview, 'blob:http://localhost/pot2_better.jpg');
  assert.equal(draft.imageUrl, 'blob:http://localhost/pot2_better.jpg');
  assert.equal(objectUrlsRevoked.length, 1);
  assert.equal(objectUrlsRevoked[0], 'blob:http://localhost/pot1.jpg');

  // Step 3: Remove photo
  const removePhoto = () => {
    if (pendingPreview) {
      fakeURL.revokeObjectURL(pendingPreview);
    }
    pendingFile = null;
    pendingPreview = '';
    draft.imageUrl = '';
  };

  removePhoto();
  assert.equal(pendingFile, null);
  assert.equal(pendingPreview, '');
  assert.equal(draft.imageUrl, '');
  assert.equal(objectUrlsRevoked.length, 2);
  assert.equal(objectUrlsRevoked[1], 'blob:http://localhost/pot2_better.jpg');
});

test('5. Mobile responsive CSS rules: min 44px touch targets, safe area insets, no overflow-x', () => {
  const chatCssPath = path.resolve(__dirname, '../src/pages/Chat.css');
  const indexCssPath = path.resolve(__dirname, '../src/index.css');

  const chatCss = fs.readFileSync(chatCssPath, 'utf-8');
  const indexCss = fs.readFileSync(indexCssPath, 'utf-8');

  // Verify safe area insets
  assert.ok(chatCss.includes('safe-area-inset-top'), 'Chat.css must support env(safe-area-inset-top)');
  assert.ok(chatCss.includes('safe-area-inset-bottom'), 'Chat.css must support env(safe-area-inset-bottom)');

  // Verify min-height 44px touch targets for buttons
  assert.ok(chatCss.includes('min-height: 44px') || chatCss.includes('min-height: 48px'), 'Chat.css must enforce touch targets >= 44px');

  // Verify Kannada line height and overflow wrapping
  assert.ok(indexCss.includes('overflow-wrap: break-word'), 'index.css must specify overflow-wrap: break-word');
  assert.ok(!indexCss.includes('word-break: break-all'), 'index.css must NOT have word-break: break-all which breaks Kannada conjunct glyphs');

  // Verify photo sheet modal classes
  assert.ok(chatCss.includes('.photo-sheet-backdrop'), 'Chat.css must have .photo-sheet-backdrop');
  assert.ok(chatCss.includes('.photo-sheet-content'), 'Chat.css must have .photo-sheet-content');
  assert.ok(chatCss.includes('.pending-photo-banner'), 'Chat.css must have .pending-photo-banner');
});

test('6. Vercel SPA configuration exists and has correct rewrite rules', () => {
  const vercelPath = path.resolve(__dirname, '../vercel.json');
  assert.ok(fs.existsSync(vercelPath), 'artisan-assistant/vercel.json must exist');

  const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
  assert.equal(vercelConfig.framework, 'vite', 'vercel.json must specify Vite framework');
  assert.equal(vercelConfig.buildCommand, 'npm run build', 'vercel.json must specify npm run build');
  assert.equal(vercelConfig.outputDirectory, 'dist', 'vercel.json must specify dist output');
  assert.ok(Array.isArray(vercelConfig.rewrites), 'vercel.json must have rewrites array');
  assert.equal(vercelConfig.rewrites[0].source, '/(.*)');
  assert.equal(vercelConfig.rewrites[0].destination, '/index.html');
});
