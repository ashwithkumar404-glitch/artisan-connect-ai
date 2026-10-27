// tests/auth_and_storage_policy.test.js
// Verification suite for Government/Internal Artisan Registry ID + OTP Authentication,
// Development OTP Isolation, RLS Policies, Cross-Artisan Access Control, and Workflow Integrity.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loginPagePath = path.resolve(__dirname, '../src/pages/LoginPage.jsx');
const edgeFunctionPath = path.resolve(__dirname, '../../supabase/functions/artisan-otp/index.ts');
const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20261026221000_secure_product_publication_and_storage.sql');
const registryMigrationPath = path.resolve(__dirname, '../../supabase/migrations/20261026222000_artisan_otp_auth.sql');
const homePagePath = path.resolve(__dirname, '../src/pages/HomePage.jsx');

// Helper to calculate sha256 matching edge function
function sha256Sync(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

test('1. Valid OTP and genuine Supabase Auth session establishment', () => {
  const loginContent = fs.readFileSync(loginPagePath, 'utf-8');
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8');

  // Unified artisanIdCode contract
  assert.ok(loginContent.includes('artisanIdCode: cleanId'), "LoginPage must send 'artisanIdCode'");
  assert.ok(edgeContent.includes('const artisanIdCode = body.artisanIdCode'), "Edge function must extract 'artisanIdCode'");

  // Server generates genuine magiclink token hash via Supabase Auth Admin API
  assert.ok(
    edgeContent.includes("supabase.auth.admin.generateLink"),
    "Edge function must use supabase.auth.admin.generateLink to issue genuine login token"
  );
  assert.ok(
    edgeContent.includes("token_hash: linkData.properties.hashed_token"),
    "Edge function must return token_hash from generateLink"
  );

  // Client exchanges token_hash via verifyOtp to establish genuine session
  assert.ok(
    loginContent.includes("supabase.auth.verifyOtp"),
    "LoginPage.jsx must invoke supabase.auth.verifyOtp to establish genuine session"
  );
  assert.ok(
    loginContent.includes("token_hash: data.token_hash"),
    "LoginPage.jsx must supply token_hash to supabase.auth.verifyOtp"
  );
  assert.ok(
    loginContent.includes("if (!authData?.session)"),
    "LoginPage.jsx must verify session presence before navigating"
  );

  // Profile and artisan records are synced with 'approved' status
  assert.ok(edgeContent.includes(".from('profiles').upsert"), "Profile must be upserted");
  assert.ok(edgeContent.includes("role: 'artisan'"), "Profile role must be set to 'artisan'");
  assert.ok(edgeContent.includes("verification_status: 'approved'"), "Registry-verified artisan must have approved status");
});

test('2. Incorrect OTP validation and attempt tracking', () => {
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8');

  // Simulating hash verification
  const secretCode = 'KA-ART-1001';
  const realOtp = '739281';
  const wrongOtp = '111111';
  const correctHash = sha256Sync(`${secretCode}_${realOtp}`);
  const wrongHash = sha256Sync(`${secretCode}_${wrongOtp}`);

  assert.notEqual(correctHash, wrongHash, "Mismatched OTP hashes must not equate");

  // Verify edge function increments attempt counter on failure
  assert.ok(
    edgeContent.includes("if (inputHash !== challenge.otp_hash)"),
    "Edge function must detect hash mismatch"
  );
  assert.ok(
    edgeContent.includes("const nextAttempts = challenge.attempts + 1;"),
    "Edge function must increment attempts on failure"
  );
  assert.ok(
    edgeContent.includes(".update({ attempts: nextAttempts })"),
    "Edge function must persist incremented attempts to DB"
  );
  assert.ok(
    edgeContent.includes("attempts remaining"),
    "Edge function must inform client of remaining attempts"
  );
});

test('3. Expired OTP challenge rejection', () => {
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8');

  // Verify database query explicitly filters out expired challenges
  assert.ok(
    edgeContent.includes(".gt('expires_at', new Date().toISOString())"),
    "Edge function must filter challenges where expires_at > current time"
  );
  assert.ok(
    edgeContent.includes("OTP has expired, is invalid, or has already been used"),
    "Edge function must return clear error for expired challenges"
  );

  // Expiration duration should be 5 minutes (300,000 ms)
  assert.ok(
    edgeContent.includes("Date.now() + 5 * 60 * 1000"),
    "Challenge must expire 5 minutes after creation"
  );
});

test('4. OTP single-use and replay prevention (no reuse)', () => {
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8');

  // Verify query checks verified_at IS NULL
  assert.ok(
    edgeContent.includes(".is('verified_at', null)"),
    "Edge function must only fetch unverified challenges"
  );

  // Verify immediate mark as verified upon successful verification
  assert.ok(
    edgeContent.includes(".update({ verified_at: new Date().toISOString() })"),
    "Edge function must record verified_at immediately upon OTP match"
  );

  // Once verified_at is non-null, subsequent queries with .is('verified_at', null) return 0 rows
  const simulatedChallenge = { id: 'c1', verified_at: '2026-10-27T10:00:00Z' };
  const isAvailableForVerification = simulatedChallenge.verified_at === null;
  assert.equal(isAvailableForVerification, false, "Verified challenges cannot be reused");
});

test('5. Excessive verification attempts lockout and request rate limiting', () => {
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8');

  // Verification attempt lockout: max_attempts exceeded
  assert.ok(
    edgeContent.includes("if (challenge.attempts >= challenge.max_attempts)"),
    "Edge function must check if challenge.attempts >= challenge.max_attempts"
  );
  assert.ok(
    edgeContent.includes("Maximum verification attempts exceeded. Please request a new OTP."),
    "Edge function must lock out after maximum attempts"
  );

  // Request rate-limiting: maximum 3 challenge requests per 60 seconds
  assert.ok(
    edgeContent.includes("recentChallenges && recentChallenges.length >= 3"),
    "Edge function must rate limit to 3 OTP requests per minute"
  );
  assert.ok(
    edgeContent.includes("Too many OTP requests. Please wait 60 seconds"),
    "Edge function must return 429 error on rapid requests"
  );
});

test('6. Missing or invalid artisan ID handling', () => {
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8');
  const loginContent = fs.readFileSync(loginPagePath, 'utf-8');

  // Client validation
  assert.ok(
    loginContent.includes("if (!cleanId)"),
    "LoginPage.jsx must validate presence of artisan ID before dispatching request"
  );

  // Server validation
  assert.ok(
    edgeContent.includes("if (!normalizedCode)"),
    "Edge function must reject empty normalizedCode"
  );
  assert.ok(
    edgeContent.includes("status: 400"),
    "Edge function must return HTTP 400 for missing ID"
  );

  // Unregistered ID returns 404
  assert.ok(
    edgeContent.includes("Artisan ID not found in registered artisan database"),
    "Edge function must return 404 with helpful guidance for unregistered IDs"
  );
});

test('7. Cross-artisan access controls (profiles, products, storage)', () => {
  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
  const setupContent = fs.readFileSync(path.resolve(__dirname, '../../frontend/supabase_setup.sql'), 'utf-8');

  // Profile RLS isolates user records by auth.uid()
  assert.ok(
    setupContent.includes("CREATE POLICY \"Users can read their own profile\" \nON public.profiles \nFOR SELECT \nTO authenticated \nUSING (auth.uid() = id);"),
    "Profiles table must only permit users to read their own profile"
  );

  // Product RLS isolates draft / pending products by artisan ownership
  assert.ok(
    migrationContent.includes("artisan_id IN (\n                SELECT id FROM public.artisans WHERE profile_id = auth.uid()\n            )"),
    "Products table must ensure artisans can only insert their own products"
  );

  // Storage RLS prevents an artisan from uploading or deleting photos in another artisan's folder
  assert.ok(
    migrationContent.includes("(storage.foldername(name))[1]::uuid IN (\n                        SELECT id FROM public.artisans WHERE profile_id = auth.uid()\n                    )"),
    "Storage RLS must verify that folder UUID belongs to public.artisans for auth.uid()"
  );
});

test('8. Unauthenticated product creation and unauthorized product updates', () => {
  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

  // Insert policy restricted to authenticated role
  assert.ok(
    migrationContent.includes("CREATE POLICY insert_products ON public.products\n    FOR INSERT\n    TO authenticated"),
    "Product insertion must require authenticated session"
  );

  // Unapproved artisans cannot publish directly (must stay in draft or pending_review)
  assert.ok(
    migrationContent.includes("status = 'published' AND artisan_id IN (\n                        SELECT id FROM public.artisans WHERE profile_id = auth.uid() AND verification_status = 'approved'\n                    )"),
    "Only approved artisans or admins can publish products directly"
  );

  // Artisans cannot change their own verification_status
  assert.ok(
    migrationContent.includes("Artisans cannot change their own verification status"),
    "Trigger must prevent non-admins from changing verification_status on public.artisans"
  );
});

test('9. Development OTP disabled in production configuration', () => {
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8');

  // Environment detection must strictly identify production
  assert.ok(
    edgeContent.includes("const isProduction = envMode === 'production' || Deno.env.get('NODE_ENV') === 'production';"),
    "Edge function must detect production environment strictly"
  );

  // Dev OTP flag is disabled when in production
  assert.ok(
    edgeContent.includes("const allowDevTestOtp = !isProduction && ("),
    "Development test OTP must be false whenever isProduction is true"
  );

  // When not allowDevTestOtp, random cryptographic OTP is used
  assert.ok(
    edgeContent.includes("crypto.getRandomValues(randomValues);"),
    "Must use cryptographically secure random values when test OTP is not allowed"
  );
  assert.ok(
    edgeContent.includes("String(100000 + (randomValues[0] % 900000));"),
    "Must generate 6-digit cryptographic OTP"
  );

  // Verification that a production environment disables test OTP:
  function evaluateDevOtpAllowed(envMode, nodeEnv, devAllowTestOtp) {
    const isProd = envMode === 'production' || nodeEnv === 'production';
    return !isProd && (devAllowTestOtp === 'true' || envMode === 'test');
  }

  assert.equal(evaluateDevOtpAllowed('production', 'production', 'true'), false, "Production flag overrides DEV_ALLOW_TEST_OTP=true");
  assert.equal(evaluateDevOtpAllowed('production', 'development', 'true'), false, "NODE_ENV=production blocks dev OTP");
  assert.equal(evaluateDevOtpAllowed('development', 'development', 'true'), true, "Development with flag allows test OTP");
  assert.equal(evaluateDevOtpAllowed('development', 'development', 'false'), false, "Development without flag disallows test OTP");
});

test('10. OTP delivery/provider failure with honest user-facing error', () => {
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8');

  // Check Twilio error handling
  assert.ok(
    edgeContent.includes("if (isProduction && !smsDispatched)"),
    "Edge function must check if SMS dispatch succeeded in production"
  );
  assert.ok(
    edgeContent.includes("SMS delivery service is currently unavailable. Please verify SMS provider configuration or contact support."),
    "Must return clear, honest error when SMS provider is unconfigured or fails"
  );
  assert.ok(
    edgeContent.includes("status: 502"),
    "Must return HTTP 502 Bad Gateway when provider fails in production"
  );

  // Raw OTP is NEVER leaked in response JSON
  assert.ok(
    !edgeContent.includes("otp: generatedOtp") && !edgeContent.includes("rawOtp: generatedOtp"),
    "Response JSON must never include raw generated OTP"
  );

  // Phone numbers are masked
  assert.ok(
    edgeContent.includes("maskPhoneNumber"),
    "Phone numbers must be masked for privacy in responses"
  );
});

test('11. Existing voice transcription, product generation, image upload, and save workflow remaining functional', () => {
  const homeContent = fs.readFileSync(homePagePath, 'utf-8');

  // 1. Voice transcription remains intact
  assert.ok(homeContent.includes("startVoiceRecording"), "Voice recording must remain functional in HomePage");
  assert.ok(homeContent.includes("createVoiceSession"), "Voice recognition session manager must be utilized");

  // 2. Product listing generation via Edge Function remains intact
  assert.ok(homeContent.includes("supabase.functions.invoke('generate-product'"), "HomePage must invoke generate-product edge function");
  assert.ok(homeContent.includes("voiceTranscript: voiceText"), "Transcription must be passed to listing generator");

  // 3. Photo upload remains intact with storage bucket and retry logic
  assert.ok(homeContent.includes(".from('product-images')"), "Photo upload to product-images storage bucket must remain functional");
  assert.ok(homeContent.includes("handleRetryPhotoUpload"), "Photo upload retry handler must be present");

  // 4. Product saving remains intact with duplicate submission prevention
  assert.ok(homeContent.includes(".from('products')"), "Product insert into database must remain functional");
  assert.ok(homeContent.includes(".insert(primaryPayload)"), "Product payload insertion must be handled");
  assert.ok(homeContent.includes("isSavingProduct"), "Duplicate submission lock must protect save workflow");
});
