import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { createNotification } from '../../lib/notifications';
import Button from '../../components/Button';
import VerifyBadge from '../../components/VerifyBadge';

export default function Verification() {
  const { user } = useAuth();
  const [artisan, setArtisan] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // File uploading states
  const [uploadProgress, setUploadProgress] = useState({
    government_id: null,
    craft_certificate: null,
    workshop_photo: null,
  });

  // Signed URLs for previews
  const [signedUrls, setSignedUrls] = useState({
    government_id: '',
    craft_certificate: '',
    workshop_photo: '',
  });

  useEffect(() => {
    if (user) {
      loadArtisanAndVerification();
    }
  }, [user]);

  const loadArtisanAndVerification = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Fetch corresponding artisan profile
      const { data: artisanData, error: artisanErr } = await supabase
        .from('artisans')
        .select('id, verification_status, business_name, location, specialization, profiles(full_name, email)')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (artisanErr) throw artisanErr;
      if (!artisanData) {
        setError('No artisan profile found. Please create a shop profile first.');
        setLoading(false);
        return;
      }
      setArtisan(artisanData);

      // 2. Fetch existing verification request
      const { data: verificationData, error: verificationErr } = await supabase
        .from('artisan_verifications')
        .select('*')
        .eq('artisan_id', artisanData.id)
        .maybeSingle();

      if (verificationErr) {
        if (verificationErr.code === 'PGRST116') {
          throw new Error('Multiple verification records found. Please contact support to resolve this duplicate-record problem.');
        }
        throw verificationErr;
      }
      setVerification(verificationData);

      // 3. Generate signed URLs for existing files
      if (verificationData) {
        const urls = {};
        if (verificationData.government_id_url) {
          urls.government_id = await getSignedUrl(verificationData.government_id_url);
        }
        if (verificationData.craft_certificate_url) {
          urls.craft_certificate = await getSignedUrl(verificationData.craft_certificate_url);
        }
        if (verificationData.workshop_photo_url) {
          urls.workshop_photo = await getSignedUrl(verificationData.workshop_photo_url);
        }
        setSignedUrls(urls);
      }
    } catch (err) {
      console.error('Error loading verification status:', err);
      setError(err.message || 'Failed to load verification status.');
    } finally {
      setLoading(false);
    }
  };

  const getSignedUrl = async (path) => {
    if (!path) return '';
    try {
      const { data, error: signedUrlErr } = await supabase.storage
        .from('artisan-verification')
        .createSignedUrl(path, 3600); // 1 hour expiry
      if (signedUrlErr) throw signedUrlErr;
      return data?.signedUrl || '';
    } catch (err) {
      console.error('Error generating signed URL:', err);
      return '';
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccessMsg('');

    // Validation
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      setError('Invalid file type. Only PDF, JPG, JPEG, PNG, and WebP are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be under 5 MB.');
      return;
    }

    try {
      setUploadProgress(prev => ({ ...prev, [type]: 10 })); // simulate start

      // Upload file to artisan-verification bucket
      const filePath = `${artisan.id}/${type}-${Date.now()}.${fileExtension}`;
      
      setUploadProgress(prev => ({ ...prev, [type]: 50 }));

      const { error: uploadErr } = await supabase.storage
        .from('artisan-verification')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadErr) throw uploadErr;

      setUploadProgress(prev => ({ ...prev, [type]: 90 }));

      // Save/Upsert verification row to remember progress
      const nextGovId = type === 'government_id' ? filePath : (verification?.government_id_url || null);
      const nextCraftCert = type === 'craft_certificate' ? filePath : (verification?.craft_certificate_url || null);
      const nextWorkshopPhoto = type === 'workshop_photo' ? filePath : (verification?.workshop_photo_url || null);

      const payload = {
        artisan_id: artisan.id,
        government_id_url: nextGovId,
        craft_certificate_url: nextCraftCert,
        workshop_photo_url: nextWorkshopPhoto,
        status: verification?.status || 'not_submitted',
        updated_at: new Date().toISOString()
      };
      if (verification?.id) {
        payload.id = verification.id;
      }

      const { data: updatedVerification, error: upsertErr } = await supabase
        .from('artisan_verifications')
        .upsert(payload)
        .select()
        .single();

      if (upsertErr) throw upsertErr;

      // Update states
      setVerification(updatedVerification);
      const signedUrl = await getSignedUrl(filePath);
      setSignedUrls(prev => ({ ...prev, [type]: signedUrl }));
      setSuccessMsg(`${file.name} uploaded and saved successfully!`);
    } catch (err) {
      console.error('File upload error:', err);
      setError(err.message || 'Failed to upload document.');
    } finally {
      setUploadProgress(prev => ({ ...prev, [type]: null }));
    }
  };

  const handleRemoveFile = async (type) => {
    if (!verification) return;

    setError('');
    setSuccessMsg('');

    try {
      const pathToDelete = verification[`${type}_url`];
      if (pathToDelete) {
        // delete from storage
        await supabase.storage.from('artisan-verification').remove([pathToDelete]);
      }

      // update table
      const payload = {
        artisan_id: artisan.id,
        [`${type}_url`]: null,
        status: verification.status || 'not_submitted',
        updated_at: new Date().toISOString()
      };
      if (verification?.id) {
        payload.id = verification.id;
      }

      const { data: updatedVerification, error: updateErr } = await supabase
        .from('artisan_verifications')
        .upsert(payload)
        .select()
        .single();

      if (updateErr) throw updateErr;

      setVerification(updatedVerification);
      setSignedUrls(prev => ({ ...prev, [type]: '' }));
      setSuccessMsg('Document removed successfully.');
    } catch (err) {
      console.error('Error removing document:', err);
      setError(err.message || 'Failed to remove document.');
    }
  };

  const handleSubmitVerification = async (e) => {
    e.preventDefault();
    if (!verification || !verification.government_id_url || !verification.craft_certificate_url || !verification.workshop_photo_url) {
      setError('Please upload all three required documents before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccessMsg('');

      const { data: updatedVerification, error: updateErr } = await supabase
        .from('artisan_verifications')
        .update({
          status: 'submitted',
          rejection_reason: null, // Clear old rejection state
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', verification.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Create notification for all admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const artisanName = artisan?.profiles?.full_name || 'An artisan';
        const promises = admins.map(admin => 
          createNotification(
            admin.id,
            'verification_submitted',
            'New Artisan Verification Request',
            `${artisanName} has submitted an artisan verification request for review.`,
            verification.id,
            'verification'
          )
        );
        await Promise.all(promises);
      }

      setVerification(updatedVerification);
      setSuccessMsg('Verification submitted successfully. Your documents are now waiting for admin review.');
      
      // refresh status on artisan profile object locally
      setArtisan(prev => ({ ...prev, verification_status: 'under_review' }));
    } catch (err) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to submit verification request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusTextAndBanner = () => {
    const status = (artisan?.verification_status === 'approved') ? 'approved' : (verification?.status || artisan?.verification_status || 'not_submitted');
    switch (status) {
      case 'submitted':
        return {
          bannerClass: 'bg-blue-50 border-blue-300 text-blue-900',
          emoji: '⏳',
          title: 'Status: Verification Submitted',
          desc: 'Thank you! Your documents were submitted successfully. Our admin team will review your documents.',
        };
      case 'under_review':
        return {
          bannerClass: 'bg-indigo-50 border-indigo-300 text-indigo-900',
          emoji: '🔎',
          title: 'Status: Verification Under Review',
          desc: 'Your profile and credentials are actively under audit by government administration. Expect approval details shortly.',
        };
      case 'approved':
        return {
          bannerClass: 'bg-green-50 border-green-300 text-green-950',
          emoji: '✅',
          title: 'Status: Verified Artisan',
          desc: 'Congratulations! Your shop profile has been officially certified. Your published products are visible on the public marketplace.',
        };
      case 'rejected':
        return {
          bannerClass: 'bg-red-50 border-red-300 text-red-900',
          emoji: '❌',
          title: 'Status: Verification Requires Correction',
          desc: `Your request was rejected. Reason: ${verification?.rejection_reason || 'No comments left.'} Please review and resubmit documents below.`,
        };
      case 'not_submitted':
      default:
        return {
          bannerClass: 'bg-amber-50 border-amber-300 text-amber-900',
          emoji: '⚠️',
          title: 'Status: Verification Required',
          desc: 'Complete your artisan verification to publish products on the marketplace.',
        };
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-lg space-y-4">
        <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Checking verification status...</p>
      </div>
    );
  }

  const banner = getStatusTextAndBanner();
  const status = (artisan?.verification_status === 'approved') ? 'approved' : (verification?.status || artisan?.verification_status || 'not_submitted');
  const isApproved = status === 'approved';
  const isSubmitted = status === 'submitted' || status === 'under_review';

  const renderFileCard = (type, title, emoji, description, acceptedTypes) => {
    const fileUrl = verification?.[`${type}_url`];
    const signedUrl = signedUrls[type];
    const isUploading = uploadProgress[type] !== null;

    return (
      <div className="border border-slate-250 rounded-lg p-5 space-y-3 flex flex-col justify-between h-full bg-slate-50/50">
        <div>
          <span className="text-3xl" role="img" aria-label={title}>{emoji}</span>
          <h4 className="font-bold text-sm text-slate-800 mt-2 mb-1">{title}</h4>
          <p className="text-xs text-slate-500 leading-relaxed min-h-[36px]">{description}</p>
        </div>

        <div>
          {isUploading && (
            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-gov-navy h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${uploadProgress[type]}%` }}
              ></div>
            </div>
          )}

          {!fileUrl && !isUploading && (
            <label 
              className={`block w-full border border-slate-350 bg-white hover:bg-slate-50 text-slate-700 text-center font-bold text-xs py-2 px-4 rounded transition-colors cursor-pointer ${
                isApproved || isSubmitted ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              Select File
              <input 
                type="file" 
                accept={acceptedTypes}
                className="hidden" 
                onChange={(e) => handleFileUpload(e, type)}
                disabled={isApproved || isSubmitted}
              />
            </label>
          )}

          {fileUrl && !isUploading && (
            <div className="mt-2 p-2.5 bg-white border border-slate-200 rounded flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl flex-shrink-0">
                  {fileUrl.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                </span>
                <div className="min-w-0 flex-grow">
                  <span className="block text-[11px] text-slate-700 font-semibold truncate leading-none">
                    {fileUrl.split('/').pop()}
                  </span>
                  {signedUrl && (
                    <a
                      href={signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-gov-navy hover:underline font-bold mt-1 inline-block"
                    >
                      View File
                    </a>
                  )}
                </div>
              </div>
              {!isApproved && !isSubmitted && (
                <button
                  type="button"
                  onClick={() => handleRemoveFile(type)}
                  className="text-red-650 hover:text-red-800 text-[10px] font-bold p-1 cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const isFormValid = verification?.government_id_url && verification?.craft_certificate_url && verification?.workshop_photo_url;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gov-navy m-0">Artisan Verification</h2>
          <p className="text-sm text-slate-500 mt-1">Submit authentic identity and craft files to certify your shop.</p>
        </div>
        <div className="w-fit">
          <VerifyBadge status={verification?.status || 'unverified'} />
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="bg-green-50 border border-green-300 text-green-800 rounded p-4 text-sm font-semibold flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>{successMsg}</div>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded p-4 text-sm font-semibold flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {/* Verification Status Banner */}
      <div className={`border rounded-lg p-4 flex items-start gap-3 shadow-sm ${banner.bannerClass}`}>
        <span className="text-3xl flex-shrink-0">{banner.emoji}</span>
        <div>
          <span className="font-bold block text-sm">{banner.title}</span>
          <p className="text-xs mt-1 leading-relaxed">{banner.desc}</p>
        </div>
      </div>

      {/* Documents Upload Panel */}
      <form onSubmit={handleSubmitVerification} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
        {/* Profile Information Block */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider m-0">Artisan Profile Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Name:</span>
              <span className="block font-bold text-slate-800">{artisan?.profiles?.full_name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Email:</span>
              <span className="block font-bold text-slate-800">{artisan?.profiles?.email || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Craft / Specialization:</span>
              <span className="block font-bold text-slate-800">{artisan?.specialization || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Location:</span>
              <span className="block font-bold text-slate-800">{artisan?.location || 'N/A'}</span>
            </div>
          </div>
        </div>

        <h3 className="text-base font-bold text-gov-navy border-b border-slate-100 pb-2 m-0">Required Documents</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Government Identity Card */}
          {renderFileCard(
            'government_id',
            'Government Identity Card',
            '🪪',
            'Upload Aadhaar Card, PAN Card, or Voter ID to confirm your identity.',
            '.pdf,.jpg,.jpeg,.png,.webp'
          )}

          {/* Card 2: Pehchan Crafts Certificate */}
          {renderFileCard(
            'craft_certificate',
            'Crafts Certificate / Pehchan Card',
            '📜',
            'Upload Ministry of Textiles Pehchan Card, GI craft registration, or valid membership.',
            '.pdf,.jpg,.jpeg,.png,.webp'
          )}

          {/* Card 3: Workshop Photo */}
          {renderFileCard(
            'workshop_photo',
            'Workshop or Handiwork Photo',
            '⚒️',
            'Upload a photo showing you creating the craft at your workspace.',
            '.jpg,.jpeg,.png,.webp'
          )}
        </div>

        {/* Submit Actions */}
        <div className="border-t border-slate-100 pt-4 flex justify-between items-center flex-wrap gap-4">
          <Link to="/artisan/dashboard" className="text-sm font-semibold text-slate-500 hover:text-slate-700">
            ← Return to Dashboard
          </Link>
          
          {!isApproved && !isSubmitted && (
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !isFormValid}
              className="w-full sm:w-auto font-bold shadow"
            >
              {submitting ? 'Submitting Request...' : '🛡️ Submit for Admin Verification'}
            </Button>
          )}

          {isSubmitted && (
            <span className="text-xs text-slate-500 italic">
              Submitted on {new Date(verification?.submitted_at).toLocaleDateString()} at {new Date(verification?.submitted_at).toLocaleTimeString()}. Waiting for approval.
            </span>
          )}

          {isApproved && (
            <span className="text-xs text-green-600 font-bold flex items-center gap-1">
              ✅ Approved. Profile certified for public marketplace display.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
