'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store/useStore';
import { Clock, Shield, Sparkles, Presentation, Layers, Users } from 'lucide-react';
import BriefingModal from '@/components/briefing/BriefingModal';
import ContactsModal from '@/components/cockpit/modals/ContactsModal';
import { ThemeSwitcher } from '@/components/cockpit/ThemeSwitcher';

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
  }, [setActiveCrewId, setHebcalAlert, activeCrewId]);

  useEffect(() => {
    if (language === 'HE') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  }, [language]);

  return (
    <header className="h-14 bg-surface border-b border-border px-6 flex items-center justify-between text-text-primary select-none z-50 relative">
      {/* Brand Logo & active status */}
      <div className="flex items-center space-x-3">
        <Sparkles className="h-5 w-5 text-accent" />
        <span className="text-xl font-extrabold tracking-wider text-text-primary font-sans">
          REPRIME
        </span>
        <span className="text-xs uppercase px-2 py-0.5 bg-surface-hover border border-border rounded text-text-secondary font-semibold">
          COCKPIT v0.3
        </span>
      </div>

      {/* Center metadata and time */}
      <div className="flex items-center space-x-6 text-sm text-text-secondary">
        <div className="flex items-center space-x-2 bg-surface-raised px-3 py-1 rounded-lg border border-border-glass">
          <Clock className="h-4 w-4 text-accent" />
          <span className="font-mono text-text-primary font-bold">{timeString || '00:00:00'}</span>
        </div>

        {/* Shabbat Alert Helper Indicator */}
        {hebcalAlert && (
          <div className="text-[10px] font-bold px-2 py-1 bg-status-warning/10 border border-status-warning/30 rounded text-status-warning flex items-center space-x-1">
            <span>{hebcalAlert}</span>
          </div>
        )}
      </div>

      {/* Right actions & crew picker */}
      <div className="flex items-center space-x-4">
        {/* Unread summaries */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-status-warning/10 border border-status-warning/20 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-status-warning"></span>
            <span>WA: <span className="font-bold text-status-warning">{unreadCounts.whatsapp}</span></span>
          </div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-status-success/10 border border-status-success/20 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success"></span>
            <span>iMessage: <span className="font-bold text-status-success">{unreadCounts.imessage}</span></span>
          </div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-status-info/10 border border-status-info/20 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-status-info"></span>
            <span>SMS: <span className="font-bold text-status-info">{unreadCounts.sms}</span></span>
          </div>
        </div>

        {/* Language Toggle */}
        <button
          onClick={() => setLanguage(language === 'EN' ? 'HE' : 'EN')}
          className="flex items-center justify-center h-7 w-9 bg-surface-raised hover:bg-surface-hover border border-border rounded transition text-xs font-bold text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          {language}
        </button>

        {/* Identity selector dropdown */}
        <div className="flex items-center space-x-2 bg-surface-raised border border-border rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-focus transition-shadow">
          <Shield className="h-4 w-4 text-text-secondary" />
          <select
            value={activeCrewId || ''}
            onChange={(e) => setActiveCrewId(e.target.value)}
            className="bg-transparent text-xs text-text-primary font-semibold outline-none cursor-pointer border-none"
          >
            {crewMembers.map((member) => (
              <option key={member.email} value={member.email} className="bg-surface text-text-primary">
                {member.display_name} ({member.role})
              </option>
            ))}
          </select>
        </div>

        <button 
          onClick={() => setShowContacts(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface-raised hover:bg-surface-hover border border-border rounded text-text-secondary transition focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <Users className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Contacts</span>
        </button>

        <div className="flex items-center space-x-1">
          <button 
            onClick={() => setBriefingMode('morning')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface-raised hover:bg-surface-hover border border-border rounded-l text-text-secondary transition focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <Presentation className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Morning</span>
          </button>
          <button 
            onClick={() => setBriefingMode('evening')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface-raised hover:bg-surface-hover border border-border border-l-0 rounded-r text-text-secondary transition focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <span className="text-xs font-bold uppercase tracking-wider">Evening</span>
          </button>
        </div>

        <a 
          href="https://portal.reprimeterminal.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface-raised hover:bg-surface-hover border border-border rounded text-text-secondary transition focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <Layers className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Reprime Portal</span>
        </a>

        <ThemeSwitcher />
      </div>

      <BriefingModal open={briefingMode !== null} mode={briefingMode || 'morning'} onClose={() => setBriefingMode(null)} />
      <ContactsModal open={showContacts} onClose={() => setShowContacts(false)} />
    </header>
  );
}
