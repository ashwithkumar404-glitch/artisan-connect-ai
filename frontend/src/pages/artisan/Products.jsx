import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/Button';

export default function Products() {
  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gov-navy m-0">My Product Catalog</h2>
          <p className="text-sm text-slate-500 mt-1">Add, edit, and publish your handcrafted products.</p>
        </div>
        <Link to="/artisan/products/new">
          <Button variant="secondary" className="font-semibold text-sm">
            ➕ Add New Product
          </Button>
        </Link>
      </div>

      {/* Empty State */}
      <div className="border-2 border-dashed border-slate-300 bg-white rounded-lg p-12 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-350">
          <span className="text-3xl" role="img" aria-label="Inbox shelf empty">
            📦
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">No Products Found</h3>
        <p className="text-slate-550 text-sm max-w-sm mx-auto mb-6 leading-relaxed">
          You haven't added any products to your catalog yet. Start uploading your handcrafted items to submit them for approval.
        </p>
        <Link to="/artisan/products/new">
          <Button variant="primary">Add Product Now</Button>
        </Link>
      </div>
    </div>
  );
}
