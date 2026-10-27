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

    // Environment & non-production isolation detection
    const envMode = (Deno.env.get('ENVIRONMENT') || Deno.env.get('DENO_ENV') || 'development').toLowerCase();
    const isProduction = envMode === 'production' || Deno.env.get('NODE_ENV') === 'production';
    const allowDevTestOtp = !isProduction && (
      Deno.env.get('DEV_ALLOW_TEST_OTP') === 'true' ||
      envMode === 'test'
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

      // Request rate-limiting: maximum 3 challenge requests per 60 seconds
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const { data: recentChallenges } = await supabase
        .from('artisan_otp_challenges')
        .select('id')
        .eq('artisan_id_code', normalizedCode)
        .gt('created_at', oneMinuteAgo);

      if (recentChallenges && recentChallenges.length >= 3) {
        return new Response(
          JSON.stringify({ error: 'Too many OTP requests. Please wait 60 seconds before requesting another code.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      // Insert rate-limited challenge record
      const { data: challengeRecord, error: chalInsertErr } = await supabase
        .from('artisan_otp_challenges')
        .insert({
          artisan_id_code: normalizedCode,
          phone_number: registryRecord.phone_number,
          otp_hash: otpHash,
          expires_at: expiresAt,
          attempts: 0,
        })
        .select('id')
        .single();

      if (chalInsertErr) {
        console.error('Error inserting OTP challenge:', chalInsertErr);
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
          challengeId: challengeRecord?.id,
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

      // Fetch active, unverified challenge matching artisan code (and challengeId if provided)
      let chalQuery = supabase
        .from('artisan_otp_challenges')
        .select('*')
        .eq('artisan_id_code', normalizedCode)
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString());

      if (challengeId) {
        chalQuery = chalQuery.eq('id', challengeId);
      }

      const { data: challenge, error: chalErr } = await chalQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (chalErr || !challenge) {
        return new Response(
          JSON.stringify({ error: 'OTP has expired, is invalid, or has already been used. Please request a new code.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (challenge.attempts >= challenge.max_attempts) {
        return new Response(
          JSON.stringify({ error: 'Maximum verification attempts exceeded. Please request a new OTP.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const inputHash = await sha256(`${normalizedCode}_${trimmedOtp}`);
      if (inputHash !== challenge.otp_hash) {
        const nextAttempts = challenge.attempts + 1;
        await supabase
          .from('artisan_otp_challenges')
          .update({ attempts: nextAttempts })
          .eq('id', challenge.id);

        const remaining = challenge.max_attempts - nextAttempts;
        return new Response(
          JSON.stringify({ error: `Invalid OTP. ${Math.max(0, remaining)} attempts remaining.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark challenge verified immediately to ensure it cannot be reused
      await supabase
        .from('artisan_otp_challenges')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', challenge.id);

      // Fetch artisan details from registry
      const { data: registryRecord, error: regFetchErr } = await supabase
        .from('artisan_registry')
        .select('*')
        .eq('artisan_id_code', normalizedCode)
        .maybeSingle();

      if (regFetchErr || !registryRecord) {
        return new Response(
          JSON.stringify({ error: 'Registry record not found for verified artisan ID.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Map to genuine Supabase Auth user & profile
      const deterministicEmail = `artisan_${normalizedCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}@artisan.artisanconnect.ai`;
      let targetUserId: string | null = null;
      let targetEmail: string = deterministicEmail;

      // Check if existing profile matches registry phone number
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email, phone')
        .eq('phone', registryRecord.phone_number)
        .maybeSingle();

      if (existingProfile) {
        targetUserId = existingProfile.id;
        if (existingProfile.email) targetEmail = existingProfile.email;
      } else {
        // Query auth users to find existing user or create one
        try {
          const { data: userList } = await supabase.auth.admin.listUsers();
          const existingAuthUser = userList?.users?.find(
            (u: any) => u.email === deterministicEmail || u.phone === registryRecord.phone_number
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
