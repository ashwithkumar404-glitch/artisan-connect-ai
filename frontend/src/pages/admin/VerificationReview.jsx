import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { createNotification } from '../../lib/notifications';
import Button from '../../components/Button';
import VerifyBadge from '../../components/VerifyBadge';

export default function VerificationReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [request, setRequest] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Signed URLs for documents
  const [docUrls, setDocUrls] = useState({
    government_id: '',
    craft_certificate: '',
    workshop_photo: '',
  });

  useEffect(() => {
    if (user) {
      checkAdminRoleAndLoad();
    }
  }, [user, id]);

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
      await loadVerificationDetail();
    } catch (err) {
      console.error('Error verifying admin access:', err);
      setError('An error occurred while verifying credentials.');
      setLoading(false);
    }
  };

  const loadVerificationDetail = async () => {
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
              id,
              full_name,
              email
            )
          )
        `)
        .eq('id', id)
        .single();

      if (fetchErr) throw fetchErr;
      setRequest(data);

      // Generate signed URLs for documents
      if (data) {
        const urls = { government_id: '', craft_certificate: '', workshop_photo: '' };
        
        if (data.government_id_url) {
          const { data: signRes } = await supabase.storage
            .from('artisan-verification')
            .createSignedUrl(data.government_id_url, 3600);
          urls.government_id = signRes?.signedUrl || '';
        }
        if (data.craft_certificate_url) {
          const { data: signRes } = await supabase.storage
            .from('artisan-verification')
            .createSignedUrl(data.craft_certificate_url, 3600);
          urls.craft_certificate = signRes?.signedUrl || '';
        }
        if (data.workshop_photo_url) {
          const { data: signRes } = await supabase.storage
            .from('artisan-verification')
            .createSignedUrl(data.workshop_photo_url, 3600);
          urls.workshop_photo = signRes?.signedUrl || '';
        }

        setDocUrls(urls);
      }
    } catch (err) {
      console.error('Error loading request detail:', err);
      setError('Failed to load verification details.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkUnderReview = async () => {
    if (!request) return;
    try {
      setUpdating(true);
      setError('');
      
      const { data, error: updateErr } = await supabase
        .from('artisan_verifications')
        .update({
          status: 'under_review',
          reviewed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)
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
        .single();

      if (updateErr) throw updateErr;

      setRequest(data);
      setSuccessMsg('Request status marked as Under Review.');
    } catch (err) {
      console.error('Error marking under review:', err);
      setError(err.message || 'Failed to update request status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleApprove = async () => {
    if (!request) return;
    const confirmApprove = window.confirm(`Confirm approval for ${request.artisans?.profiles?.full_name || 'this artisan'}?`);
    if (!confirmApprove) return;

    try {
      setUpdating(true);
      setError('');

      const { error: updateErr } = await supabase
        .from('artisan_verifications')
        .update({
          status: 'approved',
          rejection_reason: null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateErr) throw updateErr;

      // Create notification for the artisan
      if (request?.artisans?.profiles?.id) {
        await createNotification(
          request.artisans.profiles.id,
          'verification_approved',
          'Artisan Verification Approved',
          'Your artisan verification has been approved. You can now publish products on the marketplace.',
          request.id,
          'verification'
        );
      }

      setSuccessMsg('Artisan verification approved successfully.');
      setTimeout(() => {
        navigate('/admin/verification');
      }, 1500);
    } catch (err) {
      console.error('Error approving artisan:', err);
      setError(err.message || 'Failed to approve verification.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      alert('Please specify a rejection reason.');
      return;
    }

    try {
      setUpdating(true);
      setError('');

      const { error: updateErr } = await supabase
        .from('artisan_verifications')
        .update({
          status: 'rejected',
          rejection_reason: rejectReason.trim(),
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateErr) throw updateErr;

      // Create notification for the artisan
      if (request?.artisans?.profiles?.id) {
        await createNotification(
          request.artisans.profiles.id,
          'verification_rejected',
          'Verification Requires Correction',
          `Your artisan verification requires correction. Reason: ${rejectReason.trim()}`,
          request.id,
          'verification'
        );
      }

      setShowRejectModal(false);
      setRejectReason('');
      setSuccessMsg('Verification rejected.');
      setTimeout(() => {
        navigate('/admin/verification');
      }, 1500);
    } catch (err) {
      console.error('Error rejecting artisan:', err);
      setError(err.message || 'Failed to reject request.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-lg space-y-4">
        <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Loading verification details...</p>
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
      {/* Header Navigation */}
      <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
        <button
          onClick={() => navigate('/admin/verification')}
          className="text-sm font-bold text-gov-navy hover:underline cursor-pointer"
        >
          ← Back to Verification Requests
        </button>
        <span className="text-xs font-semibold text-slate-500">ID: {id}</span>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gov-navy m-0">Artisan Verification Review</h2>
        <VerifyBadge status={request?.status} />
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="bg-green-50 border border-green-300 text-green-800 rounded p-4 text-sm font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>{successMsg}</div>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded p-4 text-sm font-semibold flex items-center gap-3 shadow-sm">
          <span className="text-2xl">⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {request && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gov-navy uppercase tracking-wider border-b pb-1.5 m-0">
                Artisan Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">Name</span>
                  <span className="font-bold text-slate-800 text-sm block mt-0.5">
                    {request.artisans?.profiles?.full_name || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Email Address</span>
                  <span className="font-bold text-slate-800 text-sm block mt-0.5">
                    {request.artisans?.profiles?.email || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Business Name</span>
                  <span className="font-bold text-slate-800 text-sm block mt-0.5">
                    {request.artisans?.business_name || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Location / State</span>
                  <span className="font-bold text-slate-800 text-sm block mt-0.5">
                    {request.artisans?.location || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Craft / Category</span>
                  <span className="font-bold text-slate-800 text-sm block mt-0.5">
                    {request.artisans?.specialization || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Experience Level</span>
                  <span className="font-bold text-slate-800 text-sm block mt-0.5">
                    {request.artisans?.experience_years} Years
                  </span>
                </div>
              </div>

              {request.status === 'rejected' && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded text-xs space-y-1">
                  <span className="font-bold">Prior Rejection Reason:</span>
                  <p className="italic m-0">{request.rejection_reason}</p>
                </div>
              )}
            </div>

            {/* Right Column: Files */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gov-navy uppercase tracking-wider border-b pb-1.5 m-0">
                Submitted Documents
              </h3>
              
              <div className="space-y-3">
                {/* Government ID */}
                <div className="bg-slate-50 border border-slate-200 rounded p-4 flex justify-between items-center text-xs">
                  <div>
                    <span className="block font-bold text-slate-800">🪪 Government Identity Card</span>
                    <span className="text-[10px] text-slate-400">Identity verification file</span>
                  </div>
                  {docUrls.government_id ? (
                    <a
                      href={docUrls.government_id}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gov-navy text-white text-xs py-1.5 px-3.5 rounded font-bold hover:bg-gov-navy-light shadow-sm cursor-pointer inline-block"
                    >
                      View Document
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">No File Uploaded</span>
                  )}
                </div>

                {/* Craft Certificate */}
                <div className="bg-slate-50 border border-slate-200 rounded p-4 flex justify-between items-center text-xs">
                  <div>
                    <span className="block font-bold text-slate-800">📜 Craft Certificate / Pehchan Card</span>
                    <span className="text-[10px] text-slate-400">Handicraft registration credential</span>
                  </div>
                  {docUrls.craft_certificate ? (
                    <a
                      href={docUrls.craft_certificate}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gov-navy text-white text-xs py-1.5 px-3.5 rounded font-bold hover:bg-gov-navy-light shadow-sm cursor-pointer inline-block"
                    >
                      View Document
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">No File Uploaded</span>
                  )}
                </div>

                {/* Workshop Photo */}
                <div className="bg-slate-50 border border-slate-200 rounded p-4 flex justify-between items-center text-xs">
                  <div>
                    <span className="block font-bold text-slate-800">⚒️ Workshop / Handiwork Photo</span>
                    <span className="text-[10px] text-slate-400">Workspace environment verification</span>
                  </div>
                  {docUrls.workshop_photo ? (
                    <a
                      href={docUrls.workshop_photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gov-navy text-white text-xs py-1.5 px-3.5 rounded font-bold hover:bg-gov-navy-light shadow-sm cursor-pointer inline-block"
                    >
                      View Photo
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">No File Uploaded</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="border-t border-slate-200 pt-5 flex flex-wrap gap-3">
            {request.status === 'submitted' && (
              <Button
                variant="secondary"
                disabled={updating}
                onClick={handleMarkUnderReview}
                className="font-bold text-xs shadow-sm py-2"
              >
                🔎 Mark Under Review
              </Button>
            )}

            {request.status !== 'approved' && (
              <Button
                variant="primary"
                disabled={updating}
                onClick={handleApprove}
                className="bg-green-700 hover:bg-green-800 text-white font-bold text-xs shadow-md py-2"
              >
                ✅ Approve Verification
              </Button>
            )}

            {request.status !== 'rejected' && (
              <Button
                variant="danger"
                disabled={updating}
                onClick={() => setShowRejectModal(true)}
                className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs shadow-md py-2"
              >
                ❌ Reject Verification
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleRejectSubmit} className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-gov-navy m-0">Confirm Rejection</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              A rejection reason is required. Explain what documents require correction, so the artisan can resubmit correct files.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="reject-notes" className="block text-xs font-bold text-slate-700">Reason</label>
              <textarea
                id="reject-notes"
                rows={4}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please upload a clearer workshop photograph."
                className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-gov-navy focus:outline-none"
              ></textarea>
            </div>

            <div className="flex justify-end gap-3 border-t pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <Button
                type="submit"
                variant="primary"
                disabled={updating}
                className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs shadow"
              >
                Confirm Rejection
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
