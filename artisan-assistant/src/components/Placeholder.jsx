import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle.jsx";

function Placeholder({ title }) {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem', minHeight: '100vh', boxSizing: 'border-box', color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link to="/" style={{ color: 'var(--primary-green)', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--primary-green)' }}>{title}</h1>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '2rem 1.5rem', textAlign: 'center', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
        <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem', color: 'var(--text)' }}>{title}</h2>
        <p style={{ color: 'var(--secondary-text)', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
          This section is currently being planned and prepared for full integration with the artisan portal and customer marketplace.
        </p>
        <Link
          to="/"
          style={{
            display: 'inline-block',
            padding: '0.65rem 1.25rem',
            background: 'var(--primary-green)',
            color: '#FFFFFF',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}
        >
          ← Back to Assistant Home
        </Link>
      </div>
    </div>
  );
}

export default Placeholder;
