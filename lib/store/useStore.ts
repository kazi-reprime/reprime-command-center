import { create } from 'zustand';

// ── Shared Types ─────────────────────────────────────────────────────────────

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
  laneOverride: 'general' | 'investor' | 'staff' | 'family';
  isBlocked: boolean;
  lastMessageAt: string;
  unreadCount?: number;
  lastMessageBody?: string;
  panel?: string;
}

export interface Email {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  score: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  summary?: string;
  start?: string;
  end?: string;
  startTime: string;
  endTime: string;
  meetingUrl?: string | null;
  zoomLink: string | null;
  hangoutLink: string | null;
  location: string | null;
  description?: string | null;
  attendees: { displayName?: string; email?: string; responseStatus?: string }[];
}

// ── Notification Types ───────────────────────────────────────────────────────

export type NotificationType = 'whatsapp' | 'email' | 'zoom' | 'task' | 'nora' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  time: Date;
  read: boolean;
  action?: string;
}

// ── Nora AI Types ────────────────────────────────────────────────────────────

export type NoraStatus = 'idle' | 'thinking' | 'speaking' | 'listening';

export interface NoraMessage {
  sender: 'user' | 'nora';
  text: string;
  agentId?: string;
  timestamp: Date;
}

// ── Task Types ───────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  priority: number;
  projectTag: string | null;
  status: string;
  dueDate?: string;
  assignee?: string;
  zoomLink?: string | null;
}

// ── System Health Types ──────────────────────────────────────────────────────

export interface ServiceHealth {
  label: string;
  status: 'Live' | 'Error' | 'Checking...';
  isOk: boolean;
}

export interface SystemHealth {
  services: ServiceHealth[];
  lastChecked: number;
}

// ── Store Interface ──────────────────────────────────────────────────────────

interface CockpitState {
  // Navigation & Selection
  activeTab: string;
  selectedThreadId: string | null;

  // Communication Data
  threads: Thread[];
  messages: Message[];
  unreadCounts: Record<string, number>;
  activeCrewId: string | null;

  // Email & Calendar
  emails: Email[];
  events: CalendarEvent[];
  hebcalAlert: string | null;
  language: 'EN' | 'HE';

  // Notifications (shared across both experiences)
  notifications: Notification[];

  // Nora AI (shared across both experiences)
  noraStatus: NoraStatus;
  noraMessages: NoraMessage[];

  // Tasks (shared across both experiences)
  tasks: Task[];

  // System Health (shared across both experiences)
  systemHealth: SystemHealth | null;

  // ── Actions ──────────────────────────────────────────────────────────────

  // Navigation
  setActiveTab: (tab: string) => void;
  setSelectedThreadId: (id: string | null) => void;

  // Communications
  setThreads: (threads: Thread[]) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setUnreadCounts: (counts: Record<string, number>) => void;
  setActiveCrewId: (id: string | null) => void;

  // Email & Calendar
  setEmails: (emails: Email[]) => void;
  setEvents: (events: CalendarEvent[]) => void;
  setHebcalAlert: (alert: string | null) => void;
  setLanguage: (lang: 'EN' | 'HE') => void;

  // Notifications
  addNotification: (notif: Notification) => void;
  addNotifications: (notifs: Notification[]) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;

  // Nora AI
  setNoraStatus: (status: NoraStatus) => void;
  addNoraMessage: (msg: NoraMessage) => void;
  setNoraMessages: (msgs: NoraMessage[]) => void;
  updateLastNoraMessage: (text: string) => void;
  removeLastEmptyNoraMessage: () => void;

  // Tasks
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  removeTask: (id: string) => void;
  updateTaskStatus: (id: string, status: string) => void;

  // System Health
  setSystemHealth: (health: SystemHealth) => void;
}

// ── Store Implementation ─────────────────────────────────────────────────────

export const useStore = create<CockpitState>((set) => ({
  // Navigation & Selection
  activeTab: 'Comms',
  selectedThreadId: null,

  // Communication Data
  threads: [],
  messages: [],
  unreadCounts: { whatsapp: 0, imessage: 0, sms: 0 },
  activeCrewId: null,

  // Email & Calendar
  emails: [],
  events: [],
  hebcalAlert: null,
  language: 'EN',

  // Notifications
  notifications: [],

  // Nora AI
  noraStatus: 'idle',
  noraMessages: [{ sender: 'nora', text: 'System online. Ready to execute.', timestamp: new Date() }],

  // Tasks
  tasks: [],

  // System Health
  systemHealth: null,

  // ── Actions ──────────────────────────────────────────────────────────────

  // Navigation
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedThreadId: (id) => set({ selectedThreadId: id }),

  // Communications
  setThreads: (threads) => set({ threads }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setUnreadCounts: (unreadCounts) => set({ unreadCounts }),
  setActiveCrewId: (activeCrewId) => set({ activeCrewId }),

  // Email & Calendar
  setEmails: (emails) => set({ emails }),
  setEvents: (events) => set({ events }),
  setHebcalAlert: (hebcalAlert) => set({ hebcalAlert }),
  setLanguage: (language) => set({ language }),

  // Notifications
  addNotification: (notif) => set((state) => {
    const existing = new Set(state.notifications.map(n => n.id));
    if (existing.has(notif.id)) return state;
    return { notifications: [notif, ...state.notifications].slice(0, 50) };
  }),
  addNotifications: (notifs) => set((state) => {
    const existing = new Set(state.notifications.map(n => n.id));
    const fresh = notifs.filter(n => !existing.has(n.id));
    if (fresh.length === 0) return state;
    return { notifications: [...fresh, ...state.notifications].slice(0, 50) };
  }),
  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
  })),
  markAllNotificationsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true })),
  })),
  clearNotifications: () => set({ notifications: [] }),

  // Nora AI
  setNoraStatus: (noraStatus) => set({ noraStatus }),
  addNoraMessage: (msg) => set((state) => ({
    noraMessages: [...state.noraMessages, msg],
  })),
  setNoraMessages: (noraMessages) => set({ noraMessages }),
  updateLastNoraMessage: (text) => set((state) => {
    const msgs = [...state.noraMessages]
    const last = msgs[msgs.length - 1]
    if (last && last.sender === 'nora') {
      msgs[msgs.length - 1] = { ...last, text }
    }
    return { noraMessages: msgs }
  }),
  removeLastEmptyNoraMessage: () => set((state) => {
    const msgs = [...state.noraMessages]
    const last = msgs[msgs.length - 1]
    // Remove if it's an empty or near-empty Nora placeholder from streaming
    if (last && last.sender === 'nora' && last.text.trim().length < 2) {
      msgs.pop()
    }
    return { noraMessages: msgs }
  }),

  // Tasks
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  removeTask: (id) => set((state) => ({ tasks: state.tasks.filter(t => t.id !== id) })),
  updateTaskStatus: (id, status) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, status } : t),
  })),

  // System Health
  setSystemHealth: (systemHealth) => set({ systemHealth }),
}));
