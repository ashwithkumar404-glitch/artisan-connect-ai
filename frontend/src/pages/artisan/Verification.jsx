import React, { useState } from 'react';
import Button from '../../components/Button';

export default function Verification() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitVerification = (e) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate submission delay
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gov-navy m-0">Artisan Verification</h2>
          <p className="text-sm text-slate-500 mt-1">Submit authentic identity and craft files to certify your shop.</p>
        </div>
      </div>

      {/* Verification Status Banner */}
      {!submitted ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded p-4 flex items-start gap-3">
          <span className="text-2xl mt-0.5">⚠️</span>
          <div>
            <span className="font-bold block">Status: Verification Pending Submission</span>
            <p className="text-xs text-amber-800 mt-1">
              Your profile is not yet visible to buyers on the public marketplace. Please upload the required documents below to submit your shop profile for verification.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-300 text-blue-900 rounded p-4 flex items-start gap-3">
          <span className="text-2xl mt-0.5">⏳</span>
          <div>
            <span className="font-bold block">Status: Verification In Review</span>
            <p className="text-xs text-blue-800 mt-1">
              Thank you! Your documents were submitted successfully (Mock UI). Regional administrators have been notified to audit your shop profile and certificates.
            </p>
          </div>
        </div>
      )}

      {/* Submission Form Mockup */}
      <form onSubmit={handleSubmitVerification} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
        <h3 className="text-base font-bold text-gov-navy border-b border-slate-100 pb-2 m-0">Required Documents</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Item 1: Identity Card */}
          <div className="border border-slate-250 rounded-lg p-4 space-y-3">
            <span className="text-2xl" role="img" aria-label="Identity card icon">🪪</span>
            <h4 className="font-bold text-sm text-slate-800 m-0">1. Government Identity Card</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload Aadhaar Card, PAN Card, or Voter ID to confirm your full name and identity.
            </p>
            <div className="bg-slate-50 border border-slate-300 rounded p-3 text-center text-xs text-slate-500 cursor-not-allowed">
              Select ID file (PDF/JPG)...
            </div>
          </div>

          {/* Item 2: Craft Card */}
          <div className="border border-slate-250 rounded-lg p-4 space-y-3">
            <span className="text-2xl" role="img" aria-label="Certificate ribbon icon">📜</span>
            <h4 className="font-bold text-sm text-slate-800 m-0">2. Crafts Certificate / Pehchan Card</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload Ministry of Textiles Pehchan card, GI craft registration, or society membership.
            </p>
            <div className="bg-slate-50 border border-slate-300 rounded p-3 text-center text-xs text-slate-500 cursor-not-allowed">
              Select Certificate file...
            </div>
          </div>

          {/* Item 3: Workshop Photo */}
          <div className="border border-slate-250 rounded-lg p-4 space-y-3">
            <span className="text-2xl" role="img" aria-label="Workshop tools icon">⚒️</span>
            <h4 className="font-bold text-sm text-slate-800 m-0">3. Workshop or Handiwork Photo</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload photos of yourself creating the craft at your workspace to verify authenticity.
            </p>
            <div className="bg-slate-50 border border-slate-300 rounded p-3 text-center text-xs text-slate-500 cursor-not-allowed">
              Select Photo file...
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="border-t border-slate-100 pt-4 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || submitted}
            className="w-full sm:w-auto font-bold"
          >
            {submitting ? 'Submitting Files...' : submitted ? 'Submitted' : 'Submit for Admin Verification'}
          </Button>
        </div>
      </form>
    </div>
  );
}
