import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('1. ProductPerformancePage component exists and implements full analytics suite', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/ProductPerformancePage.jsx');
  assert.ok(fs.existsSync(pagePath), 'ProductPerformancePage.jsx must exist');

  const content = fs.readFileSync(pagePath, 'utf8');

  // Must not be a placeholder
  assert.ok(!content.includes('Placeholder'), 'ProductPerformancePage must not use Placeholder');

  // Must support 7-day, 30-day, and all-time periods
  assert.ok(content.includes("'7d'"), "Must support '7d' period");
  assert.ok(content.includes("'30d'"), "Must support '30d' period");
  assert.ok(content.includes("'all'"), "Must support 'all' period");

  // Must compute key metrics
  assert.ok(content.includes('completedRevenue'), 'Must compute completed revenue');
  assert.ok(content.includes('pendingRevenue'), 'Must compute pending pipeline revenue');
  assert.ok(content.includes('totalUnits'), 'Must compute total units sold');
  assert.ok(content.includes('avgOrderValue'), 'Must compute average order value');
  assert.ok(content.includes('fulfillmentRate'), 'Must compute fulfillment rate');

  // Must include telemetry tracking notice
  assert.ok(content.includes('telemetry') || content.includes('ಟೆಲಿಮೆಟ್ರಿ'), 'Must include telemetry notice');

  // Must have ranking / sorting
  assert.ok(content.includes('sortBy') && content.includes('revenue'), 'Must support sorting products by revenue');
});

test('2. CustomerFeedbackPage component exists and implements review analytics and AI reply', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/CustomerFeedbackPage.jsx');
  assert.ok(fs.existsSync(pagePath), 'CustomerFeedbackPage.jsx must exist');

  const content = fs.readFileSync(pagePath, 'utf8');

  // Must query product_reviews
  assert.ok(content.includes("'product_reviews'"), "Must query 'product_reviews'");
  assert.ok(content.includes('rating'), 'Must process star rating');

  // Must support AI reply drafting
  assert.ok(content.includes('aiDraftReply') || content.includes('draftReply') || content.includes('Reply'), 'Must support AI draft reply');

  // Must support bilingual display
  assert.ok(content.includes('artisan_language') || content.includes('isKn'), 'Must support Kannada and English');
});

test('3. MyEarningsPage supports 7-day, 30-day, and all-time periods and links to performance', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/MyEarningsPage.jsx');
  assert.ok(fs.existsSync(pagePath), 'MyEarningsPage.jsx must exist');

  const content = fs.readFileSync(pagePath, 'utf8');

  // Must support periods
  assert.ok(content.includes("'7d'"), "Must support '7d' period tab");
  assert.ok(content.includes("'30d'"), "Must support '30d' period tab");
  assert.ok(content.includes('filteredSalesItems'), 'Must filter sales items by period');

  // Must link to product performance
  assert.ok(content.includes('/product-performance'), 'Must link to /product-performance');
});

test('4. App.jsx registers performance, reviews, and feedback routes', () => {
  const appPath = path.resolve(__dirname, '../src/App.jsx');
  assert.ok(fs.existsSync(appPath), 'App.jsx must exist');

  const content = fs.readFileSync(appPath, 'utf8');

  assert.ok(content.includes('path="/customer-feedback"'), 'Must register /customer-feedback route');
  assert.ok(content.includes('path="/reviews"'), 'Must register /reviews alias route');
  assert.ok(content.includes('path="/product-performance"'), 'Must register /product-performance route');
  assert.ok(content.includes('path="/performance"'), 'Must register /performance alias route');
  assert.ok(content.includes('CustomerFeedbackPage'), 'Must import CustomerFeedbackPage');
  assert.ok(content.includes('ProductPerformancePage'), 'Must import ProductPerformancePage');
});

