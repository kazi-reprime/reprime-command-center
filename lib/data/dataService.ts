/**
 * Unified data access layer for the Cockpit.
 * Attempts database queries first, falls back to seed data.
 * Returns { data, source } so the UI can show data-source warnings.
 */

import { db } from '@/db';
import { contacts, deals, bucketItems, notes } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { logInfo, logWarning, logError } from '@/lib/logging/systemLog';
import {
  seedClients, seedLeads, seedTasks, seedAgents, seedAutomations,
  seedMessages, seedProjects, seedFiles, seedRevenueEvents, computeMetrics,
  type SeedClient, type SeedLead, type SeedTask, type SeedAgent,
  type SeedAutomation, type SeedMessage, type SeedProject, type SeedFile,
} from './seed';

export type DataSource = 'database' | 'seed';

export interface DataResult<T> {
  data: T;
  source: DataSource;
  warning?: string;
}

// In-memory stores for local persistence within a server process
// These act as a step above pure seed data — they persist across API calls within the same process
let localClients: SeedClient[] = [...seedClients];
let localLeads: SeedLead[] = [...seedLeads];
let localTasks: SeedTask[] = [...seedTasks];
let localAgents: SeedAgent[] = [...seedAgents];
let localAutomations: SeedAutomation[] = [...seedAutomations];
let localMessages: SeedMessage[] = [...seedMessages];

async function isDatabaseAvailable(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('mock') || dbUrl === '') return false;
  try {
    // Quick connectivity check
    await db.select().from(contacts).limit(0);
    return true;
  } catch {
    return false;
  }
}

// ── Clients ──────────────────────────────────────────────────────────────────

export async function getClients(): Promise<DataResult<SeedClient[]>> {
  try {
    if (await isDatabaseAvailable()) {
      const rows = await db.select().from(contacts).orderBy(desc(contacts.createdAt));
      if (rows.length > 0) {
        const mapped: SeedClient[] = rows.map(r => ({
          id: r.id,
          name: r.name,
          business: r.company || '',
          email: r.email || '',
          phone: r.phone || '',
          status: 'active' as const,
          source: '',
          notes: '',
          revenue: 0,
          nextFollowUp: null,
          createdAt: r.createdAt.toISOString().split('T')[0],
        }));
        logInfo('database', `Fetched ${mapped.length} clients from database`);
        return { data: mapped, source: 'database' };
      }
    }
  } catch (err) {
    logWarning('database', `Database query failed for clients: ${err instanceof Error ? err.message : String(err)}`);
  }
  return {
    data: localClients,
    source: 'seed',
    warning: 'Database not configured. Using demo data. Add DATABASE_URL to enable live persistence.',
  };
}

export async function createClient(input: Omit<SeedClient, 'id' | 'createdAt' | 'revenue'>): Promise<DataResult<SeedClient>> {
  const newClient: SeedClient = {
    id: `c${Date.now()}`,
    ...input,
    revenue: 0,
    createdAt: new Date().toISOString().split('T')[0],
  };

  try {
    if (await isDatabaseAvailable()) {
      await db.insert(contacts).values({
        orgId: '00000000-0000-0000-0000-000000000001', // default org
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        company: input.business || null,
      });
      logInfo('database', `Created client "${input.name}" in database`);
      return { data: newClient, source: 'database' };
    }
  } catch (err) {
    logWarning('database', `Failed to create client in DB: ${err instanceof Error ? err.message : String(err)}`);
  }

  localClients = [newClient, ...localClients];
  logInfo('system', `Created client "${input.name}" in local store`);
  return {
    data: newClient,
    source: 'seed',
    warning: 'Saved to local session. Add DATABASE_URL to persist permanently.',
  };
}

// ── Leads ────────────────────────────────────────────────────────────────────

export async function getLeads(): Promise<DataResult<SeedLead[]>> {
  // Leads map to deals table in the schema
  try {
    if (await isDatabaseAvailable()) {
      const rows = await db.select().from(deals).orderBy(desc(deals.createdAt));
      if (rows.length > 0) {
        const mapped: SeedLead[] = rows.map(r => ({
          id: r.id,
          name: r.name,
          business: r.address || '',
          email: '',
          phone: '',
          stage: (r.status as SeedLead['stage']) || 'new',
          score: r.riskScore || 50,
          source: '',
          value: r.purchasePrice || 0,
          probability: 50,
          nextAction: 'Review deal details',
          createdAt: r.createdAt.toISOString().split('T')[0],
        }));
        logInfo('database', `Fetched ${mapped.length} leads from database`);
        return { data: mapped, source: 'database' };
      }
    }
  } catch (err) {
    logWarning('database', `Database query failed for leads: ${err instanceof Error ? err.message : String(err)}`);
  }
  return {
    data: localLeads,
    source: 'seed',
    warning: 'Database not configured. Using demo data. Add DATABASE_URL to enable live persistence.',
  };
}

export async function createLead(input: Omit<SeedLead, 'id' | 'createdAt' | 'score' | 'probability'>): Promise<DataResult<SeedLead>> {
  const newLead: SeedLead = {
    id: `l${Date.now()}`,
    ...input,
    score: Math.floor(Math.random() * 40) + 50,
    probability: 20,
    createdAt: new Date().toISOString().split('T')[0],
  };

  localLeads = [newLead, ...localLeads];
  logInfo('system', `Created lead "${input.name}" in local store`);
  return {
    data: newLead,
    source: 'seed',
    warning: 'Saved to local session. Add DATABASE_URL to persist permanently.',
  };
}

