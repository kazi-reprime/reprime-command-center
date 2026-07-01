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
    <div className="bg-[#FFCC33] rounded-xl p-4 shadow-[0_0_15px_rgba(255,204,51,0.2)] border border-[#FFCC33]">
      <div className="flex items-center space-x-2 border-b border-[#0E3470]/20 pb-2 mb-2">
        <Target className="h-4 w-4 text-[#0E3470]" />
        <h2 className="text-sm font-bold text-[#0E3470] uppercase tracking-wider">APEX Priority</h2>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[#0E3470]" />
        </div>
      ) : priority ? (
        <div className="text-[#0E3470]">
          <h3 className="font-bold text-sm leading-tight line-clamp-2">{priority.title}</h3>
          {priority.time && (
            <p className="text-[10px] font-bold mt-1 opacity-75 uppercase">
              {new Date(priority.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {priority.description && (
            <p className="text-xs font-medium mt-1 leading-snug opacity-90 line-clamp-2">
              {priority.description}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center space-x-2 text-[#0E3470] py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold leading-tight">All clear. No urgent items.</span>
        </div>
      )}
    </div>
  );
}
