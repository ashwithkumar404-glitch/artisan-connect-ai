import React from 'react';
import StarRating from './StarRating';

/**
 * ReviewSummary component displaying overall average, total count,
 * and breakdown distribution bars for 5, 4, 3, 2, and 1-star ratings.
 * Allows clicking on a star bar to filter reviews.
 */
export default function ReviewSummary({
  reviews = [],
  activeStarFilter = null,
  onStarFilterChange
}) {
  const totalReviews = reviews.length;

  if (totalReviews === 0) {
    return null;
  }

  const sumRatings = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
  const averageRating = (sumRatings / totalReviews).toFixed(1);

  // Calculate counts for 1 to 5 stars
  const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 0)));
    starCounts[star] = (starCounts[star] || 0) + 1;
  });

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 md:p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        {/* Overall Score Highlight */}
        <div className="md:col-span-4 text-center md:text-left flex flex-col items-center md:items-start justify-center border-b md:border-b-0 md:border-r border-slate-200 pb-6 md:pb-0 md:pr-6">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold text-slate-900 tracking-tight">
              {averageRating}
            </span>
            <span className="text-slate-400 font-semibold text-lg">/ 5</span>
          </div>

          <div className="my-2">
            <StarRating rating={Number(averageRating)} size="md" />
          </div>

          <p className="text-xs font-semibold text-slate-600 m-0">
            Based on {totalReviews} {totalReviews === 1 ? 'verified review' : 'verified reviews'}
          </p>

          {activeStarFilter && (
            <button
              type="button"
              onClick={() => onStarFilterChange && onStarFilterChange(null)}
              className="mt-3 text-xs text-gov-navy font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>✕</span> Reset star filter
            </button>
          )}
        </div>

        {/* Rating Distribution Bars */}
        <div className="md:col-span-8 space-y-2.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = starCounts[star] || 0;
            const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
            const isSelected = activeStarFilter === star;

            return (
              <button
                key={star}
                type="button"
                onClick={() => {
                  if (onStarFilterChange) {
                    onStarFilterChange(isSelected ? null : star);
                  }
                }}
                className={`w-full group flex items-center gap-3 p-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  isSelected ? 'bg-amber-100/60 ring-1 ring-amber-400' : 'hover:bg-slate-100'
                }`}
                title={`Filter by ${star} star reviews (${count})`}
              >
                <div className="w-14 text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0">
                  <span>{star}</span>
                  <span className="text-amber-500">★</span>
                </div>

                {/* Progress Bar Container */}
                <div className="flex-grow h-3 bg-slate-200 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      isSelected ? 'bg-amber-600' : 'bg-amber-400 group-hover:bg-amber-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                    role="progressbar"
                    aria-valuenow={percentage}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  />
                </div>

                {/* Count and Percentage */}
                <div className="w-16 text-right shrink-0 flex items-center justify-end gap-1">
                  <span className="text-xs font-bold text-slate-800">{count}</span>
                  <span className="text-[10px] text-slate-400 font-medium">({percentage}%)</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

