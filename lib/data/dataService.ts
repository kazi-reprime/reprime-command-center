/**
 * Unified data access layer for the Cockpit.
 * Queries database only — NO seed/mock fallbacks.
 * Returns { data, source } so the UI can show data-source warnings.
 */

import { db } from '@/db';
import { contacts, deals, bucketItems, notes } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { logInfo, logWarning, logError } from '@/lib/logging/systemLog';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CockpitClient {
  id: string; name: string; business: string; email: string; phone: string;
  status: 'active' | 'onboarding' | 'paused' | 'churned';
  source: string; notes: string; revenue: number;
  nextFollowUp: string | null; createdAt: string;
}

export interface CockpitLead {
  id: string; name: string; business: string; email: string; phone: string;
  stage: 'new' | 'contacted' | 'qualified' | 'demo_scheduled' | 'proposal_sent' | 'negotiation' | 'won' | 'lost';
  score: number; source: string; value: number; probability: number;
  nextAction: string; lostReason?: string; createdAt: string;
}

export interface CockpitTask {
  id: string; title: string; priority: 1 | 2 | 3 | 4 | 5;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  dueDate: string | null; owner: string; relatedTo: string | null;
  projectTag: string; checklist: { text: string; done: boolean }[];
  aiNextStep: string | null; createdAt: string;
}

export interface CockpitAgent {
  id: string; name: string; type: string; status: 'running' | 'paused' | 'error';
  currentTask: string | null; completedToday: number; errorCount: number;
  lastActive: string; uptime: string;
}

export interface CockpitAutomation {
  id: string; name: string; trigger: string; action: string;
  status: 'active' | 'paused' | 'error';
  executionCount: number; failureCount: number;
  lastRun: string | null; configWarning: string | null;
}

export interface CockpitMessage {
  id: string; from: string; channel: string; subject: string;
  preview: string; timestamp: string; isRead: boolean;
  priority: 'high' | 'normal' | 'low'; aiSuggestion: string | null;
}

export type DataSource = 'database' | 'unavailable';

export interface DataResult<T> {
  data: T;
  source: DataSource;
  warning?: string;
}

async function isDatabaseAvailable(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl === '') return false;
  try {
    await db.select().from(contacts).limit(0);
    return true;
  } catch {
    return false;
  }
}

const NO_DB_WARNING = 'Database not connected. Configure DATABASE_URL to see live data.';

// ── Clients ──────────────────────────────────────────────────────────────────

