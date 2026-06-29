'use client';

import { useState, useEffect } from 'react';
import { useStore, Thread, Message } from '@/lib/store/useStore';
import { Send, Mic, Phone, FolderArchive, Trash2, Search, User, Sparkles, Loader2 } from 'lucide-react';
import { supabaseClient } from '@/lib/supabaseClient';

export default function CommsPanel() {
  const { 
    threads, 
    setThreads, 
    selectedThreadId, 
    setSelectedThreadId, 
    messages, 
    setMessages, 
    addMessage,
    setUnreadCounts
  } = useStore();

  const [activeLane, setActiveLane] = useState<'all' | 'whatsapp' | 'imessage' | 'sms'>('all');
  const [replyText, setReplyText] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch Threads from both 305 and 718 panels
  const fetchThreads = async () => {
    setLoadingThreads(true);
    try {
      const [res305, res718] = await Promise.all([
        fetch('/api/whatsapp/threads?panel=305'),
        fetch('/api/whatsapp/threads?panel=718'),
      ]);

      let allRawThreads: any[] = [];
      if (res305.ok) {
        const data = await res305.json();
        if (data.threads) allRawThreads = [...allRawThreads, ...data.threads];
      }
      if (res718.ok) {
        const data = await res718.json();
        if (data.threads) allRawThreads = [...allRawThreads, ...data.threads];
      }

      // Format & Sort threads by last message timestamp descending
      const formattedThreads: Thread[] = allRawThreads.map((t) => ({
        id: t.id,
        contactPhone: t.phone,
        contactName: t.contact_name || t.phone,
        channel: t.channel_type as 'whatsapp' | 'imessage' | 'sms',
        laneOverride: t.is_investor ? 'investor' : 'general',
        isBlocked: t.is_blocked || false,
        lastMessageAt: t.last_message_at 
          ? new Date(t.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
          : '00:00',
        unreadCount: t.unread_count || 0,
        lastMessageBody: t.last_message_preview || '',
        panel: t.panel,
      })).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

      // Calculate unread counts by channel type
      const counts = { whatsapp: 0, imessage: 0, sms: 0 };
      formattedThreads.forEach((t) => {
        if (t.unreadCount && t.unreadCount > 0) {
          if (t.channel === 'whatsapp') counts.whatsapp += t.unreadCount;
          else if (t.channel === 'imessage') counts.imessage += t.unreadCount;
          else if (t.channel === 'sms') counts.sms += t.unreadCount;
        }
      });
      setUnreadCounts(counts);
      setThreads(formattedThreads);
    } catch (e) {
      console.error('Error fetching threads:', e);
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    fetchThreads();
    // Poll for updates every 60 seconds
    const interval = setInterval(fetchThreads, 60000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Messages for Selected Thread
  useEffect(() => {
    if (!selectedThreadId) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/whatsapp/messages?thread_id=${selectedThreadId}`);
        if (res.ok) {
          const data = await res.json();
          const rawMsgs = data.messages || [];
          const formatted = rawMsgs.map((m: any) => ({
            id: m.id,
            body: m.body || '',
            direction: m.direction === 'out' ? 'outbound' : 'inbound',
            status: m.status || 'read',
            createdAt: m.sent_at
              ? new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
              : '00:00',
          }));
          setMessages(formatted);
        }
      } catch (e) {
        console.error('Error fetching messages:', e);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();

    // Supabase Realtime client listener for incoming thread bubbles
    const channel = supabaseClient
      .channel(`realtime_messages_${selectedThreadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `thread_id=eq.${selectedThreadId}` },
        (payload) => {
          const newMsg = payload.new as any;
          addMessage({
            id: newMsg.id,
            body: newMsg.body || '',
            direction: newMsg.direction === 'out' ? 'outbound' : 'inbound',
            status: newMsg.status || 'received',
            createdAt: new Date(newMsg.sent_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          });
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [selectedThreadId, setMessages, addMessage]);

  const activeThread = threads.find((t) => t.id === selectedThreadId);

  // 3. Search & Channel filtering
  const filteredThreads = threads.filter((t) => {
    const matchesLane = activeLane === 'all' || t.channel === activeLane;
    const matchesSearch = 
      t.contactPhone.includes(searchQuery) || 
      (t.contactName && t.contactName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.lastMessageBody && t.lastMessageBody.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesLane && matchesSearch;
  });

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return 'border-[#FFCC33] text-[#FFCC33]';
      case 'imessage':
        return 'border-green-500 text-green-400';
      case 'sms':
        return 'border-amber-500 text-amber-400';
      default:
        return 'border-gray-500 text-gray-400';
    }
  };

  const isRTL = (text: string) => {
    const ltrChars = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF\u2C00-\uDFFF\uF900-\uFB1D\uFE00-\uFE6F\uFE70-\uFEFC';
    const rtlChars = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC';
    const rtlDirCheck = new RegExp(`^[^${ltrChars}]*[${rtlChars}]`);
    return rtlDirCheck.test(text);
  };

  const handleSend = async () => {
    if (!replyText.trim() || !selectedThreadId || !activeThread) return;

    const payloadText = replyText;
    setReplyText('');

    try {
      const res = await fetch('/api/whatsapp/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panel: activeThread.panel || '305',
          thread_id: selectedThreadId,
          body: payloadText,
        }),
      });

      if (res.ok) {
        const newMsg = await res.json();
        // Optimistically append sent message
        addMessage({
          id: newMsg.id || String(Math.random()),
          body: newMsg.body || payloadText,
          direction: newMsg.direction === 'out' ? 'outbound' : 'inbound',
          status: newMsg.status || 'Sent',
          createdAt: new Date(newMsg.sent_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        });
      } else {
        const errData = await res.json();
        console.error('Failed to send message:', errData.message);
      }
    } catch (e) {
      console.error('Error sending message:', e);
    }
  };

  return (
    <div className="flex-1 flex bg-[#0c2957] border border-[#FFCC33]/20 rounded-xl overflow-hidden h-[calc(100vh-6rem)]">
      {/* 1. Left side: Thread directory */}
      <div className="w-80 border-r border-[#FFCC33]/20 flex flex-col">
        {/* Search & Tabs */}
        <div className="p-4 border-b border-[#FFCC33]/15 space-y-3">
          <div className="flex items-center bg-[#08224d] border border-[#FFCC33]/20 rounded-lg px-3 py-2">
            <Search className="h-4 w-4 text-gray-400 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="bg-transparent text-xs text-white outline-none w-full"
            />
          </div>

          <div className="flex space-x-1 bg-[#09224d] p-0.5 rounded-lg border border-white/5 text-xs font-semibold">
            {(['all', 'whatsapp', 'imessage', 'sms'] as const).map((lane) => (
              <button
                key={lane}
                onClick={() => setActiveLane(lane)}
                className={`flex-1 py-1 rounded text-center capitalize transition ${
                  activeLane === lane
                    ? 'bg-[#FFCC33] text-[#0E3470]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {lane}
              </button>
            ))}
          </div>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#FFCC33]/10">
          {loadingThreads && threads.length === 0 ? (
            <div className="p-4 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-[#FFCC33] mx-auto" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">
              No conversations found.
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                className={`p-4 cursor-pointer transition flex items-start space-x-3 hover:bg-[#123e80]/30 ${
                  selectedThreadId === thread.id ? 'bg-[#123e80]/50 border-l-2 border-[#FFCC33]' : ''
                }`}
              >
                <div className="p-2 bg-[#09224d] border border-white/10 rounded-full">
                  <User className="h-4 w-4 text-gray-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate">
                      {thread.contactName || thread.contactPhone}
                    </span>
                    <span className="text-[10px] text-gray-400">{thread.lastMessageAt}</span>
                  </div>
                  <p className="text-xs text-gray-300 truncate mt-1">{thread.lastMessageBody}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span
                      className={`text-[8px] font-bold px-1.5 py-0.5 border rounded uppercase ${getChannelColor(
                        thread.channel
                      )}`}
                    >
                      {thread.channel}
                    </span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 bg-[#09224d] rounded text-gray-400 uppercase">
                      {thread.laneOverride}
                    </span>
                    {thread.unreadCount && thread.unreadCount > 0 ? (
                      <span className="bg-[#FFCC33] text-[#0E3470] text-[9px] font-bold px-1.5 rounded-full ml-auto">
                        {thread.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Right side: Message list & Chat compose */}
      <div className="flex-1 flex flex-col bg-[#09224d]/30">
        {selectedThreadId && activeThread ? (
          <>
            {/* Header info */}
            <div className="h-14 border-b border-[#FFCC33]/15 px-6 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-bold text-white">
                  {activeThread.contactName || activeThread.contactPhone}
                </span>
                <span className="text-xs text-gray-400">({activeThread.laneOverride})</span>
              </div>
              <div className="flex items-center space-x-3">
                <button className="p-2 text-gray-400 hover:text-white transition rounded-lg hover:bg-white/5">
                  <Phone className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-white transition rounded-lg hover:bg-white/5">
                  <FolderArchive className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-red-400 transition rounded-lg hover:bg-white/5">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Bubble logs */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingMessages && messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#FFCC33]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  No message history.
                </div>
              ) : (
                messages.map((msg) => {
                  const rtl = isRTL(msg.body);
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-xl px-4 py-2.5 text-xs shadow-md border ${
                          msg.direction === 'outbound'
                            ? 'bg-[#123e80] border-[#FFCC33]/30 text-white rounded-br-none'
                            : 'bg-[#08224d] border-white/5 text-gray-100 rounded-bl-none'
                        }`}
                        dir={rtl ? 'rtl' : 'ltr'}
                      >
                        <p>{msg.body}</p>
                        <div className="flex items-center justify-end space-x-1.5 mt-1">
                          <span className="text-[9px] text-gray-400 font-mono">{msg.createdAt}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Compose reply box */}
            <div className="p-4 border-t border-[#FFCC33]/15 bg-[#09224d]/50">
              <div className="flex items-center space-x-3 bg-[#08224d] border border-[#FFCC33]/20 rounded-xl px-4 py-2.5">
                <button className="p-1.5 text-gray-400 hover:text-[#FFCC33] transition rounded-lg hover:bg-white/5">
                  <Mic className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type a reply in English or Hebrew..."
                  className="bg-transparent text-xs text-white outline-none flex-1 placeholder-gray-500"
                />
                <button
                  onClick={handleSend}
                  className="p-2 bg-[#FFCC33] hover:bg-[#ffe066] text-[#0E3470] rounded-lg transition"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 flex-col space-y-2">
            <Sparkles className="h-8 w-8 text-[#FFCC33]/40" />
            <span className="text-xs">Select a conversation thread to start messaging</span>
          </div>
        )}
      </div>
    </div>
  );
}
