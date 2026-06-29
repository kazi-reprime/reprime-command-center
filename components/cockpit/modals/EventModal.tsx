'use client';

import { useState } from 'react';
import { X, Calendar, MapPin, Users, Link as LinkIcon, FileText, CheckCircle2, Clock, StickyNote, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/useStore';

interface EventModalProps {
  eventId: string;
  onClose: () => void;
}

export default function EventModal({ eventId, onClose }: EventModalProps) {
  const { events } = useStore();
  const event = events.find(e => e.id === eventId);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (!event) return null;

  const start = new Date(event.start);
  const end = new Date(event.end);
  const dateStr = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  
  const handleCreateNote = async () => {
    setLoadingAction('note');
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Note: ${event.summary}`,
          body: `Meeting on ${dateStr} at ${timeStr}.\n\n`,
          linked_event_id: event.id
        })
      });
      if (res.ok) alert('Note created! You can find it in the Notes panel.');
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCreateFollowup = async () => {
    setLoadingAction('followup');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Follow-up on: ${event.summary}`,
          priority: 3,
          projectTag: 'Meeting Follow-up',
        })
      });
      if (res.ok) alert('Follow-up task created in your bucket!');
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-[#0c2957] border border-[#FFCC33]/30 w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#FFCC33]/20 bg-[#08224d]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#FFCC33]/10 rounded-lg">
              <Calendar className="h-5 w-5 text-[#FFCC33]" />
            </div>
            <h2 className="text-white font-bold text-base line-clamp-1">{event.summary}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition rounded hover:bg-white/10 shrink-0 ml-2">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#09224d]/30">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 text-gray-300">
              <Clock className="h-4 w-4 text-[#FFCC33]" />
              <div className="text-sm">
                <span className="font-semibold text-white">{dateStr}</span> <span className="mx-1">•</span> <span>{timeStr}</span>
              </div>
            </div>
          </div>

          {event.meetingUrl && (
            <div className="flex flex-col space-y-1 text-sm text-gray-300">
              <div className="flex items-center space-x-2 font-semibold text-gray-400 uppercase tracking-wider text-[10px] mb-1">
                <LinkIcon className="h-3 w-3" />
                <span>Meeting Link</span>
              </div>
              <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline break-all">
                {event.meetingUrl}
              </a>
            </div>
          )}

          {event.attendees && event.attendees.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                <Users className="h-3 w-3" />
                <span>Attendees ({event.attendees.length})</span>
              </div>
              <div className="bg-[#08224d] rounded-lg border border-white/5 p-3 space-y-2">
                {event.attendees.map((attendee, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm text-gray-200">{attendee.displayName || attendee.email}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      attendee.responseStatus === 'accepted' ? 'bg-green-500/10 text-green-400' :
                      attendee.responseStatus === 'declined' ? 'bg-red-500/10 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {attendee.responseStatus || 'needsAction'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {event.description && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                <FileText className="h-3 w-3" />
                <span>Description</span>
              </div>
              <div className="text-sm text-gray-300 bg-[#08224d] p-3 rounded-lg border border-white/5 whitespace-pre-wrap leading-relaxed">
                {event.description}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#FFCC33]/20 bg-[#08224d] flex items-center justify-between">
          <button 
            onClick={handleCreateNote}
            disabled={loadingAction !== null}
            className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
          >
            {loadingAction === 'note' ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />}
            <span>Create Note</span>
          </button>
          
          <button 
            onClick={handleCreateFollowup}
            disabled={loadingAction !== null}
            className="flex items-center space-x-2 px-4 py-2 bg-[#FFCC33] hover:bg-[#ffe066] text-[#0E3470] text-sm font-bold rounded-lg transition disabled:opacity-50"
          >
            {loadingAction === 'followup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>Create Follow-up</span>
          </button>
        </div>
      </div>
    </div>
  );
}
