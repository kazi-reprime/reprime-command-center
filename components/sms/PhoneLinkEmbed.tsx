'use client'
import { useState } from 'react'

export default function PhoneLinkEmbed() {
  const [opened, setOpened] = useState(false)

  const openPhoneLink = () => {
    window.location.href = 'ms-phone-page:'
    setOpened(true)
  }

  return (
    <div style={{
      padding: '1rem',
      background: 'var(--personal-surface)',
      border: '1px solid var(--personal-border)',
      borderRadius: '8px',
      marginTop: '1rem'
    }}>
      <h3 style={{ margin: 0, color: 'var(--personal-text)', fontSize: '0.95rem' }}>
        SMS & iMessage (718)
      </h3>
      <p style={{ color: 'var(--personal-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
        iPhone messages via Microsoft Phone Link
      </p>
      <button
        onClick={openPhoneLink}
        style={{
          marginTop: '0.75rem',
          padding: '0.5rem 1rem',
          background: 'var(--personal-accent)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        📱 Open Phone Link
      </button>
      {opened && (
        <p style={{ fontSize: '0.8rem', color: 'var(--personal-muted)', marginTop: '0.5rem' }}>
          Phone Link should now be open. Position it on your second monitor or alongside this dashboard.
        </p>
      )}
    </div>
  )
}
