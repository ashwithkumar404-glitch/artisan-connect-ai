import React from 'react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gov-navy m-0">National Administrator Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">
          Monitor artisan onboarding, review identity certificates, and moderate catalogs.
        </p>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Pending Verifications */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm border-l-4 border-amber-500">
          <div className="text-3xl mb-2" aria-hidden="true">⏳</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Audit</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">0</span>
          <span className="block text-xs text-slate-450 mt-2 font-semibold">Artisans awaiting review</span>
        </div>

        {/* Card 2: Verified Artisans */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm border-l-4 border-emerald-600">
          <div className="text-3xl mb-2" aria-hidden="true">👥</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Verified Artisans</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">0</span>
          <span className="block text-xs text-slate-450 mt-2 font-semibold">Total active members</span>
        </div>

        {/* Card 3: Total Products */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm border-l-4 border-gov-navy">
          <div className="text-3xl mb-2" aria-hidden="true">📦</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total Products</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">0</span>
          <span className="block text-xs text-slate-450 mt-2 font-semibold">Handicraft listings</span>
        </div>

        {/* Card 4: Enquiries */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm border-l-4 border-gov-saffron">
          <div className="text-3xl mb-2" aria-hidden="true">✉️</div>
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Buyer Enquiries</span>
          <span className="block text-3xl font-extrabold text-slate-800 mt-1">0</span>
          <span className="block text-xs text-slate-450 mt-2 font-semibold">Routed connections</span>
        </div>
      </div>

      {/* Admin Queue Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 m-0">Recent Verification Requests</h3>
          <p className="text-sm text-slate-600">
            Audit newly registered craftspersons' identity details and Pehchan certification.
          </p>
          <Link
            to="/admin/verification"
            className="text-sm font-bold text-gov-navy hover:text-gov-navy-light inline-block"
          >
            Go to Verification Queue →
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 m-0">Product Moderation</h3>
          <p className="text-sm text-slate-600">
            Moderate AI-generated details, pricing bounds, and check listings for GI authenticity.
          </p>
          <Link
            to="/admin/products"
            className="text-sm font-bold text-gov-navy hover:text-gov-navy-light inline-block"
          >
            Moderate Products Panel →
          </Link>
        </div>
      </div>
    </div>
  );
}
