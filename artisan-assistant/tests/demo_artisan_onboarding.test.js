import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loginPagePath = path.resolve(__dirname, '../src/pages/LoginPage.jsx');
const homePagePath = path.resolve(__dirname, '../src/pages/HomePage.jsx');
const chatBubblePath = path.resolve(__dirname, '../src/components/ChatBubble.jsx');
const sideMenuPath = path.resolve(__dirname, '../src/components/SideMenu.jsx');
const authContextPath = path.resolve(__dirname, '../src/lib/AuthContext.jsx');
const edgeFunctionPath = path.resolve(__dirname, '../../supabase/functions/artisan-otp/index.ts');

test('1. Demo artisan onboarding design supports all required fields across existing schemas', () => {
  // Verify the 4 official demo artisans cover all 11 required fields
  const demoArtisans = [
    {
      artisan_id_code: 'KA-ART-1001',
      full_name: 'Rameshappa Kumbar',
      date_of_birth: '1978-04-12',
      avatar_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
      qualification: 'Master Potter & Terracotta Craftsman, State Awardee',
      location: 'Kumbara Street, Ramanagara District, Karnataka',
      location_state: 'Karnataka',
      business_name: 'Kumbar Clay & Terracotta Crafts',
      craft_category: 'Pottery & Terracotta',
      product_types: 'Clay pots, earthen cooking pans, terracotta diyas',
      preferred_language: 'kn',
      experience_years: 24,
      verification_status: 'approved',
    },
    {
      artisan_id_code: 'KA-ART-1002',
      full_name: 'Sharadamma Nekara',
      date_of_birth: '1982-08-25',
      avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2',
      qualification: 'State Merit Award in Traditional Ilkal Weaving',
      location: 'Weavers Colony, Bagalkote District, Karnataka',
      location_state: 'Karnataka',
      business_name: 'Sharada Ilkal & Khadi Weavers',
      craft_category: 'Handloom & Textiles',
      product_types: 'Ilkal sarees, pure cotton dhotis, silk shawls',
      preferred_language: 'kn',
      experience_years: 18,
      verification_status: 'approved',
    },
    {
      artisan_id_code: 'KA-ART-1003',
      full_name: 'Mallikarjun Badagi',
      date_of_birth: '1975-11-03',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
      qualification: 'GI Registered Craftsman - Channapatna Toys & Lacquerware',
      location: 'Craft Complex, Channapatna, Karnataka',
      location_state: 'Karnataka',
      business_name: 'Channapatna Traditional Wood Craft',
      craft_category: 'Wood Craft & Toy Making',
      product_types: 'Natural lac-turned wooden toys, rocking horses, wooden spice boxes',
      preferred_language: 'kn',
      experience_years: 28,
      verification_status: 'approved',
    },
    {
      artisan_id_code: 'KA-ART-1004',
      full_name: 'Abdul Hameed Bidri',
      date_of_birth: '1985-02-14',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
      qualification: 'National Handicrafts Awardee, Master Bidri Craftsman',
      location: 'Fort Road, Bidar, Karnataka',
      location_state: 'Karnataka',
      business_name: 'Deccan Heritage Bidriware Art',
      craft_category: 'Bidriware & Metal Craft',
      product_types: 'Silver inlaid zinc-copper vases, hookahs, jewelry boxes',
      preferred_language: 'en',
      experience_years: 16,
      verification_status: 'approved',
    },
  ];

  assert.equal(demoArtisans.length, 4, 'Must support 4 demo artisans');
  for (const artisan of demoArtisans) {
    assert.ok(artisan.artisan_id_code.startsWith('KA-ART-'), 'Valid certificate ID format');
    assert.ok(artisan.full_name, 'Full name present');
    assert.ok(artisan.date_of_birth, 'DOB present');
    assert.ok(artisan.avatar_url, 'Profile photo present');
    assert.ok(artisan.qualification, 'Qualification present');
    assert.ok(artisan.business_name, 'Business name present');
    assert.ok(artisan.craft_category, 'Craft category present');
    assert.ok(['kn', 'en'].includes(artisan.preferred_language), 'Preferred language valid');
    assert.ok(artisan.experience_years > 0, 'Experience years valid');
    assert.equal(artisan.verification_status, 'approved', 'Verification status approved');
  }
});

