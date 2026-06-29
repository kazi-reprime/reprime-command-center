'use client';

import React, { useState } from 'react';
import DealsDashboard from '@/components/os/DealsDashboard';
import InvestorMomentum from '@/components/os/InvestorMomentum';
import PeopleDirectory from '@/components/os/PeopleDirectory';
import FollowUpRadar from '@/components/os/FollowUpRadar';
import DecisionLog from '@/components/os/DecisionLog';
import SpamShield from '@/components/os/SpamShield';
import PaymentTracker from '@/components/os/PaymentTracker';
import CampaignLauncher from '@/components/os/CampaignLauncher';
import MeetingCockpit from '@/components/os/MeetingCockpit';
import Link from 'next/link';

export default function OSLayerPage() {
  const [activeModule, setActiveModule] = useState('deals');

  const modules = [
    { id: 'deals', name: 'Deals Command', comp: <DealsDashboard /> },
    { id: 'investors', name: 'Investor CRM', comp: <InvestorMomentum /> },
    { id: 'people', name: 'People Directory', comp: <PeopleDirectory /> },
    { id: 'radar', name: 'Follow-Up Radar', comp: <FollowUpRadar /> },
    { id: 'decisions', name: 'Decision Log', comp: <DecisionLog /> },
    { id: 'spam', name: 'Spam Shield', comp: <SpamShield /> },
    { id: 'payments', name: 'Payments', comp: <PaymentTracker /> },
    { id: 'campaigns', name: 'Campaigns', comp: <CampaignLauncher /> },
    { id: 'meeting', name: 'Meeting Cockpit', comp: <MeetingCockpit /> },
  ];

  return (
    <div className="min-h-screen bg-[#08224d] flex flex-col font-sans overflow-hidden">
      <div className="bg-black/90 text-white p-4 border-b border-zinc-900 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/cockpit" className="text-zinc-500 hover:text-white font-mono text-sm transition-colors">
            &larr; Back to Cockpit
          </Link>
          <h1 className="font-mono text-emerald-500 uppercase tracking-widest text-sm">OS Advanced Modules</h1>
        </div>
        <div className="text-xs font-mono text-zinc-500">Cmd/Ctrl + K for Global Search</div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-black border-r border-zinc-900 p-4 flex flex-col gap-2 overflow-y-auto">
          <h2 className="text-[10px] text-zinc-600 font-mono uppercase mb-2">Modules</h2>
          {modules.map(m => (
            <button
              key={m.id}
              onClick={() => setActiveModule(m.id)}
              className={`text-left px-3 py-2 rounded text-sm font-mono transition-colors ${
                activeModule === m.id ? 'bg-zinc-900 text-white border border-zinc-800' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-950 border border-transparent'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden bg-zinc-950">
          {modules.find(m => m.id === activeModule)?.comp}
        </div>
      </div>
    </div>
  );
}
