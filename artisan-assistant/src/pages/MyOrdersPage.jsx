import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import ThemeToggle from '../components/ThemeToggle.jsx';

const STATUS_CONFIG = {
  placed: {
    labelKn: 'ಸ್ವೀಕರಿಸಲಾಗಿದೆ',
    labelEn: 'Placed',
    bg: 'rgba(59, 130, 246, 0.12)',
    color: '#2563EB',
    border: 'rgba(59, 130, 246, 0.3)'
  },
  confirmed: {
    labelKn: 'ದೃಢೀಕರಿಸಲಾಗಿದೆ',
    labelEn: 'Confirmed',
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#D97706',
    border: 'rgba(245, 158, 11, 0.3)'
  },
  preparing: {
    labelKn: 'ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ',
    labelEn: 'Preparing',
    bg: 'rgba(234, 88, 12, 0.12)',
    color: '#EA580C',
    border: 'rgba(234, 88, 12, 0.3)'
  },
  shipped: {
    labelKn: 'ರವಾನಿಸಲಾಗಿದೆ',
    labelEn: 'Shipped',
    bg: 'rgba(124, 58, 237, 0.12)',
    color: '#7C3AED',
    border: 'rgba(124, 58, 237, 0.3)'
  },
  out_for_delivery: {
    labelKn: 'ವಿತರಣೆಗೆ ಹೊರಟಿದೆ',
    labelEn: 'Out for Delivery',
    bg: 'rgba(6, 182, 212, 0.12)',
    color: '#0891B2',
    border: 'rgba(6, 182, 212, 0.3)'
  },
  delivered: {
    labelKn: 'ತಲುಪಿಸಲಾಗಿದೆ',
    labelEn: 'Delivered',
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#059669',
    border: 'rgba(16, 185, 129, 0.3)'
  },
  cancelled: {
    labelKn: 'ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ',
    labelEn: 'Cancelled',
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#DC2626',
    border: 'rgba(239, 68, 68, 0.3)'
  }
};

