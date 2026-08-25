import React from 'react';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      {/* Page Title */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gov-navy m-0">About Artisan Connect AI</h1>
        <p className="text-gov-saffron font-bold text-sm tracking-widest uppercase">
          SIH 2026 Problem Statement SIH26090
        </p>
      </div>

      {/* Core Project Statement */}
      <section className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm space-y-4">
        <h2 className="text-xl font-bold text-gov-navy m-0 border-b border-slate-200 pb-2">
          Project Objective
        </h2>
        <p className="text-slate-700 text-base leading-relaxed">
          <strong>Artisan Connect AI</strong> is an AI-driven digital marketplace and smart cataloging mobile-first application designed specifically to empower marginalized artisans in India. Many traditional craftspersons lack technical literacy and marketing resources, leaving them vulnerable to intermediaries.
        </p>
        <p className="text-slate-700 text-base leading-relaxed">
          By providing simple registration, localized user interfaces, and automated AI assistance for product descriptions, catalog generation, and fair pricing, the platform establishes a direct linkage between authentic regional artisans and end-customers.
        </p>
      </section>

      {/* Three User Types */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gov-navy text-center mb-6">Platform User Roles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Customer */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-2 shadow-sm">
            <div className="text-2xl" aria-hidden="true">🛍️</div>
            <h3 className="font-bold text-lg text-slate-800">1. Customers</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Explore authentic regional crafts, check government-verified artisan status, and send enquiries directly to artisans without middleman markups.
            </p>
          </div>
          {/* Artisan */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-2 shadow-sm">
            <div className="text-2xl" aria-hidden="true">🧵</div>
            <h3 className="font-bold text-lg text-slate-800">2. Artisans</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Register via mobile, complete verification, upload craft photos, receive automated AI catalog support, and manage customer enquiries directly.
            </p>
          </div>
          {/* Admin */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-2 shadow-sm">
            <div className="text-2xl" aria-hidden="true">🏛️</div>
            <h3 className="font-bold text-lg text-slate-800">3. Administrators</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Verify artisan credentials, inspect products for quality and authenticity, approve profiles, and moderate listings.
            </p>
          </div>
        </div>
      </section>

      {/* Government Support */}
      <section className="bg-slate-50 border border-slate-200 rounded-lg p-6 flex items-start gap-4">
        <div className="text-3xl mt-1" aria-hidden="true">🇮🇳</div>
        <div className="space-y-2">
          <h3 className="font-bold text-slate-850 m-0">National Heritage Protection</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            This project aligns with national initiatives supporting rural self-employment and geographical indications (GI) for Indian handicrafts, promoting local manufacturing (Atmanirbhar Bharat).
          </p>
        </div>
      </section>
    </div>
  );
}
