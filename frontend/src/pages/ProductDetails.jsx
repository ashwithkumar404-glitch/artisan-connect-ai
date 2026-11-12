import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useCart } from '../lib/CartContext';
import { createNotification } from '../lib/notifications';
import VerifyBadge from '../components/VerifyBadge';

// Clean English description for marketplace, stripping legacy concatenated bilingual portions
function parseEmbeddedKannadaListing(desc) {
  if (!desc) return { localTitle: null, localDescription: null };
  const sepIdx = desc.indexOf('\n\n---\n');
  if (sepIdx === -1) return { localTitle: null, localDescription: null };

  const kannadaPart = desc.substring(sepIdx + 6).trim();
  let localTitle = null;
  let localDescription = null;

  const titleMatch = kannadaPart.match(/ಶೀರ್ಷಿಕೆ:\s*(.+?)(?:\r?\n|$)/);
  if (titleMatch && titleMatch[1]) {
    localTitle = titleMatch[1].trim();
  }

  const descMatch = kannadaPart.match(/ವಿವರಣೆ:\s*([\s\S]+)$/);
  if (descMatch && descMatch[1]) {
    localDescription = descMatch[1].trim();
  } else if (!localTitle) {
    localDescription = kannadaPart;
  }

  return { localTitle, localDescription };
}

function getCleanEnglishDescription(desc) {
  if (!desc) return '';
  const sepIdx = desc.indexOf('\n\n---\n');
  if (sepIdx !== -1) {
    return desc.substring(0, sepIdx).trim();
  }
  return desc;
}

