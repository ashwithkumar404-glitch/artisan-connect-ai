import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import ThemeToggle from '../components/ThemeToggle.jsx';

function ProductPerformancePage() {
  const navigate = useNavigate();
  const { user, artisan, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [period, setPeriod] = useState('all'); // '7d' | '30d' | 'all'
  const [sortBy, setSortBy] = useState('revenue'); // 'revenue' | 'units' | 'stock'
  const [products, setProducts] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [ordersMap, setOrdersMap] = useState(new Map());
  const [imagesMap, setImagesMap] = useState(new Map());
  const [language, setLanguage] = useState(() => localStorage.getItem('artisan_language') || 'kn');

  useEffect(() => {
    const handleLangChange = (e) => {
      setLanguage(e.detail?.language || localStorage.getItem('artisan_language') || 'kn');
    };
    window.addEventListener('artisan-language-change', handleLangChange);
    return () => window.removeEventListener('artisan-language-change', handleLangChange);
  }, []);

  const isKn = language === 'kn';

  const fetchPerformanceData = useCallback(async () => {
    if (!artisan?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      // 1. Fetch artisan's products
      const { data: prodsData, error: prodsErr } = await supabase
        .from('products')
        .select('id, name, price, stock, is_active, created_at, category_id')
        .eq('artisan_id', artisan.id);

      if (prodsErr) throw prodsErr;

      const prodList = prodsData || [];
      setProducts(prodList);
      const prodIds = prodList.map((p) => p.id);

      // 2. Fetch primary product images if products exist
      if (prodIds.length > 0) {
        const { data: imgsData } = await supabase
          .from('product_images')
          .select('product_id, image_url')
          .in('product_id', prodIds);

        const imgMap = new Map();
        (imgsData || []).forEach((img) => {
          if (!imgMap.has(img.product_id)) {
            imgMap.set(img.product_id, img.image_url);
          }
        });
        setImagesMap(imgMap);
      } else {
        setImagesMap(new Map());
      }

      // 3. Fetch order items for this artisan
      const { data: itemsData, error: itemsErr } = await supabase
        .from('order_items')
        .select('id, order_id, product_id, artisan_id, quantity, unit_price, subtotal, created_at')
        .eq('artisan_id', artisan.id);

      if (itemsErr) throw itemsErr;

      const items = itemsData || [];
      setOrderItems(items);

      // 4. Fetch corresponding orders for metadata and status
      const orderIds = [...new Set(items.map((i) => i.order_id))];
      if (orderIds.length > 0) {
        const { data: ordsData, error: ordsErr } = await supabase
          .from('orders')
          .select('id, status, created_at')
          .in('id', orderIds);

        if (ordsErr) throw ordsErr;

        const oMap = new Map((ordsData || []).map((o) => [o.id, o]));
        setOrdersMap(oMap);
      } else {
        setOrdersMap(new Map());
      }
    } catch (err) {
      console.error('Error fetching performance analytics:', err);
      setErrorMsg(
        isKn
          ? 'ಕಾರ್ಯಕ್ಷಮತೆ ವಿವರಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.'
          : 'Failed to load performance analytics.'
      );
    } finally {
      setLoading(false);
    }
  }, [artisan, isKn]);

  useEffect(() => {
    if (!authLoading) {
      fetchPerformanceData();
    }
  }, [authLoading, fetchPerformanceData]);

  // Filter items and calculate metrics by chosen period
  const { metrics, productStats } = useMemo(() => {
    const now = Date.now();
    let cutoff = 0;
    if (period === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
    if (period === '30d') cutoff = now - 30 * 24 * 60 * 60 * 1000;

    const filtered = orderItems.filter((item) => {
      const ord = ordersMap.get(item.order_id);
      const timestamp = new Date(ord?.created_at || item.created_at || 0).getTime();
      return timestamp >= cutoff;
    });

    let completedRevenue = 0;
    let pendingRevenue = 0;
    let cancelledRevenue = 0;
    let totalUnits = 0;
    let deliveredOrdersCount = 0;
    const distinctOrders = new Set();
    const cancelledOrders = new Set();

    // Map stats per product
    const prodMap = new Map();
    products.forEach((p) => {
      prodMap.set(p.id, {
        product: p,
        unitsSold: 0,
        revenue: 0,
        orderCount: 0,
        cancelledUnits: 0
      });
    });

    for (const item of filtered) {
      const ord = ordersMap.get(item.order_id);
      const status = ord?.status || 'placed';
      const subtotal = Number(item.subtotal || (item.quantity * item.unit_price) || 0);
      const qty = Number(item.quantity || 0);

      const pEntry = prodMap.get(item.product_id) || {
        product: { id: item.product_id, name: 'Craft Product', price: item.unit_price, stock: 0 },
        unitsSold: 0,
        revenue: 0,
        orderCount: 0,
        cancelledUnits: 0
      };

      if (status === 'delivered') {
        completedRevenue += subtotal;
        totalUnits += qty;
        distinctOrders.add(item.order_id);
        deliveredOrdersCount++;
        pEntry.unitsSold += qty;
        pEntry.revenue += subtotal;
        pEntry.orderCount += 1;
      } else if (status === 'cancelled') {
        cancelledRevenue += subtotal;
        cancelledOrders.add(item.order_id);
        pEntry.cancelledUnits += qty;
      } else {
        // placed, confirmed, preparing, shipped, out_for_delivery
        pendingRevenue += subtotal;
        totalUnits += qty;
        distinctOrders.add(item.order_id);
        pEntry.unitsSold += qty;
        pEntry.revenue += subtotal;
        pEntry.orderCount += 1;
      }

      prodMap.set(item.product_id, pEntry);
    }

    const totalOrders = distinctOrders.size;
    const avgOrderValue = totalOrders > 0 ? (completedRevenue + pendingRevenue) / totalOrders : 0;
    const fulfillmentRate = totalOrders > 0 ? Math.round((deliveredOrdersCount / totalOrders) * 100) : 0;

    // Convert map to array and sort
    const statsList = Array.from(prodMap.values());
    statsList.sort((a, b) => {
      if (sortBy === 'revenue') return b.revenue - a.revenue;
      if (sortBy === 'units') return b.unitsSold - a.unitsSold;
      if (sortBy === 'stock') return (b.product.stock || 0) - (a.product.stock || 0);
      return 0;
    });

    return {
      filteredItems: filtered,
      metrics: {
        completedRevenue,
        pendingRevenue,
        totalGrossRevenue: completedRevenue + pendingRevenue,
        cancelledRevenue,
        totalUnits,
        totalOrders,
        avgOrderValue,
        fulfillmentRate
      },
      productStats: statsList
    };
  }, [orderItems, ordersMap, products, period, sortBy]);

  if (authLoading) {
    return (
      <div style={{ maxWidth: '520px', margin: '2rem auto', padding: '2rem', textAlign: 'center', color: 'var(--text)' }}>
        <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>⏳</div>
        <p style={{ margin: 0, color: 'var(--secondary-text)' }}>
          {isKn ? 'ಖಾತೆ ವಿವರಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...' : 'Loading account details...'}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: '520px', margin: '2rem auto', padding: '1.5rem', textAlign: 'center', color: 'var(--text)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
        <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem', color: 'var(--primary-green)' }}>
          {isKn ? 'ಲಾಗಿನ್ ಅಗತ್ಯವಿದೆ' : 'Sign In Required'}
        </h2>
        <p style={{ color: 'var(--secondary-text)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          {isKn
            ? 'ಉತ್ಪನ್ನಗಳ ಕಾರ್ಯಕ್ಷಮತೆಯನ್ನು ವೀಕ್ಷಿಸಲು ದಯವಿಟ್ಟು ಲಾಗಿನ್ ಆಗಿ.'
            : 'Please sign in to view your product performance analytics.'}
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
            minHeight: '44px'
          }}
        >
          {isKn ? 'ಲಾಗಿನ್ ಮಾಡಿ' : 'Sign In'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '1rem', fontFamily: 'inherit', color: 'var(--text)', minHeight: '100vh' }}>
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
              {isKn ? 'ಉತ್ಪನ್ನ ಕಾರ್ಯಕ್ಷಮತೆ' : 'Product Performance'}
            </h1>
            <span style={{ fontSize: '0.72rem', color: 'var(--secondary-text)' }}>
              {artisan?.business_name || (isKn ? 'ಕುಶಲಕರ್ಮಿ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' : 'Artisan Analytics')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ThemeToggle />
          <button
            onClick={fetchPerformanceData}
            disabled={loading}
            aria-label="Refresh performance"
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

      {/* Error Notice */}
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
            onClick={fetchPerformanceData}
            style={{
              padding: '0.3rem 0.6rem',
              background: 'var(--danger)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
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

      {/* Primary KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}
      >
        {/* Delivered Revenue */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '0.85rem',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', fontWeight: 600 }}>
              {isKn ? 'ಪೂರ್ಣಗೊಂಡ ಮಾರಾಟ' : 'Delivered Sales'}
            </span>
            <span style={{ fontSize: '1rem' }}>✅</span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-green)' }}>
            ₹{metrics.completedRevenue.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)' }}>
            {isKn ? 'ತಲುಪಿಸಲಾದ ಆರ್ಡರ್‌ಗಳು' : 'From completed deliveries'}
          </span>
        </div>

        {/* Units Sold */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '0.85rem',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', fontWeight: 600 }}>
              {isKn ? 'ಮಾರಾಟವಾದ ಘಟಕಗಳು' : 'Units Sold'}
            </span>
            <span style={{ fontSize: '1rem' }}>📦</span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)' }}>
            {metrics.totalUnits} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{isKn ? 'ವಸ್ತುಗಳು' : 'items'}</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)' }}>
            {isKn ? `${metrics.totalOrders} ಆರ್ಡರ್‌ಗಳಲ್ಲಿ` : `Across ${metrics.totalOrders} total orders`}
          </span>
        </div>

        {/* Pipeline Revenue */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '0.85rem',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', fontWeight: 600 }}>
              {isKn ? 'ರವಾನೆಯಲ್ಲಿರುವ ಮೊತ್ತ' : 'In-Transit Value'}
            </span>
            <span style={{ fontSize: '1rem' }}>🚚</span>
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#D97706' }}>
            ₹{metrics.pendingRevenue.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)' }}>
            {isKn ? 'ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿರುವ ಆರ್ಡರ್' : 'Active fulfillment pipeline'}
          </span>
        </div>

        {/* Average Order Value */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '0.85rem',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', fontWeight: 600 }}>
              {isKn ? 'ಸರಾಸರಿ ಆರ್ಡರ್ ಮೌಲ್ಯ' : 'Avg Order Value'}
            </span>
            <span style={{ fontSize: '1rem' }}>📊</span>
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>
            ₹{Math.round(metrics.avgOrderValue).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)' }}>
            {isKn ? `ಯಶಸ್ಸು ದರ: ${metrics.fulfillmentRate}%` : `Delivery rate: ${metrics.fulfillmentRate}%`}
          </span>
        </div>
      </div>

      {/* Telemetry Notice Card */}
      <div
        style={{
          background: 'rgba(7, 94, 84, 0.08)',
          border: '1px dashed var(--primary-green)',
          borderRadius: '10px',
          padding: '0.85rem',
          marginBottom: '1.2rem',
          fontSize: '0.78rem',
          color: 'var(--text)',
          lineHeight: 1.45
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem', fontWeight: 700, color: 'var(--primary-green)' }}>
          <span>ℹ️</span>
          <span>{isKn ? 'ಮಾರುಕಟ್ಟೆ ವೀಕ್ಷಣೆ ಟೆಲಿಮೆಟ್ರಿ ಮಾಹಿತಿ' : 'Marketplace Telemetry Notice'}</span>
        </div>
        <p style={{ margin: 0, color: 'var(--secondary-text)' }}>
          {isKn
            ? 'ಉತ್ಪನ್ನದ ಪುಟ ವೀಕ್ಷಣೆಗಳು (Views) ಮತ್ತು ಕ್ಲಿಕ್‌ಗಳನ್ನು ಕ್ಲೈಂಟ್-ಸೈಡ್ ಟೆಲಿಮೆಟ್ರಿ ಟ್ರ್ಯಾಕಿಂಗ್ ಸಂಪರ್ಕಗೊಂಡಾಗ ನೈಜ ಸಮಯದಲ್ಲಿ ದಾಖಲಿಸಲಾಗುತ್ತದೆ. ಮೇಲಿನ ಅಂಕಿಅಂಶಗಳು ನಿಮ್ಮ ಅಧಿಕೃತ Supabase ಆರ್ಡರ್ ದಾಖಲೆಗಳನ್ನು ಆಧರಿಸಿವೆ.'
            : 'Product page views and impressions will activate live once client-side marketplace telemetry tracking is connected. Metrics above reflect verified orders and sales from your artisan account.'}
        </p>
      </div>

      {/* Top Products Breakdown Section */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '0.98rem', margin: 0, fontWeight: 700, color: 'var(--primary-green)' }}>
            {isKn ? 'ಉತ್ಪನ್ನಗಳ ವಿವರ ಮತ್ತು ಶ್ರೇಯಾಂಕ' : 'Product Sales Ranking'} ({productStats.length})
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary-text)' }}>{isKn ? 'ವಿಂಗಡಿಸಿ:' : 'Sort:'}</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: 'var(--card-bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              <option value="revenue">{isKn ? 'ಆದಾಯ' : 'Revenue'}</option>
              <option value="units">{isKn ? 'ಮಾರಾಟವಾದ ಪ್ರಮಾಣ' : 'Units Sold'}</option>
              <option value="stock">{isKn ? 'ದಾಸ್ತಾನು' : 'Stock Level'}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary-text)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
            <p>{isKn ? 'ವಿಶ್ಲೇಷಣೆಯನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...' : 'Loading analytics...'}</p>
          </div>
        ) : productStats.length === 0 ? (
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '1.75rem 1rem',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏺</div>
            <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.35rem', color: 'var(--text)' }}>
              {isKn ? 'ಯಾವುದೇ ಉತ್ಪನ್ನಗಳು ಕಂಡುಬಂದಿಲ್ಲ' : 'No Products Listed Yet'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--secondary-text)', margin: '0 0 1rem' }}>
              {isKn
                ? 'ಕಾರ್ಯಕ್ಷಮತೆ ವೀಕ್ಷಿಸಲು ಧ್ವನಿ ಸಹಾಯಕ ಅಥವಾ ವಾಟ್ಸಾಪ್ ಮೂಲಕ ನಿಮ್ಮ ಮೊದಲ ಉತ್ಪನ್ನವನ್ನು ಸೇರಿಸಿ.'
                : 'Add your first handicraft via Voice Assistant or WhatsApp to see performance metrics.'}
            </p>
            <Link
              to="/add-product"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: 'var(--primary-green)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              {isKn ? '➕ ಉತ್ಪನ್ನ ಸೇರಿಸಿ' : '➕ Add Product'}
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {productStats.map((stat, idx) => {
              const p = stat.product;
              const imgUrl = imagesMap.get(p.id);
              const stock = Number(p.stock || 0);

              let stockBadge = {
                text: isKn ? `ದಾಸ್ತಾನು: ${stock}` : `Stock: ${stock}`,
                bg: 'rgba(16, 185, 129, 0.12)',
                color: '#059669'
              };
              if (stock <= 0) {
                stockBadge = {
                  text: isKn ? 'ಖಾಲಿಯಾಗಿದೆ' : 'Out of Stock',
                  bg: 'rgba(239, 68, 68, 0.12)',
                  color: '#DC2626'
                };
              } else if (stock <= 3) {
                stockBadge = {
                  text: isKn ? `ಕಡಿಮೆ ದಾಸ್ತಾನು: ${stock}` : `Low Stock: ${stock}`,
                  bg: 'rgba(245, 158, 11, 0.15)',
                  color: '#D97706'
                };
              }

              return (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '0.85rem',
                    boxShadow: 'var(--card-shadow)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                >
                  {/* Rank / Avatar */}
                  <div style={{ position: 'relative', width: '52px', height: '52px', flexShrink: 0 }}>
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={p.name}
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '8px',
                          objectFit: 'cover',
                          border: '1px solid var(--border)'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '8px',
                          background: 'var(--chat-bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.4rem'
                        }}
                      >
                        🎨
                      </div>
                    )}
                    <span
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        left: '-4px',
                        background: idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : idx === 2 ? '#B45309' : 'var(--primary-green)',
                        color: '#FFFFFF',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {idx + 1}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {p.name}
                      </h4>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--primary-green)', flexShrink: 0 }}>
                        ₹{stat.revenue.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.72rem' }}>
                      <span style={{ color: 'var(--secondary-text)' }}>
                        {isKn ? 'ಬೆಲೆ:' : 'Price:'} ₹{p.price}
                      </span>
                      <span style={{ color: 'var(--secondary-text)' }}>•</span>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {stat.unitsSold} {isKn ? 'ಮಾರಾಟ' : 'sold'}
                      </span>
                      <span style={{ color: 'var(--secondary-text)' }}>•</span>
                      <span
                        style={{
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          background: stockBadge.bg,
                          color: stockBadge.color,
                          fontWeight: 600,
                          fontSize: '0.68rem'
                        }}
                      >
                        {stockBadge.text}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Related Shortcuts / Navigation */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.5rem',
          marginBottom: '2rem'
        }}
      >
        <Link
          to="/my-products"
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
          📦 {isKn ? 'ನನ್ನ ಉತ್ಪನ್ನಗಳು' : 'My Products'}
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
        <Link
          to="/my-earnings"
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
          💰 {isKn ? 'ನನ್ನ ಗಳಿಕೆ' : 'My Earnings'}
        </Link>
        <Link
          to="/whatsapp"
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
          📱 {isKn ? 'ವಾಟ್ಸಾಪ್ ಚಾನೆಲ್' : 'WhatsApp Channel'}
        </Link>
      </div>
    </div>
  );
}

export default ProductPerformancePage;