function MyOrdersPage() {
  const navigate = useNavigate();
  const { user, artisan, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusActionId, setStatusActionId] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'active' | 'delivered' | 'cancelled'
  const [language, setLanguage] = useState(() => localStorage.getItem('artisan_language') || 'kn');

  useEffect(() => {
    const handleLangChange = (e) => {
      setLanguage(e.detail?.language || localStorage.getItem('artisan_language') || 'kn');
    };
    window.addEventListener('artisan-language-change', handleLangChange);
    return () => window.removeEventListener('artisan-language-change', handleLangChange);
  }, []);

  const isKn = language === 'kn';

  const fetchArtisanOrders = useCallback(async () => {
    if (!artisan?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      // 1. Fetch order items scoped strictly to this authenticated artisan
      const { data: rawItems, error: itemsErr } = await supabase
        .from('order_items')
        .select('id, order_id, product_id, artisan_id, quantity, unit_price, subtotal')
        .eq('artisan_id', artisan.id);

      if (itemsErr) throw itemsErr;

      if (!rawItems || rawItems.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const orderIds = [...new Set(rawItems.map((i) => i.order_id))];
      const productIds = [...new Set(rawItems.map((i) => i.product_id))];

      // 2. Fetch corresponding orders (RLS enforces is_artisan_order)
      // Exclude customer personal phone/full address to protect buyer privacy
      const [ordersRes, prodsRes, imgsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, customer_id, status, created_at, updated_at, shipping_name, shipping_city, shipping_state')
          .in('id', orderIds),
        supabase
          .from('products')
          .select('id, name, local_title')
          .in('id', productIds),
        supabase
          .from('product_images')
          .select('product_id, image_url')
          .in('product_id', productIds)
      ]);

      if (ordersRes.error) throw ordersRes.error;

      const ordersMap = new Map((ordersRes.data || []).map((o) => [o.id, o]));
      const prodsMap = new Map((prodsRes.data || []).map((p) => [p.id, p]));
      const imgsMap = new Map();
      (imgsRes.data || []).forEach((img) => {
        if (!imgsMap.has(img.product_id)) {
          imgsMap.set(img.product_id, img.image_url);
        }
      });

      // 3. Group order items by order_id
      const groupedOrders = new Map();
      for (const item of rawItems) {
        const orderMeta = ordersMap.get(item.order_id);
        if (!orderMeta) continue;

        if (!groupedOrders.has(item.order_id)) {
          groupedOrders.set(item.order_id, {
            ...orderMeta,
            items: [],
            artisanTotal: 0
          });
        }

        const group = groupedOrders.get(item.order_id);
        const prod = prodsMap.get(item.product_id);
        const imgUrl = imgsMap.get(item.product_id) || null;

        group.items.push({
          ...item,
          product_name: prod?.name || 'Handicraft Item',
          local_title: prod?.local_title || null,
          image_url: imgUrl
        });

        group.artisanTotal += Number(item.subtotal || 0);
      }

      // Sort by order created_at descending
      const sorted = Array.from(groupedOrders.values()).sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );

      setOrders(sorted);
    } catch (err) {
      console.error('Error loading artisan orders:', err);
      setErrorMsg(isKn ? 'ಆರ್ಡರ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.' : 'Failed to load your orders.');
    } finally {
      setLoading(false);
    }
  }, [artisan, isKn]);

  useEffect(() => {
    if (!authLoading) {
      fetchArtisanOrders();
    }
  }, [authLoading, fetchArtisanOrders]);

  // Handle status update (confirmed -> preparing -> shipped)
  const handleUpdateStatus = async (orderId, newStatus, customerId, firstItemName) => {
    try {
      setStatusActionId(orderId);
      setActionSuccessMsg('');
      setErrorMsg('');

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Optional: dispatch customer notification (non-fatal if blocked)
      if (customerId) {
        try {
          await supabase.from('notifications').insert({
            user_id: customerId,
            type: 'order_status_changed',
            title: newStatus === 'preparing' ? 'Order Under Preparation' : 'Order Shipped',
            message: `Your order #${orderId.slice(0, 8).toUpperCase()} containing "${firstItemName || 'your craft'}" has been updated to ${newStatus.toUpperCase()} by the artisan.`,
            reference_id: orderId,
            reference_type: 'order',
            is_read: false
          });
        } catch {
          // Non-blocking notification
        }
      }

      // Update local state smoothly
      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: newStatus } : ord))
      );

      const successText =
        newStatus === 'preparing'
          ? isKn
            ? 'ಆರ್ಡರ್ ಸಿದ್ಧಪಡಿಸುವಿಕೆ ಪ್ರಾರಂಭವಾಗಿದೆ!'
            : 'Order marked as preparing!'
          : isKn
          ? 'ಆರ್ಡರ್ ರವಾನಿಸಲಾಗಿದೆ ಎಂದು ಗುರುತಿಸಲಾಗಿದೆ!'
          : 'Order marked as shipped!';
      setActionSuccessMsg(successText);
    } catch (err) {
      console.error('Error updating order status:', err);
      setErrorMsg(err.message || (isKn ? 'ಸ್ಥಿತಿ ನವೀಕರಣ ವಿಫಲವಾಗಿದೆ.' : 'Failed to update order status.'));
    } finally {
      setStatusActionId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    if (filterTab === 'active') {
      return orders.filter((o) =>
        ['placed', 'confirmed', 'preparing', 'shipped', 'out_for_delivery'].includes(o.status)
      );
    }
    if (filterTab === 'delivered') {
      return orders.filter((o) => o.status === 'delivered');
    }
    if (filterTab === 'cancelled') {
      return orders.filter((o) => o.status === 'cancelled');
    }
    return orders;
  }, [orders, filterTab]);

  if (authLoading) {
    return (
      <div style={{ maxWidth: '480px', margin: '2rem auto', padding: '2rem', textAlign: 'center', color: 'var(--text)' }}>
        <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>⏳</div>
        <p style={{ margin: 0, color: 'var(--secondary-text)' }}>
          {isKn ? 'ಖಾತೆ ವಿವರಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...' : 'Loading session...'}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: '480px', margin: '2rem auto', padding: '1.5rem', textAlign: 'center', color: 'var(--text)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
        <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem', color: 'var(--primary-green)' }}>
          {isKn ? 'ಲಾಗಿನ್ ಅಗತ್ಯವಿದೆ' : 'Sign In Required'}
        </h2>
        <p style={{ color: 'var(--secondary-text)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          {isKn ? 'ನಿಮ್ಮ ಆರ್ಡರ್‌ಗಳನ್ನು ವೀಕ್ಷಿಸಲು ದಯವಿಟ್ಟು ಲಾಗಿನ್ ಆಗಿ.' : 'Please sign in to view your orders.'}
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--primary-green)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: '44px',
            touchAction: 'manipulation'
          }}
        >
          {isKn ? 'ಲಾಗಿನ್ ಮಾಡಿ' : 'Sign In'}
        </button>
      </div>
    );
  }

  if (!artisan) {
    return (
      <div style={{ maxWidth: '480px', margin: '2rem auto', padding: '1.5rem', textAlign: 'center', color: 'var(--text)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏪</div>
        <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem', color: 'var(--primary-green)' }}>
          {isKn ? 'ಕುಶಲಕರ್ಮಿ ಪ್ರೊಫೈಲ್ ಕಂಡುಬಂದಿಲ್ಲ' : 'Artisan Profile Not Found'}
        </h2>
        <p style={{ color: 'var(--secondary-text)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          {isKn
            ? 'ನಿಮ್ಮ ಕುಶಲಕರ್ಮಿ ನೋಂದಣಿ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿದ ನಂತರ ಆರ್ಡರ್‌ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.'
            : 'Complete your artisan registration to manage customer orders.'}
        </p>
        <Link
          to="/"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            background: 'var(--primary-green)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            minHeight: '44px'
          }}
        >
          {isKn ? 'ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ' : 'Back to Home'}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem', fontFamily: 'inherit', color: 'var(--text)', minHeight: '100vh' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border)',
          marginBottom: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            to="/"
            style={{
              textDecoration: 'none',
              fontSize: '1.25rem',
              color: 'var(--primary-green)',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center'
            }}
            aria-label="Back to Home"
          >
            ←
          </Link>
          <div>
            <h1 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--primary-green)', fontWeight: 700 }}>
              {isKn ? 'ನನ್ನ ಆರ್ಡರ್‌ಗಳು' : 'My Orders'}
            </h1>
            <span style={{ fontSize: '0.72rem', color: 'var(--secondary-text)' }}>
              {artisan.business_name || (isKn ? 'ಕುಶಲಕರ್ಮಿ ಶಾಪ್' : 'Artisan Shop')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ThemeToggle />
          <button
            onClick={fetchArtisanOrders}
            disabled={loading}
            aria-label="Refresh orders"
            style={{
              padding: '0.35rem 0.65rem',
              background: 'var(--chat-bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              minHeight: '36px'
            }}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Success banner */}
      {actionSuccessMsg && (
        <div
          style={{
            padding: '0.65rem 0.85rem',
            background: 'var(--light-green)',
            color: 'var(--primary-green)',
            border: '1px solid var(--primary-green)',
            borderRadius: '8px',
            marginBottom: '0.85rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>✓ {actionSuccessMsg}</span>
          <button
            onClick={() => setActionSuccessMsg('')}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error banner with retry */}
      {errorMsg && (
        <div
          style={{
            padding: '0.75rem',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            border: '1px solid var(--danger)',
            borderRadius: '8px',
            marginBottom: '0.85rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem'
          }}
        >
          <span>⚠️ {errorMsg}</span>
          <button
            onClick={fetchArtisanOrders}
            style={{
              padding: '0.3rem 0.6rem',
              background: 'var(--danger)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {isKn ? 'ಮರುಪ್ರಯತ್ನಿಸಿ' : 'Retry'}
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          background: 'var(--chat-bg)',
          padding: '0.3rem',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '1rem',
          overflowX: 'auto'
        }}
      >
        {[
          { id: 'all', labelKn: 'ಎಲ್ಲಾ', labelEn: 'All', count: orders.length },
          {
            id: 'active',
            labelKn: 'ಸಕ್ರಿಯ',
            labelEn: 'Active',
            count: orders.filter((o) =>
              ['placed', 'confirmed', 'preparing', 'shipped', 'out_for_delivery'].includes(o.status)
            ).length
          },
          {
            id: 'delivered',
            labelKn: 'ತಲುಪಿಸಲಾಗಿದೆ',
            labelEn: 'Delivered',
            count: orders.filter((o) => o.status === 'delivered').length
          },
          {
            id: 'cancelled',
            labelKn: 'ರದ್ದುಗೊಂಡಿದೆ',
            labelEn: 'Cancelled',
            count: orders.filter((o) => o.status === 'cancelled').length
          }
        ].map((tab) => {
          const isActive = filterTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              style={{
                flex: 1,
                padding: '0.45rem 0.5rem',
                border: 'none',
                borderRadius: '6px',
                background: isActive ? 'var(--primary-green)' : 'transparent',
                color: isActive ? 'white' : 'var(--secondary-text)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {isKn ? tab.labelKn : tab.labelEn} ({tab.count})
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--secondary-text)' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🔄</div>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {isKn ? 'ಆರ್ಡರ್‌ಗಳನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ...' : 'Loading your orders...'}
          </p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '2.5rem 1.25rem',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📦</div>
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '1rem', color: 'var(--text)' }}>
            {filterTab === 'all'
              ? isKn
                ? 'ಇನ್ನೂ ಯಾವುದೇ ಆರ್ಡರ್‌ಗಳು ಬಂದಿಲ್ಲ'
                : 'No orders received yet'
              : isKn
              ? 'ಈ ವರ್ಗದಲ್ಲಿ ಯಾವುದೇ ಆರ್ಡರ್‌ಗಳಿಲ್ಲ'
              : 'No orders in this category'}
          </h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--secondary-text)', lineHeight: 1.4 }}>
            {isKn
              ? 'ಗ್ರಾಹಕರು ನಿಮ್ಮ ಕರಕುಶಲ ಉತ್ಪನ್ನಗಳನ್ನು ಖರೀದಿಸಿದಾಗ, ಅವುಗಳ ಆರ್ಡರ್ ವಿವರಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.'
              : 'When customers purchase your handmade products on the marketplace, orders will appear here.'}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <Link
              to="/my-products"
              style={{
                display: 'inline-block',
                padding: '0.55rem 1rem',
                background: 'var(--chat-bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: '6px',
                fontSize: '0.82rem',
                textDecoration: 'none',
                fontWeight: 600
              }}
            >
              {isKn ? 'ಉತ್ಪನ್ನಗಳ ಕ್ಯಾಟಲಾಗ್' : 'My Products'}
            </Link>
            <Link
              to="/add-product"
              style={{
                display: 'inline-block',
                padding: '0.55rem 1rem',
                background: 'var(--primary-green)',
                color: 'white',
                borderRadius: '6px',
                fontSize: '0.82rem',
                textDecoration: 'none',
                fontWeight: 600
              }}
            >
              {isKn ? '+ ಹೊಸ ಉತ್ಪನ್ನ' : '+ Add Product'}
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filteredOrders.map((ord) => {
            const statusCfg = STATUS_CONFIG[ord.status] || STATUS_CONFIG.placed;
            const shortId = (ord.id || '').slice(0, 8).toUpperCase();
            const orderDate = new Date(ord.created_at || 0).toLocaleDateString(isKn ? 'kn-IN' : 'en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
            const isUpdating = statusActionId === ord.id;
            const firstItemName = ord.items?.[0]?.product_name;

            return (
              <div
                key={ord.id}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  boxShadow: 'var(--card-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                {/* Order Card Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                        #{shortId}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--secondary-text)' }}>
                      📅 {orderDate}
                    </span>
                  </div>

                  <span
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: statusCfg.bg,
                      color: statusCfg.color,
                      border: `1px solid ${statusCfg.border}`,
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isKn ? statusCfg.labelKn : statusCfg.labelEn}
                  </span>
                </div>

                {/* Buyer / Shipping Location (Privacy Preserved) */}
                {(ord.shipping_city || ord.shipping_state || ord.shipping_name) && (
                  <div
                    style={{
                      background: 'var(--chat-bg)',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      color: 'var(--secondary-text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span>📍</span>
                    <span>
                      {isKn ? 'ವಿತರಣಾ ತಾಣ: ' : 'Deliver to: '}
                      <strong style={{ color: 'var(--text)' }}>
                        {[ord.shipping_city, ord.shipping_state].filter(Boolean).join(', ') ||
                          ord.shipping_name ||
                          'Karnataka, India'}
                      </strong>
                    </span>
                  </div>
                )}

                {/* Items in this order belonging to this artisan */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {ord.items.map((item) => {
                    const displayName = (isKn && item.local_title) || item.product_name;
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.4rem 0',
                          borderTop: '1px dashed var(--border)'
                        }}
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={displayName}
                            style={{
                              width: '46px',
                              height: '46px',
                              objectFit: 'cover',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              flexShrink: 0
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '6px',
                              background: 'var(--chat-bg)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.2rem',
                              flexShrink: 0
                            }}
                          >
                            🏺
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: 'var(--text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {displayName}
                          </h4>
                          <div style={{ fontSize: '0.74rem', color: 'var(--secondary-text)', marginTop: '0.15rem' }}>
                            <span>
                              {isKn ? 'ಪ್ರಮಾಣ: ' : 'Qty: '}
                              <strong>{item.quantity}</strong>
                            </span>
                            <span style={{ margin: '0 0.35rem' }}>•</span>
                            <span>₹{Number(item.unit_price).toFixed(2)}</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary-green)' }}>
                            ₹{Number(item.subtotal).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Card Footer: Artisan Subtotal & Authorized Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid var(--border)',
                    marginTop: '0.2rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--secondary-text)', display: 'block' }}>
                      {isKn ? 'ನಿಮ್ಮ ಆರ್ಡರ್ ಮೊತ್ತ:' : 'Artisan Subtotal:'}
                    </span>
                    <strong style={{ fontSize: '1rem', color: 'var(--primary-green)' }}>
                      ₹{ord.artisanTotal.toFixed(2)}
                    </strong>
                  </div>

                  {/* Status Action Buttons (Matching authorized workflow in Dashboard.jsx) */}
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {ord.status === 'confirmed' && (
                      <button
                        onClick={() => handleUpdateStatus(ord.id, 'preparing', ord.customer_id, firstItemName)}
                        disabled={isUpdating}
                        style={{
                          padding: '0.45rem 0.85rem',
                          background: 'var(--primary-green)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: isUpdating ? 'not-allowed' : 'pointer',
                          minHeight: '40px',
                          touchAction: 'manipulation',
                          opacity: isUpdating ? 0.7 : 1
                        }}
                      >
                        {isUpdating ? '...' : isKn ? 'ಸಿದ್ಧಪಡಿಸಲು ಪ್ರಾರಂಭಿಸಿ' : 'Start Preparing'}
                      </button>
                    )}

                    {ord.status === 'preparing' && (
                      <button
                        onClick={() => handleUpdateStatus(ord.id, 'shipped', ord.customer_id, firstItemName)}
                        disabled={isUpdating}
                        style={{
                          padding: '0.45rem 0.85rem',
                          background: '#059669',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: isUpdating ? 'not-allowed' : 'pointer',
                          minHeight: '40px',
                          touchAction: 'manipulation',
                          opacity: isUpdating ? 0.7 : 1
                        }}
                      >
                        {isUpdating ? '...' : isKn ? 'ರವಾನಿಸಲಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿ' : 'Mark as Shipped'}
                      </button>
                    )}

                    {ord.status === 'placed' && (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--secondary-text)',
                          fontStyle: 'italic',
                          padding: '0.35rem 0'
                        }}
                      >
                        {isKn ? 'ಆಡಳಿತ ಮಂಡಳಿಯ ದೃಢೀಕರಣಕ್ಕಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ' : 'Awaiting confirmation'}
                      </span>
                    )}

                    {ord.status === 'shipped' && (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: '#7C3AED',
                          fontWeight: 600,
                          padding: '0.35rem 0'
                        }}
                      >
                        {isKn ? 'ರವಾನಿಸಲಾಗಿದೆ • ವಿತರಣೆ ಬಾಕಿ' : 'In transit to customer'}
                      </span>
                    )}

                    {ord.status === 'delivered' && (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: '#059669',
                          fontWeight: 600,
                          padding: '0.35rem 0'
                        }}
                      >
                        ✓ {isKn ? 'ಯಶಸ್ವಿಯಾಗಿ ತಲುಪಿಸಲಾಗಿದೆ' : 'Delivered'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MyOrdersPage;
