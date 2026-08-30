import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import VerifyBadge from '../../components/VerifyBadge';

export default function VerificationQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [verifications, setVerifications] = useState([]);
  const [filter, setFilter] = useState('all'); // all | submitted | under_review | approved | rejected
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
      await loadVerificationRequests();
    } catch (err) {
      console.error('Error verifying admin access:', err);
      setError('An error occurred while verifying credentials.');
      setLoading(false);
    }
  };

  const loadVerificationRequests = async () => {
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('artisan_verifications')
        .select(`
          *,
          artisans (
            id,
            business_name,
            location,
            specialization,
            experience_years,
            profiles (
              full_name,
              email
            )
          )
        `)
        .order('submitted_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setVerifications(data || []);
    } catch (err) {
      console.error('Error loading requests:', err);
      setError('Failed to load verification requests.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = verifications.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  if (loading && verifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-lg space-y-4">
        <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Loading admin queue...</p>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-gov-navy m-0">Artisan Verification Queue</h2>
        <p className="text-sm text-slate-500 mt-1">
          Review credentials and approve/reject newly registered artisans.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded p-4 text-sm font-semibold flex items-center gap-3 shadow-sm">
          <span className="text-2xl">⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {/* Requests Queue Grid & List */}
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {['all', 'submitted', 'under_review', 'approved', 'rejected'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer border ${
                filter === f
                  ? 'bg-gov-navy text-white border-gov-navy'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
            </button>
          ))}
        </div>

        {filteredRequests.length === 0 ? (
          <div className="border border-dashed border-slate-300 bg-white rounded-lg p-12 text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-250">
              <span className="text-3xl">🛡️</span>
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Queue Empty</h3>
            <p className="text-slate-500 text-xs max-w-xs mx-auto leading-relaxed">
              There are no verification requests matching your filter.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Artisan</th>
                  <th className="p-4">Business & Craft</th>
                  <th className="p-4">Submitted Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredRequests.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <span className="font-bold text-slate-900 block">
                        {req.artisans?.profiles?.full_name || 'Unknown User'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {req.artisans?.profiles?.email || 'No Email'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-semibold block">{req.artisans?.business_name || 'N/A'}</span>
                      <span className="text-[10px] text-slate-500 italic">{req.artisans?.specialization || 'N/A'}</span>
                    </td>
                    <td className="p-4">
                      {req.submitted_at ? new Date(req.submitted_at).toLocaleDateString() : 'Draft'}
                    </td>
                    <td className="p-4">
                      <VerifyBadge status={req.status} />
                    </td>
                    <td className="p-4 text-right">
                      <button
                        className="bg-gov-navy hover:bg-gov-navy-light text-white font-bold text-xs py-1 px-3 rounded transition-colors cursor-pointer"
                        onClick={() => navigate(`/admin/verifications/${req.id}`)}
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
