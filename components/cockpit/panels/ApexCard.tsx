/* eslint-disable */
'use client';

import { useState, useEffect } from 'react';
import { Target, Loader2, AlertCircle } from 'lucide-react';

interface ApexItem {
  type: 'meeting' | 'followup' | 'focus';
  title: string;
  time?: string;
  description?: string;
}

export default function ApexCard() {
  const [priority, setPriority] = useState<ApexItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApex = async () => {
      try {
        const res = await fetch('/api/briefing/today');
        if (res.ok) {
          const data = await res.json();
          let topItem: ApexItem | null = null;
          
          if (data.meetings && data.meetings.nextUp) {
            topItem = { 
              type: 'meeting', 
              title: data.meetings.nextUp.title, 
              time: data.meetings.nextUp.startTime,
              description: 'Next meeting approaching'
            };
          } else if (data.pending_followups && data.pending_followups.length > 0) {
            topItem = { 
              type: 'followup', 
              title: `Follow up: ${data.pending_followups[0].contact_name || data.pending_followups[0].phone}`, 
              time: data.pending_followups[0].last_message_at,
              description: data.pending_followups[0].last_message_preview 
            };
          } else if (data.suggested_focus && data.suggested_focus.length > 0) {
             topItem = { 
               type: 'focus', 
               title: data.suggested_focus[0].title || 'Suggested Focus', 
               description: data.suggested_focus[0].description || 'Clear your tasks bucket.' 
             };
          }
          
          setPriority(topItem);
        }
      } catch (e) {
        console.error('Failed to fetch APEX data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchApex();
  }, []);

  return (
    <div className="relative overflow-hidden bg-surface border border-black/5 rounded-[32px] p-6 shadow-sm shadow-black/[0.02]" style={{ fontFamily: 'inherit' }}>
      {/* Accent strip */}
      <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />
      
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-accent">
          <Target className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-black text-text-primary uppercase tracking-widest">APEX Priority</h2>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      ) : priority ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h3 className="font-black text-lg text-text-primary leading-tight tracking-tight mb-2">{priority.title}</h3>
          <div className="flex items-center gap-4">
            {priority.time && (
              <div className="px-2 py-1 bg-surface-raised border border-border rounded-lg">
                <span className="text-[10px] font-black text-text-secondary uppercase tracking-wider">
                  {new Date(priority.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] font-black text-accent uppercase tracking-widest">Active Protocol</span>
            </div>
          </div>
          {priority.description && (
            <p className="text-xs font-medium text-text-secondary mt-4 leading-relaxed opacity-80">
              {priority.description}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 py-4 text-text-muted opacity-60">
          <div className="w-10 h-10 rounded-2xl bg-surface-raised flex items-center justify-center">
            <Check className="h-5 w-5" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest">Protocol Clear</span>
        </div>
      )}
    </div>
  );
}

import { Check } from 'lucide-react'
