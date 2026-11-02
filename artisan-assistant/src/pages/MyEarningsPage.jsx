import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import ThemeToggle from '../components/ThemeToggle.jsx';

function MyEarningsPage() {
  const navigate = useNavigate();
  const { user, artisan, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [salesItems, setSalesItems] = useState([]);
  const [period, setPeriod] = useState('all'); // 'all' | '7d' | '30d'
  const [language, setLanguage] = useState(() => localStorage.getItem('artisan_language') || 'kn');

  useEffect(() => {
    const handleLangChange = (e) => {
      setLanguage(e.detail?.language || localStorage.getItem('artisan_language') || 'kn');
    };
    window.addEventListener('artisan-language-change', handleLangChange);
    return () => window.removeEventListener('artisan-language-change', handleLangChange);
  }, []);

  const isKn = language === 'kn';

  const fetchEarningsData = useCallback(async () => {
    if (!artisan?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      // 1. Fetch order items for this artisan
      const { data: rawItems, error: itemsErr } = await supabase
        .from('order_items')
        .select('id, order_id, product_id, artisan_id, quantity, unit_price, subtotal')
        .eq('artisan_id', artisan.id);

      if (itemsErr) throw itemsErr;

      if (!rawItems || rawItems.length === 0) {
        setSalesItems([]);
        setLoading(false);
        return;
      }

      const orderIds = [...new Set(rawItems.map((i) => i.order_id))];
      const productIds = [...new Set(rawItems.map((i) => i.product_id))];

      // 2. Fetch order metadata (enforcing RLS is_artisan_order)
      const [ordersRes, prodsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, status, created_at')
          .in('id', orderIds),
        supabase
          .from('products')
          .select('id, name')
          .in('id', productIds)
      ]);

      if (ordersRes.error) throw ordersRes.error;

      const oMap = new Map((ordersRes.data || []).map((o) => [o.id, o]));
      const pMap = new Map((prodsRes.data || []).map((p) => [p.id, p]));

      // 3. Assemble verified sales records
      const assembled = rawItems.map((item) => {
        const ord = oMap.get(item.order_id);
        const prod = pMap.get(item.product_id);
        return {
          ...item,
          order_status: ord?.status || 'placed',
          order_date: ord?.created_at || null,
          product_name: prod?.name || 'Handicraft Item'
        };
      });

      // Sort by order date descending
      assembled.sort((a, b) => new Date(b.order_date || 0) - new Date(a.order_date || 0));

      setSalesItems(assembled);
    } catch (err) {
      console.error('Error fetching earnings data:', err);
      setErrorMsg(isKn ? 'ಗಳಿಕೆಯ ವಿವರಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.' : 'Failed to load earnings data.');
    } finally {
      setLoading(false);
    }
  }, [artisan, isKn]);

  useEffect(() => {
    if (!authLoading) {
      fetchEarningsData();
    }
  }, [authLoading, fetchEarningsData]);

  // Filter sales items by selected period (7d, 30d, all)
  const filteredSalesItems = useMemo(() => {
    if (period === 'all') return salesItems;
    const now = Date.now();
    const cutoff = period === '7d' ? now - 7 * 24 * 60 * 60 * 1000 : now - 30 * 24 * 60 * 60 * 1000;
    return salesItems.filter((item) => {
      const ts = new Date(item.order_date || 0).getTime();
      return ts >= cutoff;
    });
  }, [salesItems, period]);

  // Verified calculations based on actual order status and item subtotals for the selected period
  const metrics = useMemo(() => {
    let completedSales = 0;
    let pendingFulfillment = 0;
    let cancelledValue = 0;
    let totalGrossSales = 0;
    let totalUnitsSold = 0;

    const nonCancelledOrderIds = new Set();

    for (const item of filteredSalesItems) {
      const subtotal = Number(item.subtotal || 0);
      const qty = Number(item.quantity || 0);
      const status = item.order_status;

      if (status === 'delivered') {
        completedSales += subtotal;
        totalGrossSales += subtotal;
        totalUnitsSold += qty;
        nonCancelledOrderIds.add(item.order_id);
      } else if (status === 'cancelled') {
        cancelledValue += subtotal;
      } else {
        // placed, confirmed, preparing, shipped, out_for_delivery
        pendingFulfillment += subtotal;
        totalGrossSales += subtotal;
        totalUnitsSold += qty;
        nonCancelledOrderIds.add(item.order_id);
      }
    }

    return {
      completedSales,
      pendingFulfillment,
      totalGrossSales,
      totalUnitsSold,
      cancelledValue,
      totalOrdersCount: nonCancelledOrderIds.size
    };
  }, [filteredSalesItems]);

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
          {isKn ? 'ನಿಮ್ಮ ಮಾರಾಟ ಮತ್ತು ಗಳಿಕೆಯನ್ನು ವೀಕ್ಷಿಸಲು ದಯವಿಟ್ಟು ಲಾಗಿನ್ ಆಗಿ.' : 'Please sign in to view your sales and earnings.'}
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
            ? 'ಗಳಿಕೆಯ ವರದಿಯನ್ನು ವೀಕ್ಷಿಸಲು ಕುಶಲಕರ್ಮಿ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ.'
            : 'Complete your artisan profile to view sales and earnings.'}
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
              {isKn ? 'ನನ್ನ ಗಳಿಕೆ ಮತ್ತು ಮಾರಾಟ' : 'My Earnings & Sales'}
            </h1>
            <span style={{ fontSize: '0.72rem', color: 'var(--secondary-text)' }}>
              {artisan.business_name || (isKn ? 'ಕುಶಲಕರ್ಮಿ ಶಾಪ್' : 'Artisan Shop')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ThemeToggle />
          <button
            onClick={fetchEarningsData}
            disabled={loading}
            aria-label="Refresh earnings"
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

      {/* Error Banner with Retry */}
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
            onClick={fetchEarningsData}
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

      {/* Period Selection Tabs */}
      <div
        style={{
          display: 'flex',
          background: 'var(--chat-bg)',
          borderRadius: '8px',
          padding: '0.25rem',
          border: '1px solid var(--border)',
          marginBottom: '1rem'
        }}
      >
        <button
          onClick={() => setPeriod('7d')}
          style={{
            flex: 1,
            padding: '0.5rem 0.25rem',
            borderRadius: '6px',
            border: 'none',
            background: period === '7d' ? 'var(--primary-green)' : 'transparent',
            color: period === '7d' ? '#FFFFFF' : 'var(--secondary-text)',
            fontWeight: period === '7d' ? 700 : 500,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {isKn ? 'ಕಳೆದ 7 ದಿನಗಳು' : 'Last 7 Days'}
        </button>
        <button
          onClick={() => setPeriod('30d')}
          style={{
            flex: 1,
            padding: '0.5rem 0.25rem',
            borderRadius: '6px',
            border: 'none',
            background: period === '30d' ? 'var(--primary-green)' : 'transparent',
            color: period === '30d' ? '#FFFFFF' : 'var(--secondary-text)',
            fontWeight: period === '30d' ? 700 : 500,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {isKn ? 'ಕಳೆದ 30 ದಿನಗಳು' : 'Last 30 Days'}
        </button>
        <button
          onClick={() => setPeriod('all')}
          style={{
            flex: 1,
            padding: '0.5rem 0.25rem',
            borderRadius: '6px',
            border: 'none',
            background: period === 'all' ? 'var(--primary-green)' : 'transparent',
            color: period === 'all' ? '#FFFFFF' : 'var(--secondary-text)',
            fontWeight: period === 'all' ? 700 : 500,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {isKn ? 'ಎಲ್ಲಾ ಸಮಯ' : 'All Time'}
        </button>
      </div>

      {/* Summary Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}
      >
        {/* Completed Sales Card */}
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '0.85rem',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
            ✓ {isKn ? 'ಪೂರ್ಣಗೊಂಡ ಮಾರಾಟ' : 'Completed Sales'}
          </span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.25rem' }}>
            ₹{metrics.completedSales.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--secondary-text)', marginTop: '0.2rem', display: 'block', lineHeight: 1.25 }}>
            {isKn ? 'ತಲುಪಿಸಲಾದ ಆರ್ಡರ್‌ಗಳು' : 'Delivered to buyers'}
          </span>
        </div>

        {/* Pending Fulfillment Card */}
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '0.85rem',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <span style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
            ⏳ {isKn ? 'ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿದೆ' : 'Pending Fulfillment'}
          </span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.25rem' }}>
            ₹{metrics.pendingFulfillment.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--secondary-text)', marginTop: '0.2rem', display: 'block', lineHeight: 1.25 }}>
            {isKn ? 'ಸಿದ್ಧತೆ ಅಥವಾ ಸಾಗಣೆಯಲ್ಲಿ' : 'Preparing / in transit'}
          </span>
        </div>

        {/* Total Order Value Card */}
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '0.85rem',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <span style={{ fontSize: '0.72rem', color: 'var(--primary-green)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
            📦 {isKn ? 'ಒಟ್ಟು ಆರ್ಡರ್ ಮೌಲ್ಯ' : 'Total Order Value'}
          </span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-green)', marginTop: '0.25rem' }}>
            ₹{metrics.totalGrossSales.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--secondary-text)', marginTop: '0.2rem', display: 'block', lineHeight: 1.25 }}>
            {isKn ? `${metrics.totalOrdersCount} ಮಾನ್ಯ ಆರ್ಡರ್‌ಗಳು` : `${metrics.totalOrdersCount} valid orders`}
          </span>
        </div>

        {/* Units Sold Card */}
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '0.85rem',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <span style={{ fontSize: '0.72rem', color: '#7C3AED', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
            🏺 {isKn ? 'ಮಾರಾಟವಾದ ಯೂನಿಟ್‌ಗಳು' : 'Units Sold'}
          </span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.25rem' }}>
            {metrics.totalUnitsSold}
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--secondary-text)', marginTop: '0.2rem', display: 'block', lineHeight: 1.25 }}>
            {isKn ? 'ಕರಕುಶಲ ವಸ್ತುಗಳು' : 'Handmade items'}
          </span>
        </div>
      </div>

      {/* Payout Information Notice (Clear policy distinction: orders vs bank disbursement) */}
      <div
        style={{
          background: 'var(--chat-bg)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '0.75rem 0.85rem',
          marginBottom: '1rem',
          fontSize: '0.75rem',
          color: 'var(--secondary-text)',
          lineHeight: 1.4
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span>ℹ️</span>
          <span>{isKn ? 'ಬ್ಯಾಂಕ್ ಪಾವತಿ ಮಾಹಿತಿ' : 'Bank Payout Information'}</span>
        </div>
        <p style={{ margin: 0 }}>
          {isKn
            ? 'ಗ್ರಾಹಕರಿಗೆ ಉತ್ಪನ್ನಗಳು ಯಶಸ್ವಿಯಾಗಿ ತಲುಪಿದ ನಂತರ, ಮಾರಾಟದ ಮೊತ್ತವನ್ನು ನಿಮ್ಮ ನೋಂದಾಯಿತ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ನೇರವಾಗಿ ಜಮಾ ಮಾಡಲಾಗುತ್ತದೆ. ಮೇಲಿನ ಅಂಕಿಅಂಶಗಳು ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ನಿಮ್ಮ ಉತ್ಪನ್ನಗಳ ಅಧಿಕೃತ ಖರೀದಿ ಮೌಲ್ಯವನ್ನು ಪ್ರತಿಬಿಂಬಿಸುತ್ತವೆ.'
            : 'Marketplace sales are disbursed directly to your registered bank account after customer delivery is verified. The values above reflect verified customer purchases from your craft listings.'}
        </p>
      </div>

      {/* Breakdown Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
          {isKn ? 'ಇತ್ತೀಚಿನ ಮಾರಾಟ ವಿವರಗಳು' : 'Recent Sales Breakdown'}
        </h2>
        <Link
          to="/my-orders"
          style={{ fontSize: '0.78rem', color: 'var(--primary-green)', textDecoration: 'none', fontWeight: 600 }}
        >
          {isKn ? 'ಆರ್ಡರ್‌ಗಳನ್ನು ನಿರ್ವಹಿಸಿ →' : 'Manage Orders →'}
        </Link>
      </div>

      {/* Content / List Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--secondary-text)' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🔄</div>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            {isKn ? 'ಮಾರಾಟ ದಾಖಲೆಗಳನ್ನು ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತಿದೆ...' : 'Calculating sales records...'}
          </p>
        </div>
      ) : filteredSalesItems.length === 0 ? (
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
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💰</div>
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '1rem', color: 'var(--text)' }}>
            {isKn ? 'ಇನ್ನೂ ಯಾವುದೇ ಮಾರಾಟ ದಾಖಲಾಗಿಲ್ಲ' : 'No sales recorded in selected period'}
          </h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--secondary-text)', lineHeight: 1.4 }}>
            {isKn
              ? 'ನಿಮ್ಮ ಕರಕುಶಲ ಉತ್ಪನ್ನಗಳನ್ನು ಪ್ರಕಟಿಸಿ, ಗ್ರಾಹಕರು ಖರೀದಿಸಿದಾಗ ಗಳಿಕೆಯು ಇಲ್ಲಿ ದಾಖಲಾಗುತ್ತದೆ.'
              : 'Publish your craft items to start making sales. When buyers complete orders, revenue will be tracked here.'}
          </p>
          <Link
            to="/add-product"
            style={{
              display: 'inline-block',
              padding: '0.6rem 1.2rem',
              background: 'var(--primary-green)',
              color: 'white',
              borderRadius: '8px',
              fontSize: '0.85rem',
              textDecoration: 'none',
              fontWeight: 600,
              minHeight: '44px'
            }}
          >
            {isKn ? '+ ಹೊಸ ಉತ್ಪನ್ನ ಸೇರಿಸಿ' : '+ Add New Product'}
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {filteredSalesItems.map((item) => {
            const shortId = (item.order_id || '').slice(0, 8).toUpperCase();
            const displayName = (isKn && item.local_title) || item.product_name;
            const dateStr = item.order_date
              ? new Date(item.order_date).toLocaleDateString(isKn ? 'kn-IN' : 'en-IN', {
                  month: 'short',
                  day: 'numeric'
                })
              : '—';

            const isDelivered = item.order_status === 'delivered';
            const isCancelled = item.order_status === 'cancelled';

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  boxShadow: 'var(--card-shadow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text)' }}>
                      #{shortId}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)' }}>• {dateStr}</span>
                  </div>
                  <h4
                    style={{
                      margin: '0.2rem 0 0.15rem',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {displayName}
                  </h4>
                  <div style={{ fontSize: '0.72rem', color: 'var(--secondary-text)' }}>
                    <span>
                      {item.quantity} × ₹{Number(item.unit_price).toFixed(2)}
                    </span>
                    <span style={{ margin: '0 0.35rem' }}>•</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: isDelivered ? '#059669' : isCancelled ? '#DC2626' : '#D97706'
                      }}
                    >
                      {item.order_status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      color: isCancelled ? 'var(--secondary-text)' : 'var(--primary-green)',
                      textDecoration: isCancelled ? 'line-through' : 'none'
                    }}
                  >
                    ₹{Number(item.subtotal).toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Navigation Shortcuts */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          marginTop: '1.5rem',
          paddingTop: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.5rem',
          marginBottom: '1.5rem'
        }}
      >
        <Link
          to="/product-performance"
          style={{
            padding: '0.65rem 0.5rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--primary-green)',
            textDecoration: 'none',
            fontSize: '0.82rem',
            fontWeight: 600,
            textAlign: 'center',
            display: 'block'
          }}
        >
          📈 {isKn ? 'ಉತ್ಪನ್ನ ಕಾರ್ಯಕ್ಷಮತೆ' : 'Product Performance'}
        </Link>
        <Link
          to="/customer-feedback"
          style={{
            padding: '0.65rem 0.5rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--primary-green)',
            textDecoration: 'none',
            fontSize: '0.82rem',
            fontWeight: 600,
            textAlign: 'center',
            display: 'block'
          }}
        >
          ⭐ {isKn ? 'ಗ್ರಾಹಕರ ವಿಮರ್ಶೆಗಳು' : 'Customer Reviews'}
        </Link>
      </div>
    </div>
  );
}

export default MyEarningsPage;
