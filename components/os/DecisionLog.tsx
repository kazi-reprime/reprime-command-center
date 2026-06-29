'use client';

import React, { useState } from 'react';

type Decision = {
  id: string;
  title: string;
  description: string;
  decidedBy: string;
  reason: string;
  status: 'active' | 'reversed' | 'parked';
  isReversible: boolean;
  date: string;
};

export default function DecisionLog() {
  const [decisions] = useState<Decision[]>([
    {
      id: '1',
      title: 'Aaron voice is banned',
      description: 'The ElevenLabs "Aaron" voice must not be used for TTS.',
      decidedBy: 'Gideon',
      reason: 'Too robotic and unconvincing for investor communications.',
      status: 'active',
      isReversible: false,
      date: '2026-06-01'
    },
    {
      id: '2',
      title: 'iMessage must not be faked',
      description: 'iMessage integrations require a physical bridge/Mac relay.',
      decidedBy: 'System Architecture',
      reason: 'No native API available from Apple.',
      status: 'active',
      isReversible: true,
      date: '2026-06-15'
    }
  ]);

  return (
    <div className="flex flex-col h-full bg-black text-zinc-200 border-r border-zinc-900 overflow-y-auto">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-zinc-900 p-4 z-10">
        <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
          Immutable Decision Log
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          System policies & historical rulings
        </p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {decisions.map(d => (
          <div key={d.id} className="border border-zinc-800 rounded-lg bg-zinc-950 p-4 relative overflow-hidden">
            {d.status === 'reversed' && (
              <div className="absolute top-0 right-0 p-2 bg-rose-500/20 text-rose-500 text-[10px] uppercase font-mono rounded-bl-lg">
                Reversed
              </div>
            )}
            <h3 className="font-semibold text-white mb-2 pr-16">{d.title}</h3>
            <p className="text-sm text-zinc-300">{d.description}</p>
            
            <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-zinc-600 font-mono uppercase mb-1">Reason</p>
                <p className="text-xs text-zinc-400">{d.reason}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 font-mono uppercase mb-1">Decided By</p>
                <p className="text-xs text-zinc-400">{d.decidedBy} &bull; {d.date}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
