import React from 'react';

/**
 * Reusable badge showing the verification status of an artisan.
 */
export default function VerifyBadge({ status = 'unverified' }) {
  const styles = {
    verified: 'bg-green-100 text-green-900 border-green-300',
    approved: 'bg-green-100 text-green-900 border-green-300',
    pending: 'bg-amber-100 text-amber-900 border-amber-300',
    under_review: 'bg-blue-105 text-blue-900 border-blue-300',
    submitted: 'bg-amber-100 text-amber-900 border-amber-300',
    unverified: 'bg-slate-100 text-slate-900 border-slate-300',
    not_submitted: 'bg-slate-100 text-slate-900 border-slate-300',
    pending_submission: 'bg-slate-100 text-slate-900 border-slate-300',
    rejected: 'bg-red-100 text-red-900 border-red-300',
  };

  const labels = {
    verified: '✓ Govt. Verified',
    approved: '✓ Govt. Verified',
    pending: '⏳ Verification Pending',
    under_review: '🔎 Verification Under Review',
    submitted: '🕐 Verification Submitted',
    unverified: '⚠️ Verification Pending Submission',
    not_submitted: '⚠️ Verification Pending Submission',
    pending_submission: '⚠️ Verification Pending Submission',
    rejected: '❌ Verification Rejected',
  };

  const currentStyle = styles[status] || styles.unverified;
  const currentLabel = labels[status] || labels.unverified;

  return (
    <span className={`inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full border ${currentStyle}`}>
      {currentLabel}
    </span>
  );
}
