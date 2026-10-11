const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://otkpcezsjoysyksymjrn.supabase.co';
const supabasePublishableKey = 'sb_publishable_8-uU_i9Ol0lGFEXzi0HrnA_i3J0Cx4n';
const supabase = createClient(supabaseUrl, supabasePublishableKey);

async function checkPolicies() {
  console.log('--- CHECKING PRODUCT_REVIEWS RLS POLICIES ---');
  try {
    const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({
      email: 'admin_new@test.com',
      password: 'password123'
    });

    if (loginErr) {
      console.log('❌ Login failed:', loginErr.message);
      return;
    }

    // Query pg_policies for product_reviews
    const { data: policies, error } = await supabase
      .rpc('get_table_policies', { table_name: 'product_reviews' }); // Wait, if RPC doesn't exist, we can select from pg_policies via a custom select if allowed, or we can inspect.
      
    if (error) {
      // If RPC is missing, let's try direct select from a system view or try to query pg_policies using public schema view if any
      console.log('❌ RPC get_table_policies failed, attempting direct query...');
      
      const { data: direct, error: directErr } = await supabase
        .from('product_reviews')
        .select('*')
        .limit(0); // won't give policies, but let's try to query pg_policies
        
      console.log('Let us try running a raw select using a standard query on pg_catalog if exposed:');
      const { data: pgData, error: pgErr } = await supabase
        .from('pg_policies') // usually not exposed via PostgREST unless explicitly mapped
        .select('*');
      console.log('pg_policies query status:', pgErr ? `❌ Failed: ${pgErr.message}` : '✅ Success!');
    } else {
      console.log('✅ Active policies (via RPC):', policies);
    }
  } catch (err) {
    console.log('❌ Exception:', err);
  }
}

checkPolicies();
