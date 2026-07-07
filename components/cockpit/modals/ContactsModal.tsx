'use client';

import { useState, useEffect } from 'react';
import { X, Users, RefreshCw, Phone, Shield, Star, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/useStore';
import { useToast } from '@/lib/contexts/ToastContext';

interface CrewMember {
  display_name: string;
  email: string;
  role: string;
}

function initials(name: string, phone: string) {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '#';
  }
  return phone.replace(/\D/g, '').slice(-2) || '#';
}

interface Investor {
  id: string;
  name?: string;
  contactName?: string;
  phone?: string;
  contactPhone?: string;
}

interface ContactsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ContactsModal({ open, onClose }: ContactsModalProps) {
  const { threads, setSelectedThreadId } = useStore();
  const { addToast } = useToast();
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'investors' | 'staff' | 'all'>('investors');

  useEffect(() => {
    if (!open) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [crewRes, invRes] = await Promise.all([
          fetch('/api/crew'),
          fetch('/api/investors')
        ]);
        if (crewRes.ok) {
          const data = await crewRes.json();
          setCrew(data.crew || []);
        }
        if (invRes.ok) {
          const data = await invRes.json();
          setInvestors(data.investors || []);
        }
      } catch (e) {
        console.error('Failed to fetch contacts data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();

    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  
  // Deduplicate general threads by phone/name just for display
  const allContacts = threads.filter((v, i, a) => a.findIndex(t => (t.contactPhone === v.contactPhone)) === i);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/pipedrive/bulk-import', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'contact_directory' })
      });
      if (res.ok) {
        addToast('Pipedrive sync complete.', 'success');
      } else {
        const err = await res.json();
        if (err.error === 'adapter_offline') {
          addToast('Integration Offline: ' + err.message, 'warning');
        } else {
          addToast('Pipedrive sync failed: ' + (err.error || err.message || 'Unknown error'), 'error');
        }
      }
    } catch (e) {
      console.error('Pipedrive sync error', e);
      addToast('Error connecting to sync endpoint.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleMessageClick = (threadId: string) => {
    setSelectedThreadId(threadId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4" style={{ fontFamily: 'inherit' }}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={onClose} />
      <div 
        className="relative bg-white border border-black/5 w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300"
        style={{ maxHeight: '85vh', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900">Directory</h2>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Gideon's Core Workforce</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSync}
              disabled={syncing}
              className="h-10 px-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition text-xs font-black uppercase tracking-wider border border-slate-200/50 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing' : 'Sync'}</span>
            </button>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-2xl transition">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-1 mb-4">
          {(['investors', 'staff', 'all'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeTab === tab ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
            >
              {tab === 'investors' ? `Investors (${investors.length})` : tab === 'staff' ? `Staff (${crew.length})` : `All (${allContacts.length})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-6 mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search directory..."
              className="w-full bg-slate-50 border border-slate-200/50 rounded-2xl px-5 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : activeTab === 'investors' ? (
            <div className="grid gap-2">
              {investors.length === 0 && <p className="text-slate-400 text-center py-10 font-bold text-xs uppercase tracking-widest">Database Empty</p>}
              {investors.map((inv: Investor) => (
                <div key={inv.id} className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-500/20 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-black text-xs">
                      {initials(inv.name || inv.contactName || '', inv.phone || '')}
                    </div>
                    <div>
                      <div className="font-black text-slate-900">{inv.name || inv.contactName}</div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{inv.phone || inv.contactPhone || 'No Identifier'}</div>
                    </div>
                  </div>
                  {inv.phone && (
                    <button 
                      onClick={() => handleMessageClick(inv.phone!)} 
                      className="w-10 h-10 flex items-center justify-center bg-slate-50 group-hover:bg-blue-500 group-hover:text-white text-slate-400 rounded-2xl transition-all duration-300 shadow-sm"
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : activeTab === 'staff' ? (
            <div className="grid gap-2">
              {crew.map((member, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-purple-500/20 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-black text-slate-900">{member.display_name}</div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{member.role} · {member.email}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-2">
              {allContacts.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xs">
                      {initials(c.contactName || '', c.contactPhone || '')}
                    </div>
                    <div>
                      <div className="font-black text-slate-900">{c.contactName}</div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{c.contactPhone}</div>
                    </div>
                  </div>
                  <button onClick={() => handleMessageClick(c.id)} className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-400 rounded-2xl transition-all">
                    <Phone className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
