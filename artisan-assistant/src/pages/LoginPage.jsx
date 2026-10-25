import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import LanguageSelector from '../components/LanguageSelector.jsx';

function LoginPage() {
  const navigate = useNavigate();
  const { user, artisan, signIn, signUp } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState('');

  if (user) {
    return (
      <div style={{ maxWidth: '440px', margin: '2rem auto', padding: '1.5rem', textAlign: 'center', fontFamily: 'inherit' }}>
        <h2 style={{ color: '#075E54' }}>✅ Authenticated</h2>
        <p>Signed in as <strong>{user.email}</strong></p>
        <p>Artisan Shop: <strong>{artisan?.business_name || 'Artisan Account'}</strong></p>
        <p>Verification Status: <strong>{artisan?.verification_status || 'Pending'}</strong></p>
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/')}
            style={{ padding: '0.75rem', background: '#075E54', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            Go to Assistant Home
          </button>
          <button
            onClick={() => navigate('/my-products')}
            style={{ padding: '0.75rem', background: '#128C7E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            My Products Catalog
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessNotice('');
    setLoading(true);

    try {
      if (isRegistering) {
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        const { error } = await signUp(email.trim(), password, {
          full_name: fullName.trim(),
          role: 'artisan',
          business_name: businessName.trim() || fullName.trim(),
          location: location.trim() || 'India',
          phone: phone.trim() || ''
        });
        if (error) throw error;
        setSuccessNotice('Account created! Logging in...');
        setTimeout(() => navigate('/'), 1200);
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
        navigate('/');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '1rem auto', padding: '1.5rem', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.35rem', margin: 0, color: '#075E54' }}>
          {isRegistering ? 'Artisan Registration' : 'Artisan Sign In'}
        </h1>
        <LanguageSelector />
      </div>

      {errorMsg && (
        <div style={{ padding: '0.75rem', background: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {errorMsg}
        </div>
      )}

      {successNotice && (
        <div style={{ padding: '0.75rem', background: '#e8f5e9', color: '#2e7d32', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {successNotice}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {isRegistering && (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Full Name:
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                required
                style={{ padding: '0.65rem', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Craft / Studio Business Name:
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Kumar Woodcrafts"
                style={{ padding: '0.65rem', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Location / City:
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Varanasi, UP"
                style={{ padding: '0.65rem', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Mobile Phone Number:
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                style={{ padding: '0.65rem', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </label>
          </>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem', fontWeight: 500 }}>
          Email Address:
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="artisan@example.com"
            required
            style={{ padding: '0.65rem', border: '1px solid #ccc', borderRadius: '6px' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem', fontWeight: 500 }}>
          Password:
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            style={{ padding: '0.65rem', border: '1px solid #ccc', borderRadius: '6px' }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '0.75rem',
            padding: '0.85rem',
            background: '#075E54',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Processing...' : (isRegistering ? 'Register as Artisan' : 'Sign In')}
        </button>
      </form>

      <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.9rem' }}>
        {isRegistering ? (
          <span>
            Already have an artisan account?{' '}
            <button
              onClick={() => { setIsRegistering(false); setErrorMsg(''); }}
              style={{ background: 'none', border: 'none', color: '#128C7E', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Sign In
            </button>
          </span>
        ) : (
          <span>
            New artisan?{' '}
            <button
              onClick={() => { setIsRegistering(true); setErrorMsg(''); }}
              style={{ background: 'none', border: 'none', color: '#128C7E', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Create an account
            </button>
          </span>
        )}
      </div>

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <Link to="/" style={{ color: '#666', textDecoration: 'none', fontSize: '0.85rem' }}>
          ← Back to Assistant Home
        </Link>
      </div>
    </div>
  );
}

export default LoginPage;
