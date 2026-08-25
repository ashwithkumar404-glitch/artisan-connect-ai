import React from 'react';
import { Link } from 'react-router-dom';
import VerifyBadge from '../../components/VerifyBadge';

export default function ArtisanDashboard() {
  // Mock active verification status
  const verificationStatus = 'unverified'; // unverified | pending | verified

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
          <VerifyBadge status={verificationStatus} />
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Products */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="text-3xl mb-2" aria-hidden="true">📦</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total Products</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">0</span>
          <span className="block text-xs text-slate-450 mt-2 font-semibold">No database connected</span>
        </div>

        {/* Card 2: Published */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="text-3xl mb-2" aria-hidden="true">🌐</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Published Products</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">0</span>
          <span className="block text-xs text-slate-450 mt-2 font-semibold">Ready for display</span>
        </div>

        {/* Card 3: Enquiries */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="text-3xl mb-2" aria-hidden="true">✉️</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total Enquiries</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">0</span>
          <span className="block text-xs text-slate-450 mt-2 font-semibold">From buyers</span>
        </div>

        {/* Card 4: Shop Views */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="text-3xl mb-2" aria-hidden="true">👁️</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Profile Views</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">0</span>
          <span className="block text-xs text-slate-450 mt-2 font-semibold">Total impressions</span>
        </div>
      </div>

      {/* Warning/Info Block */}
      <div className="bg-slate-100 border border-slate-250 rounded-lg p-6 space-y-4">
        <h3 className="font-bold text-slate-800 m-0">Getting Started as a Certified Artisan</h3>
        <p className="text-sm text-slate-655 leading-relaxed">
          Before your products are visible on the public national marketplace, you must submit documents for verification. Regional admin officers review applications within 48 hours.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/artisan/verification"
            className="bg-gov-navy hover:bg-gov-navy-light text-white font-semibold text-sm px-4 py-2 rounded transition-colors inline-flex items-center min-h-[40px]"
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
      </div>
    </div>
  );
}
