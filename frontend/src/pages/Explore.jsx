import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  // Fetch published products matching active filters from Supabase
  useEffect(() => {
    let active = true;

    async function fetchExploreProducts() {
      try {
        setLoading(true);
        setError('');

        const hasCategoryFilter = selectedCategory !== 'All';
        
        const selectStr = `
          id,
          name,
          description,
          price,
          stock_quantity,
          status,
          created_at,
          categories${hasCategoryFilter ? '!inner' : ''} (
            id,
            name
          ),
          product_images (
            image_url
          ),
          artisans (
            id,
            business_name,
            location,
            profiles (
              full_name
            )
          )
        `;

        let query = supabase
          .from('products')
          .select(selectStr)
          .eq('status', 'published');

        if (hasCategoryFilter) {
          query = query.eq('categories.name', selectedCategory);
        }

        if (searchTerm.trim()) {
          query = query.or(`name.ilike.%${searchTerm.trim()}%,description.ilike.%${searchTerm.trim()}%`);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        if (active) {
          setProducts(data || []);
        }
      } catch (err) {
        console.error('Error fetching explore products:', err);
        if (active) {
          setError(err.message || 'Failed to load products list.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchExploreProducts();

    return () => {
      active = false;
    };
  }, [searchTerm, selectedCategory]);

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

      {/* Product Grid Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-lg space-y-4">
          <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-500">Loading handicrafts...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded p-4 text-sm font-semibold flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>{error}</div>
        </div>
      ) : products.length === 0 ? (
        <div className="border border-dashed border-slate-350 bg-slate-50 rounded-lg p-12 text-center max-w-4xl mx-auto">
          <span className="text-3xl block mb-3" role="img" aria-label="No products">🔍</span>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No Handicrafts Found</h2>
          <p className="text-slate-550 max-w-md mx-auto text-sm leading-relaxed">
            We couldn't find any published handicrafts matching your filters. Try selecting another category or searching for different keywords.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const imageUrl = product.product_images && product.product_images.length > 0
              ? product.product_images[0].image_url
              : null;
            const categoryName = product.categories?.name || 'Uncategorized';
            const artisanName = product.artisans?.business_name || product.artisans?.profiles?.full_name || 'Unknown Artisan';
            const locationName = product.artisans?.location || 'Unknown Location';
            
            return (
              <div key={product.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                {/* Image Section */}
                <div className="h-48 bg-slate-50 relative flex items-center justify-center border-b border-slate-100">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' class='w-12 h-12'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'/%3E%3C/svg%3E";
                      }}
                    />
                  ) : (
                    <div className="text-slate-450 text-center flex flex-col items-center">
                      <span className="text-3xl mb-1" role="img" aria-label="package placeholder icon">📦</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">No Image</span>
                    </div>
                  )}
                  {product.stock_quantity === 0 && (
                    <span className="absolute top-2 right-2 bg-red-655 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      Out of Stock
                    </span>
                  )}
                </div>
                
                {/* Info Section */}
                <div className="p-4 flex-grow flex flex-col justify-between space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gov-saffron">
                      {categoryName}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base line-clamp-1 m-0">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed h-8">
                      {product.description || 'No description provided.'}
                    </p>
                  </div>
                  
                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[10px]">Artisan:</span>
                      <span className="font-bold text-slate-700 truncate max-w-[120px]" title={artisanName}>
                        {artisanName}
                      </span>
                    </div>
                    {locationName && (
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400">Location:</span>
                        <span className="font-semibold text-slate-600">{locationName}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400">Availability:</span>
                      <span className={`font-semibold ${product.stock_quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {product.stock_quantity > 0 ? `${product.stock_quantity} available` : 'Out of stock'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-lg font-extrabold text-slate-900">
                      ₹{Number(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <Link to={`/product/${product.id}`} className="inline-block">
                      <button className="bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold px-3 py-2 rounded transition-colors cursor-pointer min-h-[32px] inline-flex items-center justify-center shadow-sm">
                        View Product
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
