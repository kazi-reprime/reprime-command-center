'use client';

import React from 'react';
import Link from 'next/link';

export default function OSLayerPage() {
  return (
    <div className="min-h-screen bg-[#08224d] flex flex-col font-sans items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl p-8 flex flex-col items-center shadow-2xl text-center">
        
        <div className="mb-6 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-[#FFCC33]/20 border border-[#FFCC33]/40 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#FFCC33]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-2 tracking-wide">OS Advanced Modules has moved</h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            All advanced modules are now centralized in the Reprime Portal. Click the button below to access your dashboard.
          </p>
        </div>

        <a 
          href="https://portal.reprimeterminal.com/dashboard" 
          target="_blank"
          rel="noopener noreferrer"
          className="w-full mb-4 px-4 py-3 bg-success hover:bg-success text-success-foreground rounded-lg font-bold text-sm tracking-wide transition-colors flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
        >
          <span>Open Reprime Portal</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>

        <Link href="/cockpit" className="text-sm text-text-muted hover:text-text-secondary font-mono transition-colors">
          &larr; Return to Cockpit
        </Link>
      </div>
    </div>
  );
}
