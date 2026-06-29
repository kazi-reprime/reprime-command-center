'use client'

export default function GoogleVoiceEmbed() {
  return (
    <div style={{
      padding: '1rem',
      background: 'var(--rp-surface)',
      border: '1px solid var(--rp-border)',
      borderRadius: '8px',
      marginTop: '1rem'
    }}>
      <h3 style={{ margin: 0, color: 'var(--rp-gold)', fontSize: '0.95rem' }}>
        SMS (305 — Google Voice)
      </h3>
      <p style={{ color: 'var(--rp-gold-lite)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
        305 carrier SMS via Google Voice — opens in a new tab (Google Voice blocks iframe embedding via X-Frame-Options).
      </p>
      <button
        onClick={() => window.open('https://voice.google.com', '_blank', 'noopener,noreferrer')}
        style={{
          marginTop: '0.75rem',
          padding: '0.5rem 1rem',
          background: 'var(--rp-gold)',
          color: 'var(--rp-navy)',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontWeight: 600,
        }}
      >
        📞 Open Google Voice
      </button>
    </div>
  )
}
