import React, { useState, useEffect } from 'react';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('marketplace_theme') || localStorage.getItem('artisan_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('marketplace_theme', theme);
    localStorage.setItem('artisan_theme', theme);
  }, [theme]);

  // Synchronize theme across multiple instances or tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if ((e.key === 'marketplace_theme' || e.key === 'artisan_theme') && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue);
      }
    };
    const handleCustomChange = (e) => {
      if (e.detail && (e.detail === 'light' || e.detail === 'dark')) {
        setTheme(e.detail);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('marketplace-theme-change', handleCustomChange);
    window.addEventListener('artisan-theme-change', handleCustomChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('marketplace-theme-change', handleCustomChange);
      window.removeEventListener('artisan-theme-change', handleCustomChange);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      window.dispatchEvent(new CustomEvent('marketplace-theme-change', { detail: next }));
      window.dispatchEvent(new CustomEvent('artisan-theme-change', { detail: next }));
      return next;
    });
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-base focus:outline-none focus:ring-2 focus:ring-gov-navy dark:focus:ring-gov-saffron ${className}`}
      aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
      title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
    >
      <span aria-hidden="true">{theme === 'light' ? '🌙' : '☀️'}</span>
    </button>
  );
}
