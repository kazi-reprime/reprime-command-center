'use client';

import { useState, useEffect } from 'react';
import { Mail, Calendar, ExternalLink, CalendarClock, AlertTriangle, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/useStore';
import ApexCard from './ApexCard';
import EmailModal from '../modals/EmailModal';
import ComposeEmailModal from '../modals/ComposeEmailModal';
import EventModal from '../modals/EventModal';
import FollowupPanel from './FollowupPanel';


function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function formatEventTime(startStr: string, endStr: string) {
  if (!startStr) return '';
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : null;
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  return end 
    ? `${start.toLocaleTimeString([], timeOpts)} - ${end.toLocaleTimeString([], timeOpts)}`
    : start.toLocaleTimeString([], timeOpts);
}

function getEventDuration(startStr: string, endStr: string) {
  if (!startStr || !endStr) return '';
  const diff = new Date(endStr).getTime() - new Date(startStr).getTime();
  const mins = Math.floor(diff / (1000 * 60));
  return `${mins}m`;
}

export default function LeftFlank() {
  const { emails, setEmails, events, setEvents, hebcalAlert } = useStore();
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);

  useEffect(() => {
    const fetchEmails = async () => {
      setLoadingEmails(true);
      try {
        const res = await fetch('/api/gmail');
        if (res.ok) {
          const data = await res.json();
          setEmails(data);
        }
      } catch (e) {
        console.error('Error fetching emails:', e);
      } finally {
        setLoadingEmails(false);
      }
    };

    const fetchEvents = async () => {
      setLoadingEvents(true);
      try {
        const res = await fetch('/api/calendar');
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
      } catch (e) {
        console.error('Error fetching calendar events:', e);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEmails();
    fetchEvents();
  }, [setEmails, setEvents]);

  return (
    <div className="w-full max-w-[420px] shrink-0 flex flex-col gap-6 min-h-[600px] lg:h-[calc(100vh-8rem)]" style={{ fontFamily: 'inherit' }}>
      {/* 0. APEX Priority Panel */}
      <ApexCard />

      {/* 1. Email Triage Panel */}
      <div className="flex-1 bg-surface border border-black/5 rounded-[32px] p-6 flex flex-col overflow-hidden shadow-sm shadow-black/[0.02]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-text-primary tracking-tight">Email Triage</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Google Sync Active</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loadingEmails && <Loader2 className="h-4 w-4 animate-spin text-text-muted" />}
            <button 
              onClick={() => setShowCompose(true)}
              className="px-4 py-2 bg-surface text-text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-surface-raised transition-all shadow-lg shadow-slate-900/20"
            >
              Compose
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
          {emails.length === 0 && !loadingEmails ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <div className="w-12 h-12 rounded-2xl bg-surface-raised flex items-center justify-center mb-3">
                <Mail className="h-5 w-5 text-text-muted" />
              </div>
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Inbox Zero</span>
            </div>
          ) : (
            emails.map((email) => (
              <div 
                key={email.id} 
                onClick={() => setSelectedEmailId(email.id)}
                className="group p-4 bg-surface-raised border border-border/50 rounded-2xl hover:bg-surface hover:border-blue-500/20 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-text-primary truncate max-w-[200px] tracking-tight">{email.from}</span>
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${
                    email.score >= 10 
                      ? 'bg-success/10 text-success border border-emerald-500/10' 
                      : email.score < 0 
                      ? 'bg-error/10 text-rose-600 border border-rose-500/10'
                      : 'bg-warning/10 text-warning border border-amber-500/10'
                  }`}>
                    P{email.score}
                  </span>
                </div>
                <p className="text-xs font-black text-text-primary truncate mb-1">{email.subject}</p>
                <div className="flex items-center gap-2 mb-2">
                  {email.score >= 10 && <span className="text-[8px] bg-error text-error-foreground px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Urgent</span>}
                  {email.score >= 15 && <span className="text-[8px] bg-warning text-text-primary px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Priority 1</span>}
                </div>
                <p className="text-[11px] font-medium text-text-secondary line-clamp-2 leading-relaxed mb-3">{email.snippet}</p>
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{getRelativeTime(email.date)}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://mail.google.com/mail/u/0/#inbox/${email.id}`, '_blank');
                    }}
                    className="text-[10px] font-black text-accent hover:text-accent flex items-center gap-1 uppercase tracking-widest"
                  >
                    <span>View</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 1.5 Follow-up Panel */}
      <div className="h-[280px]">
        <FollowupPanel />
      </div>

      {/* 2. Calendar Panel */}
      <div className="h-[320px] bg-surface border border-black/5 rounded-[32px] p-6 flex flex-col overflow-hidden shadow-sm shadow-black/[0.02]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-error/10 flex items-center justify-center text-rose-500">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-text-primary tracking-tight">Agenda</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Today</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center text-text-muted">
            {loadingEvents ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
          {events.length === 0 && !loadingEvents ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <div className="w-12 h-12 rounded-2xl bg-surface-raised flex items-center justify-center mb-3">
                <Calendar className="h-5 w-5 text-text-muted" />
              </div>
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Day Clear</span>
            </div>
          ) : (
            events.map((event) => (
              <div 
                key={event.id} 
                onClick={() => setSelectedEventId(event.id)}
                className="group p-4 bg-surface-raised border border-border/50 rounded-2xl hover:bg-surface hover:border-rose-500/20 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-black text-text-primary leading-tight flex-1 tracking-tight">{event.summary}</span>
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-wider ml-3">
                    {getEventDuration(event.start || event.startTime, event.end || event.endTime)}
                  </span>
                </div>
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3">
                  {formatEventTime(event.start || event.startTime, event.end || event.endTime)}
                </p>
                {event.meetingUrl && (
                  <a
                    href={event.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-error text-error-foreground text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-error transition-all shadow-lg shadow-rose-500/20"
                  >
                    <span>Launch</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>

        {/* Shabbat alert warnings */}
        {hebcalAlert && (
          <div className="mt-4 p-3 bg-warning/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-[10px] font-black text-warning uppercase tracking-wider leading-tight">{hebcalAlert}</span>
          </div>
        )}
      </div>

      {selectedEmailId && (
        <EmailModal 
          emailId={selectedEmailId} 
          onClose={() => setSelectedEmailId(null)} 
        />
      )}

      {selectedEventId && (
        <EventModal
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
        />
      )}

      {showCompose && (
        <ComposeEmailModal
          open={showCompose}
          onClose={() => setShowCompose(false)}
        />
      )}
    </div>
  );
}
