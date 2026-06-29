'use client';

import { useState, useEffect } from 'react';
import { Clock, Loader2, MessageCircle } from 'lucide-react';
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
    <div className="h-48 bg-[#0c2957] border border-[#FFCC33]/20 rounded-xl p-4 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#FFCC33]/15 pb-3 mb-3">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-[#FFCC33]" />
          <h2 className="text-sm font-bold text-[#FFCC33] uppercase tracking-wider">Pending Follow-ups</h2>
        </div>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
        ) : (
          <span className="text-xs text-gray-400 font-bold">{followups.length} pending</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {followups.length === 0 && !loading ? (
          <div className="h-full flex items-center justify-center text-center p-2">
            <span className="text-xs text-gray-500">All caught up.</span>
          </div>
        ) : (
          followups.map((thread) => (
            <div 
              key={thread.id} 
              onClick={() => setSelectedThreadId(thread.id)}
              className="p-2.5 bg-[#08224d] border border-white/5 rounded-lg hover:border-[#FFCC33]/20 transition cursor-pointer flex items-center justify-between"
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate">
                    {thread.contact_name || thread.phone}
                  </span>
                  <span className="text-[9px] text-gray-400 shrink-0 ml-2">
                    {thread.last_message_at ? new Date(thread.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1 truncate">
                  {thread.last_message_preview}
                </p>
              </div>
              <div className="shrink-0 flex items-center">
                <span className="bg-[#FFCC33] text-[#0E3470] text-[9px] font-bold px-1.5 rounded-full">
                  {thread.unread_count}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
