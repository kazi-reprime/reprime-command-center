'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckSquare, Send, CalendarClock, Loader2, Check } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  priority: number;
  projectTag: string | null;
}

interface NoraMessage {
  sender: 'user' | 'nora';
  text: string;
}

export default function RightFlank() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<NoraMessage[]>([
    { sender: 'nora', text: 'Hello Gideon. Ready to draft your replies. I have retrieved 5 relevant context blocks from Pipedrive deal memories.' },
  ]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingNora, setLoadingNora] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const res = await fetch('/api/ai/nora', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: userPrompt }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { sender: 'nora', text: data.reply }]);
        
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
    <div className="w-[380px] flex flex-col space-y-4 h-[calc(100vh-6rem)]">
      {/* 1. Nora's Desk AI Secretary */}
      <div className="flex-1 bg-[#0c2957] border border-[#FFCC33]/20 rounded-xl p-4 flex flex-col overflow-hidden">
        <div className="flex items-center space-x-2 border-b border-[#FFCC33]/15 pb-3 mb-3">
          <Sparkles className="h-4 w-4 text-[#FFCC33]" />
          <h2 className="text-sm font-bold text-[#FFCC33] uppercase tracking-wider">Nora&apos;s Desk (AI)</h2>
        </div>

        {/* Conversation flow */}
        <div className="flex-1 overflow-y-auto space-y-3 p-1">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-2.5 rounded-lg text-xs leading-normal border ${
                msg.sender === 'nora'
                  ? 'bg-[#08224d] border-white/5 text-gray-200'
                  : 'bg-[#123e80] border-[#FFCC33]/20 text-[#FFCC33] font-mono'
              }`}
            >
              <div className="font-semibold text-[10px] text-gray-400 mb-1">
                {msg.sender === 'nora' ? 'NORA AI' : 'GIDEON'}
              </div>
              <p>{msg.text}</p>
            </div>
          ))}
          {loadingNora && (
            <div className="p-2.5 rounded-lg text-xs bg-[#08224d]/50 border border-white/5 text-gray-400 flex items-center space-x-2">
              <Loader2 className="h-3 w-3 animate-spin text-[#FFCC33]" />
              <span>Querying pgvector and drafting reply...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input prompt */}
        <div className="mt-3 flex items-center bg-[#08224d] border border-[#FFCC33]/20 rounded-lg px-3 py-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePromptSend()}
            disabled={loadingNora}
            placeholder={loadingNora ? 'Processing...' : 'Instruct Nora...'}
            className="bg-transparent text-xs text-white outline-none flex-1 placeholder-gray-500 disabled:opacity-50"
          />
          <button
            onClick={handlePromptSend}
            disabled={loadingNora}
            className="p-1 hover:text-[#FFCC33] text-gray-400 transition disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. Tasks Bucket Panel */}
      <div className="h-80 bg-[#0c2957] border border-[#FFCC33]/20 rounded-xl p-4 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#FFCC33]/15 pb-3 mb-3">
          <div className="flex items-center space-x-2">
            <CheckSquare className="h-4 w-4 text-[#FFCC33]" />
            <h2 className="text-sm font-bold text-[#FFCC33] uppercase tracking-wider">Tasks Bucket</h2>
          </div>
          {loadingTasks ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
          ) : (
            <CalendarClock className="h-4 w-4 text-gray-400" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {tasks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <span className="text-xs text-gray-500">No active tasks. Instruct Nora to assign items.</span>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="p-3 bg-[#08224d] border border-white/5 rounded-lg flex items-center justify-between group">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold text-white leading-snug truncate">{task.title}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-[9px] text-[#FFCC33] font-semibold">#{task.projectTag || 'General'}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.25 rounded ${
                      task.priority === 1 ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      P{task.priority}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleCompleteTask(task.id)}
                  className="h-6 w-6 rounded-full border border-gray-600 flex items-center justify-center hover:border-green-500 hover:bg-green-500/20 text-transparent hover:text-green-400 shrink-0 transition"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

