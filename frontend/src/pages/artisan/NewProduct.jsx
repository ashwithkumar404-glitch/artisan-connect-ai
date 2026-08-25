import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../../components/Button';

export default function NewProduct() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Bamboo & Natural Craft');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  
  const navigate = useNavigate();

  const categories = [
    'Bamboo & Natural Craft',
    'Handloom & Textiles',
    'Pottery',
    'Wood Craft',
    'Metal Craft',
    'Jewellery',
    'Other Handicrafts'
  ];

  const handleFormSubmit = (e) => {
    e.preventDefault();
    alert('Product Draft Saved (Mock Action)!');
    navigate('/artisan/products');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gov-navy m-0">Add New Product</h2>
          <p className="text-sm text-slate-500 mt-1">Create a catalog listing for your handicraft.</p>
        </div>
        <Link to="/artisan/products" className="text-sm font-semibold text-slate-600 hover:text-gov-navy">
          ← Cancel
        </Link>
      </div>

      {/* Main Grid: Form Left, AI Assistant Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-2">
          <form onSubmit={handleFormSubmit} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="prod-name" className="block text-sm font-bold text-slate-700">
                Product Name / Title
              </label>
              <input
                id="prod-name"
                type="text"
                required
                placeholder="e.g. Handwoven Bamboo Flower Basket"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label htmlFor="prod-category" className="block text-sm font-bold text-slate-700">
                Traditional Craft Category
              </label>
              <select
                id="prod-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy font-semibold text-slate-800"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <label htmlFor="prod-price" className="block text-sm font-bold text-slate-700">
                Price (INR ₹)
              </label>
              <input
                id="prod-price"
                type="number"
                required
                min="1"
                placeholder="e.g. 450"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="prod-desc" className="block text-sm font-bold text-slate-700">
                Product Description
              </label>
              <textarea
                id="prod-desc"
                rows="4"
                placeholder="Describe your craft, materials used, size, and care instructions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
              ></textarea>
            </div>

            {/* Image upload mockup */}
            <div className="space-y-1.5">
              <label htmlFor="prod-image" className="block text-sm font-bold text-slate-700">
                Upload Product Photos (Up to 3 images)
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 cursor-pointer">
                <span className="text-2xl" role="img" aria-label="Camera icon">📷</span>
                <p className="text-xs text-slate-500 mt-2">Click to select files (PNG, JPG) or drag & drop</p>
                <input
                  id="prod-image"
                  type="file"
                  accept="image/*"
                  disabled
                  className="hidden"
                />
                <span className="block text-[10px] text-slate-400 mt-1 font-semibold">Mock input - disabled at this stage</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="primary" className="font-bold flex-grow">
                Save Product Draft
              </Button>
              <Link to="/artisan/products" className="flex-grow">
                <Button variant="outline" className="w-full font-bold">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </div>

        {/* AI Assistant Column */}
        <div className="space-y-6">
          <div className="bg-slate-100 border border-slate-300 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl" role="img" aria-label="Robot AI icon">🤖</span>
              <h3 className="font-bold text-gov-navy m-0 text-base">AI Cataloguing Assistant</h3>
            </div>
            <p className="text-xs text-slate-655 leading-relaxed">
              To assist non-technical and marginalized artisans, the portal will include automated descriptions and tags.
            </p>
            <hr className="border-slate-200" />
            <div className="space-y-3">
              <div className="bg-white border border-slate-200 rounded p-3 text-xs space-y-1">
                <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">What it will do:</span>
                <p className="text-slate-600 leading-normal">
                  Once you upload a product photo, Gemini will automatically generate search tags, recommend a competitive pricing structure, and write description copy in local languages.
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-300 rounded p-3 text-xs text-amber-900 leading-normal">
                <strong>🔌 Integrations pending:</strong> Gemini APIs are not configured in this stage. A "Generate details using AI" trigger button will appear here once connected.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
