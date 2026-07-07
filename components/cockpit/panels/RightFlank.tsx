/* eslint-disable */
'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckSquare, Send, CalendarClock, Loader2, Check, Mic, StickyNote } from 'lucide-react';
import { useStore } from '@/lib/store/useStore';
import NotesPanel from './NotesPanel';
import SpeakerButton from '@/components/chat/SpeakerButton';
import { useToast } from '@/lib/contexts/ToastContext';

interface Task {
  id: string;
  title: string;
  priority: number;
  projectTag: string | null;
  status: string;
  zoomLink?: string | null
}

interface SpeechRecognitionEvent extends Event {
  results: {
    [key: number]: {
      [key: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognition extends EventTarget {
  start(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
}

interface PendingApproval {
  id: string;
  action: string;
  description: string;
  agentId: string;
  params?: Record<string, unknown>;
}

interface NoraMessage {
  sender: 'user' | 'nora';
  text: string;
  agentId?: string;
  pendingApprovals?: PendingApproval[];
}

export default function RightFlank() {
  const [prompt, setPrompt] = useState('');
  const { addToast } = useToast();
  const [messages, setMessages] = useState<NoraMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingNora, setLoadingNora] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  
  const { emails, events, threads, selectedThreadId } = useStore();

  // Fetch active tasks
  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (e) {
      console.error('Error fetching tasks:', e);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/nora/history');
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages.map((m: { role: string; content: string }) => ({
              sender: m.role === 'assistant' ? 'nora' : 'user',
              text: m.content
            })));
            return;
          }
        }
      } catch (e) {
        console.error('Failed to fetch Nora history', e);
      }
      // Fallback greeting
      setMessages([{ sender: 'nora', text: 'System online. Ready to execute.' }]);
    };
    fetchHistory();
  }, []);

  // Scroll to bottom of Nora messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handlePromptSend = async () => {
    if (!prompt.trim() || loadingNora) return;

    const userPrompt = prompt.trim();
    setPrompt('');
    setMessages((prev) => [...prev, { sender: 'user', text: userPrompt }]);
    setLoadingNora(true);

    try {
      const contextPayload = {
        emails: emails.slice(0, 10), // Limit context size
        events,
        activeThread: threads.find(t => t.id === selectedThreadId)
      };

      const res = await fetch('/api/ai/nora', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: userPrompt, context: contextPayload }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { sender: 'nora', text: data.reply, agentId: data.agentId }]);
        
        // Handle pending approvals from orchestrator
        if (data.pendingApprovals?.length) {
          setPendingApprovals(prev => [...prev, ...data.pendingApprovals]);
        }
        
        // Play TTS audio
        try {
          const audioRes = await fetch('/api/voice/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: data.reply,
              language: /[א-ת]/.test(data.reply) ? 'he' : 'en'
            }),
          });
          if (audioRes.ok) {
            const audioBlob = await audioRes.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play().catch(e => console.error('Audio playback blocked:', e));
          }
        } catch (audioErr) {
          console.error('Failed to play Nora TTS', audioErr);
        }
        
        // If Nora stored memories or created tasks, reload tasks
        if (data.tasksToCreate && data.tasksToCreate.length > 0) {
          fetchTasks();
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: 'nora', text: 'Sorry, I encountered an issue accessing my cognitive core.' },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: 'nora', text: 'Network exception. Failed to connect to Nora API.' },
      ]);
    } finally {
      setLoadingNora(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: taskId, completed: true }),
      });
      if (res.ok) {
        // Optimistically remove from UI
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    } catch (e) {
      console.error('Failed to complete task:', e);
    }
  };

  return (
    <div className="w-full max-w-[420px] shrink-0 flex flex-col gap-6 min-h-[600px] lg:h-[calc(100vh-8rem)]" style={{ fontFamily: 'inherit' }}>
      {/* 1. Nora's Desk AI Secretary */}
      <div className="flex-[1.5] bg-surface border border-black/5 rounded-[32px] p-6 flex flex-col overflow-hidden shadow-sm shadow-black/[0.02]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-text-primary tracking-tight">Nora's Desk</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Advanced AI Secretary</p>
            </div>
          </div>
          <div className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-lg">
            <span className="text-[10px] text-accent font-black uppercase tracking-wider">Online</span>
          </div>
        </div>

        {/* Conversation flow */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-4 rounded-2xl text-sm leading-relaxed transition-all duration-300 ${
                msg.sender === 'nora'
                  ? 'bg-surface-raised border border-border text-text-primary'
                  : 'bg-indigo-500 border border-indigo-400 text-text-primary shadow-lg shadow-indigo-500/20'
              }`}
            >
              <div className={`text-[10px] font-black uppercase tracking-widest mb-2 flex justify-between items-center ${
                msg.sender === 'nora' ? 'text-text-muted' : 'text-text-primary/60'
              }`}>
                <span>{msg.sender === 'nora' ? (msg.agentId ? `Nora → ${msg.agentId}` : 'Nora Intelligence') : 'Gideon Prime'}</span>
                {msg.sender === 'nora' && (
                  <div className="scale-75 origin-right">
                    <SpeakerButton text={msg.text} />
                  </div>
                )}
              </div>
              <p className="font-medium">{msg.text}</p>
            </div>
          ))}
          {loadingNora && (
            <div className="p-4 rounded-2xl bg-surface-raised/50 border border-border flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Synthesizing Data...</span>
            </div>
          )}
          {/* Pending Approvals */}
          {pendingApprovals.length > 0 && (
            <div className="space-y-2">
              {pendingApprovals.map((approval) => (
                <div key={approval.id} className="p-3 rounded-xl border border-warning/30 bg-warning/5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-warning mb-1.5 flex items-center gap-1">
                    <StickyNote className="h-3 w-3" />
                    Pending Approval
                  </div>
                  <p className="text-xs text-text-secondary mb-2">{approval.description}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/nora/approve', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ actionId: approval.id, approved: true }),
                          });
                          if (res.ok) {
                            setPendingApprovals(prev => prev.filter(a => a.id !== approval.id));
                            setMessages(prev => [...prev, { sender: 'nora', text: `✅ Action approved and executed.` }]);
                            addToast('Action approved', 'success');
                          }
                        } catch { addToast('Approval failed', 'error'); }
                      }}
                      className="px-3 py-1.5 bg-success/10 border border-success/30 text-success text-[10px] font-black uppercase rounded-lg hover:bg-success/20 transition-colors flex items-center gap-1"
                    >
                      <Check className="h-3 w-3" /> Approve
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await fetch('/api/nora/approve', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ actionId: approval.id, approved: false }),
                          });
                          setPendingApprovals(prev => prev.filter(a => a.id !== approval.id));
                          addToast('Action rejected', 'info');
                        } catch { addToast('Rejection failed', 'error'); }
                      }}
                      className="px-3 py-1.5 bg-error/10 border border-error/30 text-error text-[10px] font-black uppercase rounded-lg hover:bg-error/20 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input prompt */}
        <div className="mt-6 relative">
          <div className="flex items-center bg-surface-raised border border-border/50 rounded-2xl px-2 py-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <button
              onClick={() => {
                if (isListening) return;
                setIsListening(true);
                const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                if (SpeechRecognition) {
                  const recognition = new SpeechRecognition();
                  recognition.onresult = (event: any) => {
                    setPrompt((prev) => prev + (prev ? ' ' : '') + event.results[0][0].transcript);
                    setIsListening(false);
                  };
                  recognition.onerror = () => setIsListening(false);
                  recognition.onend = () => setIsListening(false);
                  recognition.start();
                } else {
                  addToast('Speech recognition not supported.', 'warning');
                  setIsListening(false);
                }
              }}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isListening ? 'text-error bg-error/10' : 'text-text-muted hover:bg-surface hover:text-accent'}`}
            >
              <Mic className="h-5 w-5" />
            </button>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePromptSend()}
              disabled={loadingNora}
              placeholder={loadingNora ? 'Processing...' : 'Instruct Nora...'}
              className="bg-transparent text-sm font-semibold text-text-primary px-3 outline-none flex-1 placeholder:text-text-muted"
            />
            <button
              onClick={handlePromptSend}
              disabled={loadingNora}
              className="w-10 h-10 flex items-center justify-center bg-indigo-500 text-text-primary rounded-xl shadow-lg shadow-indigo-500/25 hover:bg-indigo-600 transition-all disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Secondary Panel (Tasks / Notes) */}
      <div className="flex-1 bg-surface border border-black/5 rounded-[32px] p-6 flex flex-col overflow-hidden shadow-sm shadow-black/[0.02]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex bg-surface-raised p-1 rounded-2xl gap-1">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                activeTab === 'tasks' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Tasks
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                activeTab === 'notes' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Notes
            </button>
          </div>
          {activeTab === 'tasks' && (
            loadingTasks ? (
              <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center text-text-muted">
                <CalendarClock className="h-4 w-4" />
              </div>
            )
          )}
        </div>

        {activeTab === 'tasks' ? (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
            {tasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                <div className="w-12 h-12 rounded-2xl bg-surface-raised flex items-center justify-center mb-3">
                  <CheckSquare className="h-5 w-5 text-text-muted" />
                </div>
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Queue Clear</span>
              </div>
            ) : (
              <>
                {['open', 'pending', 'snoozed', 'parked'].map(statusGroup => {
                  const groupTasks = tasks.filter(t => t.status === statusGroup);
                  if (groupTasks.length === 0) return null;
                  return (
                    <div key={statusGroup} className="space-y-2">
                      <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-1 mb-3">{statusGroup}</h3>
                      {groupTasks.map((task) => (
                        <div key={task.id} className="group p-4 bg-surface-raised border border-border/50 rounded-2xl hover:bg-surface hover:border-emerald-500/20 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-black text-text-primary block truncate tracking-tight mb-1">{task.title}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-accent uppercase tracking-widest bg-accent/10 px-1.5 py-0.5 rounded">#{task.projectTag || 'Gen'}</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${
                                task.priority === 1 ? 'bg-red-500/10 text-error' : 'bg-surface-hover/50 text-text-muted'
                              }`}>
                                Priority {task.priority}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleCompleteTask(task.id)}
                            className="w-8 h-8 rounded-xl border-2 border-border flex items-center justify-center group-hover:border-emerald-500 group-hover:bg-success/10 text-transparent group-hover:text-success transition-all duration-300"
                          >
                            <Check className="h-4 w-4" strokeWidth={4} />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <NotesPanel />
          </div>
        )}
      </div>
    </div>
  );
}

