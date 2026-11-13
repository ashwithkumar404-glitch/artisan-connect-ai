import React, { useState } from 'react';

/**
 * Reusable accessible StarRating component.
 * Supports both display mode (read-only with decimal support)
 * and interactive mode (hover, click, keyboard selection for reviews).
 */
export default function StarRating({
  rating = 0,
  maxRating = 5,
  size = 'md', // 'sm' | 'md' | 'lg'
  interactive = false,
  onChange,
  showScore = false,
  showCount = null,
  className = '',
  ariaLabel
}) {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  };

  const textClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base font-bold',
  };

  const currentRating = interactive && hoverRating > 0 ? hoverRating : rating;

  const labels = {
    1: '1 star - Poor',
    2: '2 stars - Fair',
    3: '3 stars - Good',
    4: '4 stars - Very Good',
    5: '5 stars - Excellent',
  };

  const handleStarClick = (value) => {
    if (interactive && onChange) {
      onChange(value);
    }
  };

  const handleKeyDown = (e, value) => {
    if (interactive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleStarClick(value);
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={ariaLabel || `${rating} out of ${maxRating} stars`}
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxRating }, (_, index) => {
          const starValue = index + 1;
          const isFilled = currentRating >= starValue;
          const isHalf = !isFilled && currentRating >= starValue - 0.5 && !interactive;

          return (
            <button
              key={starValue}
              type="button"
              disabled={!interactive}
              onClick={() => handleStarClick(starValue)}
              onMouseEnter={() => interactive && setHoverRating(starValue)}
              onMouseLeave={() => interactive && setHoverRating(0)}
              onKeyDown={(e) => handleKeyDown(e, starValue)}
              className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded p-0.5' : 'cursor-default pointer-events-none p-0'} inline-flex items-center justify-center`}
              role={interactive ? 'radio' : 'presentation'}
              aria-checked={interactive ? rating === starValue : undefined}
              aria-label={interactive ? labels[starValue] || `${starValue} stars` : undefined}
              tabIndex={interactive ? 0 : -1}
            >
              <svg
                className={`${sizeClasses[size] || sizeClasses.md} transition-colors`}
                viewBox="0 0 20 20"
                fill={isFilled ? '#f59e0b' : isHalf ? 'url(#half-star)' : '#e2e8f0'}
                stroke={isFilled || isHalf ? '#d97706' : '#cbd5e1'}
                strokeWidth="1"
                aria-hidden="true"
              >
                {isHalf && (
                  <defs>
                    <linearGradient id="half-star">
                      <stop offset="50%" stopColor="#f59e0b" />
                      <stop offset="50%" stopColor="#e2e8f0" />
                    </linearGradient>
                  </defs>
                )}
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          );
        })}
      </div>

      {showScore && (
        <span className={`font-bold text-amber-700 ${textClasses[size] || textClasses.md}`}>
          {Number(rating).toFixed(1)}
        </span>
      )}

      {showCount !== null && showCount !== undefined && (
        <span className="text-xs text-slate-500 font-normal">
          ({showCount})
        </span>
      )}
    </div>
  );
}

