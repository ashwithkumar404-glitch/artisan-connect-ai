import React from 'react';
import { Link } from 'react-router-dom';
import LanguageSelector from './LanguageSelector';

function ChatHeader({ onMenuToggle }) {
  return (
    <header className="chat-header" style={{ backgroundColor: '#064E3B', color: '#FFFFFF', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Placeholder for logo */}
        <div style={{ width: '32px', height: '32px', backgroundColor: '#075E46', borderRadius: '50%', marginRight: '0.5rem' }}></div>
        <h1 style={{ fontSize: '1.2rem', margin: 0 }}>Artisan Connect AI Assistant</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <LanguageSelector />
        <Link to="/" style={{ color: '#FFFFFF', marginRight: '0.5rem', textDecoration: 'none' }}>Website</Link>
        <button aria-label="Menu" onClick={onMenuToggle} style={{ background: 'none', border: 'none', color: '#FFFFFF', fontSize: '1.5rem', marginLeft: '0.5rem', cursor: 'pointer' }}>☰</button>
      </div>
    </header>
  );
}

export default ChatHeader;
