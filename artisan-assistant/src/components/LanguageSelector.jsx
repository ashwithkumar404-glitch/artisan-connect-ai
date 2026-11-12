import { useEffect, useState } from 'react';

function getInitialLanguage(fallback = 'kn') {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem('artisan_language');
    if (saved === 'kn' || saved === 'en') return saved;
  } catch {
    // ignore
  }
  return fallback;
}

function LanguageSelector({ selectedLanguage, onLanguageChange }) {
  const [internalLang, setInternalLang] = useState(getInitialLanguage);
  const currentLang = selectedLanguage || internalLang;

  useEffect(() => {
    const handleLangChange = (e) => {
      if (e.detail && (e.detail === 'kn' || e.detail === 'en')) {
        setInternalLang(e.detail);
      }
    };
    const handleStorage = (e) => {
      if (e.key === 'artisan_language' && (e.newValue === 'kn' || e.newValue === 'en')) {
        setInternalLang(e.newValue);
      }
    };
    window.addEventListener('artisan-language-change', handleLangChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('artisan-language-change', handleLangChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const isKn = currentLang === 'kn';

  const handleSelect = (e) => {
    const newLang = e.target.value;
    setInternalLang(newLang);
    try {
      localStorage.setItem('artisan_language', newLang);
      window.dispatchEvent(new CustomEvent('artisan-language-change', { detail: newLang }));
    } catch {
      // ignore
    }
    if (onLanguageChange) {
      onLanguageChange(newLang);
    }
  };

  const handleOpenMarketplace = () => {
    const marketplaceUrl = import.meta.env.VITE_MARKETPLACE_URL;
    if (marketplaceUrl && marketplaceUrl.trim()) {
      let targetUrl = marketplaceUrl.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert(
        isKn
          ? 'ಗ್ರಾಹಕ ಮಾರುಕಟ್ಟೆ ವೆಬ್‌ಸೈಟ್ ವಿಳಾಸ ಕಾನ್ಫಿಗರ್ ಆಗಿಲ್ಲ (VITE_MARKETPLACE_URL ಅಗತ್ಯವಿದೆ).'
          : 'Customer Marketplace URL is not configured. Please set VITE_MARKETPLACE_URL in your Vercel or environment settings.'
      );
    }
  };

  return (
    <div className="language-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
      <button
        type="button"
        onClick={handleOpenMarketplace}
        className="btn-marketplace-globe"
        aria-label="Open Customer Marketplace"
        title={isKn ? "ಗ್ರಾಹಕ ಮಾರುಕಟ್ಟೆ ವೀಕ್ಷಿಸಿ (Marketplace)" : "View Customer Marketplace"}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.15rem',
          padding: '0.2rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        🌐
      </button>
      <select
        id="lang-select"
        aria-label="Select Assistant Language"
        value={currentLang}
        onChange={handleSelect}
        style={{
          padding: '0.3rem 0.5rem',
          fontSize: '0.85rem',
          fontWeight: 600,
          background: 'var(--input-bg, #ffffff)',
          color: 'var(--primary-green, #075E54)',
          border: '1px solid var(--border, #128C7E)',
          borderRadius: '16px',
          cursor: 'pointer',
          outline: 'none'
        }}
      >
        <option value="kn">ಕನ್ನಡ (Kannada)</option>
        <option value="en">English</option>
      </select>
    </div>
  );
}

export default LanguageSelector;
