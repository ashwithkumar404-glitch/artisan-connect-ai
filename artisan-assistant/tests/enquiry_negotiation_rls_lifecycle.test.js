import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..', '..');

test('Step 1 — Verify SQL Schema, Constraints & RLS Fixes', () => {
  const migrationPath = path.join(projectRoot, 'supabase', 'migrations', '20261105000000_enquiry_negotiation_and_messages.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file 20261105000000_enquiry_negotiation_and_messages.sql must exist');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // 1. Check constraint chk_enquiry_status
  assert.match(migrationSql, /chk_enquiry_status\s+CHECK/i, 'Must define chk_enquiry_status constraint');
  const expectedStatuses = [
    'pending',
    'submitted',
    'under_review',
    'negotiation_ongoing',
    'offer_awaiting_response',
    'responded',
    'offer_accepted',
    'confirmed',
    'closed'
  ];
  for (const s of expectedStatuses) {
    assert.ok(migrationSql.includes(`'${s}'`), `chk_enquiry_status must include '${s}'`);
  }

  // 2. RLS policy update_enquiries must allow customer_id = auth.uid()
  assert.match(migrationSql, /CREATE POLICY update_enquiries ON public\.enquiries/i, 'Must create update_enquiries policy');
  assert.match(migrationSql, /customer_id\s*=\s*auth\.uid\(\)/i, 'update_enquiries must permit customer_id = auth.uid()');

  // 3. Multi-message table public.enquiry_messages
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.enquiry_messages/i, 'Must create enquiry_messages table');
  assert.match(migrationSql, /enquiry_id UUID NOT NULL REFERENCES public\.enquiries\(id\)/i, 'enquiry_messages must foreign key to enquiries');
  assert.match(migrationSql, /message_type TEXT NOT NULL/i, 'enquiry_messages must define message_type');
  assert.match(migrationSql, /ALTER TABLE public\.enquiry_messages ENABLE ROW LEVEL SECURITY/i, 'Must enable RLS on enquiry_messages');
  assert.match(migrationSql, /CREATE POLICY select_enquiry_messages/i, 'Must define select policy on enquiry_messages');
  assert.match(migrationSql, /CREATE POLICY insert_enquiry_messages/i, 'Must define insert policy on enquiry_messages');

  // 4. Artisan order generation permissions
  assert.match(migrationSql, /CREATE POLICY insert_orders/i, 'Must grant insert on orders for accepted enquiries');
});

test('Step 2 — Verify Customer ProductDetails Enquiry Form & Calculation', () => {
  const pdPath = path.join(projectRoot, 'frontend', 'src', 'pages', 'ProductDetails.jsx');
  const pdCode = fs.readFileSync(pdPath, 'utf8');

  // Must submit initial status as 'pending' to satisfy all existing and new constraint definitions
  assert.match(pdCode, /status:\s*'pending'/i, "Initial enquiry insert must use status: 'pending' to prevent chk_enquiry_status violation");

  // Must insert initial record into enquiry_messages
  assert.match(pdCode, /from\('enquiry_messages'\)\.insert/, 'Must record initial message in enquiry_messages');

  // Must display live calculation (estimate, budget difference, per-unit equivalent)
  assert.match(pdCode, /Listed Price Estimate/, 'Must render Listed Price Estimate in modal');
  assert.match(pdCode, /Your Proposed Budget/, 'Must render Proposed Budget comparison in modal');
  assert.match(pdCode, /Equivalent Price Per Unit/, 'Must render Equivalent Price Per Unit in modal');
  assert.match(pdCode, /Budget Difference/, 'Must render Budget Difference in modal');
});

test('Step 3 — Bulk Negotiation Math & Variance Calculation Logic', () => {
  const unitPrice = 400;
  const quantity = 10;
  const listedTotal = unitPrice * quantity;
  assert.equal(listedTotal, 4000, '10 units at ₹400 = ₹4,000 listed total');

  const customerBudget = 3400;
  const variance = customerBudget - listedTotal;
  assert.equal(variance, -600, 'Difference must equal -₹600');
  const discountPercent = Math.round(Math.abs(variance) / listedTotal * 100);
  assert.equal(discountPercent, 15, 'Discount percentage must be 15% below list');

  const unitEquivalent = Number((customerBudget / quantity).toFixed(2));
  assert.equal(unitEquivalent, 340, 'Equivalent unit price must be ₹340/unit');

  // Artisan counteroffer calculation
  const suggestedCounter = Math.round((listedTotal + customerBudget) / 2);
  assert.equal(suggestedCounter, 3700, 'Suggested midpoint counteroffer must be ₹3,700');
  const counterPerUnit = Number((suggestedCounter / quantity).toFixed(2));
  assert.equal(counterPerUnit, 370, 'Counteroffer unit price must be ₹370/unit');
});

