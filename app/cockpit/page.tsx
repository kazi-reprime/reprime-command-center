'use client';

import TopChrome from '@/components/cockpit/TopChrome';
import LeftFlank from '@/components/cockpit/panels/LeftFlank';
import CommsPanel from '@/components/cockpit/panels/CommsPanel';
import RightFlank from '@/components/cockpit/panels/RightFlank';
import GlobalSearch from '@/components/os/GlobalSearch';

export default function CockpitPage() {
  return (
    <div className="min-h-screen bg-[#08224d] flex flex-col font-sans overflow-hidden relative">
      <GlobalSearch />
      
      {/* 1. Header Navigation and Info bar */}
      <TopChrome />

      {/* 2. Three Column Workspace Grid Layout */}
      <main className="flex-1 p-4 flex space-x-4 overflow-hidden h-[calc(100vh-3.5rem)]">
        {/* Left Column: Email Feeds and Calendar Events */}
        <LeftFlank />

        {/* Center Column: WhatsApp, iMessage, and SMS lane console */}
        <CommsPanel />

        {/* Right Column: AI Assistant log entries and Task queues */}
        <RightFlank />
      </main>
    </div>
  );
}
