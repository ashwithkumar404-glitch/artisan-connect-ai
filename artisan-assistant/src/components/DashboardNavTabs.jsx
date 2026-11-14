import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

export default function DashboardNavTabs() {
  const location = useLocation();
  const { artisan } = useAuth();
  const [unreadEnquiries, setUnreadEnquiries] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);

  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('artisan_language') || 'kn';
    } catch {
      return 'kn';
    }
  });

  useEffect(() => {
    const handleLangChange = (e) => {
      if (e.detail && (e.detail === 'kn' || e.detail === 'en')) {
        setLanguage(e.detail);
      }
    };
    window.addEventListener('artisan-language-change', handleLangChange);
    return () => window.removeEventListener('artisan-language-change', handleLangChange);
  }, []);

  const isKn = language === 'kn';

  // Load badge counters
  useEffect(() => {
    let isMounted = true;
    if (!artisan?.id) return;

    async function loadCounters() {
      try {
        // Unread/actionable enquiries count
        const { count: enqCount, error: enqErr } = await supabase
          .from('enquiries')
          .select('id', { count: 'exact', head: true })
          .eq('artisan_id', artisan.id)
          .in('status', ['pending', 'negotiation_ongoing', 'offer_accepted']);

        if (!enqErr && enqCount !== null && isMounted) {
          setUnreadEnquiries(enqCount);
        }

        // Active orders count
        const { count: ordCount, error: ordErr } = await supabase
          .from('order_items')
          .select('id', { count: 'exact', head: true })
          .eq('artisan_id', artisan.id);

        if (!ordErr && ordCount !== null && isMounted) {
          setPendingOrders(ordCount);
        }
      } catch (err) {
        console.warn('Counters load warning:', err);
      }
    }

    loadCounters();
    return () => {
      isMounted = false;
    };
  }, [artisan?.id]);

  const tabs = [
    {
      id: 'chats',
      path: '/',
      icon: '💬',
      labelKn: 'ಚಾಟ್‌ಗಳು',
      labelEn: 'Chats',
      match: (p) => p === '/' || p === '/assistant'
    },
    {
      id: 'inquiries',
      path: '/whatsapp?action=check_enquiries',
      icon: '📩',
      labelKn: 'ವಿಚಾರಣೆಗಳು',
      labelEn: 'Inquiries',
      badge: unreadEnquiries > 0 ? unreadEnquiries : null,
      match: (p, s) => p === '/whatsapp' && (s.includes('check_enquiries') || s.includes('enquiryId'))
    },
    {
      id: 'orders',
      path: '/my-orders',
      icon: '📦',
      labelKn: 'ಆರ್ಡರ್‌ಗಳು',
      labelEn: 'Orders',
      badge: pendingOrders > 0 ? pendingOrders : null,
      match: (p) => p === '/my-orders' && !location.search.includes('tab=delivery')
    },
    {
      id: 'products',
      path: '/my-products',
      icon: '🏺',
      labelKn: 'ಉತ್ಪನ್ನಗಳು',
      labelEn: 'Products',
      match: (p) => p === '/my-products' || p === '/add-product'
    },
    {
      id: 'delivery',
      path: '/my-orders?tab=delivery',
      icon: '🚚',
      labelKn: 'ವಿತರಣೆ',
      labelEn: 'Delivery',
      match: (p) => p === '/my-orders' && location.search.includes('tab=delivery')
    },
    {
      id: 'reviews',
      path: '/customer-feedback',
      icon: '⭐',
      labelKn: 'ವಿಮರ್ಶೆಗಳು',
      labelEn: 'Reviews',
      match: (p) => p === '/customer-feedback' || p === '/reviews'
    },
    {
      id: 'insights',
      path: '/product-performance',
      icon: '📈',
      labelKn: 'ಒಳನೋಟಗಳು',
      labelEn: 'Insights',
      match: (p) => p === '/product-performance' || p === '/performance' || p === '/my-earnings'
    },
    {
      id: 'profile',
      path: '/login',
      icon: '👤',
      labelKn: 'ಪ್ರೊಫೈಲ್',
      labelEn: 'Profile',
      match: (p) => p === '/login' || p === '/register'
    }
  ];

  return (
    <nav
      className="dashboard-hub-tabs"
      aria-label="Artisan Hub Navigation"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '0.45rem 0.65rem',
        background: 'var(--header-bg, #064e3b)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        flexShrink: 0
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.match(location.pathname, location.search);
        return (
          <Link
            key={tab.id}
            to={tab.path}
            className={`dashboard-hub-tab-link ${isActive ? 'active' : ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '20px',
              textDecoration: 'none',
              fontSize: '0.78rem',
              fontWeight: isActive ? 700 : 500,
              whiteSpace: 'nowrap',
              color: isActive ? '#064e3b' : 'rgba(255, 255, 255, 0.88)',
              backgroundColor: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.12)',
              border: isActive ? '1px solid #ffffff' : '1px solid transparent',
              transition: 'all 0.15s ease',
              touchAction: 'manipulation',
              position: 'relative'
            }}
          >
            <span aria-hidden="true" style={{ fontSize: '0.9rem' }}>{tab.icon}</span>
            <span>{isKn ? tab.labelKn : tab.labelEn}</span>
            {tab.badge && (
              <span
                style={{
                  backgroundColor: '#ea580c',
                  color: '#ffffff',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '0.1rem 0.35rem',
                  borderRadius: '10px',
                  lineHeight: 1
                }}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
