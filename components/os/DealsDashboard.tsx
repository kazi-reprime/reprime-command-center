'use client';

import React, { useEffect, useState } from 'react';

type Deal = {
  id: string;
  name: string;
  address: string;
  assetType: string;
  purchasePrice: number;
  loanAmount: number;
  equityNeeded: number;
  status: string;
  priority: number;
  riskScore: number;
};

export default function DealsDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDeals() {
      try {
        const res = await fetch('/api/deals');
        const data = await res.json();
        if (Array.isArray(data)) {
          setDeals(data);
        }
      } catch (err) {
        console.error('Failed to load deals', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDeals();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  if (loading) {
    return (
      <div className="p-6 text-zinc-400 font-mono text-sm">
        [SYS] Loading deals matrix...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black text-zinc-200 border-r border-zinc-900 overflow-y-auto">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-zinc-900 p-4 z-10">
        <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          Deal Command Center
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Active CRE Pipeline & Momentum
        </p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {deals.length === 0 ? (
          <div className="text-zinc-500 font-mono text-sm border border-zinc-900 rounded p-4 border-dashed text-center">
            No active deals. Create a new deal to track momentum.
          </div>
        ) : (
          deals.map(deal => (
            <div key={deal.id} className="border border-zinc-800 rounded-lg bg-zinc-950 p-4 hover:border-zinc-700 transition-colors cursor-pointer group">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg text-white group-hover:text-emerald-400 transition-colors">
                    {deal.name}
                  </h3>
                  <p className="text-xs text-zinc-500 font-mono mt-1">{deal.address} &bull; {deal.assetType}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded font-mono ${deal.status === 'under_contract' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    {deal.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="bg-black rounded p-2 border border-zinc-900">
                  <p className="text-[10px] text-zinc-600 font-mono uppercase">Purchase</p>
                  <p className="text-sm font-medium">{formatCurrency(deal.purchasePrice)}</p>
                </div>
                <div className="bg-black rounded p-2 border border-zinc-900">
                  <p className="text-[10px] text-zinc-600 font-mono uppercase">Loan</p>
                  <p className="text-sm font-medium">{formatCurrency(deal.loanAmount)}</p>
                </div>
                <div className="bg-black rounded p-2 border border-zinc-900">
                  <p className="text-[10px] text-zinc-600 font-mono uppercase">Equity</p>
                  <p className="text-sm font-medium text-emerald-400">{formatCurrency(deal.equityNeeded)}</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-xs py-1.5 rounded text-zinc-300 transition-colors">
                  Ask Nora
                </button>
                <button className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-xs py-1.5 rounded text-zinc-300 transition-colors">
                  Investors
                </button>
                <button className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-xs py-1.5 rounded text-zinc-300 transition-colors">
                  Documents
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
