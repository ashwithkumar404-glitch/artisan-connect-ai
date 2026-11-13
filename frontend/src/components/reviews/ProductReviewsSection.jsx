import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ReviewSummary from './ReviewSummary';
import ReviewCard from './ReviewCard';
import ReviewForm from './ReviewForm';

/**
 * ProductReviewsSection coordinates the entire Customer Reviews & Ratings experience:
 * - Real data retrieval from Supabase without fragile foreign-key joins
 * - Review summary with live distribution bars
 * - Sorting by newest, highest, lowest rating
 * - Star filtering
 * - Write a Review interface with verified purchase gating
 * - Professional empty state: "Be the first to review this product."
 */
export default function ProductReviewsSection({ productId, productName }) {
  const [reviews, setReviews] = useState([]);
  const [customersMap, setCustomersMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI Controls: Sorting, Filtering, Write Review toggle
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'highest' | 'lowest'
  const [activeStarFilter, setActiveStarFilter] = useState(null); // null or 1-5
  const [isWriteFormOpen, setIsWriteFormOpen] = useState(false);

  // Fetch reviews and profiles directly from Supabase
  const loadProductReviews = useCallback(async () => {
    if (!productId) return;

    try {
      setLoading(true);
      setError('');

      // 1. Fetch reviews directly from product_reviews table using exact database columns
      const { data: revData, error: revError } = await supabase
        .from('product_reviews')
        .select(`
          id,
          product_id,
          customer_id,
          order_id,
          rating,
          review_text,
          photo_url,
          created_at
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (revError) {
        throw revError;
      }

      const reviewList = revData || [];
      setReviews(reviewList);

      // 2. Fetch associated customer profiles in a safe secondary lookup
      const customerIds = [
        ...new Set(reviewList.map((r) => r.customer_id).filter(Boolean)),
      ];

      if (customerIds.length > 0) {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', customerIds);

          if (profileData && profileData.length > 0) {
            const pMap = new Map();
            profileData.forEach((prof) => pMap.set(prof.id, prof));
            setCustomersMap(pMap);
          }
        } catch (profileErr) {
          console.warn('Profile lookup fallback for reviews:', profileErr);
        }
      }
    } catch (err) {
      console.error('Error fetching product reviews:', err);
      setError(err.message || 'Unable to load customer reviews at this time.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProductReviews();
  }, [loadProductReviews]);

  // Derived sorted and filtered reviews
  const filteredAndSortedReviews = useMemo(() => {
    let result = [...reviews];

    // Filter by star rating if active
    if (activeStarFilter !== null) {
      result = result.filter(
        (r) => Math.round(Number(r.rating) || 0) === activeStarFilter
      );
    }

    // Sort reviews
    result.sort((a, b) => {
      if (sortBy === 'highest') {
        return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      }
      if (sortBy === 'lowest') {
        return (Number(a.rating) || 0) - (Number(b.rating) || 0);
      }
      // 'newest' default
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    return result;
  }, [reviews, activeStarFilter, sortBy]);

  const handleReviewSubmitted = () => {
    loadProductReviews();
  };

  return (
    <section
      className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm space-y-8"
      aria-labelledby="reviews-heading"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-amber-500 text-2xl" role="img" aria-hidden="true">★</span>
            <h2 id="reviews-heading" className="text-2xl font-extrabold text-gov-navy m-0">
              Customer Reviews & Ratings
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 m-0">
            Authentic feedback from verified customers who received this handcrafted item.
          </p>
        </div>

        {/* Action button to open review form */}
        <button
          type="button"
          onClick={() => setIsWriteFormOpen((prev) => !prev)}
          className="bg-gov-navy hover:bg-gov-navy-light text-white font-bold text-sm px-5 py-2.5 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-2 self-start sm:self-auto min-h-[44px] shadow-sm"
        >
          <span>✍️</span>
          <span>{isWriteFormOpen ? 'Close Review Form' : 'Write a Review'}</span>
        </button>
      </div>

      {/* Write Review Form Area (Collapsible) */}
      {isWriteFormOpen && (
        <div className="animate-fade-in">
          <ReviewForm
            productId={productId}
            productName={productName}
            onReviewSubmitted={() => {
              handleReviewSubmitted();
            }}
            onCancel={() => setIsWriteFormOpen(false)}
          />
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3 text-slate-500">
          <div className="w-8 h-8 border-3 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold">Loading customer reviews...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-xl p-5 text-sm font-semibold flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadProductReviews}
            className="px-3.5 py-1.5 bg-gov-navy text-white text-xs font-bold rounded hover:bg-gov-navy-light transition-colors cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      ) : reviews.length === 0 ? (
        /* Empty State */
        <div className="border-2 border-dashed border-slate-200 bg-slate-50/70 rounded-2xl p-10 sm:p-14 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 border border-amber-200 flex items-center justify-center mx-auto text-3xl shadow-inner">
            ★
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-800 m-0">
              Be the first to review this product.
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto m-0 leading-relaxed font-sans">
              Have you purchased this authentic handcrafted creation? Share your thoughts and help other craft lovers discover traditional Indian artistry.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setIsWriteFormOpen(true)}
              className="bg-gov-navy hover:bg-gov-navy-light text-white font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2 min-h-[44px] shadow-sm"
            >
              <span>✍️</span>
              <span>Write the First Review</span>
            </button>
          </div>
        </div>
      ) : (
        /* Reviews Active Content */
        <div className="space-y-8">
          {/* Rating Summary & Distribution Bars */}
          <ReviewSummary
            reviews={reviews}
            activeStarFilter={activeStarFilter}
            onStarFilterChange={(star) => setActiveStarFilter(star)}
          />

          {/* Sorting & Filter Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="text-xs font-bold text-slate-600">
              Showing {filteredAndSortedReviews.length} of {reviews.length}{' '}
              {reviews.length === 1 ? 'review' : 'reviews'}
              {activeStarFilter && (
                <span className="text-amber-700 ml-1.5 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  ({activeStarFilter} ★ only)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <label htmlFor="review-sort-select" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Sort:
              </label>
              <select
                id="review-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-gov-navy cursor-pointer"
              >
                <option value="newest">Most Recent</option>
                <option value="highest">Highest Rating</option>
                <option value="lowest">Lowest Rating</option>
              </select>
            </div>
          </div>

          {/* List of Review Cards */}
          {filteredAndSortedReviews.length === 0 ? (
            <div className="bg-slate-50 rounded-xl p-8 text-center text-sm text-slate-500">
              No reviews match the selected {activeStarFilter}-star filter.{' '}
              <button
                type="button"
                onClick={() => setActiveStarFilter(null)}
                className="text-gov-navy font-bold underline cursor-pointer ml-1"
              >
                Show all reviews
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedReviews.map((rev) => (
                <ReviewCard
                  key={rev.id}
                  review={rev}
                  customerProfile={customersMap.get(rev.customer_id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
