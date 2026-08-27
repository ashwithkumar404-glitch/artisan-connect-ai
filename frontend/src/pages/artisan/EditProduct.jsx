import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Button from '../../components/Button';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

export default function EditProduct() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');

  // Image management states
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [originalImageUrl, setOriginalImageUrl] = useState(''); // Keep track to delete from storage if replaced
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  const [categoriesList, setCategoriesList] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [productError, setProductError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Load categories and product details
  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!user) return;

      try {
        setLoadingCategories(true);
        setLoadingProduct(true);
        setProductError('');
        setCategoriesError('');

        // 1. Fetch categories
        const { data: cats, error: catError } = await supabase
          .from('categories')
          .select('id, name')
          .order('name', { ascending: true });

        if (catError) throw catError;

        if (active) {
          setCategoriesList(cats || []);
        }

        // 2. Fetch corresponding artisan record
        const { data: artisan, error: artisanError } = await supabase
          .from('artisans')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (artisanError) throw artisanError;

        if (!artisan) {
          throw new Error('No artisan profile found. You must be registered as an artisan to edit products.');
        }

        // 3. Fetch product details
        const { data: product, error: productError } = await supabase
          .from('products')
          .select(`
            id,
            artisan_id,
            category_id,
            name,
            description,
            price,
            stock_quantity,
            product_images (
              image_url
            )
          `)
          .eq('id', id)
          .single();

        if (productError) throw productError;

        if (product.artisan_id !== artisan.id) {
          throw new Error('Access Denied. You do not have permission to edit this product.');
        }

        // 4. Pre-populate form fields
        if (active) {
          setName(product.name || '');
          setSelectedCategoryId(product.category_id || '');
          setPrice(product.price ? String(product.price) : '');
          setDescription(product.description || '');
          setStockQuantity(product.stock_quantity ? String(product.stock_quantity) : '0');

          const imageRecs = product.product_images || [];
          if (imageRecs.length > 0) {
            setExistingImageUrl(imageRecs[0].image_url);
            setOriginalImageUrl(imageRecs[0].image_url);
          }
        }
      } catch (err) {
        console.error('Error fetching product for editing:', err);
        if (active) {
          setProductError(err.message || 'Failed to load product details.');
        }
      } finally {
        if (active) {
          setLoadingCategories(false);
          setLoadingProduct(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [id, user]);

  const handleImageChange = (e) => {
    setSubmitError('');
    const file = e.target.files[0];
    if (!file) return;

    // Validate type (JPEG, PNG, WebP)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setSubmitError('Invalid file type. Only JPG, PNG, and WebP images are allowed.');
      return;
    }

    // Validate size (5 MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setSubmitError('Image size must be less than 5 MB.');
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl('');
    setExistingImageUrl(''); // Mark existing image as deleted
    const fileInput = document.getElementById('prod-image');
    if (fileInput) fileInput.value = '';
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    try {
      // 1. Client-side Validation
      if (!name.trim()) {
        throw new Error('Product name is required.');
      }
      if (!selectedCategoryId) {
        throw new Error('Product category is required.');
      }
      
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        throw new Error('Price must be a valid positive number.');
      }

      const parsedStock = parseInt(stockQuantity, 10);
      if (isNaN(parsedStock) || parsedStock < 0 || !Number.isInteger(parsedStock)) {
        throw new Error('Stock quantity must be a non-negative integer.');
      }

      // Verify artisan profile
      const { data: artisan, error: artisanError } = await supabase
        .from('artisans')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (artisanError) throw artisanError;
      if (!artisan) {
        throw new Error('No artisan profile found. You must be registered as an artisan to save changes.');
      }

      // 2. Update product row in public.products
      const { error: updateError } = await supabase
        .from('products')
        .update({
          category_id: selectedCategoryId,
          name: name.trim(),
          description: description.trim() || null,
          price: parsedPrice,
          stock_quantity: parsedStock
        })
        .eq('id', id)
        .eq('artisan_id', artisan.id);

      if (updateError) throw updateError;

      // 3. Handle image adjustments
      if (imageFile) {
        // A new file was selected to replace/add
        const fileExt = imageFile.name.split('.').pop();
        const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
        const storagePath = `${artisan.id}/${id}/${uniqueFileName}`;
        
        // A. Upload new file to Storage
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(storagePath, imageFile);

        if (uploadError) {
          throw new Error(`Product details saved, but failed to upload new image: ${uploadError.message}`);
        }

        // B. Get public URL of new image
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(storagePath);
        
        const publicUrl = urlData.publicUrl;

        // C. Update database product_images record
        if (originalImageUrl) {
          // Update the existing row
          const { error: imgDbError } = await supabase
            .from('product_images')
            .update({ image_url: publicUrl })
            .eq('product_id', id);

          if (imgDbError) {
            // Cleanup uploaded file to avoid orphans
            await supabase.storage.from('product-images').remove([storagePath]);
            throw new Error(`Product details saved, but failed to update image database details: ${imgDbError.message}`);
          }

          // D. Delete the old file from Storage
          if (originalImageUrl.includes('/public/product-images/')) {
            const oldPath = originalImageUrl.split('/public/product-images/')[1];
            if (oldPath) {
              await supabase.storage.from('product-images').remove([oldPath]);
            }
          }
        } else {
          // Insert a new row
          const { error: imgDbError } = await supabase
            .from('product_images')
            .insert({
              product_id: id,
              image_url: publicUrl,
              display_order: 0
            });

          if (imgDbError) {
            await supabase.storage.from('product-images').remove([storagePath]);
            throw new Error(`Product details saved, but failed to insert image database details: ${imgDbError.message}`);
          }
        }
      } else if (!existingImageUrl && originalImageUrl) {
        // The user explicitly removed the existing image
        // A. Delete database image record
        const { error: imgDbError } = await supabase
          .from('product_images')
          .delete()
          .eq('product_id', id);

        if (imgDbError) throw imgDbError;

        // B. Remove old file from Storage
        if (originalImageUrl.includes('/public/product-images/')) {
          const oldPath = originalImageUrl.split('/public/product-images/')[1];
          if (oldPath) {
            await supabase.storage.from('product-images').remove([oldPath]);
          }
        }
      }

      // Redirect to catalog on success
      navigate('/artisan/products', {
        state: { successMessage: 'Product updated successfully!' }
      });
    } catch (err) {
      console.error('Error updating product:', err);
      setSubmitError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Loading product details for editing...</p>
      </div>
    );
  }

  if (productError) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto shadow-inner text-red-655 font-bold text-3xl">
          ⚠️
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800">Cannot Edit Product</h2>
          <p className="text-slate-550 text-sm leading-relaxed">{productError}</p>
        </div>
        <div className="pt-4">
          <Link to="/artisan/products">
            <button className="bg-gov-navy hover:bg-gov-navy-light text-white text-sm font-bold px-5 py-2.5 rounded transition-colors cursor-pointer min-h-[40px] shadow-sm">
              ← Return to Catalog
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gov-navy m-0">Edit Product</h2>
          <p className="text-sm text-slate-500 mt-1">Modify your catalog listing details.</p>
        </div>
        <Link to="/artisan/products" className="text-sm font-semibold text-slate-600 hover:text-gov-navy">
          ← Cancel
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-2">
          <form onSubmit={handleFormSubmit} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
            {/* Error Notice */}
            {submitError && (
              <div className="bg-red-100 border border-red-400 text-red-900 rounded p-4 text-sm font-semibold flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>{submitError}</div>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="prod-name" className="block text-sm font-bold text-slate-700">
                Product Name / Title
              </label>
              <input
                id="prod-name"
                type="text"
                required
                disabled={isSubmitting}
                placeholder="e.g. Handwoven Bamboo Flower Basket"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy disabled:opacity-50"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label htmlFor="prod-category" className="block text-sm font-bold text-slate-700">
                Traditional Craft Category
              </label>
              {loadingCategories ? (
                <div className="text-sm text-slate-500 italic py-2">Loading categories...</div>
              ) : categoriesError ? (
                <div className="text-sm text-red-655 font-semibold py-2">⚠️ {categoriesError}</div>
              ) : (
                <select
                  id="prod-category"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy font-semibold text-slate-800 disabled:opacity-50"
                >
                  <option value="" disabled>-- Select a Category --</option>
                  {categoriesList.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
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
                min="0"
                step="0.01"
                disabled={isSubmitting}
                placeholder="e.g. 450"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy disabled:opacity-50"
              />
            </div>

            {/* Stock Quantity */}
            <div className="space-y-1.5">
              <label htmlFor="prod-stock" className="block text-sm font-bold text-slate-700">
                Stock Quantity
              </label>
              <input
                id="prod-stock"
                type="number"
                required
                min="0"
                step="1"
                disabled={isSubmitting}
                placeholder="e.g. 10"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy disabled:opacity-50"
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
                disabled={isSubmitting}
                placeholder="Describe your craft, materials used, size, and care instructions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy disabled:opacity-50"
              ></textarea>
            </div>

            {/* Image Selector & Preview */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700">
                Product Image
              </label>

              {imagePreviewUrl ? (
                // New Image Preview Mode
                <div className="relative border border-slate-200 rounded-lg p-2 bg-slate-50 flex flex-col items-center">
                  <img
                    src={imagePreviewUrl}
                    alt="New preview"
                    className="max-h-48 object-contain rounded border border-slate-200"
                  />
                  <div className="mt-3 flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={isSubmitting}
                      className="bg-red-55 hover:bg-red-100 text-red-750 text-xs font-bold px-3 py-2 rounded border border-red-200 cursor-pointer flex-grow text-center transition-colors disabled:opacity-50"
                    >
                      ✕ Remove / Delete Image
                    </button>
                    <label className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-750 text-xs font-bold px-3 py-2 rounded cursor-pointer flex-grow text-center transition-colors disabled:opacity-50 inline-flex items-center justify-center">
                      Change Image Selection
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={isSubmitting}
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              ) : existingImageUrl ? (
                // Existing Image Display
                <div className="relative border border-slate-200 rounded-lg p-2 bg-slate-50 flex flex-col items-center">
                  <img
                    src={existingImageUrl}
                    alt="Current product photo"
                    className="max-h-48 object-contain rounded border border-slate-200"
                  />
                  <div className="mt-3 flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={isSubmitting}
                      className="bg-red-55 hover:bg-red-100 text-red-750 text-xs font-bold px-3 py-2 rounded border border-red-200 cursor-pointer flex-grow text-center transition-colors disabled:opacity-50"
                    >
                      ✕ Delete Existing Image
                    </button>
                    <label className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-750 text-xs font-bold px-3 py-2 rounded cursor-pointer flex-grow text-center transition-colors disabled:opacity-50 inline-flex items-center justify-center">
                      Replace Image
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={isSubmitting}
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                // File Picker Mode (if no image currently exists)
                <label
                  htmlFor="prod-image"
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 cursor-pointer block hover:border-gov-navy transition-colors"
                >
                  <span className="text-2xl" role="img" aria-label="Camera icon">📷</span>
                  <p className="text-xs text-slate-500 mt-2 font-semibold">Click to upload product image (JPEG, PNG, WebP)</p>
                  <p className="text-[10px] text-slate-400 mt-1">Maximum file size: 5 MB</p>
                  <input
                    id="prod-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={isSubmitting}
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="primary" className="font-bold flex-grow" disabled={isSubmitting || loadingCategories}>
                {isSubmitting ? 'Saving Changes...' : 'Save Product Changes'}
              </Button>
              <Link to="/artisan/products" className="flex-grow">
                <Button variant="outline" className="w-full font-bold" disabled={isSubmitting}>
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