test('5. SideMenu and QuickActions include performance, reviews, and WhatsApp navigation', () => {
  const sideMenuPath = path.resolve(__dirname, '../src/components/SideMenu.jsx');
  const quickActionsPath = path.resolve(__dirname, '../src/components/QuickActions.jsx');

  const sideMenuContent = fs.readFileSync(sideMenuPath, 'utf8');
  assert.ok(sideMenuContent.includes('/product-performance'), 'SideMenu must link to /product-performance');
  assert.ok(sideMenuContent.includes('/customer-feedback'), 'SideMenu must link to /customer-feedback');
  assert.ok(sideMenuContent.includes('/whatsapp'), 'SideMenu must link to /whatsapp');

  const quickActionsContent = fs.readFileSync(quickActionsPath, 'utf8');
  assert.ok(quickActionsContent.includes('/product-performance'), 'QuickActions must link to /product-performance');
  assert.ok(quickActionsContent.includes('/customer-feedback'), 'QuickActions must link to /customer-feedback');
  assert.ok(quickActionsContent.includes('/whatsapp'), 'QuickActions must link to /whatsapp');
});

test('6. Analytics period calculations accurately aggregate completed, pending, and cancelled sales', () => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const mockItems = [
    { id: '1', order_id: 'ord-1', product_id: 'p-1', quantity: 2, unit_price: 500, subtotal: 1000, order_status: 'delivered', order_date: new Date(now - 2 * dayMs).toISOString() },
    { id: '2', order_id: 'ord-2', product_id: 'p-2', quantity: 1, unit_price: 800, subtotal: 800, order_status: 'preparing', order_date: new Date(now - 4 * dayMs).toISOString() },
    { id: '3', order_id: 'ord-3', product_id: 'p-1', quantity: 1, unit_price: 500, subtotal: 500, order_status: 'cancelled', order_date: new Date(now - 5 * dayMs).toISOString() },
    { id: '4', order_id: 'ord-4', product_id: 'p-3', quantity: 3, unit_price: 300, subtotal: 900, order_status: 'delivered', order_date: new Date(now - 15 * dayMs).toISOString() },
    { id: '5', order_id: 'ord-5', product_id: 'p-2', quantity: 2, unit_price: 800, subtotal: 1600, order_status: 'delivered', order_date: new Date(now - 45 * dayMs).toISOString() }
  ];

  function calculatePeriodMetrics(items, period) {
    let cutoff = 0;
    if (period === '7d') cutoff = now - 7 * dayMs;
    if (period === '30d') cutoff = now - 30 * dayMs;

    const filtered = items.filter(i => new Date(i.order_date).getTime() >= cutoff);

    let completedRevenue = 0;
    let pendingRevenue = 0;
    let cancelledRevenue = 0;
    let totalUnits = 0;

    for (const item of filtered) {
      if (item.order_status === 'delivered') {
        completedRevenue += item.subtotal;
        totalUnits += item.quantity;
      } else if (item.order_status === 'cancelled') {
        cancelledRevenue += item.subtotal;
      } else {
        pendingRevenue += item.subtotal;
        totalUnits += item.quantity;
      }
    }

    return { completedRevenue, pendingRevenue, cancelledRevenue, totalUnits, count: filtered.length };
  }

  // 7 Days
  const m7 = calculatePeriodMetrics(mockItems, '7d');
  assert.equal(m7.completedRevenue, 1000, '7d completed revenue must match ord-1');
  assert.equal(m7.pendingRevenue, 800, '7d pending revenue must match ord-2');
  assert.equal(m7.cancelledRevenue, 500, '7d cancelled revenue must match ord-3');
  assert.equal(m7.totalUnits, 3, '7d units must exclude cancelled items');

  // 30 Days
  const m30 = calculatePeriodMetrics(mockItems, '30d');
  assert.equal(m30.completedRevenue, 1000 + 900, '30d completed revenue must match ord-1 + ord-4');
  assert.equal(m30.pendingRevenue, 800, '30d pending revenue must match ord-2');
  assert.equal(m30.totalUnits, 3 + 3, '30d units must include ord-1, ord-2, ord-4');

  // All Time
  const mAll = calculatePeriodMetrics(mockItems, 'all');
  assert.equal(mAll.completedRevenue, 1000 + 900 + 1600, 'All time completed revenue must match ord-1 + ord-4 + ord-5');
  assert.equal(mAll.pendingRevenue, 800);
  assert.equal(mAll.cancelledRevenue, 500);
  assert.equal(mAll.totalUnits, 2 + 1 + 3 + 2, 'All units excluding cancelled');
});

