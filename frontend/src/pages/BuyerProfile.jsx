import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Button from '../components/Button';

export default function BuyerProfile() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Orders data
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Reviews data
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeReviewItemId, setActiveReviewItemId] = useState(null); // stores order_item_id or product_id under review
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Enquiries data
  const [enquiries, setEnquiries] = useState([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState(true);

  // Initialize input fields when the profile finishes loading
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  // Load orders, reviews, and enquiries based on the active tab
  useEffect(() => {
    if (user) {
      if (activeTab === 'orders') {
        loadOrders();
      } else if (activeTab === 'reviews') {
        loadReviewsData();
      } else if (activeTab === 'enquiries') {
        loadEnquiries();
      }
    }
  }, [user, activeTab]);

  const handleTabChange = (tabName) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tabName);
    setSearchParams(newParams);
  };

  const loadOrders = async () => {
    try {
      setLoadingOrders(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          shipping_name,
          shipping_phone,
          shipping_address,
          shipping_city,
          shipping_state,
          shipping_pincode,
          created_at,
          order_items (
            id,
            quantity,
            unit_price,
            subtotal,
            products (
              id,
              name,
              product_images (
                image_url
              )
            )
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (e) {
      console.error('Error loading buyer orders:', e);
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadReviewsData = async () => {
    try {
      setLoadingReviews(true);
      
      // Fetch user's written reviews
      const { data: written, error: revErr } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('customer_id', user.id);

      if (revErr) throw revErr;
      setReviews(written || []);

      // Load delivered orders to match products for review
      const { data: deliveredOrders, error: ordErr } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          created_at,
          order_items (
            id,
            product_id,
            quantity,
            products (
              id,
              name,
              product_images (
                image_url
              )
            )
          )
        `)
        .eq('customer_id', user.id)
        .eq('status', 'delivered');

      if (ordErr) throw ordErr;
      setOrders(deliveredOrders || []);

    } catch (e) {
      console.error('Error loading reviews data:', e);
    } finally {
      setLoadingReviews(false);
    }
  };

  const loadEnquiries = async () => {
    try {
      setLoadingEnquiries(true);
      const { data, error } = await supabase
        .from('enquiries')
        .select(`
          id,
          message,
          quantity,
          preferred_delivery_date,
          budget,
          reference_image_url,
          artisan_response,
          status,
          created_at,
          products (
            id,
            name
          ),
          artisans (
            id,
            business_name
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEnquiries(data || []);
    } catch (e) {
      console.error('Error loading customer enquiries:', e);
    } finally {
      setLoadingEnquiries(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSuccessMessage('');

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: trimmedName || null,
          phone: trimmedPhone || null
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setSuccessMessage('Your profile has been updated successfully!');
    } catch (err) {
      console.error("Profile update exception:", err);
      setSubmitError(err.message || 'Failed to update profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReview = async (orderId, productId) => {
    setReviewError('');
    setUploadingPhoto(true);

    try {
      let imageUrl = null;
      if (reviewPhoto) {
        const fileExt = reviewPhoto.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `reviews/${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('review-photos')
          .upload(filePath, reviewPhoto);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('review-photos')
          .getPublicUrl(filePath);

        imageUrl = publicUrlData?.publicUrl;
      }

      console.log('SUBMITTING REVIEW DIAGNOSTICS:', {
        userId: user?.id,
        customerId: user?.id,
        orderId,
        productId,
        rating: parseInt(reviewRating, 10),
        reviewText: reviewText.trim() || null
      });

      const { error: insertErr } = await supabase
        .from('product_reviews')
        .insert({
          product_id: productId,
          customer_id: user.id,
          order_id: orderId,
          rating: parseInt(reviewRating, 10),
          review_text: reviewText.trim() || null,
          photo_url: imageUrl
        });

      if (insertErr) throw insertErr;

      setReviewText('');
      setReviewPhoto(null);
      setActiveReviewItemId(null);
      setReviewSuccess(true);
      await loadReviewsData();
    } catch (err) {
      console.error('Error placing review:', err);
      setReviewError(err.message || 'Failed to submit review.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Stepper statuses helpers
  const timelineSteps = ['placed', 'confirmed', 'preparing', 'shipped', 'delivered'];
  const getStepIndex = (status) => timelineSteps.indexOf(status);

  // If session or profile is loading, render a spinner
  if (authLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-655">Loading secure profile...</p>
        </div>
      </div>
    );
  }

  // If no user is authenticated, redirect to login
  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4 bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gov-navy m-0">Access Denied</h3>
        <p className="text-slate-500 text-sm">Please login to view and manage your profile details.</p>
        <Button onClick={() => navigate('/login')} variant="primary" className="shadow-sm">
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Dashboard Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gov-navy m-0">Customer Portal</h2>
          <p className="text-sm text-slate-500 mt-1">Track orders, write reviews, and ask artisans custom designs.</p>
        </div>
        <div className="flex items-center gap-1.5 border border-slate-200 bg-white p-1 rounded shadow-sm w-fit">
          <button
            onClick={() => handleTabChange('profile')}
            className={`px-4 py-2 text-xs font-bold rounded transition-colors ${
              activeTab === 'profile' ? 'bg-gov-navy text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            👤 Settings
          </button>
          <button
            onClick={() => handleTabChange('orders')}
            className={`px-4 py-2 text-xs font-bold rounded transition-colors ${
              activeTab === 'orders' ? 'bg-gov-navy text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            📦 My Orders
          </button>
          <button
            onClick={() => handleTabChange('reviews')}
            className={`px-4 py-2 text-xs font-bold rounded transition-colors ${
              activeTab === 'reviews' ? 'bg-gov-navy text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ⭐ Reviews
          </button>
          <button
            onClick={() => handleTabChange('enquiries')}
            className={`px-4 py-2 text-xs font-bold rounded transition-colors ${
              activeTab === 'enquiries' ? 'bg-gov-navy text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ✉️ Enquiries
          </button>
        </div>
      </div>

      {/* Tab: Settings */}
      {activeTab === 'profile' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6 max-w-2xl mx-auto">
          <h3 className="text-base font-bold text-gov-navy m-0 border-b border-slate-100 pb-2">
            Profile Settings
          </h3>

          {successMessage && (
            <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded border border-emerald-100">
              {successMessage}
            </div>
          )}

          {submitError && (
            <div className="p-3 bg-red-50 text-red-800 text-xs font-semibold rounded border border-red-100">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Email Address</label>
              <input
                type="email"
                disabled
                value={user.email || ''}
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-400 text-sm rounded cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Your email address cannot be changed.</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Account Role</label>
              <input
                type="text"
                disabled
                value={profile?.role ? profile.role.toUpperCase() : 'BUYER'}
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-400 text-sm rounded cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="fullName" className="block text-xs font-bold text-slate-700">Full Name</label>
              <input
                id="fullName"
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy text-slate-800 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="phone" className="block text-xs font-bold text-slate-700">Mobile Number</label>
              <input
                id="phone"
                type="tel"
                placeholder={profile?.phone ? "" : "Not Provided"}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy text-slate-800 text-sm"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full sm:w-auto font-bold mt-2 shadow-sm min-h-[40px]"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
            </Button>
          </form>
        </div>
      )}

      {/* Tab: Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {loadingOrders ? (
            <div className="flex justify-center py-12 bg-white border border-slate-200 rounded-lg">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-8 h-8 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-semibold text-slate-500">Retrieving your orders...</p>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm space-y-4 max-w-lg mx-auto animate-fade-in">
              <div className="text-5xl">📦</div>
              <h3 className="font-bold text-gov-navy text-lg m-0">No Orders Found</h3>
              <p className="text-slate-550 text-sm leading-relaxed max-w-sm mx-auto">
                You have not placed any orders yet. Visit our handicraft gallery to find traditional items.
              </p>
              <Link to="/explore">
                <Button variant="primary" className="shadow-sm">Explore Handicrafts</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => {
                const stepIdx = getStepIndex(order.status);
                const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });

                return (
                  <div key={order.id} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6 animate-fade-in">
                    {/* Order Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Order Reference</span>
                        <h4 className="text-sm font-bold text-slate-800 m-0">#{order.id.slice(0, 8).toUpperCase()}</h4>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs font-semibold">
                        <div>
                          <span className="text-slate-400 block font-normal">Order Date</span>
                          <span className="text-slate-700">{orderDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-normal">Total Paid</span>
                          <span className="text-gov-navy font-bold">₹{Number(order.total_amount).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-normal">Order Status</span>
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase mt-0.5 ${
                            order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-3">
                      {order.order_items.map((item) => {
                        const product = item.products;
                        const itemImg = product?.product_images?.[0]?.image_url || 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600';
                        return (
                          <div key={item.id} className="flex gap-4 items-center text-xs">
                            <img src={itemImg} alt={product?.name} className="w-12 h-12 object-cover rounded border border-slate-100" />
                            <div className="flex-grow">
                              <h5 className="font-bold text-slate-800 m-0 line-clamp-1">{product?.name || 'Handicraft Item'}</h5>
                              <p className="text-slate-500 mt-0.5">Qty: {item.quantity} × ₹{Number(item.unit_price).toFixed(2)}</p>
                            </div>
                            <span className="font-bold text-slate-800 text-right">₹{Number(item.subtotal).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Tracking Timeline Stepper */}
                    {order.status !== 'cancelled' ? (
                      <div className="pt-4 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Delivery Timeline</span>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 relative">
                          {timelineSteps.map((step, index) => {
                            const isCompleted = stepIdx >= index;
                            const isCurrent = stepIdx === index;
                            
                            return (
                              <div key={step} className="flex sm:flex-col items-center flex-grow text-center relative z-10 w-full sm:w-auto">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm border transition-all ${
                                  isCompleted ? 'bg-green-600 text-white border-green-700' :
                                  isCurrent ? 'bg-blue-600 text-white border-blue-700' :
                                  'bg-slate-100 text-slate-400 border-slate-300'
                                }`}>
                                  {isCompleted ? '✓' : index + 1}
                                </div>
                                <span className={`text-[10px] font-extrabold uppercase mt-1.5 ml-3 sm:ml-0 transition-colors ${
                                  isCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700' : 'text-slate-400'
                                }`}>
                                  {step}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded text-xs flex items-center gap-2">
                        <span>⚠️</span>
                        <span>This order was cancelled. Please contact customer support if you have billing concerns.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Reviews */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          {loadingReviews ? (
            <div className="flex justify-center py-12 bg-white border border-slate-200 rounded-lg">
              <div className="w-8 h-8 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm max-w-lg mx-auto space-y-4">
              <div className="text-5xl">⭐️</div>
              <h3 className="font-bold text-gov-navy text-lg m-0">No Completed Purchases</h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                Product reviews are restricted to completed purchases. You will be able to review products once your orders are marked as <strong>delivered</strong>.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
              <h3 className="text-base font-bold text-gov-navy m-0 border-b border-slate-100 pb-2">
                Review Purchases
              </h3>

              {reviewSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg text-xs font-semibold flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✓</span>
                    <div>
                      <div className="font-bold">Review submitted successfully</div>
                      <div className="text-[10px] text-emerald-600 font-medium">Thank you for your feedback!</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setReviewSuccess(false)}
                    className="text-emerald-700 hover:text-emerald-950 font-bold px-1.5 py-0.5 hover:bg-emerald-100 rounded text-[11px] cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              
              <div className="divide-y divide-slate-150 space-y-6">
                {orders.flatMap(order => 
                  order.order_items.map(item => {
                    const product = item.products;
                    if (!product) return null;

                    const review = reviews.find(r => r.product_id === product.id && r.order_id === order.id);
                    const itemImg = product.product_images?.[0]?.image_url || 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600';

                    return (
                      <div key={item.id} className="pt-6 flex flex-col sm:flex-row gap-6 justify-between items-start">
                        <div className="flex gap-4 items-center">
                          <img src={itemImg} alt={product.name} className="w-14 h-14 object-cover rounded border border-slate-200" />
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm m-0 line-clamp-1">{product.name}</h4>
                            <p className="text-xs text-slate-400 mt-0.5">Purchased in Order: #{order.id.slice(0, 8).toUpperCase()}</p>
                          </div>
                        </div>

                        <div className="w-full sm:w-auto">
                          {review ? (
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-xs space-y-1.5 w-full sm:w-80">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-slate-500">Your Review Rating</span>
                                <span className="text-amber-500 font-bold">{'★'.repeat(review.rating) + '☆'.repeat(5 - review.rating)}</span>
                              </div>
                              {review.review_text && (
                                <p className="text-slate-655 italic m-0">"{review.review_text}"</p>
                              )}
                              {review.photo_url && (
                                <img src={review.photo_url} alt="Review snapshot" className="w-16 h-16 object-cover rounded border border-slate-150 mt-1" />
                              )}
                            </div>
                          ) : (
                            activeReviewItemId === item.id ? (
                              <div className="bg-slate-50 border border-slate-250 p-4 rounded-lg text-xs space-y-4 w-full sm:w-96 animate-fade-in">
                                <h5 className="font-bold text-gov-navy m-0">Write product review</h5>
                                
                                {reviewError && (
                                  <div className="p-2 bg-red-50 border border-red-200 text-red-800 font-semibold rounded text-[11px]">
                                    {reviewError}
                                  </div>
                                ) }

                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase">Rating</label>
                                  <div className="flex gap-1.5">
                                    {[1, 2, 3, 4, 5].map(stars => (
                                      <button
                                        key={stars}
                                        onClick={() => setReviewRating(stars)}
                                        className="text-2xl text-amber-500 hover:scale-115 transition-transform"
                                        type="button"
                                      >
                                        {reviewRating >= stars ? '★' : '☆'}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase">Comments</label>
                                  <textarea
                                    rows="3"
                                    placeholder="Tell us about the craft quality, packaging, and size..."
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    className="w-full border border-slate-300 rounded p-2 text-xs bg-white focus:ring-1 focus:ring-gov-navy"
                                  ></textarea>
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase">Attach Photo</label>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setReviewPhoto(e.target.files[0])}
                                    className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-slate-200 file:text-slate-700 cursor-pointer"
                                  />
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => submitReview(order.id, product.id)}
                                    disabled={uploadingPhoto}
                                    className="bg-gov-navy hover:bg-gov-navy-light text-white font-bold py-1.5 px-3 rounded text-[11px] flex-grow shadow min-h-[32px] disabled:opacity-50"
                                  >
                                    {uploadingPhoto ? 'Uploading...' : 'Submit Review'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveReviewItemId(null);
                                      setReviewText('');
                                      setReviewPhoto(null);
                                      setReviewError('');
                                    }}
                                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold py-1.5 px-3 rounded text-[11px] flex-grow min-h-[32px]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setActiveReviewItemId(item.id);
                                  setReviewRating(5);
                                  setReviewSuccess(false);
                                }}
                                className="bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold px-4 py-2 rounded transition-colors shadow min-h-[36px] cursor-pointer"
                              >
                                Write Review
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Enquiries */}
      {activeTab === 'enquiries' && (
        <div className="space-y-6">
          {loadingEnquiries ? (
            <div className="flex justify-center py-12 bg-white border border-slate-200 rounded-lg">
              <div className="w-8 h-8 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : enquiries.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm max-w-lg mx-auto space-y-4">
              <div className="text-5xl">✉️</div>
              <h3 className="font-bold text-gov-navy text-lg m-0">No Enquiries Sent</h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                You haven't requested any custom craft orders or bulk designs from artisans yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {enquiries.map((enq) => {
                const enqDate = new Date(enq.created_at).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });

                return (
                  <div key={enq.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4 animate-fade-in">
                    {/* Enquiry Header */}
                    <div className="flex justify-between items-start gap-4 border-b border-slate-100 pb-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider block">Product Context</span>
                        <span className="font-bold text-slate-800 text-sm">{enq.products?.name}</span>
                        <span className="text-slate-500 block mt-0.5">Artisan Shop: {enq.artisans?.business_name || 'Verified Artisan'}</span>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          enq.status === 'replied' || enq.status === 'responded' ? 'bg-green-100 text-green-800' :
                          enq.status === 'sent_to_artisan' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {enq.status}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-1">{enqDate}</span>
                      </div>
                    </div>

                    {/* Enquiry Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] bg-slate-50 p-3 rounded border border-slate-150">
                      <div>
                        <span className="text-slate-400 block mb-0.5">Quantity</span>
                        <span className="font-bold text-slate-800">{enq.quantity || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Total Budget</span>
                        <span className="font-bold text-slate-800">{enq.budget ? `₹${Number(enq.budget).toFixed(2)}` : 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Required Date</span>
                        <span className="font-bold text-slate-800">
                          {enq.preferred_delivery_date ? new Date(enq.preferred_delivery_date).toLocaleDateString('en-IN') : 'Flexible'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Reference Image</span>
                        {enq.reference_image_url ? (
                          <a href={enq.reference_image_url} target="_blank" rel="noreferrer" className="text-gov-navy font-bold hover:underline">
                            View File ↗
                          </a>
                        ) : (
                          <span className="text-slate-500">None Provided</span>
                        )}
                      </div>
                    </div>

                    {/* Message Box */}
                    <div className="text-xs space-y-1">
                      <span className="font-semibold text-slate-450 uppercase text-[9px] tracking-wider">Your Message:</span>
                      <p className="text-slate-655 m-0 leading-relaxed font-sans bg-slate-50/50 p-2.5 rounded border border-slate-100 italic">
                        "{enq.message}"
                      </p>
                    </div>

                    {/* Response Box */}
                    {enq.artisan_response ? (
                      <div className="bg-amber-50 border border-amber-250 p-4 rounded text-xs space-y-1.5">
                        <span className="font-bold text-amber-800 block text-[10px] uppercase tracking-wider">👨‍🎨 Artisan Shop Response:</span>
                        <p className="text-slate-700 m-0 leading-relaxed font-sans font-medium whitespace-pre-line">
                          {enq.artisan_response}
                        </p>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic">
                        No reply yet. The artisan or government program administrator will respond shortly.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
