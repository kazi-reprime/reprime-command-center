'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2, Mail } from 'lucide-react';

interface EmailModalProps {
  emailId: string;
  onClose: () => void;
}

export default function EmailModal({ emailId, onClose }: EmailModalProps) {
  const [emailData, setEmailData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmail = async () => {
      try {
        const res = await fetch(`/api/gmail/${emailId}`);
        if (!res.ok) throw new Error('Failed to fetch email details');
        const data = await res.json();
        setEmailData(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEmail();
  }, [emailId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0c2957] border border-[#FFCC33]/30 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#FFCC33]/20 bg-[#08224d] rounded-t-xl">
          <div className="flex items-center space-x-3">
            <Mail className="h-5 w-5 text-[#FFCC33]" />
            <h2 className="text-white font-bold text-lg">Email Details</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${emailId}`, '_blank')}
              className="px-3 py-1.5 bg-[#FFCC33]/10 text-[#FFCC33] hover:bg-[#FFCC33]/20 rounded transition text-xs font-bold uppercase tracking-wide border border-[#FFCC33]/20 flex items-center space-x-1"
            >
              <span>Open in Gmail</span>
              <ExternalLink className="h-3 w-3" />
            </button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition rounded hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#09224d]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#FFCC33]" />
              <p className="text-gray-400 text-sm">Fetching email contents...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-3 text-red-400">
              <p>Error: {error}</p>
            </div>
          ) : emailData ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h1 className="text-xl font-bold text-white leading-tight">{emailData.subject}</h1>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                    {new Date(emailData.date).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <span className="font-semibold text-gray-400">From:</span>
                  <span>{emailData.from}</span>
                </div>
              </div>
              
              <div className="border-t border-white/10 pt-6">
                {/* 
                  Using dangerouslySetInnerHTML because Gmail HTML parts can be rich.
                  In a strict production env we would sanitize this with DOMPurify.
                */}
                <div 
                  className="prose prose-invert prose-sm max-w-none prose-a:text-[#FFCC33] prose-a:no-underline hover:prose-a:underline"
                  dangerouslySetInnerHTML={{ __html: emailData.body }} 
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
