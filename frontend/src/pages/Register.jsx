import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/Button';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    location: '',
    category: 'Bamboo & Natural Craft'
  });
  const [showDemoAlert, setShowDemoAlert] = useState(false);
  const navigate = useNavigate();

  const categories = [
    'Bamboo & Natural Craft',
    'Handloom & Textiles',
    'Pottery',
    'Wood Craft',
    'Metal Craft',
    'Jewellery',
    'Other Handicrafts'
  ];

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value
    }));
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setShowDemoAlert(true);
    // Auto redirect after a short delay
    setTimeout(() => {
      navigate('/login');
    }, 3000);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gov-navy m-0">Artisan Registration</h1>
        <p className="text-sm text-slate-655">
          Join the national portal to access direct market linkages and smart AI cataloging.
        </p>
      </div>

      {/* Demo Success Alert Popup */}
      {showDemoAlert && (
        <div className="bg-green-150 border border-green-400 text-green-900 rounded p-4 text-sm font-semibold flex items-center gap-3">
          <span className="text-2xl">✓</span>
          <div>
            Artisan registered successfully (Mock UI)! <br />
            <span className="text-xs font-normal">Redirecting to login portal in 3 seconds...</span>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleRegisterSubmit} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-bold text-slate-700">
            Full Name (as per Govt ID)
          </label>
          <input
            id="name"
            type="text"
            required
            placeholder="e.g. Ramesh Kumar"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-bold text-slate-700">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            placeholder="example@email.com"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
          />
        </div>

        {/* Mobile */}
        <div className="space-y-1.5">
          <label htmlFor="mobile" className="block text-sm font-bold text-slate-700">
            Mobile Number (Aadhaar linked preferred)
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-350 bg-slate-100 text-slate-500 font-semibold text-sm">
              +91
            </span>
            <input
              id="mobile"
              type="tel"
              required
              pattern="[0-9]{10}"
              placeholder="9876543210"
              value={formData.mobile}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-slate-350 rounded-r focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-bold text-slate-700">
            Password (minimum 6 characters)
          </label>
          <input
            id="password"
            type="password"
            required
            minLength="6"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
          />
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <label htmlFor="location" className="block text-sm font-bold text-slate-700">
            Location (Town, District, State)
          </label>
          <input
            id="location"
            type="text"
            required
            placeholder="e.g. Kondapalli, NTR District, Andhra Pradesh"
            value={formData.location}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
          />
        </div>

        {/* Craft Category */}
        <div className="space-y-1.5">
          <label htmlFor="category" className="block text-sm font-bold text-slate-700">
            Primary Craft Category
          </label>
          <select
            id="category"
            value={formData.category}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy font-semibold text-slate-800"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <Button type="submit" variant="accent" className="w-full py-2.5 mt-2 font-bold">
          Register Artisan
        </Button>
      </form>

      {/* Redirect to Login */}
      <div className="text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="text-gov-navy font-bold hover:underline">
          Portal Login
        </Link>
      </div>
    </div>
  );
}
