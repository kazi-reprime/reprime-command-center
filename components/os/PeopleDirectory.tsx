'use client';

import React, { useState } from 'react';

type Person = {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  relationship: string; // 'investor', 'attorney', 'family', 'staff'
  lastContact: string;
};

export default function PeopleDirectory() {
  const [people] = useState<Person[]>([
    {
      id: '1',
      name: 'Adi Cohen',
      role: 'Attorney',
      phone: '+1 212-555-0192',
      email: 'adi@cohenlaw.com',
      relationship: 'attorney',
      lastContact: '2 hours ago'
    },
    {
      id: '2',
      name: 'Sarah Chen',
      role: 'Principal Investor',
      phone: '+1 305-555-1234',
      email: 'schen@capital.com',
      relationship: 'investor',
      lastContact: 'Yesterday'
    },
    {
      id: '3',
      name: 'Nate',
      role: 'Project Manager',
      phone: '+1 718-555-9122',
      email: 'nate@reprime.com',
      relationship: 'staff',
      lastContact: 'Just now'
    }
  ]);

  return (
    <div className="flex flex-col h-full bg-black text-zinc-200 border-r border-zinc-900 overflow-y-auto">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-zinc-900 p-4 z-10 flex justify-between items-center">
        <div>
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            People Directory
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Unified Contact Records
          </p>
        </div>
        <input 
          type="text" 
          placeholder="Search memory..."
          className="bg-zinc-900 border border-zinc-800 text-sm px-3 py-1.5 rounded focus:outline-none focus:border-zinc-700 font-mono w-48"
        />
      </div>

      <div className="p-4 grid gap-4 grid-cols-1">
        {people.map(p => (
          <div key={p.id} className="border border-zinc-800 rounded-lg bg-zinc-950 p-4 hover:border-zinc-700 transition-colors cursor-pointer flex gap-4 items-center">
            <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center font-semibold text-zinc-300">
              {p.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">{p.name}</h3>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">{p.role}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-zinc-800 text-zinc-400">
                {p.relationship}
              </span>
              <span className="text-xs text-zinc-600 font-mono">{p.lastContact}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
