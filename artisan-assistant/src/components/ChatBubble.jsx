import React, { useState } from 'react';

function ChatBubble({
  sender,
  text,
  media,
  actionButtons,
  onActionClick,
  draft,
  isArtisanVerified,
  onSaveDraft,
  onPublishDraft,
  onUpdateDraft,
  language = 'kn'
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showEnglishPreview, setShowEnglishPreview] = useState(false);

  const [editLocalTitle, setEditLocalTitle] = useState(draft?.local_title || draft?.name || '');
  const [editEnglishTitle, setEditEnglishTitle] = useState(draft?.name || '');
  const [editPrice, setEditPrice] = useState(draft?.price || '');
  const [editStock, setEditStock] = useState(draft?.stock_quantity || '1');
  const [editDesc, setEditDesc] = useState(draft?.local_description || draft?.description || '');

  const isKn = language === 'kn';
  const bubbleClass = sender === 'assistant' ? 'assistant' : 'user';

  // Render text with basic bold markdown support and newlines
  const renderFormattedText = (content) => {
    if (!content) return null;
    return content.split('\n').map((line, idx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={idx}>
          {parts.map((p, pIdx) => {
            if (p.startsWith('**') && p.endsWith('**')) {
              return <strong key={pIdx}>{p.slice(2, -2)}</strong>;
            }
            return p;
          })}
          {idx < content.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  const handleDoneEditing = () => {
    if (onUpdateDraft) {
      onUpdateDraft({
        ...draft,
        local_title: editLocalTitle,
        name: editEnglishTitle,
        price: Number(editPrice),
        stock_quantity: Number(editStock),
        local_description: editDesc,
        description: isKn ? draft.description : editDesc
      });
    }
    setIsEditing(false);
  };

  return (
    <li className={`message-bubble ${bubbleClass} ${draft ? 'draft-card-bubble' : ''}`}>
      {/* 1. Media Preview if attached */}
      {media && media.type === 'image' && (
        <div style={{ marginBottom: '0.4rem' }}>
          <img
            src={media.url}
            alt="uploaded attachment"
            style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px' }}
          />
        </div>
      )}

      {media && media.type === 'audio' && (
        <div style={{ marginBottom: '0.4rem' }}>
          <audio controls src={media.url} style={{ width: '100%', height: '36px' }} />
        </div>
      )}

      {/* 2. Text Content */}
      {text && <div style={{ fontSize: '0.9rem' }}>{renderFormattedText(text)}</div>}

      {/* 3. Interactive Draft Review & Edit Card */}
      {draft && (
        <div style={{ marginTop: '0.5rem', width: '100%' }}>
          {draft.imageUrl && (
            <img src={draft.imageUrl} alt={draft.local_title || draft.name} className="draft-card-img" />
          )}

          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {isKn ? 'ಕನ್ನಡ ಶೀರ್ಷಿಕೆ (Kannada Title):' : 'Title:'}
                <input
                  type="text"
                  value={editLocalTitle}
                  onChange={(e) => setEditLocalTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', marginTop: '0.2rem' }}
                />
              </label>

              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {isKn ? 'ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್ ಇಂಗ್ಲಿಷ್ ಶೀರ್ಷಿಕೆ (English Marketplace Title):' : 'English Title:'}
                <input
                  type="text"
                  value={editEnglishTitle}
                  onChange={(e) => setEditEnglishTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', marginTop: '0.2rem' }}
                />
              </label>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <label style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600 }}>
                  {isKn ? 'ಮಾರಾಟ ಬೆಲೆ (₹):' : 'Price (₹):'}
                  <input
                    type="number"
                    min="1"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', marginTop: '0.2rem' }}
                  />
                </label>

                <label style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600 }}>
                  {isKn ? 'ದಾಸ್ತಾನು ಪ್ರಮಾಣ:' : 'Stock Qty:'}
                  <input
                    type="number"
                    min="1"
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', marginTop: '0.2rem' }}
                  />
                </label>
              </div>

              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {isKn ? 'ವಿವರಣೆ (Description):' : 'Description:'}
                <textarea
                  value={editDesc}
                  rows={3}
                  onChange={(e) => setEditDesc(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', marginTop: '0.2rem' }}
                />
              </label>

              <button
                type="button"
                onClick={handleDoneEditing}
                className="btn-primary-mobile"
                style={{ marginTop: '0.3rem' }}
              >
                {isKn ? '✅ ತಿದ್ದುಪಡಿ ಪೂರ್ಣಗೊಳಿಸಿ (Done)' : 'Done Editing'}
              </button>
            </div>
          ) : (
            <div>
              {/* Voice correction helper hint */}
              <div style={{
                background: '#e8f5e9',
                borderLeft: '4px solid #2e7d32',
                padding: '0.4rem 0.6rem',
                fontSize: '0.78rem',
                color: '#1b5e20',
                borderRadius: '4px',
                marginBottom: '0.5rem'
              }}>
                🎙️ <strong>{isKn ? 'ಧ್ವನಿ ಮೂಲಕ ತಿದ್ದಲು:' : 'Voice Correction:'}</strong>{' '}
                {isKn
                  ? 'ಮೈಕ್ ಒತ್ತಿ "ಬೆಲೆ 400 ಮಾಡಿ" ಅಥವಾ "ದಾಸ್ತಾನು 5 ಮಾಡಿ" ಎಂದು ಹೇಳಿ.'
                  : 'Tap mic and say "change price to 400" or "stock 5".'}
              </div>

              {/* Title in reviewed language */}
              <h3 className="draft-title" style={{ fontSize: '1.1rem', color: '#075E54' }}>
                {isKn ? (draft.local_title || draft.name) : draft.name}
              </h3>

              <div className="draft-meta">
                {isKn ? 'ವರ್ಗ (Category):' : 'Category:'} <strong>{draft.category_name || draft.category}</strong>
              </div>

              <div className="draft-price-badge">
                ₹{draft.price} INR <span style={{ fontWeight: 'normal', fontSize: '0.75rem' }}>
                  ({isKn ? 'ದಾಸ್ತಾನು' : 'Stock'}: {draft.stock_quantity})
                </span>
              </div>

              <div className="draft-desc" style={{ marginTop: '0.4rem' }}>
                {isKn ? (draft.local_description || draft.description) : draft.description}
              </div>

              {/* English marketplace preview toggle */}
              {isKn && (
                <div style={{ marginTop: '0.6rem', borderTop: '1px dashed #ccc', paddingTop: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowEnglishPreview(!showEnglishPreview)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284c7',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline'
                    }}
                  >
                    {showEnglishPreview
                      ? '▲ ಇಂಗ್ಲಿಷ್ ಮುನ್ನೋಟ ಮರೆಮಾಡಿ (Hide English Preview)'
                      : '🌐 ಇಂಗ್ಲಿಷ್ ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್ ಮುನ್ನೋಟ ನೋಡಿ (View English Marketplace Preview)'}
                  </button>

                  {showEnglishPreview && (
                    <div style={{
                      marginTop: '0.4rem',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.5rem',
                      fontSize: '0.8rem'
                    }}>
                      <div style={{ fontWeight: 600, color: '#334155' }}>Marketplace Title:</div>
                      <div style={{ marginBottom: '0.3rem' }}>{draft.name}</div>
                      <div style={{ fontWeight: 600, color: '#334155' }}>Marketplace Description:</div>
                      <div style={{ color: '#475569' }}>{draft.description}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="draft-btn-group" style={{ marginTop: '0.75rem' }}>
                {isArtisanVerified ? (
                  <button
                    type="button"
                    onClick={() => onPublishDraft && onPublishDraft(draft)}
                    className="btn-primary-mobile"
                  >
                    {isKn ? '🚀 ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್‌ಗೆ ಪ್ರಕಟಿಸಿ (Publish)' : '🚀 Publish to Marketplace'}
                  </button>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginBottom: '0.3rem' }}>
                    {isKn
                      ? '⚠️ ಸಾರ್ವಜನಿಕವಾಗಿ ಪ್ರಕಟಿಸಲು ಕುಶಲಕರ್ಮಿ ಖಾತೆಯ ಪರಿಶೀಲನೆ ಅಗತ್ಯವಿದೆ. ನೀವು ಕರಡಾಗಿ ಉಳಿಸಬಹುದು.'
                      : '⚠️ Artisan verification required to publish to public marketplace. You can save as Draft.'}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onSaveDraft && onSaveDraft(draft)}
                  className="btn-primary-mobile"
                  style={{ background: '#128C7E' }}
                >
                  {isKn ? '💾 ಕರಡಾಗಿ ಉಳಿಸಿ (Save Draft)' : '💾 Save as Draft'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditLocalTitle(draft.local_title || draft.name || '');
                    setEditEnglishTitle(draft.name || '');
                    setEditPrice(draft.price);
                    setEditStock(draft.stock_quantity);
                    setEditDesc(isKn ? (draft.local_description || draft.description) : draft.description);
                    setIsEditing(true);
                  }}
                  className="btn-secondary-mobile"
                >
                  {isKn ? '✏️ ವಿವರಗಳನ್ನು ತಿದ್ದಿ (Edit)' : '✏️ Edit Details'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Action Buttons */}
      {actionButtons && actionButtons.length > 0 && (
        <div className="action-buttons-container">
          {actionButtons.map((btn, idx) => (
            <button
              key={idx}
              className="action-pill-btn"
              onClick={() => onActionClick && onActionClick(btn.action)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

export default ChatBubble;
