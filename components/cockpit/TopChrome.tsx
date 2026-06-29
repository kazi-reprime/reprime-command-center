'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store/useStore';
import { Clock, Shield, Sparkles, Presentation, Layers, Users } from 'lucide-react';
import BriefingModal from '@/components/briefing/BriefingModal';
import ContactsModal from '@/components/cockpit/modals/ContactsModal';
import Link from 'next/link';

export interface CrewMember {
  email: string;
  display_name: string;
  role: string;
}

export default function TopChrome() {
  const { activeCrewId, setActiveCrewId, unreadCounts, hebcalAlert, setHebcalAlert, language, setLanguage } = useStore();
  const [timeString, setTimeString] = useState('');
  const [briefingMode, setBriefingMode] = useState<'morning' | 'evening' | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);

  useEffect(() => {
    const fetchCrew = async () => {
      try {
        const res = await fetch('/api/crew');
        if (res.ok) {
          const data = await res.json();
          if (data.crew && data.crew.length > 0) {
            setCrewMembers(data.crew);
            if (!activeCrewId) {
              setActiveCrewId(data.crew[0].email);
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch crew:', e);
      }
    };
    fetchCrew();

    const timer = setInterval(() => {
      setTimeString(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);

    const fetchHebcal = async () => {
      try {
        const res = await fetch('/api/hebcal');
        if (res.ok) {
          const data = await res.json();
          if (data.isShabbat) {
            setHebcalAlert(`SHABBAT ACTIVE - System restricted`);
          } else if (data.nextCandleLighting) {
            const candleTime = new Date(data.nextCandleLighting);
            const now = new Date();
            if (candleTime.getTime() - now.getTime() < 24 * 60 * 60 * 1000 && candleTime.getTime() > now.getTime()) {
              setHebcalAlert(`SHABBAT INCOMING: ${candleTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
            } else {
              setHebcalAlert(data.parsha ? `Parsha: ${data.parsha}` : null);
            }
          } else {
            setHebcalAlert(null);
          }
        }
      } catch (e) {
        console.error('Hebcal error:', e);
      }
    };
    
    fetchHebcal();
    const hebcalTimer = setInterval(fetchHebcal, 3600000);

    return () => {
      clearInterval(timer);
      clearInterval(hebcalTimer);
    };
  }, [setActiveCrewId, setHebcalAlert]);

  useEffect(() => {
    if (language === 'HE') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  }, [language]);

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
        {hebcalAlert && (
          <div className="text-[10px] font-bold px-2 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded text-[#F59E0B] flex items-center space-x-1">
            <span>{hebcalAlert}</span>
          </div>
        )}
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

        {/* Language Toggle */}
        <button
          onClick={() => setLanguage(language === 'EN' ? 'HE' : 'EN')}
          className="flex items-center justify-center h-7 w-9 bg-[#08224d] hover:bg-white/10 border border-white/20 rounded transition text-xs font-bold text-gray-300 hover:text-white"
        >
          {language}
        </button>

        {/* Identity selector dropdown */}
        <div className="flex items-center space-x-2 bg-[#08224d] border border-white/10 rounded-lg px-3 py-1.5">
          <Shield className="h-4 w-4 text-[#FFCC33]" />
          <select
            value={activeCrewId || ''}
            onChange={(e) => setActiveCrewId(e.target.value)}
            className="bg-transparent text-xs text-white font-semibold outline-none cursor-pointer border-none"
          >
            {crewMembers.map((member) => (
              <option key={member.email} value={member.email} className="bg-[#0E3470]">
                {member.display_name} ({member.role})
              </option>
            ))}
          </select>
        </div>

        <button 
          onClick={() => setShowContacts(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded text-sky-400 transition"
        >
          <Users className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Contacts</span>
        </button>

        <div className="flex items-center space-x-1">
          <button 
            onClick={() => setBriefingMode('morning')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#FFCC33]/10 hover:bg-[#FFCC33]/20 border border-[#FFCC33]/30 rounded-l text-[#FFCC33] transition"
          >
            <Presentation className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Morning</span>
          </button>
          <button 
            onClick={() => setBriefingMode('evening')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-r text-indigo-400 transition"
          >
            <span className="text-xs font-bold uppercase tracking-wider">Evening</span>
          </button>
        </div>

        <a 
          href="https://portal.reprimeterminal.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-400 transition"
        >
          <Layers className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Reprime Portal</span>
        </a>
      </div>

      <BriefingModal open={briefingMode !== null} mode={briefingMode || 'morning'} onClose={() => setBriefingMode(null)} />
      <ContactsModal open={showContacts} onClose={() => setShowContacts(false)} />
    </header>
  );
}
