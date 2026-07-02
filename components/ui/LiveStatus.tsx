'use client';

import React from 'react';

/**
 * Banner shown when data comes from seed/demo fallback instead of the live database.
 */
export function DataSourceBanner({ source, warning }: { source: string; warning?: string }) {
  if (source === 'database') return null;
  return (
    <div style={{
      padding: '0.6rem 1rem',
      background: 'rgba(245,158,11,0.1)',
      border: '1px solid rgba(245,158,11,0.2)',
      borderRadius: 8,
      marginBottom: '1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    }}>
      <span style={{ fontSize: '0.9rem' }}>⚠️</span>
      <span style={{ color: '#F59E0B', fontSize: '0.75rem', fontWeight: 500 }}>
        {warning || 'Using demo data. Connect a database to enable live persistence.'}
      </span>
    </div>
  );
}

/**
 * Inline warning for features blocked by missing configuration.
 */
export function ConfigWarning({ message }: { message: string }) {
  return (
    <div style={{
      padding: '0.5rem 0.75rem',
      background: 'rgba(107,114,128,0.1)',
      border: '1px solid rgba(107,114,128,0.2)',
      borderRadius: 6,
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
    }}>
      <span style={{ fontSize: '0.8rem' }}>🔧</span>
      <span style={{ color: '#9CA3AF', fontSize: '0.7rem' }}>{message}</span>
    </div>
  );
}

/**
 * Loading spinner overlay for data fetching.
 */
export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem',
      gap: '0.75rem',
    }}>
      <div style={{
        width: 20, height: 20,
        border: '2px solid rgba(255,204,51,0.2)',
        borderTopColor: '#FFCC33',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>{message}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/**
 * Error state display.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem',
      gap: '0.75rem',
    }}>
      <span style={{ fontSize: '2rem' }}>⚠️</span>
      <span style={{ color: '#EF4444', fontSize: '0.85rem', fontWeight: 500 }}>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6,
            color: '#EF4444',
            padding: '0.4rem 0.8rem',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
