import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useCart } from '../lib/CartContext';
import { createNotification } from '../lib/notifications';

export default function ProductDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cart operations
  const [quantity, setQuantity] = useState(1);
  const [cartSuccess, setCartSuccess] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Enquiry modal and submission states
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [enquiryQty, setEnquiryQty] = useState('');
  const [enquiryDate, setEnquiryDate] = useState('');
  const [enquiryBudget, setEnquiryBudget] = useState('');
  const [enquiryRefImage, setEnquiryRefImage] = useState(null);
  const [enquiryUploading, setEnquiryUploading] = useState(false);
  const [isSendingEnquiry, setIsSendingEnquiry] = useState(false);
  const [enquirySuccess, setEnquirySuccess] = useState(false);
  const [enquiryError, setEnquiryError] = useState('');

  const handleEnquiryClick = () => {
    console.log("Send Enquiry clicked");
    console.log("Current auth user:", user);
    console.log("Current role:", profile?.role);
    console.log("Product loaded for enquiry:", product);
    console.log("Product artisan_id:", product?.artisan_id);

    setEnquiryError('');
    setEnquirySuccess(false);

    if (!user) {
      setIsLoginModalOpen(true);
    } else if (profile?.role === 'buyer') {
      if (!product?.artisan_id) {
        setEnquiryError('Unable to contact the artisan because this product is missing its artisan information.');
        return;
      }
      setIsEnquiryModalOpen(true);
    } else {
      setEnquiryError('Please login as a customer to send enquiries.');
    }
  };

  const handleEnquirySubmit = async (e) => {
    e.preventDefault();
    if (!enquiryMessage.trim()) {
      setEnquiryError('Please enter a message before sending.');
      return;
    }

    try {
      setIsSendingEnquiry(true);
      setEnquiryError('');

      if (!user || profile?.role !== 'buyer') {
        throw new Error('Please login as a customer to send enquiries.');
      }

      if (!product || !product.artisan_id) {
        throw new Error('Unable to contact the artisan because this product is missing its artisan information.');
      }

      let referenceImageUrl = null;
      if (enquiryRefImage) {
        setEnquiryUploading(true);
        const fileExt = enquiryRefImage.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `enquiries/${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('review-photos')
          .upload(filePath, enquiryRefImage);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('review-photos')
          .getPublicUrl(filePath);

        referenceImageUrl = publicUrlData?.publicUrl;
      }

      const { error: insertError } = await supabase
        .from('enquiries')
        .insert({
          product_id: product.id,
          customer_id: user.id,
          artisan_id: product.artisan_id,
          message: enquiryMessage.trim(),
          quantity: enquiryQty ? parseInt(enquiryQty) : null,
          preferred_delivery_date: enquiryDate || null,
          budget: enquiryBudget ? parseFloat(enquiryBudget) : null,
          reference_image_url: referenceImageUrl,
          status: 'submitted'
        });

      if (insertError) throw insertError;

      // Notify admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const promises = admins.map(admin =>
          createNotification(
            admin.id,
            'enquiry_submitted',
            'New Enquiry Received',
            `A customer submitted a custom design request for "${product.name}".`,
            product.id,
            'enquiry'
          )
        );
        await Promise.all(promises);
      }

      setEnquirySuccess(true);
      setIsEnquiryModalOpen(false);
      setEnquiryMessage('');
      setEnquiryQty('');
      setEnquiryDate('');
      setEnquiryBudget('');
      setEnquiryRefImage(null);
    } catch (err) {
      console.error('Error submitting enquiry:', err);
      setEnquiryError(err.message || 'Failed to submit enquiry.');
    } finally {
      setIsSendingEnquiry(false);
      setEnquiryUploading(false);
    }
  };

  useEffect(() => {
    let active = true;

    async function loadProductDetails() {
      try {
        setLoading(true);
        setError('');

        const { data, error: fetchError } = await supabase
          .from('products')
          .select(`
            id,
            artisan_id,
            name,
            description,
            price,
            stock_quantity,
            status,
            created_at,
            categories (
              name
            ),
            product_images (
              image_url
            ),
            artisans (
              id,
              business_name,
              location,
              verification_status,
              profiles (
                full_name
              )
            )
          `)
          .eq('id', id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (active) {
          if (!data || data.status !== 'published' || data.artisans?.verification_status !== 'approved') {
            // Secure boundary check: do not return any draft product or unverified artisan product data
            setProduct(null);
          } else {
            setProduct(data);
          }
        }
      } catch (err) {
        console.error('Error fetching product details:', err);
        if (active) {
          setError(err.message || 'Failed to load product details.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (id) {
      loadProductDetails();
    }

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      try {
        setLoadingReviews(true);
        const { data, error: reviewsErr } = await supabase
          .from('product_reviews')
          .select(`
            id,
            rating,
            review_text,
            photo_url,
            created_at,
            profiles (
              full_name
            )
          `)
          .eq('product_id', id)
          .order('created_at', { ascending: false });

        if (reviewsErr) throw reviewsErr;

        if (active) {
          setReviews(data || []);
        }
      } catch (err) {
        console.error('Error fetching product reviews:', err);
      } finally {
        if (active) {
          setLoadingReviews(false);
        }
      }
    }

    if (id) {
      loadReviews();
    }

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 font-sans">Loading product details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-red-50 border border-red-300 text-red-800 rounded p-4 text-sm font-semibold inline-flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>{error}</div>
        </div>
        <div className="pt-4">
          <Link to="/explore" className="text-gov-navy font-bold hover:underline">
            ← Back to Explore Page
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-50 border border-amber-300 rounded-full flex items-center justify-center mx-auto shadow-inner text-amber-600">
          <span className="text-3xl" role="img" aria-label="Shield lock icon">🛡️</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800">Product Not Available</h2>
          <p className="text-slate-550 text-sm leading-relaxed">
            The product you are trying to view is either currently unavailable, still in draft status, or does not exist.
          </p>
        </div>
        <div className="pt-4">
          <Link to="/explore">
            <button className="bg-gov-navy hover:bg-gov-navy-light text-white text-sm font-bold px-5 py-2.5 rounded transition-colors cursor-pointer min-h-[40px] shadow-sm">
              ← Back to Explore Handicrafts
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const imageUrl = product.product_images && product.product_images.length > 0
    ? product.product_images[0].image_url
    : null;
  const categoryName = product.categories?.name || 'Uncategorized';
  const artisanName = product.artisans?.business_name || product.artisans?.profiles?.full_name || 'Unknown Artisan';
  const locationName = product.artisans?.location || 'Unknown Location';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      <div>
        <Link to="/explore" className="text-sm font-bold text-slate-500 hover:text-gov-navy transition-colors">
          ← Back to Explore Handicrafts
        </Link>
      </div>

      {/* Success Notification */}
      {enquirySuccess && (
        <div className="bg-green-50 border border-green-300 text-green-800 rounded p-4 text-sm font-semibold flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>Your enquiry was sent successfully! The artisan will contact you shortly.</div>
          </div>
          <button 
            onClick={() => setEnquirySuccess(false)} 
            className="text-green-600 hover:text-green-800 font-bold px-2 cursor-pointer"
            aria-label="Dismiss success message"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-sm">
        {/* Product Image Column */}
        <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center p-4 min-h-[300px] md:min-h-[450px]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="max-h-[400px] object-contain rounded shadow-sm border border-slate-100 bg-white"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' class='w-20 h-20'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'/%3E%3C/svg%3E";
              }}
            />
          ) : (
            <div className="text-center space-y-2">
              <span className="text-5xl block text-slate-400" role="img" aria-label="package placeholder icon">📦</span>
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">No Image Available</span>
            </div>
          )}
        </div>

        {/* Product Details Column */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Category Tag */}
            <span className="inline-block bg-amber-50 border border-amber-300 text-gov-saffron font-extrabold text-[11px] uppercase tracking-wider px-2.5 py-1 rounded">
              {categoryName}
            </span>

            {/* Title & Price */}
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 m-0">
                {product.name}
              </h1>
              <div className="text-2xl sm:text-3xl font-black text-gov-navy pt-2">
                ₹{Number(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Description */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-slate-800 text-sm">Product Description</h3>
              <p className="text-slate-655 text-sm leading-relaxed whitespace-pre-line">
                {product.description || 'No description provided for this handicraft.'}
              </p>
            </div>
          </div>

          {/* Artisan & Availability Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full border border-slate-250 flex items-center justify-center text-3xl shadow-sm select-none">
                👨‍🎨
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Handcrafted by:</span>
                <span className="font-bold text-slate-900 text-base">{artisanName}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-200">
              <div>
                <span className="text-slate-450 block font-semibold mb-0.5">Location:</span>
                <span className="font-bold text-slate-800">{locationName || 'Not Provided'}</span>
              </div>
              <div>
                <span className="text-slate-450 block font-semibold mb-0.5">Stock Status:</span>
                <span className={`font-bold ${product.stock_quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {product.stock_quantity > 0 ? `${product.stock_quantity} Items Left` : 'Out of stock'}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            {/* Quantity Selector */}
            {product.stock_quantity > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">Quantity</span>
                <div className="flex items-center border border-slate-350 rounded overflow-hidden bg-slate-50 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors font-bold text-base min-h-[40px]"
                    aria-label="Decrease quantity"
                  >
                    －
                  </button>
                  <span className="px-4 text-sm font-bold text-slate-800 bg-white min-w-[38px] text-center py-1.5 select-none">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.min(product.stock_quantity ?? 0, q + 1))}
                    disabled={quantity >= (product.stock_quantity ?? 0)}
                    className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors font-bold text-base min-h-[40px] disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Increase quantity"
                  >
                    ＋
                  </button>
                </div>
              </div>
            )}

            {cartSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded p-2.5 text-xs font-semibold text-center animate-fade-in flex items-center justify-center gap-1.5">
                <span>🛒</span> Added to cart successfully! <Link to="/cart" className="underline font-bold">View Cart</Link>
              </div>
            )}

            {enquiryError && !isEnquiryModalOpen && (
              <div className="bg-red-55 border border-red-200 text-red-850 rounded p-3 text-xs font-semibold animate-fade-in">
                ⚠️ {enquiryError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    setIsLoginModalOpen(true);
                    return;
                  }
                  addToCart(product, quantity);
                  setCartSuccess(true);
                  setTimeout(() => setCartSuccess(false), 4000);
                }}
                disabled={product.stock_quantity === 0}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold py-3 px-5 rounded transition-all text-sm shadow-sm min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add to Cart
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    setIsLoginModalOpen(true);
                    return;
                  }
                  addToCart(product, quantity);
                  navigate('/checkout');
                }}
                disabled={product.stock_quantity === 0}
                className="w-full bg-gov-navy hover:bg-gov-navy-light text-white font-extrabold py-3 px-5 rounded transition-all text-sm shadow-sm min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Buy Now
              </button>
            </div>

            <button
              type="button"
              onClick={handleEnquiryClick}
              className="w-full bg-white hover:bg-slate-50 text-gov-navy border border-gov-navy font-bold py-3 px-5 rounded transition-colors text-sm min-h-[44px] cursor-pointer flex items-center justify-center gap-2"
            >
              <span>✉️</span> Custom Design / Bulk Enquiry
            </button>
          </div>
        </div>
      </div>

      {/* Login Required Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-sm w-full shadow-lg space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl" role="img" aria-label="Shield lock icon">🔐</span>
              <h3 className="text-lg font-bold text-gov-navy m-0">Login Required</h3>
            </div>
            <p className="text-sm text-slate-655 leading-relaxed">
              Please login as a customer to contact the artisan.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsLoginModalOpen(false);
                  navigate('/login', { state: { from: location.pathname } });
                }}
                className="bg-gov-navy hover:bg-gov-navy-light text-white text-sm font-bold px-4 py-2 rounded flex-grow text-center min-h-[40px] cursor-pointer shadow-sm"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-bold px-4 py-2 rounded flex-grow text-center min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enquiry Form Modal */}
      {isEnquiryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-gov-navy m-0 flex items-center gap-2">
                <span className="text-xl" role="img" aria-label="Mail icon">✉️</span>
                Send Enquiry
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsEnquiryModalOpen(false);
                  setEnquiryMessage('');
                  setEnquiryQty('');
                  setEnquiryDate('');
                  setEnquiryBudget('');
                  setEnquiryRefImage(null);
                  setEnquiryError('');
                }}
                className="text-slate-400 hover:text-slate-655 font-bold text-lg cursor-pointer px-1"
              >
                ✕
              </button>
            </div>

            {enquiryError && (
              <div className="bg-red-50 border border-red-200 text-red-850 rounded p-3 text-xs font-semibold">
                ⚠️ {enquiryError}
              </div>
            )}

            <form onSubmit={handleEnquirySubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Product
                </label>
                <input
                  type="text"
                  readOnly
                  value={product.name}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-slate-600 text-sm font-medium focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="enquiry-qty" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Quantity Needed
                  </label>
                  <input
                    id="enquiry-qty"
                    type="number"
                    min="1"
                    placeholder="e.g. 50"
                    disabled={isSendingEnquiry}
                    value={enquiryQty}
                    onChange={(e) => setEnquiryQty(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-350 rounded text-xs focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="enquiry-budget" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Total Budget (₹)
                  </label>
                  <input
                    id="enquiry-budget"
                    type="number"
                    min="0"
                    placeholder="e.g. 15000"
                    disabled={isSendingEnquiry}
                    value={enquiryBudget}
                    onChange={(e) => setEnquiryBudget(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-355 rounded text-xs focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="enquiry-date" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Preferred Date
                  </label>
                  <input
                    id="enquiry-date"
                    type="date"
                    disabled={isSendingEnquiry}
                    value={enquiryDate}
                    onChange={(e) => setEnquiryDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-355 rounded text-xs focus:ring-2 focus:ring-gov-navy focus:border-gov-navy text-slate-700"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="enquiry-image" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Reference Design File
                  </label>
                  <input
                    id="enquiry-image"
                    type="file"
                    accept="image/*"
                    disabled={isSendingEnquiry || enquiryUploading}
                    onChange={(e) => setEnquiryRefImage(e.target.files[0])}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="enquiry-msg" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Enquiry Message
                </label>
                <textarea
                  id="enquiry-msg"
                  rows="3"
                  required
                  disabled={isSendingEnquiry}
                  placeholder="Ask about product details, customized orders, or shipping timelines..."
                  value={enquiryMessage}
                  onChange={(e) => setEnquiryMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-355 rounded text-xs focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEnquiryModalOpen(false);
                    setEnquiryMessage('');
                    setEnquiryQty('');
                    setEnquiryDate('');
                    setEnquiryBudget('');
                    setEnquiryRefImage(null);
                    setEnquiryError('');
                  }}
                  disabled={isSendingEnquiry || enquiryUploading}
                  className="bg-white hover:bg-slate-55 border border-slate-300 text-slate-750 text-xs font-bold px-4 py-2 rounded min-h-[38px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingEnquiry || enquiryUploading}
                  className="bg-gov-saffron hover:bg-gov-saffron-light text-white text-xs font-bold px-5 py-2 rounded min-h-[38px] cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSendingEnquiry || enquiryUploading ? 'Sending...' : 'Send Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reviews and Ratings Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-sm space-y-6">
        <h3 className="text-xl font-bold text-gov-navy m-0 flex items-center gap-2">
          <span>⭐️</span> Customer Reviews ({reviews.length})
        </h3>

        {loadingReviews ? (
          <div className="flex items-center gap-2 text-slate-550 text-sm">
            <div className="w-5 h-5 border-2 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
            <span>Loading reviews...</span>
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-slate-500 m-0 font-sans">No reviews have been written for this handicraft yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Reviews Summary Stats */}
            <div className="bg-slate-55 border border-slate-200 rounded-lg p-5 h-fit text-center space-y-3">
              <div className="text-4xl font-extrabold text-slate-900">
                {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}
              </div>
              <div className="text-amber-500 font-bold text-lg select-none">
                {'★'.repeat(Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)) + '☆'.repeat(5 - Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length))}
              </div>
              <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider m-0">Average Rating</p>
            </div>

            {/* Individual Reviews List */}
            <div className="md:col-span-2 space-y-4 divide-y divide-slate-150 max-h-[400px] overflow-y-auto pr-2">
              {reviews.map((rev, index) => (
                <div key={rev.id} className={`${index > 0 ? 'pt-4' : ''} space-y-2`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-sm text-slate-800 block">
                        {rev.profiles?.full_name || 'Verified Customer'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(rev.created_at).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="text-amber-500 font-bold text-sm select-none">
                      {'★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating)}
                    </div>
                  </div>

                  {rev.review_text && (
                    <p className="text-xs text-slate-655 leading-relaxed m-0 font-sans">
                      {rev.review_text}
                    </p>
                  )}

                  {rev.photo_url && (
                    <img
                      src={rev.photo_url}
                      alt="Review snapshot"
                      className="w-24 h-24 object-cover rounded border border-slate-200 mt-1 cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
