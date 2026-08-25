import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All');

  const categories = [
    'All',
    'Bamboo & Natural Craft',
    'Handloom & Textiles',
    'Pottery',
    'Wood Craft',
    'Metal Craft',
    'Jewellery',
    'Other Handicrafts'
  ];

  // Sync state with URL params
  useEffect(() => {
    setSearchTerm(searchParams.get('search') || '');
    setSelectedCategory(searchParams.get('category') || 'All');
  }, [searchParams]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    const newParams = new URLSearchParams(searchParams);
    if (e.target.value) {
      newParams.set('search', e.target.value);
    } else {
      newParams.delete('search');
    }
    setSearchParams(newParams);
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    const newParams = new URLSearchParams(searchParams);
    if (category !== 'All') {
      newParams.set('category', category);
    } else {
      newParams.delete('category');
    }
    setSearchParams(newParams);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header and description */}
      <div className="text-center md:text-left space-y-2">
        <h1 className="text-3xl font-bold text-gov-navy m-0">Explore Handicrafts</h1>
        <p className="text-slate-600 max-w-2xl text-base">
          Browse traditional handmade crafts verified directly from marginalized Indian artisans.
        </p>
      </div>

      {/* Filter and Search Bar Grid */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
        {/* Search */}
        <div className="space-y-2">
          <label htmlFor="explore-search" className="block text-sm font-bold text-slate-800">
            Search products
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400" aria-hidden="true">
              🔍
            </span>
            <input
              id="explore-search"
              type="text"
              placeholder="Search by product name, materials, or artisan..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-350 rounded-md text-base focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="space-y-2">
          <span className="block text-sm font-bold text-slate-800">Filter by Traditional Category</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Categories">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategorySelect(cat)}
                className={`px-4 py-2 text-sm font-semibold rounded-md border transition-all cursor-pointer min-h-[40px] ${
                  selectedCategory === cat
                    ? 'bg-gov-navy text-white border-gov-navy'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Grid Area (Empty state) */}
      <div className="border border-dashed border-slate-300 bg-slate-50 rounded-lg p-12 text-center max-w-4xl mx-auto">
        <div className="w-16 h-16 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-350">
          <span className="text-3xl" role="img" aria-label="Database lock icon">
            🔌
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">No Active Database Connection</h2>
        <p className="text-slate-600 max-w-md mx-auto text-sm leading-relaxed mb-6">
          In this initial frontend stage, the backend database has not been connected yet. Once Supabase is integrated, verified artisan catalogs matching your filters will be rendered here dynamically.
        </p>
        <div className="bg-slate-100 border border-slate-250 p-4 rounded text-xs text-slate-500 text-left max-w-lg mx-auto font-mono">
          <div className="font-bold mb-1">🔍 Filter Query State (Active):</div>
          <div>• Search query: "{searchTerm || 'none'}"</div>
          <div>• Selected category: "{selectedCategory}"</div>
        </div>
      </div>
    </div>
  );
}
