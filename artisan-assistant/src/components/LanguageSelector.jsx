function LanguageSelector({ selectedLanguage = 'kn', onLanguageChange }) {
  const isKn = selectedLanguage === 'kn';

  const handleOpenMarketplace = () => {
    const marketplaceUrl = import.meta.env.VITE_MARKETPLACE_URL;
    if (marketplaceUrl && marketplaceUrl.trim()) {
      window.open(marketplaceUrl.trim(), '_blank', 'noopener,noreferrer');
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
        value={selectedLanguage}
        onChange={(e) => onLanguageChange && onLanguageChange(e.target.value)}
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