export async function updateLeadStage(id: string, stage: SeedLead['stage']): Promise<DataResult<SeedLead | null>> {
  const idx = localLeads.findIndex(l => l.id === id);
  if (idx >= 0) {
    localLeads[idx] = { ...localLeads[idx], stage };
    logInfo('system', `Updated lead "${localLeads[idx].name}" stage to ${stage}`);
    return { data: localLeads[idx], source: 'seed' };
  }
  return { data: null, source: 'seed' };
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasks(): Promise<DataResult<SeedTask[]>> {
  try {
    if (await isDatabaseAvailable()) {
      const rows = await db.select().from(bucketItems).orderBy(desc(bucketItems.priority));
      if (rows.length > 0) {
        const mapped: SeedTask[] = rows.map(r => ({
          id: r.id,
          title: r.title,
          priority: (r.priority || 3) as SeedTask['priority'],
          status: r.completedAt ? 'done' as const : 'todo' as const,
          dueDate: r.dueAtSoft?.toISOString().split('T')[0] || null,
          owner: 'Team',
          relatedTo: r.projectTag || null,
          projectTag: r.projectTag || 'General',
          checklist: [],
          aiNextStep: null,
          createdAt: new Date().toISOString().split('T')[0],
        }));
        logInfo('database', `Fetched ${mapped.length} tasks from database`);
        return { data: mapped, source: 'database' };
      }
    }
  } catch (err) {
    logWarning('database', `Database query failed for tasks: ${err instanceof Error ? err.message : String(err)}`);
  }
  return {
    data: localTasks,
    source: 'seed',
    warning: 'Database not configured. Using demo data. Add DATABASE_URL to enable live persistence.',
  };
}

export async function createTask(input: { title: string; priority: number; projectTag: string; dueDate: string | null }): Promise<DataResult<SeedTask>> {
  const newTask: SeedTask = {
    id: `t${Date.now()}`,
    title: input.title,
    priority: input.priority as SeedTask['priority'],
    status: 'todo',
    dueDate: input.dueDate,
    owner: 'Gideon',
    relatedTo: null,
    projectTag: input.projectTag,
    checklist: [],
    aiNextStep: null,
    createdAt: new Date().toISOString().split('T')[0],
  };

  localTasks = [newTask, ...localTasks];
  logInfo('system', `Created task "${input.title}" in local store`);
  return { data: newTask, source: 'seed' };
}

export async function toggleTaskStatus(id: string): Promise<DataResult<SeedTask | null>> {
  const idx = localTasks.findIndex(t => t.id === id);
  if (idx >= 0) {
    const current = localTasks[idx];
    localTasks[idx] = { ...current, status: current.status === 'done' ? 'todo' : 'done' };
    logInfo('system', `Toggled task "${current.title}" to ${localTasks[idx].status}`);
    return { data: localTasks[idx], source: 'seed' };
  }
  return { data: null, source: 'seed' };
}

// ── Agents ───────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<DataResult<SeedAgent[]>> {
  return { data: localAgents, source: 'seed' };
}

export async function toggleAgent(id: string, action: 'pause' | 'resume' | 'retry'): Promise<DataResult<SeedAgent | null>> {
  const idx = localAgents.findIndex(a => a.id === id);
  if (idx >= 0) {
    const a = localAgents[idx];
    if (action === 'pause') localAgents[idx] = { ...a, status: 'paused', currentTask: null };
    else if (action === 'resume') localAgents[idx] = { ...a, status: 'running', currentTask: 'Resuming operations...' };
    else if (action === 'retry') localAgents[idx] = { ...a, status: 'running', errorCount: 0, currentTask: 'Retrying last operation...' };
    logInfo('system', `Agent "${a.name}" action: ${action}`);
    return { data: localAgents[idx], source: 'seed' };
  }
  return { data: null, source: 'seed' };
}

// ── Automations ──────────────────────────────────────────────────────────────

export async function getAutomations(): Promise<DataResult<SeedAutomation[]>> {
  return { data: localAutomations, source: 'seed' };
}

export async function toggleAutomation(id: string, action: 'enable' | 'disable' | 'retry'): Promise<DataResult<SeedAutomation | null>> {
  const idx = localAutomations.findIndex(a => a.id === id);
  if (idx >= 0) {
    const a = localAutomations[idx];
    if (action === 'enable') localAutomations[idx] = { ...a, status: 'active' };
    else if (action === 'disable') localAutomations[idx] = { ...a, status: 'paused' };
    else if (action === 'retry') localAutomations[idx] = { ...a, status: 'active', failureCount: 0, configWarning: null };
    logInfo('automation', `Automation "${a.name}" action: ${action}`);
    return { data: localAutomations[idx], source: 'seed' };
  }
  return { data: null, source: 'seed' };
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(): Promise<DataResult<SeedMessage[]>> {
  return { data: localMessages, source: 'seed' };
}

export async function markMessageRead(id: string): Promise<DataResult<SeedMessage | null>> {
  const idx = localMessages.findIndex(m => m.id === id);
  if (idx >= 0) {
    localMessages[idx] = { ...localMessages[idx], isRead: true };
    return { data: localMessages[idx], source: 'seed' };
  }
  return { data: null, source: 'seed' };
}

// ── Other Data ───────────────────────────────────────────────────────────────

export async function getProjects(): Promise<DataResult<SeedProject[]>> {
  return { data: seedProjects, source: 'seed' };
}

export async function getFiles(): Promise<DataResult<SeedFile[]>> {
  return { data: seedFiles, source: 'seed' };
}

export async function getMetrics() {
  return { data: computeMetrics(), source: 'seed' as DataSource };
}

export async function getRevenueEvents() {
  return { data: seedRevenueEvents, source: 'seed' as DataSource };
}
