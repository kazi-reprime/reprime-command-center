/**
 * System-wide logging for integration operations.
 * Maintains an in-memory ring buffer of the last 200 log entries.
 * All integration operations (email, WhatsApp, AI, CRM, etc.) log through here.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string; // 'email' | 'whatsapp' | 'ai' | 'crm' | 'automation' | 'database' | 'system'
  message: string;
  details?: Record<string, unknown>;
}

const MAX_ENTRIES = 200;
const logs: SystemLogEntry[] = [];

function addLog(level: LogLevel, category: string, message: string, details?: Record<string, unknown>) {
  const entry: SystemLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    details,
  };
  logs.unshift(entry); // newest first
  if (logs.length > MAX_ENTRIES) logs.length = MAX_ENTRIES;
  // Also log to console for server-side visibility
  const prefix = `[${category.toUpperCase()}]`;
  if (level === 'error') console.error(prefix, message, details || '');
  else if (level === 'warn') console.warn(prefix, message, details || '');
  else console.log(prefix, message);
}

export function logInfo(category: string, message: string, details?: Record<string, unknown>) {
  addLog('info', category, message, details);
}

export function logWarning(category: string, message: string, details?: Record<string, unknown>) {
  addLog('warn', category, message, details);
}

export function logError(category: string, message: string, details?: Record<string, unknown>) {
  addLog('error', category, message, details);
}

export function getRecentLogs(limit = 50, category?: string): SystemLogEntry[] {
  const filtered = category ? logs.filter(l => l.category === category) : logs;
  return filtered.slice(0, limit);
}

export function clearLogs() {
  logs.length = 0;
}
