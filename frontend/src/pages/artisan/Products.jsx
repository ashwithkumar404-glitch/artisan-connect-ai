import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Button from '../../components/Button';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

export default function Products() {
  const { user } = useAuth();
  const location = useLocation();
  
  const [successMsg, setSuccessMsg] = useState(location.state?.successMessage || '');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishingId, setPublishingId] = useState(null);

  const handlePublishProduct = async (productId) => {
    try {
      setPublishingId(productId);
      setError('');
      setSuccessMsg('');

      if (!user) {
        throw new Error('You must be logged in to publish products.');
      }

      // 1. Fetch corresponding artisan profile
      const { data: artisan, error: artisanError } = await supabase
        .from('artisans')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (artisanError) throw artisanError;
      if (!artisan) {
        throw new Error('No artisan profile found. You must be registered as an artisan to publish products.');
      }

      // 2. Update status of this product
      const { error: updateError } = await supabase
        .from('products')
        .update({ status: 'published' })
        .eq('id', productId)
        .eq('artisan_id', artisan.id);

      if (updateError) throw updateError;

      // 3. Update local state
      setProducts((prevProducts) =>
        prevProducts.map((p) => (p.id === productId ? { ...p, status: 'published' } : p))
      );

      setSuccessMsg('Product published successfully! It is now visible to customers.');
    } catch (err) {
      console.error('Error publishing product:', err);
      setError(err.message || 'An error occurred while publishing the product.');
    } finally {
      setPublishingId(null);
    }
  };

  const handleUnpublishProduct = async (productId) => {
    const confirmed = window.confirm("Are you sure you want to unpublish this product?\nIt will no longer be visible to customers.");
    if (!confirmed) return;

    try {
      setPublishingId(productId);
      setError('');
      setSuccessMsg('');

      if (!user) {
        throw new Error('You must be logged in to unpublish products.');
      }

      // 1. Fetch corresponding artisan profile
      const { data: artisan, error: artisanError } = await supabase
        .from('artisans')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (artisanError) throw artisanError;
      if (!artisan) {
        throw new Error('No artisan profile found. You must be registered as an artisan to unpublish products.');
      }

      // 2. Update status to draft
      const { error: updateError } = await supabase
        .from('products')
        .update({ status: 'draft' })
        .eq('id', productId)
        .eq('artisan_id', artisan.id);

      if (updateError) throw updateError;

      // 3. Update local state
      setProducts((prevProducts) =>
        prevProducts.map((p) => (p.id === productId ? { ...p, status: 'draft' } : p))
      );

      setSuccessMsg('Product unpublished successfully. It is no longer visible to customers.');
    } catch (err) {
      console.error('Error unpublishing product:', err);
      setError(err.message || 'An error occurred while unpublishing the product.');
    } finally {
      setPublishingId(null);
    }
  };

  const handleDeleteProduct = async (productId) => {
    const confirmed = window.confirm("Delete this product permanently?\nThis action cannot be undone.");
    if (!confirmed) return;

    try {
      setPublishingId(productId);
      setError('');
      setSuccessMsg('');

      if (!user) {
        throw new Error('You must be logged in to delete products.');
      }

      // 1. Fetch corresponding artisan profile
      const { data: artisan, error: artisanError } = await supabase
        .from('artisans')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (artisanError) throw artisanError;
      if (!artisan) {
        throw new Error('No artisan profile found. You must be registered as an artisan to delete products.');
      }

      // Verify ownership and get image path for cleanup
      const { data: productData, error: productFetchError } = await supabase
        .from('products')
        .select(`
          artisan_id,
          product_images (
            image_url
          )
        `)
        .eq('id', productId)
        .single();

      if (productFetchError) throw productFetchError;
      if (productData.artisan_id !== artisan.id) {
        throw new Error('You do not have permission to delete this product.');
      }

      // 2. Storage Cleanup
      const imageRecords = productData.product_images || [];
      const filesToDelete = [];
      for (const imgRec of imageRecords) {
        const urlStr = imgRec.image_url;
        if (urlStr.includes('/public/product-images/')) {
          const relativePath = urlStr.split('/public/product-images/')[1];
          if (relativePath) {
            filesToDelete.push(relativePath);
          }
        }
      }

      if (filesToDelete.length > 0) {
        console.log('Deleting Storage files:', filesToDelete);
        const { error: storageError } = await supabase.storage
          .from('product-images')
          .remove(filesToDelete);
        if (storageError) {
          console.warn('Storage files cleanup encountered an issue:', storageError.message);
        }
      }

      // 3. Database Delete (product_images row is deleted by database cascade constraint)
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('artisan_id', artisan.id);

      if (deleteError) throw deleteError;

      // 4. Update local state
      setProducts((prevProducts) => prevProducts.filter((p) => p.id !== productId));
      setSuccessMsg('Product deleted successfully.');
    } catch (err) {
      console.error('Error deleting product:', err);
      setError(err.message || 'An error occurred while deleting the product.');
    } finally {
      setPublishingId(null);
    }
  };

  // Clear navigation state so message doesn't persist on refresh
  useEffect(() => {
    if (location.state?.successMessage) {
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    let active = true;

    async function fetchProducts() {
      if (!user) {
        if (active) {
          setError('You must be logged in to view your products.');
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError('');

        // 1. Fetch corresponding artisan profile
        const { data: artisan, error: artisanError } = await supabase
          .from('artisans')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (artisanError) {
          console.error('Error fetching artisan record:', artisanError);
          throw new Error('Failed to retrieve artisan profile details.');
        }

        if (!artisan) {
          if (active) {
            setProducts([]);
            setLoading(false);
          }
          return;
        }

        // 2. Fetch products, perform category name join and product images join
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            description,
            price,
            stock_quantity,
            status,
            created_at,
            categories (
              name
            ),
            product_images (
              image_url
            )
          `)
          .eq('artisan_id', artisan.id)
          .order('created_at', { ascending: false });

        if (productsError) {
          console.error('Error fetching products catalog:', productsError);
          throw productsError;
        }

        if (active) {
          setProducts(productsData || []);
        }
      } catch (err) {
        console.error('Error loading products list:', err);
        if (active) {
          setError(err.message || 'Failed to fetch your product catalog.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchProducts();

    return () => {
      active = false;
    };
  }, [user]);

  // Helper for status badge classes
  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pending_review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'out_of_stock':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'draft':
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const formatStatus = (status) => {
    if (!status) return 'Draft';
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

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

      {/* Success Notification */}
      {successMsg && (
        <div className="bg-green-50 border border-green-300 text-green-800 rounded p-4 text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>{successMsg}</div>
          </div>
          <button 
            onClick={() => setSuccessMsg('')} 
            className="text-green-600 hover:text-green-800 font-bold px-2 cursor-pointer"
            aria-label="Dismiss success message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded p-4 text-sm font-semibold flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-lg space-y-4">
          <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-500">Loading catalog items...</p>
        </div>
      ) : products.length === 0 ? (
        /* Empty State */
        <div className="border-2 border-dashed border-slate-300 bg-white rounded-lg p-12 text-center max-w-2xl mx-auto animate-fade-in">
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
      ) : (
        /* Products Catalog List Table */
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4 text-center w-20">Image</th>
                  <th className="px-6 py-4">Product Details</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-right">Price</th>
                  <th className="px-6 py-4 text-center">Stock</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Added On</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {products.map((product) => {
                  const imageUrl = product.product_images && product.product_images.length > 0 
                    ? product.product_images[0].image_url 
                    : null;
                  
                  return (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded border border-slate-200 mx-auto"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' class='w-12 h-12'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'/%3E%3C/svg%3E";
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 mx-auto" title="No Image">
                            <span className="text-xl" role="img" aria-label="package placeholder icon">📦</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{product.name}</div>
                        {product.description && (
                          <div className="text-xs text-slate-500 mt-1 max-w-xs truncate">
                            {product.description}
                          </div>
                        )}
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                      {product.categories?.name || 'Uncategorized'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-slate-900">
                      ₹{Number(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`font-semibold ${product.stock_quantity === 0 ? 'text-red-655 font-bold' : 'text-slate-700'}`}>
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5 items-start">
                        <span className={`px-2.5 py-1 text-xs font-bold border rounded-full ${getStatusBadge(product.status)}`}>
                          {formatStatus(product.status)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                          {product.status === 'published' ? 'Visible to customers' : 'Not visible to customers'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                      {new Date(product.created_at).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex gap-2 justify-center items-center">
                        <Link to={`/artisan/products/edit/${product.id}`}>
                          <button
                            disabled={publishingId !== null}
                            className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold px-3 py-1.5 rounded transition-colors cursor-pointer min-h-[30px] shadow-sm disabled:opacity-50"
                          >
                            Edit
                          </button>
                        </Link>
                        {product.status === 'draft' ? (
                          <button
                            onClick={() => handlePublishProduct(product.id)}
                            disabled={publishingId !== null}
                            className="bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold px-3 py-1.5 rounded transition-colors cursor-pointer min-h-[30px] shadow-sm disabled:opacity-50"
                          >
                            {publishingId === product.id ? '...' : 'Publish'}
                          </button>
                        ) : product.status === 'published' ? (
                          <button
                            onClick={() => handleUnpublishProduct(product.id)}
                            disabled={publishingId !== null}
                            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors cursor-pointer min-h-[30px] shadow-sm disabled:opacity-50"
                          >
                            {publishingId === product.id ? '...' : 'Unpublish'}
                          </button>
                        ) : null}
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          disabled={publishingId !== null}
                          className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-755 text-xs font-bold px-3 py-1.5 rounded transition-colors cursor-pointer min-h-[30px] disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
