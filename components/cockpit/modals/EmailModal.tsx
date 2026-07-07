'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2, Mail, Reply, CheckCircle2 } from 'lucide-react';
import ComposeEmailModal from './ComposeEmailModal';
import { useToast } from '@/lib/contexts/ToastContext';

interface EmailModalProps {
  emailId: string;
  onClose: () => void;
}

interface EmailDetails {
  id: string;
  subject: string;
  from: string;
  date: string;
  body: string;
}

export default function EmailModal({ emailId, onClose }: EmailModalProps) {
  const [emailData, setEmailData] = useState<EmailDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchEmail = async () => {
      try {
        const res = await fetch(`/api/gmail/${emailId}`);
        if (!res.ok) throw new Error('Failed to fetch email details');
        const data = await res.json();
        setEmailData(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchEmail();
  }, [emailId]);

  const handleCreateFollowup = async () => {
    setLoadingAction(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Follow-up on email: ${emailData?.subject || ''}`,
          priority: 2,
          projectTag: 'Email Follow-up',
        })
      });
      if (res.ok) addToast('Follow-up task created in your bucket!', 'success');
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/50 backdrop-blur-sm">
      <div className="bg-surface border border-accent/30 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-accent/20 bg-background rounded-t-xl">
          <div className="flex items-center space-x-3">
            <Mail className="h-5 w-5 text-accent" />
            <h2 className="text-text-primary font-bold text-lg">Email Details</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${emailId}`, '_blank')}
              className="px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent/20 rounded transition text-xs font-bold uppercase tracking-wide border border-accent/20 flex items-center space-x-1"
            >
              <span>Open in Gmail</span>
              <ExternalLink className="h-3 w-3" />
            </button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-text-primary transition rounded hover:bg-surface/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-surface-hover">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
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
                  <h1 className="text-xl font-bold text-text-primary leading-tight">{emailData.subject}</h1>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                    {new Date(emailData.date).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <span className="font-semibold text-gray-400">From:</span>
                  <span>{emailData.from}</span>
                </div>
              </div>
              
              <div className="border-t border-border/10 pt-6">
                <div 
                  className="prose prose-invert prose-sm max-w-none prose-a:text-accent prose-a:no-underline hover:prose-a:underline"
                  dangerouslySetInnerHTML={{ __html: emailData.body }} 
                />
              </div>
            </div>
          ) : null}
        </div>
        
        {emailData && (
          <div className="p-4 border-t border-accent/20 bg-background flex items-center justify-between rounded-b-xl">
            <button 
              onClick={handleCreateFollowup}
              disabled={loadingAction}
              className="flex items-center space-x-2 px-4 py-2 bg-surface/5 hover:bg-surface/10 border border-border/10 text-text-primary text-sm font-bold rounded-lg transition disabled:opacity-50"
            >
              {loadingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>Create Follow-up</span>
            </button>
            
            <button 
              onClick={() => setShowCompose(true)}
              className="flex items-center space-x-2 px-5 py-2 bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-bold rounded-lg transition"
            >
              <Reply className="h-4 w-4" />
              <span>Reply</span>
            </button>
          </div>
        )}
      </div>

      {showCompose && emailData && (
        <ComposeEmailModal
          open={showCompose}
          onClose={() => setShowCompose(false)}
          replyToId={emailId}
          replyToSubject={emailData.subject}
          replyToEmail={emailData.from}
        />
      )}
    </div>
  );
}
