import { useState, useEffect } from 'react';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('artisan_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('artisan_theme', theme);
  }, [theme]);

  // Synchronize theme across multiple instances or tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'artisan_theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue);
      }
    };
    const handleCustomChange = (e) => {
      if (e.detail && (e.detail === 'light' || e.detail === 'dark')) {
        setTheme(e.detail);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('artisan-theme-change', handleCustomChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('artisan-theme-change', handleCustomChange);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      window.dispatchEvent(new CustomEvent('artisan-theme-change', { detail: next }));
      return next;
    });
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle-btn"
      aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
      title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
      style={{
        background: 'transparent',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.4))',
        borderRadius: '50%',
        width: '36px',
        height: '36px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '1.1rem',
        color: 'var(--header-text, var(--text, #ffffff))',
        padding: 0,
        touchAction: 'manipulation',
        transition: 'transform 0.15s ease, background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}

export default ThemeToggle;
