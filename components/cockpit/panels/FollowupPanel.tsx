'use client';

import { useState, useEffect } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/useStore';

interface FollowupThread {
  id: string;
  contact_name: string | null;
  phone: string | null;
  channel_type: string | null;
  unread_count: number;
  last_message_preview: string | null;
  last_message_at: string | null;
}

export default function FollowupPanel() {
  const [followups, setFollowups] = useState<FollowupThread[]>([]);
  const [loading, setLoading] = useState(false);
  const { setSelectedThreadId } = useStore();

  useEffect(() => {
    const fetchFollowups = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/briefing/today');
        if (res.ok) {
          const data = await res.json();
          setFollowups(data.pending_followups || []);
        }
      } catch (e) {
        console.error('Failed to fetch followups:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchFollowups();
  }, []);

  return (
    <div className="h-full bg-surface border border-black/5 rounded-[24px] p-6 flex flex-col overflow-hidden shadow-sm shadow-black/[0.02]" style={{ fontFamily: 'inherit' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
            <Clock className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-black text-text-primary uppercase tracking-widest">Follow-ups</h2>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
        ) : (
          <div className="px-2.5 py-1 bg-surface-raised border border-border rounded-lg">
            <span className="text-[10px] text-text-secondary font-black uppercase tracking-wider">{followups.length} Priority</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
        {followups.length === 0 && !loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <div className="w-12 h-12 rounded-2xl bg-surface-raised flex items-center justify-center mb-3">
              <Clock className="h-5 w-5 text-text-muted" />
            </div>
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Protocol Clear</span>
          </div>
        ) : (
          followups.map((thread) => (
            <div 
              key={thread.id} 
              onClick={() => setSelectedThreadId(thread.id)}
              className="group p-4 bg-surface-raised border border-border/50 rounded-2xl hover:bg-surface hover:border-blue-500/20 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 cursor-pointer flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-text-primary truncate tracking-tight">
                    {thread.contact_name || thread.phone}
                  </span>
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">
                    {thread.last_message_at ? new Date(thread.last_message_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-text-secondary truncate leading-relaxed">
                  {thread.last_message_preview}
                </p>
              </div>
              {thread.unread_count > 0 && (
                <div className="shrink-0">
                  <span className="bg-accent text-accent-foreground text-[9px] font-black px-2 py-1 rounded-lg shadow-lg shadow-blue-500/20">
                    {thread.unread_count}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
