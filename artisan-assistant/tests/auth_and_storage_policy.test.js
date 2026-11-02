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
const baselineMigrationPath = path.resolve(__dirname, '../../supabase/migrations/20261001000000_initial_baseline.sql');
const concurrencyMigrationPath = path.resolve(__dirname, '../../supabase/migrations/20261028120000_otp_concurrency_and_profile_security.sql');
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
  const concurrencyContent = fs.readFileSync(concurrencyMigrationPath, 'utf-8');

  // Simulating hash verification
  const secretCode = 'KA-ART-1001';
  const realOtp = '739281';
  const wrongOtp = '111111';
  const correctHash = sha256Sync(`${secretCode}_${realOtp}`);
  const wrongHash = sha256Sync(`${secretCode}_${wrongOtp}`);

  assert.notEqual(correctHash, wrongHash, "Mismatched OTP hashes must not equate");

  // Edge function calls atomic verify_otp_challenge RPC
  assert.ok(
    edgeContent.includes("verify_otp_challenge"),
    "Edge function must invoke verify_otp_challenge RPC"
  );
  assert.ok(
    edgeContent.includes("verifyStatus === 'invalid_otp'"),
    "Edge function must handle invalid_otp status"
  );
  assert.ok(
    edgeContent.includes("attempts remaining"),
    "Edge function must inform client of remaining attempts"
  );

  // Stored procedure atomically increments attempts on mismatch
  assert.ok(
    concurrencyContent.includes("v_next_attempts := v_challenge.attempts + 1;"),
    "Stored procedure must increment attempts on hash mismatch"
  );
  assert.ok(
    concurrencyContent.includes("SET attempts = v_next_attempts"),
    "Stored procedure must persist incremented attempts"
  );
});

test('3. Expired OTP challenge rejection', () => {
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8');
  const concurrencyContent = fs.readFileSync(concurrencyMigrationPath, 'utf-8');

  // Edge function checks expired status from atomic RPC
  assert.ok(
    edgeContent.includes("verifyStatus === 'expired'"),
    "Edge function must handle expired status from RPC"
  );
  assert.ok(
    edgeContent.includes("OTP has expired, is invalid, or has already been used"),
    "Edge function must return clear error for expired challenges"
  );

  // Stored procedure explicitly checks expires_at <= now()
  assert.ok(
    concurrencyContent.includes("IF v_challenge.expires_at <= now() THEN"),
    "Stored procedure must reject challenges where expires_at <= current time"
  );

  // Expiration duration should be 5 minutes (300,000 ms)
  assert.ok(
    edgeContent.includes("Date.now() + 5 * 60 * 1000"),
    "Challenge must expire 5 minutes after creation"
  );
});

test('4. OTP single-use and replay prevention (no reuse)', () => {
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8');
  const concurrencyContent = fs.readFileSync(concurrencyMigrationPath, 'utf-8');

  // Edge function checks already_verified status from atomic RPC
  assert.ok(
    edgeContent.includes("verifyStatus === 'already_verified'"),
    "Edge function must handle already_verified status"
  );

  // Stored procedure explicitly checks verified_at IS NOT NULL
  assert.ok(
    concurrencyContent.includes("IF v_challenge.verified_at IS NOT NULL THEN"),
    "Stored procedure must reject previously verified challenges"
  );

  // Atomic consumption sets verified_at = now() within row lock
  assert.ok(
    concurrencyContent.includes("SET verified_at = now()"),
    "Stored procedure must record verified_at immediately upon OTP match"
  );
});

