import { create } from 'zustand';

export interface Message {
  id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: string;
  createdAt: string;
}

export interface Thread {
  id: string;
  contactPhone: string;
  contactName?: string;
  channel: 'whatsapp' | 'imessage' | 'sms';
  laneOverride: 'general' | 'investor' | 'staff';
  isBlocked: boolean;
  lastMessageAt: string;
  unreadCount?: number;
  lastMessageBody?: string;
  panel?: string;
}

interface CockpitState {
  activeTab: string;
  selectedThreadId: string | null;
  threads: Thread[];
  messages: Message[];
  unreadCounts: Record<string, number>;
  activeCrewId: string | null;

  emails: any[];
  events: any[];
  hebcalAlert: string | null;
  language: 'EN' | 'HE';

  setActiveTab: (tab: string) => void;
  setSelectedThreadId: (id: string | null) => void;
  setThreads: (threads: Thread[]) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setUnreadCounts: (counts: Record<string, number>) => void;
  setActiveCrewId: (id: string | null) => void;
  setEmails: (emails: any[]) => void;
  setEvents: (events: any[]) => void;
  setHebcalAlert: (alert: string | null) => void;
  setLanguage: (lang: 'EN' | 'HE') => void;
}

// Global state store for real-time communications and cockpit parameters
export const useStore = create<CockpitState>((set) => ({
  activeTab: 'Comms',
  selectedThreadId: null,
  threads: [],
  messages: [],
  unreadCounts: { whatsapp: 0, imessage: 0, sms: 0 },
  activeCrewId: null,
  emails: [],
  events: [],
  hebcalAlert: null,
  language: 'EN',

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedThreadId: (id) => set({ selectedThreadId: id }),
  setThreads: (threads) => set({ threads }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setUnreadCounts: (unreadCounts) => set({ unreadCounts }),
  setActiveCrewId: (activeCrewId) => set({ activeCrewId }),
  setEmails: (emails) => set({ emails }),
  setEvents: (events) => set({ events }),
  setHebcalAlert: (hebcalAlert) => set({ hebcalAlert }),
  setLanguage: (language) => set({ language }),
}));
