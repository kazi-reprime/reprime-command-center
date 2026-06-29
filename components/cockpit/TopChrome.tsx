'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store/useStore';
import { Clock, Shield, Sparkles } from 'lucide-react';

const CREW_MEMBERS = [
  { id: '1', name: 'Gideon Gratsiani', role: 'Owner' },
  { id: '2', name: 'Shirel Ben-Haroush', role: 'Admin' },
  { id: '3', name: 'Steve Philipp', role: 'Agent' },
  { id: '4', name: 'Adir Yonasi', role: 'Agent' },
  { id: '5', name: 'Yaron Sitbon', role: 'Agent' },
  { id: '6', name: 'Chaim Abrahams', role: 'Owner' },
];

export default function TopChrome() {
  const { activeCrewId, setActiveCrewId, unreadCounts } = useStore();
  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    setActiveCrewId('1'); // Default to Gideon
    const timer = setInterval(() => {
      setTimeString(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, [setActiveCrewId]);

  return (
    <header className="h-14 bg-[#0E3470] border-b border-[#FFCC33]/30 px-6 flex items-center justify-between text-white select-none">
      {/* Brand Logo & active status */}
      <div className="flex items-center space-x-3">
        <Sparkles className="h-5 w-5 text-[#FFCC33]" />
        <span className="text-xl font-extrabold tracking-wider text-[#FFCC33] font-sans">
          REPRIME
        </span>
        <span className="text-xs uppercase px-2 py-0.5 bg-[#FFCC33]/15 border border-[#FFCC33]/30 rounded text-[#FFCC33] font-semibold">
          COCKPIT v0.3
        </span>
      </div>

      {/* Center metadata and time */}
      <div className="flex items-center space-x-6 text-sm text-gray-300">
        <div className="flex items-center space-x-2 bg-[#09224d] px-3 py-1 rounded-lg border border-white/5">
          <Clock className="h-4 w-4 text-[#FFCC33]" />
          <span className="font-mono text-white font-bold">{timeString || '00:00:00'}</span>
        </div>

        {/* Shabbat Alert Helper Indicator */}
        <div className="text-xs font-semibold px-2 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded text-[#F59E0B] flex items-center space-x-1">
          <span>SHABBAT MONITOR ACTIVE</span>
        </div>
      </div>

      {/* Right actions & crew picker */}
      <div className="flex items-center space-x-4">
        {/* Unread summaries */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#FFCC33]/10 border border-[#FFCC33]/20 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFCC33]"></span>
            <span>WA: <span className="font-bold text-[#FFCC33]">{unreadCounts.whatsapp}</span></span>
          </div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span>iMessage: <span className="font-bold text-green-400">{unreadCounts.imessage}</span></span>
          </div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>SMS: <span className="font-bold text-amber-400">{unreadCounts.sms}</span></span>
          </div>
        </div>

        {/* Identity selector dropdown */}
        <div className="flex items-center space-x-2 bg-[#08224d] border border-white/10 rounded-lg px-3 py-1.5">
          <Shield className="h-4 w-4 text-[#FFCC33]" />
          <select
            value={activeCrewId || '1'}
            onChange={(e) => setActiveCrewId(e.target.value)}
            className="bg-transparent text-xs text-white font-semibold outline-none cursor-pointer border-none"
          >
            {CREW_MEMBERS.map((member) => (
              <option key={member.id} value={member.id} className="bg-[#0E3470]">
                {member.name} ({member.role})
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
