import React from 'react';

export default function ArtisansList() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-gov-navy m-0">Artisans Directory</h2>
        <p className="text-sm text-slate-500 mt-1">
          View and manage the directory of registered and verified regional craftspersons.
        </p>
      </div>

      {/* Empty State */}
      <div className="border border-dashed border-slate-350 bg-white rounded-lg p-12 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-300">
          <span className="text-3xl" role="img" aria-label="People network icon">
            👥
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">No Artisans Found</h3>
        <p className="text-slate-550 text-sm max-w-sm mx-auto leading-relaxed">
          There are no registered artisans in the directory yet. New registrations will compile here once the database integrations are completed.
        </p>
      </div>
    </div>
  );
}