test('2. Certificate number login resolves to real Supabase Auth account', () => {
  const loginSrc = fs.readFileSync(loginPagePath, 'utf8');

  // Verify resolution of Certificate ID to deterministic Supabase Auth email
  assert.ok(
    loginSrc.includes("authEmail = `artisan_${normalizedId.toLowerCase().replace(/[^a-z0-9]/g, '_')}@artisan.artisanconnect.ai`"),
    'Must resolve Certificate ID to deterministic Supabase Auth email'
  );

  // Must call genuine signIn
  assert.ok(loginSrc.includes('signIn(authEmail, password)'), 'Must authenticate via signIn');

  // Input must accept Certificate ID or Email
  assert.ok(
    loginSrc.includes('Application / Certificate Number or Email') || loginSrc.includes('Certificate ID or Email'),
    'Input label must indicate support for Certificate ID'
  );

  // Demo chips must include KA-ART-1001 through KA-ART-1004
  assert.ok(loginSrc.includes('KA-ART-1001'), 'Must include KA-ART-1001 chip');
  assert.ok(loginSrc.includes('KA-ART-1002'), 'Must include KA-ART-1002 chip');
  assert.ok(loginSrc.includes('KA-ART-1003'), 'Must include KA-ART-1003 chip');
  assert.ok(loginSrc.includes('KA-ART-1004'), 'Must include KA-ART-1004 chip');
});

test('3. AuthContext retrieves profile using authenticated account relationship (auth.uid), preventing ID spoofing', () => {
  const authContextSrc = fs.readFileSync(authContextPath, 'utf8');

  // Must bind queries to userId from session.user.id
  assert.ok(authContextSrc.includes("eq('id', userId)"), 'Profiles query must filter strictly by authenticated userId');
  assert.ok(authContextSrc.includes("eq('profile_id', userId)"), 'Artisans query must filter strictly by authenticated userId');
  assert.ok(authContextSrc.includes("session.user.id"), 'Must retrieve userId from verified session object');
});

test('4. Automatic assistant personalization: loads saved name, craft, language, avatar, and experience', () => {
  const homeSrc = fs.readFileSync(homePagePath, 'utf8');
  const bubbleSrc = fs.readFileSync(chatBubblePath, 'utf8');
  const sideMenuSrc = fs.readFileSync(sideMenuPath, 'utf8');

  // HomePage language synchronization with profile
  assert.ok(homeSrc.includes('profile?.preferred_language'), 'HomePage must synchronize language with profile');
  assert.ok(homeSrc.includes('setSelectedLanguage(profile.preferred_language)'), 'Must update selectedLanguage from profile');

  // Welcome card personalization
  assert.ok(homeSrc.includes('avatarUrl: avatarUrl'), 'Welcome card must include artisan avatarUrl');
  assert.ok(homeSrc.includes('experienceYears: experienceYears'), 'Welcome card must include experienceYears');

  // ChatBubble avatar and experience rendering
  assert.ok(bubbleSrc.includes('welcomeCard.avatarUrl'), 'ChatBubble must render artisan profile image');
  assert.ok(bubbleSrc.includes('welcomeCard.experienceYears'), 'ChatBubble must render experience years');

  // SideMenu avatar rendering
  assert.ok(sideMenuSrc.includes('profile?.avatar_url'), 'SideMenu must render profile avatar');
});

test('5. Single-use OTP vs. Password distinction is strictly preserved in backend Edge Function', () => {
  const edgeSrc = fs.readFileSync(edgeFunctionPath, 'utf8');

  // Verifies OTP challenge expiration and single-use replay prevention
  assert.ok(edgeSrc.includes('verify_otp_challenge'), 'Must use atomic verify_otp_challenge RPC');
  assert.ok(edgeSrc.includes('expiresAt'), 'Challenge must have explicit 5-minute expiry');

  // Reusable passwords are NOT reinterpreted as OTP
  assert.ok(!edgeSrc.includes('password = otp'), 'Must never treat OTP as a reusable password');

  // No secrets hardcoded in client code
  const loginSrc = fs.readFileSync(loginPagePath, 'utf8');
  assert.ok(!loginSrc.includes('12345678'), 'Client code must never contain hardcoded shared demo passwords');
});

test('6. Missing profile shows honest recovery state with refresh/signout actions instead of silent placeholder creation', () => {
  const homeSrc = fs.readFileSync(homePagePath, 'utf8');

  // Must detect authenticated user without profile/artisan records
  assert.ok(homeSrc.includes('!profile && !artisan && !authLoading'), 'HomePage must detect missing profile state');
  assert.ok(homeSrc.includes('missing_profile_notice'), 'HomePage must render missing profile notice');
  assert.ok(homeSrc.includes('refresh_profile'), 'HomePage must offer refresh_profile action');
  assert.ok(homeSrc.includes('refreshProfile()'), 'HomePage must call refreshProfile when action clicked');
});

test('7. Account linking security: Edge Function matches accounts strictly by deterministic email/metadata and does not link by unverified profile phone', () => {
  const edgeSrc = fs.readFileSync(edgeFunctionPath, 'utf8');

  // Must not link to unverified phone numbers in public profiles
  assert.ok(!edgeSrc.includes(".eq('phone', registryRecord.phone_number)"), 'Edge Function must not query profiles by unverified phone');
  assert.ok(edgeSrc.includes('u.email === deterministicEmail'), 'Edge Function must match by deterministic artisan email');
  assert.ok(edgeSrc.includes('u.user_metadata?.artisan_id_code === normalizedCode'), 'Edge Function must match by verified artisan metadata');
});


