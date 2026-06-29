'use client';

import React, { useState } from 'react';

type FollowUp = {
  id: string;
  source: string;
  person: string;
  reason: string;
  dueDate: string;
  priority: number;
  status: 'waiting_on_me' | 'waiting_on_them' | 'overdue';
};

export default function FollowUpRadar() {
  const [followUps] = useState<FollowUp[]>([
    {
      id: '1',
      source: 'Email',
      person: 'Adi Cohen',
      reason: 'Awaiting revised lease agreement for Bay Valley',
      dueDate: 'Today',
      priority: 1,
      status: 'waiting_on_them'
    },
    {
      id: '2',
      source: 'WhatsApp',
      person: 'Marcus Levy',
      reason: 'Reply to investor question about Q3 distributions',
      dueDate: 'Overdue',
      priority: 2,
      status: 'overdue'
    },
    {
      id: '3',
      source: 'Meeting',
      person: 'Sarah Chen',
      reason: 'Send wiring instructions',
      dueDate: 'Tomorrow',
      priority: 1,
      status: 'waiting_on_me'
    }
  ]);

  const getStatusDisplay = (status: FollowUp['status']) => {
    switch (status) {
      case 'overdue': return <span className="text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded text-[10px] uppercase font-mono">Overdue</span>;
      case 'waiting_on_me': return <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] uppercase font-mono">Waiting on me</span>;
      case 'waiting_on_them': return <span className="text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded text-[10px] uppercase font-mono">Waiting on them</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-zinc-200 border-r border-zinc-900 overflow-y-auto">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-zinc-900 p-4 z-10 flex justify-between items-center">
        <div>
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
            Follow-Up Radar
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Action Items & Blockers
          </p>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {followUps.map(f => (
          <div key={f.id} className={`border rounded-lg bg-zinc-950 p-4 transition-colors cursor-pointer ${
            f.status === 'overdue' ? 'border-rose-900/50 hover:border-rose-700' : 'border-zinc-800 hover:border-zinc-700'
          }`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-mono uppercase bg-zinc-900 px-1.5 py-0.5 rounded">{f.source}</span>
                <span className="text-sm font-semibold text-white">{f.person}</span>
              </div>
              <div>{getStatusDisplay(f.status)}</div>
            </div>
            
            <p className="text-sm text-zinc-300 mt-2">{f.reason}</p>
            
            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-xs py-1.5 rounded text-zinc-300 transition-colors">
                Draft Reply
              </button>
              <button className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-xs py-1.5 rounded text-zinc-300 transition-colors">
                Mark Done
              </button>
              <button className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-xs py-1.5 rounded text-zinc-300 transition-colors">
                Snooze
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
