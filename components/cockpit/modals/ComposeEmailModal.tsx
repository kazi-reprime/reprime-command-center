'use client';

import { useState } from 'react';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/lib/contexts/ToastContext';

interface ComposeEmailModalProps {
  open: boolean;
  onClose: () => void;
  replyToId?: string; // If populated, this is a reply
  replyToSubject?: string;
  replyToEmail?: string;
}

export default function ComposeEmailModal({ open, onClose, replyToId, replyToSubject, replyToEmail }: ComposeEmailModalProps) {
  const [to, setTo] = useState(replyToEmail || '');
  const [subject, setSubject] = useState(replyToSubject ? (replyToSubject.startsWith('Re:') ? replyToSubject : `Re: ${replyToSubject}`) : '');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [noraLoading, setNoraLoading] = useState(false);
  const { addToast } = useToast();

  if (!open) return null;

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          body,
          replyToId
        })
      });
      if (res.ok) {
        addToast('Email sent successfully.', 'success');
        onClose();
      } else {
        addToast('Failed to send email.', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Network error.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const draftWithNora = async () => {
    setNoraLoading(true);
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: body || subject || 'Draft a professional email' })
      });
      if (res.ok) {
        const data = await res.json();
        setBody(data.draft);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setNoraLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-surface border border-accent/30 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-accent/20 bg-background rounded-t-xl">
          <div className="flex items-center space-x-3">
            <h2 className="text-text-primary font-bold text-base">{replyToId ? 'Reply to Email' : 'New Email'}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-text-primary transition rounded hover:bg-surface/10 shrink-0 ml-2">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 bg-surface-hover/30">
          <div className="flex items-center border border-border/10 rounded-lg bg-background px-3 py-2">
            <span className="text-gray-400 text-xs font-semibold w-12">To:</span>
            <input 
              type="text" 
              value={to} 
              onChange={e => setTo(e.target.value)} 
              disabled={!!replyToId}
              placeholder="recipient@example.com"
              className="bg-transparent text-sm text-text-primary outline-none flex-1 placeholder-gray-600 disabled:opacity-60"
            />
          </div>
          <div className="flex items-center border border-border/10 rounded-lg bg-background px-3 py-2">
            <span className="text-gray-400 text-xs font-semibold w-12">Subj:</span>
            <input 
              type="text" 
              value={subject} 
              onChange={e => setSubject(e.target.value)} 
              disabled={!!replyToId}
              placeholder="Subject line"
              className="bg-transparent text-sm text-text-primary outline-none flex-1 placeholder-gray-600 disabled:opacity-60"
            />
          </div>
          <div className="border border-border/10 rounded-lg bg-background overflow-hidden flex flex-col">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your email here... or click 'Draft with Nora'"
              rows={8}
              className="bg-transparent text-sm text-text-primary outline-none p-3 resize-none placeholder-gray-600 flex-1"
            />
            <div className="bg-surface px-3 py-2 border-t border-border/5 flex items-center justify-between">
              <button 
                onClick={draftWithNora}
                disabled={noraLoading}
                className="flex items-center space-x-1.5 text-xs text-accent hover:text-accent-hover transition disabled:opacity-50 font-semibold"
              >
                {noraLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span>Draft with Nora</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-accent/20 bg-background flex items-center justify-end space-x-3 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-text-primary transition text-sm font-semibold"
          >
            Cancel
          </button>
          <button 
            onClick={handleSend}
            disabled={loading || !to || !subject || !body}
            className="flex items-center space-x-2 px-5 py-2 bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-bold rounded-lg transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>Send Email</span>
          </button>
        </div>
      </div>
    </div>
  );
}
