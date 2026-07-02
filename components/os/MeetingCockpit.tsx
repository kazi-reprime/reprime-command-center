'use client';

import React, { useState } from 'react';
import { useToast } from '@/lib/contexts/ToastContext';

type Attendee = {
  name: string;
  role: string;
  present: boolean;
};

export default function MeetingCockpit() {
  const [attendees] = useState<Attendee[]>([
    { name: 'Gideon', role: 'Principal', present: true },
    { name: 'Sarah Chen', role: 'Investor', present: true },
    { name: 'Adi Cohen', role: 'Attorney', present: false }
  ]);

  const [notes, setNotes] = useState('');
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const { addToast } = useToast();

  const handleRegenerateBriefing = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/nora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Generate a quick briefing for my meeting with Sarah Chen based on recent emails.' })
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
        body: JSON.stringify({ prompt: `Generate a post-meeting summary and draft follow-ups based on these notes: ${notes}` })
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

  return (
    <div className="flex flex-col h-full bg-black text-zinc-200 border-r border-zinc-900 overflow-y-auto">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-zinc-900 p-4 z-10 flex justify-between items-center">
        <div>
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
            Live Meeting Cockpit
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Bay Valley Q3 Review &bull; Zoom
          </p>
        </div>
        <button className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3 py-1.5 rounded transition-colors font-mono font-semibold">
          End Meeting
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Attendees */}
        <div className="border border-zinc-800 rounded-lg bg-zinc-950 p-4">
          <h3 className="text-[10px] uppercase font-mono text-zinc-500 mb-3">Attendees</h3>
          <div className="flex flex-wrap gap-2">
            {attendees.map(a => (
              <div key={a.name} className={`px-2 py-1 rounded border text-xs font-mono flex items-center gap-2 ${
                a.present ? 'border-emerald-900/50 bg-emerald-900/10 text-emerald-400' : 'border-zinc-800 bg-zinc-900 text-zinc-500'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${a.present ? 'bg-emerald-500' : 'bg-zinc-600'}`}></div>
                {a.name} <span className="text-zinc-600">({a.role})</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Briefing */}
        <div className="border border-indigo-900/50 bg-indigo-900/5 rounded-lg p-4">
          <h3 className="text-[10px] uppercase font-mono text-indigo-500 mb-2 flex justify-between">
            Nora Briefing
            <button onClick={handleRegenerateBriefing} disabled={generating} className="text-zinc-500 hover:text-indigo-400 disabled:opacity-50">
              {generating ? 'Regenerating...' : 'Regenerate'}
            </button>
          </h3>
          {briefingText ? (
            <p className="text-sm text-zinc-300">{briefingText}</p>
          ) : (
            <ul className="text-sm text-zinc-300 space-y-2 pl-4 list-disc marker:text-indigo-500">
              <li>Sarah invested $2M in Downtown Plaza last year.</li>
              <li>Last time you spoke, she was looking for more Florida retail exposure.</li>
              <li><strong>Action:</strong> Pitch the anchor tenant expansion for Bay Valley.</li>
            </ul>
          )}
        </div>

        {/* Live Notes / Transcription */}
        <div className="border border-zinc-800 rounded-lg bg-zinc-950 p-4 flex-1 flex flex-col min-h-[250px]">
          <h3 className="text-[10px] uppercase font-mono text-zinc-500 mb-3 flex justify-between items-center">
            Live Notes
            <button className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              Start Transcription
            </button>
          </h3>
          <textarea 
            className="flex-1 bg-transparent border-none text-zinc-300 focus:outline-none resize-none font-mono text-sm leading-relaxed"
            placeholder="Type notes here, or start live voice transcription..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          ></textarea>
        </div>

        <button onClick={handleSummary} disabled={generating} className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono py-3 rounded transition-colors text-sm border border-zinc-800 hover:border-zinc-700 disabled:opacity-50">
          {generating ? 'Processing...' : 'Generate Post-Meeting Summary & Draft Follow-ups'}
        </button>
      </div>
    </div>
  );
}
