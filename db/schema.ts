import { pgTable, uuid, varchar, timestamp, boolean, integer, jsonb, text, customType } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Custom vector type for pgvector support
const vector = customType<{ data: number[] }>({
  dataType() {
    return 'vector(1536)';
  },
});

// Table: organizations (Tenants)
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  plan: varchar('plan', { length: 50 }).default('starter').notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: org_members (Join table mapping users to organizations with roles)
export const orgMembers = pgTable('org_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').notNull(), // Links to auth.users(id) inside Supabase
  role: varchar('role', { length: 50 }).default('agent').notNull(),
  invitedAt: timestamp('invited_at'),
  joinedAt: timestamp('joined_at'),
});

// Table: org_invites (Invite tokens for secure onboarding signup)
export const orgInvites = pgTable('org_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('agent').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
});

// Table: threads (Unified chat context mapping different channels)
export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  contactPhone: varchar('contact_phone', { length: 50 }).notNull(),
  channel: varchar('channel', { length: 50 }).notNull(), // 'whatsapp', 'imessage', 'sms'
  laneOverride: varchar('lane_override', { length: 50 }).default('general').notNull(), // 'investor', 'staff', 'general'
  isBlocked: boolean('is_blocked').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
});

// Table: messages (Individual chat bubbles)
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').references(() => threads.id, { onDelete: 'cascade' }).notNull(),
  body: text('body').notNull(),
  direction: varchar('direction', { length: 50 }).notNull(), // 'inbound', 'outbound'
  status: varchar('status', { length: 50 }).default('received').notNull(), // 'sent', 'delivered', 'failed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: bucket_items (Tasks, reminders, alerts, delegation items)
export const bucketItems = pgTable('bucket_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  priority: integer('priority').default(3).notNull(), // 1 (highest) to 5 (lowest)
  projectTag: varchar('project_tag', { length: 100 }),
  assignedTo: uuid('assigned_to').references(() => orgMembers.id, { onDelete: 'set null' }),
  assignedBy: uuid('assigned_by').references(() => orgMembers.id, { onDelete: 'set null' }),
  dueAtSoft: timestamp('due_at_soft'),
  remindAt: timestamp('remind_at'),
  completedAt: timestamp('completed_at'),
});

// Table: nora_memory (pgvector semantic memory database)
export const noraMemory = pgTable('nora_memory', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: deals
export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 255 }),
  assetType: varchar('asset_type', { length: 100 }),
  purchasePrice: integer('purchase_price'),
  loanAmount: integer('loan_amount'),
  equityNeeded: integer('equity_needed'),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  priority: integer('priority').default(3).notNull(),
  riskScore: integer('risk_score'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: deal_contacts
export const dealContacts = pgTable('deal_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  contactPhone: varchar('contact_phone', { length: 50 }).notNull(),
  role: varchar('role', { length: 100 }).notNull(), // 'broker', 'attorney', 'lender', 'investor'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: investors
export const investors = pgTable('investors', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  contactPhone: varchar('contact_phone', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  capitalCapacity: integer('capital_capacity'),
  preferredDealType: varchar('preferred_deal_type', { length: 100 }),
  preferredLocation: varchar('preferred_location', { length: 100 }),
  status: varchar('status', { length: 50 }).default('warm').notNull(), // cold, warm, hot, committed, inactive
  investorScore: integer('investor_score').default(0).notNull(),
  lastInteractionAt: timestamp('last_interaction_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: investor_activity
export const investorActivity = pgTable('investor_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  investorId: uuid('investor_id').references(() => investors.id, { onDelete: 'cascade' }).notNull(),
  activityType: varchar('activity_type', { length: 100 }).notNull(), // 'meeting', 'document_sent', 'email', 'call'
  description: text('description'),
  sentiment: varchar('sentiment', { length: 50 }), // 'positive', 'neutral', 'negative'
  activityAt: timestamp('activity_at').defaultNow().notNull(),
});

// Table: decisions
export const decisions = pgTable('decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  decidedBy: varchar('decided_by', { length: 100 }),
  reason: text('reason'),
  status: varchar('status', { length: 50 }).default('active').notNull(), // 'active', 'reversed', 'parked'
  isReversible: boolean('is_reversible').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: payments
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  amount: integer('amount').notNull(),
  payee: varchar('payee', { length: 255 }).notNull(),
  dueDate: timestamp('due_date').notNull(),
  relatedDealId: uuid('related_deal_id').references(() => deals.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending', 'paid', 'overdue', 'snoozed'
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: campaigns
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  relatedDealId: uuid('related_deal_id').references(() => deals.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 50 }).default('draft').notNull(), // 'draft', 'sending', 'completed'
  sentCount: integer('sent_count').default(0).notNull(),
  replyCount: integer('reply_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Relationships ---

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  invites: many(orgInvites),
  threads: many(threads),
  bucketItems: many(bucketItems),
  noraMemory: many(noraMemory),
  deals: many(deals),
  investors: many(investors),
  decisions: many(decisions),
  payments: many(payments),
  campaigns: many(campaigns),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgMembers.orgId],
    references: [organizations.id],
  }),
}));

export const orgInvitesRelations = relations(orgInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgInvites.orgId],
    references: [organizations.id],
  }),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [threads.orgId],
    references: [organizations.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
}));

export const bucketItemsRelations = relations(bucketItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [bucketItems.orgId],
    references: [organizations.id],
  }),
  assignee: one(orgMembers, {
    fields: [bucketItems.assignedTo],
    references: [orgMembers.id],
  }),
  assignor: one(orgMembers, {
    fields: [bucketItems.assignedBy],
    references: [orgMembers.id],
  }),
}));

export const noraMemoryRelations = relations(noraMemory, ({ one }) => ({
  organization: one(organizations, {
    fields: [noraMemory.orgId],
    references: [organizations.id],
  }),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [deals.orgId],
    references: [organizations.id],
  }),
  contacts: many(dealContacts),
  payments: many(payments),
  campaigns: many(campaigns),
}));

export const dealContactsRelations = relations(dealContacts, ({ one }) => ({
  deal: one(deals, {
    fields: [dealContacts.dealId],
    references: [deals.id],
  }),
}));

export const investorsRelations = relations(investors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [investors.orgId],
    references: [organizations.id],
  }),
  activities: many(investorActivity),
}));

export const investorActivityRelations = relations(investorActivity, ({ one }) => ({
  investor: one(investors, {
    fields: [investorActivity.investorId],
    references: [investors.id],
  }),
}));

export const decisionsRelations = relations(decisions, ({ one }) => ({
  organization: one(organizations, {
    fields: [decisions.orgId],
    references: [organizations.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  organization: one(organizations, {
    fields: [payments.orgId],
    references: [organizations.id],
  }),
  deal: one(deals, {
    fields: [payments.relatedDealId],
    references: [deals.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  organization: one(organizations, {
    fields: [campaigns.orgId],
    references: [organizations.id],
  }),
  deal: one(deals, {
    fields: [campaigns.relatedDealId],
    references: [deals.id],
  }),
}));
