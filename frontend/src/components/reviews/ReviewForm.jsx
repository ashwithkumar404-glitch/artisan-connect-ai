import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import StarRating from './StarRating';

/**
 * ReviewForm allows verified customers to submit a rating and review for a product.
 * Enforces backend RLS rules: only customers with delivered orders for this product can submit.
 */
export default function ReviewForm({
  productId,
  productName,
  onReviewSubmitted,
  onCancel
}) {
  const { user } = useAuth();

  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('positive');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Verification & eligibility states
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [eligibleOrder, setEligibleOrder] = useState(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Check if authenticated user has an eligible delivered order and whether they already reviewed
  useEffect(() => {
    let active = true;

    async function checkUserEligibility() {
      if (!user || !productId) {
        setCheckingEligibility(false);
        return;
      }

      try {
        setCheckingEligibility(true);
        setSubmitError('');

        // 1. Check if the user already submitted a review for this product
        const { data: existingReview, error: exErr } = await supabase
          .from('product_reviews')
          .select('id, rating, review_text, created_at')
          .eq('product_id', productId)
          .eq('customer_id', user.id)
          .maybeSingle();

        if (exErr && exErr.code !== 'PGRST116') {
          console.warn('Error checking existing review:', exErr);
        }

        if (active && existingReview) {
          setAlreadyReviewed(existingReview);
          setCheckingEligibility(false);
          return;
        }

        // 2. Check for delivered orders containing this product
        const { data: deliveredOrders, error: ordErr } = await supabase
          .from('orders')
          .select(`
            id,
            status,
            order_items!inner (
              id,
              product_id
            )
          `)
          .eq('customer_id', user.id)
          .eq('status', 'delivered')
          .eq('order_items.product_id', productId)
          .limit(1);

        if (ordErr) {
          console.warn('Error checking delivered orders:', ordErr);
        }

        if (active) {
          if (deliveredOrders && deliveredOrders.length > 0) {
            setEligibleOrder({
              orderId: deliveredOrders[0].id,
            });
          } else {
            setEligibleOrder(null);
          }
        }
      } catch (err) {
        console.error('Error verifying review eligibility:', err);
      } finally {
        if (active) {
          setCheckingEligibility(false);
        }
      }
    }

    checkUserEligibility();

    return () => {
      active = false;
    };
  }, [user, productId]);

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSubmitError('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('Image size must be less than 5 MB.');
      return;
    }

    setPhotoFile(file);
    setSubmitError('');
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const handleRemovePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess(false);

    if (!user) {
      setSubmitError('Please log in to submit a review.');
      return;
    }

    if (!eligibleOrder) {
      setSubmitError(
        'Reviews are only permitted for customers with a verified, delivered order for this product.'
      );
      return;
    }

    if (rating < 1 || rating > 5) {
      setSubmitError('Please select a rating between 1 and 5 stars.');
      return;
    }

    if (!reviewText.trim()) {
      setSubmitError('Please write a brief description of your experience with this craft.');
      return;
    }

    try {
      setIsSubmitting(true);
      let photoUrl = null;

      // Upload review photo if selected
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `reviews/${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('review-photos')
          .upload(filePath, photoFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.warn('Storage upload error:', uploadError);
          // If storage bucket is not available or restricted, continue without photo rather than blocking the review
        } else {
          const { data: urlData } = supabase.storage
            .from('review-photos')
            .getPublicUrl(filePath);
          photoUrl = urlData?.publicUrl || null;
        }
      }

      const combinedReviewText = reviewTitle.trim()
        ? `${reviewTitle.trim()}\n\n${reviewText.trim()}`
        : reviewText.trim();

      // Insert review record into Supabase matching exact database columns
      const insertPayload = {
        product_id: productId,
        customer_id: user.id,
        order_id: eligibleOrder.orderId,
        rating: parseInt(rating, 10),
        review_text: combinedReviewText || null,
        photo_url: photoUrl,
      };

      const { data, error: insertError } = await supabase
        .from('product_reviews')
        .insert(insertPayload)
        .select('id, product_id, customer_id, order_id, rating, review_text, photo_url, created_at')
        .single();

      if (insertError) {
        throw insertError;
      }

      // Success confirmed by database!
      setSubmitSuccess(true);
      setAlreadyReviewed(data || insertPayload);
      if (onReviewSubmitted) {
        onReviewSubmitted(data || insertPayload);
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      setSubmitError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // State 1: Unauthenticated
  if (!user) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-4">
        <span className="text-3xl block" role="img" aria-label="Review Lock">✍️</span>
        <h4 className="text-base font-bold text-slate-800 m-0">
          Have you purchased this craft?
        </h4>
        <p className="text-sm text-slate-600 max-w-md mx-auto m-0">
          Sign in to your customer account to leave a verified review and rating for {productName || 'this product'}.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center bg-gov-navy hover:bg-gov-navy-light text-white font-bold text-sm px-6 py-2.5 rounded-lg transition-colors cursor-pointer min-h-[44px]"
        >
          Sign In to Write a Review
        </Link>
      </div>
    );
  }

  // State 2: Checking Eligibility
  if (checkingEligibility) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center flex items-center justify-center gap-3 text-sm text-slate-500">
        <div className="w-5 h-5 border-2 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
        <span>Checking verified purchase eligibility...</span>
      </div>
    );
  }

  // State 3: Already Reviewed
  if (alreadyReviewed) {
    return (
      <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
          <span className="text-lg">✓</span>
          <span>Thank you! You have reviewed this product.</span>
        </div>
        <p className="text-xs text-emerald-800 m-0">
          Your feedback helps authentic Indian artisans flourish and guides other customers in discovering authentic craftwork.
        </p>
        <div className="bg-white/80 border border-emerald-200 rounded-lg p-3.5 space-y-2 mt-2">
          <div className="flex items-center justify-between">
            <StarRating rating={alreadyReviewed.rating || 5} size="sm" showScore />
            {alreadyReviewed.created_at && (
              <span className="text-[11px] text-slate-400">
                {new Date(alreadyReviewed.created_at).toLocaleDateString('en-IN')}
              </span>
            )}
          </div>
          {alreadyReviewed.review_text && (
            <p className="text-xs text-slate-700 italic m-0">
              "{alreadyReviewed.review_text}"
            </p>
          )}
        </div>
      </div>
    );
  }

  // State 4: Authenticated but has no delivered order for this product
  if (!eligibleOrder) {
    return (
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <span className="text-lg">🛡️</span>
          <span>Verified Customer Reviews Only</span>
        </div>
        <p className="text-xs text-amber-850 leading-relaxed m-0 font-sans">
          To maintain trust and support genuine craft heritage, reviews on Artisan Connect AI can only be submitted by customers who have ordered and received this handcrafted creation.
        </p>
        <p className="text-xs text-slate-500 m-0">
          If you have recently ordered this item, you can review it as soon as delivery is confirmed in your{' '}
          <Link to="/profile" className="text-gov-navy font-bold underline hover:text-gov-navy-light">
            Customer Profile
          </Link>
          .
        </p>
      </div>
    );
  }

  // State 5: Eligible customer can write a review!
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-50 border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h4 className="text-base font-bold text-gov-navy m-0">
            Write a Customer Review
          </h4>
          <p className="text-xs text-slate-500 mt-1 m-0">
            Sharing your experience helps the artisan and fellow craft admirers.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Error Banner */}
      {submitError && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-xs font-semibold rounded-lg p-3.5 flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span>{submitError}</span>
        </div>
      )}

      {/* Success Banner */}
      {submitSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-lg p-3.5 flex items-center gap-2">
          <span className="text-base">✓</span>
          <span>Review submitted successfully! Thank you for supporting our artisans.</span>
        </div>
      )}

      {/* Star Rating Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Your Overall Rating <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-3">
          <StarRating
            rating={rating}
            size="lg"
            interactive
            onChange={(newRating) => setRating(newRating)}
          />
          <span className="text-xs font-bold text-slate-700">
            {rating === 5 && '5 - Excellent'}
            {rating === 4 && '4 - Very Good'}
            {rating === 3 && '3 - Good'}
            {rating === 2 && '2 - Fair'}
            {rating === 1 && '1 - Poor'}
          </span>
        </div>
      </div>

      {/* Feedback Category */}
      <div className="space-y-1.5">
        <label htmlFor="review-category" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Review Category
        </label>
        <select
          id="review-category"
          value={feedbackCategory}
          onChange={(e) => setFeedbackCategory(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
        >
          <option value="positive">Highly Recommended</option>
          <option value="general">General Experience</option>
          <option value="quality_issue">Craftsmanship & Materials</option>
          <option value="delivery_issue">Packaging & Shipping</option>
          <option value="suggestion">Artisan Suggestion</option>
        </select>
      </div>

      {/* Review Title */}
      <div className="space-y-1.5">
        <label htmlFor="review-title" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Review Title (Optional)
        </label>
        <input
          id="review-title"
          type="text"
          value={reviewTitle}
          onChange={(e) => setReviewTitle(e.target.value)}
          placeholder="e.g. Exceptional craftsmanship, authentic handwoven quality"
          maxLength={120}
          className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
        />
      </div>

      {/* Review Description */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label htmlFor="review-text" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Your Review <span className="text-red-500">*</span>
          </label>
          <span className="text-[11px] text-slate-400">
            {reviewText.length} characters
          </span>
        </div>
        <textarea
          id="review-text"
          rows={4}
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="What did you think of the craft quality, packaging, and detail? How does it look in your home?"
          required
          className="w-full p-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-gov-navy focus:border-gov-navy leading-relaxed"
        />
      </div>

      {/* Optional Photo Attachment */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Add Photo (Optional)
        </label>
        {photoPreview ? (
          <div className="flex items-center gap-4">
            <div className="relative rounded-lg overflow-hidden border border-slate-300 w-20 h-20">
              <img
                src={photoPreview}
                alt="Selected preview"
                className="w-full h-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="text-xs text-red-600 hover:text-red-800 font-bold cursor-pointer"
            >
              Remove photo
            </button>
          </div>
        ) : (
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-bold text-slate-700 cursor-pointer shadow-sm transition-colors min-h-[40px]">
            <span>📷</span>
            <span>Upload Photo</span>
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </label>
        )}
        <p className="text-[11px] text-slate-400 m-0">Max 5MB (JPG, PNG, or WebP)</p>
      </div>

      {/* Submit Button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !reviewText.trim()}
          className="bg-gov-navy hover:bg-gov-navy-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm px-6 py-3 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-2 min-h-[44px] shadow-sm"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Submitting Review...</span>
            </>
          ) : (
            <span>Submit Review</span>
          )}
        </button>
      </div>
    </form>
  );
}

