import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import ThemeToggle from '../components/ThemeToggle.jsx';

function MyProductsPage() {
  const navigate = useNavigate();
  const { user, artisan, loading: authLoading } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchProducts = async () => {
    if (!artisan) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      let res = await supabase
        .from('products')
        .select(`
          id,
          name,
          local_title,
          price,
          status,
          stock_quantity,
          created_at,
          category_id,
          categories (name),
          product_images (image_url)
        `)
        .eq('artisan_id', artisan.id)
        .order('created_at', { ascending: false });

      // Fallback if local_title column is not yet present on remote DB
      if (res.error && res.error.message?.includes('local_title')) {
        res = await supabase
          .from('products')
          .select(`
            id,
            name,
            price,
            status,
            stock_quantity,
            created_at,
            category_id,
            categories (name),
            product_images (image_url)
          `)
          .eq('artisan_id', artisan.id)
          .order('created_at', { ascending: false });
      }

      if (res.error) throw res.error;
      setProducts(res.data || []);
    } catch (err) {
      console.error('Error fetching artisan products:', err);
      setErrorMsg('Failed to load your products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchProducts();
    }
  }, [artisan, authLoading]);

  const handleTogglePublish = async (product) => {
    try {
      setActionLoadingId(product.id);
      setErrorMsg('');
      setStatusMsg('');

      const newStatus = product.status === 'published' ? 'draft' : 'published';

      if (newStatus === 'published' && artisan.verification_status !== 'approved') {
        throw new Error('⚠️ Verification Required: Your artisan account must be verified before publishing products to the public marketplace.');
      }

      const { error } = await supabase
        .from('products')
        .update({ status: newStatus })
        .eq('id', product.id)
        .eq('artisan_id', artisan.id);

      if (error) throw error;

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: newStatus } : p))
      );
      setStatusMsg(`Product marked as ${newStatus.toUpperCase()}!`);
    } catch (err) {
      console.error('Status toggle error:', err);
      setErrorMsg(err.message || 'Failed to update status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (productId) => {
    const confirmDelete = window.confirm('Delete this product permanently from your catalog?');
    if (!confirmDelete) return;

    try {
      setActionLoadingId(productId);
      setErrorMsg('');
      setStatusMsg('');

      // Delete image references then product
      await supabase.from('product_images').delete().eq('product_id', productId);
      const { error } = await supabase.from('products').delete().eq('id', productId).eq('artisan_id', artisan.id);
      if (error) throw error;

      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setStatusMsg('Product removed.');
    } catch (err) {
      console.error('Delete error:', err);
      setErrorMsg(err.message || 'Failed to delete product.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (authLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading session...</div>;
  }

  if (!user) {
    return (
      <div style={{ maxWidth: '480px', margin: '2rem auto', padding: '1.5rem', textAlign: 'center' }}>
        <h2>Sign In Required</h2>
        <p>Please log in to view your catalog.</p>
        <button
          onClick={() => navigate('/login')}
          style={{ marginTop: '1rem', padding: '0.6rem 1.2rem', background: '#075E54', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem', fontFamily: 'inherit', color: 'var(--text)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link to="/" style={{ textDecoration: 'none', fontSize: '1.25rem', color: 'var(--primary-green)' }}>←</Link>
          <h1 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--primary-green)' }}>My Products</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ThemeToggle />
          <Link
            to="/add-product"
            style={{ padding: '0.4rem 0.8rem', background: 'var(--primary-green)', color: 'white', textDecoration: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            + Add New
          </Link>
        </div>
      </div>

      {statusMsg && (
        <div style={{ padding: '0.6rem', background: '#e8f5e9', color: '#2e7d32', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          {statusMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '0.6rem', background: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          {errorMsg}
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--secondary-text)' }}>Loading catalog...</p>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <p style={{ color: 'var(--secondary-text)' }}>You have not added any products yet.</p>
          <Link
            to="/add-product"
            style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.6rem 1.2rem', background: 'var(--primary-green)', color: 'white', textDecoration: 'none', borderRadius: '6px' }}
          >
            Create Your First Product
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {products.map((prod) => {
            const imgUrl = prod.product_images?.[0]?.image_url;
            const isPub = prod.status === 'published';
            const isBusy = actionLoadingId === prod.id;
            const titleDisplay = prod.local_title || prod.name;
            const englishSubtitle = prod.local_title && prod.name && prod.local_title !== prod.name ? prod.name : null;

            return (
              <div
                key={prod.id}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'var(--bg)',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)'
                }}
              >
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={titleDisplay}
                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px' }}
                  />
                ) : (
                  <div style={{ width: '80px', height: '80px', background: 'var(--border)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary-text)', fontSize: '0.75rem' }}>
                    No Photo
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {titleDisplay}
                    </h3>
                  </div>
                  {englishSubtitle && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ({englishSubtitle})
                    </div>
                  )}

                  <p style={{ margin: '0.2rem 0', fontSize: '0.8rem', color: 'var(--secondary-text)' }}>
                    {prod.categories?.name || 'Handicraft'}
                  </p>

                  <p style={{ margin: '0.2rem 0', fontWeight: 600, color: 'var(--primary-green)', fontSize: '0.9rem' }}>
                    ₹{prod.price} <span style={{ fontWeight: 'normal', color: 'var(--secondary-text)', fontSize: '0.75rem' }}>({prod.stock_quantity} in stock)</span>
                  </p>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: isPub ? '#e8f5e9' : '#fff3e0',
                        color: isPub ? '#2e7d32' : '#e65100'
                      }}
                    >
                      {isPub ? 'PUBLISHED' : 'DRAFT'}
                    </span>

                    <button
                      onClick={() => handleTogglePublish(prod)}
                      disabled={isBusy}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        background: isPub ? '#f5f5f5' : '#075E54',
                        color: isPub ? '#333' : 'white',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: isBusy ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isPub ? 'Unpublish' : 'Publish'}
                    </button>

                    <button
                      onClick={() => handleDelete(prod.id)}
                      disabled={isBusy}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        background: '#ffebee',
                        color: '#c62828',
                        border: '1px solid #ffcdd2',
                        borderRadius: '4px',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        marginLeft: 'auto'
                      }}
                    >
                      Delete
                    </button>
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

export default MyProductsPage;
