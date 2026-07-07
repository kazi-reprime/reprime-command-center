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
    <div className="flex flex-col h-full bg-surface text-text-primary border-r border-border overflow-y-auto">
      <div className="sticky top-0 bg-surface/90 backdrop-blur-md border-b border-border p-4 z-10 flex justify-between items-center">
        <div>
          <h2 className="text-xs font-mono text-text-muted uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-accent rounded-full"></span>
            People Directory
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Unified Contact Records
          </p>
        </div>
        <input 
          type="text" 
          placeholder="Search memory..."
          className="bg-surface border border-border text-sm px-3 py-1.5 rounded focus:outline-none focus:border-border-strong font-mono w-48"
        />
      </div>

      <div className="p-4 grid gap-4 grid-cols-1">
        {people.map(p => (
          <div key={p.id} className="border border-border rounded-lg bg-surface p-4 hover:border-border-strong transition-colors cursor-pointer flex gap-4 items-center">
            <div className="w-10 h-10 rounded bg-surface-raised flex items-center justify-center font-semibold text-text-secondary">
              {p.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-text-primary">{p.name}</h3>
              <p className="text-xs text-text-muted font-mono mt-0.5">{p.role}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-surface-raised text-text-secondary">
                {p.relationship}
              </span>
              <span className="text-xs text-text-muted font-mono">{p.lastContact}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
