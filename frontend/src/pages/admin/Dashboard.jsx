import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import VerifyBadge from '../../components/VerifyBadge';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [summary, setSummary] = useState({
    totalArtisans: 0,
    pendingVerification: 0,
    approvedArtisans: 0,
    rejectedVerifications: 0,
  });
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      checkAdminRoleAndLoad();
    }
  }, [user]);

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
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gov-navy m-0">National Administrator Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">
          Monitor artisan onboarding, review identity certificates, and approve/reject applications.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-850 rounded p-4 text-xs font-semibold flex items-center gap-3">
          <span>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Artisans */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm border-l-4 border-gov-navy">
          <div className="text-3xl mb-2" aria-hidden="true">👥</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total Artisans</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">{summary.totalArtisans}</span>
          <span className="block text-xs text-slate-400 mt-2 font-semibold font-sans">Total registered accounts</span>
        </div>

        {/* Card 2: Pending Verifications */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm border-l-4 border-amber-500">
          <div className="text-3xl mb-2" aria-hidden="true">⏳</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Verification</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">{summary.pendingVerification}</span>
          <span className="block text-xs text-slate-400 mt-2 font-semibold font-sans">Submitted & Under Review</span>
        </div>

        {/* Card 3: Approved Artisans */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm border-l-4 border-emerald-600">
          <div className="text-3xl mb-2" aria-hidden="true">✅</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Approved Artisans</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">{summary.approvedArtisans}</span>
          <span className="block text-xs text-slate-400 mt-2 font-semibold font-sans">Certified sellers</span>
        </div>

        {/* Card 4: Rejected Verifications */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm border-l-4 border-red-500">
          <div className="text-3xl mb-2" aria-hidden="true">❌</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Rejected Verifications</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">{summary.rejectedVerifications}</span>
          <span className="block text-xs text-slate-400 mt-2 font-semibold font-sans">Awaiting correction</span>
        </div>
      </div>

      {/* Verification Requests Queue */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-gov-navy border-b border-slate-100 pb-2 m-0">
          Pending Verification Requests
        </h3>

        {requests.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-lg p-10 text-center max-w-lg mx-auto">
            <span className="text-3xl block mb-2">🛡️</span>
            <span className="font-bold text-sm text-slate-700 block">Queue Empty</span>
            <span className="text-xs text-slate-400 mt-1 block">
              There are no pending verification requests at this moment.
            </span>
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
                    <td className="p-3 font-semibold text-slate-900">
                      {req.artisans?.profiles?.full_name || 'N/A'}
                    </td>
                    <td className="p-3">{req.artisans?.specialization || 'N/A'}</td>
                    <td className="p-3">{req.artisans?.location || 'N/A'}</td>
                    <td className="p-3">
                      {req.submitted_at ? new Date(req.submitted_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3">
                      <VerifyBadge status={req.status} />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => navigate(`/admin/verifications/${req.id}`)}
                        className="bg-gov-navy hover:bg-gov-navy-light text-white text-[11px] font-bold py-1 px-3 rounded transition-colors cursor-pointer"
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
  );
}
