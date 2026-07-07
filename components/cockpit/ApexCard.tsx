'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, Loader2, Zap } from 'lucide-react';

interface SuggestedFocus {
  gap_start: string;
  gap_end: string;
  item_id: string;
  title: string;
  priority: number;
}

export default function ApexCard() {
  const [focus, setFocus] = useState<SuggestedFocus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApex() {
      try {
        const res = await fetch('/api/briefing/today');
        if (res.ok) {
          const data = await res.json();
          if (data.suggested_focus && data.suggested_focus.length > 0) {
            setFocus(data.suggested_focus[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch APEX priority', err);
      } finally {
        setLoading(false);
      }
    }
    fetchApex();
  }, []);

  if (loading) {
    return (
      <div className="mx-4 mt-4 bg-surface border border-border rounded-lg p-3 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
      </div>
    );
  }

  if (!focus) {
    return null; // Don't render if no urgent focus
  }

  return (
    <div className="mx-4 mt-2 mb-1 bg-surface-raised border border-accent/40 rounded-lg p-3 flex items-center justify-between group shadow-[0_0_15px_rgba(var(--accent-rgb),0.15)] relative overflow-hidden">
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0 translate-x-[-100%] group-hover:animate-[shimmer_2s_infinite]" />
      
      <div className="flex items-center space-x-3 z-10">
        <div className="bg-accent/20 p-2 rounded-md">
          <Zap className="h-5 w-5 text-accent animate-pulse" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-accent uppercase tracking-wider mb-0.5">APEX Priority</h3>
          <p className="text-sm font-semibold text-text-primary">{focus.title}</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-4 z-10">
        <div className="text-right">
          <p className="text-[10px] text-text-muted font-medium">Scheduled Window</p>
          <p className="text-xs text-text-secondary font-mono">
            {new Date(focus.gap_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
            {new Date(focus.gap_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/center'}
          className="bg-accent text-accent-foreground p-2 rounded-md hover:bg-accent-hover transition"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
