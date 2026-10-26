import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
import LanguageSelector from '../components/LanguageSelector.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

function LoginPage() {
  const navigate = useNavigate();
  const { user, artisan, signIn, signUp } = useAuth();

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
            <h1 className="login-title">Artisan Connect AI</h1>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <ThemeToggle />
              <LanguageSelector />
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
          governmentId: cleanId
        }
      });

      if (error) throw error;
      if (!data || !data.success) {
        throw new Error(data?.error || 'OTP request failed. Please check the government ID.');
      }

      setChallengeId(data.challengeId);
      setMaskedPhone(data.maskedPhone || '••••••••••');
      setOtpStage('verify');
      setResendCountdown(60);
      setInfoNotice(
        `OTP ಅನ್ನು ನಿಮ್ಮ ನೋಂದಾಯಿತ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಗೆ (${data.maskedPhone || 'registered phone'}) ಕಳುಹಿಸಲಾಗಿದೆ.`
      );
    } catch (err) {
      console.warn('OTP request notice:', err);
      // Fallback explanation if Edge Function is not yet deployed or registry unpopulated
      if (err.message?.includes('not found') || err.message?.includes('registry')) {
        setErrorMsg(
          '⚠️ ಈ ನೋಂದಣಿ ಸಂಖ್ಯೆಯು ಕುಶಲಕರ್ಮಿಗಳ ಪಟ್ಟಿಯಲ್ಲಿ ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ನೋಂದಣಿ ಸಂಖ್ಯೆಯನ್ನು ಪರಿಶೀಲಿಸಿ ಅಥವಾ ಕೆಳಗೆ ಇಮೇಲ್ ಮೂಲಕ ಲಾಗಿನ್ ಮಾಡಿ (ID not in approved registry).'
        );
      } else {
        setErrorMsg(err.message || 'OTP ಕೋರಿಕೆಯು ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ನಂತರ ಪ್ರಯತ್ನಿಸಿ.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Stage 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoNotice('');

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setErrorMsg('ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ 6-ಅಂಕಿಯ OTP ನಮೂದಿಸಿ (Please enter 6-digit OTP).');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('artisan-otp', {
        body: {
          action: 'verify-otp',
          challengeId,
          otp: cleanOtp
        }
      });

      if (error) throw error;
      if (!data || !data.success) {
        throw new Error(data?.error || 'Invalid or expired OTP. Please try again.');
      }

      setInfoNotice('✅ ಗುರುತಿಸುವಿಕೆ ಯಶಸ್ವಿಯಾಗಿದೆ! ಸೈನ್ ಇನ್ ಮಾಡಲಾಗುತ್ತಿದೆ (Verified! Signing in)...');
      setTimeout(() => navigate('/'), 1000);
    } catch (err) {
      console.warn('OTP verify error:', err);
      setErrorMsg(err.message || 'OTP ಪರಿಶೀಲನೆ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸರಿಯಾದ OTP ನಮೂದಿಸಿ.');
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
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
        navigate('/');
      }
    } catch (err) {
      console.error('Password auth error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card-container">
      <div className="login-card">
        {/* Top Header */}
        <div className="login-header-bar">
          <div className="login-brand">
            <span className="login-logo-icon">🇮🇳</span>
            <div>
              <h1 className="login-title">Artisan Connect AI</h1>
              <p className="login-subtitle">
                {authMethod === 'otp'
                  ? 'ಸರ್ಕಾರಿ ಗುರುತಿನ ಚೀಟಿ / ಕುಶಲಕರ್ಮಿ ಲಾಗಿನ್'
                  : 'ಸಿಬ್ಬಂದಿ / ಇಮೇಲ್ ಲಾಗಿನ್'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <ThemeToggle />
            <LanguageSelector />
          </div>
        </div>

        {/* Status Notices */}
        {errorMsg && (
          <div className="login-alert error" role="alert">
            {errorMsg}
          </div>
        )}

        {infoNotice && (
          <div className="login-alert info" role="status">
            {infoNotice}
          </div>
        )}

        {/* PRIMARY FLOW: Government ID + OTP Flow */}
        {authMethod === 'otp' && (
          <>
            {otpStage === 'request' ? (
              <form onSubmit={handleRequestOtp} className="login-form">
                <div className="form-info-banner">
                  <span style={{ fontSize: '1.25rem' }}>🛡️</span>
                  <div>
                    <strong>ಅಧಿಕೃತ ಕುಶಲಕರ್ಮಿ ನೋಂದಣಿ ID ಲಾಗಿನ್</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--secondary-text)', marginTop: '0.2rem' }}>
                      Pehchan ID, MSME Udyam, ಅಥವಾ ರಾಜ್ಯ ಕುಶಲಕರ್ಮಿ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ OTP ಪಡೆಯಿರಿ.
                    </div>
                  </div>
                </div>

                <label className="form-field-label">
                  ಕುಶಲಕರ್ಮಿ ನೋಂದಣಿ ಸಂಖ್ಯೆ (Government Artisan ID):
                  <input
                    type="text"
                    value={governmentId}
                    onChange={(e) => setGovernmentId(e.target.value)}
                    placeholder="ಉದಾ: IND-ART-1001 ಅಥವಾ UDYAM-..."
                    required
                    disabled={loading}
                    className="login-input"
                    autoFocus
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading || !governmentId.trim()}
                  className="btn-primary-mobile login-submit-btn"
                >
                  {loading ? 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...' : '📲 OTP ಕಳುಹಿಸಿ (Request OTP)'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="login-form">
                <div className="form-info-banner">
                  <span style={{ fontSize: '1.25rem' }}>📱</span>
                  <div>
                    <strong>OTP ಪರಿಶೀಲನೆ (Verify OTP)</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--secondary-text)', marginTop: '0.2rem' }}>
                      ನೋಂದಾಯಿತ ಸಂಖ್ಯೆಗೆ ಕಳುಹಿಸಲಾದ 6-ಅಂಕಿಯ ಕೋಡ್ ನಮೂದಿಸಿ: {maskedPhone}
                    </div>
                  </div>
                </div>

                <label className="form-field-label">
                  6-ಅಂಕಿಯ OTP (Enter 6-digit OTP):
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

                <button
                  type="submit"
                  disabled={loading || otp.length < 4}
                  className="btn-primary-mobile login-submit-btn"
                >
                  {loading ? 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...' : '✅ ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಸೈನ್ ಇನ್ ಮಾಡಿ (Verify & Sign In)'}
                </button>

                <div className="otp-actions-row">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStage('request');
                      setOtp('');
                      setErrorMsg('');
                    }}
                    className="link-btn"
                  >
                    ← ನೋಂದಣಿ ID ಬದಲಾಯಿಸಿ (Change ID)
                  </button>

                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={resendCountdown > 0 || loading}
                    className="link-btn"
                  >
                    {resendCountdown > 0
                      ? `ಮರುಕಳುಹಿಸಿ (${resendCountdown}s)`
                      : '🔄 OTP ಮರುಕಳುಹಿಸಿ (Resend OTP)'}
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
                ⚙️ ಸಿಬ್ಬಂದಿ / ಇಮೇಲ್ ಮೂಲಕ ಸೈನ್ ಇನ್ (Staff / Email & Password Login)
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
                  <strong>{isRegistering ? 'ಹೊಸ ಖಾತೆ ರಚಿಸಿ' : 'ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ಸೈನ್ ಇನ್'}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--secondary-text)', marginTop: '0.2rem' }}>
                    ಅಸ್ತಿತ್ವದಲ್ಲಿರುವ ಖಾತೆಗಳು ಮತ್ತು ನಿರ್ವಾಹಕರಿಗೆ (Existing accounts & Admin).
                  </div>
                </div>
              </div>

              {isRegistering && (
                <>
                  <label className="form-field-label">
                    ಪೂರ್ಣ ಹೆಸರು (Full Name):
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
                    ಕಲೆ / ಕಾರ್ಯಾಗಾರದ ಹೆಸರು (Business Name):
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Kaveri Handicrafts"
                      className="login-input"
                    />
                  </label>

                  <label className="form-field-label">
                    ಸ್ಥಳ / ನಗರ (Location):
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Channapatna, Karnataka"
                      className="login-input"
                    />
                  </label>

                  <label className="form-field-label">
                    ಮೊಬೈಲ್ ಸಂಖ್ಯೆ (Phone Number):
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
                ಇಮೇಲ್ ವಿಳಾಸ (Email Address):
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="artisan@example.com"
                  required
                  className="login-input"
                />
              </label>

              <label className="form-field-label">
                ಪಾಸ್‌ವರ್ಡ್ (Password):
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
                  ? 'ಸಂಸ್ಕರಿಸಲಾಗುತ್ತಿದೆ...'
                  : isRegistering
                  ? 'ಖಾತೆ ತೆರೆಯಿರಿ (Register)'
                  : 'ಸೈನ್ ಇನ್ (Sign In)'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '0.88rem', marginTop: '0.5rem' }}>
                {isRegistering ? (
                  <span>
                    ಖಾತೆ ಈಗಾಗಲೇ ಇದೆಯೇ?{' '}
                    <button
                      type="button"
                      onClick={() => { setIsRegistering(false); setErrorMsg(''); }}
                      className="link-btn"
                    >
                      ಸೈನ್ ಇನ್ ಮಾಡಿ (Sign In)
                    </button>
                  </span>
                ) : (
                  <span>
                    ಹೊಸ ಬಳಕೆದಾರರೇ?{' '}
                    <button
                      type="button"
                      onClick={() => { setIsRegistering(true); setErrorMsg(''); }}
                      className="link-btn"
                    >
                      ಖಾತೆ ತೆರೆಯಿರಿ (Create Account)
                    </button>
                  </span>
                )}
              </div>
            </form>

            {/* Switch back to Government ID + OTP */}
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
                🛡️ ಅಧಿಕೃತ ಕುಶಲಕರ್ಮಿ ID ಮತ್ತು OTP ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ (Government ID & OTP Login)
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <Link to="/" style={{ color: 'var(--secondary-text)', textDecoration: 'none', fontSize: '0.85rem' }}>
            ← ಸಹಾಯಕ ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ (Back to Assistant Home)
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
