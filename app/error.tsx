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
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="max-w-md p-8 glass-card rounded-3xl text-center shadow-xl border border-border">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-status-error/10 flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-3">Something went wrong</h2>
        <p className="text-sm text-text-secondary mb-6 break-words leading-relaxed">
          {error.message || 'An unexpected error occurred in the application.'}
        </p>
        <button
          className="px-6 py-3 bg-accent hover:bg-accent-hover rounded-2xl text-sm font-bold text-accent-foreground transition-all shadow-lg cursor-pointer"
          onClick={() => reset()}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
