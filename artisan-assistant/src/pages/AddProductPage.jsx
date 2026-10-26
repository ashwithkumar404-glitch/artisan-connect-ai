import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

function AddProductPage() {
  const { user, artisan, loading: authLoading } = useAuth();

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [status, setStatus] = useState('draft'); // draft | published
  const [createdProductId, setCreatedProductId] = useState(null);
  const [step, setStep] = useState('form'); // 'form' | 'review' | 'saving' | 'done'
  const [errorMsg, setErrorMsg] = useState('');

  // Load marketplace categories
  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');
      if (!error && data && data.length > 0) {
        setCategories(data);
        setSelectedCategory(data[0].id);
      }
    }
    fetchCategories();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!user) {
      setErrorMsg('You must sign in to save products.');
      return;
    }
    if (!artisan) {
      setErrorMsg('Artisan profile not found. Please complete artisan registration.');
      return;
    }

    setStep('review');
  };

  const handleConfirmSave = async (targetStatus = 'draft') => {
    if (!artisan) return;

    try {
      setStep('saving');
      setErrorMsg('');

      // Validation
      const numPrice = parseFloat(price);
      const numQty = parseInt(quantity, 10);
      if (isNaN(numPrice) || numPrice <= 0) {
        throw new Error('Please enter a valid price greater than 0.');
      }
      if (isNaN(numQty) || numQty < 0) {
        throw new Error('Please enter a valid non-negative quantity.');
      }

      // Check verification if trying to publish directly
      if (targetStatus === 'published' && artisan.verification_status !== 'approved') {
        throw new Error('Artisan account must be verified before publishing. You can save as a Draft instead.');
      }

      // 1. Insert product record
      const { data: newProd, error: prodErr } = await supabase
        .from('products')
        .insert({
          artisan_id: artisan.id,
          category_id: selectedCategory,
          name: productName.trim(),
          description: description.trim(),
          price: numPrice,
          stock_quantity: numQty,
          status: targetStatus
        })
        .select()
        .single();

      if (prodErr) throw prodErr;
      setCreatedProductId(newProd.id);

      // 2. Upload photo if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const storagePath = `${artisan.id}/${newProd.id}/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(storagePath, imageFile);

        if (uploadErr) {
          console.warn('Storage upload warning:', uploadErr);
        } else {
          const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(storagePath);

          await supabase.from('product_images').insert({
            product_id: newProd.id,
            image_url: urlData.publicUrl,
            display_order: 0
          });
        }
      }

      setStatus(targetStatus);
      setStep('done');
    } catch (err) {
      console.error('Error saving product:', err);
      setErrorMsg(err.message || 'Failed to save product.');
      setStep('review');
    }
  };

  const reset = () => {
    setImageFile(null);
    setImagePreview('');
    setProductName('');
    setDescription('');
    setPrice('');
    setQuantity('1');
    setErrorMsg('');
    setCreatedProductId(null);
    setStep('form');
  };

  if (authLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading session...</div>;
  }

  if (!user) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <h2>Sign In Required</h2>
        <p>Please log in with your artisan account to add products.</p>
        <Link to="/" style={{ display: 'inline-block', marginTop: '1rem', padding: '0.6rem 1.2rem', background: 'var(--accent)', color: 'white', borderRadius: '6px', textDecoration: 'none' }}>
          Back to Home
        </Link>
      </div>
    );
  }

  const selectedCatObj = categories.find((c) => c.id === selectedCategory);

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.5rem', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Add a Product</h1>
        <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>← Home</Link>
      </div>

      {errorMsg && (
        <div style={{ padding: '0.75rem', background: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '1rem' }}>
          {errorMsg}
        </div>
      )}

      {step === 'form' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontWeight: 500 }}>
            Photo (Camera or Gallery):
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '6px' }}
            />
          </label>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="preview"
              style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '6px' }}
            />
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontWeight: 500 }}>
            Product Title:
            <input
              type="text"
              value={productName}
              placeholder="e.g. Handwoven Bamboo Storage Basket"
              onChange={(e) => setProductName(e.target.value)}
              required
              style={{ padding: '0.6rem', border: '1px solid #ccc', borderRadius: '6px' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontWeight: 500 }}>
            Category:
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ padding: '0.6rem', border: '1px solid #ccc', borderRadius: '6px' }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontWeight: 500 }}>
            Description:
            <textarea
              value={description}
              placeholder="Describe materials, craft technique, dimensions..."
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              style={{ padding: '0.6rem', border: '1px solid #ccc', borderRadius: '6px' }}
            />
          </label>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', fontWeight: 500 }}>
              Price (₹):
              <input
                type="number"
                min="1"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                style={{ padding: '0.6rem', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </label>

            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', fontWeight: 500 }}>
              Quantity:
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                style={{ padding: '0.6rem', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </label>
          </div>

          <button
            type="submit"
            style={{
              padding: '0.85rem',
              background: 'var(--accent, #075E54)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: '0.5rem'
            }}
          >
            Review Listing
          </button>
        </form>
      )}

      {step === 'review' && (
        <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0 }}>Review Product Details</h2>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="preview"
              style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.75rem' }}
            />
          )}
          <p><strong>Title:</strong> {productName}</p>
          <p><strong>Category:</strong> {selectedCatObj?.name || 'Selected Category'}</p>
          <p><strong>Description:</strong> {description}</p>
          <p><strong>Price:</strong> ₹{price}</p>
          <p><strong>Quantity:</strong> {quantity}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.25rem' }}>
            {artisan?.verification_status === 'approved' ? (
              <button
                onClick={() => handleConfirmSave('published')}
                style={{
                  padding: '0.75rem',
                  background: 'var(--accent, #075E54)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🚀 Publish Directly
              </button>
            ) : null}

            <button
              onClick={() => handleConfirmSave('draft')}
              style={{
                padding: '0.75rem',
                background: '#128C7E',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              💾 Save as Draft
            </button>

            <button
              onClick={() => setStep('form')}
              style={{
                padding: '0.65rem',
                background: '#e0e0e0',
                color: '#333',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              ✏️ Back to Edit
            </button>
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Saving your product to Artisan Connect AI...</p>
        </div>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '2rem', background: '#e8f5e9', borderRadius: '8px' }}>
          <h2 style={{ color: '#2e7d32' }}>✅ Product Saved Successfully!</h2>
          <p>
            Your product has been saved as <strong>{status.toUpperCase()}</strong>.
            It is synchronized with your Artisan Dashboard.
          </p>
          {createdProductId && (
            <p style={{ fontSize: '0.85rem', color: '#666' }}>ID: {createdProductId}</p>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button
              onClick={reset}
              style={{ padding: '0.6rem 1rem', background: 'var(--accent, #075E54)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              + Add Another
            </button>
            <Link
              to="/my-products"
              style={{ padding: '0.6rem 1rem', background: '#128C7E', color: 'white', borderRadius: '6px', textDecoration: 'none' }}
            >
              View My Products
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddProductPage;
