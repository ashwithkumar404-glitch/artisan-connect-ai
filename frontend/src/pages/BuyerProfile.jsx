import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Button from '../components/Button';

export default function BuyerProfile() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Initialize input fields when the profile finishes loading
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  // If session or profile is loading, render a spinner
  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-655">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // If no user is authenticated, redirect to login
  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <h3 className="text-lg font-bold text-gov-navy">Access Denied</h3>
        <p className="text-slate-600">Please login to view and manage your profile details.</p>
        <Button onClick={() => navigate('/login')} variant="primary">
          Go to Login
        </Button>
      </div>
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSuccessMessage('');

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();

    // Check if anything has actually changed
    const currentName = profile?.full_name || '';
    const currentPhone = profile?.phone || '';

    if (trimmedName === currentName && trimmedPhone === currentPhone) {
      setSuccessMessage('No changes to save.');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("Updating profile in Supabase for user:", user.id);
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: trimmedName || null,
          phone: trimmedPhone || null
        })
        .eq('id', user.id);

      if (error) {
        console.error("Profile update error:", error);
        setSubmitError(error.message || 'Failed to update profile.');
        return;
      }

      console.log("Profile updated successfully, refreshing context...");
      await refreshProfile();
      setSuccessMessage('Your profile has been updated successfully!');
    } catch (err) {
      console.error("Profile update exception:", err);
      setSubmitError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-gov-navy m-0">My Profile</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your customer profile and account details.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
        {successMessage && (
          <div className="p-3 bg-emerald-50 text-emerald-800 text-sm font-semibold rounded border border-emerald-100">
            {successMessage}
          </div>
        )}

        {submitError && (
          <div className="p-3 bg-red-50 text-red-800 text-sm font-semibold rounded border border-red-100">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Email (Read Only) */}
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-700">
              Email Address
            </label>
            <input
              type="email"
              disabled
              value={user.email || ''}
              className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-400">Your email address cannot be changed.</p>
          </div>

          {/* Role (Read Only) */}
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-700">
              Account Type
            </label>
            <input
              type="text"
              disabled
              value={profile?.role ? profile.role.toUpperCase() : 'BUYER'}
              className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded cursor-not-allowed"
            />
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="block text-sm font-bold text-slate-700">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy text-slate-800"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <label htmlFor="phone" className="block text-sm font-bold text-slate-700">
              Mobile Number
            </label>
            <input
              id="phone"
              type="tel"
              placeholder={profile?.phone ? "" : "Not Provided"}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy text-slate-800"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="w-full sm:w-auto font-bold mt-2"
          >
            {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
          </Button>
        </form>
      </div>
    </div>
  );
}
