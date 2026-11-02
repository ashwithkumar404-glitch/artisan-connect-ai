import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loginPagePath = path.resolve(__dirname, '../src/pages/LoginPage.jsx');
const chatCssPath = path.resolve(__dirname, '../src/pages/Chat.css');
const themeTogglePath = path.resolve(__dirname, '../src/components/ThemeToggle.jsx');

test('1. Welcome / introduction screen renders with craft showcase and continue action', () => {
  const loginSrc = fs.readFileSync(loginPagePath, 'utf8');

  // View stage state
  assert.ok(loginSrc.includes("viewStage, setViewStage"), 'LoginPage must manage viewStage state');
  assert.ok(loginSrc.includes("viewStage === 'intro'"), 'LoginPage must support intro view stage');

  // Hero showcase and continue button
  assert.ok(loginSrc.includes('intro-craft-hero'), 'Intro stage must render craft hero section');
  assert.ok(loginSrc.includes('btn-continue-signin'), 'Intro stage must have Continue to Sign In action button');
  assert.ok(loginSrc.includes('Continue to Sign In'), 'Intro button must display Continue to Sign In text');

  // Navigation back to intro from login form
  assert.ok(loginSrc.includes('btn-back-to-intro'), 'Login form must provide quick action to return to welcome intro');
});

test('2. Reduced-motion accessibility is respected without blocking or delaying access', () => {
  const cssSrc = fs.readFileSync(chatCssPath, 'utf8');

  // Media query for prefers-reduced-motion
  assert.ok(cssSrc.includes('@media (prefers-reduced-motion: reduce)'), 'Chat.css must define prefers-reduced-motion media query');
  assert.ok(cssSrc.includes('.login-intro-card'), 'Reduced motion must target .login-intro-card');
  assert.ok(cssSrc.includes('.login-form-card'), 'Reduced motion must target .login-form-card');
  assert.ok(cssSrc.includes('animation: none !important'), 'Animations must be disabled under reduced motion');
  assert.ok(cssSrc.includes('transition: none !important'), 'Transitions must be disabled under reduced motion');
});

test('3. Credential labels updated to Application / Certificate Number and Temporary Password (labelled OTP)', () => {
  const loginSrc = fs.readFileSync(loginPagePath, 'utf8');

  // Application / Certificate Number label
  assert.ok(
    loginSrc.includes('Application / Certificate Number') || loginSrc.includes('ಅರ್ಜಿ / ಪ್ರಮಾಣಪತ್ರ ಸಂಖ್ಯೆ'),
    'LoginPage must label primary identifier as Application / Certificate Number'
  );

  // Temporary Password (labelled OTP) label
  assert.ok(
    loginSrc.includes('Temporary Password (labelled OTP)') || loginSrc.includes('ತಾತ್ಕಾಲಿಕ ಪಾಸ್‌ವರ್ಡ್ (OTP)'),
    'LoginPage must label credentials as Temporary Password (labelled OTP)'
  );

  // Contract with Edge function preserved
  assert.ok(loginSrc.includes('artisanIdCode: cleanId'), 'Must preserve artisanIdCode contract with Edge Function');
  assert.ok(loginSrc.includes('challengeId'), 'Must preserve challengeId validation');
});

test('4. Security: No hardcoded demo passwords in production frontend code and server-gated verification preserved', () => {
  const loginSrc = fs.readFileSync(loginPagePath, 'utf8');

  // Production safety
  assert.ok(!loginSrc.includes('123456'), 'Must not hardcode test OTP in client code');
  assert.ok(loginSrc.includes('canShowDemo'), 'Demo credentials banner must be conditionally gated');
  assert.ok(loginSrc.includes('supabase.auth.verifyOtp'), 'Must establish genuine authenticated session via verifyOtp');
  assert.ok(loginSrc.includes('token_hash: data.token_hash'), 'Must use verified server token_hash');
});

test('5. Light and Dark theme persistence and styling consistency', () => {
  const themeSrc = fs.readFileSync(themeTogglePath, 'utf8');
  const cssSrc = fs.readFileSync(chatCssPath, 'utf8');

  // Persistence in localStorage
  assert.ok(themeSrc.includes("localStorage.getItem('artisan_theme')"), 'Theme must read from localStorage');
  assert.ok(themeSrc.includes("localStorage.setItem('artisan_theme'"), 'Theme must persist to localStorage');
  assert.ok(themeSrc.includes("data-theme"), 'Theme must set data-theme attribute on root element');

  // Dark theme styles for login and intro
  assert.ok(cssSrc.includes('[data-theme="dark"] .login-intro-card') || cssSrc.includes('[data-theme="dark"] .login-card'), 'Chat.css must provide dark theme rules for login card');
  assert.ok(cssSrc.includes('[data-theme="dark"] .intro-craft-emblem'), 'Dark theme must style intro craft emblem');
  assert.ok(cssSrc.includes('[data-theme="dark"] .intro-feature-item'), 'Dark theme must style intro feature items');
});

test('6. Visual alignment: header controls grouping, responsive wrapping, and mobile viewport styling prevent overlap', () => {
  const loginSrc = fs.readFileSync(loginPagePath, 'utf8');
  const cssSrc = fs.readFileSync(chatCssPath, 'utf8');

  // Dedicated container classes
  assert.ok(loginSrc.includes('login-header-controls'), 'LoginPage must group controls in login-header-controls');
  assert.ok(loginSrc.includes('login-brand-text'), 'LoginPage must wrap brand text in login-brand-text');
  assert.ok(cssSrc.includes('.login-header-controls'), 'Chat.css must define .login-header-controls styles');

  // Responsive flex-wrap and mobile queries
  assert.ok(cssSrc.includes('flex-wrap: wrap'), 'Header bar must wrap gracefully to avoid squeezing items');
  assert.ok(cssSrc.includes('@media (max-width: 380px)'), 'Chat.css must handle narrow mobile viewports down to 320px');
});

test('7. Friendly network error diagnostics with retry and clear tab navigation defaulting to certificate login', () => {
  const loginSrc = fs.readFileSync(loginPagePath, 'utf8');
  const cssSrc = fs.readFileSync(chatCssPath, 'utf8');

  // Network error detection and retry button
  assert.ok(loginSrc.includes('isNetworkFailure') || loginSrc.includes('btn-retry-action'), 'LoginPage must manage network failure state with retry');
  assert.ok(loginSrc.includes('btn-retry-action'), 'Must render retry action button for connection failures');
  assert.ok(cssSrc.includes('.btn-retry-action'), 'Chat.css must style .btn-retry-action');

  // Tab navigation
  assert.ok(loginSrc.includes('login-method-tabs'), 'LoginPage must provide tab navigation for login methods');
  assert.ok(loginSrc.includes("authMethod, setAuthMethod"), 'LoginPage must manage authMethod state');
  assert.ok(loginSrc.includes("useState('otp')"), 'authMethod must default to certificate/OTP flow');
});


