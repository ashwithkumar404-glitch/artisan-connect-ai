import React, { useState } from 'react';
import StarRating from './StarRating';

/**
 * ReviewCard renders an individual customer review card with customer avatar/initials,
 * verified purchase badge, star rating, formatted date, text, and optional photo.
 */
export default function ReviewCard({ review, customerProfile }) {
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  if (!review) return null;

  const customerName =
    customerProfile?.full_name ||
    review.profiles?.full_name ||
    'Verified Customer';

  const customerAvatar = customerProfile?.avatar_url || review.profiles?.avatar_url || null;

  const getInitials = (name) => {
    if (!name) return 'VC';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const formattedDate = review.created_at
    ? new Date(review.created_at).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  // Verified purchase check: real order_id reference indicates an authentic confirmed order
  const isVerifiedPurchase = Boolean(review.order_id);

  // Category mapping
  const categoryLabels = {
    positive: '✨ Highly Recommended',
    quality_issue: '🔍 Craft Feedback',
    delivery_issue: '📦 Delivery Feedback',
    suggestion: '💡 Suggestion',
    general: null,
  };
  const categoryLabel = categoryLabels[review.feedback_category] || null;

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow space-y-4">
      {/* Header: User Avatar, Name, Verified Badge, Date & Rating */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          {/* Avatar or Initials */}
          {customerAvatar ? (
            <img
              src={customerAvatar}
              alt={customerName}
              className="w-10 h-10 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full bg-slate-100 text-gov-navy border border-slate-300 font-bold text-sm flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              {getInitials(customerName)}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-slate-900">{customerName}</span>
              {isVerifiedPurchase && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
                  <span className="text-emerald-700 font-bold">✓</span> Verified Purchase
                </span>
              )}
            </div>
            {formattedDate && (
              <time
                dateTime={review.created_at}
                className="text-[11px] text-slate-500 block mt-0.5"
              >
                Reviewed on {formattedDate}
              </time>
            )}
          </div>
        </div>

        {/* Star Rating Display */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <StarRating rating={Number(review.rating) || 5} size="sm" showScore />
        </div>
      </div>

      {/* Category Tag if present */}
      {categoryLabel && (
        <span className="inline-block text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
          {categoryLabel}
        </span>
      )}

      {/* Review Text */}
      {review.review_text && (
        <p className="text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-line m-0">
          {review.review_text}
        </p>
      )}

      {/* Review Photo Attachment */}
      {review.photo_url && (
        <div>
          <button
            type="button"
            onClick={() => setIsPhotoModalOpen(true)}
            className="group relative rounded-lg overflow-hidden border border-slate-200 block focus:outline-none focus-visible:ring-2 focus-visible:ring-gov-navy cursor-pointer"
            aria-label="Enlarge customer review photo"
          >
            <img
              src={review.photo_url}
              alt="Customer product photo"
              className="w-24 h-24 sm:w-28 sm:h-28 object-cover group-hover:scale-105 transition-transform duration-200"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
              🔍 View
            </span>
          </button>
        </div>
      )}

      {/* Photo Modal */}
      {isPhotoModalOpen && review.photo_url && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setIsPhotoModalOpen(false)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] bg-white rounded-xl p-2 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(false)}
              className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm cursor-pointer z-10"
              aria-label="Close image modal"
            >
              ✕
            </button>
            <img
              src={review.photo_url}
              alt="Full size customer photo"
              className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </article>
  );
}