export default function ProductDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeDescLang, setActiveDescLang] = useState('en');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Cart operations & Quantity Selection
  const [quantity, setQuantity] = useState(1);
  const [qtyError, setQtyError] = useState('');
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

  // Handle quantity changes with validation
  const handleQuantityChange = (newVal) => {
    setQtyError('');
    const maxStock = product?.stock_quantity ?? 0;

    if (maxStock === 0) {
      setQuantity(0);
      setQtyError('This product is currently out of stock.');
      return;
    }

    if (isNaN(newVal) || newVal < 1) {
      setQuantity(1);
      return;
    }

    if (newVal > maxStock) {
      setQuantity(maxStock);
      setQtyError(`Only ${maxStock} items available in workshop stock.`);
      return;
    }

    setQuantity(newVal);
  };

  const handleEnquiryClick = () => {
    setEnquiryError('');
    setEnquirySuccess(false);

    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
    if (!product?.artisan_id) {
      setEnquiryError('Unable to contact the artisan because this product is missing artisan information.');
      return;
    }
    setIsEnquiryModalOpen(true);
  };

  const handleEnquirySubmit = async (e) => {
    e.preventDefault();
    if (!enquiryMessage.trim()) {
      setEnquiryError('Please enter a detailed message or design request for the artisan.');
      return;
    }

    const qtyNum = enquiryQty ? parseInt(enquiryQty, 10) : null;
    if (enquiryQty && (isNaN(qtyNum) || qtyNum <= 0)) {
      setEnquiryError('Please enter a valid quantity of 1 or more.');
      return;
    }

    const budgetNum = enquiryBudget ? parseFloat(enquiryBudget) : null;
    if (enquiryBudget && (isNaN(budgetNum) || budgetNum <= 0)) {
      setEnquiryError('Please enter a valid budget amount in ₹.');
      return;
    }

    try {
      setIsSendingEnquiry(true);
      setEnquiryError('');

      if (!user) {
        throw new Error('Please login as a customer to send enquiries.');
      }

      if (!product || !product.artisan_id) {
        throw new Error('Unable to contact the artisan because this product is missing artisan information.');
      }

      let referenceImageUrl = null;
      if (enquiryRefImage) {
        setEnquiryUploading(true);
        try {
          const fileExt = enquiryRefImage.name.split('.').pop() || 'jpg';
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `enquiries/${user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('review-photos')
            .upload(filePath, enquiryRefImage);

          if (uploadError) {
            console.warn('Storage upload error for enquiry image:', uploadError);
          } else {
            const { data: publicUrlData } = supabase.storage
              .from('review-photos')
              .getPublicUrl(filePath);
            referenceImageUrl = publicUrlData?.publicUrl || null;
          }
        } catch (uploadErr) {
          console.warn('Optional reference image upload failed:', uploadErr);
        } finally {
          setEnquiryUploading(false);
        }
      }

      const { data: insertedEnquiry, error: insertError } = await supabase
        .from('enquiries')
        .insert({
          product_id: product.id,
          customer_id: user.id,
          artisan_id: product.artisan_id,
          message: enquiryMessage.trim(),
          quantity: qtyNum,
          preferred_delivery_date: enquiryDate || null,
          budget: budgetNum,
          reference_image_url: referenceImageUrl,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.message && insertError.message.includes('row-level security')) {
          throw new Error('Unable to send enquiry due to security policy. Please ensure you are logged in to your customer account.');
        }
        throw insertError;
      }

      // Initialize conversation thread in enquiry_messages
      if (insertedEnquiry?.id) {
        try {
          const qty = qtyNum || 1;
          await supabase.from('enquiry_messages').insert({
            enquiry_id: insertedEnquiry.id,
            sender_id: user.id,
            sender_role: 'customer',
            message: enquiryMessage.trim(),
            message_type: budgetNum ? 'offer' : 'text',
            proposed_amount: budgetNum,
            unit_price_equivalent: budgetNum && qty > 0 ? Number((budgetNum / qty).toFixed(2)) : null
          });
        } catch (msgErr) {
          console.warn('Initial enquiry message insertion skipped or fallback:', msgErr);
        }
      }

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
            `A customer submitted an enquiry for "${product.name}".`,
            product.id,
            'enquiry'
          )
        );
        await Promise.all(promises);
      }

      // Notify the artisan directly
      if (product.artisans?.profile_id) {
        try {
          await createNotification(
            product.artisans.profile_id,
            'enquiry_received',
            'New Custom Order Enquiry',
            `A customer submitted an enquiry for "${product.name}"${qtyNum ? ` (Qty: ${qtyNum})` : ''}.`,
            product.id,
            'enquiry'
          );
        } catch {
          // non-blocking
        }
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

        let productRes = await supabase
          .from('products')
          .select(`
            id,
            artisan_id,
            name,
            local_title,
            description,
            local_description,
            price,
            stock_quantity,
            status,
            created_at,
            categories (
              name
            ),
            product_images (
              id,
              image_url,
              display_order
            ),
            artisans (
              id,
              profile_id,
              business_name,
              bio,
              location,
              specialization,
              experience_years,
              verification_status,
              profiles (
                full_name
              )
            )
          `)
          .eq('id', id)
          .maybeSingle();

        // Safe fallback if local_title or local_description column does not exist on remote DB
        if (productRes.error && (productRes.error.message?.includes('local_title') || productRes.error.message?.includes('local_description'))) {
          productRes = await supabase
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
                id,
                image_url,
                display_order
              ),
              artisans (
                id,
                profile_id,
                business_name,
                bio,
                location,
                specialization,
                experience_years,
                verification_status,
                profiles (
                  full_name
                )
              )
            `)
            .eq('id', id)
            .maybeSingle();
        }

        // Secondary fallback if artisan columns differ
        if (productRes.error && (productRes.error.message?.includes('bio') || productRes.error.message?.includes('specialization') || productRes.error.message?.includes('experience_years'))) {
          productRes = await supabase
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
                id,
                image_url,
                display_order
              ),
              artisans (
                id,
                profile_id,
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
        }

        const { data, error: fetchError } = productRes;
        if (fetchError) throw fetchError;

        if (data) {
          if (!data.local_description && data.description?.includes('---')) {
            const embedded = parseEmbeddedKannadaListing(data.description);
            if (!data.local_title && embedded.localTitle) {
              data.local_title = embedded.localTitle;
            }
            if (!data.local_description && embedded.localDescription) {
              data.local_description = embedded.localDescription;
            }
          }
        }

        if (active) {
          if (!data || data.status !== 'published' || data.artisans?.verification_status !== 'approved') {
            setProduct(null);
          } else {
            setProduct(data);
            setSelectedImageIndex(0);
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
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 font-sans">Loading authentic handicraft details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg p-5 text-sm font-semibold inline-flex items-center gap-3 shadow-sm">
          <span className="text-2xl">⚠️</span>
          <div>{error}</div>
        </div>
        <div className="pt-4">
          <Link to="/explore" className="text-gov-navy font-bold hover:underline inline-flex items-center gap-1.5">
            ← Back to Explore Marketplace
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-20 h-20 bg-amber-50 border border-amber-300 rounded-full flex items-center justify-center mx-auto shadow-inner text-amber-600">
          <span className="text-4xl" role="img" aria-label="Shield lock icon">🛡️</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-800">Handicraft Unavailable</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            The product you are trying to view is either currently unavailable, pending artisan verification, or has been removed.
          </p>
        </div>
        <div className="pt-2">
          <Link to="/explore">
            <button className="bg-gov-navy hover:bg-gov-navy-light text-white text-sm font-bold px-6 py-3 rounded-lg transition-colors cursor-pointer shadow-sm">
              ← Browse Verified Handicrafts
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const allImages = product.product_images && product.product_images.length > 0
    ? [...product.product_images].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    : [];

  const mainImageUrl = allImages.length > 0 && allImages[selectedImageIndex]
    ? allImages[selectedImageIndex].image_url
    : null;

  const categoryName = product.categories?.name || 'Traditional Craft';
  const artisanName = product.artisans?.business_name || product.artisans?.profiles?.full_name || 'Master Artisan';
  const locationName = product.artisans?.location || 'India';
  const artisanBio = product.artisans?.bio;
  const specialization = product.artisans?.specialization || categoryName;
  const experienceYears = product.artisans?.experience_years;
  const unitPrice = Number(product.price) || 0;
  const inStock = (product.stock_quantity ?? 0) > 0;

  // Bulk Enquiry Calculations
  const bulkQtyNum = enquiryQty ? parseInt(enquiryQty, 10) : 0;
  const bulkBudgetNum = enquiryBudget ? parseFloat(enquiryBudget) : 0;
  const bulkListEstimate = bulkQtyNum > 0 ? unitPrice * bulkQtyNum : 0;
  const bulkUnitRate = bulkQtyNum > 0 && bulkBudgetNum > 0 ? (bulkBudgetNum / bulkQtyNum) : 0;
  const budgetDifference = bulkBudgetNum > 0 && bulkListEstimate > 0 ? bulkBudgetNum - bulkListEstimate : 0;
  const percentDiff = bulkListEstimate > 0 && bulkBudgetNum > 0 ? ((budgetDifference / bulkListEstimate) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Breadcrumb & Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-medium">
        <Link to="/" className="hover:text-gov-navy transition-colors">Home</Link>
        <span>/</span>
        <Link to="/explore" className="hover:text-gov-navy transition-colors">Explore</Link>
        <span>/</span>
        <span className="text-slate-400">{categoryName}</span>
        <span>/</span>
        <span className="text-slate-900 font-bold truncate max-w-[200px] sm:max-w-xs">{product.name}</span>
      </nav>

      {/* Global Success Banner for Enquiry */}
      {enquirySuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg p-4 text-sm font-semibold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <div className="font-bold">Enquiry sent successfully to {artisanName}!</div>
              <div className="text-xs text-emerald-700 font-normal mt-0.5">
                You can track artisan replies and negotiate in your <Link to="/profile?tab=enquiries" className="underline font-bold text-emerald-800">Buyer Profile → Enquiries</Link>.
              </div>
            </div>
          </div>
          <button
            onClick={() => setEnquirySuccess(false)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1 cursor-pointer"
            aria-label="Dismiss success message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Product Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 lg:p-10 shadow-sm">

        {/* Left Column: Image Gallery (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center p-4 min-h-[320px] sm:min-h-[420px] relative group">
            {mainImageUrl ? (
              <img
                src={mainImageUrl}
                alt={product.name}
                className="max-h-[380px] w-auto max-w-full object-contain rounded-lg transition-transform duration-200 group-hover:scale-102"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' class='w-20 h-20'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'/%3E%3C/svg%3E";
                }}
              />
            ) : (
              <div className="text-center space-y-2 py-12">
                <span className="text-6xl block text-slate-300" role="img" aria-label="handicraft icon">📦</span>
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Authentic Handcrafted Piece</span>
              </div>
            )}

            {/* Verification Watermark Badge */}
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/90 backdrop-blur-xs text-[11px] font-bold text-gov-navy shadow-xs border border-slate-200">
                <span>🛡️</span> Verified Artisan Direct
              </span>
            </div>
          </div>

          {/* Multiple Image Thumbnails */}
          {allImages.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {allImages.map((img, idx) => (
                <button
                  key={img.id || idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-16 h-16 rounded-lg border-2 overflow-hidden bg-slate-50 flex-shrink-0 cursor-pointer transition-all ${
                    selectedImageIndex === idx ? 'border-gov-navy ring-2 ring-gov-navy/20 shadow-xs scale-105' : 'border-slate-200 hover:border-slate-400 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Artisan Trust Highlights */}
          <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-600">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-2.5">
              <span className="text-xl">🌿</span>
              <div>
                <span className="font-bold text-slate-800 block">Eco-Friendly Craft</span>
                <span className="text-[10px] text-slate-500">Natural traditional materials</span>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-2.5">
              <span className="text-xl">🤝</span>
              <div>
                <span className="font-bold text-slate-800 block">Direct Fair Pricing</span>
                <span className="text-[10px] text-slate-500">100% supports the artisan</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Information, Pricing, & Actions (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">

            {/* Header Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-block bg-amber-50 border border-amber-300 text-gov-saffron font-extrabold text-[11px] uppercase tracking-wider px-3 py-1 rounded-md">
                {categoryName}
              </span>
              <VerifyBadge status={product.artisans?.verification_status || 'approved'} />
            </div>

            {/* Product Title */}
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {product.name}
              </h1>
              {product.local_title && product.local_title !== product.name && (
                <div className="text-base font-semibold text-slate-500 pt-1">
                  {product.local_title}
                </div>
              )}
            </div>

            {/* Price & Stock Urgency */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider block">Direct Artisan Price</span>
                <div className="text-3xl sm:text-4xl font-black text-gov-navy">
                  ₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Inclusive of all local craft taxes & handmade packaging</span>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider block">Workshop Stock</span>
                {inStock ? (
                  <span className={`inline-flex items-center gap-1.5 font-bold text-sm ${product.stock_quantity <= 3 ? 'text-amber-600' : 'text-emerald-700'}`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {product.stock_quantity <= 3
                      ? `Only ${product.stock_quantity} pieces left!`
                      : `${product.stock_quantity} pieces available`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-sm text-red-600">
                    <span>✕</span> Out of Stock (Custom order available)
                  </span>
                )}
              </div>
            </div>

            {/* Bilingual Product Description */}
            <div className="space-y-2 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Craft Description</h2>
                {product.local_description && (
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActiveDescLang('en')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition-colors ${
                        activeDescLang === 'en' ? 'bg-gov-navy text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDescLang('local')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition-colors ${
                        activeDescLang === 'local' ? 'bg-gov-navy text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ಕನ್ನಡ (Original)
                    </button>
                  </div>
                )}
              </div>
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line font-normal">
                {activeDescLang === 'local' && product.local_description
                  ? product.local_description
                  : getCleanEnglishDescription(product.description) || product.local_description || 'Authentic traditional handicraft crafted with natural indigenous materials.'}
              </p>
            </div>

            {/* Product Specifications Table */}
            <div className="border-t border-slate-200 pt-4 space-y-2.5">
              <h2 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Handicraft Specifications</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Category</span>
                  <span className="font-semibold text-slate-800">{categoryName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Technique</span>
                  <span className="font-semibold text-slate-800">100% Hand-Crafted</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Material Focus</span>
                  <span className="font-semibold text-slate-800">{specialization}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Craft Region</span>
                  <span className="font-semibold text-slate-800">{locationName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Artisan Experience</span>
                  <span className="font-semibold text-slate-800">
                    {experienceYears ? `${experienceYears} Years Traditional Mastery` : 'Generational Artisan'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Dispatch Timeline</span>
                  <span className="font-semibold text-slate-800">Ready in 2–4 Business Days</span>
                </div>
              </div>
            </div>

            {/* Artisan Information & Craft Story Card */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-full border border-amber-200 flex items-center justify-center text-2xl shadow-xs">
                    👨‍🎨
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-amber-800 block">Artisan Workshop</span>
                    <span className="font-bold text-slate-900 text-base">{artisanName}</span>
                    <span className="text-xs text-slate-600 block">{locationName}</span>
                  </div>
                </div>
                <span className="text-xs bg-white text-amber-900 border border-amber-300 font-bold px-2.5 py-1 rounded-full shadow-2xs">
                  {specialization}
                </span>
              </div>

              {artisanBio && (
                <div className="text-xs text-slate-700 italic border-l-2 border-amber-400 pl-3 py-1 font-serif leading-relaxed">
                  "{artisanBio}"
                </div>
              )}
            </div>

          </div>

          {/* Action Center: Quantity Stepper & Buy Buttons */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            {/* Quantity Stepper with Inline Validation */}
            {inStock && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="pdetails-qty" className="text-sm font-bold text-slate-800">Select Quantity</label>
                  <span className="text-xs text-slate-500 font-medium">Subtotal: ₹{(quantity * unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(quantity - 1)}
                      disabled={quantity <= 1}
                      className="px-4 py-2 text-slate-700 hover:bg-slate-100 font-bold text-base min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Decrease quantity"
                    >
                      －
                    </button>
                    <input
                      id="pdetails-qty"
                      type="number"
                      min="1"
                      max={product.stock_quantity ?? 1}
                      value={quantity}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10) || 1)}
                      className="w-16 text-center text-sm font-bold text-slate-900 py-2 border-x border-slate-300 focus:outline-none focus:bg-slate-50"
                      aria-label="Product quantity"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={quantity >= (product.stock_quantity ?? 1)}
                      className="px-4 py-2 text-slate-700 hover:bg-slate-100 font-bold text-base min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Increase quantity"
                    >
                      ＋
                    </button>
                  </div>

                  <span className="text-xs text-slate-500">Max {product.stock_quantity} per order</span>
                </div>

                {qtyError && (
                  <p className="text-xs text-red-600 font-medium animate-fade-in">{qtyError}</p>
                )}
              </div>
            )}

            {cartSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-3 text-xs font-semibold text-center animate-fade-in flex items-center justify-center gap-2 shadow-xs">
                <span>🛒</span> Added {quantity} item(s) to your cart!{' '}
                <Link to="/cart" className="underline font-bold text-emerald-800 hover:text-emerald-950">
                  View Cart & Checkout →
                </Link>
              </div>
            )}

            {/* Primary Marketplace Action Buttons */}
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
                  setTimeout(() => setCartSuccess(false), 5000);
                }}
                disabled={!inStock}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 px-6 rounded-lg transition-all text-sm shadow-sm min-h-[48px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>🛒</span> Add to Cart
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
                disabled={!inStock}
                className="w-full bg-gov-navy hover:bg-gov-navy-light text-white font-bold py-3.5 px-6 rounded-lg transition-all text-sm shadow-sm min-h-[48px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>⚡</span> Buy Now
              </button>
            </div>

            {/* Custom Design & Bulk Enquiry Button */}
            <button
              type="button"
              onClick={handleEnquiryClick}
              className="w-full bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold py-3.5 px-5 rounded-lg transition-colors text-sm min-h-[48px] cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <span>✉️</span>
                <span className="font-extrabold">Custom Order / Bulk Design Enquiry</span>
              </div>
              <span className="text-xs text-amber-800 font-medium">(Negotiate volume price & custom specs)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Login Required Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl" role="img" aria-label="Shield lock icon">🔐</span>
              <h3 className="text-lg font-bold text-gov-navy m-0">Customer Login Required</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Please sign in with your customer account to contact this artisan, negotiate bulk orders, or place a direct purchase.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsLoginModalOpen(false);
                  navigate('/login', { state: { from: location.pathname } });
                }}
                className="bg-gov-navy hover:bg-gov-navy-light text-white text-sm font-bold px-4 py-2.5 rounded-lg flex-grow text-center min-h-[44px] cursor-pointer shadow-sm transition-colors"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-bold px-4 py-2.5 rounded-lg flex-grow text-center min-h-[44px] cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk & Custom Enquiry Modal with Dynamic Estimator */}
      {isEnquiryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xl font-bold text-gov-navy m-0 flex items-center gap-2">
                  <span>✉️</span> Custom Design & Bulk Enquiry
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Send requirements directly to {artisanName}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEnquiryModalOpen(false);
                  setEnquiryError('');
                }}
                className="text-slate-400 hover:text-slate-700 font-bold text-xl cursor-pointer p-1"
                aria-label="Close enquiry modal"
              >
                ✕
              </button>
            </div>

            {enquiryError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-xs font-semibold">
                ⚠️ {enquiryError}
              </div>
            )}

            <form onSubmit={handleEnquirySubmit} className="space-y-4">
              {/* Product Reference */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Handicraft Reference
                </label>
                <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold">
                  <span>{product.name}</span>
                  <span className="text-gov-navy font-bold">₹{unitPrice.toLocaleString('en-IN')}/unit</span>
                </div>
              </div>

              {/* Quantity & Target Budget */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label htmlFor="enquiry-qty" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Quantity Required <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="enquiry-qty"
                    type="number"
                    min="1"
                    placeholder="e.g. 25"
                    required
                    disabled={isSendingEnquiry}
                    value={enquiryQty}
                    onChange={(e) => setEnquiryQty(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-gov-navy"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="enquiry-budget" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Expected Budget (₹)
                  </label>
                  <input
                    id="enquiry-budget"
                    type="number"
                    min="1"
                    placeholder="e.g. 10000"
                    disabled={isSendingEnquiry}
                    value={enquiryBudget}
                    onChange={(e) => setEnquiryBudget(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-gov-navy"
                  />
                </div>
              </div>

              {/* Dynamic Financial Estimator Card */}
              {bulkQtyNum > 0 && (
                <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-lg text-xs space-y-2.5 animate-fade-in">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-medium">Standard Catalog Total ({bulkQtyNum} × ₹{unitPrice}):</span>
                    <span className="font-bold text-slate-900 text-sm">₹{bulkListEstimate.toLocaleString('en-IN')}</span>
                  </div>

                  {bulkBudgetNum > 0 && (
                    <>
                      <div className="flex justify-between items-center text-slate-700 pt-1.5 border-t border-amber-200">
                        <span className="font-medium">Your Proposed Budget:</span>
                        <span className="font-extrabold text-gov-navy text-sm">₹{bulkBudgetNum.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Proposed Price Per Unit:</span>
                        <span className="font-bold text-slate-900">₹{bulkUnitRate.toFixed(2)} / piece</span>
                      </div>

                      <div className="flex justify-between items-center pt-1 border-t border-amber-200 font-semibold">
                        <span>Negotiation Variance:</span>
                        <span className={budgetDifference < 0 ? 'text-amber-800' : 'text-emerald-800'}>
                          {budgetDifference < 0
                            ? `-₹${Math.abs(budgetDifference).toLocaleString('en-IN')} (${Math.abs(percentDiff).toFixed(0)}% bulk volume discount requested)`
                            : `+₹${budgetDifference.toLocaleString('en-IN')} (custom design premium buffer)`}
                        </span>
                      </div>
                    </>
                  )}

                  <p className="text-[10px] text-slate-500 italic m-0 pt-1">
                    * This calculation provides preliminary cost guidance. The artisan will verify workshop scheduling and raw material feasibility before confirming.
                  </p>
                </div>
              )}

              {/* Delivery Date & Sketch Attachment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label htmlFor="enquiry-date" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Preferred Completion Date
                  </label>
                  <input
                    id="enquiry-date"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    disabled={isSendingEnquiry}
                    value={enquiryDate}
                    onChange={(e) => setEnquiryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-gov-navy text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="enquiry-image" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Reference Sketch / Photo
                  </label>
                  <input
                    id="enquiry-image"
                    type="file"
                    accept="image/*"
                    disabled={isSendingEnquiry || enquiryUploading}
                    onChange={(e) => setEnquiryRefImage(e.target.files[0])}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                </div>
              </div>

              {/* Custom Requirement Details */}
              <div className="space-y-1">
                <label htmlFor="enquiry-msg" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Custom Requirements & Dimensions <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="enquiry-msg"
                  rows="3"
                  required
                  disabled={isSendingEnquiry}
                  placeholder="Specify custom sizes, design variations, colors, packaging requirements, or delivery location..."
                  value={enquiryMessage}
                  onChange={(e) => setEnquiryMessage(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs leading-relaxed focus:ring-2 focus:ring-gov-navy"
                ></textarea>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEnquiryModalOpen(false)}
                  disabled={isSendingEnquiry || enquiryUploading}
                  className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg min-h-[40px] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingEnquiry || enquiryUploading}
                  className="bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold px-6 py-2.5 rounded-lg min-h-[40px] cursor-pointer shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSendingEnquiry || enquiryUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Enquiry →</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reviews & Ratings Showcase */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gov-navy m-0 flex items-center gap-2">
              <span>⭐️</span> Customer Reviews & Experiences ({reviews.length})
            </h2>
            <p className="text-xs text-slate-500 mt-1">Verified reviews from verified buyers</p>
          </div>
        </div>

        {loadingReviews ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
            <div className="w-5 h-5 border-2 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
            <span>Loading authentic customer reviews...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 space-y-2 bg-slate-50 rounded-lg border border-slate-150">
            <span className="text-4xl block">✨</span>
            <p className="text-sm font-semibold text-slate-700 m-0">No reviews yet for this piece</p>
            <p className="text-xs text-slate-500 m-0">Be the first to purchase and review this verified artisan handicraft!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Reviews Summary Stats */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 h-fit text-center space-y-3">
              <div className="text-5xl font-black text-slate-900">
                {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}
              </div>
              <div className="text-amber-500 font-bold text-xl select-none">
                {'★'.repeat(Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)) +
                  '☆'.repeat(5 - Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length))}
              </div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider m-0">
                Based on {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
              </p>
            </div>

            {/* Individual Reviews List */}
            <div className="md:col-span-2 space-y-4 divide-y divide-slate-100 max-h-[460px] overflow-y-auto pr-2">
              {reviews.map((rev, index) => (
                <div key={rev.id} className={`${index > 0 ? 'pt-4' : ''} space-y-2`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-sm text-slate-900 block">
                        {rev.profiles?.full_name || 'Verified Buyer'}
                      </span>
                      <span className="text-[11px] text-slate-400">
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
                    <p className="text-xs text-slate-700 leading-relaxed m-0 font-sans">
                      {rev.review_text}
                    </p>
                  )}

                  {rev.photo_url && (
                    <img
                      src={rev.photo_url}
                      alt="Customer review photo"
                      className="w-24 h-24 object-cover rounded-lg border border-slate-200 mt-2 shadow-2xs hover:scale-105 transition-transform"
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
