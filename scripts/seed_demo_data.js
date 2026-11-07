#!/usr/bin/env node
/**
 * scripts/seed_demo_data.js
 *
 * Isolated Demo Data Seeder for Artisan Connect AI.
 * Reads data/demo_data.json and generates isolated seed SQL or performs
 * verified seeding where all records are strictly flagged with `is_demo: true`.
 *
 * Usage:
 *   node scripts/seed_demo_data.js [--sql] [--check]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const demoDataPath = path.join(rootDir, 'data/demo_data.json');

if (!fs.existsSync(demoDataPath)) {
  console.error(`Error: ${demoDataPath} not found.`);
  process.exit(1);
}

const rawData = fs.readFileSync(demoDataPath, 'utf8');
const demoData = JSON.parse(rawData);

console.log('📦 Artisan Connect AI — Isolated Demo Data Audit & Seeder');
console.log('========================================================');
console.log(`• Products: ${demoData.products?.length || 0}`);
console.log(`• Orders:   ${demoData.orders?.length || 0}`);
console.log(`• Enquiries:${demoData.enquiries?.length || 0}`);
console.log(`• Reviews:  ${demoData.reviews?.length || 0}`);

// 1. Safety check: ensure every record has is_demo: true
const nonDemoProds = (demoData.products || []).filter(p => p.is_demo !== true);
const nonDemoOrds = (demoData.orders || []).filter(o => o.is_demo !== true);
const nonDemoEnqs = (demoData.enquiries || []).filter(e => e.is_demo !== true);
const nonDemoRevs = (demoData.reviews || []).filter(r => r.is_demo !== true);

if (nonDemoProds.length > 0 || nonDemoOrds.length > 0 || nonDemoEnqs.length > 0 || nonDemoRevs.length > 0) {
  console.error('❌ SAFETY VIOLATION: Unflagged demo records found! All records must have is_demo: true.');
  process.exit(1);
}

console.log('✅ Safety verification passed: 100% of demo records carry is_demo: true');

// 2. Generate isolated SQL seed script
let sqlOutput = `-- ====================================================================
-- ARTISAN CONNECT AI — ISOLATED DEMO DATA SEED SCRIPT
-- Strictly isolated with is_demo = TRUE to protect real marketplace data
-- ====================================================================

-- 1. Demo Products
`;

demoData.products.forEach(p => {
  const safeName = p.name.replace(/'/g, "''");
  const safeDesc = p.description.replace(/'/g, "''");
  const safeLocalTitle = (p.local_title || '').replace(/'/g, "''");
  const safeLocalDesc = (p.local_description || '').replace(/'/g, "''");

  sqlOutput += `INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('${safeName}', '${safeLocalTitle}', '${safeDesc}', '${safeLocalDesc}', ${p.price}, ${p.stock_quantity}, 'published', TRUE)
ON CONFLICT DO NOTHING;\n`;
});

sqlOutput += `\n-- 2. Demo Orders\n`;
demoData.orders.forEach(o => {
  const carrier = o.carrier_name ? `'${o.carrier_name.replace(/'/g, "''")}'` : 'NULL';
  const tracking = o.tracking_number ? `'${o.tracking_number.replace(/'/g, "''")}'` : 'NULL';
  const stage = o.preparation_stage ? `'${o.preparation_stage}'` : "'not_started'";
  const checklist = o.preparation_checklist ? `'${JSON.stringify(o.preparation_checklist)}'::jsonb` : "'{}'::jsonb";
  const dispatch = o.dispatch_date ? `'${o.dispatch_date}'` : 'NULL';
  const delivered = o.delivered_at ? `'${o.delivered_at}'` : 'NULL';

  sqlOutput += `INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (${o.total_amount}, '${o.status}', ${stage}, ${checklist}, ${carrier}, ${tracking}, ${dispatch}, ${delivered}, TRUE, '${o.created_at || new Date().toISOString()}')
ON CONFLICT DO NOTHING;\n`;
});

const sqlFilePath = path.join(rootDir, 'supabase/seed_demo_data.sql');
fs.writeFileSync(sqlFilePath, sqlOutput, 'utf8');
console.log(`\n💾 Successfully generated SQL seed file: ${sqlFilePath}`);

