import React from 'react';
import { Link } from "react-router-dom";

function QuickActions() {
  const actions = [
    { label: 'Add New Product', to: '/add-product' },
    { label: 'View My Products', to: '/my-products' },
    { label: 'My Orders', to: '/my-orders' },
    { label: 'My Earnings', to: '/my-earnings' },
    { label: 'Performance', to: '/product-performance' },
    { label: 'Customer Reviews', to: '/customer-feedback' },
    { label: 'WhatsApp Channel', to: '/whatsapp' },
  ];
  return (
    <div className="quick-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
      {actions.map((a, i) => (
        a.disabled ? (
          <button key={i} disabled style={{ background: '#E7F5EC', color: '#6B7280', border: '1px solid #064E3B', borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'not-allowed' }}>{a.label}</button>
        ) : (
          <Link key={i} to={a.to} className="quick-action-button" style={{ background: '#075E46', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', textDecoration: 'none' }}>{a.label}</Link>
        )
      ))}
    </div>
  );
}

export default QuickActions;
