import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { interpretCorrectionCommand } from '../lib/kannadaProductEngine.js';
import { createVoiceSession } from '../lib/voiceRecognition.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

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
  const location = useLocation();
  const [language, setLanguage] = useState(() => localStorage.getItem('artisan_language') || 'kn');
  const isKn = language === 'kn';

  // Voice correction states
  const [isVoiceEditOpen, setIsVoiceEditOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSession, setVoiceSession] = useState(null);
  const [voiceCommandText, setVoiceCommandText] = useState('');
  const [voiceCorrectionFeedback, setVoiceCorrectionFeedback] = useState(null);
  const [fieldDiffs, setFieldDiffs] = useState({}); // { [fieldName]: { oldVal, newVal } }

  // Prefill draft from navigation state (e.g. from craft opportunity cards)
  useEffect(() => {
    if (location.state?.prefill) {
      const { name, description: desc, price: prc, categoryId } = location.state.prefill;
      if (name) setProductName(name);
      if (desc) setDescription(desc);
      if (prc) setPrice(String(prc));
      if (categoryId) setSelectedCategory(categoryId);
    }
  }, [location.state]);

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

  const handleApplyVoiceCorrection = (cmdText) => {
    if (!cmdText || !cmdText.trim()) return;
    const currentDraft = {
      name: productName,
      description,
      price: parseFloat(price) || 0,
      stock_quantity: parseInt(quantity, 10) || 1
    };

    const result = interpretCorrectionCommand(cmdText, currentDraft, language);
    if (result.success && result.modifiedField) {
      const field = result.modifiedField;
      const oldVal = currentDraft[field];
      const newVal = result.newValue;

      setFieldDiffs(prev => ({
        ...prev,
        [field]: { oldVal, newVal }
      }));

      if (field === 'price') {
        setPrice(String(newVal));
      } else if (field === 'stock_quantity') {
        setQuantity(String(newVal));
      } else if (field === 'name') {
        setProductName(String(newVal));
      } else if (field === 'material' || field === 'description') {
        if (result.updatedDraft?.description) {
          setDescription(result.updatedDraft.description);
        }
      }

      setVoiceCorrectionFeedback({
        success: true,
        message: isKn ? result.message_kn : result.message_en,
        field
      });
      setVoiceCommandText('');
    } else {
      setVoiceCorrectionFeedback({
        success: false,
        message: isKn ? result.message_kn : result.message_en
      });
    }
  };

  const toggleVoiceRecording = () => {
    if (isListening) {
      voiceSession?.stop();
      setIsListening(false);
      setVoiceSession(null);
      return;
    }

    try {
      const session = createVoiceSession({
        language: isKn ? 'kn-IN' : 'en-IN',
        onInterim: (text) => setVoiceCommandText(text),
        onFinal: (text) => {
          setVoiceCommandText(text);
          handleApplyVoiceCorrection(text);
          setIsListening(false);
          setVoiceSession(null);
        },
        onError: (err) => {
          console.warn('Voice recognition error:', err);
          setIsListening(false);
          setVoiceSession(null);
        }
      });
      session.start();
      setVoiceSession(session);
      setIsListening(true);
    } catch {
      setIsListening(false);
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
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.5rem', fontFamily: 'inherit', color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link to="/" style={{ color: 'var(--primary-green)', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontSize: '1.4rem', margin: 0, color: 'var(--primary-green)' }}>Add a Product</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ThemeToggle />
          <Link to="/" style={{ color: 'var(--secondary-text)', textDecoration: 'none', fontSize: '0.9rem' }}>Home</Link>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '6px', marginBottom: '1rem' }}>
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
              style={{ padding: '0.5rem', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
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
              style={{ padding: '0.6rem', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontWeight: 500 }}>
            Category:
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ padding: '0.6rem', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
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
              style={{ padding: '0.6rem', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
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
                style={{ padding: '0.6rem', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
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
                style={{ padding: '0.6rem', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px' }}
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
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0, color: 'var(--primary-green)' }}>Review Product Details</h2>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="preview"
              style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.75rem' }}
            />
          )}
          <p>
            <strong>Title:</strong> {productName}
            {fieldDiffs.name && (
              <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.5rem' }}>
                ✓ Changed from "{fieldDiffs.name.oldVal}"
              </span>
            )}
          </p>
          <p><strong>Category:</strong> {selectedCatObj?.name || 'Selected Category'}</p>
          <p>
            <strong>Description:</strong> {description}
            {fieldDiffs.material && (
              <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.5rem' }}>
                ✓ Material updated
              </span>
            )}
          </p>
          <p>
            <strong>Price:</strong> ₹{price}
            {fieldDiffs.price && (
              <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.5rem' }}>
                ✓ Changed from ₹{fieldDiffs.price.oldVal}
              </span>
            )}
          </p>
          <p>
            <strong>Quantity:</strong> {quantity}
            {fieldDiffs.stock_quantity && (
              <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.5rem' }}>
                ✓ Changed from {fieldDiffs.stock_quantity.oldVal}
              </span>
            )}
          </p>

          {/* Action Choice: Edit with text vs Edit with voice */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => { setStep('form'); setIsVoiceEditOpen(false); }}
              style={{
                padding: '0.65rem',
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              ✏️ {isKn ? 'ಪಠ್ಯದ ಮೂಲಕ ತಿದ್ದಿ' : 'Edit with text'}
            </button>
            <button
              type="button"
              onClick={() => setIsVoiceEditOpen(prev => !prev)}
              style={{
                padding: '0.65rem',
                background: isVoiceEditOpen ? 'rgba(7, 94, 84, 0.15)' : 'var(--card-bg, #ffffff)',
                border: isVoiceEditOpen ? '1px solid var(--primary-green)' : '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--primary-green)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              🎙️ {isKn ? 'ಧ್ವನಿ ಮೂಲಕ ತಿದ್ದಿ' : 'Edit with voice'}
            </button>
          </div>

          {/* Voice-Based Correction Panel */}
          {isVoiceEditOpen && (
            <div
              style={{
                background: 'rgba(7, 94, 84, 0.05)',
                border: '1px solid var(--primary-green)',
                borderRadius: '8px',
                padding: '0.85rem',
                marginBottom: '1rem'
              }}
            >
              <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.88rem', color: 'var(--primary-green)' }}>
                🎙️ {isKn ? 'ಧ್ವನಿ ತಿದ್ದುಪಡಿ (Voice Correction)' : 'Voice-Based Correction'}
              </h4>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: 'var(--secondary-text)' }}>
                {isKn
                  ? 'ಬದಲಾಯಿಸಬೇಕಾದ ಅಂಶವನ್ನು ಧ್ವನಿಯಲ್ಲಿ ಹೇಳಿ: ಉದಾ. "ಬೆಲೆ 450 ಮಾಡಿ", "ಪ್ರಮಾಣ 10 ಮಾಡಿ", ಅಥವಾ "ಹೆಸರು ಮಣ್ಣಿನ ಹೂದಾನಿ ಮಾಡಿ".'
                  : 'Speak what you want to change: e.g. "change price to 450", "set quantity to 10", or "material is copper".'}
              </p>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  placeholder={isKn ? 'ಆದೇಶ ಹೇಳಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ...' : 'Speak or type correction command...'}
                  value={voiceCommandText}
                  onChange={(e) => setVoiceCommandText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyVoiceCorrection(voiceCommandText);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text)',
                    fontSize: '0.82rem'
                  }}
                />
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  style={{
                    padding: '0.45rem 0.75rem',
                    background: isListening ? '#dc2626' : 'var(--primary-green)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isListening ? (isKn ? 'ನಿಲ್ಲಿಸಿ ⏹' : 'Stop ⏹') : (isKn ? 'ಮಾತನಾಡಿ 🎙️' : 'Speak 🎙️')}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyVoiceCorrection(voiceCommandText)}
                  disabled={!voiceCommandText.trim()}
                  style={{
                    padding: '0.45rem 0.75rem',
                    background: 'var(--primary-green)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: voiceCommandText.trim() ? 'pointer' : 'not-allowed',
                    opacity: voiceCommandText.trim() ? 1 : 0.6
                  }}
                >
                  {isKn ? 'ಅನ್ವಯಿಸಿ' : 'Apply'}
                </button>
              </div>

              {voiceCorrectionFeedback && (
                <div
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    background: voiceCorrectionFeedback.success ? 'rgba(5, 150, 105, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                    color: voiceCorrectionFeedback.success ? '#065f46' : '#991b1b',
                    fontWeight: 600
                  }}
                >
                  {voiceCorrectionFeedback.message}
                </div>
              )}
            </div>
          )}

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
                background: 'var(--border)',
                color: 'var(--text)',
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
        <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--light-green)', border: '1px solid var(--primary-green)', borderRadius: '8px' }}>
          <h2 style={{ color: 'var(--primary-green)' }}>✅ Product Saved Successfully!</h2>
          <p>
            Your product has been saved as <strong>{status.toUpperCase()}</strong>.
            It is synchronized with your Artisan Dashboard.
          </p>
          {createdProductId && (
            <p style={{ fontSize: '0.85rem', color: 'var(--secondary-text)' }}>ID: {createdProductId}</p>
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
