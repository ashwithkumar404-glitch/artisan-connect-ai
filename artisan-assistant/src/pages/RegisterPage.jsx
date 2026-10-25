import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LanguageSelector from '../components/LanguageSelector.jsx';

// Mock data – in real implementation this would be fetched from Supabase
const mockArtisanProfiles = {
  'A12345': {
    name: 'Ravi Kumar',
    craft: 'Woodworking',
    location: 'Bangalore',
    language: 'en',
  },
  'B98765': {
    name: 'Lakshmi Devi',
    craft: 'Pottery',
    location: 'Mysore',
    language: 'kn',
  },
};

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('enter'); // enter | otp | preview | done
  const [artisanId, setArtisanId] = useState('');
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [profile, setProfile] = useState(null);

  // ----- Helpers (demo only) -----
  const lookupArtisan = async (id) => {
    // In production, call a Supabase function to fetch the artisan record.
    return mockArtisanProfiles[id] || null;
  };

  const sendOtp = async () => {
    // In production, trigger Supabase Auth SMS/Email OTP.
    // Demo: always succeed and OTP is fixed "123456".
    return true;
  };

  const verifyOtp = (input) => {
    // Demo only – compare to constant.
    return input === '123456';
  };

  // ----- Handlers -----
  const handleEnterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const data = await lookupArtisan(artisanId.trim());
    if (!data) {
      setError('Artisan ID not found. Please check the code and try again.');
      return;
    }
    const sent = await sendOtp(artisanId);
    if (!sent) {
      setError('Failed to send OTP. Please try again later.');
      return;
    }
    setProfile(data);
    setStep('otp');
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (verifyOtp(otp.trim())) {
      setStep('preview');
    } else {
      setError('Invalid OTP. Please check the code you received.');
    }
  };

  const handleConfirm = () => {
    // In a real flow we would create a Supabase Auth user and link it.
    setStep('done');
    // For demo we simply navigate back to home after a short delay.
    setTimeout(() => navigate('/'), 3000);
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2rem' }}>
      <h1>Artisan Registration</h1>
      <LanguageSelector />
      {step === 'enter' && (
        <form onSubmit={handleEnterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label>
            Government Artisan ID or Registration Code:
            <input
              type="text"
              value={artisanId}
              onChange={(e) => setArtisanId(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </label>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button type="submit" style={{ padding: '0.8rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px' }}>
            Continue
          </button>
        </form>
      )}
      {step === 'otp' && (
        <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p>Enter the OTP sent to your registered contact (demo OTP: <strong>123456</strong>).</p>
          <label>
            OTP:
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </label>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button type="submit" style={{ padding: '0.8rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px' }}>
            Verify OTP
          </button>
        </form>
      )}
      {step === 'preview' && profile && (
        <div>
          <h2>Profile Preview (Demo)</h2>
          <p><strong>Name:</strong> {profile.name}</p>
          <p><strong>Craft:</strong> {profile.craft}</p>
          <p><strong>Location:</strong> {profile.location}</p>
          <p><strong>Preferred language:</strong> {profile.language === 'en' ? 'English' : 'Kannada'}</p>
          <button onClick={handleConfirm} style={{ padding: '0.8rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px' }}>
            Confirm & Link Account
          </button>
        </div>
      )}
      {step === 'done' && (
        <div>
          <h2>✅ Registration Complete</h2>
          <p>Your artisan profile has been linked to a new account (demo only). You will be redirected to Home.</p>
        </div>
      )}
    </div>
  );
}

export default RegisterPage;
