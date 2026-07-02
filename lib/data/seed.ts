/**
 * Centralized seed/mock data for the Command Center.
 * Used when Supabase is not configured or tables are empty.
 * All modules pull from here instead of scattering mock data.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SeedClient {
  id: string;
  name: string;
  business: string;
  email: string;
  phone: string;
  status: 'active' | 'onboarding' | 'paused' | 'churned';
  source: string;
  notes: string;
  revenue: number;
  nextFollowUp: string | null;
  createdAt: string;
}

export interface SeedLead {
  id: string;
  name: string;
  business: string;
  email: string;
  phone: string;
  stage: 'new' | 'contacted' | 'qualified' | 'demo_scheduled' | 'proposal_sent' | 'negotiation' | 'won' | 'lost';
  score: number;
  source: string;
  value: number;
  probability: number;
  nextAction: string;
  lostReason?: string;
  createdAt: string;
}

export interface SeedTask {
  id: string;
  title: string;
  priority: 1 | 2 | 3 | 4 | 5;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  dueDate: string | null;
  owner: string;
  relatedTo: string | null;
  projectTag: string;
  checklist: { text: string; done: boolean }[];
  aiNextStep: string | null;
  createdAt: string;
}

export interface SeedAgent {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'paused' | 'idle' | 'error' | 'configuring';
  currentTask: string | null;
  lastRun: string | null;
  successRate: number;
  runsToday: number;
  errorCount: number;
  description: string;
  configWarning: string | null;
}

export interface SeedAutomation {
  id: string;
  name: string;
  trigger: string;
  status: 'active' | 'paused' | 'error' | 'not_configured';
  lastRun: string | null;
  nextRun: string | null;
  successCount: number;
  failureCount: number;
  description: string;
  configWarning: string | null;
}

export interface SeedMessage {
  id: string;
  sender: string;
  channel: 'email' | 'whatsapp' | 'sms' | 'slack';
  subject: string;
  preview: string;
  isRead: boolean;
  priority: 'high' | 'normal' | 'low';
  relatedClient: string | null;
  createdAt: string;
}

export interface SeedProject {
  id: string;
  name: string;
  client: string;
  status: 'planning' | 'in_progress' | 'review' | 'completed' | 'on_hold';
  progress: number;
  deadline: string;
  owner: string;
  milestones: { name: string; done: boolean }[];
  blockers: string[];
}

export interface SeedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  relatedTo: string | null;
  tags: string[];
  uploadedAt: string;
  uploadedBy: string;
}

export interface SeedRevenueEvent {
  id: string;
  client: string;
  amount: number;
  type: 'invoice' | 'payment' | 'refund';
  status: 'pending' | 'paid' | 'overdue';
  date: string;
}

// ─── Seed Data ──────────────────────────────────────────────────────────────

export const seedClients: SeedClient[] = [
  { id: 'c1', name: 'Marcus Rivera', business: 'Rivera Capital Group', email: 'marcus@riveracapital.com', phone: '+13055551001', status: 'active', source: 'Referral', notes: 'Key investor. Interested in retail assets.', revenue: 125000, nextFollowUp: '2026-07-05', createdAt: '2025-11-15' },
  { id: 'c2', name: 'Sarah Chen', business: 'Pacific Ventures', email: 'sarah@pacificventures.com', phone: '+14155552002', status: 'active', source: 'Conference', notes: 'Tech-forward investor. Prefers data-driven pitches.', revenue: 450000, nextFollowUp: '2026-07-08', createdAt: '2025-09-20' },
  { id: 'c3', name: 'David Goldstein', business: 'Goldstein Properties', email: 'david@goldsteinprop.com', phone: '+12125553003', status: 'active', source: 'Cold Outreach', notes: 'Family office. Conservative approach.', revenue: 310000, nextFollowUp: null, createdAt: '2026-01-10' },
  { id: 'c4', name: 'Amara Osei', business: 'Osei Holdings LLC', email: 'amara@oseiholdings.com', phone: '+17185554004', status: 'onboarding', source: 'Website', notes: 'New client. First deal in progress.', revenue: 0, nextFollowUp: '2026-07-03', createdAt: '2026-06-20' },
  { id: 'c5', name: 'James Wellington', business: 'Wellington Trust', email: 'james@wellingtontrust.com', phone: '+14045555005', status: 'paused', source: 'LinkedIn', notes: 'Paused engagement — revisit Q3.', revenue: 85000, nextFollowUp: '2026-09-01', createdAt: '2025-07-12' },
];

export const seedLeads: SeedLead[] = [
  { id: 'l1', name: 'Elena Vasquez', business: 'Vasquez Group', email: 'elena@vasquezgroup.com', phone: '+13055556001', stage: 'new', score: 72, source: 'Website Form', value: 250000, probability: 20, nextAction: 'Schedule intro call', createdAt: '2026-06-28' },
  { id: 'l2', name: 'Robert Kim', business: 'Kim Investments', email: 'robert@kiminv.com', phone: '+12125557002', stage: 'contacted', score: 65, source: 'Referral', value: 180000, probability: 35, nextAction: 'Send portfolio overview', createdAt: '2026-06-25' },
  { id: 'l3', name: 'Fatima Al-Rahman', business: 'Al-Rahman Family Office', email: 'fatima@alrahman.com', phone: '+14155558003', stage: 'qualified', score: 88, source: 'Conference', value: 750000, probability: 55, nextAction: 'Prepare custom proposal', createdAt: '2026-06-15' },
  { id: 'l4', name: 'Thomas Mitchell', business: 'Mitchell Realty', email: 'thomas@mitchellrealty.com', phone: '+17185559004', stage: 'demo_scheduled', score: 80, source: 'Cold Outreach', value: 320000, probability: 60, nextAction: 'Demo on July 5', createdAt: '2026-06-10' },
  { id: 'l5', name: 'Priya Sharma', business: 'Sharma Ventures', email: 'priya@sharmavc.com', phone: '+14045550005', stage: 'proposal_sent', score: 91, source: 'Referral', value: 520000, probability: 75, nextAction: 'Follow up on proposal', createdAt: '2026-05-28' },
  { id: 'l6', name: 'Carlos Mendez', business: 'Mendez Capital', email: 'carlos@mendezcap.com', phone: '+13055551006', stage: 'negotiation', score: 95, source: 'LinkedIn', value: 1200000, probability: 85, nextAction: 'Finalize terms', createdAt: '2026-05-15' },
  { id: 'l7', name: 'Jennifer Park', business: 'Park Holdings', email: 'jennifer@parkhold.com', phone: '+12125552007', stage: 'won', score: 100, source: 'Referral', value: 380000, probability: 100, nextAction: 'Onboard to CRM', createdAt: '2026-04-20' },
  { id: 'l8', name: 'Michael Brown', business: 'Brown Estate Group', email: 'michael@brownestate.com', phone: '+17185553008', stage: 'lost', score: 45, source: 'Website', value: 200000, probability: 0, nextAction: 'Revisit in 6 months', lostReason: 'Budget constraints', createdAt: '2026-03-10' },
];

export const seedTasks: SeedTask[] = [
  { id: 't1', title: 'Review Bay Valley Shopping Center underwriting', priority: 1, status: 'in_progress', dueDate: '2026-07-03', owner: 'Gideon', relatedTo: 'Bay Valley Deal', projectTag: 'Deals', checklist: [{ text: 'Check cap rate', done: true }, { text: 'Review tenant list', done: false }, { text: 'Verify loan terms', done: false }], aiNextStep: 'Focus on tenant creditworthiness analysis', createdAt: '2026-06-30' },
  { id: 't2', title: 'Send follow-up to Fatima Al-Rahman', priority: 2, status: 'todo', dueDate: '2026-07-04', owner: 'Gideon', relatedTo: 'Al-Rahman Family Office', projectTag: 'Sales', checklist: [], aiNextStep: 'Reference her interest in mixed-use properties', createdAt: '2026-07-01' },
  { id: 't3', title: 'Update investor deck for Q3', priority: 2, status: 'todo', dueDate: '2026-07-10', owner: 'Shirel', relatedTo: null, projectTag: 'Marketing', checklist: [{ text: 'Update financials', done: false }, { text: 'Add new deals', done: false }], aiNextStep: null, createdAt: '2026-07-01' },
  { id: 't4', title: 'Fix campaign email deliverability', priority: 3, status: 'blocked', dueDate: '2026-07-06', owner: 'Adir', relatedTo: null, projectTag: 'Tech', checklist: [], aiNextStep: 'Check SPF and DKIM records', createdAt: '2026-06-29' },
  { id: 't5', title: 'Prepare demo for Thomas Mitchell', priority: 1, status: 'todo', dueDate: '2026-07-05', owner: 'Gideon', relatedTo: 'Mitchell Realty', projectTag: 'Sales', checklist: [{ text: 'Customize presentation', done: false }, { text: 'Prepare case studies', done: false }], aiNextStep: 'Include comparable retail deals in his market', createdAt: '2026-07-01' },
  { id: 't6', title: 'Monthly revenue reconciliation', priority: 3, status: 'todo', dueDate: '2026-07-07', owner: 'Yaron', relatedTo: null, projectTag: 'Finance', checklist: [], aiNextStep: null, createdAt: '2026-07-01' },
];

export const seedAgents: SeedAgent[] = [
  { id: 'a1', name: 'Sales Agent', type: 'sales', status: 'running', currentTask: 'Monitoring lead responses', lastRun: '2026-07-02T14:30:00Z', successRate: 94, runsToday: 12, errorCount: 0, description: 'Tracks lead engagement, suggests follow-ups, and drafts outreach messages.', configWarning: null },
  { id: 'a2', name: 'Support Agent', type: 'support', status: 'idle', currentTask: null, lastRun: '2026-07-02T12:00:00Z', successRate: 98, runsToday: 5, errorCount: 0, description: 'Monitors client messages for support requests and routes to team.', configWarning: null },
  { id: 'a3', name: 'Research Agent', type: 'research', status: 'running', currentTask: 'Analyzing market comps for Bay Valley', lastRun: '2026-07-02T15:00:00Z', successRate: 87, runsToday: 3, errorCount: 1, description: 'Gathers market data, property comps, and tenant information.', configWarning: null },
  { id: 'a4', name: 'Email Agent', type: 'email', status: 'paused', currentTask: null, lastRun: '2026-07-02T10:00:00Z', successRate: 91, runsToday: 8, errorCount: 0, description: 'Triages incoming email, drafts responses, and manages follow-ups.', configWarning: 'SENDGRID_API_KEY may need rotation' },
  { id: 'a5', name: 'CRM Agent', type: 'crm', status: 'running', currentTask: 'Syncing Pipedrive contacts', lastRun: '2026-07-02T15:15:00Z', successRate: 96, runsToday: 4, errorCount: 0, description: 'Keeps CRM data synchronized across platforms.', configWarning: null },
  { id: 'a6', name: 'Outreach Agent', type: 'outreach', status: 'idle', currentTask: null, lastRun: '2026-07-01T18:00:00Z', successRate: 82, runsToday: 0, errorCount: 2, description: 'Manages cold outreach campaigns and tracks responses.', configWarning: null },
  { id: 'a7', name: 'Reporting Agent', type: 'reporting', status: 'running', currentTask: 'Generating daily analytics', lastRun: '2026-07-02T14:00:00Z', successRate: 100, runsToday: 2, errorCount: 0, description: 'Compiles business metrics and generates reports.', configWarning: null },
  { id: 'a8', name: 'Automation Agent', type: 'automation', status: 'running', currentTask: 'Processing scheduled workflows', lastRun: '2026-07-02T15:30:00Z', successRate: 89, runsToday: 15, errorCount: 1, description: 'Executes automated workflows and trigger-based actions.', configWarning: null },
  { id: 'a9', name: 'Content Agent', type: 'content', status: 'configuring', currentTask: null, lastRun: null, successRate: 0, runsToday: 0, errorCount: 0, description: 'Creates marketing content, social posts, and newsletters.', configWarning: 'Requires content templates to be configured' },
  { id: 'a10', name: 'Voice Agent', type: 'voice', status: 'idle', currentTask: null, lastRun: '2026-07-02T11:00:00Z', successRate: 76, runsToday: 1, errorCount: 0, description: 'Handles voice calls, transcription, and call summaries.', configWarning: 'ELEVENLABS_API_KEY required for full functionality' },
];

export const seedAutomations: SeedAutomation[] = [
  { id: 'au1', name: 'New Lead Welcome Email', trigger: 'Lead Created', status: 'active', lastRun: '2026-07-02T14:00:00Z', nextRun: null, successCount: 45, failureCount: 2, description: 'Sends a personalized welcome email when a new lead enters the pipeline.', configWarning: null },
  { id: 'au2', name: 'Follow-Up Reminder', trigger: 'Schedule (Daily 9 AM)', status: 'active', lastRun: '2026-07-02T09:00:00Z', nextRun: '2026-07-03T09:00:00Z', successCount: 180, failureCount: 0, description: 'Checks for overdue follow-ups and sends reminders to the team.', configWarning: null },
  { id: 'au3', name: 'Investor Report Generator', trigger: 'Schedule (Weekly Monday)', status: 'active', lastRun: '2026-06-30T08:00:00Z', nextRun: '2026-07-07T08:00:00Z', successCount: 24, failureCount: 1, description: 'Generates weekly investor activity reports.', configWarning: null },
  { id: 'au4', name: 'Deal Stage Notification', trigger: 'Deal Stage Change', status: 'active', lastRun: '2026-07-01T16:30:00Z', nextRun: null, successCount: 67, failureCount: 0, description: 'Notifies the team when a deal moves to a new stage.', configWarning: null },
  { id: 'au5', name: 'Email Triage & Scoring', trigger: 'New Email Received', status: 'active', lastRun: '2026-07-02T15:45:00Z', nextRun: null, successCount: 1250, failureCount: 15, description: 'AI-powered email classification and priority scoring.', configWarning: null },
  { id: 'au6', name: 'Slack Daily Digest', trigger: 'Schedule (Daily 6 PM)', status: 'not_configured', lastRun: null, nextRun: null, successCount: 0, failureCount: 0, description: 'Posts a daily business summary to Slack.', configWarning: 'SLACK_WEBHOOK_URL not configured' },
  { id: 'au7', name: 'Payment Overdue Alert', trigger: 'Payment Past Due', status: 'paused', lastRun: '2026-06-28T10:00:00Z', nextRun: null, successCount: 12, failureCount: 0, description: 'Alerts when client payments become overdue.', configWarning: null },
  { id: 'au8', name: 'CRM Data Sync', trigger: 'Schedule (Every 4 hours)', status: 'error', lastRun: '2026-07-02T12:00:00Z', nextRun: '2026-07-02T16:00:00Z', successCount: 340, failureCount: 8, description: 'Synchronizes data between Pipedrive and the Command Center.', configWarning: 'Last sync failed: Pipedrive API rate limit exceeded' },
];

export const seedMessages: SeedMessage[] = [
  { id: 'm1', sender: 'Marcus Rivera', channel: 'email', subject: 'RE: Q3 Investment Opportunity', preview: 'Thanks for the update. I\'d like to schedule a call to discuss the Bay Valley deal further...', isRead: false, priority: 'high', relatedClient: 'c1', createdAt: '2026-07-02T15:30:00Z' },
  { id: 'm2', sender: 'Fatima Al-Rahman', channel: 'whatsapp', subject: '', preview: 'Can we move the meeting to Thursday? I have a conflict on Wednesday.', isRead: false, priority: 'high', relatedClient: null, createdAt: '2026-07-02T14:45:00Z' },
  { id: 'm3', sender: 'Shirel Ben-Haroush', channel: 'slack', subject: 'Investor Deck Updates', preview: 'I\'ve updated the Q2 numbers in the deck. Ready for your review.', isRead: true, priority: 'normal', relatedClient: null, createdAt: '2026-07-02T13:00:00Z' },
  { id: 'm4', sender: 'Thomas Mitchell', channel: 'email', subject: 'Demo Confirmation', preview: 'Confirmed for July 5th at 2 PM EST. Looking forward to it.', isRead: true, priority: 'normal', relatedClient: null, createdAt: '2026-07-02T11:20:00Z' },
  { id: 'm5', sender: 'Carlos Mendez', channel: 'whatsapp', subject: '', preview: 'Let\'s finalize the terms sheet this week. My counsel is available Thursday.', isRead: false, priority: 'high', relatedClient: null, createdAt: '2026-07-02T10:15:00Z' },
];

export const seedProjects: SeedProject[] = [
  { id: 'p1', name: 'Bay Valley Acquisition', client: 'Marcus Rivera', status: 'in_progress', progress: 65, deadline: '2026-08-15', owner: 'Gideon', milestones: [{ name: 'Due Diligence', done: true }, { name: 'Underwriting', done: true }, { name: 'Financing', done: false }, { name: 'Closing', done: false }], blockers: ['Waiting for Phase I ESA report'] },
  { id: 'p2', name: 'Pacific Ventures Fund II', client: 'Sarah Chen', status: 'in_progress', progress: 40, deadline: '2026-09-30', owner: 'Gideon', milestones: [{ name: 'Term Sheet', done: true }, { name: 'Legal Review', done: false }, { name: 'Capital Call', done: false }, { name: 'Deployment', done: false }], blockers: [] },
  { id: 'p3', name: 'Website Redesign', client: 'Internal', status: 'planning', progress: 15, deadline: '2026-10-01', owner: 'Adir', milestones: [{ name: 'Design', done: false }, { name: 'Development', done: false }, { name: 'Launch', done: false }], blockers: ['Design brief pending'] },
  { id: 'p4', name: 'Q3 Investor Report', client: 'All Investors', status: 'planning', progress: 5, deadline: '2026-07-31', owner: 'Shirel', milestones: [{ name: 'Data Collection', done: false }, { name: 'Draft', done: false }, { name: 'Review', done: false }, { name: 'Distribution', done: false }], blockers: [] },
];

export const seedFiles: SeedFile[] = [
  { id: 'f1', name: 'Bay Valley - Purchase Agreement.pdf', type: 'pdf', size: 2450000, relatedTo: 'Bay Valley Acquisition', tags: ['legal', 'deals'], uploadedAt: '2026-06-15', uploadedBy: 'Gideon' },
  { id: 'f2', name: 'Q2 Investor Deck.pptx', type: 'pptx', size: 8700000, relatedTo: 'Q3 Investor Report', tags: ['marketing', 'investors'], uploadedAt: '2026-06-20', uploadedBy: 'Shirel' },
  { id: 'f3', name: 'Phase I ESA - Bay Valley.pdf', type: 'pdf', size: 15400000, relatedTo: 'Bay Valley Acquisition', tags: ['due-diligence', 'environmental'], uploadedAt: '2026-06-25', uploadedBy: 'Steve' },
  { id: 'f4', name: 'Client Onboarding Checklist.docx', type: 'docx', size: 45000, relatedTo: null, tags: ['templates', 'onboarding'], uploadedAt: '2026-05-10', uploadedBy: 'Shirel' },
  { id: 'f5', name: 'Market Analysis - Downtown Office.xlsx', type: 'xlsx', size: 1200000, relatedTo: 'Downtown Office Plaza', tags: ['research', 'analysis'], uploadedAt: '2026-06-28', uploadedBy: 'Gideon' },
];

export const seedRevenueEvents: SeedRevenueEvent[] = [
  { id: 'r1', client: 'Sarah Chen', amount: 125000, type: 'payment', status: 'paid', date: '2026-06-15' },
  { id: 'r2', client: 'Marcus Rivera', amount: 75000, type: 'payment', status: 'paid', date: '2026-06-20' },
  { id: 'r3', client: 'David Goldstein', amount: 95000, type: 'invoice', status: 'pending', date: '2026-07-01' },
  { id: 'r4', client: 'Sarah Chen', amount: 150000, type: 'invoice', status: 'pending', date: '2026-07-15' },
  { id: 'r5', client: 'James Wellington', amount: 50000, type: 'payment', status: 'paid', date: '2026-05-30' },
  { id: 'r6', client: 'Marcus Rivera', amount: 40000, type: 'invoice', status: 'overdue', date: '2026-06-01' },
  { id: 'r7', client: 'David Goldstein', amount: 110000, type: 'payment', status: 'paid', date: '2026-05-15' },
  { id: 'r8', client: 'Sarah Chen', amount: 175000, type: 'payment', status: 'paid', date: '2026-04-15' },
];

// ─── Computed Metrics ───────────────────────────────────────────────────────

export function computeMetrics() {
  const totalRevenue = seedRevenueEvents.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);
  const pendingRevenue = seedRevenueEvents.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);
  const overdueRevenue = seedRevenueEvents.filter(r => r.status === 'overdue').reduce((sum, r) => sum + r.amount, 0);
  const activeClients = seedClients.filter(c => c.status === 'active').length;
  const totalLeads = seedLeads.length;
  const wonLeads = seedLeads.filter(l => l.stage === 'won').length;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
  const overdueTasks = seedTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length;
  const completedTasks = seedTasks.filter(t => t.status === 'done').length;
  const runningAgents = seedAgents.filter(a => a.status === 'running').length;
  const failedAutomations = seedAutomations.filter(a => a.status === 'error').length;
  const unreadMessages = seedMessages.filter(m => !m.isRead).length;

  return {
    totalRevenue,
    pendingRevenue,
    overdueRevenue,
    projectedRevenue: totalRevenue + pendingRevenue,
    activeClients,
    totalLeads,
    newLeads: seedLeads.filter(l => l.stage === 'new').length,
    conversionRate,
    overdueTasks,
    completedTasks,
    pendingTasks: seedTasks.filter(t => t.status === 'todo').length,
    runningAgents,
    totalAgents: seedAgents.length,
    failedAutomations,
    activeAutomations: seedAutomations.filter(a => a.status === 'active').length,
    unreadMessages,
    avgLeadScore: Math.round(seedLeads.reduce((sum, l) => sum + l.score, 0) / seedLeads.length),
    pipelineValue: seedLeads.filter(l => !['won', 'lost'].includes(l.stage)).reduce((sum, l) => sum + l.value, 0),
    businessHealthScore: 82, // Composite score
  };
}
