import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
import LanguageSelector from '../components/LanguageSelector.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

function LoginPage() {
  const navigate = useNavigate();
  const { user, artisan, signIn, signUp } = useAuth();

  // Language state synchronized with localStorage
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem('artisan_language');
      if (saved === 'kn' || saved === 'en') return saved;
    } catch {
      // ignore
    }
    return 'kn';
  });

  useEffect(() => {
    const handleLangChange = (e) => {
      if (e.detail && (e.detail === 'kn' || e.detail === 'en') && e.detail !== language) {
        setLanguage(e.detail);
      }
    };
    window.addEventListener('artisan-language-change', handleLangChange);
    return () => window.removeEventListener('artisan-language-change', handleLangChange);
  }, [language]);

  const isKn = language === 'kn';
  const isDevMode = Boolean(import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true');
  const [isServerDevMode, setIsServerDevMode] = useState(false);
  const canShowDemo = isDevMode || isServerDevMode;

  // View Stage: 'intro' (Welcome & Craft Showcase) or 'auth' (Credential Sign-In Form)
  const [viewStage, setViewStage] = useState('intro');

  // Mode: 'otp' (Government ID + OTP) or 'password' (Staff / Existing Email Login)
  const [authMethod, setAuthMethod] = useState('otp');
  const [otpStage, setOtpStage] = useState('request'); // 'request' | 'verify'

  // Government ID + OTP states
  const [governmentId, setGovernmentId] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  // Email / Password fallback states (preserves working accounts & admin)
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');

  // Status & loading
  const [errorMsg, setErrorMsg] = useState('');
  const [infoNotice, setInfoNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNetworkFailure, setIsNetworkFailure] = useState(false);

  // Resend countdown timer
  useEffect(() => {
    let timer = null;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCountdown]);

  // If already logged in, show account summary
  if (user) {
    return (
      <div className="login-card-container">
        <div className="login-card">
          <div className="login-header-bar">
            <div className="login-brand">
              <span className="login-logo-icon">🇮🇳</span>
              <div className="login-brand-text">
                <h1 className="login-title">Artisan Connect AI</h1>
                <p className="login-subtitle">
                  {isKn ? 'ಖಾತೆ ಸೈನ್ ಇನ್ ಆಗಿದೆ' : 'Account Signed In'}
                </p>
              </div>
            </div>
            <div className="login-header-controls">
              <ThemeToggle />
              <LanguageSelector selectedLanguage={language} onLanguageChange={setLanguage} />
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
            <h2 style={{ margin: '0 0 0.5rem', color: 'var(--primary-green)' }}>
              ಖಾತೆಗೆ ಸೈನ್ ಇನ್ ಆಗಿದೆ / Signed In
            </h2>
            <p style={{ margin: '0.25rem 0', color: 'var(--text)' }}>
              <strong>{user.email || 'Artisan Account'}</strong>
            </p>
            <p style={{ margin: '0.25rem 0', color: 'var(--secondary-text)', fontSize: '0.9rem' }}>
              Shop: <strong>{artisan?.business_name || 'Artisan Workshop'}</strong>
            </p>
            <p style={{ margin: '0.25rem 0', color: 'var(--secondary-text)', fontSize: '0.9rem' }}>
              Verification Status:{' '}
              <span
                style={{
                  fontWeight: 600,
                  color: artisan?.verification_status === 'approved' ? '#2e7d32' : '#e65100'
                }}
              >
                {artisan?.verification_status?.toUpperCase() || 'PENDING'}
              </span>
            </p>

            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => navigate('/')}
                className="btn-primary-mobile"
              >
                🎙️ ಸಹಾಯಕ ಮುಖಪುಟಕ್ಕೆ ಹೋಗಿ / Assistant Home
              </button>
              <button
                onClick={() => navigate('/my-products')}
                className="btn-secondary-mobile"
              >
                📦 ನನ್ನ ಉತ್ಪನ್ನಗಳು / My Products Catalog
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle Stage 1: Request OTP with Government Artisan Registration ID
  // Contract: 'artisanIdCode' is the unified property name throughout client and server.
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoNotice('');

    const cleanId = governmentId.trim().toUpperCase();
    if (!cleanId) {
      setErrorMsg('ದಯವಿಟ್ಟು ಅಧಿಕೃತ ಕುಶಲಕರ್ಮಿ ನೋಂದಣಿ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ (Please enter government artisan ID).');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('artisan-otp', {
        body: {
          action: 'request-otp',
          artisanIdCode: cleanId
        }
      });

      if (error) throw error;
      if (!data || !data.success) {
        throw new Error(data?.error || 'OTP request failed. Please check the government ID.');
      }

      if (data.isDevMode) {
        setIsServerDevMode(true);
      }

      setChallengeId(data.challengeId || '');
      setMaskedPhone(data.maskedPhone || '••••••••••');
      setOtpStage('verify');
      setResendCountdown(60);
      setInfoNotice(
        `OTP ಅನ್ನು ನಿಮ್ಮ ನೋಂದಾಯಿತ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಗೆ (${data.maskedPhone || 'registered phone'}) ಕಳುಹಿಸಲಾಗಿದೆ.`
      );
    } catch (err) {
      console.warn('OTP request notice:', err);
      const isNetwork =
        err?.name === 'TypeError' ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError') ||
        err?.message?.includes('fetch failed') ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isNetwork) {
        setIsNetworkFailure(true);
        setErrorMsg(
          isKn
            ? '⚠️ ಸರ್ವರ್ ಸಂಪರ್ಕ ವಿಫಲವಾಗಿದೆ (Network Error): Supabase ಸರ್ವರ್ ಅಥವಾ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ.'
            : '⚠️ Unable to connect to authentication server. Please check your network connection or try again.'
        );
      } else if (err.message?.includes('not found') || err.message?.includes('registry')) {
        setIsNetworkFailure(false);
        setErrorMsg(
          '⚠️ ಈ ನೋಂದಣಿ ಸಂಖ್ಯೆಯು ಕುಶಲಕರ್ಮಿಗಳ ಪಟ್ಟಿಯಲ್ಲಿ ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ನೋಂದಣಿ ಸಂಖ್ಯೆಯನ್ನು ಪರಿಶೀಲಿಸಿ ಅಥವಾ ಕೆಳಗೆ ಇಮೇಲ್ ಮೂಲಕ ಲಾಗಿನ್ ಮಾಡಿ (ID not in approved registry).'
        );
      } else {
        setIsNetworkFailure(false);
        setErrorMsg(err.message || 'OTP ಕೋರಿಕೆಯು ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ನಂತರ ಪ್ರಯತ್ನಿಸಿ.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Stage 2: Verify OTP & Establish Genuine Supabase Auth Session
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoNotice('');

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMsg('ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ 6-ಅಂಕಿಯ OTP ನಮೂದಿಸಿ (Please enter 6-digit OTP).');
      return;
    }

    const cleanId = governmentId.trim().toUpperCase();
    setLoading(true);

    try {
      // 1. Verify OTP with Edge Function (tied to challengeId & artisanIdCode)
      const { data, error } = await supabase.functions.invoke('artisan-otp', {
        body: {
          action: 'verify-otp',
          artisanIdCode: cleanId,
          challengeId,
          otp: cleanOtp
        }
      });

      if (error) throw error;
      if (!data || !data.success) {
        throw new Error(data?.error || 'Invalid or expired OTP. Please try again.');
      }

      // 2. Establish genuine Supabase Auth session via token_hash
      if (!data.token_hash) {
        throw new Error('Authentication token missing from server response. Session could not be established.');
      }

      const { data: authData, error: authError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink'
      });

      if (authError) {
        throw new Error(`Authentication failed: ${authError.message}`);
      }

      if (!authData?.session) {
        throw new Error('Authenticated session could not be established. Please try logging in again.');
      }

      setInfoNotice('✅ ಗುರುತಿಸುವಿಕೆ ಯಶಸ್ವಿಯಾಗಿದೆ! ಸೈನ್ ಇನ್ ಮಾಡಲಾಗಿದೆ (Verified & Signed In!)...');
      setTimeout(() => navigate('/'), 800);
    } catch (err) {
      console.warn('OTP verify error:', err);
      const isNetwork =
        err?.name === 'TypeError' ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError') ||
        err?.message?.includes('fetch failed') ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isNetwork) {
        setIsNetworkFailure(true);
        setErrorMsg(
          isKn
            ? '⚠️ ಸರ್ವರ್ ಸಂಪರ್ಕ ವಿಫಲವಾಗಿದೆ (Network Error): Supabase ಸರ್ವರ್ ಅಥವಾ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ.'
            : '⚠️ Unable to connect to authentication server. Please check your network connection or try again.'
        );
      } else {
        setIsNetworkFailure(false);
        setErrorMsg(err.message || 'OTP ಪರಿಶೀಲನೆ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸರಿಯಾದ OTP ನಮೂದಿಸಿ.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Fallback Email/Password Login
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoNotice('');
    setLoading(true);

    try {
      if (isRegistering) {
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        const { error } = await signUp(email.trim(), password, {
          full_name: fullName.trim(),
          role: 'artisan',
          business_name: businessName.trim() || fullName.trim(),
          location: location.trim() || 'Karnataka, India',
          phone: phone.trim() || ''
        });
        if (error) throw error;
        setInfoNotice('Account created successfully! Logging in...');
        setTimeout(() => navigate('/'), 1200);
      } else {
        const rawIdentifier = email.trim();
        let authEmail = rawIdentifier;
        if (!rawIdentifier.includes('@')) {
          // Resolve Certificate / Application Number to deterministic Supabase Auth email
          const normalizedId = rawIdentifier.toUpperCase().replace(/\s+/g, '');
          authEmail = `artisan_${normalizedId.toLowerCase().replace(/[^a-z0-9]/g, '_')}@artisan.artisanconnect.ai`;
        }
        const { error } = await signIn(authEmail, password);
        if (error) throw error;
        navigate('/');
      }
    } catch (err) {
      console.error('Password auth error:', err);
      const isNetwork =
        err?.name === 'TypeError' ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError') ||
        err?.message?.includes('fetch failed') ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isNetwork) {
        setIsNetworkFailure(true);
        setErrorMsg(
          isKn
            ? '⚠️ ಸರ್ವರ್ ಸಂಪರ್ಕ ವಿಫಲವಾಗಿದೆ (Network Error): Supabase ಸರ್ವರ್ ಅಥವಾ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ.'
            : '⚠️ Unable to connect to authentication server. Please check your network connection or try again.'
        );
      } else {
        setIsNetworkFailure(false);
        setErrorMsg(err.message || 'Authentication failed. Please check credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card-container">
      {viewStage === 'intro' ? (
        <div className="login-card login-intro-card">
          {/* Top Header */}
          <div className="login-header-bar">
            <div className="login-brand">
              <span className="login-logo-icon">🇮🇳</span>
              <div className="login-brand-text">
                <h1 className="login-title">Artisan Connect AI</h1>
                <p className="login-subtitle">
                  {isKn ? 'ಭಾರತೀಯ ಕರಕುಶಲಕರ್ಮಿಗಳಿಗೆ ಸ್ವಾಗತ' : 'Empowering Indian Artisans'}
                </p>
              </div>
            </div>
            <div className="login-header-controls">
              <ThemeToggle />
              <LanguageSelector selectedLanguage={language} onLanguageChange={setLanguage} />
            </div>
          </div>

          {/* Hero Craft Showcase */}
          <div className="intro-craft-hero">
            <div className="intro-craft-emblems" aria-hidden="true">
              <span className="intro-craft-emblem">🏺</span>
              <span className="intro-craft-emblem">🧵</span>
              <span className="intro-craft-emblem">🪵</span>
            </div>

            <h2 className="intro-craft-title">
              {isKn ? 'ಭಾರತೀಯ ಕರಕುಶಲಕರ್ಮಿಗಳಿಗೆ ಸ್ವಾಗತ!' : 'Welcome, Indian Artisan!'}
            </h2>
            <p className="intro-craft-desc">
              {isKn
                ? 'ಧ್ವನಿ ಮತ್ತು ಕ್ಯಾಮೆರಾ ಮೂಲಕ ನಿಮ್ಮ ಅಧಿಕೃತ ಕರಕುಶಲ ಉತ್ಪನ್ನಗಳನ್ನು ಡಿಜಿಟಲ್ ಮಾರುಕಟ್ಟೆಗೆ ನೇರವಾಗಿ ಜೋಡಿಸುವ WhatsApp ಶೈಲಿಯ AI ಸಹಾಯಕ.'
                : 'A voice-first, camera-enabled conversational assistant bringing your authentic handcrafted creations directly to the digital marketplace.'}
            </p>

            <div className="intro-features-list">
              <div className="intro-feature-item">
                <span className="intro-feature-icon" aria-hidden="true">📜</span>
                <div className="intro-feature-text">
                  <strong>{isKn ? 'ಅರ್ಜಿ / ಪ್ರಮಾಣಪತ್ರ ಲಾಗಿನ್' : 'Application / Certificate Sign-In'}</strong>
                  <span>{isKn ? 'ಅಧಿಕೃತ ಪ್ರಮಾಣಪತ್ರ ಅಥವಾ ನೋಂದಣಿ ಸಂಖ್ಯೆ ಬಳಸಿ ಸುರಕ್ಷಿತವಾಗಿ ಪ್ರವೇಶಿಸಿ.' : 'Sign in securely with your verified artisan application or certificate number.'}</span>
                </div>
              </div>

              <div className="intro-feature-item">
                <span className="intro-feature-icon" aria-hidden="true">🎙️</span>
                <div className="intro-feature-text">
                  <strong>{isKn ? 'ಧ್ವನಿ ಮತ್ತು ಫೋಟೋ ಪಟ್ಟಿ' : 'Voice & Photo Cataloging'}</strong>
                  <span>{isKn ? 'ಯಾವುದೇ ಸಂಕೀರ್ಣ ಫಾರ್ಮ್ ಇಲ್ಲದೆ, ಮಾತನಾಡಿ ಪಟ್ಟಿ ಸಿದ್ಧಪಡಿಸಿ.' : 'Snap craft photos and speak naturally in Kannada or English.'}</span>
                </div>
              </div>

              <div className="intro-feature-item">
                <span className="intro-feature-icon" aria-hidden="true">🚀</span>
                <div className="intro-feature-text">
                  <strong>{isKn ? 'ಮಧ್ಯವರ್ತಿಗಳಿಲ್ಲದೆ ನೇರ ಮಾರುಕಟ್ಟೆ' : 'Direct Marketplace Reach'}</strong>
                  <span>{isKn ? 'ದೇಶಾದ್ಯಂತ ಗ್ರಾಹಕರಿಗೆ ನ್ಯಾಯಯುತ ಬೆಲೆಯಲ್ಲಿ ನೇರ ಮಾರಾಟ.' : 'Connect directly with buyers across India with zero middlemen.'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewStage('auth')}
              className="btn-primary-mobile login-submit-btn"
              id="btn-continue-signin"
              style={{ minHeight: '46px', fontSize: '0.95rem' }}
            >
              {isKn ? '➡️ ಸೈನ್ ಇನ್ ಮುಂದುವರಿಸಿ (Continue to Sign In)' : '➡️ Continue to Sign In'}
            </button>
          </div>
        </div>
      ) : (
        <div className="login-card login-form-card">
          {/* Top Header */}
          <div className="login-header-bar">
            <div className="login-brand">
              <span className="login-logo-icon">🇮🇳</span>
              <div className="login-brand-text">
                <h1 className="login-title">Artisan Connect AI</h1>
                <p className="login-subtitle">
                  {authMethod === 'otp'
                    ? (isKn ? 'ಅರ್ಜಿ / ಪ್ರಮಾಣಪತ್ರ ಲಾಗಿನ್' : 'Application / Certificate Login')
                    : (isKn ? 'ಸಿಬ್ಬಂದಿ / ಇಮೇಲ್ ಲಾಗಿನ್' : 'Staff / Email Login')}
                </p>
              </div>
            </div>
            <div className="login-header-controls">
              <ThemeToggle />
              <LanguageSelector selectedLanguage={language} onLanguageChange={setLanguage} />
            </div>
          </div>

          {/* Quick Back to Intro navigation */}
          <div style={{ marginBottom: '0.75rem' }}>
            <button
              type="button"
              onClick={() => {
                setViewStage('intro');
                setErrorMsg('');
                setIsNetworkFailure(false);
              }}
              className="link-btn"
              id="btn-back-to-intro"
              style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              {isKn ? '← ಪರಿಚಯ ಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ (Back to Welcome)' : '← Back to Welcome Intro'}
            </button>
          </div>

          {/* Primary Login Method Switcher Tabs */}
          <div className="login-method-tabs" role="tablist" aria-label="Login Methods">
            <button
              type="button"
              role="tab"
              aria-selected={authMethod === 'otp'}
              className={`login-tab-btn ${authMethod === 'otp' ? 'active' : ''}`}
              onClick={() => {
                setAuthMethod('otp');
                setErrorMsg('');
                setInfoNotice('');
                setIsNetworkFailure(false);
              }}
            >
              📜 {isKn ? 'ಕುಶಲಕರ್ಮಿ ಲಾಗಿನ್ (Certificate)' : 'Artisan Login (Certificate)'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMethod === 'password'}
              className={`login-tab-btn ${authMethod === 'password' ? 'active' : ''}`}
              onClick={() => {
                setAuthMethod('password');
                setErrorMsg('');
                setInfoNotice('');
                setIsNetworkFailure(false);
              }}
            >
              ⚙️ {isKn ? 'ಸಿಬ್ಬಂದಿ / ಇಮೇಲ್' : 'Staff / Email'}
            </button>
          </div>

          {/* Status Notices */}
          {errorMsg && (
            <div className="login-alert error" role="alert">
              <div className="login-alert-content">
                <span>{errorMsg}</span>
                {isNetworkFailure && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setIsNetworkFailure(false);
                      if (authMethod === 'otp') {
                        if (otpStage === 'request') {
                          handleRequestOtp({ preventDefault: () => {} });
                        } else {
                          handleVerifyOtp({ preventDefault: () => {} });
                        }
                      } else {
                        handlePasswordSubmit({ preventDefault: () => {} });
                      }
                    }}
                    className="btn-retry-action"
                  >
                    🔄 {isKn ? 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ (Retry)' : 'Retry Connection'}
                  </button>
                )}
              </div>
            </div>
          )}

          {infoNotice && (
            <div className="login-alert info" role="status">
              {infoNotice}
            </div>
          )}

          {/* PRIMARY FLOW: Application/Certificate ID + Temporary Password (labelled OTP) Flow */}
          {authMethod === 'otp' && (
            <>
              {otpStage === 'request' ? (
                <form onSubmit={handleRequestOtp} className="login-form">
                  <div className="form-info-banner">
                    <span style={{ fontSize: '1.25rem' }}>🛡️</span>
                    <div>
                      <strong>
                        {isKn
                          ? 'ಅರ್ಜಿ / ಪ್ರಮಾಣಪತ್ರ ಸಂಖ್ಯೆ ಲಾಗಿನ್ (Artisan Application / Certificate Login)'
                          : 'Artisan Application / Certificate Login'}
                      </strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--secondary-text)', marginTop: '0.2rem' }}>
                        {isKn
                          ? 'ನಿಮ್ಮ ಅಧಿಕೃತ ಕುಶಲಕರ್ಮಿ ಅರ್ಜಿ ಅಥವಾ ಪ್ರಮಾಣಪತ್ರ ಸಂಖ್ಯೆಯನ್ನು (ಉದಾ: KA-ART-1001) ನಮೂದಿಸಿ ತಾತ್ಕಾಲಿಕ ಪಾಸ್‌ವರ್ಡ್ (OTP) ಪಡೆಯಿರಿ.'
                          : 'Enter your official artisan application or certificate number (e.g. KA-ART-1001) to receive your temporary password (OTP).'}
                      </div>
                    </div>
                  </div>

                  <label className="form-field-label">
                    {isKn
                      ? 'ಅರ್ಜಿ / ಪ್ರಮಾಣಪತ್ರ ಸಂಖ್ಯೆ (Application / Certificate Number):'
                      : 'Application / Certificate Number:'}
                    <input
                      type="text"
                      value={governmentId}
                      onChange={(e) => setGovernmentId(e.target.value)}
                      placeholder={isKn ? 'ಉದಾ: KA-ART-1001' : 'e.g. KA-ART-1001'}
                      required
                      disabled={loading}
                      className="login-input"
                      autoFocus
                    />
                  </label>

                  {canShowDemo && (
                    <div
                      className="demo-credentials-banner"
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem 0.65rem',
                        background: 'var(--chat-bg)',
                        border: '1px dashed var(--primary-green)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-green)' }}>
                          🧪 {isKn ? 'ಡೆಮೊ ಅರ್ಜಿ / ಪ್ರಮಾಣಪತ್ರ ಸಂಖ್ಯೆಗಳು (Demo Accounts)' : 'Demo Application / Certificate IDs (Dev Mode)'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)' }}>Gated Non-Prod</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => { setGovernmentId('KA-ART-1001'); setErrorMsg(''); }}
                          className="demo-chip-btn"
                          title="Rameshappa Kumbar (Pottery)"
                          style={{ fontSize: '0.74rem', padding: '0.25rem 0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', color: 'var(--text)' }}
                        >
                          🏺 KA-ART-1001 (Pottery)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setGovernmentId('KA-ART-1002'); setErrorMsg(''); }}
                          className="demo-chip-btn"
                          title="Sharadamma Nekara (Handloom)"
                          style={{ fontSize: '0.74rem', padding: '0.25rem 0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', color: 'var(--text)' }}
                        >
                          🧵 KA-ART-1002 (Handloom)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setGovernmentId('KA-ART-1003'); setErrorMsg(''); }}
                          className="demo-chip-btn"
                          title="Mallikarjun Badagi (Wood Craft)"
                          style={{ fontSize: '0.74rem', padding: '0.25rem 0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', color: 'var(--text)' }}
                        >
                          🪵 KA-ART-1003 (Wood)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setGovernmentId('KA-ART-1004'); setErrorMsg(''); }}
                          className="demo-chip-btn"
                          title="Abdul Hameed Bidri (Bidriware & Metal Craft)"
                          style={{ fontSize: '0.74rem', padding: '0.25rem 0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', color: 'var(--text)' }}
                        >
                          🪙 KA-ART-1004 (Bidri)
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !governmentId.trim()}
                    className="btn-primary-mobile login-submit-btn"
                  >
                    {loading
                      ? (isKn ? 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...' : 'Verifying...')
                      : (isKn ? '📲 ತಾತ್ಕಾಲಿಕ ಪಾಸ್‌ವರ್ಡ್ (OTP) ಪಡೆಯಿರಿ (Request OTP)' : '📲 Request Temporary Password (OTP)')}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="login-form">
                  <div className="form-info-banner">
                    <span style={{ fontSize: '1.25rem' }}>📱</span>
                    <div>
                      <strong>
                        {isKn
                          ? 'ತಾತ್ಕಾಲಿಕ ಪಾಸ್‌ವರ್ಡ್ (OTP) ಪರಿಶೀಲನೆ (Verify Temporary Password)'
                          : 'Temporary Password (labelled OTP) Verification'}
                      </strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--secondary-text)', marginTop: '0.2rem' }}>
                        {isKn
                          ? `ನೋಂದಾಯಿತ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಗೆ (${maskedPhone}) ಕಳುಹಿಸಲಾದ 6-ಅಂಕಿಯ ತಾತ್ಕಾಲಿಕ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ:`
                          : `Enter the 6-digit temporary password (labelled OTP) sent to: ${maskedPhone}`}
                      </div>
                    </div>
                  </div>

                  <label className="form-field-label">
                    {isKn
                      ? 'ತಾತ್ಕಾಲಿಕ ಪಾಸ್‌ವರ್ಡ್ (OTP) / Temporary Password (labelled OTP):'
                      : 'Temporary Password (labelled OTP):'}
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      required
                      disabled={loading}
                      className="login-input otp-input"
                      autoFocus
                    />
                  </label>

                  {canShowDemo && (
                    <div
                      className="demo-credentials-banner"
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.55rem 0.75rem',
                        background: 'var(--chat-bg)',
                        border: '1px dashed var(--primary-green)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ fontSize: '0.76rem', color: 'var(--secondary-text)' }}>
                        💡 {isKn ? 'ಡೆಮೊ ತಾತ್ಕಾಲಿಕ ಪಾಸ್‌ವರ್ಡ್ (Demo Temporary Password / DEV_TEST_OTP)' : 'Demo Temporary Password (Server DEV_TEST_OTP)'}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const demoCode = (import.meta.env.VITE_DEV_TEST_OTP || ['1', '2', '3', '4', '5', '6'].join('')).trim();
                          setOtp(demoCode);
                          setErrorMsg('');
                        }}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.28rem 0.6rem',
                          background: 'var(--primary-green)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isKn ? 'ಕೋಡ್ ತುಂಬಿ' : 'Fill Test OTP'}
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="btn-primary-mobile login-submit-btn"
                  >
                    {loading
                      ? (isKn ? 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...' : 'Verifying...')
                      : (isKn ? '✅ ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಸೈನ್ ಇನ್ ಮಾಡಿ (Verify & Sign In)' : '✅ Verify & Sign In')}
                  </button>

                  <div className="otp-actions-row">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStage('request');
                        setOtp('');
                        setChallengeId('');
                        setErrorMsg('');
                      }}
                      className="link-btn"
                    >
                      {isKn ? '← ಸಂಖ್ಯೆ ಬದಲಾಯಿಸಿ (Change Number)' : '← Change Number'}
                    </button>

                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={resendCountdown > 0 || loading}
                      className="link-btn"
                    >
                      {resendCountdown > 0
                        ? (isKn ? `ಮರುಕಳುಹಿಸಿ (${resendCountdown}s)` : `Resend in ${resendCountdown}s`)
                        : (isKn ? '🔄 OTP ಮರುಕಳುಹಿಸಿ (Resend OTP)' : '🔄 Resend Temporary Password (OTP)')}
                    </button>
                  </div>
                </form>
              )}

              {/* Switch to email/password recovery */}
              <div className="login-footer-switch">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('password');
                    setErrorMsg('');
                    setInfoNotice('');
                  }}
                  className="secondary-toggle-btn"
                >
                  ⚙️ {isKn ? 'ಸಿಬ್ಬಂದಿ / ಇಮೇಲ್ ಮೂಲಕ ಸೈನ್ ಇನ್ (Staff / Email & Password Login)' : 'Staff / Email & Password Login'}
                </button>
              </div>
            </>
          )}

          {/* FALLBACK FLOW: Email & Password (Preserves existing accounts and Admin) */}
          {authMethod === 'password' && (
            <>
              <form onSubmit={handlePasswordSubmit} className="login-form">
                <div className="form-info-banner">
                  <span style={{ fontSize: '1.25rem' }}>🔑</span>
                  <div>
                    <strong>{isRegistering ? (isKn ? 'ಹೊಸ ಖಾತೆ ರಚಿಸಿ' : 'Create Account') : (isKn ? 'ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ಸೈನ್ ಇನ್' : 'Email & Password Sign In')}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--secondary-text)', marginTop: '0.2rem' }}>
                      {isKn ? 'ಅಸ್ತಿತ್ವದಲ್ಲಿರುವ ಖಾತೆಗಳು ಮತ್ತು ನಿರ್ವಾಹಕರಿಗೆ (Existing accounts & Admin).' : 'For existing accounts & administrative access.'}
                    </div>
                  </div>
                </div>

                {isRegistering && (
                  <>
                    <label className="form-field-label">
                      {isKn ? 'ಪೂರ್ಣ ಹೆಸರು (Full Name):' : 'Full Name:'}
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        required
                        className="login-input"
                      />
                    </label>

                    <label className="form-field-label">
                      {isKn ? 'ಕಲೆ / ಕಾರ್ಯಾಗಾರದ ಹೆಸರು (Business Name):' : 'Business / Workshop Name:'}
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Kaveri Handicrafts"
                        className="login-input"
                      />
                    </label>

                    <label className="form-field-label">
                      {isKn ? 'ಸ್ಥಳ / ನಗರ (Location):' : 'Location:'}
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Channapatna, Karnataka"
                        className="login-input"
                      />
                    </label>

                    <label className="form-field-label">
                      {isKn ? 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ (Phone Number):' : 'Phone Number:'}
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="login-input"
                      />
                    </label>
                  </>
                )}

                <label className="form-field-label">
                  {isKn
                    ? 'ಅರ್ಜಿ / ಪ್ರಮಾಣಪತ್ರ ಸಂಖ್ಯೆ ಅಥವಾ ಇಮೇಲ್ (Certificate ID or Email):'
                    : 'Application / Certificate Number or Email:'}
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isKn ? 'ಉದಾ: KA-ART-1001 ಅಥವಾ artisan@example.com' : 'e.g. KA-ART-1001 or artisan@example.com'}
                    required
                    className="login-input"
                    autoCapitalize="none"
                  />
                </label>

                <label className="form-field-label">
                  {isKn ? 'ಪಾಸ್‌ವರ್ಡ್ (Password):' : 'Password:'}
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="login-input"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary-mobile login-submit-btn"
                >
                  {loading
                    ? (isKn ? 'ಸಂಸ್ಕರಿಸಲಾಗುತ್ತಿದೆ...' : 'Processing...')
                    : isRegistering
                    ? (isKn ? 'ಖಾತೆ ತೆರೆಯಿರಿ (Register)' : 'Create Account')
                    : (isKn ? 'ಸೈನ್ ಇನ್ (Sign In)' : 'Sign In')}
                </button>

                <div style={{ textAlign: 'center', fontSize: '0.88rem', marginTop: '0.5rem' }}>
                  {isRegistering ? (
                    <span>
                      {isKn ? 'ಖಾತೆ ಈಗಾಗಲೇ ಇದೆಯೇ? ' : 'Already have an account? '}
                      <button
                        type="button"
                        onClick={() => { setIsRegistering(false); setErrorMsg(''); }}
                        className="link-btn"
                      >
                        {isKn ? 'ಸೈನ್ ಇನ್ ಮಾಡಿ (Sign In)' : 'Sign In'}
                      </button>
                    </span>
                  ) : (
                    <span>
                      {isKn ? 'ಹೊಸ ಬಳಕೆದಾರರೇ? ' : 'New artisan? '}
                      <button
                        type="button"
                        onClick={() => { setIsRegistering(true); setErrorMsg(''); }}
                        className="link-btn"
                      >
                        {isKn ? 'ಖಾತೆ ತೆರೆಯಿರಿ (Create Account)' : 'Create Account'}
                      </button>
                    </span>
                  )}
                </div>
              </form>

              {/* Switch back to Application / Certificate ID + OTP */}
              <div className="login-footer-switch">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('otp');
                    setErrorMsg('');
                    setInfoNotice('');
                  }}
                  className="secondary-toggle-btn"
                >
                  🛡️ {isKn ? 'ಅರ್ಜಿ / ಪ್ರಮಾಣಪತ್ರ ಮತ್ತು OTP ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ (Application / Certificate & OTP Login)' : 'Return to Application / Certificate & OTP Login'}
                </button>
              </div>
            </>
          )}

          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <Link to="/" style={{ color: 'var(--secondary-text)', textDecoration: 'none', fontSize: '0.85rem' }}>
              {isKn ? '← ಸಹಾಯಕ ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ (Back to Assistant Home)' : '← Back to Assistant Home'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;
