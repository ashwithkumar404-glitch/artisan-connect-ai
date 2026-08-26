import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Button from '../components/Button';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    console.log("LOGIN SUBMITTED", { email });
    setSubmitError('');
    setIsSubmitting(true);

    try {
      console.log("Calling supabase.auth.signInWithPassword for email:", email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log("LOGIN RESPONSE received:", { data, error });

      if (error) {
        console.error("LOGIN ERROR DETECTED:", error);
        setSubmitError(error.message);
        return;
      }

      // Fetch user profile from profiles table to retrieve their database-defined role
      console.log("Fetching profile for user ID:", data.user.id);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      console.log("PROFILE RESPONSE received:", { profile, profileError });

      if (profileError || !profile) {
        console.error("PROFILE LOADING ERROR:", profileError);
        setSubmitError(profileError?.message || 'User profile not found. Please contact support.');
        return;
      }

      console.log("Database-authorized role found:", profile.role);

      // Redirect to respective dashboard based on the database-authoritative role
      if (profile.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (profile.role === 'artisan') {
        navigate('/artisan/dashboard');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error("LOGIN EXCEPTION THROWS:", err);
      setSubmitError(err.message || 'An unexpected error occurred during login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gov-navy m-0">Portal Login</h1>
        <p className="text-sm text-slate-655">
          Access your artisan dashboard or administrative panel.
        </p>
      </div>

      {/* Error Notice */}
      {submitError && (
        <div className="bg-red-100 border border-red-400 text-red-900 rounded p-4 text-sm font-semibold flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>{submitError}</div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleLoginSubmit} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="block text-sm font-bold text-slate-700">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            placeholder="example@portal.gov.in"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label htmlFor="login-password" className="block text-sm font-bold text-slate-700">
              Password
            </label>
            <span className="text-xs text-slate-500 font-semibold cursor-not-allowed">Forgot Password?</span>
          </div>
          <input
            id="login-password"
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
          />
        </div>

        {/* Submit */}
        <Button type="submit" variant="primary" className="w-full py-2.5 mt-2 font-bold" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Login'}
        </Button>
      </form>

      {/* Redirect to Register */}
      <div className="text-center text-sm text-slate-600">
        New artisan?{' '}
        <Link to="/register" className="text-gov-saffron font-bold hover:underline">
          Register for Verification
        </Link>
      </div>
    </div>
  );
}
