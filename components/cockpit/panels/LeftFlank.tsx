'use client';

import { useState, useEffect } from 'react';
import { Mail, Calendar, ExternalLink, CalendarClock, AlertTriangle, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/useStore';
import ApexCard from './ApexCard';
import EmailModal from '../modals/EmailModal';
import ComposeEmailModal from '../modals/ComposeEmailModal';
import EventModal from '../modals/EventModal';
import FollowupPanel from './FollowupPanel';

interface Email {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  score: number;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  meetingUrl?: string;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
}

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
  }, []);

  return (
    <div className="w-[380px] flex flex-col space-y-4 h-[calc(100vh-6rem)]">
      {/* 0. APEX Priority Panel */}
      <ApexCard />

      {/* 1. Email Triage Panel */}
      <div className="flex-1 bg-[#0c2957] border border-[#FFCC33]/20 rounded-xl p-4 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#FFCC33]/15 pb-3 mb-3">
          <div className="flex items-center space-x-2">
            <Mail className="h-4 w-4 text-[#FFCC33]" />
            <h2 className="text-sm font-bold text-[#FFCC33] uppercase tracking-wider">Email Triage Feed</h2>
          </div>
          <div className="flex items-center space-x-3">
            {loadingEmails && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FFCC33]" />}
            <button 
              onClick={() => setShowCompose(true)}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-bold uppercase tracking-wide rounded transition"
            >
              Compose
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {emails.length === 0 && !loadingEmails ? (
            <div className="h-full flex items-center justify-center text-center p-4">
              <span className="text-xs text-gray-500">Inbox clear. Google sync running active.</span>
            </div>
          ) : (
            emails.map((email) => (
              <div 
                key={email.id} 
                onClick={() => setSelectedEmailId(email.id)}
                className="p-3 bg-[#08224d] border border-white/5 rounded-lg hover:border-[#FFCC33]/20 transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate max-w-[180px]">{email.from}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    email.score >= 10 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : email.score < 0 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-[#FFCC33]/10 text-[#FFCC33] border border-[#FFCC33]/20'
                  }`}>
                    Score: {email.score}
                  </span>
                </div>
                <p className="text-xs text-gray-200 mt-1 font-semibold truncate">{email.subject}</p>
                <div className="flex items-center space-x-2 mt-1">
                  {email.score >= 10 && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded font-bold uppercase tracking-wider">Urgent</span>}
                  {email.score >= 15 && <span className="text-[8px] bg-[#FFCC33]/20 text-[#FFCC33] px-1 py-0.5 rounded font-bold uppercase tracking-wider">Investor / Legal</span>}
                </div>
                <p className="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">{email.snippet}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[10px] text-gray-400">{getRelativeTime(email.date)}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://mail.google.com/mail/u/0/#inbox/${email.id}`, '_blank');
                    }}
                    className="text-[10px] text-[#FFCC33] hover:underline flex items-center space-x-0.5"
                  >
                    <span>Open Gmail</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 1.5 Follow-up Panel */}
      <FollowupPanel />

      {/* 2. Calendar Panel */}
      <div className="h-72 bg-[#0c2957] border border-[#FFCC33]/20 rounded-xl p-4 flex flex-col overflow-hidden shrink-0">
        <div className="flex items-center justify-between border-b border-[#FFCC33]/15 pb-3 mb-3">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-[#FFCC33]" />
            <h2 className="text-sm font-bold text-[#FFCC33] uppercase tracking-wider">Today&apos;s Agenda</h2>
          </div>
          {loadingEvents ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
          ) : (
            <CalendarClock className="h-4 w-4 text-gray-400" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {events.length === 0 && !loadingEvents ? (
            <div className="h-full flex items-center justify-center text-center p-4">
              <span className="text-xs text-gray-500">No upcoming meetings today.</span>
            </div>
          ) : (
            events.map((event) => (
              <div 
                key={event.id} 
                onClick={() => setSelectedEventId(event.id)}
                className="p-3 bg-[#08224d] border border-white/5 rounded-lg hover:border-[#FFCC33]/20 transition cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold text-white leading-tight">{event.summary}</span>
                  <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-2">
                    {getEventDuration(event.start, event.end)}
                  </span>
                </div>
                <p className="text-[10px] text-[#FFCC33] font-semibold mt-1">
                  {formatEventTime(event.start, event.end)}
                </p>
                {event.meetingUrl && (
                  <a
                    href={event.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center space-x-1 text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded hover:bg-green-500/20 transition"
                  >
                    <span>Join Call</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>

        {/* Shabbat alert warnings */}
        {hebcalAlert && (
          <div className="mt-3 p-2 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg flex items-center space-x-2 text-[10px] text-[#F59E0B]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{hebcalAlert}</span>
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
