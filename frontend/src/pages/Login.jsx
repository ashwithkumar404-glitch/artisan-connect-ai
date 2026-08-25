import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/Button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('artisan'); // 'artisan' | 'admin'
  const navigate = useNavigate();

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    // Demo Mode redirect based on selection
    if (role === 'admin') {
      navigate('/admin/dashboard');
    } else {
      navigate('/artisan/dashboard');
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

      {/* Demo Warning Notice */}
      <div className="bg-amber-50 border border-amber-300 rounded p-4 text-xs text-amber-900 leading-relaxed">
        <strong>⚠️ Prototype Notice:</strong> Authentication databases are not connected in this frontend-only stage. You can enter any mock credentials and select a role below to access the respective dashboards.
      </div>

      {/* Form */}
      <form onSubmit={handleLoginSubmit} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        {/* Role Selector */}
        <div className="space-y-1.5">
          <label htmlFor="login-role" className="block text-sm font-bold text-slate-700">
            Select Your Role
          </label>
          <select
            id="login-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy font-semibold text-slate-800"
          >
            <option value="artisan">Artisan (Self-Service Portal)</option>
            <option value="admin">Government Administrator (Audit Panel)</option>
          </select>
        </div>

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
        <Button type="submit" variant="primary" className="w-full py-2.5 mt-2 font-bold">
          Login (Demo Mode)
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
