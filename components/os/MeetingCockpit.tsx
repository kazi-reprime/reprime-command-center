'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/contexts/ToastContext';
import { Loader2, RefreshCw, Video, Clock, Link2, ChevronDown, ChevronUp, FileText } from 'lucide-react';

type ZoomMeeting = {
  id: string | number;
  topic: string;
  startTime: string;
  duration: number;
  joinUrl?: string;
  status?: string;
};

type Attendee = {
  name: string;
  email?: string;
  role?: string;
  present?: boolean;
  isInvestor?: boolean;
};

export default function MeetingCockpit() {
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMeeting, setActiveMeeting] = useState<ZoomMeeting | null>(null);
  const [attendees] = useState<Attendee[]>([]);
  const [notes, setNotes] = useState('');
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [pastMeetings, setPastMeetings] = useState<ZoomMeeting[]>([]);
  const { addToast } = useToast();

  // Fetch real meetings from Zoom via gateway
  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/zoom/meetings?type=upcoming');
      if (res.ok) {
        const data = await res.json();
        const m = (data.meetings || []) as ZoomMeeting[];
        setMeetings(m);
        // Auto-select next meeting
        if (m.length > 0 && !activeMeeting) {
          setActiveMeeting(m[0]);
        }
      }
    } catch (e) {
      console.error('Failed to fetch meetings:', e);
    } finally {
      setLoading(false);
    }
  }, [activeMeeting]);

  const fetchPastMeetings = useCallback(async () => {
    try {
      const res = await fetch('/api/zoom/meetings?type=past');
      if (res.ok) {
        const data = await res.json();
        setPastMeetings(data.meetings || []);
      }
    } catch (e) {
      console.error('Failed to fetch past meetings:', e);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Generate AI briefing for the active meeting
  const handleGenerateBriefing = async () => {
    if (!activeMeeting) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/nora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate a pre-meeting briefing for: "${activeMeeting.topic}". Include attendee context, recent interactions, and suggested talking points.`
        })
      });
      if (res.ok) {
        const data = await res.json();
        setBriefingText(data.reply);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  // Generate post-meeting summary
  const handleSummary = async () => {
    if (!notes.trim()) {
      addToast('Please type some notes first.', 'warning');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/nora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate a post-meeting summary and draft follow-up emails based on these notes from "${activeMeeting?.topic || 'meeting'}": ${notes}`
        })
      });
      if (res.ok) {
        const data = await res.json();
        setBriefingText(data.reply);
        addToast('Summary generated! See below.', 'success');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return 'Today';
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary border-r border-border overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-surface/90 backdrop-blur-md border-b border-border p-4 z-10 flex justify-between items-center">
        <div>
          <h2 className="text-xs font-mono text-text-muted uppercase tracking-widest flex items-center gap-2">
            <Video className="h-3.5 w-3.5 text-accent" />
            Meeting Intelligence
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            {activeMeeting ? activeMeeting.topic : 'No active meeting'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchMeetings} className="p-1.5 rounded hover:bg-surface-raised text-text-muted hover:text-text-secondary transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {activeMeeting?.joinUrl && (
            <a href={activeMeeting.joinUrl} target="_blank" rel="noopener noreferrer"
              className="bg-accent hover:bg-accent/80 text-white text-xs px-3 py-1.5 rounded transition-colors font-mono font-semibold flex items-center gap-1.5">
              <Link2 className="h-3 w-3" />
              Join
            </a>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Upcoming Meetings */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="border border-border rounded-lg bg-surface p-6 text-center">
            <Video className="h-6 w-6 text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-muted font-mono">No upcoming meetings</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg bg-surface p-4">
            <h3 className="text-[10px] uppercase font-mono text-text-muted mb-3">Upcoming Meetings</h3>
            <div className="space-y-2">
              {meetings.slice(0, 5).map(m => (
                <button
                  key={m.id}
                  onClick={() => setActiveMeeting(m)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    activeMeeting?.id === m.id
                      ? 'border-accent/50 bg-accent/5'
                      : 'border-border/50 bg-surface-raised hover:border-border-strong'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-text-primary truncate max-w-[70%]">{m.topic}</span>
                    <span className="text-[10px] font-mono text-text-muted shrink-0">{m.duration}m</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3 text-text-muted" />
                    <span className="text-[10px] text-text-secondary">
                      {formatDate(m.startTime)} {formatTime(m.startTime)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Attendees (when we have them) */}
        {attendees.length > 0 && (
          <div className="border border-border rounded-lg bg-surface p-4">
            <h3 className="text-[10px] uppercase font-mono text-text-muted mb-3">Attendees</h3>
            <div className="flex flex-wrap gap-2">
              {attendees.map(a => (
                <div key={a.name} className={`px-2 py-1 rounded border text-xs font-mono flex items-center gap-2 ${
                  a.present ? 'border-emerald-900/50 bg-emerald-900/10 text-success' : 'border-border bg-surface text-text-muted'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${a.present ? 'bg-success' : 'bg-border-strong'}`} />
                  {a.name}
                  {a.role && <span className="text-text-muted">({a.role})</span>}
                  {a.isInvestor && <span className="text-[8px] bg-warning/20 text-warning px-1 rounded">INV</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Briefing */}
        <div className="border border-indigo-900/50 bg-indigo-900/5 rounded-lg p-4">
          <h3 className="text-[10px] uppercase font-mono text-accent mb-2 flex justify-between">
            Nora Briefing
            <button onClick={handleGenerateBriefing} disabled={generating || !activeMeeting} className="text-text-muted hover:text-indigo-400 disabled:opacity-50">
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </h3>
          {briefingText ? (
            <div className="text-sm text-text-secondary whitespace-pre-wrap">{briefingText}</div>
          ) : (
            <p className="text-sm text-text-muted italic">Select a meeting above and click &ldquo;Generate&rdquo; for an AI-powered briefing with attendee context.</p>
          )}
        </div>

        {/* Live Notes / Transcription */}
        <div className="border border-border rounded-lg bg-surface p-4 flex-1 flex flex-col min-h-[200px]">
          <h3 className="text-[10px] uppercase font-mono text-text-muted mb-3 flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              Meeting Notes
            </span>
          </h3>
          <textarea 
            className="flex-1 bg-transparent border-none text-text-secondary focus:outline-none resize-none font-mono text-sm leading-relaxed"
            placeholder="Type notes here during the meeting..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button onClick={handleSummary} disabled={generating} className="w-full bg-surface hover:bg-surface-raised text-text-secondary font-mono py-3 rounded transition-colors text-sm border border-border hover:border-border-strong disabled:opacity-50">
          {generating ? 'Processing...' : 'Generate Post-Meeting Summary & Follow-ups'}
        </button>

        {/* Past Meetings Toggle */}
        <button
          onClick={() => { setShowPast(!showPast); if (!showPast && pastMeetings.length === 0) fetchPastMeetings(); }}
          className="flex items-center justify-between text-[10px] font-mono text-text-muted hover:text-text-secondary px-2 py-1"
        >
          Past Meetings
          {showPast ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {showPast && pastMeetings.length > 0 && (
          <div className="space-y-2">
            {pastMeetings.slice(0, 10).map(m => (
              <div key={m.id} className="p-3 rounded-lg border border-border/30 bg-surface-raised/50">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-text-secondary">{m.topic}</span>
                  <span className="text-[10px] font-mono text-text-muted">{formatDate(m.startTime)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
