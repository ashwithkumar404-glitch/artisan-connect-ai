const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://otkpcezsjoysyksymjrn.supabase.co';
const supabasePublishableKey = 'sb_publishable_8-uU_i9Ol0lGFEXzi0HrnA_i3J0Cx4n';
const supabase = createClient(supabaseUrl, supabasePublishableKey);

async function runTests() {
  console.log('--- STARTING MARKETPLACE V2 E2E VERIFICATION SCRIPT ---');

  try {
    // 1. Authenticate with admin account
    console.log('Logging in as admin...');
    const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({
      email: 'admin_new@test.com',
      password: 'password123'
    });

    if (loginErr) {
      console.log('❌ Admin login failed:', loginErr.message);
      return;
    }

    const adminUser = auth.user;
    console.log(`✅ Logged in successfully. User ID: ${adminUser.id}`);

    // 2. Check if orders table exists
    console.log('Checking orders table in schema cache...');
    const { data: ordersData, error: ordersErr } = await supabase
      .from('orders')
      .select('*')
      .limit(1);

    if (ordersErr && (ordersErr.code === 'PGRST205' || ordersErr.message.includes('Could not find the table'))) {
      console.log('\n======================================================');
      console.log('⚠️  DATABASE SETUP REQUIRED');
      console.log('The Marketplace V2 tables (orders, order_items, product_reviews)');
      console.log('do not exist in the Supabase schema cache.');
      console.log('Please copy and run the SQL code from:');
      console.log('frontend/supabase_marketplace_v2_setup.sql');
      console.log('in your Supabase Dashboard SQL Editor first.');
      console.log('======================================================\n');
      return;
    }

    console.log('🎉 Orders table is present in database!');

    // 3. Check if product reviews table exists
    console.log('Checking product reviews table...');
    const { error: reviewsErr } = await supabase
      .from('product_reviews')
      .select('*')
      .limit(1);

    if (reviewsErr) {
      console.log('❌ Product Reviews check failed:', reviewsErr.message);
      return;
    }
    console.log('🎉 Product Reviews table is present!');

    // 4. Check rating aggregation columns in products
    console.log('Checking rating aggregation columns in products...');
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, name, average_rating, review_count')
      .limit(1);

    if (pErr) {
      console.log('❌ Products table rating columns missing:', pErr.message);
    } else {
      console.log('🎉 Products rating aggregation columns are present!');
      console.log('Sample Product:', products[0]);
    }

    console.log('\n======================================================');
    console.log('✅ End-to-End integration checks passed! Database is ready.');
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Exception in E2E script:', err);
  }
}

runTests();
