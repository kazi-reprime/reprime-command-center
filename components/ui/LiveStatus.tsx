'use client';

import React from 'react';

/**
 * Banner shown when data comes from seed/demo fallback instead of the live database.
 */
export function DataSourceBanner({ source, warning }: { source: string; warning?: string }) {
  // Hide banner if data comes from any real database source
  const liveSourcePrefixes = ['database', 'portal_db', 'supabase', 'live', 'zoom_api', 'gmail', 'calendar'];
  if (liveSourcePrefixes.some(p => source.startsWith(p))) return null;
  // Also hide if source is just empty data from a live DB (no warning)
  if (!warning && source !== 'unavailable' && source !== 'fallback') return null;
  return (
    <div className="flex items-center gap-3 p-4 mb-4 rounded-xl bg-warning/10 border border-warning/20 text-warning">
      <span className="text-xl">⚠️</span>
      <span className="text-sm font-semibold">
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
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-raised border border-border">
      <span className="text-sm">🔧</span>
      <span className="text-xs font-semibold text-text-secondary">{message}</span>
    </div>
  );
}

/**
 * Loading spinner overlay for data fetching.
 */
export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-12 gap-3">
      <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
      <span className="text-sm font-semibold text-text-muted">{message}</span>
    </div>
  );
}

/**
 * Error state display.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 gap-3">
      <span className="text-3xl">⚠️</span>
      <span className="text-sm font-semibold text-error">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 mt-2 text-xs font-bold text-status-error bg-status-error/10 hover:bg-status-error/20 border border-status-error/30 rounded-lg transition-colors cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
}
