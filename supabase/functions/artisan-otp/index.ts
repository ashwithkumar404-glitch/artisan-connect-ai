// Deno Serverless Edge Function for Government Artisan ID Verification & OTP Login
// Contract: 'artisanIdCode' is the unified property name for the Government Artisan ID.
// Provides secure, server-side registry lookup, rate limiting, SMS delivery, and genuine Supabase Auth session token generation.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256(str: string): Promise<string> {
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 8) return '******';
  const prefix = phone.slice(0, 3);
  const suffix = phone.slice(-4);
  return `${prefix} ******${suffix}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    // Environment & non-production isolation detection (Strict Fail-Closed)
    const envVal = (Deno.env.get('ENVIRONMENT') || '').trim().toLowerCase();
    const denoEnvVal = (Deno.env.get('DENO_ENV') || '').trim().toLowerCase();
    const nodeEnvVal = (Deno.env.get('NODE_ENV') || '').trim().toLowerCase();

    // Any production flag forces production mode
    const anyProduction = envVal === 'production' || denoEnvVal === 'production' || nodeEnvVal === 'production';
    // Explicit whitelist of non-production environments
    const isExplicitNonProd = ['development', 'test', 'local'].includes(envVal) ||
      ['development', 'test', 'local'].includes(denoEnvVal) ||
      ['development', 'test', 'local'].includes(nodeEnvVal);

    // Fail closed: If any variable is 'production', or if environment is unspecified/ambiguous, treat as production
    const isProduction = anyProduction || !isExplicitNonProd;

    const allowDevTestOtp = !isProduction && (
      Deno.env.get('DEV_ALLOW_TEST_OTP') === 'true' ||
      envVal === 'test' ||
      denoEnvVal === 'test'
    );
    const configuredDevOtp = allowDevTestOtp ? Deno.env.get('DEV_TEST_OTP_CODE') : null;

    // Canonical payload property: 'artisanIdCode' (tolerates artisan_id_code and governmentId for backward compatibility)
    const { action, challengeId, otp } = body;
    const artisanIdCode = body.artisanIdCode || body.artisan_id_code || body.governmentId;

    const normalizedCode = (artisanIdCode || '').trim().toUpperCase();
    if (!normalizedCode) {
      return new Response(
        JSON.stringify({ error: 'Artisan Registry ID code is required (artisanIdCode).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. ACTION: Request OTP Challenge
    if (action === 'request-otp') {
      // Lookup registered artisan in internal registry table
      const { data: registryRecord, error: regErr } = await supabase
        .from('artisan_registry')
        .select('*')
        .eq('artisan_id_code', normalizedCode)
        .eq('is_active', true)
        .maybeSingle();

      if (regErr || !registryRecord) {
        return new Response(
          JSON.stringify({
            error: 'Artisan ID not found in registered artisan database. Please check the ID or sign in via email/password.',
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate OTP:
      // If isolated development testing is explicitly enabled and DEV_TEST_OTP_CODE is set in server secrets,
      // use that configured development code. Otherwise, generate cryptographically secure random 6-digit OTP.
      let generatedOtp: string;
      if (allowDevTestOtp && configuredDevOtp && configuredDevOtp.trim().length === 6) {
        generatedOtp = configuredDevOtp.trim();
      } else {
        const randomValues = new Uint32Array(1);
        crypto.getRandomValues(randomValues);
        generatedOtp = String(100000 + (randomValues[0] % 900000));
      }

      const otpHash = await sha256(`${normalizedCode}_${generatedOtp}`);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5-minute expiry

      // Atomic challenge creation with transaction-level advisory lock & rate limiting (max 3 per 60s)
      const { data: createdChallengeId, error: chalInsertErr } = await supabase.rpc(
        'create_otp_challenge',
        {
          p_artisan_id_code: normalizedCode,
          p_phone_number: registryRecord.phone_number,
          p_otp_hash: otpHash,
          p_expires_at: expiresAt,
          p_max_attempts: 5,
        }
      );

      if (chalInsertErr) {
        if (chalInsertErr.message?.includes('RATE_LIMIT_EXCEEDED')) {
          return new Response(
            JSON.stringify({ error: 'Too many OTP requests. Please wait 60 seconds before requesting another code.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.error('Error creating OTP challenge via RPC:', chalInsertErr);
        return new Response(
          JSON.stringify({ error: 'Failed to generate OTP challenge. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check external SMS credentials (safe, server-side only; phone taken strictly from verified registry)
      const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioFrom = Deno.env.get('TWILIO_PHONE_NUMBER');
      let smsDispatched = false;

      if (twilioSid && twilioToken && twilioFrom) {
        try {
          const smsBody = new URLSearchParams({
            To: registryRecord.phone_number,
            From: twilioFrom,
            Body: `Artisan Connect AI verification code: ${generatedOtp}. Valid for 5 minutes. Do not share this code.`,
          });

          const twilioRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: smsBody.toString(),
            }
          );
          smsDispatched = twilioRes.ok;
          if (!twilioRes.ok) {
            console.warn('Twilio dispatch responded with non-ok status:', twilioRes.status);
          }
        } catch (smsErr) {
          console.warn('Twilio dispatch warning:', smsErr);
        }
      }

      // In production, if SMS delivery provider fails or is unconfigured, report honest delivery error
      if (isProduction && !smsDispatched) {
        return new Response(
          JSON.stringify({
            error: 'SMS delivery service is currently unavailable. Please verify SMS provider configuration or contact support.',
            providerConfigured: false,
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return success response WITHOUT ever exposing raw OTP
      return new Response(
        JSON.stringify({
          success: true,
          challengeId: createdChallengeId,
          artisanIdCode: normalizedCode,
          maskedPhone: maskPhoneNumber(registryRecord.phone_number),
          providerConfigured: smsDispatched,
          isDevMode: !isProduction,
          message: smsDispatched
            ? `OTP sent to registered phone ${maskPhoneNumber(registryRecord.phone_number)}.`
            : `OTP challenge created for internal registry test. (SMS provider pending configuration in Supabase secrets).`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. ACTION: Verify OTP Challenge & Issue Authenticated Session
    if (action === 'verify-otp') {
      const trimmedOtp = (otp || '').trim();
      if (!trimmedOtp || trimmedOtp.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Please enter the full 6-digit OTP.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!challengeId) {
        return new Response(
          JSON.stringify({ error: 'Challenge ID is required for OTP verification.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const inputHash = await sha256(`${normalizedCode}_${trimmedOtp}`);

      // Unified atomic verification: acquires exclusive row lock (FOR UPDATE),
      // evaluates attempt limits/expiry, consumes challenge, or atomically increments attempts.
      const { data: verifyResult, error: verifyRpcErr } = await supabase.rpc(
        'verify_otp_challenge',
        {
          p_challenge_id: challengeId,
          p_artisan_id_code: normalizedCode,
          p_candidate_hash: inputHash,
        }
      );

      if (verifyRpcErr) {
        console.error('Error invoking verify_otp_challenge RPC:', verifyRpcErr);
        return new Response(
          JSON.stringify({ error: 'Failed to verify OTP. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = Array.isArray(verifyResult) ? verifyResult[0] : verifyResult;
      const verifyStatus = result?.status;

      if (verifyStatus === 'not_found' || verifyStatus === 'expired' || verifyStatus === 'already_verified') {
        return new Response(
          JSON.stringify({ error: 'OTP has expired, is invalid, or has already been used. Please request a new code.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (verifyStatus === 'max_attempts_exceeded') {
        return new Response(
          JSON.stringify({ error: 'Maximum verification attempts exceeded. Please request a new OTP.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (verifyStatus === 'invalid_otp') {
        const remaining = result?.remaining_attempts ?? 0;
        return new Response(
          JSON.stringify({ error: `Invalid OTP. ${Math.max(0, remaining)} attempts remaining.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (verifyStatus !== 'verified') {
        return new Response(
          JSON.stringify({ error: 'OTP verification failed. Please try again.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch artisan details from registry (must remain active)
      const { data: registryRecord, error: regFetchErr } = await supabase
        .from('artisan_registry')
        .select('*')
        .eq('artisan_id_code', normalizedCode)
        .eq('is_active', true)
        .maybeSingle();

      if (regFetchErr || !registryRecord) {
        return new Response(
          JSON.stringify({ error: 'Registry record not found or inactive for verified artisan ID.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Map to genuine Supabase Auth user & profile
      const deterministicEmail = `artisan_${normalizedCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}@artisan.artisanconnect.ai`;
      let targetUserId: string | null = null;
      let targetEmail: string = deterministicEmail;

      // Safe account resolution: Bind strictly to deterministic artisan email or verified artisan_id_code metadata.
      // Do NOT link to existing accounts via unverified phone numbers in public profiles.
      try {
        const { data: userList } = await supabase.auth.admin.listUsers();
        const existingAuthUser = userList?.users?.find(
          (u: any) => u.email === deterministicEmail || u.user_metadata?.artisan_id_code === normalizedCode
        );

        if (existingAuthUser) {
          targetUserId = existingAuthUser.id;
          targetEmail = existingAuthUser.email || deterministicEmail;
        } else {
          const { data: newUserData, error: createErr } = await supabase.auth.admin.createUser({
            email: deterministicEmail,
            phone: registryRecord.phone_number,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: {
              full_name: registryRecord.full_name,
              role: 'artisan',
              artisan_id_code: normalizedCode,
            },
          });

          if (!createErr && newUserData?.user) {
            targetUserId = newUserData.user.id;
            targetEmail = newUserData.user.email || deterministicEmail;
          }
        }
      } catch (authAdminErr) {
        console.warn('Auth admin user query error:', authAdminErr);
      }

      // Upsert profile and artisan record if user ID resolved
      if (targetUserId) {
        await supabase.from('profiles').upsert(
          {
            id: targetUserId,
            full_name: registryRecord.full_name,
            email: targetEmail,
            phone: registryRecord.phone_number,
            role: 'artisan',
          },
          { onConflict: 'id' }
        );

        const { data: existingArtisan } = await supabase
          .from('artisans')
          .select('id')
          .eq('profile_id', targetUserId)
          .maybeSingle();

        if (!existingArtisan) {
          await supabase.from('artisans').insert({
            profile_id: targetUserId,
            business_name: `${registryRecord.full_name} (${registryRecord.craft_category})`,
            location: registryRecord.location_state,
            specialization: registryRecord.craft_category,
            verification_status: 'approved',
          });
        } else {
          await supabase
            .from('artisans')
            .update({
              verification_status: 'approved',
              specialization: registryRecord.craft_category,
            })
            .eq('id', existingArtisan.id);
        }
      }

      // Issue genuine Supabase Auth magiclink token hash
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: targetEmail,
      });

      if (linkErr || !linkData?.properties?.hashed_token) {
        console.error('generateLink error:', linkErr);
        return new Response(
          JSON.stringify({
            error: 'Verified OTP but failed to issue secure authentication session token. Check Supabase service-role key configuration.',
            details: linkErr?.message,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          verified: true,
          artisanIdCode: normalizedCode,
          token_hash: linkData.properties.hashed_token,
          email: targetEmail,
          artisan: registryRecord,
          message: 'Verification successful! Creating authenticated session...',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action specified.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('artisan-otp function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error processing OTP request.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
