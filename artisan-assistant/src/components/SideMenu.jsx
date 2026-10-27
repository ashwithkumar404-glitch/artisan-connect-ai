import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import ThemeToggle from './ThemeToggle.jsx';

function SideMenu({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { user, artisan, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    onClose();
    navigate('/login');
  };

  return (
    <>
      {isOpen && <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={`side-drawer ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <ThemeToggle />
          <button className="close-drawer" aria-label="Close menu" onClick={onClose} style={{ color: 'var(--secondary-text)' }}>✕</button>
        </div>

        {/* User profile badge */}
        <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)', marginBottom: '0.5rem' }}>
          {user ? (
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--primary-green)', fontSize: '0.95rem' }}>
                {artisan?.business_name || 'Artisan Account'}
              </p>
              <p style={{ margin: '0.2rem 0', color: 'var(--secondary-text)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </p>
              <span style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.4rem',
                borderRadius: '4px',
                background: artisan?.verification_status === 'approved' ? 'var(--light-green)' : 'rgba(230, 81, 0, 0.15)',
                color: artisan?.verification_status === 'approved' ? 'var(--primary-green)' : '#e65100',
                fontWeight: 600
              }}>
                {artisan?.verification_status === 'approved' ? 'VERIFIED' : 'PENDING APPROVAL'}
              </span>
            </div>
          ) : (
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>Welcome, Artisan!</p>
              <Link
                to="/login"
                onClick={onClose}
                style={{ display: 'inline-block', marginTop: '0.4rem', color: 'var(--primary-green)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}
              >
                Sign In / Register →
              </Link>
            </div>
          )}
        </div>

        <nav className="drawer-nav">
          <Link className="drawer-link" to="/" onClick={onClose}>💬 Assistant Chat</Link>
          <Link className="drawer-link" to="/my-products" onClick={onClose}>📦 My Products Catalog</Link>
          <Link className="drawer-link" to="/add-product" onClick={onClose}>➕ Add Product Form</Link>

          {user ? (
            <button
              onClick={handleSignOut}
              style={{
                marginTop: '1.5rem',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                padding: '0.65rem',
                minHeight: '44px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation'
              }}
            >
              Sign Out
            </button>
          ) : (
            <Link
              to="/login"
              onClick={onClose}
              className="drawer-link"
              style={{ color: 'var(--primary-green)', fontWeight: 600, marginTop: '1rem' }}
            >
              🔑 Sign In
            </Link>
          )}
        </nav>
      </aside>
    </>
  );
}

export default SideMenu;
