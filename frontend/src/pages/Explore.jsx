import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useCart } from '../lib/CartContext';
import { useAuth } from '../lib/AuthContext';

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');

  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

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
    setSortBy(searchParams.get('sort') || 'newest');
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
          average_rating,
          review_count,
          categories${hasCategoryFilter ? '!inner' : ''} (
            id,
            name
          ),
          product_images (
            image_url
          ),
          artisans!inner (
            id,
            business_name,
            location,
            verification_status,
            profiles (
              full_name
            )
          )
        `;

        let query = supabase
          .from('products')
          .select(selectStr)
          .eq('status', 'published')
          .eq('artisans.verification_status', 'approved');

        if (hasCategoryFilter) {
          query = query.eq('categories.name', selectedCategory);
        }

        // Apply sorting
        if (sortBy === 'price-low') {
          query = query.order('price', { ascending: true });
        } else if (sortBy === 'price-high') {
          query = query.order('price', { ascending: false });
        } else if (sortBy === 'popular') {
          query = query.order('review_count', { ascending: false });
        } else if (sortBy === 'top-rated') {
          query = query.order('average_rating', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }

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
  }, [searchTerm, selectedCategory, sortBy]);

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

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', e.target.value);
    setSearchParams(newParams);
  };

  const handleAddToCart = (product, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    addToCart(product);
  };

  // Local search filter supporting name, description, artisan, location, craft, category
  const filteredProducts = products.filter((product) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    
    const nameMatch = product.name?.toLowerCase().includes(term);
    const descMatch = product.description?.toLowerCase().includes(term);
    const categoryMatch = product.categories?.name?.toLowerCase().includes(term);
    const artisanName = (
      product.artisans?.business_name || 
      product.artisans?.profiles?.full_name || 
      ''
    ).toLowerCase();
    const artisanMatch = artisanName.includes(term);
    const locationMatch = product.artisans?.location?.toLowerCase().includes(term);
    const specMatch = product.artisans?.specialization?.toLowerCase().includes(term);

    return nameMatch || descMatch || categoryMatch || artisanMatch || locationMatch || specMatch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      {/* Visual Floating Hero Section */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-gov-navy to-slate-900 text-white p-8 md:p-12 shadow-md">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(251,146,60,0.1),transparent_60%)]"></div>
        <div className="relative max-w-2xl space-y-4">
          <span className="inline-block bg-gov-saffron text-gov-navy text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow">
            Directly from Artisans
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight m-0">
            Support Local Heritage & Marginalized Indian Crafts
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed m-0 font-sans">
            Artisan Connect AI brings authentic, GI-tagged, and hand-woven crafts verified by local authorities straight to your doorstep. Bypassing middlemen secures higher incomes for indigenous creators.
          </p>
        </div>
      </div>

      {/* Filter, Search, and Sort Bar Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Search */}
          <div className="md:col-span-2 space-y-1.5">
            <label htmlFor="explore-search" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Search Products
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400" aria-hidden="true">
                🔍
              </span>
              <input
                id="explore-search"
                type="text"
                placeholder="Search by product name, category, location, or artisan shop..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-300 rounded focus:ring-2 focus:ring-gov-navy focus:bg-white text-sm transition-all"
              />
            </div>
          </div>

          {/* Sort By */}
          <div className="space-y-1.5">
            <label htmlFor="explore-sort" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Sort By
            </label>
            <select
              id="explore-sort"
              value={sortBy}
              onChange={handleSortChange}
              className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-300 rounded focus:ring-2 focus:ring-gov-navy focus:bg-white text-sm transition-all cursor-pointer text-slate-800"
            >
              <option value="newest">New Arrivals</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="popular">Popular (Most Reviewed)</option>
              <option value="top-rated">Top Rated</option>
            </select>
          </div>
        </div>

        {/* Category Filters */}
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Filter by Traditional Category</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Categories">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategorySelect(cat)}
                className={`px-4 py-2 text-xs font-semibold rounded border transition-all cursor-pointer min-h-[38px] ${
                  selectedCategory === cat
                    ? 'bg-gov-navy text-white border-gov-navy shadow-sm'
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
      ) : filteredProducts.length === 0 ? (
        <div className="border border-dashed border-slate-350 bg-slate-50 rounded-lg p-12 text-center max-w-4xl mx-auto">
          <span className="text-3xl block mb-3" role="img" aria-label="No products">🔍</span>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No Handicrafts Found</h2>
          <p className="text-slate-550 max-w-md mx-auto text-sm leading-relaxed">
            We couldn't find any published handicrafts matching your filters. Try selecting another category or searching for different keywords.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
            const imageUrl = product.product_images && product.product_images.length > 0
              ? product.product_images[0].image_url
              : null;
            const categoryName = product.categories?.name || 'Uncategorized';
            const artisanName = product.artisans?.business_name || product.artisans?.profiles?.full_name || 'Unknown Artisan';
            const locationName = product.artisans?.location || 'Unknown Location';
            
            return (
              <div key={product.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col hover:shadow-md transition-shadow relative">
                {/* Image Section */}
                <Link to={`/product/${product.id}`} className="block h-48 bg-slate-50 relative border-b border-slate-100 overflow-hidden group">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' class='w-12 h-12'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'/%3E%3C/svg%3E";
                      }}
                    />
                  ) : (
                    <div className="text-slate-455 text-center flex flex-col items-center justify-center h-full">
                      <span className="text-3xl mb-1" role="img" aria-label="package placeholder icon">📦</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">No Image</span>
                    </div>
                  )}
                  {product.stock_quantity === 0 && (
                    <span className="absolute top-2 right-2 bg-red-655 text-white text-[9px] font-extrabold px-2 py-0.5 rounded">
                      Out of Stock
                    </span>
                  )}
                </Link>
                
                {/* Info Section */}
                <div className="p-4 flex-grow flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase font-extrabold tracking-wider text-gov-saffron">
                        {categoryName}
                      </span>
                      {product.average_rating > 0 && (
                        <span className="text-xs font-bold text-amber-600 flex items-center gap-0.5">
                          ⭐ {Number(product.average_rating).toFixed(1)}
                          <span className="text-[10px] text-slate-400 font-normal">({product.review_count})</span>
                        </span>
                      )}
                    </div>
                    <Link to={`/product/${product.id}`} className="block">
                      <h3 className="font-bold text-slate-850 hover:text-gov-navy text-sm line-clamp-1 m-0">
                        {product.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed h-8 m-0">
                      {product.description || 'No description provided.'}
                    </p>
                  </div>
                  
                  <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Artisan:</span>
                      <span className="font-bold text-slate-700 truncate max-w-[120px] flex items-center gap-1" title={artisanName}>
                        {artisanName}
                        <span className="text-green-600" title="Govt. Verified Artisan">✓</span>
                      </span>
                    </div>
                    {locationName && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Location:</span>
                        <span className="font-semibold text-slate-600">{locationName}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Stock:</span>
                      <span className={`font-semibold ${product.stock_quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {product.stock_quantity > 0 ? `${product.stock_quantity} available` : 'Out of stock'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                    <span className="text-base font-extrabold text-slate-900">
                      ₹{Number(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Link to={`/product/${product.id}`} className="inline-block">
                        <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold py-1.5 px-2.5 rounded transition-all cursor-pointer min-h-[32px] inline-flex items-center justify-center">
                          Details
                        </button>
                      </Link>
                      <button
                        onClick={(e) => handleAddToCart(product, e)}
                        disabled={product.stock_quantity === 0}
                        className={`bg-gov-navy hover:bg-gov-navy-light text-white text-[11px] font-bold py-1.5 px-3 rounded transition-all cursor-pointer min-h-[32px] inline-flex items-center justify-center shadow-sm ${
                          product.stock_quantity === 0 ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                      >
                        🛒 Add
                      </button>
                    </div>
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
