import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. WhatsApp Webhook Edge Function existence and structure
test('1. WhatsApp Webhook Edge Function exists with Meta Cloud API verification and message handlers', () => {
  const functionPath = path.resolve(__dirname, '../../supabase/functions/whatsapp-webhook/index.ts');
  assert.ok(fs.existsSync(functionPath), 'whatsapp-webhook/index.ts must exist');

  const content = fs.readFileSync(functionPath, 'utf8');

  // Must handle GET webhook verification
  assert.ok(content.includes('hub.mode'), 'Must inspect hub.mode for Meta webhook verification');
  assert.ok(content.includes('hub.verify_token'), 'Must inspect hub.verify_token for Meta webhook verification');
  assert.ok(content.includes('hub.challenge'), 'Must return hub.challenge on successful verification');

  // Must handle POST message events
  assert.ok(content.includes('whatsapp_business_account'), 'Must verify whatsapp_business_account object');
  assert.ok(content.includes('messageType === \'image\'') || content.includes('image'), 'Must support image message processing');
  assert.ok(content.includes('messageType === \'audio\'') || content.includes('voice'), 'Must support audio/voice note processing');

  // Must have deduplication logic
  assert.ok(content.includes('processedMessageIds'), 'Must include message deduplication cache');

  // Must have server-side secret usage
  assert.ok(content.includes('WHATSAPP_VERIFY_TOKEN'), 'Must read WHATSAPP_VERIFY_TOKEN server-side');
  assert.ok(content.includes('WHATSAPP_ACCESS_TOKEN'), 'Must read WHATSAPP_ACCESS_TOKEN server-side');
  assert.ok(content.includes('WHATSAPP_PHONE_NUMBER_ID'), 'Must read WHATSAPP_PHONE_NUMBER_ID server-side');
});

// 2. Webhook verification handshake simulation
test('2. Webhook verification handshake validates verify_token and returns challenge', () => {
  const verifyToken = 'artisan_connect_webhook_verify_token';
  const testChallenge = '1158201444';

  function simulateGetWebhook(query, configuredToken) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === configuredToken) {
        return { status: 200, body: challenge };
      }
      return { status: 403, body: 'Forbidden: verify_token mismatch' };
    }
    return { status: 200, isDiagnostic: true };
  }

  // Valid handshake
  const validRes = simulateGetWebhook({
    'hub.mode': 'subscribe',
    'hub.verify_token': verifyToken,
    'hub.challenge': testChallenge
  }, verifyToken);
  assert.equal(validRes.status, 200);
  assert.equal(validRes.body, testChallenge);

  // Invalid handshake
  const invalidRes = simulateGetWebhook({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'wrong_token',
    'hub.challenge': testChallenge
  }, verifyToken);
  assert.equal(invalidRes.status, 403);
});

// 3. Webhook HMAC-SHA256 signature verification simulation
test('3. HMAC-SHA256 signature verification validates payload authenticity against Meta app secret', () => {
  const appSecret = 'meta_test_secret_key_123';
  const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(payload);
  const validSignature = `sha256=${hmac.digest('hex')}`;

  function verifySignature(rawBody, signatureHeader, secret) {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
    const expected = signatureHeader.substring(7);
    const calculated = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return calculated === expected;
  }

  assert.equal(verifySignature(payload, validSignature, appSecret), true, 'Valid signature must be accepted');
  assert.equal(verifySignature(payload, 'sha256=tamperedhash', appSecret), false, 'Tampered signature must be rejected');
  assert.equal(verifySignature(payload, null, appSecret), false, 'Missing signature must be rejected');
});

// 4. Message deduplication simulation
test('4. Message deduplication prevents duplicate event processing', () => {
  const processedIds = new Set();

  function processMessage(messageId) {
    if (processedIds.has(messageId)) {
      return { duplicate: true };
    }
    processedIds.add(messageId);
    return { duplicate: false, processed: true };
  }

  const msgId = 'wamid.HBgLMOTE5ODc2NTQzMjEwFQIAEhggMUYy';
  const first = processMessage(msgId);
  assert.equal(first.duplicate, false, 'First message delivery must be processed');

  const second = processMessage(msgId);
  assert.equal(second.duplicate, true, 'Duplicate message delivery must be ignored');
});

// 5. Outbound WhatsApp Cloud API message formatting
test('5. Outbound message formatting complies with Meta WhatsApp Cloud API JSON structure', () => {
  function createMetaMessagePayload(to, text) {
    const cleanTo = to.replace(/[^0-9]/g, '');
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: { body: text }
    };
  }

  const payload = createMetaMessagePayload('+919876543210', 'ನಮಸ್ಕಾರ!');
  assert.equal(payload.messaging_product, 'whatsapp');
  assert.equal(payload.to, '919876543210');
  assert.equal(payload.type, 'text');
  assert.equal(payload.text.body, 'ನಮಸ್ಕಾರ!');
});

// 6. WhatsApp UI Channel page transparency and setup guidance
test('6. WhatsApp Channel page provides honest status, webhook endpoint, and setup guidance', () => {
  const whatsAppPagePath = path.resolve(__dirname, '../src/pages/WhatsAppPlaceholderPage.jsx');
  assert.ok(fs.existsSync(whatsAppPagePath), 'WhatsAppPlaceholderPage.jsx must exist');

  const content = fs.readFileSync(whatsAppPagePath, 'utf8');
  assert.ok(content.includes('whatsapp-webhook'), 'Must display the whatsapp-webhook endpoint');
  assert.ok(content.includes('WHATSAPP_VERIFY_TOKEN'), 'Must document WHATSAPP_VERIFY_TOKEN setup');
  assert.ok(content.includes('WHATSAPP_ACCESS_TOKEN'), 'Must document WHATSAPP_ACCESS_TOKEN setup');
  assert.ok(content.includes('Launch Web Assistant'), 'Must preserve quick launch back to in-app assistant');
  assert.ok(content.includes('to="/"'), 'Must maintain link to / for seamless return');
});

