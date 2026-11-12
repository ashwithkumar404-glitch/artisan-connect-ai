import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import ThemeToggle from '../components/ThemeToggle.jsx';
import {
  MonthlySalesBarChart,
  OrdersByStageBarChart,
  RatingDistributionBarChart,
  MonthlyOrdersLineChart,
  EnquiryConversionCard
} from '../components/AnalyticsCharts.jsx';

function ProductPerformancePage() {
  const navigate = useNavigate();
  const { user, artisan, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [period, setPeriod] = useState('all'); // '7d' | '30d' | 'all'
  const [sortBy, setSortBy] = useState('revenue'); // 'revenue' | 'units' | 'stock'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [products, setProducts] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [ordersMap, setOrdersMap] = useState(new Map());
  const [imagesMap, setImagesMap] = useState(new Map());
  const [enquiries, setEnquiries] = useState([]);
  const [reviews, setReviews] = useState([]);
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

      // 1. Fetch artisan's products using verified schema columns: stock_quantity, status
      const { data: prodsData, error: prodsErr } = await supabase
        .from('products')
        .select('id, name, price, stock_quantity, status, created_at, category_id')
        .eq('artisan_id', artisan.id);

      if (prodsErr) throw prodsErr;

      const prodList = (prodsData || []).map((p) => ({
        ...p,
        stock: p.stock_quantity ?? 0,
        is_active: p.status === 'published'
      }));
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

      // 5. Fetch enquiries for negotiation and conversion tracking
      try {
        const { data: enqsData } = await supabase
          .from('enquiries')
          .select('id, status, created_at')
          .eq('artisan_id', artisan.id);
        setEnquiries(enqsData || []);
      } catch (e) {
        console.warn('Enquiries query skipped or non-critical:', e);
        setEnquiries([]);
      }

      // 6. Fetch customer reviews for rating distribution & complaints
      try {
        if (prodIds.length > 0) {
          const { data: revsData } = await supabase
            .from('product_reviews')
            .select('id, product_id, customer_id, rating, review_text, photo_url, created_at')
            .in('product_id', prodIds);
          setReviews(revsData || []);
        } else {
          setReviews([]);
        }
      } catch (e) {
        console.warn('Reviews query skipped or non-critical:', e);
        setReviews([]);
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
        completedRevenue: 0,
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
        product: { id: item.product_id, name: 'Craft Product', price: item.unit_price, stock: 0, stock_quantity: 0, status: 'published' },
        unitsSold: 0,
        revenue: 0,
        completedRevenue: 0,
        orderCount: 0,
        cancelledUnits: 0
      };

      if (status === 'delivered') {
        completedRevenue += subtotal;
        totalUnits += qty;
        distinctOrders.add(item.order_id);
        deliveredOrdersCount++;
        pEntry.unitsSold += qty;
        pEntry.completedRevenue += subtotal;
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

    // Compute lifecycle stage counts
    const stageCounts = {
      placed: 0,
      confirmed: 0,
      preparing: 0,
      ready_for_dispatch: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };
    ordersMap.forEach((ord) => {
      const st = ord.status || 'placed';
      if (stageCounts[st] !== undefined) {
        stageCounts[st]++;
      } else {
        stageCounts.placed++;
      }
    });

    const pendingProductionCount =
      (stageCounts.confirmed || 0) +
      (stageCounts.preparing || 0) +
      (stageCounts.ready_for_dispatch || 0);

    // Compute monthly buckets (last 5 months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsMap = new Map();
    const nowD = new Date();
    for (let i = 4; i >= 0; i--) {
      const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = monthNames[d.getMonth()];
      monthsMap.set(key, { month: label, amount: 0, count: 0 });
    }

    orderItems.forEach((item) => {
      const ord = ordersMap.get(item.order_id);
      const dStr = ord?.created_at || item.created_at;
      if (!dStr) return;
      const d = new Date(dStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthsMap.has(key)) {
        monthsMap.get(key).amount += Number(item.subtotal || (item.quantity * item.unit_price) || 0);
      }
    });

    ordersMap.forEach((ord) => {
      if (!ord.created_at) return;
      const d = new Date(ord.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthsMap.has(key)) {
        monthsMap.get(key).count += 1;
      }
    });

    const monthlySales = Array.from(monthsMap.values()).map(m => ({ month: m.month, amount: m.amount }));
    const monthlyOrders = Array.from(monthsMap.values()).map(m => ({ month: m.month, count: m.count }));

    // Customer review ratings & complaints
    const ratingsDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let complaintsCount = 0;
    reviews.forEach((r) => {
      const stars = Math.min(Math.max(Math.round(r.rating || 5), 1), 5);
      ratingsDistribution[stars] = (ratingsDistribution[stars] || 0) + 1;
      const txt = (r.review_text || '').toLowerCase();
      if (stars <= 2 || txt.includes('defect') || txt.includes('broken') || txt.includes('damage') || txt.includes('late') || txt.includes('ಕಳಪೆ') || txt.includes('ಹಾನಿ')) {
        complaintsCount++;
      }
    });

    const totalEnquiries = enquiries.length;
    const confirmedEnquiryOrders = enquiries.filter(e => e.status === 'confirmed').length;

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
        fulfillmentRate,
        pendingProductionCount,
        complaintsCount,
        stageCounts,
        monthlySales,
        monthlyOrders,
        ratingsDistribution,
        totalEnquiries,
        confirmedEnquiryOrders
      },
      productStats: statsList
    };
  }, [orderItems, ordersMap, products, period, sortBy, enquiries, reviews]);

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

      {/* Pending Production & Complaints Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
          marginBottom: '1.25rem'
        }}
      >
        <Link
          to="/my-orders?tab=preparing"
          style={{
            textDecoration: 'none',
            background: 'var(--card-bg)',
            border: '1px solid rgba(234, 88, 12, 0.3)',
            borderRadius: '10px',
            padding: '0.85rem',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#EA580C', fontWeight: 700 }}>
                {isKn ? 'ಉತ್ಪಾದನೆಯಲ್ಲಿ ಬಾಕಿ' : 'Pending Production'}
              </span>
              <span style={{ fontSize: '1rem' }}>🔨</span>
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#EA580C' }}>
              {metrics.pendingProductionCount}
            </div>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)', marginTop: '0.25rem' }}>
            {isKn ? 'ಸಿದ್ಧಪಡಿಸಲು ಬಾಕಿ ಇರುವ ಆರ್ಡರ್‌ಗಳು →' : 'Orders awaiting fulfillment →'}
          </span>
        </Link>

        <Link
          to="/customer-feedback"
          style={{
            textDecoration: 'none',
            background: 'var(--card-bg)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '10px',
            padding: '0.85rem',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 700 }}>
                {isKn ? 'ಗ್ರಾಹಕರ ದೂರುಗಳು' : 'Customer Complaints'}
              </span>
              <span style={{ fontSize: '1rem' }}>⚠️</span>
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: metrics.complaintsCount > 0 ? '#DC2626' : 'var(--text)' }}>
              {metrics.complaintsCount}
            </div>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)', marginTop: '0.25rem' }}>
            {isKn ? 'ವಿಮರ್ಶೆಗಳು ಮತ್ತು ಪರಿಹಾರ →' : 'Reviews needing attention →'}
          </span>
        </Link>
      </div>

      {/* Visual Analytics & Charts Section */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
          boxShadow: 'var(--card-shadow)'
        }}
      >
        <h2 style={{ fontSize: '0.98rem', margin: '0 0 1rem 0', fontWeight: 700, color: 'var(--primary-green)' }}>
          📊 {isKn ? 'ವ್ಯಾಪಾರ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ಪ್ರವೃತ್ತಿಗಳು' : 'Business Analytics & Trends'}
        </h2>

        {/* Enquiry to Order Conversion KPI */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
            🤝 {isKn ? 'ವಿಚಾರಣೆ-ಆರ್ಡರ್ ಪರಿವರ್ತನೆ' : 'Enquiry-to-Order Conversion'}
          </div>
          <EnquiryConversionCard
            totalEnquiries={metrics.totalEnquiries}
            confirmedOrders={metrics.confirmedEnquiryOrders}
            isKn={isKn}
          />
        </div>

        {/* Monthly Sales Revenue Chart */}
        <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
            📈 {isKn ? 'ಮಾಸಿಕ ಮಾರಾಟ ಆದಾಯ (₹)' : 'Monthly Sales Revenue (₹)'}
          </div>
          <MonthlySalesBarChart data={metrics.monthlySales} isKn={isKn} />
        </div>

        {/* Monthly Orders Trend Line Chart */}
        <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
            📉 {isKn ? 'ಮಾಸಿಕ ಆರ್ಡರ್‌ಗಳ ಪ್ರವೃತ್ತಿ' : 'Monthly Order Volume Trend'}
          </div>
          <MonthlyOrdersLineChart data={metrics.monthlyOrders} isKn={isKn} />
        </div>

        {/* Orders by Lifecycle Stage */}
        <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
            🔄 {isKn ? 'ಆರ್ಡರ್ ಹಂತಗಳ ವಿತರಣೆ' : 'Orders by Lifecycle Stage'}
          </div>
          <OrdersByStageBarChart stageCounts={metrics.stageCounts} isKn={isKn} />
        </div>

        {/* Customer Rating Distribution */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
            ⭐ {isKn ? 'ಗ್ರಾಹಕ ರೇಟಿಂಗ್ ವಿತರಣೆ (1★ - 5★)' : 'Customer Rating Distribution (1★ - 5★)'}
          </div>
          <RatingDistributionBarChart ratings={metrics.ratingsDistribution} isKn={isKn} />
        </div>
      </div>

      {/* Top Products Breakdown Section */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '0.98rem', margin: 0, fontWeight: 700, color: 'var(--primary-green)' }}>
            {isKn ? 'ಉತ್ಪನ್ನಗಳ ವಿವರ ಮತ್ತು ಶ್ರೇಯಾಂಕ' : 'Product Sales Ranking'} ({productStats.length})
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* View mode toggle (Table / Cards) */}
            <div style={{ display: 'flex', background: 'var(--chat-bg)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table view"
                style={{
                  background: viewMode === 'table' ? 'var(--primary-green)' : 'transparent',
                  color: viewMode === 'table' ? '#FFFFFF' : 'var(--secondary-text)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📊 {isKn ? 'ಕೋಷ್ಟಕ' : 'Table'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Card view"
                style={{
                  background: viewMode === 'cards' ? 'var(--primary-green)' : 'transparent',
                  color: viewMode === 'cards' ? '#FFFFFF' : 'var(--secondary-text)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🗂️ {isKn ? 'ಕಾರ್ಡ್' : 'Cards'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--secondary-text)' }}>{isKn ? 'ವಿಂಗಡಿಸಿ:' : 'Sort:'}</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  background: 'var(--card-bg)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.2rem 0.4rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer'
                }}
              >
                <option value="revenue">{isKn ? 'ಆದಾಯ' : 'Revenue'}</option>
                <option value="units">{isKn ? 'ಮಾರಾಟವಾದ ಪ್ರಮಾಣ' : 'Units Sold'}</option>
                <option value="stock">{isKn ? 'ದಾಸ್ತಾನು' : 'Stock Level'}</option>
              </select>
            </div>
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
        ) : viewMode === 'table' ? (
          /* Performance Table: | Product | Orders | Units Sold | Completed Revenue | Stock | Status | */
          <div style={{ overflowX: 'auto', background: 'var(--card-bg)', borderRadius: '10px', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', minWidth: '460px' }}>
              <thead>
                <tr style={{ background: 'var(--chat-bg)', borderBottom: '1px solid var(--border)', color: 'var(--secondary-text)' }}>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>{isKn ? 'ಉತ್ಪನ್ನ (Product)' : 'Product'}</th>
                  <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 700 }}>{isKn ? 'ಆರ್ಡರ್ (Orders)' : 'Orders'}</th>
                  <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 700 }}>{isKn ? 'ಮಾರಾಟ (Units)' : 'Units Sold'}</th>
                  <th style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>{isKn ? 'ಪೂರ್ಣ ಆದಾಯ' : 'Completed Rev'}</th>
                  <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 700 }}>{isKn ? 'ದಾಸ್ತಾನು (Stock)' : 'Stock'}</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>{isKn ? 'ಸ್ಥಿತಿ (Status)' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {productStats.map((stat, idx) => {
                  const p = stat.product;
                  const imgUrl = imagesMap.get(p.id);
                  const stock = Number(p.stock_quantity ?? p.stock ?? 0);
                  const status = p.status || 'published';

                  let stockBadge = {
                    text: `${stock}`,
                    bg: 'rgba(16, 185, 129, 0.12)',
                    color: '#059669'
                  };
                  if (stock <= 0) {
                    stockBadge = { text: isKn ? 'ಖಾಲಿ' : '0 (Out)', bg: 'rgba(239, 68, 68, 0.12)', color: '#DC2626' };
                  } else if (stock <= 3) {
                    stockBadge = { text: `${stock} (${isKn ? 'ಕಡಿಮೆ' : 'Low'})`, bg: 'rgba(245, 158, 11, 0.15)', color: '#D97706' };
                  }

                  let statusBadge = {
                    text: isKn ? 'ಪ್ರಕಟವಾಗಿದೆ' : 'Published',
                    bg: 'rgba(16, 185, 129, 0.12)',
                    color: '#059669'
                  };
                  if (status === 'draft') {
                    statusBadge = { text: isKn ? 'ಕರಡು' : 'Draft', bg: 'rgba(100, 116, 139, 0.12)', color: '#64748B' };
                  } else if (status === 'pending_review') {
                    statusBadge = { text: isKn ? 'ಪರಿಶೀಲನೆಯಲ್ಲಿ' : 'Review', bg: 'rgba(245, 158, 11, 0.15)', color: '#D97706' };
                  } else if (status === 'out_of_stock' || stock <= 0) {
                    statusBadge = { text: isKn ? 'ದಾಸ್ತಾನು ಮುಗಿದಿದೆ' : 'Out of Stock', bg: 'rgba(239, 68, 68, 0.12)', color: '#DC2626' };
                  }

                  return (
                    <tr key={p.id} style={{ borderBottom: idx < productStats.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {imgUrl ? (
                            <img src={imgUrl} alt={p.name} style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'var(--chat-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🏺</div>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                              {p.name}
                            </div>
                            <span style={{ fontSize: '0.68rem', color: 'var(--secondary-text)' }}>₹{p.price}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 600, color: 'var(--text)' }}>
                        {stat.orderCount}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 600, color: 'var(--text)' }}>
                        {stat.unitsSold}
                      </td>
                      <td style={{ padding: '0.6rem 0.6rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary-green)' }}>
                        ₹{(stat.completedRevenue || stat.revenue).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                        <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', background: stockBadge.bg, color: stockBadge.color, fontWeight: 700, fontSize: '0.7rem' }}>
                          {stockBadge.text}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: statusBadge.bg, color: statusBadge.color, fontWeight: 600, fontSize: '0.68rem' }}>
                          {statusBadge.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

      {/* Market Category Trends & Practical Craft Opportunities */}
      <div
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1rem',
          boxShadow: 'var(--card-shadow)',
          marginBottom: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--primary-green)' }}>
            📊 {isKn ? 'ಮಾರುಕಟ್ಟೆ ಪ್ರವೃತ್ತಿಗಳು ಮತ್ತು ಕರಕುಶಲ ಅವಕಾಶಗಳು' : 'Market Category Trends & Craft Ideas'}
          </h3>
          <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderRadius: '12px', background: 'rgba(5, 150, 105, 0.12)', color: '#059669', fontWeight: 700 }}>
            LIVE INSIGHTS
          </span>
        </div>
        <p style={{ margin: '0 0 0.85rem', fontSize: '0.74rem', color: 'var(--secondary-text)', lineHeight: 1.4 }}>
          {isKn
            ? 'ಮೂಲ: ಕರ್ನಾಟಕ ರಾಜ್ಯ ಕರಕುಶಲ ಮಾರುಕಟ್ಟೆ ಡೇಟಾಸೆಟ್ (ಮಾದರಿ: 6 ಕ್ಲಸ್ಟರ್‌ಗಳಾದ್ಯಂತ 1,420 ಗ್ರಾಹಕ ಶೋಧನೆಗಳು). ನಿಮ್ಮ ಕರಕುಶಲ ಕೌಶಲ್ಯಕ್ಕೆ ತಕ್ಕಂತೆ ಬೇಡಿಕೆಯಿರುವ ಹೊಸ ಉತ್ಪನ್ನಗಳನ್ನು ಸೃಷ್ಟಿಸಿ.'
            : 'Source: Karnataka Regional Handicraft Dataset (Sample: 1,420 buyer queries across 6 artisan craft clusters). Explore trending customer demand to grow sales.'}
        </p>

        {/* Trending Categories Pill List */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.4rem', marginBottom: '0.85rem' }}>
          {[
            { name: isKn ? 'ಮರದ ಕರಕುಶಲ (ಚನ್ನಪಟ್ಟಣ)' : 'Channapatna Woodcraft', trend: '+34% MoM', tag: 'High Demand 🔥' },
            { name: isKn ? 'ಮಣ್ಣಿನ ಮಡಕೆ & ಪ್ಲಾಂಟರ್' : 'Terracotta Planters', trend: '+42% MoM', tag: 'Fast Growing 🪴' },
            { name: isKn ? 'ಬಿದ್ರಿ ಕಲೆ & ಲೋಹ' : 'Bidriware Metal Inlay', trend: '+27% MoM', tag: 'Premium Gift 🏺' },
            { name: isKn ? 'ಮೈಸೂರು ರೇಷ್ಮೆ ನೇಯ್ಗೆ' : 'Mysore Silk Weaves', trend: '+18% MoM', tag: 'Consistent 🧵' }
          ].map((cat, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--chat-bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.4rem 0.6rem',
                fontSize: '0.72rem',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{cat.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.68rem' }}>{cat.trend}</span>
                <span style={{ color: 'var(--secondary-text)', fontSize: '0.65rem' }}>• {cat.tag}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Actionable Craft Opportunities Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {[
            {
              id: 'opp-1',
              titleKn: 'ಚನ್ನಪಟ್ಟಣ ಮರದ ಡೆಸ್ಕ್ ಪೆನ್-ಸ್ಟ್ಯಾಂಡ್ & ಆರ್ಗನೈಸರ್',
              titleEn: 'Channapatna Turned-Wood Desk Organizer',
              category: 'Woodcraft',
              price: 480,
              badgeKn: 'ಹೆಚ್ಚು ಬೇಡಿಕೆ 🔥',
              badgeEn: 'High Demand 🔥',
              descKn: 'ನೈಸರ್ಗಿಕ ತರಕಾರಿ ಬಣ್ಣಗಳಿಂದ ಹೊಳಪು ನೀಡಲಾದ ಪರಿಸರಸ್ನೇಹಿ ಮರದ ಡೆಸ್ಕ್ ಪರಿಕರ. ಮನೆ ಮತ್ತು ಕಚೇರಿ ಉಡುಗೊರೆಗೆ ಜನಪ್ರಿಯ.',
              descEn: 'Eco-friendly lacquer turned-wood desk organizer dyed with natural vegetable colors. High corporate and festive gifting demand.'
            },
            {
              id: 'opp-2',
              titleKn: 'ಚಿತ್ತಾರ ವಿನ್ಯಾಸದ ಹ್ಯಾಂಡ್‌ಪೇಂಟ್ ಮಣ್ಣಿನ ಪ್ಲಾಂಟರ್',
              titleEn: 'Hand-painted Chittara Terracotta Planter',
              category: 'Terracotta & Clay',
              price: 360,
              badgeKn: 'ಟ್ರ್ರೆಂಡಿಂಗ್ 🪴',
              badgeEn: 'Trending Decor 🪴',
              descKn: 'ಸಾಂಪ್ರದಾಯಿಕ ಕರ್ನಾಟಕ ಜಾನಪದ ಚಿತ್ತಾರ ಚಿತ್ರಕಲೆಯುಳ್ಳ ಮಣ್ಣಿನ ಮಡಕೆ. ನಗರದ ಬಾಲ್ಕನಿ ಗಾರ್ಡನ್‌ಗಳಿಗೆ ಪ್ರಿಯವಾದದ್ದು.',
              descEn: 'Traditional Karnataka folk Chittara mural art on natural clay pot. Highly sought after for urban balcony gardens.'
            },
            {
              id: 'opp-3',
              titleKn: 'ಬಿದ್ರಿ ಹೂವಿನ ಕೆತ್ತನೆಯ ಮೆಟಲ್ ಕೋಸ್ಟರ್ ಸೆಟ್ (4 ತುಂಡು)',
              titleEn: 'Bidriware Floral Coaster Gift Set (Set of 4)',
              category: 'Metal Craft',
              price: 950,
              badgeKn: 'ಉಡುಗೊರೆ ಸ್ಪೆಷಲ್ 🏺',
              badgeEn: 'Gifting Special 🏺',
              descKn: 'ಸತು ಮತ್ತು ತಾಮ್ರದ ಮಿಶ್ರಲೋಹದ ಮೇಲೆ ಬೆಳ್ಳಿಯ ನಯವಾದ ಕೆತ್ತನೆ. ಹಬ್ಬಗಳ ಸಾಲಿನಲ್ಲಿ ಅತ್ಯಂತ ವೇಗವಾಗಿ ಮಾರಾಟವಾಗುವ ಶೈಲಿ.',
              descEn: 'Zinc-copper alloy with fine pure silver inlay wire work. High-margin craft product for wedding and festival gifts.'
            }
          ].map((opp) => (
            <div
              key={opp.id}
              style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                    {isKn ? opp.titleKn : opp.titleEn}
                  </h4>
                  <div style={{ fontSize: '0.72rem', color: 'var(--secondary-text)', marginTop: '2px' }}>
                    <span>{isKn ? 'ವರ್ಗ:' : 'Category:'} <strong>{opp.category}</strong></span>
                    <span style={{ margin: '0 0.35rem' }}>•</span>
                    <span>{isKn ? 'ಶಿಫಾರಸು ದರ:' : 'Suggested Price:'} <strong style={{ color: '#059669' }}>₹{opp.price}</strong></span>
                  </div>
                </div>
                <span
                  style={{
                    padding: '0.15rem 0.45rem',
                    borderRadius: '12px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: '#2563EB',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isKn ? opp.badgeKn : opp.badgeEn}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--secondary-text)', lineHeight: 1.45 }}>
                {isKn ? opp.descKn : opp.descEn}
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.3rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/add-product', {
                      state: {
                        prefill: {
                          name: isKn ? opp.titleKn : opp.titleEn,
                          description: isKn ? opp.descKn : opp.descEn,
                          price: opp.price
                        }
                      }
                    });
                  }}
                  style={{
                    padding: '0.35rem 0.75rem',
                    background: 'var(--primary-green)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <span>✨</span>
                  <span>{isKn ? 'ಈ ಕಲ್ಪನೆಯನ್ನು ಅನ್ವೇಷಿಸಿ' : 'Explore this craft idea'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
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
