import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import VerifyBadge from '../../components/VerifyBadge';
import { createNotification } from '../../lib/notifications';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('verifications');
  const [error, setError] = useState('');

  // Counters
  const [summary, setSummary] = useState({
    totalArtisans: 0,
    pendingVerification: 0,
    approvedArtisans: 0,
    rejectedVerifications: 0,
  });

  // Verifications requests
  const [requests, setRequests] = useState([]);

  // Orders states
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Enquiries lists
  const [enquiries, setEnquiries] = useState([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState(false);
  const [updatingEnquiryId, setUpdatingEnquiryId] = useState(null);

  // Reviews lists
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState(null);

  // Artisan Directory states
  const [artisansList, setArtisansList] = useState([]);
  const [loadingArtisans, setLoadingArtisans] = useState(false);
  const [artisansError, setArtisansError] = useState('');

  // Products Moderation states
  const [productsList, setProductsList] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [moderatingProductId, setModeratingProductId] = useState(null);

  useEffect(() => {
    if (user) {
      checkAdminRoleAndLoad();
    }
  }, [user]);

  // Load secondary tab data
  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'orders') {
        loadOrders();
      } else if (activeTab === 'enquiries') {
        loadEnquiries();
      } else if (activeTab === 'reviews') {
        loadReviews();
      } else if (activeTab === 'artisans') {
        loadArtisans();
      } else if (activeTab === 'products') {
        loadProducts();
      }
    }
  }, [isAdmin, activeTab]);

  const checkAdminRoleAndLoad = async () => {
    try {
      setLoading(true);
      setError('');

      // Verify that user is actually an admin
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileErr) throw profileErr;
      if (profile?.role !== 'admin') {
        setError('Access Denied. You do not have permissions to access this administrative portal.');
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      await loadDashboardData();
    } catch (err) {
      console.error('Error verifying admin access:', err);
      setError('An error occurred while verifying credentials.');
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Summary Counters
      const [artisanRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
        supabase
          .from('artisans')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('artisan_verifications')
          .select('*', { count: 'exact', head: true })
          .in('status', ['submitted', 'under_review']),
        supabase
          .from('artisan_verifications')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved'),
        supabase
          .from('artisan_verifications')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'rejected'),
      ]);

      setSummary({
        totalArtisans: artisanRes.count || 0,
        pendingVerification: pendingRes.count || 0,
        approvedArtisans: approvedRes.count || 0,
        rejectedVerifications: rejectedRes.count || 0,
      });

      // 2. Fetch Active Verification Requests (submitted or under_review)
      const { data, error: requestsErr } = await supabase
        .from('artisan_verifications')
        .select(`
          *,
          artisans (
            business_name,
            location,
            specialization,
            profiles (
              full_name,
              email
            )
          )
        `)
        .in('status', ['submitted', 'under_review'])
        .order('submitted_at', { ascending: false });

      if (requestsErr) throw requestsErr;
      setRequests(data || []);

    } catch (err) {
      console.error('Error loading admin dashboard data:', err);
      setError('Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      setLoadingOrders(true);
      setOrdersError('');
      
      // 1. Fetch all orders
      const { data: ordersData, error: ordErr } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordErr) throw ordErr;

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoadingOrders(false);
        return;
      }

      const orderIds = ordersData.map(o => o.id);
      const customerIds = [...new Set(ordersData.map(o => o.customer_id))];

      // 2. Fetch customer profiles
      const { data: profilesData, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', customerIds);

      if (profErr) throw profErr;

      // 3. Fetch order items
      const { data: itemsData, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      if (itemsErr) throw itemsErr;

      const productIds = [...new Set((itemsData || []).map(i => i.product_id))];
      const artisanIds = [...new Set((itemsData || []).map(i => i.artisan_id))];

      // 4. Fetch products, images, and artisans
      const [productsRes, artisansRes, imagesRes] = await Promise.all([
        supabase.from('products').select('id, name').in('id', productIds),
        supabase.from('artisans').select('id, business_name').in('id', artisanIds),
        supabase.from('product_images').select('product_id, image_url').in('product_id', productIds)
      ]);

      if (productsRes.error) throw productsRes.error;
      if (artisansRes.error) throw artisansRes.error;

      // 5. Assemble everything in the format expected by the rendering templates
      const assembled = ordersData.map(order => {
        const customerProfile = (profilesData || []).find(p => p.id === order.customer_id) || null;
        
        const items = (itemsData || [])
          .filter(item => item.order_id === order.id)
          .map(item => {
            const product = (productsRes.data || []).find(p => p.id === item.product_id) || null;
            const artisan = (artisansRes.data || []).find(a => a.id === item.artisan_id) || null;
            const pImages = (imagesRes.data || []).filter(img => img.product_id === item.product_id);
            
            return {
              ...item,
              products: product ? {
                ...product,
                product_images: pImages
              } : null,
              artisan
            };
          });

        return {
          ...order,
          profiles: customerProfile,
          order_items: items
        };
      });

      setOrders(assembled);

      // Keep selected order info in sync if modal is open
      if (selectedOrder) {
        const refreshedSelected = assembled.find(o => o.id === selectedOrder.id);
        if (refreshedSelected) {
          setSelectedOrder(refreshedSelected);
        }
      }
    } catch (e) {
      console.error('Error loading all orders for admin:', e);
      setOrdersError(e.message || 'Failed to load system orders.');
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadEnquiries = async () => {
    try {
      setLoadingEnquiries(true);
      const { data, error: enqErr } = await supabase
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
            name
          ),
          customer:profiles (
            full_name
          ),
          artisan:artisans (
            id,
            business_name,
            profile_id
          )
        `)
        .order('created_at', { ascending: false });

      if (enqErr) throw enqErr;
      setEnquiries(data || []);
    } catch (e) {
      console.error('Error loading enquiries for admin:', e);
    } finally {
      setLoadingEnquiries(false);
    }
  };

  const loadReviews = async () => {
    try {
      setLoadingReviews(true);
      
      const [revRes, prodRes, artRes, profRes] = await Promise.all([
        supabase.from('product_reviews').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('id, name, artisan_id'),
        supabase.from('artisans').select('id, profile_id, business_name'),
        supabase.from('profiles').select('id, full_name')
      ]);

      if (revRes.error) throw revRes.error;
      if (prodRes.error) throw prodRes.error;
      if (artRes.error) throw artRes.error;
      if (profRes.error) throw profRes.error;

      const reviewsData = revRes.data || [];
      const productsData = prodRes.data || [];
      const artisansData = artRes.data || [];
      const profilesData = profRes.data || [];

      const assembled = reviewsData.map(rev => {
        const product = productsData.find(p => p.id === rev.product_id);
        const customer = profilesData.find(p => p.id === rev.customer_id);
        const artisan = product ? artisansData.find(a => a.id === product.artisan_id) : null;
        const artisanProfile = artisan ? profilesData.find(p => p.id === artisan.profile_id) : null;

        return {
          ...rev,
          products: product,
          customer: customer,
          profiles: customer,
          artisan: artisan ? {
            ...artisan,
            profiles: artisanProfile
          } : null
        };
      });

      setReviews(assembled);
    } catch (e) {
      console.error('Error loading reviews for admin:', e);
    } finally {
      setLoadingReviews(false);
    }
  };

  const loadArtisans = async () => {
    try {
      setLoadingArtisans(true);
      setArtisansError('');
      
      const [artRes, profRes, verRes, prodRes] = await Promise.all([
        supabase.from('artisans').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('artisan_verifications').select('*'),
        supabase.from('products').select('id, artisan_id')
      ]);

      if (artRes.error) throw artRes.error;
      if (profRes.error) throw profRes.error;
      if (verRes.error) throw verRes.error;
      if (prodRes.error) throw prodRes.error;

      const artisansData = artRes.data || [];
      const profilesData = profRes.data || [];
      const verificationsData = verRes.data || [];
      const productsData = prodRes.data || [];

      const assembled = artisansData.map(art => {
        const profile = profilesData.find(p => p.id === art.profile_id);
        const verification = verificationsData.find(v => v.artisan_id === art.id);
        const productCount = productsData.filter(p => p.artisan_id === art.id).length;

        return {
          ...art,
          profile,
          verification,
          productCount
        };
      });

      setArtisansList(assembled);
    } catch (e) {
      console.error('Error loading artisans directory:', e);
      setArtisansError(e.message || 'Failed to load artisans directory.');
    } finally {
      setLoadingArtisans(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      setProductsError('');

      const [prodRes, imgRes, artRes, profRes, catRes] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('product_images').select('*'),
        supabase.from('artisans').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('categories').select('*')
      ]);

      if (prodRes.error) throw prodRes.error;
      if (imgRes.error) throw imgRes.error;
      if (artRes.error) throw artRes.error;
      if (profRes.error) throw profRes.error;
      if (catRes.error) throw catRes.error;

      const productsData = prodRes.data || [];
      const imagesData = imgRes.data || [];
      const artisansData = artRes.data || [];
      const profilesData = profRes.data || [];
      const categoriesData = catRes.data || [];

      const assembled = productsData.map(prod => {
        const productImages = imagesData.filter(img => img.product_id === prod.id).sort((a, b) => a.display_order - b.display_order);
        const artisan = artisansData.find(a => a.id === prod.artisan_id);
        const profile = artisan ? profilesData.find(p => p.id === artisan.profile_id) : null;
        const category = categoriesData.find(c => c.id === prod.category_id);

        return {
          ...prod,
          images: productImages,
          category,
          artisan: artisan ? { ...artisan, profile } : null
        };
      });

      setProductsList(assembled);
    } catch (e) {
      console.error('Error loading moderate products:', e);
      setProductsError(e.message || 'Failed to load products for moderation.');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleModerateProduct = async (productId, newStatus) => {
    try {
      setModeratingProductId(productId);
      const { error: modErr } = await supabase
        .from('products')
        .update({ status: newStatus })
        .eq('id', productId);

      if (modErr) throw modErr;
      
      // Reload products list
      await loadProducts();
    } catch (e) {
      console.error('Error moderating product:', e);
      alert(e.message || 'Failed to moderate product.');
    } finally {
      setModeratingProductId(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      setUpdatingOrderId(orderId);
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Find the order record
      const order = orders.find(o => o.id === orderId) || selectedOrder;
      
      // Notify customer of order status update
      if (order?.customer_id) {
        let notificationMsg = `Your order #${orderId.slice(0, 8).toUpperCase()} has been updated to ${newStatus.toUpperCase()}.`;
        if (newStatus === 'confirmed') {
          notificationMsg = `Your order #${orderId.slice(0, 8).toUpperCase()} has been confirmed by Admin and sent to the artisan for prep.`;
        } else if (newStatus === 'cancelled') {
          notificationMsg = `Your order #${orderId.slice(0, 8).toUpperCase()} has been cancelled.`;
        }

        await createNotification(
          order.customer_id,
          'order_status_changed',
          newStatus === 'confirmed' ? 'Order Confirmed' : 
          newStatus === 'cancelled' ? 'Order Cancelled' : 'Order Logistics Update',
          notificationMsg,
          orderId,
          'order'
        );
      }

      await loadOrders();
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update status: ' + err.message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleForwardEnquiry = async (enquiry) => {
    try {
      setUpdatingEnquiryId(enquiry.id);
      
      const { error } = await supabase
        .from('enquiries')
        .update({ status: 'sent_to_artisan' })
        .eq('id', enquiry.id);

      if (error) throw error;

      // Send notification to artisan profile user
      if (enquiry.artisan?.profile_id) {
        await createNotification(
          enquiry.artisan.profile_id,
          'enquiry_forwarded',
          'New Enquiry Forwarded',
          `Admin forwarded a customer design enquiry for "${enquiry.products?.name}".`,
          enquiry.id,
          'enquiry'
        );
      }

      await loadEnquiries();
    } catch (err) {
      console.error('Error forwarding enquiry to artisan:', err);
      alert('Failed to forward enquiry: ' + err.message);
    } finally {
      setUpdatingEnquiryId(null);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!confirm('Are you sure you want to moderate (delete) this review?')) return;
    try {
      setDeletingReviewId(reviewId);
      const { error } = await supabase
        .from('product_reviews')
        .delete()
        .eq('id', reviewId);

      if (error) throw error;
      await loadReviews();
    } catch (err) {
      console.error('Error moderating review:', err);
      alert('Failed to delete review: ' + err.message);
    } finally {
      setDeletingReviewId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-lg space-y-4">
        <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Loading admin stats...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-red-50 border border-red-300 text-red-900 rounded p-6 shadow-sm max-w-lg mx-auto text-center space-y-3">
        <span className="text-4xl">⚠️</span>
        <h3 className="font-bold text-lg m-0">Access Denied</h3>
        <p className="text-sm leading-relaxed">
          You do not have administrative permissions. Please log in with a Department Administrator account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gov-navy m-0">National Administrator Console</h2>
          <p className="text-sm text-slate-500 mt-1">
            Monitor artisan onboarding, review identity certificates, and moderate orders and reviews.
          </p>
        </div>
        <div className="flex items-center gap-1.5 border border-slate-200 bg-white p-1 rounded shadow-sm w-fit overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('verifications')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'verifications' ? 'bg-gov-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            🛡️ Queue
          </button>
          <button
            onClick={() => setActiveTab('artisans')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'artisans' ? 'bg-gov-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            👥 Directory
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'products' ? 'bg-gov-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            🏷️ Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'orders' ? 'bg-gov-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            📦 Orders
          </button>
          <button
            onClick={() => setActiveTab('enquiries')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'enquiries' ? 'bg-gov-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ✉️ Enquiries
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'reviews' ? 'bg-gov-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ⭐️ Reviews
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-855 rounded p-4 text-xs font-semibold flex items-center gap-3">
          <span>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {/* Tab: Verifications Queue */}
      {activeTab === 'verifications' && (
        <div className="space-y-8 animate-fade-in">
          {/* Metrics Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm border-l-4 border-gov-navy">
              <div className="text-3xl mb-2">👥</div>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total Artisans</span>
              <span className="block text-3xl font-extrabold text-slate-800 mt-1">{summary.totalArtisans}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm border-l-4 border-amber-500">
              <div className="text-3xl mb-2">⏳</div>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Verification</span>
              <span className="block text-3xl font-extrabold text-slate-800 mt-1">{summary.pendingVerification}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm border-l-4 border-emerald-600">
              <div className="text-3xl mb-2">✅</div>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Approved Artisans</span>
              <span className="block text-3xl font-extrabold text-slate-800 mt-1">{summary.approvedArtisans}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm border-l-4 border-red-500">
              <div className="text-3xl mb-2">❌</div>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Rejected Verifications</span>
              <span className="block text-3xl font-extrabold text-slate-800 mt-1">{summary.rejectedVerifications}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gov-navy border-b border-slate-100 pb-2 m-0">
              Pending Verification Requests
            </h3>

            {requests.length === 0 ? (
              <div className="border border-dashed border-slate-350 rounded-lg p-10 text-center max-w-lg mx-auto">
                <span className="text-3xl block mb-2">🛡️</span>
                <span className="font-bold text-sm text-slate-700 block">Queue Empty</span>
                <span className="text-xs text-slate-400 mt-1 block">There are no pending verification requests at this moment.</span>
              </div>
            ) : (
              <div className="overflow-hidden border rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-3">Artisan</th>
                      <th className="p-3">Craft / specialization</th>
                      <th className="p-3">Location</th>
                      <th className="p-3">Submission Date</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {requests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-900">{req.artisans?.profiles?.full_name || 'N/A'}</td>
                        <td className="p-3">{req.artisans?.specialization || 'N/A'}</td>
                        <td className="p-3">{req.artisans?.location || 'N/A'}</td>
                        <td className="p-3">{req.submitted_at ? new Date(req.submitted_at).toLocaleDateString() : 'N/A'}</td>
                        <td className="p-3"><VerifyBadge status={req.status} /></td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => navigate(`/admin/verifications/${req.id}`)}
                            className="bg-gov-navy hover:bg-gov-navy-light text-white text-[11px] font-bold py-1 px-3 rounded transition-colors cursor-pointer min-h-[28px]"
                          >
                            Review Request
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Artisans Directory */}
      {activeTab === 'artisans' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4 animate-fade-in text-slate-800">
          <h3 className="text-base font-bold text-gov-navy border-b border-slate-100 pb-2 m-0">
            Registered Artisans Directory
          </h3>

          {loadingArtisans ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gov-navy border-t-transparent rounded-full animate-spin"></div></div>
          ) : artisansError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6 text-center max-w-lg mx-auto">
              <span className="text-3xl block mb-2">⚠️</span>
              <span className="font-bold text-sm block">Unable to load artisans directory</span>
              <span className="text-xs text-slate-500 mt-1 block">{artisansError}</span>
            </div>
          ) : artisansList.length === 0 ? (
            <p className="text-sm text-slate-500 m-0">No registered artisans found.</p>
          ) : (
            <div className="overflow-hidden border rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-3">Artisan Shop</th>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Specialization</th>
                    <th className="p-3 text-center">Exp (Yrs)</th>
                    <th className="p-3 text-center">Products</th>
                    <th className="p-3">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {artisansList.map((art) => (
                    <tr key={art.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-900">{art.business_name || 'N/A'}</td>
                      <td className="p-3 font-semibold">{art.profile?.full_name || 'N/A'}</td>
                      <td className="p-3">
                        <div className="space-y-0.5">
                          <div className="text-slate-600 font-medium">{art.profile?.email || 'N/A'}</div>
                          {art.profile?.phone && <div className="text-slate-400 text-[10px]">{art.profile.phone}</div>}
                        </div>
                      </td>
                      <td className="p-3">{art.location || 'N/A'}</td>
                      <td className="p-3 font-semibold text-slate-650">{art.specialization || 'N/A'}</td>
                      <td className="p-3 text-center font-bold">{art.experience_years ?? 'N/A'}</td>
                      <td className="p-3 text-center font-extrabold text-gov-navy font-sans">{art.productCount}</td>
                      <td className="p-3">
                        <VerifyBadge status={art.verification_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Products Moderation */}
      {activeTab === 'products' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4 animate-fade-in text-slate-800">
          <h3 className="text-base font-bold text-gov-navy border-b border-slate-100 pb-2 m-0">
            Handicrafts Moderation & Product Review
          </h3>

          {loadingProducts ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gov-navy border-t-transparent rounded-full animate-spin"></div></div>
          ) : productsError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6 text-center max-w-lg mx-auto">
              <span className="text-3xl block mb-2">⚠️</span>
              <span className="font-bold text-sm block">Unable to load products</span>
              <span className="text-xs text-slate-500 mt-1 block">{productsError}</span>
            </div>
          ) : productsList.length === 0 ? (
            <p className="text-sm text-slate-500 m-0">No submitted products found.</p>
          ) : (
            <div className="overflow-hidden border rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-3">Handicraft</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Artisan</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-center">Stock</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {productsList.map((prod) => {
                    const pImg = prod.images?.[0]?.image_url || 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600';
                    const artisanName = prod.artisan?.business_name || prod.artisan?.profile?.full_name || 'N/A';
                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/50">
                        <td className="p-3 flex items-center gap-3">
                          <img src={pImg} alt={prod.name} className="w-10 h-10 object-cover rounded border border-slate-200 shadow-sm" />
                          <div>
                            <span className="font-bold text-slate-900 block">{prod.name}</span>
                            {prod.description && <span className="text-slate-400 text-[10px] block line-clamp-1 max-w-xs">{prod.description}</span>}
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-slate-650">{prod.category?.name || 'N/A'}</td>
                        <td className="p-3 font-semibold">{artisanName}</td>
                        <td className="p-3 text-right font-sans font-bold text-slate-800">₹{Number(prod.price).toFixed(2)}</td>
                        <td className="p-3 text-center font-bold">{prod.stock_quantity}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            prod.status === 'published' ? 'bg-green-50 text-green-700 border border-green-200' :
                            prod.status === 'pending_review' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            prod.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                            'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {prod.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            {prod.status !== 'published' && (
                              <button
                                onClick={() => handleModerateProduct(prod.id, 'published')}
                                disabled={moderatingProductId === prod.id}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1 px-2.5 rounded transition-colors disabled:opacity-50 min-h-[26px] cursor-pointer"
                              >
                                Approve & Publish
                              </button>
                            )}
                            {prod.status !== 'rejected' && (
                              <button
                                onClick={() => handleModerateProduct(prod.id, 'rejected')}
                                disabled={moderatingProductId === prod.id}
                                className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[10px] font-bold py-1 px-2.5 rounded transition-colors disabled:opacity-50 min-h-[26px] cursor-pointer"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Orders Management */}
      {activeTab === 'orders' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4 animate-fade-in">
          <h3 className="text-base font-bold text-gov-navy border-b border-slate-100 pb-2 m-0">
            System Logistics & Order Moderation
          </h3>

          {loadingOrders ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gov-navy border-t-transparent rounded-full animate-spin"></div></div>
          ) : ordersError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6 max-w-lg mx-auto space-y-4">
              <div className="text-center">
                <span className="text-3xl block mb-2">⚠️</span>
                <span className="font-bold text-sm block">Unable to load orders</span>
                <span className="text-xs text-slate-500 mt-1 block">Please check the database permissions or connection.</span>
              </div>
              <details className="text-left bg-white border border-red-100 rounded p-3 text-[11px] text-red-600 font-mono">
                <summary className="cursor-pointer font-semibold select-none text-slate-650 hover:text-slate-800 transition-colors">
                  Technical Details
                </summary>
                <p className="mt-2 whitespace-pre-wrap overflow-x-auto max-h-40">{ordersError}</p>
              </details>
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-slate-500 m-0">No system orders have been placed yet.</p>
          ) : (
            <div className="overflow-hidden border rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Items details</th>
                    <th className="p-3">Fulfillment Status</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3 text-right">Moderator Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-800">#{order.id.slice(0, 8).toUpperCase()}</td>
                      <td className="p-3">{order.profiles?.full_name || 'Buyer Client'}</td>
                      <td className="p-3 max-w-[220px] truncate">
                        {order.order_items.map((i, idx) => (
                          <div key={i.id} className="truncate">
                            {idx+1}. {i.products?.name} (x{i.quantity})
                          </div>
                        ))}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-gov-navy">₹{Number(order.total_amount).toFixed(2)}</td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="bg-gov-navy hover:bg-gov-navy-light text-white text-[10px] font-bold py-1.5 px-3 rounded transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                        {order.status === 'placed' && (
                          <>
                            <button
                              disabled={updatingOrderId === order.id}
                              onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1.5 px-3 rounded transition-colors cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              disabled={updatingOrderId === order.id}
                              onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                              className="bg-red-655 hover:bg-red-700 text-white text-[10px] font-bold py-1.5 px-3 rounded transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Enquiries Log */}
      {activeTab === 'enquiries' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4 animate-fade-in">
          <h3 className="text-base font-bold text-gov-navy border-b border-slate-100 pb-2 m-0">
            Government Enquiries Registry
          </h3>

          {loadingEnquiries ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gov-navy border-t-transparent rounded-full animate-spin"></div></div>
          ) : enquiries.length === 0 ? (
            <p className="text-sm text-slate-500 m-0">No custom design enquiries registered in the system.</p>
          ) : (
            <div className="overflow-hidden border rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-3">Customer</th>
                    <th className="p-3">Artisan Shop</th>
                    <th className="p-3">Product / Specifications</th>
                    <th className="p-3">Details Message</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Moderator Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {enquiries.map((enq) => (
                    <tr key={enq.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold">{enq.customer?.full_name}</td>
                      <td className="p-3 font-semibold text-slate-500">{enq.artisan?.business_name}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{enq.products?.name}</div>
                        <div className="text-[10px] text-slate-450 mt-0.5">
                          Qty: {enq.quantity || 'N/A'} | Budget: {enq.budget ? `₹${Number(enq.budget).toFixed(2)}` : 'N/A'}
                        </div>
                      </td>
                      <td className="p-3 max-w-xs truncate" title={enq.message}>"{enq.message}"</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          enq.status === 'replied' || enq.status === 'responded' ? 'bg-green-100 text-green-800' :
                          enq.status === 'sent_to_artisan' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {enq.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {enq.status === 'submitted' || enq.status === 'under_review' ? (
                          <button
                            onClick={() => handleForwardEnquiry(enq)}
                            disabled={updatingEnquiryId === enq.id}
                            className="bg-gov-navy hover:bg-gov-navy-light text-white text-[10px] font-bold py-1 px-2.5 rounded transition-colors shadow-sm disabled:opacity-50"
                          >
                            Forward to Artisan
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Dispatched</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Reviews Moderation */}
      {activeTab === 'reviews' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4 animate-fade-in text-slate-800">
          <h3 className="text-base font-bold text-gov-navy border-b border-slate-100 pb-2 m-0">
            Reviews Moderation Panel
          </h3>

          {loadingReviews ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gov-navy border-t-transparent rounded-full animate-spin"></div></div>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-slate-500 m-0">No product reviews exist to moderate.</p>
          ) : (
            <div className="overflow-hidden border rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-3">Customer</th>
                    <th className="p-3">Handicraft</th>
                    <th className="p-3">Artisan</th>
                    <th className="p-3">Rating</th>
                    <th className="p-3">Review Comments</th>
                    <th className="p-3">Order Ref</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {reviews.map((rev) => {
                    const displayOrderRef = rev.order_id ? `#${rev.order_id.slice(0, 8).toUpperCase()}` : 'N/A';
                    const artisanName = rev.artisan?.business_name || rev.artisan?.profiles?.full_name || 'N/A';
                    return (
                      <tr key={rev.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold">{rev.customer?.full_name || 'Client'}</td>
                        <td className="p-3">{rev.products?.name || 'N/A'}</td>
                        <td className="p-3 font-semibold text-slate-600">{artisanName}</td>
                        <td className="p-3 text-amber-500 font-bold">{'★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating)}</td>
                        <td className="p-3 max-w-xs">
                          <div className="space-y-1">
                            <span className="block truncate" title={rev.review_text}>"{rev.review_text || 'No text'}"</span>
                            {rev.photo_url && (
                              <img src={rev.photo_url} alt="Review snapshot" className="w-10 h-10 object-cover rounded border border-slate-200 mt-1 cursor-pointer hover:opacity-90 transition-opacity" />
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-500">{displayOrderRef}</td>
                        <td className="p-3 text-slate-500">{new Date(rev.created_at).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteReview(rev.id)}
                            disabled={deletingReviewId === rev.id}
                            className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[10px] font-bold py-1 px-2.5 rounded transition-colors disabled:opacity-50 cursor-pointer min-h-[26px]"
                          >
                            Moderate & Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Order Details Modal Overlay */}
      {selectedOrder && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" 
          role="dialog" 
          aria-modal="true"
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 relative border border-slate-200 text-slate-800">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-gov-navy m-0">Customer Order Summary</h3>
                <span className="text-xs text-slate-400 block mt-1">Order UUID: {selectedOrder.id.toUpperCase()}</span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-100 rounded-full cursor-pointer text-sm"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            {/* Modal Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Left Column: Customer & Shipping Details */}
              <div className="space-y-4">
                {/* Customer info */}
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-4 space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider m-0">Customer Information</h4>
                  <div className="space-y-1 font-medium text-slate-700">
                    <div>Name: <strong className="text-slate-800">{selectedOrder.profiles?.full_name || 'Buyer Client'}</strong></div>
                    <div>Email: <strong className="text-slate-800">{selectedOrder.profiles?.email || 'N/A'}</strong></div>
                    <div>Purchased Date: <strong className="text-slate-800">{new Date(selectedOrder.created_at).toLocaleString('en-IN')}</strong></div>
                  </div>
                </div>

                {/* Shipping info */}
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-4 space-y-2.5">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider m-0">Shipping & Logistics Coordinates</h4>
                  <div className="space-y-1.5 font-medium text-slate-700">
                    <div>Recipient: <strong className="text-slate-800">{selectedOrder.shipping_name}</strong></div>
                    <div>Phone Contact: <strong className="text-slate-800">{selectedOrder.shipping_phone}</strong></div>
                    <div>Address: <strong className="text-slate-800">{selectedOrder.shipping_address}</strong></div>
                    <div>City / State: <strong className="text-slate-800">{selectedOrder.shipping_city}, {selectedOrder.shipping_state}</strong></div>
                    <div>PIN / Pincode: <strong className="text-slate-800">{selectedOrder.shipping_pincode}</strong></div>
                  </div>
                </div>
              </div>

              {/* Right Column: Order Timeline & Administration Status */}
              <div className="space-y-4">
                {/* Status Timeline */}
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-4 space-y-2.5">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider m-0">Fulfillment Timeline Steps</h4>
                  
                  {/* Timeline Stepper */}
                  <div className="flex flex-col gap-3 relative pl-4 mt-2 font-sans">
                    <div className="absolute left-[7px] top-1.5 bottom-1.5 w-0.5 bg-slate-200"></div>
                    
                    {[
                      { label: 'Order Placed', key: 'placed' },
                      { label: 'Confirmed', key: 'confirmed' },
                      { label: 'Preparing', key: 'preparing' },
                      { label: 'Shipped', key: 'shipped' },
                      { label: 'Out for Delivery', key: 'out_for_delivery' },
                      { label: 'Delivered', key: 'delivered' }
                    ].map((step, idx) => {
                      const isCancelled = selectedOrder.status === 'cancelled';
                      const isActive = selectedOrder.status === step.key;
                      
                      const stepKeys = ['placed', 'confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered'];
                      const currentIdx = stepKeys.indexOf(selectedOrder.status);
                      const isCompleted = idx <= currentIdx && !isCancelled;

                      return (
                        <div key={step.key} className="flex items-center gap-3 relative text-[11px]">
                          <div className={`w-3.5 h-3.5 rounded-full z-10 flex items-center justify-center border-2 ${
                            isActive ? 'bg-gov-navy border-gov-navy' : 
                            isCompleted ? 'bg-emerald-600 border-emerald-600' :
                            'bg-white border-slate-350'
                          }`}>
                            {isCompleted && !isActive && <span className="text-[8px] text-white">✓</span>}
                          </div>
                          <span className={`font-semibold ${
                            isActive ? 'text-gov-navy font-bold' : 
                            isCompleted ? 'text-emerald-700 font-bold' : 'text-slate-400'
                          }`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}

                    {selectedOrder.status === 'cancelled' && (
                      <div className="flex items-center gap-3 relative text-[11px] text-red-700">
                        <div className="w-3.5 h-3.5 rounded-full z-10 bg-red-655 border-2 border-red-655 flex items-center justify-center">
                          <span className="text-[8px] text-white">✕</span>
                        </div>
                        <span className="font-bold">Cancelled</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Logistics dropdown update */}
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-4 space-y-2.5">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider m-0">Administration Actions</h4>
                  
                  {selectedOrder.status === 'placed' ? (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'confirmed')}
                        disabled={updatingOrderId === selectedOrder.id}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-[11px] transition-colors cursor-pointer disabled:opacity-50 min-h-[34px] shadow-xs"
                      >
                        Confirm Order
                      </button>
                      <button
                        onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'cancelled')}
                        disabled={updatingOrderId === selectedOrder.id}
                        className="flex-1 bg-red-655 hover:bg-red-700 text-white font-bold py-2 rounded text-[11px] transition-colors cursor-pointer disabled:opacity-50 min-h-[34px] shadow-xs"
                      >
                        Cancel Order
                      </button>
                    </div>
                  ) : selectedOrder.status === 'delivered' || selectedOrder.status === 'cancelled' ? (
                    <div className="text-[11px] text-slate-500 font-semibold italic pt-1">This order is completed and closed. No further changes allowed.</div>
                  ) : (
                    <div className="space-y-2">
                      <label htmlFor="modal-status-select" className="block text-[9px] text-slate-500 font-bold uppercase">Modify Delivery Phase</label>
                      <select
                        id="modal-status-select"
                        disabled={updatingOrderId === selectedOrder.id}
                        value={selectedOrder.status}
                        onChange={(e) => handleUpdateOrderStatus(selectedOrder.id, e.target.value)}
                        className="w-full bg-white border border-slate-350 rounded p-2 text-[11px] font-semibold text-slate-700 cursor-pointer"
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="preparing">Preparing</option>
                        <option value="shipped">Shipped</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Purchased Items Table */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider m-0">Purchased Handicrafts list</h4>
              <div className="border border-slate-150 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-3">Product</th>
                      <th className="p-3">Artisan Shop</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-medium text-slate-700">
                    {selectedOrder.order_items.map((item) => {
                      const pImg = item.products?.product_images?.[0]?.image_url || 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600';
                      return (
                        <tr key={item.id}>
                          <td className="p-3 flex items-center gap-3">
                            <img src={pImg} alt={item.products?.name} className="w-9 h-9 object-cover rounded border border-slate-200" />
                            <span className="font-bold text-slate-800">{item.products?.name}</span>
                          </td>
                          <td className="p-3 text-slate-500">{item.artisan?.business_name || 'N/A'}</td>
                          <td className="p-3 text-center font-bold">{item.quantity}</td>
                          <td className="p-3 text-right font-sans">₹{Number(item.unit_price).toFixed(2)}</td>
                          <td className="p-3 text-right font-bold text-gov-navy font-sans">₹{Number(item.subtotal).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50 font-extrabold text-slate-900 border-t border-slate-200">
                      <td colSpan="4" className="p-3 text-right text-xs uppercase tracking-wider">Order Grand Total:</td>
                      <td className="p-3 text-right text-sm text-gov-navy font-sans">₹{Number(selectedOrder.total_amount).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
