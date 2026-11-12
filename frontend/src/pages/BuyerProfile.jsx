import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Button from '../components/Button';

export default function BuyerProfile() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetEnquiryId = searchParams.get('enquiryId');
  const activeTab = searchParams.get('tab') || (targetEnquiryId ? 'enquiries' : 'profile');

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Orders data
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);
  const [orderActionSuccess, setOrderActionSuccess] = useState('');
  const [orderActionError, setOrderActionError] = useState('');
  const [deliveryHelpOrderId, setDeliveryHelpOrderId] = useState(null);

  // Reviews data
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeReviewItemId, setActiveReviewItemId] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Enquiries data and negotiation state
  const [enquiries, setEnquiries] = useState([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState(true);
  const [enquiryMessagesMap, setEnquiryMessagesMap] = useState({});
  const [replyTextMap, setReplyTextMap] = useState({});
  const [counterBudgetMap, setCounterBudgetMap] = useState({});
  const [showCounterInputMap, setShowCounterInputMap] = useState({});
  const [actionInProgressEnquiryId, setActionInProgressEnquiryId] = useState(null);
  const [enquiryActionFeedback, setEnquiryActionFeedback] = useState({});

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

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    setSuccessMessage('');

    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      setSuccessMessage('Profile information updated successfully!');
      if (refreshProfile) refreshProfile();
    } catch (err) {
      console.error('Error saving profile changes:', err);
      setSubmitError(err.message || 'Failed to update profile.');
    } finally {
      setIsSubmitting(false);
    }
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

  const handleConfirmReceived = async (orderId) => {
    try {
      setConfirmingOrderId(orderId);
      setOrderActionError('');
      setOrderActionSuccess('');

      const { error } = await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'delivered' } : o))
      );
      setOrderActionSuccess('Order marked as delivered! Thank you for confirming receipt. You can now leave a review.');

      loadReviewsData();
    } catch (err) {
      console.error('Error confirming delivery:', err);
      setOrderActionError(err.message || 'Failed to confirm order receipt.');
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const getOrderTracking = (orderId) => {
    try {
      const saved = localStorage.getItem(`order_tracking_${orderId}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  };

  const loadReviewsData = async () => {
    try {
      setLoadingReviews(true);

      const { data: written, error: revErr } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('customer_id', user.id);

      if (revErr) throw revErr;
      setReviews(written || []);

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
      let data = null;

      const fullRes = await supabase
        .from('enquiries')
        .select(`
          id,
          product_id,
          customer_id,
          artisan_id,
          message,
          quantity,
          preferred_delivery_date,
          budget,
          reference_image_url,
          artisan_response,
          counteroffer_amount,
          expected_ready_date,
          customer_accepted_at,
          artisan_confirmed_at,
          production_notes,
          order_id,
          status,
          created_at,
          products (
            id,
            name,
            price
          ),
          artisans (
            id,
            business_name,
            profile_id
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (fullRes.error) {
        const fallbackRes = await supabase
          .from('enquiries')
          .select(`
            id,
            product_id,
            customer_id,
            artisan_id,
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
              name,
              price
            ),
            artisans (
              id,
              business_name,
              profile_id
            )
          `)
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

        if (fallbackRes.error) throw fallbackRes.error;
        data = fallbackRes.data;
      } else {
        data = fullRes.data;
      }

      setEnquiries(data || []);

      if (data && data.length > 0) {
        const enqIds = data.map(d => d.id);
        try {
          const { data: msgData, error: msgErr } = await supabase
            .from('enquiry_messages')
            .select('*')
            .in('enquiry_id', enqIds)
            .order('created_at', { ascending: true });

          if (!msgErr && msgData) {
            const map = {};
            for (const m of msgData) {
              if (!map[m.enquiry_id]) map[m.enquiry_id] = [];
              map[m.enquiry_id].push(m);
            }
            setEnquiryMessagesMap(map);
          }
        } catch (msgErr) {
          console.warn('enquiry_messages load fallback:', msgErr);
        }
      }
    } catch (e) {
      console.error('Error loading customer enquiries:', e);
    } finally {
      setLoadingEnquiries(false);
    }
  };

  const handleAcceptOffer = async (enq) => {
    const agreedAmount = enq.counteroffer_amount || enq.budget;
    const confirmAccept = window.confirm(
      `Confirm acceptance of artisan's offer of ₹${agreedAmount}? The artisan will be notified to review workshop scheduling and confirm production.`
    );
    if (!confirmAccept) return;

    try {
      setActionInProgressEnquiryId(enq.id);
      setEnquiryActionFeedback(prev => ({ ...prev, [enq.id]: '' }));

      const { error } = await supabase
        .from('enquiries')
        .update({
          status: 'offer_accepted',
          customer_accepted_at: new Date().toISOString()
        })
        .eq('id', enq.id);

      if (error) throw error;

      try {
        await supabase.from('enquiry_messages').insert({
          enquiry_id: enq.id,
          sender_id: user.id,
          sender_role: 'customer',
          message: `Agreement confirmed! Customer accepted the offer of ₹${agreedAmount} (${enq.quantity || 1} units). Awaiting artisan production confirmation and scheduled delivery date.`,
          message_type: 'acceptance',
          proposed_amount: agreedAmount,
          unit_price_equivalent: enq.quantity > 0 ? Number((agreedAmount / enq.quantity).toFixed(2)) : null
        });
      } catch (e) {
        console.warn('enquiry_messages insert fallback:', e);
      }

      try {
        const artisanProfileId = enq.artisans?.profile_id;
        if (artisanProfileId) {
          await supabase.from('notifications').insert({
            user_id: artisanProfileId,
            type: 'enquiry_offer_accepted',
            title: 'Customer Accepted Your Offer! 🎉',
            message: `The customer accepted your price of ₹${agreedAmount} for "${enq.products?.name}". Review and confirm production to activate the order.`,
            reference_id: enq.id,
            reference_type: 'enquiry',
            is_read: false
          });
        }
      } catch (notifErr) {
        console.warn('Notification insert fallback:', notifErr);
      }

      setEnquiryActionFeedback(prev => ({
        ...prev,
        [enq.id]: 'Offer accepted! The artisan has been notified to schedule and confirm production.'
      }));
      await loadEnquiries();
    } catch (err) {
      console.error('Error accepting offer:', err);
      alert('Unable to accept offer: ' + err.message);
    } finally {
      setActionInProgressEnquiryId(null);
    }
  };

  const handleSendCustomerMessage = async (enq, isCounter = false) => {
    const text = (replyTextMap[enq.id] || '').trim();
    const counterAmount = counterBudgetMap[enq.id] ? parseFloat(counterBudgetMap[enq.id]) : null;

    if (!text && !counterAmount) return;

    try {
      setActionInProgressEnquiryId(enq.id);
      setEnquiryActionFeedback(prev => ({ ...prev, [enq.id]: '' }));

      const updates = {
        updated_at: new Date().toISOString()
      };
      if (isCounter && counterAmount) {
        updates.budget = counterAmount;
        updates.status = 'negotiation_ongoing';
      }

      const { error: updateErr } = await supabase
        .from('enquiries')
        .update(updates)
        .eq('id', enq.id);

      if (updateErr) throw updateErr;

      const msgContent = text || `Proposed new counter-budget: ₹${counterAmount}`;
      try {
        await supabase.from('enquiry_messages').insert({
          enquiry_id: enq.id,
          sender_id: user.id,
          sender_role: 'customer',
          message: msgContent,
          message_type: isCounter ? 'counteroffer' : 'text',
          proposed_amount: counterAmount,
          unit_price_equivalent: counterAmount && enq.quantity > 0 ? Number((counterAmount / enq.quantity).toFixed(2)) : null
        });
      } catch (msgErr) {
        console.warn('enquiry_messages insert fallback:', msgErr);
      }

      try {
        const artisanProfileId = enq.artisans?.profile_id;
        if (artisanProfileId) {
          await supabase.from('notifications').insert({
            user_id: artisanProfileId,
            type: 'enquiry_counteroffer',
            title: isCounter ? 'Customer Submitted Counteroffer' : 'New Message on Enquiry',
            message: isCounter
              ? `Customer proposed ₹${counterAmount} for "${enq.products?.name}": "${msgContent}"`
              : `Customer sent a message on enquiry for "${enq.products?.name}": "${msgContent}"`,
            reference_id: enq.id,
            reference_type: 'enquiry',
            is_read: false
          });
        }
      } catch (notifErr) {
        console.warn('Notification insert fallback:', notifErr);
      }

      setReplyTextMap(prev => ({ ...prev, [enq.id]: '' }));
      setCounterBudgetMap(prev => ({ ...prev, [enq.id]: '' }));
      setShowCounterInputMap(prev => ({ ...prev, [enq.id]: false }));
      setEnquiryActionFeedback(prev => ({
        ...prev,
        [enq.id]: isCounter ? 'Counteroffer submitted to artisan.' : 'Message sent to artisan.'
      }));

      await loadEnquiries();
    } catch (err) {
      console.error('Error sending message on enquiry:', err);
      alert('Unable to send message: ' + err.message);
    } finally {
      setActionInProgressEnquiryId(null);
    }
  };

  const submitReview = async (orderId, productId) => {
    try {
      setUploadingPhoto(true);
      setReviewError('');

      let imageUrl = null;
      if (reviewPhoto) {
        const fileExt = reviewPhoto.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${user.id}/${productId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('review-photos')
          .upload(filePath, reviewPhoto);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('review-photos')
          .getPublicUrl(filePath);

        imageUrl = publicUrlData?.publicUrl;
      }

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

  if (authLoading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-600">Loading secure buyer portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-5 bg-white border border-slate-200 rounded-xl p-8 shadow-sm my-10">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-2xl">
          🔐
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold text-gov-navy m-0">Sign In Required</h3>
          <p className="text-slate-600 text-sm">Please log in to track your orders, view enquiries, and manage your account.</p>
        </div>
        <Button onClick={() => navigate('/login')} variant="primary" className="shadow-sm w-full font-bold">
          Go to Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Dashboard Top Header */}
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gov-navy m-0 tracking-tight">
            Customer Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track handmade orders, manage bulk custom enquiries, and leave authentic artisan reviews.
          </p>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-1.5 border border-slate-200 bg-white p-1 rounded-lg shadow-2xs overflow-x-auto max-w-full">
          <button
            onClick={() => handleTabChange('profile')}
            className={`px-3.5 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'profile' ? 'bg-gov-navy text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            👤 Profile Settings
          </button>
          <button
            onClick={() => handleTabChange('orders')}
            className={`px-3.5 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'orders' ? 'bg-gov-navy text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📦 Orders {orders.length > 0 && `(${orders.length})`}
          </button>
          <button
            onClick={() => handleTabChange('enquiries')}
            className={`px-3.5 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'enquiries' ? 'bg-gov-navy text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ✉️ Enquiries & Quotes {enquiries.length > 0 && `(${enquiries.length})`}
          </button>
          <button
            onClick={() => handleTabChange('reviews')}
            className={`px-3.5 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'reviews' ? 'bg-gov-navy text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ⭐ Reviews
          </button>
        </div>
      </div>

      {/* TAB 1: Profile Settings */}
      {activeTab === 'profile' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-6 max-w-2xl mx-auto">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-gov-navy m-0">Your Buyer Account</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage your contact details for delivery and artisan communications.</p>
          </div>

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 text-emerald-900 text-xs font-semibold rounded-lg border border-emerald-200 flex items-center gap-2">
              <span>✓</span> {successMessage}
            </div>
          )}

          {submitError && (
            <div className="p-3.5 bg-red-50 text-red-900 text-xs font-semibold rounded-lg border border-red-200 flex items-center gap-2">
              <span>⚠️</span> {submitError}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Account Email</label>
              <input
                type="email"
                disabled
                value={user.email || ''}
                className="w-full px-3.5 py-2 border border-slate-200 bg-slate-50 text-slate-400 text-sm rounded-lg cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Connected with secure Supabase authentication.</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Platform Role</label>
              <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg">
                {profile?.role ? profile.role.toUpperCase() : 'BUYER / CUSTOMER'}
              </div>
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
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-navy text-slate-800 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="phone" className="block text-xs font-bold text-slate-700">Mobile Number (For Courier Updates)</label>
              <input
                id="phone"
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-navy text-slate-800 text-sm"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full sm:w-auto font-bold mt-2 shadow-sm min-h-[44px]"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
            </Button>
          </form>
        </div>
      )}

      {/* TAB 2: Orders Tracking */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {loadingOrders ? (
            <div className="flex justify-center py-16 bg-white border border-slate-200 rounded-xl">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-semibold text-slate-500">Retrieving your craft orders...</p>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm space-y-4 max-w-lg mx-auto animate-fade-in">
              <div className="text-6xl">📦</div>
              <h3 className="font-bold text-gov-navy text-xl m-0">No Orders Yet</h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                You haven't placed any handicraft orders yet. Discover unique creations handcrafted by verified Indian artisans.
              </p>
              <div className="pt-2">
                <Link to="/explore">
                  <Button variant="primary" className="shadow-sm font-bold">
                    Explore Handicrafts Marketplace →
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {orderActionSuccess && (
                <div className="p-4 bg-emerald-50 text-emerald-900 text-xs font-semibold rounded-lg border border-emerald-200 flex items-center justify-between shadow-xs">
                  <span>✓ {orderActionSuccess}</span>
                  <button onClick={() => setOrderActionSuccess('')} className="text-emerald-700 hover:text-emerald-950 font-bold ml-2 p-1">✕</button>
                </div>
              )}
              {orderActionError && (
                <div className="p-4 bg-red-50 text-red-900 text-xs font-semibold rounded-lg border border-red-200 flex items-center justify-between shadow-xs">
                  <span>⚠️ {orderActionError}</span>
                  <button onClick={() => setOrderActionError('')} className="text-red-700 hover:text-red-950 font-bold ml-2 p-1">✕</button>
                </div>
              )}

              {orders.map((order) => {
                const stepIdx = getStepIndex(order.status);
                const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });

                return (
                  <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7 shadow-sm space-y-6 animate-fade-in">
                    {/* Order Header Summary */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Order Reference</span>
                        <h3 className="text-base font-bold text-slate-900 m-0">#{order.id.slice(0, 8).toUpperCase()}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Date</span>
                          <span className="text-slate-800 font-semibold">{orderDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Paid</span>
                          <span className="text-gov-navy font-black text-sm">₹{Number(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Status</span>
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase mt-0.5 ${
                            order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800 border border-red-200' :
                            'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Order Items with Links to Product Details */}
                    <div className="space-y-3">
                      {order.order_items.map((item) => {
                        const product = item.products;
                        const itemImg = product?.product_images?.[0]?.image_url || 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600';
                        return (
                          <div key={item.id} className="flex gap-4 items-center text-xs p-3 rounded-lg bg-slate-50 border border-slate-150 hover:bg-slate-100/70 transition-colors">
                            <img src={itemImg} alt={product?.name} className="w-14 h-14 object-cover rounded-md border border-slate-200 shrink-0 bg-white" />
                            <div className="flex-grow min-w-0">
                              {product?.id ? (
                                <Link to={`/product/${product.id}`} className="font-bold text-slate-900 hover:text-gov-navy transition-colors text-sm line-clamp-1 block">
                                  {product.name} ↗
                                </Link>
                              ) : (
                                <h4 className="font-bold text-slate-800 m-0 text-sm line-clamp-1">{product?.name || 'Handicraft Item'}</h4>
                              )}
                              <p className="text-slate-500 mt-0.5 text-xs">
                                Quantity: <strong className="text-slate-800">{item.quantity}</strong> × ₹{Number(item.unit_price).toFixed(2)}
                              </p>
                            </div>
                            <span className="font-black text-slate-900 text-sm text-right shrink-0">
                              ₹{Number(item.subtotal).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Shipping Address & Dispatch Details */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-800 block mb-0.5">📍 Shipping Destination</span>
                        <span>{order.shipping_name}, {order.shipping_address}, {order.shipping_city}, {order.shipping_state} - {order.shipping_pincode}</span>
                        {order.shipping_phone && <span className="block text-slate-500 text-[11px] mt-0.5">Contact: {order.shipping_phone}</span>}
                      </div>

                      {(() => {
                        const tracking = getOrderTracking(order.id);
                        if (tracking) {
                          return (
                            <div className="bg-white border border-blue-200 text-blue-900 rounded-lg p-2.5 text-[11px] shrink-0 shadow-2xs">
                              <div className="font-bold flex items-center gap-1">
                                <span>🚚</span> Carrier: {tracking.carrier}
                              </div>
                              <div className="font-mono text-slate-800 font-semibold">Track #: {tracking.trackingNumber}</div>
                              {tracking.dispatchedAt && (
                                <div className="text-[10px] text-slate-500">Shipped: {new Date(tracking.dispatchedAt).toLocaleDateString()}</div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Visual Delivery Stepper */}
                    {order.status !== 'cancelled' ? (
                      <div className="pt-2 border-t border-slate-100 space-y-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivery Milestones</span>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 relative">
                          {timelineSteps.map((step, index) => {
                            const isCompleted = stepIdx >= index;
                            const isCurrent = stepIdx === index;

                            return (
                              <div key={step} className={`p-2.5 rounded-lg border text-center transition-all ${
                                isCompleted ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                                isCurrent ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-100 font-bold' :
                                'bg-slate-50 border-slate-200 text-slate-400'
                              }`}>
                                <div className="text-xs font-extrabold uppercase">
                                  {isCompleted ? '✓ ' : ''}{step}
                                </div>
                                <span className="text-[10px] block opacity-75 mt-0.5">
                                  {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Pending'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-xs flex items-center gap-2">
                        <span>⚠️</span>
                        <span>This order was cancelled. Please contact support if you need further assistance.</span>
                      </div>
                    )}

                    {/* Delivery Lifecycle Actions */}
                    {order.status !== 'cancelled' && (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <div className="text-xs">
                          {order.status === 'delivered' ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200">
                              ✓ Delivery Confirmed & Received
                            </span>
                          ) : order.status === 'shipped' || order.status === 'out_for_delivery' ? (
                            <span className="inline-flex items-center gap-1.5 text-purple-800 font-semibold bg-purple-50 px-3 py-1.5 rounded-md border border-purple-200 text-xs">
                              📦 In Transit — Please confirm receipt when your package arrives!
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">
                              Handcrafted with care. Delivery tracking updates as the artisan ships your package.
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {(order.status === 'shipped' || order.status === 'out_for_delivery') && (
                            <button
                              onClick={() => handleConfirmReceived(order.id)}
                              disabled={confirmingOrderId === order.id}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer min-h-[38px]"
                            >
                              {confirmingOrderId === order.id ? (
                                'Confirming...'
                              ) : (
                                <>
                                  <span>✓</span> Confirm Order Received
                                </>
                              )}
                            </button>
                          )}

                          {order.status === 'delivered' && (
                            <button
                              onClick={() => handleTabChange('reviews')}
                              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1 cursor-pointer min-h-[38px]"
                            >
                              <span>⭐</span> Leave Review
                            </button>
                          )}

                          <button
                            onClick={() => setDeliveryHelpOrderId(deliveryHelpOrderId === order.id ? null : order.id)}
                            className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs rounded-lg transition-colors cursor-pointer min-h-[38px]"
                          >
                            Help & Support
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Delivery Support Accordion */}
                    {deliveryHelpOrderId === order.id && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-950 space-y-2 animate-fade-in">
                        <div className="font-bold flex items-center gap-1.5 text-sm">
                          <span>ℹ️</span> Delivery Assistance for Order #{order.id.slice(0, 8).toUpperCase()}
                        </div>
                        <p className="m-0 leading-relaxed text-xs">
                          If your delivery is delayed, requires special gate access, or arrived damaged, our dedicated artisan support team is here to assist.
                          Contact us anytime at <strong className="underline">support@artisanconnect.ai</strong> or leave a message directly on the artisan's enquiry page.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Enquiries & Negotiation */}
      {activeTab === 'enquiries' && (
        <div className="space-y-6">
          {loadingEnquiries ? (
            <div className="flex justify-center py-16 bg-white border border-slate-200 rounded-xl">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-semibold text-slate-500">Loading custom design conversations...</p>
              </div>
            </div>
          ) : enquiries.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm max-w-lg mx-auto space-y-4 animate-fade-in">
              <div className="text-6xl">✉️</div>
              <h3 className="font-bold text-gov-navy text-xl m-0">No Custom Enquiries Yet</h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                Need customized dimensions, personalized colors, or volume bulk orders? You can message any artisan directly from any product details page.
              </p>
              <div className="pt-2">
                <Link to="/explore">
                  <Button variant="primary" className="shadow-sm font-bold">
                    Browse Handicrafts to Enquire →
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {enquiries.map((enq) => {
                const enqDate = new Date(enq.created_at).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });

                const isTarget = targetEnquiryId === enq.id;
                const unitPrice = enq.products?.price || 0;
                const qty = enq.quantity || 1;
                const listTotal = unitPrice * qty;
                const currentBudget = Number(enq.budget || 0);
                const counterAmount = Number(enq.counteroffer_amount || 0);
                const hasCounter = counterAmount > 0;
                const messagesList = enquiryMessagesMap[enq.id] || [];
                const feedback = enquiryActionFeedback[enq.id];
                const isActioning = actionInProgressEnquiryId === enq.id;
                const isCounterOpen = !!showCounterInputMap[enq.id];

                return (
                  <div
                    key={enq.id}
                    id={`enquiry-${enq.id}`}
                    className={`bg-white border rounded-xl p-6 shadow-sm space-y-5 animate-fade-in ${
                      isTarget ? 'border-gov-navy ring-2 ring-gov-navy/20' : 'border-slate-200'
                    }`}
                  >
                    {/* Enquiry Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Custom Craft Enquiry</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {enq.products?.id ? (
                            <Link to={`/product/${enq.products.id}`} className="font-bold text-slate-900 text-base hover:text-gov-navy transition-colors inline-flex items-center gap-1">
                              {enq.products.name} ↗
                            </Link>
                          ) : (
                            <span className="font-bold text-slate-900 text-base">{enq.products?.name || 'Custom Craft Project'}</span>
                          )}
                        </div>
                        <span className="text-slate-600 block mt-0.5 text-xs font-medium">
                          Artisan: <strong>{enq.artisans?.business_name || 'Verified Artisan Workshop'}</strong>
                        </span>
                      </div>

                      <div className="sm:text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          enq.status === 'confirmed' ? 'bg-teal-100 text-teal-900 border border-teal-300' :
                          enq.status === 'offer_accepted' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                          enq.status === 'offer_awaiting_response' || hasCounter ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                          enq.status === 'negotiation_ongoing' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                          'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}>
                          {enq.status === 'confirmed' ? '✓ Order Confirmed' :
                           enq.status === 'offer_accepted' ? '✓ Offer Accepted' :
                           enq.status === 'offer_awaiting_response' || hasCounter ? '🤝 Counteroffer Received' :
                           enq.status === 'negotiation_ongoing' ? '💬 Negotiating' :
                           enq.status}
                        </span>
                        <span className="block text-[11px] text-slate-400 mt-1">{enqDate}</span>
                      </div>
                    </div>

                    {/* Financial & Quantity Specs Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Volume Quantity</span>
                        <span className="font-bold text-slate-900">{enq.quantity || 1} units</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Catalog Rate</span>
                        <span className="font-bold text-slate-900">
                          {unitPrice > 0 ? `₹${unitPrice} (₹${listTotal})` : 'Custom Quote'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Your Proposed Budget</span>
                        <span className="font-black text-gov-navy">
                          {enq.budget ? `₹${Number(enq.budget).toLocaleString('en-IN')}` : 'Open Quote'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Date</span>
                        <span className="font-bold text-slate-900">
                          {enq.preferred_delivery_date ? new Date(enq.preferred_delivery_date).toLocaleDateString('en-IN') : 'Flexible'}
                        </span>
                      </div>
                    </div>

                    {/* Reference Image Attachment */}
                    {enq.reference_image_url && (
                      <div className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-150 flex items-center justify-between">
                        <span className="text-slate-600 font-medium">📎 Attached Reference Sketch / Design File:</span>
                        <a href={enq.reference_image_url} target="_blank" rel="noreferrer" className="text-gov-navy font-bold hover:underline inline-flex items-center gap-1">
                          View Design File ↗
                        </a>
                      </div>
                    )}

                    {/* Milestone State 1: Mutual Order Confirmed */}
                    {enq.status === 'confirmed' && (
                      <div className="bg-teal-50 border border-teal-300 rounded-xl p-5 text-xs space-y-2.5">
                        <div className="flex items-center gap-2 text-teal-900 font-bold text-sm">
                          <span>🎉</span> Custom Order Confirmed & Production Activated!
                        </div>
                        <p className="text-slate-700 m-0 leading-relaxed">
                          The artisan has verified workshop capacity and scheduled production for your custom piece.
                        </p>
                        {enq.expected_ready_date && (
                          <div className="text-teal-950 font-semibold bg-white/80 p-2.5 rounded border border-teal-200">
                            📅 Expected Ready Date: <strong>{new Date(enq.expected_ready_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                          </div>
                        )}
                        {enq.production_notes && (
                          <div className="bg-white/90 p-3 rounded-lg border border-teal-200 text-slate-700 italic">
                            "{enq.production_notes}"
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleTabChange('orders')}
                          className="mt-2 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-sm inline-flex items-center gap-1.5"
                        >
                          <span>📦</span> Switch to My Orders Tab
                        </button>
                      </div>
                    )}

                    {/* Milestone State 2: Offer Accepted */}
                    {enq.status === 'offer_accepted' && (
                      <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 text-xs space-y-2">
                        <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                          <span>✓</span> Offer Agreed: ₹{(counterAmount || currentBudget).toLocaleString('en-IN')}
                        </div>
                        <p className="text-slate-700 m-0 leading-relaxed">
                          You confirmed agreement on the pricing terms. The artisan is reviewing workshop schedule and will confirm dispatch date shortly.
                        </p>
                      </div>
                    )}

                    {/* Milestone State 3: Active Counteroffer Negotiation Banner */}
                    {(enq.status === 'offer_awaiting_response' || hasCounter) && enq.status !== 'offer_accepted' && enq.status !== 'confirmed' && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-xs space-y-3.5">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-purple-950 text-sm flex items-center gap-2">
                            <span>🤝</span> Artisan Proposed Counteroffer
                          </span>
                          <span className="text-xl font-black text-purple-950">
                            ₹{counterAmount.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex flex-wrap justify-between text-xs text-purple-900">
                          <span>Effective Rate: ₹{(counterAmount / qty).toFixed(2)} / piece</span>
                          {listTotal > 0 && (
                            <span className="font-semibold">
                              {counterAmount < listTotal
                                ? `-₹${(listTotal - counterAmount).toLocaleString('en-IN')} (${(((listTotal - counterAmount) / listTotal) * 100).toFixed(0)}% below standard list)`
                                : `+₹${(counterAmount - listTotal).toLocaleString('en-IN')} (custom spec adjustments)`}
                            </span>
                          )}
                        </div>

                        {/* Negotiation Action Buttons */}
                        <div className="flex flex-wrap gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleAcceptOffer(enq)}
                            disabled={isActioning}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-5 py-2.5 rounded-lg cursor-pointer transition-colors shadow-xs disabled:opacity-50 min-h-[40px]"
                          >
                            ✓ Accept Offer (₹{counterAmount.toLocaleString('en-IN')})
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowCounterInputMap(prev => ({ ...prev, [enq.id]: !prev[enq.id] }))}
                            disabled={isActioning}
                            className="bg-purple-800 hover:bg-purple-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg cursor-pointer transition-colors shadow-xs disabled:opacity-50 min-h-[40px]"
                          >
                            💬 Propose Counter-Budget
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Counteroffer Input Form if toggled */}
                    {isCounterOpen && (
                      <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 text-xs space-y-3 animate-fade-in">
                        <span className="font-bold text-slate-800 block text-xs">Propose New Target Budget (₹) & Explanation:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="number"
                            min="1"
                            placeholder="Counter Budget in ₹ (e.g. 8500)"
                            value={counterBudgetMap[enq.id] || ''}
                            onChange={(e) => setCounterBudgetMap(prev => ({ ...prev, [enq.id]: e.target.value }))}
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-gov-navy"
                          />
                          <input
                            type="text"
                            placeholder="Add brief note for artisan (e.g. flexible on delivery date)..."
                            value={replyTextMap[enq.id] || ''}
                            onChange={(e) => setReplyTextMap(prev => ({ ...prev, [enq.id]: e.target.value }))}
                            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-gov-navy"
                          />
                        </div>
                        <div className="flex justify-end gap-2.5">
                          <button
                            type="button"
                            onClick={() => setShowCounterInputMap(prev => ({ ...prev, [enq.id]: false }))}
                            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isActioning || !counterBudgetMap[enq.id]}
                            onClick={() => handleSendCustomerMessage(enq, true)}
                            className="px-5 py-2 bg-gov-saffron hover:bg-gov-saffron-light text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            Submit Counteroffer
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Feedback Toast */}
                    {feedback && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-lg">
                        ✓ {feedback}
                      </div>
                    )}

                    {/* Chronological Conversation Thread */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Negotiation & Message Thread
                      </span>

                      {/* Initial enquiry message */}
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-1">
                        <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold">
                          <span>👤 You (Initial Project Enquiry)</span>
                          <span>{enqDate}</span>
                        </div>
                        <p className="text-slate-800 m-0 leading-relaxed font-sans">
                          "{enq.message}"
                        </p>
                      </div>

                      {/* Messages from enquiry_messages table */}
                      {messagesList.map((msg) => {
                        const isArtisan = msg.sender_role === 'artisan';
                        const isSystem = msg.sender_role === 'system';
                        const msgTime = new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div
                            key={msg.id}
                            className={`p-3.5 rounded-lg text-xs space-y-1 border ${
                              isSystem ? 'bg-amber-50/70 border-amber-200 text-amber-950' :
                              isArtisan ? 'bg-amber-50 border-amber-200' :
                              'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex justify-between items-center text-[10px] font-semibold">
                              <span className={isArtisan ? 'text-amber-900 font-bold' : 'text-slate-700 font-bold'}>
                                {isArtisan ? '👨‍🎨 Artisan Workshop' : isSystem ? '⚙️ System Note' : '👤 You'}
                                {msg.message_type === 'counteroffer' && ' • Counteroffer'}
                                {msg.message_type === 'acceptance' && ' • Accepted Agreement'}
                                {msg.message_type === 'production_confirmation' && ' • Production Confirmation'}
                              </span>
                              <span className="text-slate-400">{msgTime}</span>
                            </div>
                            <p className="text-slate-800 m-0 leading-relaxed font-sans whitespace-pre-line">
                              {msg.message}
                            </p>
                            {msg.proposed_amount && (
                              <div className="text-[11px] font-bold text-slate-900 pt-1">
                                Proposed Budget: ₹{Number(msg.proposed_amount).toLocaleString('en-IN')}
                                {msg.unit_price_equivalent && ` (₹${msg.unit_price_equivalent}/unit)`}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Legacy single artisan_response fallback */}
                      {messagesList.length === 0 && enq.artisan_response && (
                        <div className="bg-amber-50 border border-amber-250 p-3.5 rounded-lg text-xs space-y-1">
                          <span className="font-bold text-amber-900 block text-[10px] uppercase tracking-wider">
                            👨‍🎨 Artisan Workshop Response:
                          </span>
                          <p className="text-slate-800 m-0 leading-relaxed font-sans whitespace-pre-line">
                            {enq.artisan_response}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Inline Reply Input */}
                    {enq.status !== 'confirmed' && enq.status !== 'closed' && (
                      <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                        <input
                          type="text"
                          placeholder="Type message or reply to the artisan..."
                          value={replyTextMap[enq.id] || ''}
                          disabled={isActioning}
                          onChange={(e) => setReplyTextMap(prev => ({ ...prev, [enq.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendCustomerMessage(enq, false);
                            }
                          }}
                          className="flex-1 px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-gov-navy"
                        />
                        <button
                          type="button"
                          disabled={isActioning || !(replyTextMap[enq.id] || '').trim()}
                          onClick={() => handleSendCustomerMessage(enq, false)}
                          className="bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold px-5 py-2 rounded-lg cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                        >
                          Send Reply
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Reviews & Ratings */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          {loadingReviews ? (
            <div className="flex justify-center py-16 bg-white border border-slate-200 rounded-xl">
              <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm max-w-lg mx-auto space-y-4">
              <div className="text-6xl">⭐</div>
              <h3 className="font-bold text-gov-navy text-xl m-0">No Completed Purchases to Review</h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                Customer reviews are reserved for completed purchases. Once your ordered handicraft is delivered, you can share feedback here.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-lg font-bold text-gov-navy m-0">Review Completed Purchases</h2>
                <p className="text-xs text-slate-500 mt-0.5">Share your experience to help traditional artisans and fellow buyers.</p>
              </div>

              {reviewSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-lg text-xs font-semibold flex items-center justify-between animate-fade-in shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✓</span>
                    <div>
                      <div className="font-bold">Review submitted successfully!</div>
                      <div className="text-[11px] text-emerald-700 font-normal">Thank you for supporting traditional Indian artisans.</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setReviewSuccess(false)}
                    className="text-emerald-700 hover:text-emerald-950 font-bold px-2 py-1 rounded text-xs cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div className="divide-y divide-slate-100 space-y-6">
                {orders.flatMap(order =>
                  order.order_items.map(item => {
                    const product = item.products;
                    if (!product) return null;

                    const review = reviews.find(r => r.product_id === product.id && r.order_id === order.id);
                    const itemImg = product.product_images?.[0]?.image_url || 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600';

                    return (
                      <div key={item.id} className="pt-6 flex flex-col sm:flex-row gap-6 justify-between items-start">
                        <div className="flex gap-4 items-center">
                          <img src={itemImg} alt={product.name} className="w-16 h-16 object-cover rounded-lg border border-slate-200 bg-white shrink-0" />
                          <div>
                            <Link to={`/product/${product.id}`} className="font-bold text-slate-900 text-sm hover:text-gov-navy transition-colors line-clamp-1 block">
                              {product.name} ↗
                            </Link>
                            <p className="text-xs text-slate-400 mt-0.5">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                          </div>
                        </div>

                        <div className="w-full sm:w-auto">
                          {review ? (
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-2 w-full sm:w-80">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-700">Your Rating</span>
                                <span className="text-amber-500 font-bold text-base">{'★'.repeat(review.rating) + '☆'.repeat(5 - review.rating)}</span>
                              </div>
                              {review.review_text && (
                                <p className="text-slate-700 italic m-0">"{review.review_text}"</p>
                              )}
                              {review.photo_url && (
                                <img src={review.photo_url} alt="Review snapshot" className="w-20 h-20 object-cover rounded-lg border border-slate-200 mt-1 shadow-2xs" />
                              )}
                            </div>
                          ) : (
                            activeReviewItemId === item.id ? (
                              <div className="bg-slate-50 border border-slate-300 p-5 rounded-xl text-xs space-y-4 w-full sm:w-96 animate-fade-in shadow-sm">
                                <h3 className="font-bold text-gov-navy text-sm m-0">Write Handicraft Review</h3>

                                {reviewError && (
                                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-900 font-semibold rounded-lg text-xs">
                                    {reviewError}
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase">Rating</label>
                                  <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map(stars => (
                                      <button
                                        key={stars}
                                        onClick={() => setReviewRating(stars)}
                                        className="text-2xl text-amber-500 hover:scale-115 transition-transform cursor-pointer"
                                        type="button"
                                      >
                                        {reviewRating >= stars ? '★' : '☆'}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase">Your Review</label>
                                  <textarea
                                    rows="3"
                                    placeholder="Describe the craft quality, packaging, material finish, and authenticity..."
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-gov-navy leading-relaxed"
                                  ></textarea>
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase">Attach Photo (Optional)</label>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setReviewPhoto(e.target.files[0])}
                                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:bg-slate-200 file:text-slate-700 cursor-pointer"
                                  />
                                </div>

                                <div className="flex gap-2 pt-1">
                                  <button
                                    onClick={() => submitReview(order.id, product.id)}
                                    disabled={uploadingPhoto}
                                    className="bg-gov-navy hover:bg-gov-navy-light text-white font-bold py-2 px-4 rounded-lg text-xs flex-grow shadow-xs min-h-[38px] disabled:opacity-50 cursor-pointer"
                                  >
                                    {uploadingPhoto ? 'Submitting...' : 'Submit Review'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveReviewItemId(null);
                                      setReviewText('');
                                      setReviewPhoto(null);
                                      setReviewError('');
                                    }}
                                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold py-2 px-4 rounded-lg text-xs flex-grow min-h-[38px] cursor-pointer"
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
                                className="bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors shadow-xs min-h-[40px] cursor-pointer"
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
    </div>
  );
}
