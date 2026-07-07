'use client';

import React, { useEffect, useState } from 'react';

type Investor = {
  id: string;
  name: string;
  contactPhone: string;
  capitalCapacity: number;
  preferredDealType: string;
  preferredLocation: string;
  status: string;
  investorScore: number;
  lastInteractionAt: string;
};

export default function InvestorMomentum() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvestors() {
      try {
        const res = await fetch('/api/investors');
        const data = await res.json();
        if (Array.isArray(data)) {
          setInvestors(data);
        }
      } catch (err) {
        console.error('Failed to load investors', err);
      } finally {
        setLoading(false);
      }
    }
    fetchInvestors();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: "compact" }).format(val);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hot': return 'text-rose-500 bg-error/10';
      case 'committed': return 'text-success bg-success/10';
      case 'warm': return 'text-warning bg-warning/10';
      case 'cold': return 'text-blue-400 bg-blue-400/10';
      default: return 'text-text-secondary bg-surface-raised';
    }
  };

  if (loading) {
    return <div className="p-6 text-text-secondary font-mono text-sm">[SYS] Loading Investor Momentum...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary border-r border-border overflow-y-auto">
      <div className="sticky top-0 bg-surface/90 backdrop-blur-md border-b border-border p-4 z-10 flex justify-between items-center">
        <div>
          <h2 className="text-xs font-mono text-text-muted uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
            Investor CRM
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Momentum Engine & Capital Capacity
          </p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-text-primary text-xs px-3 py-1.5 rounded transition-colors font-mono">
          New Campaign
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {investors.map(inv => (
          <div key={inv.id} className="border border-border rounded-lg bg-surface p-4 hover:border-border-strong transition-colors cursor-pointer group">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg text-text-primary group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                  {inv.name}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${getStatusColor(inv.status)}`}>
                    {inv.status}
                  </span>
                </h3>
                <p className="text-xs text-text-muted font-mono mt-1">{inv.contactPhone}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-text-muted font-mono uppercase mb-1">Momentum Score</div>
                <div className="text-2xl font-semibold font-mono text-indigo-400">{inv.investorScore}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="bg-surface rounded p-2 border border-border flex justify-between items-center">
                <span className="text-[10px] text-zinc-600 font-mono uppercase">Capacity</span>
                <span className="text-sm font-medium">{formatCurrency(inv.capitalCapacity)}</span>
              </div>
              <div className="bg-surface rounded p-2 border border-border flex justify-between items-center">
                <span className="text-[10px] text-zinc-600 font-mono uppercase">Target</span>
                <span className="text-sm font-medium">{inv.preferredDealType}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-surface hover:bg-surface-raised text-xs py-1.5 rounded text-text-secondary transition-colors">
                Send Update
              </button>
              <button className="flex-1 bg-surface hover:bg-surface-raised text-xs py-1.5 rounded text-text-secondary transition-colors">
                Message History
              </button>
              <button className="flex-1 bg-surface hover:bg-surface-raised text-xs py-1.5 rounded text-text-secondary transition-colors">
                Log Meeting
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
