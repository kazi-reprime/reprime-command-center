'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#fdfdfd]">
      <div className="max-w-md p-8 glass-card rounded-3xl text-center shadow-xl border border-slate-200">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-3">Something went wrong</h2>
        <p className="text-sm text-slate-500 mb-6 break-words leading-relaxed">
          {error.message || 'An unexpected error occurred in the application.'}
        </p>
        <button
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-2xl text-sm font-bold text-white transition-all shadow-lg shadow-blue-500/30 cursor-pointer"
          onClick={() => reset()}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
