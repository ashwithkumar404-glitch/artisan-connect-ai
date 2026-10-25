function LanguageSelector({ selectedLanguage = 'kn', onLanguageChange }) {
  return (
    <div className="language-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
      <span role="img" aria-label="Language" style={{ fontSize: '1rem' }}>🌐</span>
      <select
        id="lang-select"
        aria-label="Select Assistant Language"
        value={selectedLanguage}
        onChange={(e) => onLanguageChange && onLanguageChange(e.target.value)}
        style={{
          padding: '0.3rem 0.5rem',
          fontSize: '0.85rem',
          fontWeight: 600,
          background: '#ffffff',
          color: '#075E54',
          border: '1px solid #128C7E',
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
