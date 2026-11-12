import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
import ThemeToggle from '../components/ThemeToggle';

function CustomerFeedbackPage() {
  const navigate = useNavigate();
  const { user, profile, artisan, authLoading } = useAuth();

  const [language, setLanguage] = useState(() => localStorage.getItem('artisan_language') || 'kn');
  const isKn = language === 'kn';

  const [reviews, setReviews] = useState([]);
  const [productsMap, setProductsMap] = useState(new Map());
  const [customersMap, setCustomersMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [filterRating, setFilterRating] = useState('all'); // 'all' | '5' | '4' | 'critical'
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState(new Map());
  const [savedReplies, setSavedReplies] = useState(() => {
    try {
      return new Map(JSON.parse(localStorage.getItem('artisan_saved_review_replies') || '[]'));
    } catch {
      return new Map();
    }
  });
  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);

  // Review Classification Helper
  const classifyReview = (text = '', rating = 5) => {
    const lower = (text || '').toLowerCase();
    const r = Number(rating) || 5;

    if (
      lower.includes('delivery') ||
      lower.includes('courier') ||
      lower.includes('delay') ||
      lower.includes('late') ||
      lower.includes('tracking') ||
      lower.includes('ವಿತರಣೆ') ||
      lower.includes('ತಡ') ||
      lower.includes('ಪ್ಯಾಕಿಂಗ್')
    ) {
      return {
        type: 'delivery_issue',
        labelKn: 'ವಿತರಣಾ ಸಮಸ್ಯೆ',
        labelEn: 'Delivery Issue',
        color: '#EA580C',
        bg: 'rgba(234, 88, 12, 0.12)',
        nextStepsKn: 'ಕೊರಿಯರ್ ಟ್ರ್ಯಾಕಿಂಗ್ ಪರಿಶೀಲಿಸಿ ಅಥವಾ ಪಾರ್ಸೆಲ್ ಸ್ಥಿತಿಗಾಗಿ ಲಾಜಿಸ್ಟಿಕ್ಸ್ ಪಾಲುದಾರರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
        nextStepsEn: 'Check courier dispatch tracking and contact logistics partner for consignment status.',
        explanationKn: 'ಗ್ರಾಹಕರು ಪಾರ್ಸೆಲ್ ವಿತರಣೆ ಅಥವಾ ಸಮಯದ ಬಗ್ಗೆ ಪ್ರತಿಕ್ರಿಯಿಸಿದ್ದಾರೆ.'
      };
    }

    if (
      lower.includes('broken') ||
      lower.includes('damage') ||
      lower.includes('scratch') ||
      lower.includes('poor') ||
      lower.includes('defect') ||
      lower.includes('quality') ||
      lower.includes('ಕಳಪೆ') ||
      lower.includes('ಹಾಳಾಗಿದೆ') ||
      lower.includes('ಹಾನಿ') ||
      lower.includes('ಗುಣಮಟ್ಟ') ||
      r <= 2
    ) {
      return {
        type: 'quality_complaint',
        labelKn: 'ಗುಣಮಟ್ಟದ ದೂರು',
        labelEn: 'Quality Issue',
        color: '#DC2626',
        bg: 'rgba(220, 38, 38, 0.12)',
        nextStepsKn: 'ಕರಕುಶಲ ಮುಕ್ತಾಯವನ್ನು ಪರಿಶೀಲಿಸಿ, ಗ್ರಾಹಕರಿಗೆ ಬದಲಿ ಉತ್ಪನ್ನ ಅಥವಾ ರಿಪೇರಿ ಬೆಂಬಲ ನೀಡಿ.',
        nextStepsEn: 'Inspect craft finish; offer replacement or repair assistance to the customer.',
        explanationKn: 'ಉತ್ಪನ್ನದ ಫಿನಿಶಿಂಗ್ ಅಥವಾ ಗುಣಮಟ್ಟದ ಕುರಿತು ಗ್ರಾಹಕರು ಕಾಳಜಿ ವ್ಯಕ್ತಪಡಿಸಿದ್ದಾರೆ.'
      };
    }

    if (
      lower.includes('suggest') ||
      lower.includes('size') ||
      lower.includes('color') ||
      lower.includes('improve') ||
      lower.includes('ಬದಲಾವಣೆ') ||
      lower.includes('ಸಲಹೆ') ||
      lower.includes('ದೊಡ್ಡದು') ||
      lower.includes('ಚಿಕ್ಕದು') ||
      r === 3
    ) {
      return {
        type: 'suggestion',
        labelKn: 'ಗ್ರಾಹಕರ ಸಲಹೆ',
        labelEn: 'Suggestion',
        color: '#2563EB',
        bg: 'rgba(37, 99, 235, 0.12)',
        nextStepsKn: 'ಮುಂದಿನ ಬ್ಯಾಚ್ ತಯಾರಿಕೆಯಲ್ಲಿ ಈ ವಿನ್ಯಾಸ ಅಥವಾ ಗಾತ್ರದ ಸಲಹೆಯನ್ನು ಗಮನದಲ್ಲಿಟ್ಟುಕೊಳ್ಳಿ.',
        nextStepsEn: 'Consider this custom design or dimension suggestion in your next craft batch.',
        explanationKn: 'ಗ್ರಾಹಕರು ಉತ್ಪನ್ನದ ಸುಧಾರಣೆಗಾಗಿ ಉಪಯುಕ್ತ ಸಲಹೆ ನೀಡಿದ್ದಾರೆ.'
      };
    }

    return {
      type: 'praise',
      labelKn: 'ಮೆಚ್ಚುಗೆ',
      labelEn: 'Praise',
      color: '#059669',
      bg: 'rgba(5, 150, 105, 0.12)',
      nextStepsKn: 'ಗ್ರಾಹಕರಿಗೆ ಧನ್ಯವಾದ ಸಲ್ಲಿಸಿ ಮತ್ತು ನಿಮ್ಮ ಕಲೆಯ ಕಥೆಯನ್ನು ಹಂಚಿಕೊಳ್ಳಿ.',
      nextStepsEn: 'Thank the customer and share your traditional artisan craft story.',
      explanationKn: 'ಗ್ರಾಹಕರು ನಿಮ್ಮ ಕರಕುಶಲ ಕೆಲಸವನ್ನು ಮೆಚ್ಚಿಕೊಂಡಿದ್ದಾರೆ!'
    };
  };

  // Voice speech synthesis
  const speakExplanation = (id, textToSpeak) => {
    if (!('speechSynthesis' in window)) {
      alert(isKn ? 'ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಬೆಂಬಲ ಲಭ್ಯವಿಲ್ಲ.' : 'Speech synthesis not supported in this browser.');
      return;
    }

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = isKn ? 'kn-IN' : 'en-IN';
    utterance.rate = 0.9;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Sync language
  const handleLangToggle = (lang) => {
    setLanguage(lang);
    localStorage.setItem('artisan_language', lang);
  };

  // Fetch real customer reviews from Supabase
  const fetchArtisanReviews = async () => {
    if (!artisan?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      // 1. Fetch all products of this artisan
      const { data: prods, error: prodsErr } = await supabase
        .from('products')
        .select('id, name')
        .eq('artisan_id', artisan.id);

      if (prodsErr) throw prodsErr;

      if (!prods || prods.length === 0) {
        setReviews([]);
        setLoading(false);
        return;
      }

      const pMap = new Map(prods.map(p => [p.id, p]));
      setProductsMap(pMap);
      const productIds = prods.map(p => p.id);

      // 2. Fetch product reviews directly without invalid embedded relation join
      const { data: revData, error: revErr } = await supabase
        .from('product_reviews')
        .select('id, product_id, customer_id, rating, review_text, photo_url, created_at')
        .in('product_id', productIds)
        .order('created_at', { ascending: false });

      if (revErr) throw revErr;

      const reviewList = revData || [];
      setReviews(reviewList);

      // Safe lookup for customer profiles if permitted, fallback to Verified Buyer
      const customerIds = [...new Set(reviewList.map(r => r.customer_id).filter(Boolean))];
      if (customerIds.length > 0) {
        try {
          const { data: profData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', customerIds);
          if (profData && profData.length > 0) {
            setCustomersMap(new Map(profData.map(p => [p.id, p.full_name])));
          }
        } catch {
          // Graceful fallback under privacy policy
        }
      }

      // Initialize AI reply suggestions for reviews
      const initialReplies = new Map();
      reviewList.forEach(r => {
        const rating = Number(r.rating) || 5;
        if (rating >= 4) {
          initialReplies.set(r.id, isKn
            ? 'ಧನ್ಯವಾದಗಳು! ನಮ್ಮ ಕೈಮಗ್ಗದ ಉತ್ಪನ್ನವು ನಿಮಗೆ ಇಷ್ಟವಾಗಿದ್ದಕ್ಕೆ ಸಂತೋಷ. ನಿಮ್ಮ ಪ್ರೋತ್ಸಾಹ ನಮ್ಮ ಕರಕುಶಲ ಕಲೆಗೆ ಸದಾ ಸ್ಫೂರ್ತಿ.'
            : 'Thank you! We are delighted that you love our handcrafted creation. Your patronage supports our indigenous craft heritage.'
          );
        } else {
          initialReplies.set(r.id, isKn
            ? 'ನಿಮ್ಮ ಪ್ರಾಮಾಣಿಕ ಪ್ರತಿಕ್ರಿಯೆಗೆ ಧನ್ಯವಾದಗಳು. ಗುಣಮಟ್ಟವನ್ನು ಮತ್ತಷ್ಟು ಉತ್ತಮಗೊಳಿಸಲು ನಾವು ಶ್ರಮಿಸುತ್ತೇವೆ.'
            : 'Thank you for your valuable feedback. We take craftsmanship very seriously and will strive to improve.'
          );
        }
      });
      setReplyDrafts(initialReplies);

    } catch (err) {
      console.error('Error loading artisan reviews:', err);
      setErrorMsg(isKn ? 'ವಿಮರ್ಶೆಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.' : 'Failed to load customer reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchArtisanReviews();
    }
  }, [artisan, authLoading, isKn]);

  // Summary Metrics
  const metrics = useMemo(() => {
    if (reviews.length === 0) {
      return { totalCount: 0, averageRating: 0, starCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    }

    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;

    reviews.forEach(r => {
      const rating = Math.min(Math.max(Number(r.rating) || 5, 1), 5);
      sum += rating;
      starCounts[rating] = (starCounts[rating] || 0) + 1;
    });

    return {
      totalCount: reviews.length,
      averageRating: (sum / reviews.length).toFixed(1),
      starCounts
    };
  }, [reviews]);

  // Filtered reviews list
  const filteredReviews = useMemo(() => {
    if (filterRating === 'all') return reviews;
    if (filterRating === '5') return reviews.filter(r => Number(r.rating) === 5);
    if (filterRating === '4') return reviews.filter(r => Number(r.rating) === 4);
    if (filterRating === 'critical') return reviews.filter(r => Number(r.rating) <= 3);
    return reviews;
  }, [reviews, filterRating]);

  // Copy reply to clipboard
  const handleCopyReply = (id, text) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Save artisan reply (persisted in localStorage and UI state)
  const handleSaveReply = (id, text) => {
    if (!text || !text.trim()) return;
    const updated = new Map(savedReplies);
    updated.set(id, text.trim());
    setSavedReplies(updated);
    try {
      localStorage.setItem('artisan_saved_review_replies', JSON.stringify(Array.from(updated.entries())));
    } catch (err) {
      console.warn('Failed to save review reply:', err);
    }
    setActiveReplyId(null);
  };

  if (authLoading) {
    return (
      <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem', textAlign: 'center', color: 'var(--text)' }}>
        <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>⏳</div>
        <p style={{ margin: 0, color: 'var(--secondary-text)' }}>
          {isKn ? 'ಖಾತೆ ವಿವರಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...' : 'Loading reviews...'}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '1.5rem', textAlign: 'center', color: 'var(--text)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
        <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem', color: 'var(--primary-green)' }}>
          {isKn ? 'ಲಾಗಿನ್ ಅಗತ್ಯವಿದೆ' : 'Sign In Required'}
        </h2>
        <p style={{ color: 'var(--secondary-text)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          {isKn ? 'ನಿಮ್ಮ ಗ್ರಾಹಕರ ವಿಮರ್ಶೆಗಳನ್ನು ವೀಕ್ಷಿಸಲು ದಯವಿಟ್ಟು ಲಾಗಿನ್ ಆಗಿ.' : 'Please sign in to view your customer reviews.'}
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
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', minHeight: '100vh', boxSizing: 'border-box', color: 'var(--text)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Link to="/" style={{ color: 'var(--primary-green)', textDecoration: 'none', fontSize: '1.25rem', fontWeight: 700 }} title="Back">←</Link>
          <div>
            <h1 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--primary-green)', lineHeight: 1.2 }}>
              {isKn ? 'ಗ್ರಾಹಕರ ವಿಮರ್ಶೆಗಳು' : 'Customer Reviews'}
            </h1>
            <span style={{ fontSize: '0.72rem', color: 'var(--secondary-text)' }}>
              {artisan?.business_name || profile?.full_name || 'Artisan Workshop'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Language Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg, rgba(0,0,0,0.06))', borderRadius: '6px', padding: '2px' }}>
            <button
              type="button"
              onClick={() => handleLangToggle('kn')}
              style={{
                background: isKn ? 'var(--primary-green)' : 'transparent',
                color: isKn ? '#FFFFFF' : 'var(--text)',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.45rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ಕನ್ನಡ
            </button>
            <button
              type="button"
              onClick={() => handleLangToggle('en')}
              style={{
                background: !isKn ? 'var(--primary-green)' : 'transparent',
                color: !isKn ? '#FFFFFF' : 'var(--text)',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.45rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              EN
            </button>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠️ {errorMsg}</span>
          <button onClick={fetchArtisanReviews} style={{ background: '#b91c1c', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}>
            {isKn ? 'ಮರುಪ್ರಯತ್ನಿಸಿ' : 'Retry'}
          </button>
        </div>
      )}

      {/* Summary Scorecard */}
      <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary-green)', lineHeight: 1 }}>
              {metrics.averageRating > 0 ? metrics.averageRating : '—'}
            </div>
            <div>
              <div style={{ color: '#f59e0b', fontSize: '1.2rem', letterSpacing: '2px' }}>
                {'★'.repeat(Math.round(Number(metrics.averageRating) || 0)) + '☆'.repeat(5 - Math.round(Number(metrics.averageRating) || 0))}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--secondary-text)' }}>
                {isKn ? `ಒಟ್ಟು ${metrics.totalCount} ವಿಮರ್ಶೆಗಳು` : `Based on ${metrics.totalCount} customer reviews`}
              </span>
            </div>
          </div>

          <div style={{ minWidth: '150px', flex: 1, fontSize: '0.75rem', color: 'var(--secondary-text)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>5 ★</span>
              <span>{metrics.starCounts[5]}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>4 ★</span>
              <span>{metrics.starCounts[4]}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>≤3 ★</span>
              <span>{(metrics.starCounts[3] || 0) + (metrics.starCounts[2] || 0) + (metrics.starCounts[1] || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {[
          { id: 'all', label: isKn ? 'ಎಲ್ಲವೂ' : 'All Reviews', count: metrics.totalCount },
          { id: '5', label: '5 ★', count: metrics.starCounts[5] },
          { id: '4', label: '4 ★', count: metrics.starCounts[4] },
          { id: 'critical', label: isKn ? 'ಗಮನ ಬೇಕಿದೆ (≤3★)' : 'Needs Care (≤3★)', count: (metrics.starCounts[3] || 0) + (metrics.starCounts[2] || 0) + (metrics.starCounts[1] || 0) }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterRating(tab.id)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '20px',
              border: filterRating === tab.id ? '1px solid var(--primary-green)' : '1px solid var(--border)',
              background: filterRating === tab.id ? 'var(--primary-green)' : 'var(--card-bg, #ffffff)',
              color: filterRating === tab.id ? '#FFFFFF' : 'var(--text)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Reviews List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--secondary-text)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem', animation: 'spin 1s linear infinite' }}>⏳</div>
          <p>{isKn ? 'ವಿಮರ್ಶೆಗಳನ್ನು ಪಡೆಯಲಾಗುತ್ತಿದೆ...' : 'Fetching customer reviews...'}</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px dashed var(--border)', borderRadius: '12px', padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--secondary-text)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💬</div>
          <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem', color: 'var(--text)' }}>
            {isKn ? 'ಯಾವುದೇ ವಿಮರ್ಶೆಗಳು ಲಭ್ಯವಿಲ್ಲ' : 'No Reviews Found'}
          </h3>
          <p style={{ fontSize: '0.85rem', margin: '0 0 1rem', lineHeight: 1.5 }}>
            {filterRating !== 'all'
              ? (isKn ? 'ಆಯ್ಕೆಮಾಡಿದ ಫಿಲ್ಟರ್‌ಗೆ ಯಾವುದೇ ವಿಮರ್ಶೆಗಳಿಲ್ಲ.' : 'No reviews match the selected filter.')
              : (isKn ? 'ನಿಮ್ಮ ಉತ್ಪನ್ನಗಳಿಗೆ ಗ್ರಾಹಕರು ವಿಮರ್ಶೆ ಬರೆದ ನಂತರ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.' : 'Once customers purchase and review your handcrafted items, their feedback will appear here.')
            }
          </p>
          <Link
            to="/my-products"
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              background: 'var(--primary-green)',
              color: '#FFFFFF',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            {isKn ? 'ನನ್ನ ಉತ್ಪನ್ನಗಳನ್ನು ನೋಡಿ' : 'View My Products'}
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filteredReviews.map((rev) => {
            const prod = productsMap.get(rev.product_id);
            const customerName = customersMap.get(rev.customer_id) || rev.profiles?.full_name || (isKn ? 'ಪರಿಶೀಲಿತ ಖರೀದಿದಾರ' : 'Verified Buyer');
            const reviewDate = rev.created_at ? new Date(rev.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '';
            const isReplying = activeReplyId === rev.id;
            const currentReplyText = replyDrafts.get(rev.id) || '';
            const hasSavedReply = savedReplies.has(rev.id);
            const savedReplyText = savedReplies.get(rev.id);
            const classification = classifyReview(rev.review_text, rev.rating);

            return (
              <div
                key={rev.id}
                style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '1rem',
                  boxShadow: 'var(--card-shadow)'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
                      {customerName}
                    </div>
                    {prod && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--primary-green)', fontWeight: 600 }}>
                        📦 {prod.name}
                      </span>
                    )}
                    <div>
                      <span
                        style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: '12px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: classification.bg,
                          color: classification.color,
                          display: 'inline-block',
                          marginTop: '0.2rem'
                        }}
                      >
                        🏷️ {isKn ? classification.labelKn : classification.labelEn}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#f59e0b', fontSize: '0.9rem' }}>
                      {'★'.repeat(Number(rev.rating) || 5) + '☆'.repeat(5 - (Number(rev.rating) || 5))}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)' }}>{reviewDate}</span>
                  </div>
                </div>

                {/* Review Text */}
                <p style={{ fontSize: '0.86rem', color: 'var(--text)', lineHeight: 1.5, margin: '0.4rem 0 0.6rem', fontStyle: 'italic' }}>
                  "{rev.review_text || (isKn ? 'ಯಾವುದೇ ವಿವರಣೆ ಬರೆದಿಲ್ಲ.' : 'Rating submitted without written comment.')}"
                </p>

                {/* Review Photo Attachment */}
                {rev.photo_url && (
                  <div style={{ marginBottom: '0.6rem' }}>
                    <img
                      src={rev.photo_url}
                      alt="Customer review attachment"
                      style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                )}

                {/* Sentiment & Local-Language Analysis Card */}
                <div
                  style={{
                    background: 'var(--chat-bg, #f8f5ee)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.8rem',
                    border: '1px solid var(--border)',
                    marginBottom: '0.6rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--primary-green)' }}>
                      🔍 {isKn ? 'ವಿಮರ್ಶೆ ವಿಶ್ಲೇಷಣೆ (Bilingual Insight)' : 'Review Analysis'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        speakExplanation(
                          rev.id,
                          isKn
                            ? `${classification.explanationKn} ಶಿಫಾರಸು: ${classification.nextStepsKn}`
                            : `${classification.labelEn}. Recommendation: ${classification.nextStepsEn}`
                        )
                      }
                      style={{
                        background: speakingId === rev.id ? '#dc2626' : 'var(--card-bg, #ffffff)',
                        color: speakingId === rev.id ? '#ffffff' : 'var(--primary-green)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {speakingId === rev.id ? (isKn ? '⏹ ನಿಲ್ಲಿಸಿ' : '⏹ Stop') : (isKn ? '🔊 ಧ್ವನಿ ವಿವರಣೆ' : '🔊 Listen')}
                    </button>
                  </div>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.4 }}>
                    <strong>💡 {isKn ? 'ವಿವರಣೆ:' : 'Meaning:'}</strong> {classification.explanationKn}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--primary-green)', fontWeight: 600, lineHeight: 1.4 }}>
                    <strong>🎯 {isKn ? 'ಮುಂದಿನ ಕ್ರಮ:' : 'Suggested Next Step:'}</strong>{' '}
                    {isKn ? classification.nextStepsKn : classification.nextStepsEn}
                  </p>
                </div>

                {/* Saved Artisan Reply Display */}
                {hasSavedReply && !isReplying && (
                  <div
                    style={{
                      background: 'rgba(7, 94, 84, 0.08)',
                      borderRadius: '8px',
                      padding: '0.65rem 0.8rem',
                      border: '1px solid var(--primary-green)',
                      marginTop: '0.6rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--primary-green)' }}>
                        ✓ {isKn ? 'ನಿಮ್ಮ ಪ್ರತ್ಯುತ್ತರ (Your Reply)' : 'Your Response to Customer'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReplyId(rev.id);
                          const drafts = new Map(replyDrafts);
                          drafts.set(rev.id, savedReplyText);
                          setReplyDrafts(drafts);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary-green)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        {isKn ? 'ತಿದ್ದಿ ✏️' : 'Edit ✏️'}
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.45 }}>
                      "{savedReplyText}"
                    </p>
                  </div>
                )}

                {/* AI Reply / Edit Section */}
                {(!hasSavedReply || isReplying) && (
                  <div style={{ background: 'var(--chat-bg, #f8f5ee)', borderRadius: '8px', padding: '0.65rem 0.8rem', border: '1px solid var(--border)', marginTop: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--primary-green)' }}>
                        ✨ {isKn ? 'AI ಪ್ರತಿಕ್ರಿಯೆ ಕರಡು (Suggested Reply)' : 'AI-Assisted Reply Draft'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveReplyId(isReplying ? null : rev.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary-green)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        {isReplying ? (isKn ? 'ಮುಚ್ಚಿ ▲' : 'Close ▲') : (isKn ? 'ತಿದ್ದಿ / ಸಂಪಾದಿಸಿ ✏️' : 'Edit ✏️')}
                      </button>
                    </div>

                    {isReplying ? (
                      <div style={{ marginTop: '0.4rem' }}>
                        <textarea
                          rows={3}
                          value={currentReplyText}
                          onChange={(e) => {
                            const updated = new Map(replyDrafts);
                            updated.set(rev.id, e.target.value);
                            setReplyDrafts(updated);
                          }}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: 'var(--card-bg, #ffffff)',
                            color: 'var(--text)',
                            fontSize: '0.82rem',
                            fontFamily: 'inherit',
                            boxSizing: 'border-box'
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handleCopyReply(rev.id, currentReplyText)}
                            style={{
                              background: copiedId === rev.id ? '#16a34a' : 'var(--card-bg, #ffffff)',
                              color: copiedId === rev.id ? '#FFFFFF' : 'var(--primary-green)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              padding: '0.3rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {copiedId === rev.id ? '✓ ' + (isKn ? 'ಕಾಪಿ ಆಗಿದೆ' : 'Copied!') : (isKn ? 'ಕಾಪಿ ಮಾಡಿ' : 'Copy')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveReply(rev.id, currentReplyText)}
                            style={{
                              background: 'var(--primary-green)',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.3rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            💾 {isKn ? 'ಉತ್ತರ ಉಳಿಸಿ' : 'Save Reply'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--secondary-text)', lineHeight: 1.4, flex: 1 }}>
                          {currentReplyText}
                        </p>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button
                            type="button"
                            onClick={() => handleCopyReply(rev.id, currentReplyText)}
                            title="Copy to clipboard"
                            style={{
                              background: copiedId === rev.id ? '#16a34a' : 'var(--card-bg, #ffffff)',
                              color: copiedId === rev.id ? '#FFFFFF' : 'var(--primary-green)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          >
                            {copiedId === rev.id ? '✓' : (isKn ? 'ಕಾಪಿ' : 'Copy')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveReply(rev.id, currentReplyText)}
                            title="Save this reply"
                            style={{
                              background: 'var(--primary-green)',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          >
                            💾 {isKn ? 'ಉಳಿಸಿ' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CustomerFeedbackPage;
