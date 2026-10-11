import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import VerifyBadge from '../../components/VerifyBadge';
import { createNotification } from '../../lib/notifications';

export default function ArtisanDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [artisan, setArtisan] = useState(null);
  const [verification, setVerification] = useState(null);
  
  // Dashboard navigation tab
  const [activeTab, setActiveTab] = useState('overview');

  // Stats
  const [stats, setStats] = useState({
    totalProducts: 0,
    publishedProducts: 0,
    totalOrders: 0,
    newOrders: 0,
    preparing: 0,
    shipped: 0,
    delivered: 0,
    totalSales: '0.00'
  });

  // Orders list
  const [orderItems, setOrderItems] = useState([]);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  // Reviews list
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Fetch corresponding artisan profile
      const { data: artisanData, error: artisanErr } = await supabase
        .from('artisans')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (artisanErr) throw artisanErr;
      if (!artisanData) {
        setLoading(false);
        return;
      }
      setArtisan(artisanData);

      // 2. Fetch verification record
      const { data: verificationData, error: verificationErr } = await supabase
        .from('artisan_verifications')
        .select('status, rejection_reason')
        .eq('artisan_id', artisanData.id)
        .maybeSingle();

      if (verificationErr) throw verificationErr;
      setVerification(verificationData);

      // 3. Fetch product metrics
      const [productsRes, publishedRes] = await Promise.all([
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('artisan_id', artisanData.id),
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('artisan_id', artisanData.id)
          .eq('status', 'published')
      ]);

      // 4. Fetch orders containing this artisan's products
      const { data: rawItems, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .eq('artisan_id', artisanData.id);

      if (itemsErr) throw itemsErr;

      let sortedItems = [];
      if (rawItems && rawItems.length > 0) {
        const orderIds = rawItems.map(i => i.order_id);
        const productIds = [...new Set(rawItems.map(i => i.product_id))];

        // Fetch corresponding orders
        const { data: ordersData, error: ordErr } = await supabase
          .from('orders')
          .select('*')
          .in('id', orderIds);

        if (ordErr) throw ordErr;

        // Fetch customer profiles for these orders
        const customerIds = [...new Set((ordersData || []).map(o => o.customer_id))];
        const { data: profilesData, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', customerIds);

        if (profErr) throw profErr;

        // Fetch products and images
        const [productsRes, imagesRes] = await Promise.all([
          supabase.from('products').select('id, name').in('id', productIds),
          supabase.from('product_images').select('product_id, image_url').in('product_id', productIds)
        ]);

        if (productsRes.error) throw productsRes.error;

        // Assemble items
        const assembledItems = rawItems.map(item => {
          const order = (ordersData || []).find(o => o.id === item.order_id) || null;
          const customerProfile = order ? (profilesData || []).find(p => p.id === order.customer_id) : null;
          const product = (productsRes.data || []).find(p => p.id === item.product_id) || null;
          const pImages = (imagesRes.data || []).filter(img => img.product_id === item.product_id);

          return {
            ...item,
            orders: order ? {
              ...order,
              profiles: customerProfile
            } : null,
            products: product ? {
              ...product,
              product_images: pImages
            } : null
          };
        });

        // Sort items by order creation date
        sortedItems = assembledItems.sort((a, b) => 
          new Date(b.orders?.created_at || 0) - new Date(a.orders?.created_at || 0)
        );
      }

      setOrderItems(sortedItems);

      // 5. Fetch reviews for this artisan's products (client-side assembly to bypass nested joins)
      const { data: artProds, error: prodErr } = await supabase
        .from('products')
        .select('id, name')
        .eq('artisan_id', artisanData.id);

      if (prodErr) throw prodErr;

      let assembledReviews = [];
      if (artProds && artProds.length > 0) {
        const prodIds = artProds.map(p => p.id);
        
        const { data: revList, error: revErr } = await supabase
          .from('product_reviews')
          .select('*')
          .in('product_id', prodIds)
          .order('created_at', { ascending: false });

        if (revErr) throw revErr;

        if (revList && revList.length > 0) {
          const customerIds = [...new Set(revList.map(r => r.customer_id))];
          const { data: profilesList, error: profErr } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', customerIds);

          if (profErr) throw profErr;

          assembledReviews = revList.map(rev => {
            const product = artProds.find(p => p.id === rev.product_id);
            const profile = profilesList?.find(p => p.id === rev.customer_id);

            return {
              ...rev,
              products: product,
              profiles: profile
            };
          });
        }
      }

      setReviews(assembledReviews);

      // Calculate stats totals
      const uniqueOrderIds = [...new Set(sortedItems.map(i => i.order_id))];
      const newCount = [...new Set(sortedItems.filter(i => i.orders?.status === 'placed' || i.orders?.status === 'confirmed').map(i => i.order_id))].length;
      const prepCount = [...new Set(sortedItems.filter(i => i.orders?.status === 'preparing').map(i => i.order_id))].length;
      const shipCount = [...new Set(sortedItems.filter(i => i.orders?.status === 'shipped').map(i => i.order_id))].length;
      const delivCount = [...new Set(sortedItems.filter(i => i.orders?.status === 'delivered').map(i => i.order_id))].length;

      const salesVal = sortedItems.reduce((sum, i) => sum + Number(i.subtotal), 0);

      setStats({
        totalProducts: productsRes.error ? 0 : (productsRes.count ?? 0),
        publishedProducts: publishedRes.error ? 0 : (publishedRes.count ?? 0),
        totalOrders: uniqueOrderIds.length,
        newOrders: newCount,
        preparing: prepCount,
        shipped: shipCount,
        delivered: delivCount,
        totalSales: Number(salesVal).toFixed(2)
      });

    } catch (err) {
      console.error('Error loading artisan dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus, item) => {
    try {
      setUpdatingOrderId(orderId);
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // 1. Notify Customer of update
      if (item.orders?.customer_id) {
        await createNotification(
          item.orders.customer_id,
          'order_status_changed',
          newStatus === 'preparing' ? 'Order Under Preparation' : 'Order Shipped',
          `Your order #${orderId.slice(0, 8).toUpperCase()} containing "${item.products?.name}" has been updated to ${newStatus.toUpperCase()} by the artisan.`,
          orderId,
          'order'
        );
      }

      // 2. Notify Administrators of logistics step update
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const promises = admins.map(admin =>
          createNotification(
            admin.id,
            'order_status_changed',
            'Artisan Status Update',
            `Artisan updated order #${orderId.slice(0, 8).toUpperCase()} to ${newStatus.toUpperCase()}.`,
            orderId,
            'order'
          )
        );
        await Promise.all(promises);
      }

      await loadDashboardData();
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update status: ' + err.message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-lg space-y-4">
        <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Loading dashboard data...</p>
      </div>
    );
  }

  if (!artisan) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center shadow-sm space-y-4 max-w-md mx-auto">
        <div className="text-4xl" role="img" aria-label="Storefront">🏪</div>
        <h3 className="font-bold text-gov-navy text-lg m-0">No Artisan Profile Found</h3>
        <p className="text-slate-550 text-sm leading-relaxed">
          It looks like you haven't completed your artisan profile. Please complete your registration details first.
        </p>
        <Link 
          to="/artisan/profile" 
          className="inline-block bg-gov-navy hover:bg-gov-navy-light text-white font-semibold text-sm px-5 py-2.5 rounded transition-colors shadow"
        >
          Set Up Shop Profile
        </Link>
      </div>
    );
  }

  const currentStatus = (artisan?.verification_status === 'approved') ? 'approved' : (verification?.status || artisan?.verification_status || 'not_submitted');

  return (
    <div className="space-y-8">
      {/* Header Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gov-navy m-0">{artisan.business_name || 'My Artisan Shop'} Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Manage catalog, check metrics, and fulfill customer orders.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded border border-slate-200 shadow-inner">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-colors cursor-pointer ${
                activeTab === 'overview' ? 'bg-gov-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              📊 Overview
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-colors cursor-pointer ${
                activeTab === 'orders' ? 'bg-gov-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              📦 Fulfill Orders
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-colors cursor-pointer ${
                activeTab === 'reviews' ? 'bg-gov-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              ⭐️ Reviews
            </button>
          </div>
          <VerifyBadge status={currentStatus} />
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Catalog size</span>
          <span className="block text-2xl font-extrabold text-slate-800 mt-1">{stats.totalProducts} ({stats.publishedProducts} Live)</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total orders</span>
          <span className="block text-2xl font-extrabold text-slate-800 mt-1">{stats.totalOrders} ({stats.newOrders} New)</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Preparing / Shipped</span>
          <span className="block text-xl font-extrabold text-slate-800 mt-1.5">Prep: {stats.preparing} | Ship: {stats.shipped}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales (Order Value)</span>
          <span className="block text-2xl font-extrabold text-gov-navy mt-1">₹{stats.totalSales}</span>
        </div>
      </div>

      {/* Tab content: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Warning/Info Block */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-6 space-y-4">
            {currentStatus === 'approved' ? (
              <>
                <h3 className="font-bold text-green-800 m-0 flex items-center gap-2">
                  <span>✅</span> Verified Artisan
                </h3>
                <p className="text-sm text-slate-655 leading-relaxed">
                  Your artisan profile has been verified. Your published products are now eligible for marketplace visibility.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    to="/artisan/products"
                    className="bg-gov-navy hover:bg-gov-navy-light text-white font-semibold text-sm px-4 py-2 rounded transition-colors inline-flex items-center min-h-[40px] shadow-sm"
                  >
                    📁 Manage Catalog
                  </Link>
                  <Link
                    to="/artisan/products/new"
                    className="bg-white hover:bg-slate-55 text-slate-700 border border-slate-300 font-semibold text-sm px-4 py-2 rounded transition-colors inline-flex items-center min-h-[40px]"
                  >
                    ➕ Add New Product
                  </Link>
                </div>
              </>
            ) : currentStatus === 'rejected' ? (
              <>
                <h3 className="font-bold text-red-800 m-0 flex items-center gap-2">
                  <span>❌</span> Verification Requires Correction
                </h3>
                <p className="text-sm text-red-900 font-semibold m-0">
                  Reason: <span className="font-normal italic">{verification?.rejection_reason || 'No comments left.'}</span>
                </p>
                <p className="text-xs text-slate-500 leading-relaxed mt-1">
                  Please review and update your credentials or certificates to resubmit your application.
                </p>
                <div className="flex gap-3 pt-1">
                  <Link
                    to="/artisan/verification"
                    className="bg-red-700 hover:bg-red-800 text-white font-semibold text-sm px-4 py-2 rounded transition-colors inline-flex items-center min-h-[40px] shadow"
                  >
                    🛡️ Correct & Resubmit
                  </Link>
                </div>
              </>
            ) : currentStatus === 'submitted' ? (
              <>
                <h3 className="font-bold text-indigo-800 m-0 flex items-center gap-2">
                  <span>🕐</span> Verification Submitted
                </h3>
                <p className="text-sm text-slate-655 leading-relaxed">
                  Waiting for admin verification.
                </p>
                <div className="flex gap-3 pt-1">
                  <Link
                    to="/artisan/verification"
                    className="bg-white hover:bg-slate-55 text-slate-700 border border-slate-300 font-semibold text-sm px-4 py-2 rounded transition-colors inline-flex items-center min-h-[40px]"
                  >
                    🛡️ View Uploaded Files
                  </Link>
                </div>
              </>
            ) : currentStatus === 'under_review' ? (
              <>
                <h3 className="font-bold text-indigo-800 m-0 flex items-center gap-2">
                  <span>🔎</span> Under Review
                </h3>
                <p className="text-sm text-slate-655 leading-relaxed">
                  Your documents are being reviewed by the admin.
                </p>
                <div className="flex gap-3 pt-1">
                  <Link
                    to="/artisan/verification"
                    className="bg-white hover:bg-slate-55 text-slate-700 border border-slate-300 font-semibold text-sm px-4 py-2 rounded transition-colors inline-flex items-center min-h-[40px]"
                  >
                    🛡️ View Uploaded Files
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-slate-800 m-0 flex items-center gap-2">
                  <span>⚠️</span> Verification Required
                </h3>
                <p className="text-sm text-slate-655 leading-relaxed">
                  Complete your artisan verification to publish products on the marketplace.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    to="/artisan/verification"
                    className="bg-gov-navy hover:bg-gov-navy-light text-white font-semibold text-sm px-4 py-2 rounded transition-colors inline-flex items-center min-h-[40px] shadow"
                  >
                    🛡️ Start Verification
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab content: Fulfill Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-6 animate-fade-in text-slate-800">
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-base font-bold text-gov-navy m-0 border-b border-slate-100 pb-3">
              Order Fulfillment Console
            </h3>

            {orderItems.length === 0 ? (
              <p className="text-sm text-slate-500 pt-4 m-0 font-sans">No customer purchases found for your products yet.</p>
            ) : (
              <div className="divide-y divide-slate-150 pt-2">
                {orderItems.map((item) => {
                  const order = item.orders;
                  const product = item.products;
                  const itemImg = product?.product_images?.[0]?.image_url || 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600';
                  const orderDate = new Date(order?.created_at || 0).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });

                  return (
                    <div key={item.id} className="py-5 flex flex-col md:flex-row md:items-start justify-between gap-6">
                      <div className="flex gap-4 items-start flex-grow">
                        <img src={itemImg} alt={product?.name} className="w-14 h-14 object-cover rounded border border-slate-200 flex-shrink-0" />
                        <div className="text-xs space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">Order: #{order?.id.slice(0, 8).toUpperCase()}</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-[10px] text-slate-450 font-semibold">{orderDate}</span>
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm m-0">{product?.name}</h4>
                          <div className="text-slate-550">
                            <span>Qty: <strong>{item.quantity}</strong></span>
                            <span className="mx-2">|</span>
                            <span>Unit Price: <strong>₹{Number(item.unit_price).toFixed(2)}</strong></span>
                            <span className="mx-2">|</span>
                            <span>Payout: <strong>₹{Number(item.subtotal).toFixed(2)}</strong></span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] text-slate-655 space-y-1 w-full max-w-lg">
                            <div className="font-semibold text-slate-850">
                              Customer: <strong className="text-slate-900">{order?.profiles?.full_name || 'Buyer Client'}</strong>
                            </div>
                            <div>Shipping Name: {order?.shipping_name}</div>
                            <div>Delivery Address: {order?.shipping_address}, {order?.shipping_city}, {order?.shipping_state} - {order?.shipping_pincode}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col gap-2 min-w-[170px] shrink-0 items-end justify-between md:justify-start">
                        <div className="text-right text-xs">
                          <span className="text-slate-400 block font-bold text-[9px] uppercase">Status:</span>
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase mt-1 ${
                            order?.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            order?.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {order?.status}
                          </span>
                        </div>

                        <div className="pt-2 w-full">
                          {order?.status === 'placed' && (
                            <span className="block text-[10px] text-slate-450 italic text-right">Awaiting Admin Confirmation</span>
                          )}
                          {order?.status === 'confirmed' && (
                            <button
                              onClick={() => handleUpdateStatus(order.id, 'preparing', item)}
                              disabled={updatingOrderId === order?.id}
                              className="w-full bg-gov-navy hover:bg-gov-navy-light text-white text-[11px] font-bold py-1.5 px-3 rounded text-center transition-colors cursor-pointer min-h-[32px] shadow-xs"
                            >
                              Start Preparing
                            </button>
                          )}
                          {order?.status === 'preparing' && (
                            <button
                              onClick={() => handleUpdateStatus(order.id, 'shipped', item)}
                              disabled={updatingOrderId === order?.id}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-1.5 px-3 rounded text-center transition-colors cursor-pointer min-h-[32px] shadow-xs"
                            >
                              Mark as Shipped
                            </button>
                          )}
                          {order?.status === 'shipped' && (
                            <span className="block text-[10px] text-slate-500 font-semibold italic text-right">Shipped - Awaiting Admin Delivery</span>
                          )}
                          {(order?.status === 'delivered' || order?.status === 'cancelled') && (
                            <span className="block text-[10px] text-slate-400 italic text-right font-medium">Order closed</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab content: Reviews */}
      {activeTab === 'reviews' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-base font-bold text-gov-navy m-0 border-b border-slate-100 pb-3">
              Craft Reviews & Ratings
            </h3>

            {reviews.length === 0 ? (
              <p className="text-sm text-slate-500 pt-4 m-0 font-sans">No reviews have been written for your products yet.</p>
            ) : (
              <div className="divide-y divide-slate-150 pt-2">
                {reviews.map((rev) => (
                  <div key={rev.id} className="py-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-800 block">{rev.profiles?.full_name || 'Customer'}</span>
                        <span className="text-[10px] text-slate-450">On Product: <strong>{rev.products?.name}</strong></span>
                      </div>
                      <span className="text-amber-500 font-bold text-sm">
                        {'★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating)}
                      </span>
                    </div>
                    {rev.review_text && (
                      <p className="text-slate-655 m-0 italic font-sans">"{rev.review_text}"</p>
                    )}
                    {rev.photo_url && (
                      <img src={rev.photo_url} alt="Review attachment" className="w-16 h-16 object-cover rounded border border-slate-200 mt-1" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
