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
  language = 'kn',
  welcomeCard,
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

      {/* 2. Craft-Inspired Welcome Experience Card */}
      {welcomeCard && (
        <div className="welcome-craft-card">
          <div className="welcome-craft-header">
            {welcomeCard.avatarUrl ? (
              <img
                src={welcomeCard.avatarUrl}
                alt="Artisan Profile"
                className="welcome-craft-avatar"
                style={{
                  width: '44px',
                  height: '44px',
                  minWidth: '44px',
                  minHeight: '44px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1.5px solid var(--primary-green)'
                }}
              />
            ) : (
              <span className="welcome-craft-emblem" aria-hidden="true">{welcomeCard.emblem || '🧵'}</span>
            )}
            <div className="welcome-craft-header-text">
              <h3 className="welcome-craft-title">{welcomeCard.title}</h3>
              <p className="welcome-craft-subtitle">{welcomeCard.subtitle}</p>
            </div>
          </div>

          {welcomeCard.specialization && (
            <div className="welcome-specialization-row">
              <span className="specialization-tag">
                🎨 {welcomeCard.specialization}
              </span>
              {welcomeCard.experienceYears && (
                <span className="specialization-tag" style={{ background: 'var(--chat-bg)' }}>
                  ⏳ {welcomeCard.experienceYears} {isKn ? 'ವರ್ಷಗಳ ಅನುಭವ' : 'yrs exp'}
                </span>
              )}
              {welcomeCard.isVerified && (
                <span className="welcome-verified-badge">
                  ✓ {isKn ? 'ಪರಿಶೀಲಿತ ಕುಶಲಕರ್ಮಿ' : 'Verified Artisan'}
                </span>
              )}
            </div>
          )}

          {welcomeCard.guidance && (
            <div className="welcome-craft-guidance">
              <p className="guidance-text">💡 {welcomeCard.guidance}</p>
            </div>
          )}

          {welcomeCard.steps && welcomeCard.steps.length > 0 && (
            <div className="welcome-craft-steps">
              {welcomeCard.steps.map((st, idx) => (
                <div key={idx} className="welcome-step-item">
                  <div className="step-icon-circle" aria-hidden="true">{st.icon}</div>
                  <div className="step-details">
                    <strong className="step-title">{st.title}</strong>
                    <span className="step-desc">{st.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Text Content */}
      {text && <div style={{ fontSize: '0.9rem' }}>{renderFormattedText(text)}</div>}

      {/* 3. Interactive Draft Review & Edit Card */}
      {draft && (
        <div style={{ marginTop: '0.5rem', width: '100%' }}>
          {draft.imageUrl && (
            <img src={draft.imageUrl} alt={draft.local_title || draft.name} className="draft-card-img" />
          )}

          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                {isKn ? 'ಕನ್ನಡ ಶೀರ್ಷಿಕೆ (Kannada Title):' : 'Title:'}
                <input
                  type="text"
                  value={editLocalTitle}
                  onChange={(e) => setEditLocalTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '0.2rem' }}
                />
              </label>

              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                {isKn ? 'ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್ ಇಂಗ್ಲಿಷ್ ಶೀರ್ಷಿಕೆ (English Marketplace Title):' : 'English Title:'}
                <input
                  type="text"
                  value={editEnglishTitle}
                  onChange={(e) => setEditEnglishTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '0.2rem' }}
                />
              </label>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <label style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                  {isKn ? 'ಮಾರಾಟ ಬೆಲೆ (₹):' : 'Price (₹):'}
                  <input
                    type="number"
                    min="1"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '0.2rem' }}
                  />
                </label>

                <label style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                  {isKn ? 'ದಾಸ್ತಾನು ಪ್ರಮಾಣ:' : 'Stock Qty:'}
                  <input
                    type="number"
                    min="1"
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '0.2rem' }}
                  />
                </label>
              </div>

              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                {isKn ? 'ವಿವರಣೆ (Description):' : 'Description:'}
                <textarea
                  value={editDesc}
                  rows={3}
                  onChange={(e) => setEditDesc(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '0.2rem' }}
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
                background: 'var(--light-green)',
                borderLeft: '4px solid var(--primary-green)',
                padding: '0.4rem 0.6rem',
                fontSize: '0.78rem',
                color: 'var(--primary-green)',
                borderRadius: '4px',
                marginBottom: '0.5rem'
              }}>
                🎙️ <strong>{isKn ? 'ಧ್ವನಿ ಮೂಲಕ ತಿದ್ದಲು:' : 'Voice Correction:'}</strong>{' '}
                {isKn
                  ? 'ಮೈಕ್ ಒತ್ತಿ "ಬೆಲೆ 400 ಮಾಡಿ" ಅಥವಾ "ದಾಸ್ತಾನು 5 ಮಾಡಿ" ಎಂದು ಹೇಳಿ.'
                  : 'Tap mic and say "change price to 400" or "stock 5".'}
              </div>

              {/* Title in reviewed language */}
              <h3 className="draft-title" style={{ fontSize: '1.1rem', color: 'var(--primary-green)' }}>
                {isKn ? (draft.local_title || draft.name) : draft.name}
              </h3>

              <div className="draft-meta">
                {isKn ? 'ವರ್ಗ (Category):' : 'Category:'} <strong>{draft.category_name || draft.category}</strong>
              </div>

              <div className="draft-price-badge" style={{
                background: !draft.price || Number(draft.price) <= 0 ? 'rgba(239, 68, 68, 0.12)' : undefined,
                color: !draft.price || Number(draft.price) <= 0 ? '#DC2626' : undefined,
                border: !draft.price || Number(draft.price) <= 0 ? '1px solid rgba(239, 68, 68, 0.3)' : undefined
              }}>
                {draft.price && Number(draft.price) > 0 ? (
                  <>₹{draft.price} INR</>
                ) : (
                  <span style={{ fontWeight: 700 }}>
                    {isKn ? '⚠️ ಬೆಲೆ ನಮೂದಿಸಿಲ್ಲ (Price Required)' : '⚠️ Price Missing - Required'}
                  </span>
                )}
                <span style={{ fontWeight: 'normal', fontSize: '0.75rem', marginLeft: '0.35rem' }}>
                  ({isKn ? 'ದಾಸ್ತಾನು' : 'Stock'}: {draft.stock_quantity}
                  {draft.isStockProvisional ? (isKn ? ' - ದೃಢೀಕರಿಸಿ' : ' - To confirm') : ''})
                </span>
              </div>

              {draft.missingDetails && draft.missingDetails.length > 0 && (
                <div style={{
                  marginTop: '0.4rem',
                  padding: '0.4rem 0.6rem',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: '#B45309'
                }}>
                  <strong>{isKn ? '📌 ದೃಢೀಕರಿಸಬೇಕಾದ ವಿವರಗಳು:' : '📌 Details to confirm:'}</strong>
                  <ul style={{ margin: '0.2rem 0 0 1rem', padding: 0 }}>
                    {draft.missingDetails.map((m, idx) => (
                      <li key={idx}>{isKn ? m.prompt_kn : m.prompt_en}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="draft-desc" style={{ marginTop: '0.4rem' }}>
                {isKn ? (draft.local_description || draft.description) : draft.description}
              </div>

              {/* English marketplace preview toggle */}
              {isKn && (
                <div style={{ marginTop: '0.6rem', borderTop: '1px dashed var(--border)', paddingTop: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowEnglishPreview(!showEnglishPreview)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-green)',
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
                      background: 'var(--chat-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '0.5rem',
                      fontSize: '0.8rem'
                    }}>
                      <div style={{ fontWeight: 600, color: 'var(--primary-green)' }}>Marketplace Title:</div>
                      <div style={{ marginBottom: '0.3rem', color: 'var(--text)' }}>{draft.name}</div>
                      <div style={{ fontWeight: 600, color: 'var(--primary-green)' }}>Marketplace Description:</div>
                      <div style={{ color: 'var(--secondary-text)' }}>{draft.description}</div>
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