export async function getClients(): Promise<DataResult<CockpitClient[]>> {
  try {
    if (await isDatabaseAvailable()) {
      const rows = await db.select().from(contacts).orderBy(desc(contacts.createdAt));
      const mapped: CockpitClient[] = rows.map(r => ({
        id: r.id, name: r.name, business: r.company || '',
        email: r.email || '', phone: r.phone || '',
        status: 'active' as const, source: '', notes: '', revenue: 0,
        nextFollowUp: null, createdAt: r.createdAt.toISOString().split('T')[0],
      }));
      logInfo('database', `Fetched ${mapped.length} clients from database`);
      return { data: mapped, source: 'database' };
    }
  } catch (err) {
    logWarning('database', `Database query failed for clients: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { data: [], source: 'unavailable', warning: NO_DB_WARNING };
}

export async function createClient(input: { name: string; business?: string; email?: string; phone?: string; status?: string; source?: string; notes?: string }): Promise<DataResult<CockpitClient>> {
  const newClient: CockpitClient = {
    id: `c${Date.now()}`, name: input.name, business: input.business || '',
    email: input.email || '', phone: input.phone || '',
    status: (input.status as CockpitClient['status']) || 'active',
    source: input.source || '', notes: input.notes || '', revenue: 0,
    nextFollowUp: null, createdAt: new Date().toISOString().split('T')[0],
  };

  try {
    if (await isDatabaseAvailable()) {
      await db.insert(contacts).values({
        orgId: '00000000-0000-0000-0000-000000000001',
        name: input.name, email: input.email || null,
        phone: input.phone || null, company: input.business || null,
      });
      logInfo('database', `Created client "${input.name}" in database`);
      return { data: newClient, source: 'database' };
    }
  } catch (err) {
    logWarning('database', `Failed to create client in DB: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { data: newClient, source: 'unavailable', warning: NO_DB_WARNING };
}

// ── Leads ────────────────────────────────────────────────────────────────────

export async function getLeads(): Promise<DataResult<CockpitLead[]>> {
  try {
    if (await isDatabaseAvailable()) {
      const rows = await db.select().from(deals).orderBy(desc(deals.createdAt));
      const mapped: CockpitLead[] = rows.map(r => ({
        id: r.id, name: r.name, business: r.address || '',
        email: '', phone: '',
        stage: (r.status as CockpitLead['stage']) || 'new',
        score: r.riskScore || 50, source: '', value: r.purchasePrice || 0,
        probability: 50, nextAction: 'Review deal details',
        createdAt: r.createdAt.toISOString().split('T')[0],
      }));
      logInfo('database', `Fetched ${mapped.length} leads from database`);
      return { data: mapped, source: 'database' };
    }
  } catch (err) {
    logWarning('database', `Database query failed for leads: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { data: [], source: 'unavailable', warning: NO_DB_WARNING };
}

export async function createLead(input: { name: string; business?: string; email?: string; phone?: string; stage?: string; value?: number; source?: string; nextAction?: string }): Promise<DataResult<CockpitLead>> {
  const newLead: CockpitLead = {
    id: `l${Date.now()}`, name: input.name, business: input.business || '',
    email: input.email || '', phone: input.phone || '',
    stage: (input.stage as CockpitLead['stage']) || 'new',
    score: 50, source: input.source || '', value: input.value || 0,
    probability: 20, nextAction: input.nextAction || '',
    createdAt: new Date().toISOString().split('T')[0],
  };
  return { data: newLead, source: 'unavailable', warning: 'Lead created in session only. Connect database to persist.' };
}

export async function updateLeadStage(id: string, stage: CockpitLead['stage']): Promise<DataResult<CockpitLead | null>> {
  return { data: null, source: 'unavailable', warning: 'Connect database to update lead stages.' };
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasks(): Promise<DataResult<CockpitTask[]>> {
  try {
    if (await isDatabaseAvailable()) {
      const rows = await db.select().from(bucketItems).orderBy(desc(bucketItems.priority));
      const mapped: CockpitTask[] = rows.map(r => ({
        id: r.id, title: r.title,
        priority: (r.priority || 3) as CockpitTask['priority'],
        status: r.completedAt ? 'done' as const : 'todo' as const,
        dueDate: r.dueAtSoft?.toISOString().split('T')[0] || null,
        owner: 'Team', relatedTo: r.projectTag || null,
        projectTag: r.projectTag || 'General', checklist: [],
        aiNextStep: null, createdAt: new Date().toISOString().split('T')[0],
      }));
      logInfo('database', `Fetched ${mapped.length} tasks from database`);
      return { data: mapped, source: 'database' };
    }
  } catch (err) {
    logWarning('database', `Database query failed for tasks: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { data: [], source: 'unavailable', warning: NO_DB_WARNING };
}

export async function createTask(input: { title: string; priority: number; projectTag: string; dueDate: string | null }): Promise<DataResult<CockpitTask>> {
  const newTask: CockpitTask = {
    id: `t${Date.now()}`, title: input.title,
    priority: input.priority as CockpitTask['priority'],
    status: 'todo', dueDate: input.dueDate, owner: 'Gideon',
    relatedTo: null, projectTag: input.projectTag,
    checklist: [], aiNextStep: null,
    createdAt: new Date().toISOString().split('T')[0],
  };
  return { data: newTask, source: 'unavailable', warning: 'Task created in session only.' };
}

export async function toggleTaskStatus(id: string): Promise<DataResult<CockpitTask | null>> {
  return { data: null, source: 'unavailable' };
}

// ── Agents ───────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<DataResult<CockpitAgent[]>> {
  return { data: [], source: 'unavailable', warning: 'No AI agents configured. Set up agents in Settings.' };
}

export async function toggleAgent(id: string, action: 'pause' | 'resume' | 'retry'): Promise<DataResult<CockpitAgent | null>> {
  return { data: null, source: 'unavailable' };
}

// ── Automations ──────────────────────────────────────────────────────────────

export async function getAutomations(): Promise<DataResult<CockpitAutomation[]>> {
  return { data: [], source: 'unavailable', warning: 'No automations configured. Use the Portal automations view.' };
}

export async function toggleAutomation(id: string, action: 'enable' | 'disable' | 'retry'): Promise<DataResult<CockpitAutomation | null>> {
  return { data: null, source: 'unavailable' };
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(): Promise<DataResult<CockpitMessage[]>> {
  return { data: [], source: 'unavailable', warning: 'Use Unified Comms for live messages (WhatsApp, Gmail, iMessage).' };
}

export async function markMessageRead(id: string): Promise<DataResult<CockpitMessage | null>> {
  return { data: null, source: 'unavailable' };
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export async function getMetrics() {
  // Return zeros — dashboard should pull from portal-stats API
  return {
    data: {
      totalRevenue: 0, revenueChange: 0, activeClients: 0, clientChange: 0,
      openLeads: 0, leadChange: 0, conversionRate: 0, crChange: 0,
      tasksDue: 0, taskChange: 0, automationsActive: 0, autoChange: 0,
    },
    source: 'unavailable' as DataSource,
    warning: 'Connect to Portal stats for live KPIs.',
  };
}

export async function getRevenueEvents() {
  return { data: [], source: 'unavailable' as DataSource };
}

export async function getProjects() {
  return { data: [], source: 'unavailable' as DataSource, warning: 'No projects data. Use Pipeline view for deals.' };
}

export async function getFiles() {
  return { data: [], source: 'unavailable' as DataSource, warning: 'No files configured.' };
}
