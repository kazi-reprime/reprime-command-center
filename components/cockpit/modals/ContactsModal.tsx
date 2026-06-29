'use client';

import { useState, useEffect } from 'react';
import { X, Users, RefreshCw, Phone, Shield, Star, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/useStore';

interface ContactsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ContactsModal({ open, onClose }: ContactsModalProps) {
  const { threads, setSelectedThreadId } = useStore();
  const [crew, setCrew] = useState<any[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);
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
        alert('Pipedrive sync complete.');
      } else {
        const err = await res.json();
        if (err.error === 'adapter_offline') {
          alert('Integration Offline: ' + err.message);
        } else {
          alert('Pipedrive sync failed: ' + (err.error || err.message || 'Unknown error'));
        }
      }
    } catch (e) {
      console.error('Pipedrive sync error', e);
      alert('Error connecting to sync endpoint.');
    } finally {
      setSyncing(false);
    }
  };

  const handleMessageClick = (threadId: string) => {
    setSelectedThreadId(threadId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0c2957] border border-[#FFCC33]/30 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#FFCC33]/20 bg-[#08224d] rounded-t-xl">
          <div className="flex items-center space-x-3">
            <Users className="h-5 w-5 text-[#FFCC33]" />
            <h2 className="text-white font-bold text-lg">Contact Directory</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 bg-[#FFCC33]/10 text-[#FFCC33] hover:bg-[#FFCC33]/20 rounded transition text-xs font-bold uppercase tracking-wide border border-[#FFCC33]/20 flex items-center space-x-1 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Pipedrive'}</span>
            </button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition rounded hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 py-2 border-b border-white/10 flex space-x-4 bg-[#09224d]">
          <button 
            onClick={() => setActiveTab('investors')}
            className={`text-xs font-bold uppercase tracking-wide py-2 border-b-2 transition ${activeTab === 'investors' ? 'text-[#FFCC33] border-[#FFCC33]' : 'text-gray-400 border-transparent hover:text-white'}`}
          >
            Investors ({investors.length})
          </button>
          <button 
            onClick={() => setActiveTab('staff')}
            className={`text-xs font-bold uppercase tracking-wide py-2 border-b-2 transition ${activeTab === 'staff' ? 'text-[#FFCC33] border-[#FFCC33]' : 'text-gray-400 border-transparent hover:text-white'}`}
          >
            Staff ({crew.length})
          </button>
          <button 
            onClick={() => setActiveTab('all')}
            className={`text-xs font-bold uppercase tracking-wide py-2 border-b-2 transition ${activeTab === 'all' ? 'text-[#FFCC33] border-[#FFCC33]' : 'text-gray-400 border-transparent hover:text-white'}`}
          >
            All Threads ({allContacts.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 bg-[#09224d]/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#FFCC33]" />
            </div>
          ) : activeTab === 'investors' ? (
            <div className="space-y-1">
              {investors.length === 0 ? <p className="text-gray-400 text-center p-4 text-xs">No investors found.</p> : null}
              {investors.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition border border-transparent hover:border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-[#FFCC33]/20 flex items-center justify-center text-[#FFCC33]">
                      <Star className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{inv.name || inv.contactName}</div>
                      <div className="text-xs text-gray-400">{inv.phone || inv.contactPhone || 'No phone'}</div>
                    </div>
                  </div>
                  {inv.phone && (
                    <button onClick={() => handleMessageClick(inv.phone)} className="p-2 bg-[#FFCC33]/10 text-[#FFCC33] hover:bg-[#FFCC33]/20 rounded-md transition" title="Message">
                      <Phone className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : activeTab === 'staff' ? (
            <div className="space-y-1">
              {crew.length === 0 ? <p className="text-gray-400 text-center p-4 text-xs">No staff found.</p> : null}
              {crew.map((member, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition border border-transparent hover:border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{member.display_name}</div>
                      <div className="text-xs text-gray-400">{member.email} · {member.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {allContacts.length === 0 ? <p className="text-gray-400 text-center p-4 text-xs">No contacts found.</p> : null}
              {allContacts.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition border border-transparent hover:border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-gray-500/20 flex items-center justify-center text-gray-400">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{c.contactName}</div>
                      <div className="text-xs text-gray-400">{c.contactPhone}</div>
                    </div>
                  </div>
                  <button onClick={() => handleMessageClick(c.id)} className="p-2 bg-gray-500/10 text-gray-400 hover:text-white hover:bg-gray-500/20 rounded-md transition" title="Message">
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
