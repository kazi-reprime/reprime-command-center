'use client';

import React from 'react';

/**
 * Banner shown when data comes from seed/demo fallback instead of the live database.
 */
export function DataSourceBanner({ source, warning }: { source: string; warning?: string }) {
  if (source === 'database') return null;
  return (
    <div className="flex items-center gap-3 p-4 mb-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-600">
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
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
      <span className="text-sm">🔧</span>
      <span className="text-xs font-semibold text-slate-500">{message}</span>
    </div>
  );
}

/**
 * Loading spinner overlay for data fetching.
 */
export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-12 gap-3">
      <div className="w-5 h-5 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
      <span className="text-sm font-semibold text-slate-400">{message}</span>
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
      <span className="text-sm font-semibold text-red-500">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 mt-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