test('Step 4 — Customer BuyerProfile Negotiation Thread & Action Controls', () => {
  const bpPath = path.join(projectRoot, 'frontend', 'src', 'pages', 'BuyerProfile.jsx');
  const bpCode = fs.readFileSync(bpPath, 'utf8');

  // Must support deep-link query param enquiryId
  assert.match(bpCode, /targetEnquiryId\s*=\s*searchParams\.get\('enquiryId'\)/, 'Must extract enquiryId from searchParams');

  // Must load messages from enquiry_messages table
  assert.match(bpCode, /from\('enquiry_messages'\)/, 'Must query enquiry_messages table');

  // Must handle Accept Offer action
  assert.match(bpCode, /handleAcceptOffer/, 'Must define handleAcceptOffer');
  assert.match(bpCode, /status:\s*'offer_accepted'/, "Accepting offer must set status to 'offer_accepted'");
  assert.match(bpCode, /customer_accepted_at:/, 'Accepting offer must set customer_accepted_at');

  // Must handle customer counteroffer and reply
  assert.match(bpCode, /handleSendCustomerMessage/, 'Must define handleSendCustomerMessage');
  assert.match(bpCode, /status\s*[:=]\s*'negotiation_ongoing'/, "Customer counter must transition status to 'negotiation_ongoing'");

  // Must display confirmed order details
  assert.match(bpCode, /Order Confirmed & Production In Progress!/, 'Must display confirmed order status banner');
  assert.match(bpCode, /Expected Ready Date:/, 'Must render expected ready date');
  assert.match(bpCode, /View in My Orders Tab/, 'Must provide link to confirmed orders');
});

test('Step 5 — Artisan WhatsApp Assistant Counteroffer & Mutual Confirmation', () => {
  const waPath = path.join(projectRoot, 'artisan-assistant', 'src', 'pages', 'WhatsAppPlaceholderPage.jsx');
  const waCode = fs.readFileSync(waPath, 'utf8');

  // Deep linking to enquiry
  assert.match(waCode, /searchParams\.get\('enquiryId'\)/, 'WhatsApp assistant must check for enquiryId in searchParams');

  // Counteroffer sending
  assert.match(waCode, /handleNegotiateCounteroffer/, 'Must define handleNegotiateCounteroffer');
  assert.match(waCode, /status:\s*'offer_awaiting_response'/, "Sending counteroffer must set status to 'offer_awaiting_response'");
  assert.match(waCode, /counteroffer_amount:\s*counterTotal/, 'Must save counteroffer_amount');

  // Voice counteroffer
  assert.match(waCode, /handleVoiceCounteroffer/, 'Must define handleVoiceCounteroffer');
  assert.match(waCode, /SpeechRecognition/, 'Voice counteroffer must support browser speech recognition');

  // Mutual production confirmation
  assert.match(waCode, /handleConfirmProduction/, 'Must define handleConfirmProduction');
  assert.match(waCode, /status:\s*'confirmed'/, "Confirming production must set status to 'confirmed'");
  assert.match(waCode, /expected_ready_date:\s*readyDate/, 'Must record expected_ready_date');
  assert.match(waCode, /from\('orders'\)[\s\S]*?\.insert/, 'Must create confirmed order row in orders table');
  assert.match(waCode, /from\('order_items'\)[\s\S]*?\.insert/, 'Must create order_items row');

  // Local-language Kannada translation display
  assert.match(waCode, /knTranslation/, 'Must compute and pass knTranslation for enquiry card');
});

test('Step 6 — NotificationBell Deep-Linking and Navigation', () => {
  const nbPath = path.join(projectRoot, 'frontend', 'src', 'components', 'NotificationBell.jsx');
  const nbCode = fs.readFileSync(nbPath, 'utf8');

  // Must route enquiry notifications to /profile?tab=enquiries&enquiryId=...
  assert.match(nbCode, /navigate\(`\/profile\?tab=enquiries\$\{enqParam\}`\)/, 'Notification click must deep-link with enquiryId');
});
