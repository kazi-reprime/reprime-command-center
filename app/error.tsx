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
    <div className="flex h-screen w-full flex-col items-center justify-center bg-black text-white">
      <div className="max-w-md p-6 bg-zinc-900 border border-zinc-800 rounded-lg text-center shadow-xl">
        <h2 className="text-xl font-bold text-rose-500 mb-4">Something went wrong!</h2>
        <p className="text-sm text-zinc-400 mb-6 break-words">
          {error.message || 'An unexpected error occurred in the application.'}
        </p>
        <button
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-semibold transition-colors"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
