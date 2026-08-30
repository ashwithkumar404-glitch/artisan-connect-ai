import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import VerifyBadge from '../../components/VerifyBadge';

export default function ArtisanDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [artisan, setArtisan] = useState(null);
  const [verification, setVerification] = useState(null);
  const [stats, setStats] = useState({
    totalProducts: 'Not available',
    publishedProducts: 'Not available',
    totalEnquiries: 'Not available',
    profileViews: 'Not available'
  });

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

      if (verificationErr) {
        if (verificationErr.code === 'PGRST116') {
          throw new Error('Multiple verification records found. Please contact support to resolve this duplicate-record problem.');
        }
        throw verificationErr;
      }
      setVerification(verificationData);

      // 3. Fetch count metrics
      const [productsRes, publishedRes, enquiriesRes] = await Promise.all([
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('artisan_id', artisanData.id),
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('artisan_id', artisanData.id)
          .eq('status', 'published'),
        supabase
          .from('enquiries')
          .select('*', { count: 'exact', head: true })
          .eq('artisan_id', artisanData.id)
      ]);

      setStats({
        totalProducts: productsRes.error ? 'Not available' : (productsRes.count ?? 0),
        publishedProducts: publishedRes.error ? 'Not available' : (publishedRes.count ?? 0),
        totalEnquiries: enquiriesRes.error ? 'Not available' : (enquiriesRes.count ?? 0),
        profileViews: 'Not available' // profile/shop views table is not implemented yet
      });

    } catch (err) {
      console.error('Error loading artisan dashboard stats:', err);
    } finally {
      setLoading(false);
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
        <p className="text-slate-500 text-sm leading-relaxed">
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
          <h2 className="text-xl font-bold text-gov-navy m-0">Shop Profile Overview</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your catalog, check enquiries, and verify status.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Verification Status:</span>
          <VerifyBadge status={currentStatus} />
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Products */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="text-3xl mb-2" aria-hidden="true">📦</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total Products</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">{stats.totalProducts}</span>
          <span className="block text-xs text-slate-400 mt-2 font-semibold">In your catalog</span>
        </div>

        {/* Card 2: Published */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="text-3xl mb-2" aria-hidden="true">🌐</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Published Products</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">{stats.publishedProducts}</span>
          <span className="block text-xs text-slate-400 mt-2 font-semibold">Active in marketplace</span>
        </div>

        {/* Card 3: Enquiries */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="text-3xl mb-2" aria-hidden="true">✉️</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total Enquiries</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">{stats.totalEnquiries}</span>
          <span className="block text-xs text-slate-400 mt-2 font-semibold">From buyer leads</span>
        </div>

        {/* Card 4: Shop Views */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm opacity-75">
          <div className="text-3xl mb-2" aria-hidden="true">👁️</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Profile Views</span>
          <span className="block text-xl font-bold text-slate-500 mt-3">{stats.profileViews}</span>
          <span className="block text-xs text-slate-400 mt-2 font-semibold">Feature not implemented yet</span>
        </div>
      </div>

      {/* Warning/Info Block */}
      <div className="bg-slate-100 border border-slate-250 rounded-lg p-6 space-y-4">
        {currentStatus === 'approved' ? (
          <>
            <h3 className="font-bold text-green-800 m-0 flex items-center gap-2">
              <span>✅</span> Verified Artisan
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
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
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-sm px-4 py-2 rounded transition-colors inline-flex items-center min-h-[40px]"
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
            <p className="text-xs text-slate-555 leading-relaxed mt-1">
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
            <p className="text-sm text-slate-600 leading-relaxed">
              Waiting for admin verification.
            </p>
            <div className="flex gap-3 pt-1">
              <Link
                to="/artisan/verification"
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-sm px-4 py-2 rounded transition-colors inline-flex items-center min-h-[40px]"
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
            <p className="text-sm text-slate-600 leading-relaxed">
              Your documents are being reviewed by the admin.
            </p>
            <div className="flex gap-3 pt-1">
              <Link
                to="/artisan/verification"
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-sm px-4 py-2 rounded transition-colors inline-flex items-center min-h-[40px]"
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
              <Link
                to="/artisan/products/new"
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-sm px-4 py-2 rounded transition-colors inline-flex items-center min-h-[40px]"
              >
                ➕ Add First Product Draft
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
