import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const categories = [
    { name: 'Bamboo & Natural Craft', icon: '🎋' },
    { name: 'Handloom & Textiles', icon: '🧵' },
    { name: 'Pottery', icon: '🏺' },
    { name: 'Wood Craft', icon: '🪵' },
    { name: 'Metal Craft', icon: '⚒️' },
    { name: 'Jewellery', icon: '📿' },
    { name: 'Other Handicrafts', icon: '🎨' },
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?search=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate('/explore');
    }
  };

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="bg-slate-900 text-white py-16 px-4 text-center border-b-4 border-gov-saffron">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            Discover and support India's artisans and handmade products.
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Artisan Connect AI links marginalized craftspersons directly to customers, providing AI-assisted cataloguing and digital market visibility.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <Link to="/explore" className="w-full sm:w-auto">
              <Button variant="primary" className="w-full py-3.5 text-lg">
                Explore Products
              </Button>
            </Link>
            <Link to="/register" className="w-full sm:w-auto">
              <Button variant="accent" className="w-full py-3.5 text-lg">
                Join as Artisan
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Mock Search Bar Section */}
      <section className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-2xl font-bold text-gov-navy mb-4">Search National Handicrafts</h2>
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-grow">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400" aria-hidden="true">
              🔍
            </span>
            <input
              type="text"
              placeholder="What craft are you looking for? (e.g. Pottery, Shawls)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg shadow-sm text-base focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
              aria-label="Search products"
            />
          </div>
          <Button type="submit" variant="primary" className="py-3 px-8 text-base">
            Search
          </Button>
        </form>
      </section>

      {/* Craft Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gov-navy text-center mb-8 border-b-2 border-slate-200 pb-2">
          Explore by Traditional Crafts
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              to={`/explore?category=${encodeURIComponent(cat.name)}`}
              className="bg-white border border-slate-200 hover:border-gov-navy hover:shadow-md rounded-lg p-6 flex flex-col items-center justify-center text-center transition-all focus:ring-2 focus:ring-gov-navy"
            >
              <span className="text-4xl mb-3" role="img" aria-label={cat.name}>
                {cat.icon}
              </span>
              <span className="text-base font-bold text-slate-800">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-slate-100 py-12 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gov-navy text-center mb-10">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-gov-navy font-bold text-xl flex items-center justify-center mx-auto mb-4 border border-slate-300">
                1
              </div>
              <h3 className="font-bold text-lg text-slate-850 mb-2">Artisan Verification</h3>
              <p className="text-sm text-slate-655 leading-relaxed">
                Artisans submit their craft details and ID files. Regional administrators review and certify profiles to verify authentic handiwork.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-gov-navy font-bold text-xl flex items-center justify-center mx-auto mb-4 border border-slate-300">
                2
              </div>
              <h3 className="font-bold text-lg text-slate-850 mb-2">AI Smart Cataloging</h3>
              <p className="text-sm text-slate-655 leading-relaxed">
                Artisans upload basic photos. The AI model generates complete description text and categorizes pricing recommendations, which artisans edit and confirm.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-gov-navy font-bold text-xl flex items-center justify-center mx-auto mb-4 border border-slate-300">
                3
              </div>
              <h3 className="font-bold text-lg text-slate-850 mb-2">Direct Enquiries</h3>
              <p className="text-sm text-slate-655 leading-relaxed">
                Customers discover products and send message enquiries directly to the artisan's mobile, bypass middlemen, and build authentic connections.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust / Verification Banner */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3">
            <span className="bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider px-2.5 py-1 rounded">
              Verified Heritage
            </span>
            <h2 className="text-2xl font-bold text-emerald-950">
              Government Verified Authenticity
            </h2>
            <p className="text-slate-700 text-sm max-w-2xl leading-relaxed">
              Every seller on the Artisan Connect AI portal undergoes strict evaluation. Our regional officers review handicraft licenses, state award proofs, and workshop setups to ensure that you are ordering genuine artisan-made products.
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center justify-center bg-white border border-emerald-300 w-24 h-24 rounded-full shadow-inner">
            <span className="text-4xl" role="img" aria-label="Verified Shield">
              🛡️
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
