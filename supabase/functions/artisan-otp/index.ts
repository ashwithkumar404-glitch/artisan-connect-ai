// Deno Serverless Edge Function for Government Artisan ID Verification & OTP Login
// Provides secure, server-side registry lookup, rate limiting, and SMS delivery.

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
    const { action, artisanIdCode, otp } = body;

    const normalizedCode = (artisanIdCode || '').trim().toUpperCase();
    if (!normalizedCode) {
      return new Response(
        JSON.stringify({ error: 'Government Artisan ID code is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. ACTION: Request OTP Challenge
    if (action === 'request-otp') {
      // Lookup registered artisan in official registry table
      const { data: registryRecord, error: regErr } = await supabase
        .from('artisan_registry')
        .select('*')
        .eq('artisan_id_code', normalizedCode)
        .eq('is_active', true)
        .maybeSingle();

      if (regErr || !registryRecord) {
        // Return privacy-preserving response so arbitrary codes cannot be probed
        return new Response(
          JSON.stringify({
            success: true,
            maskedPhone: '+91 ******0000',
            message: 'If this government ID is registered, an OTP has been dispatched to the registered mobile number.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate cryptographically secure 6-digit OTP
      const randomValues = new Uint32Array(1);
      crypto.getRandomValues(randomValues);
      const generatedOtp = String(100000 + (randomValues[0] % 900000));
      const otpHash = await sha256(`${normalizedCode}_${generatedOtp}`);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5-minute expiry

      // Insert rate-limited challenge record
      await supabase.from('artisan_otp_challenges').insert({
        artisan_id_code: normalizedCode,
        phone_number: registryRecord.phone_number,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempts: 0,
      });

      // Check external SMS credentials
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
        } catch (smsErr) {
          console.warn('Twilio dispatch warning:', smsErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          maskedPhone: maskPhoneNumber(registryRecord.phone_number),
          providerConfigured: smsDispatched,
          message: smsDispatched
            ? `OTP sent to registered phone ${maskPhoneNumber(registryRecord.phone_number)}.`
            : `OTP challenge created. (Note: SMS provider credentials pending in Supabase secrets).`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. ACTION: Verify OTP Challenge
    if (action === 'verify-otp') {
      const trimmedOtp = (otp || '').trim();
      if (!trimmedOtp || trimmedOtp.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Please enter the full 6-digit OTP.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch latest active challenge for this artisan code
      const { data: challenge, error: chalErr } = await supabase
        .from('artisan_otp_challenges')
        .select('*')
        .eq('artisan_id_code', normalizedCode)
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (chalErr || !challenge) {
        return new Response(
          JSON.stringify({ error: 'OTP has expired or is invalid. Please request a new code.' }),
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
        await supabase
          .from('artisan_otp_challenges')
          .update({ attempts: challenge.attempts + 1 })
          .eq('id', challenge.id);

        const remaining = challenge.max_attempts - (challenge.attempts + 1);
        return new Response(
          JSON.stringify({ error: `Invalid OTP. ${remaining} attempts remaining.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark challenge verified
      await supabase
        .from('artisan_otp_challenges')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', challenge.id);

      // Fetch artisan details
      const { data: artisanRecord } = await supabase
        .from('artisan_registry')
        .select('*')
        .eq('artisan_id_code', normalizedCode)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          verified: true,
          artisan: artisanRecord || { artisan_id_code: normalizedCode },
          message: 'Verification successful!',
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
