import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('1. MyOrdersPage strictly scopes queries to the authenticated artisan ID', () => {
  const filePath = path.resolve(__dirname, '../src/pages/MyOrdersPage.jsx');
  assert.ok(fs.existsSync(filePath), 'MyOrdersPage.jsx must exist');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify query scopes to artisan.id
  assert.ok(
    content.includes(".from('order_items')") && content.includes(".eq('artisan_id', artisan.id)"),
    'Must query order_items where artisan_id matches authenticated artisan.id'
  );

  // Must check artisan authorization
  assert.ok(
    content.includes('if (!artisan'),
    'Must handle missing artisan profile gracefully'
  );
});

test('2. MyOrdersPage protects customer privacy and does not expose sensitive phone numbers', () => {
  const filePath = path.resolve(__dirname, '../src/pages/MyOrdersPage.jsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify orders select query does NOT request customer phone number
  const ordersSelectMatch = content.match(/\.from\('orders'\)\s*\.select\(([^)]+)\)/);
  assert.ok(ordersSelectMatch, 'Must find orders select query');
  const selectedFields = ordersSelectMatch[1];
  assert.ok(
    !selectedFields.includes('shipping_phone'),
    'Must not query customer phone numbers to preserve privacy'
  );
  assert.ok(
    !selectedFields.includes('shipping_address'),
    'Must avoid fetching detailed street address when city and state suffice'
  );
});

test('3. MyOrdersPage supports authorized status transitions and displays all standard statuses', () => {
  const filePath = path.resolve(__dirname, '../src/pages/MyOrdersPage.jsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify support for standard status definitions
  const requiredStatuses = ['placed', 'confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
  for (const st of requiredStatuses) {
    assert.ok(content.includes(`${st}:`), `Must configure status: ${st}`);
  }

  // Verify authorized transitions matching Dashboard.jsx
  assert.ok(
    content.includes("handleUpdateStatus(ord.id, 'preparing'"),
    'Must support transitioning confirmed order to preparing'
  );
  assert.ok(
    content.includes("handleUpdateStatus(ord.id, 'shipped'"),
    'Must support transitioning preparing order to shipped'
  );
});

test('4. MyEarningsPage accurately computes completed sales, in-progress totals, and units sold', () => {
  const filePath = path.resolve(__dirname, '../src/pages/MyEarningsPage.jsx');
  assert.ok(fs.existsSync(filePath), 'MyEarningsPage.jsx must exist');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify scoping
  assert.ok(
    content.includes(".from('order_items')") && content.includes(".eq('artisan_id', artisan.id)"),
    'Must query order_items scoped strictly to artisan.id'
  );

  // Verify completed sales calculation is restricted to delivered orders
  assert.ok(
    content.includes("status === 'delivered'") && content.includes('completedSales +='),
    'Must compute completed sales only for delivered orders'
  );

  // Verify pending/in-progress separation
  assert.ok(
    content.includes('pendingFulfillment +='),
    'Must distinguish pending fulfillment from completed sales'
  );

  // Verify units sold count
  assert.ok(
    content.includes('totalUnitsSold +='),
    'Must accurately track total units sold'
  );
});

test('5. MyEarningsPage clearly distinguishes order totals from bank payouts and does not invent mock payout rows', () => {
  const filePath = path.resolve(__dirname, '../src/pages/MyEarningsPage.jsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Ensure payout notice explains bank disbursement policy
  assert.ok(
    content.includes('Bank Payout Information') || content.includes('ಬ್ಯಾಂಕ್ ಪಾವತಿ ಮಾಹಿತಿ'),
    'Must include bank payout clarification notice'
  );

  // Must not claim orders are already disbursed unless confirmed
  assert.ok(
    !content.includes('payout_status: "paid"') && !content.includes('payout_id'),
    'Must not invent artificial payout status or fake payout records'
  );
});

test('6. Both pages provide loading, empty, and error retry states', () => {
  const ordersContent = fs.readFileSync(path.resolve(__dirname, '../src/pages/MyOrdersPage.jsx'), 'utf-8');
  const earningsContent = fs.readFileSync(path.resolve(__dirname, '../src/pages/MyEarningsPage.jsx'), 'utf-8');

  // Loading states
  assert.ok(ordersContent.includes('loading ?'), 'MyOrdersPage must have loading state');
  assert.ok(earningsContent.includes('loading ?'), 'MyEarningsPage must have loading state');

  // Empty states
  assert.ok(ordersContent.includes('No orders'), 'MyOrdersPage must have empty state');
  assert.ok(earningsContent.includes('No sales recorded') || earningsContent.includes('ಇನ್ನೂ ಯಾವುದೇ ಮಾರಾಟ'), 'MyEarningsPage must have empty state');

  // Error banners with retry buttons
  assert.ok(ordersContent.includes('Retry') && ordersContent.includes('fetchArtisanOrders'), 'MyOrdersPage must offer retry action');
  assert.ok(earningsContent.includes('Retry') && earningsContent.includes('fetchEarningsData'), 'MyEarningsPage must offer retry action');
});

test('7. Navigation links for My Orders and My Earnings are active in SideMenu and QuickActions', () => {
  const sideMenuContent = fs.readFileSync(path.resolve(__dirname, '../src/components/SideMenu.jsx'), 'utf-8');
  const quickActionsContent = fs.readFileSync(path.resolve(__dirname, '../src/components/QuickActions.jsx'), 'utf-8');

  assert.ok(sideMenuContent.includes('to="/my-orders"'), 'SideMenu must link to /my-orders');
  assert.ok(sideMenuContent.includes('to="/my-earnings"'), 'SideMenu must link to /my-earnings');

  assert.ok(quickActionsContent.includes('to: \'/my-orders\''), 'QuickActions must link to /my-orders');
  assert.ok(quickActionsContent.includes('to: \'/my-earnings\''), 'QuickActions must link to /my-earnings');
});

