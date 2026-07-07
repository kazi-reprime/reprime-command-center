'use client';

import React, { useState } from 'react';

export default function CampaignLauncher() {
  const [step, setStep] = useState(1);

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary border-r border-border overflow-y-auto">
      <div className="sticky top-0 bg-surface/90 backdrop-blur-md border-b border-border p-4 z-10 flex justify-between items-center">
        <div>
          <h2 className="text-xs font-mono text-text-muted uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-success rounded-full"></span>
            Campaign Launcher
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Bulk Investor Outreach
          </p>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-6">
        {/* Step Progress */}
        <div className="flex justify-between items-center px-4 font-mono text-xs">
          <div className={`flex flex-col items-center gap-2 ${step >= 1 ? 'text-emerald-400' : 'text-zinc-600'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= 1 ? 'border-emerald-400 bg-emerald-400/10' : 'border-border-strong bg-surface'}`}>1</div>
            Audience
          </div>
          <div className={`flex-1 h-px mx-4 ${step >= 2 ? 'bg-emerald-400/50' : 'bg-surface-raised'}`}></div>
          <div className={`flex flex-col items-center gap-2 ${step >= 2 ? 'text-emerald-400' : 'text-zinc-600'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= 2 ? 'border-emerald-400 bg-emerald-400/10' : 'border-border-strong bg-surface'}`}>2</div>
            Message
          </div>
          <div className={`flex-1 h-px mx-4 ${step >= 3 ? 'bg-emerald-400/50' : 'bg-surface-raised'}`}></div>
          <div className={`flex flex-col items-center gap-2 ${step >= 3 ? 'text-emerald-400' : 'text-zinc-600'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= 3 ? 'border-emerald-400 bg-emerald-400/10' : 'border-border-strong bg-surface'}`}>3</div>
            Launch
          </div>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="border border-border rounded-lg bg-surface p-4">
              <label className="text-xs uppercase font-mono text-text-muted block mb-2">Target Segment</label>
              <select className="w-full bg-surface border border-border rounded p-2 text-text-primary font-mono text-sm focus:outline-none focus:border-border-strong">
                <option>All Hot Investors (Score &gt; 80)</option>
                <option>Florida Retail Buyers</option>
                <option>Past Commitments &gt; $1M</option>
                <option>Custom List...</option>
              </select>
              <p className="text-xs text-text-secondary mt-2">Targeting ~14 investors.</p>
            </div>
            <div className="border border-border rounded-lg bg-surface p-4">
              <label className="text-xs uppercase font-mono text-text-muted block mb-2">Deal Context</label>
              <select className="w-full bg-surface border border-border rounded p-2 text-text-primary font-mono text-sm focus:outline-none focus:border-border-strong">
                <option>Bay Valley Shopping Center (Capital Call)</option>
                <option>Downtown Office Plaza (Initial Pitch)</option>
                <option>No Deal Context</option>
              </select>
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-success hover:bg-success text-success-foreground font-mono py-2 rounded transition-colors mt-2">
              Next: Draft Message &rarr;
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="border border-border rounded-lg bg-surface p-4">
              <label className="text-xs uppercase font-mono text-text-muted block mb-2">Ask Nora to Draft</label>
              <textarea 
                className="w-full bg-surface border border-border rounded p-3 text-text-primary focus:outline-none focus:border-border-strong resize-none h-24 text-sm"
                placeholder="E.g., Tell them about the new anchor tenant at Bay Valley and ask if they want to up their allocation..."
              ></textarea>
              <button className="mt-3 w-full bg-surface-raised hover:bg-surface-hover text-text-primary text-xs font-mono py-1.5 rounded transition-colors">
                Generate Variants with AI
              </button>
            </div>
            <div className="border border-emerald-900/50 bg-emerald-900/10 rounded-lg p-4">
              <label className="text-[10px] uppercase font-mono text-success block mb-2">Preview (Sarah Chen)</label>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">
                Hi Sarah, we just secured a major national anchor for Bay Valley which significantly derisks the retail footprint. 
                Given your capacity preference for FL retail, I wanted to check if you&apos;d like to review the updated proforma?
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setStep(1)} className="flex-1 bg-surface hover:bg-surface-raised text-text-primary font-mono py-2 rounded transition-colors">
                &larr; Back
              </button>
              <button onClick={() => setStep(3)} className="flex-1 bg-success hover:bg-success text-success-foreground font-mono py-2 rounded transition-colors">
                Next: Review & Launch &rarr;
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="border border-rose-900/50 bg-rose-900/10 rounded-lg p-6 text-center">
              <h3 className="text-rose-400 font-semibold mb-2">Ready to Launch</h3>
              <p className="text-sm text-rose-300/80 mb-4">
                You are about to send 14 personalized WhatsApp messages. This action cannot be undone.
              </p>
              <button className="bg-error hover:bg-error text-error-foreground font-bold py-3 px-6 rounded transition-colors w-full uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(225,29,72,0.4)]">
                Launch Campaign
              </button>
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-surface hover:bg-surface-raised text-text-secondary font-mono py-2 rounded transition-colors mt-2 text-xs">
              &larr; Back to Editor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
