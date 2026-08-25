import React from 'react';

export default function VerificationQueue() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-gov-navy m-0">Artisan Verification Queue</h2>
        <p className="text-sm text-slate-500 mt-1">
          Review credentials and approve/reject newly registered artisans.
        </p>
      </div>

      {/* Empty Queue State */}
      <div className="border border-dashed border-slate-350 bg-white rounded-lg p-12 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-300">
          <span className="text-3xl" role="img" aria-label="Shield certificate icon">
            🛡️
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Queue Empty</h3>
        <p className="text-slate-550 text-sm max-w-sm mx-auto leading-relaxed">
          There are no pending artisan verification requests. All submitted profiles have been processed.
        </p>
      </div>
    </div>
  );
}
