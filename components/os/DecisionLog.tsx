'use client';

import React, { useState, useEffect } from 'react';

type Decision = {
  id: string;
  title: string;
  description: string;
  decided_by: string;
  reason: string;
  status: 'active' | 'reversed' | 'parked';
  is_reversible: boolean;
  created_at: string;
};

export default function DecisionLog() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDecisions = async () => {
      try {
        const res = await fetch('/api/decisions');
        if (res.ok) {
          const data = await res.json();
          setDecisions(data.decisions || []);
        }
      } catch (e) {
        console.error('Failed to fetch decisions', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDecisions();
  }, []);

  const handleReverse = async (id: string) => {
    try {
      const res = await fetch('/api/decisions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'reversed' })
      });
      if (res.ok) {
        setDecisions(prev => prev.map(d => d.id === id ? { ...d, status: 'reversed' } : d));
      }
    } catch (e) {
      console.error('Failed to reverse decision', e);
    }
  };
  return (
    <div className="flex flex-col h-full bg-surface text-text-primary border-r border-border overflow-y-auto">
      <div className="sticky top-0 bg-surface/90 backdrop-blur-md border-b border-border p-4 z-10">
        <h2 className="text-xs font-mono text-text-muted uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
          Immutable Decision Log
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          System policies & historical rulings
        </p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {loading ? (
          <div className="text-text-muted text-sm text-center">Loading decisions...</div>
        ) : decisions.length === 0 ? (
          <div className="text-text-muted text-sm text-center">No decisions logged.</div>
        ) : (
          decisions.map(d => (
            <div key={d.id} className={`border rounded-lg p-4 relative overflow-hidden transition-colors ${d.status === 'reversed' ? 'border-border/50 bg-surface/50 opacity-60' : 'border-border bg-surface'}`}>
              {d.status === 'reversed' && (
                <div className="absolute top-0 right-0 p-2 bg-error/20 text-rose-500 text-[10px] uppercase font-mono rounded-bl-lg">
                  Reversed
                </div>
              )}
              {d.status === 'active' && d.is_reversible && (
                <button onClick={() => handleReverse(d.id)} className="absolute top-2 right-2 p-1 bg-surface-raised hover:bg-surface-hover text-text-secondary hover:text-text-primary rounded text-[10px] uppercase font-mono transition">
                  Reverse
                </button>
              )}
              <h3 className={`font-semibold mb-2 pr-16 ${d.status === 'reversed' ? 'line-through text-text-muted' : 'text-text-primary'}`}>{d.title}</h3>
              <p className="text-sm text-text-secondary">{d.description}</p>
              
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-text-muted font-mono uppercase mb-1">Reason</p>
                  <p className="text-xs text-text-secondary">{d.reason}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted font-mono uppercase mb-1">Decided By</p>
                  <p className="text-xs text-text-secondary">{d.decided_by} &bull; {new Date(d.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
