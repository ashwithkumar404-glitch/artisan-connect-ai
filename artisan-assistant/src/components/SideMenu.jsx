import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

function SideMenu({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { user, artisan, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    onClose();
    navigate('/login');
  };

  return (
    <aside className={`side-drawer ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
      <button className="close-drawer" aria-label="Close menu" onClick={onClose}>✕</button>

      {/* User profile badge */}
      <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid #e0e0e0', marginBottom: '0.5rem' }}>
        {user ? (
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#075E54', fontSize: '0.95rem' }}>
              {artisan?.business_name || 'Artisan Account'}
            </p>
            <p style={{ margin: '0.2rem 0', color: '#666', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email}
            </p>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: artisan?.verification_status === 'approved' ? '#e8f5e9' : '#fff3e0', color: artisan?.verification_status === 'approved' ? '#2e7d32' : '#e65100', fontWeight: 600 }}>
              {artisan?.verification_status === 'approved' ? 'VERIFIED' : 'PENDING APPROVAL'}
            </span>
          </div>
        ) : (
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Welcome, Artisan!</p>
            <Link
              to="/login"
              onClick={onClose}
              style={{ display: 'inline-block', marginTop: '0.4rem', color: '#075E54', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}
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
              background: '#ffebee',
              color: '#c62828',
              border: '1px solid #ffcdd2',
              padding: '0.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            Sign Out
          </button>
        ) : (
          <Link
            to="/login"
            onClick={onClose}
            className="drawer-link"
            style={{ color: '#075E54', fontWeight: 600, marginTop: '1rem' }}
          >
            🔑 Sign In
          </Link>
        )}
      </nav>
    </aside>
  );
}

export default SideMenu;
