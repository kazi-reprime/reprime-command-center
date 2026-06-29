'use client';

import React, { useState } from 'react';

type NoiseItem = {
  id: string;
  sender: string;
  subject: string;
  channel: string;
  classification: string;
  risk: 'low' | 'medium' | 'high';
  date: string;
};

export default function SpamShield() {
  const [items] = useState<NoiseItem[]>([
    {
      id: '1',
      sender: 'Funding Fast <offers@fundfast.com>',
      subject: 'Pre-approved for $5M CRE loan',
      channel: 'Email',
      classification: 'funding_spam',
      risk: 'low',
      date: '10 mins ago'
    },
    {
      id: '2',
      sender: '+1 (800) 555-0199',
      subject: 'Verify your WhatsApp account',
      channel: 'SMS',
      classification: 'verification_code',
      risk: 'high',
      date: '1 hour ago'
    },
    {
      id: '3',
      sender: 'political.campaign@donors.org',
      subject: 'Urgent: Midnight Deadline',
      channel: 'Email',
      classification: 'political_spam',
      risk: 'low',
      date: '2 hours ago'
    }
  ]);

  return (
    <div className="flex flex-col h-full bg-black text-zinc-200 border-r border-zinc-900 overflow-y-auto">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-zinc-900 p-4 z-10">
        <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 bg-zinc-600 rounded-full"></span>
          Noise Killer / Spam Shield
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          AI-filtered noise & verification codes
        </p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {items.map(item => (
          <div key={item.id} className="border border-zinc-800 rounded-lg bg-zinc-950 p-4 hover:border-zinc-700 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-mono uppercase bg-zinc-900 px-1.5 py-0.5 rounded">{item.channel}</span>
                <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                  item.classification === 'verification_code' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {item.classification.replace('_', ' ')}
                </span>
              </div>
              <span className="text-xs text-zinc-600 font-mono">{item.date}</span>
            </div>
            
            <h3 className={`font-semibold ${item.classification === 'verification_code' ? 'text-white' : 'text-zinc-500 line-through'}`}>
              {item.sender}
            </h3>
            <p className="text-sm text-zinc-400 mt-1">{item.subject}</p>
            
            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-xs py-1.5 rounded text-zinc-300 transition-colors">
                Restore to Inbox
              </button>
              <button className="flex-1 bg-rose-900/20 hover:bg-rose-900/40 text-xs py-1.5 rounded text-rose-400 transition-colors">
                Block Sender
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