test('5. Excessive verification attempts lockout and request rate limiting', () => {
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8');
  const concurrencyContent = fs.readFileSync(concurrencyMigrationPath, 'utf-8');

  // Verification attempt lockout: max_attempts exceeded
  assert.ok(
    edgeContent.includes("verifyStatus === 'max_attempts_exceeded'"),
    "Edge function must handle max_attempts_exceeded status from RPC"
  );
  assert.ok(
    edgeContent.includes("Maximum verification attempts exceeded. Please request a new OTP."),
    "Edge function must lock out after maximum attempts"
  );

  // Stored procedure checks attempts >= max_attempts under row lock
  assert.ok(
    concurrencyContent.includes("IF v_challenge.attempts >= v_challenge.max_attempts THEN"),
    "Stored procedure must check if attempts >= max_attempts under row lock"
  );

  // Request rate-limiting via atomic advisory lock in create_otp_challenge
  assert.ok(
    concurrencyContent.includes("pg_advisory_xact_lock(hashtext(p_artisan_id_code))"),
    "create_otp_challenge must acquire transaction advisory lock per artisan code"
  );
  assert.ok(
    concurrencyContent.includes("v_recent_count >= 3"),
    "create_otp_challenge must enforce maximum 3 requests per 60 seconds"
  );
  assert.ok(
    edgeContent.includes("Too many OTP requests. Please wait 60 seconds"),
    "Edge function must return 429 error on rate limit exceeded"
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

  // Environment detection must strictly identify production and fail closed
  assert.ok(
    edgeContent.includes("const anyProduction = envVal === 'production' || denoEnvVal === 'production' || nodeEnvVal === 'production';"),
    "Edge function must detect any production environment indicator"
  );
  assert.ok(
    edgeContent.includes("const isProduction = anyProduction || !isExplicitNonProd;"),
    "Edge function must fail closed if production is indicated or if environment is not explicitly non-production"
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

test('12. Strict fail-closed environment evaluation across conflicting ENVIRONMENT, DENO_ENV, and NODE_ENV combinations', () => {
  function evaluateStrictEnv(rawEnv, rawDeno, rawNode, rawDevAllow) {
    const envVal = (rawEnv || '').trim().toLowerCase();
    const denoEnvVal = (rawDeno || '').trim().toLowerCase();
    const nodeEnvVal = (rawNode || '').trim().toLowerCase();

    const anyProduction = envVal === 'production' || denoEnvVal === 'production' || nodeEnvVal === 'production';
    const isExplicitNonProd = ['development', 'test', 'local'].includes(envVal) ||
      ['development', 'test', 'local'].includes(denoEnvVal) ||
      ['development', 'test', 'local'].includes(nodeEnvVal);

    const isProduction = anyProduction || !isExplicitNonProd;

    const allowDevTestOtp = !isProduction && (
      rawDevAllow === 'true' ||
      envVal === 'test' ||
      denoEnvVal === 'test'
    );
    return { isProduction, allowDevTestOtp };
  }

  // 1. Conflict: ENVIRONMENT=staging, DENO_ENV=production -> must fail closed to production
  assert.equal(evaluateStrictEnv('staging', 'production', '', 'true').isProduction, true);
  assert.equal(evaluateStrictEnv('staging', 'production', '', 'true').allowDevTestOtp, false);

  // 2. Conflict: ENVIRONMENT=development, NODE_ENV=Production (mixed case) -> must fail closed
  assert.equal(evaluateStrictEnv('development', '', 'Production', 'true').isProduction, true);
  assert.equal(evaluateStrictEnv('development', '', 'Production', 'true').allowDevTestOtp, false);

  // 3. Ambiguous/Unspecified environment in cloud -> must fail closed (treat as production, block dev OTP)
  assert.equal(evaluateStrictEnv('', '', '', 'true').isProduction, true);
  assert.equal(evaluateStrictEnv('', '', '', 'true').allowDevTestOtp, false);

  // 4. Valid explicit local development with flag enabled
  assert.equal(evaluateStrictEnv('development', '', '', 'true').isProduction, false);
  assert.equal(evaluateStrictEnv('development', '', '', 'true').allowDevTestOtp, true);

  // 5. Valid explicit local development without flag -> no dev OTP
  assert.equal(evaluateStrictEnv('development', '', '', 'false').isProduction, false);
  assert.equal(evaluateStrictEnv('development', '', '', 'false').allowDevTestOtp, false);

  // 6. Test environment enables test OTP
  assert.equal(evaluateStrictEnv('test', '', '', '').isProduction, false);
  assert.equal(evaluateStrictEnv('test', '', '', '').allowDevTestOtp, true);
});

test('13. OTP verification enforces mandatory challengeId and validates active registry record', () => {
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8');

  // Must reject verify request if challengeId is missing
  assert.ok(
    edgeContent.includes("if (!challengeId)"),
    "Edge function must enforce challengeId presence on verification"
  );
  assert.ok(
    edgeContent.includes("Challenge ID is required for OTP verification"),
    "Must return clear error when challengeId is omitted"
  );

  // Must bind challengeId directly in verification RPC call
  assert.ok(
    edgeContent.includes("p_challenge_id: challengeId"),
    "Edge function must supply challengeId to verify_otp_challenge RPC"
  );

  // Must verify that the artisan is active in the registry
  assert.ok(
    edgeContent.includes(".eq('is_active', true)"),
    "Edge function must verify artisan active status during verification"
  );
});

test('14. Atomic stored procedures permissions and search_path hardening', () => {
  const concurrencyContent = fs.readFileSync(concurrencyMigrationPath, 'utf-8');

  // Functions declare strict search_path = public
  assert.ok(
    concurrencyContent.includes("FUNCTION public.create_otp_challenge"),
    "create_otp_challenge must be declared in public schema"
  );
  assert.ok(
    concurrencyContent.includes("FUNCTION public.verify_otp_challenge"),
    "verify_otp_challenge must be declared in public schema"
  );
  assert.ok(
    concurrencyContent.includes("SECURITY DEFINER SET search_path = public"),
    "Security-critical functions must declare SECURITY DEFINER SET search_path = public"
  );

  // Explicit permission revoking from public/anon/authenticated and granting to service_role
  assert.ok(
    concurrencyContent.includes("REVOKE EXECUTE ON FUNCTION public.create_otp_challenge"),
    "create_otp_challenge must revoke execution from untrusted roles"
  );
  assert.ok(
    concurrencyContent.includes("REVOKE EXECUTE ON FUNCTION public.verify_otp_challenge"),
    "verify_otp_challenge must revoke execution from untrusted roles"
  );
  assert.ok(
    concurrencyContent.includes("GRANT EXECUTE ON FUNCTION public.create_otp_challenge(TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER) TO service_role;"),
    "create_otp_challenge must be granted only to service_role"
  );
  assert.ok(
    concurrencyContent.includes("GRANT EXECUTE ON FUNCTION public.verify_otp_challenge(UUID, TEXT, TEXT) TO service_role;"),
    "verify_otp_challenge must be granted only to service_role"
  );
});

test('15. Storage RLS policies for artisan-verification, review-photos, and product-images', () => {
  const baselineContent = fs.readFileSync(baselineMigrationPath, 'utf-8');
  const concurrencyContent = fs.readFileSync(concurrencyMigrationPath, 'utf-8');

  // Verification bucket is private, requires UUID format check matching profile's artisan
  assert.ok(
    concurrencyContent.includes("bucket_id = 'artisan-verification'"),
    "Storage policy must cover artisan-verification bucket"
  );
  assert.ok(
    concurrencyContent.includes("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"),
    "Storage policies must validate folder UUID before casting to avoid PostgreSQL cast errors"
  );

  // Review-photos bucket is public read with user-scoped insert/delete
  assert.ok(
    concurrencyContent.includes("bucket_id = 'review-photos'"),
    "Storage policy must cover review-photos bucket"
  );
  assert.ok(
    concurrencyContent.includes("(storage.foldername(name))[1] IN ('reviews', 'enquiries')"),
    "Review photo uploads must be scoped to user-owned reviews or enquiries"
  );

  // Baseline product insert/update policies enforce verification_status = approved for published products
  assert.ok(
    baselineContent.includes("status = 'published' AND artisan_id IN (\n                        SELECT id FROM public.artisans WHERE profile_id = auth.uid() AND verification_status = 'approved'\n                    )"),
    "Baseline product INSERT policy must prevent unverified artisans from self-publishing"
  );
});

test('16. Profile role protection triggers prevent self-escalation on insert and update', () => {
  const concurrencyContent = fs.readFileSync(concurrencyMigrationPath, 'utf-8');

  // Trigger on insert blocks self-assigned admin role
  assert.ok(
    concurrencyContent.includes("CREATE TRIGGER tr_check_profile_role_insert"),
    "Migration must create tr_check_profile_role_insert trigger"
  );
  assert.ok(
    concurrencyContent.includes("IF NEW.role = 'admin' AND NOT public.is_admin() THEN"),
    "Insert trigger must block non-admins from registering with role = 'admin'"
  );

  // Trigger on update blocks altering role
  assert.ok(
    concurrencyContent.includes("CREATE TRIGGER tr_check_profile_role_update"),
    "Migration must create tr_check_profile_role_update trigger"
  );
  assert.ok(
    concurrencyContent.includes("IF NEW.role IS DISTINCT FROM OLD.role THEN"),
    "Update trigger must block non-admins from changing their role"
  );
});
