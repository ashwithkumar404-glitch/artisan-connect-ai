import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import ThemeToggle from './ThemeToggle.jsx';

function SideMenu({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { user, profile, artisan, signOut } = useAuth();

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Artisan Profile"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1.5px solid var(--primary-green)',
                    flexShrink: 0
                  }}
                />
              ) : (
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'var(--light-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  flexShrink: 0
                }}>
                  🏺
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--primary-green)', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {artisan?.business_name || profile?.full_name || 'Artisan Workshop'}
                </p>
                <p style={{ margin: '0.15rem 0', color: 'var(--secondary-text)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '0.12rem 0.35rem',
                    borderRadius: '4px',
                    background: artisan?.verification_status === 'approved' ? 'var(--light-green)' : 'rgba(230, 81, 0, 0.15)',
                    color: artisan?.verification_status === 'approved' ? 'var(--primary-green)' : '#e65100',
                    fontWeight: 600
                  }}>
                    {artisan?.verification_status === 'approved' ? '✓ VERIFIED' : 'PENDING'}
                  </span>
                  {artisan?.specialization && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)' }}>
                      • {artisan.specialization}
                    </span>
                  )}
                </div>
              </div>
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
          <Link className="drawer-link" to="/my-orders" onClick={onClose}>📋 My Orders</Link>
          <Link className="drawer-link" to="/my-earnings" onClick={onClose}>💰 My Earnings</Link>
          <Link className="drawer-link" to="/product-performance" onClick={onClose}>📈 Product Performance</Link>
          <Link className="drawer-link" to="/customer-feedback" onClick={onClose}>⭐ Customer Reviews</Link>
          <Link className="drawer-link" to="/whatsapp" onClick={onClose}>📱 WhatsApp Channel</Link>

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
