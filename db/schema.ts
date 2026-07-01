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

// Table: notes
export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  createdBy: uuid('created_by').references(() => orgMembers.id, { onDelete: 'set null' }),
  linkedSourceType: varchar('linked_source_type', { length: 50 }),
  linkedSourceId: varchar('linked_source_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table: briefings
export const briefings = pgTable('briefings', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'morning', 'evening', 'meeting'
  content: text('content').notNull(),
  generatedFor: uuid('generated_for').references(() => orgMembers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: contacts
export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  company: varchar('company', { length: 255 }),
  isInvestor: boolean('is_investor').default(false).notNull(),
  isStaff: boolean('is_staff').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: contact_labels
export const contactLabels = pgTable('contact_labels', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }).notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: audit_logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  action: varchar('action', { length: 255 }).notNull(),
  actorId: uuid('actor_id').references(() => orgMembers.id, { onDelete: 'set null' }),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
// Table: nora_chat_messages
export const noraChatMessages = pgTable('nora_chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: varchar('role', { length: 20 }).notNull(), // 'user', 'assistant'
  content: text('content').notNull(),
  language: varchar('language', { length: 10 }).default('en'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: whatsapp_threads
export const whatsappThreads = pgTable('whatsapp_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  panel: varchar('panel', { length: 10 }).notNull(),
  channelType: varchar('channel_type', { length: 20 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  contactName: text('contact_name'),
  isGroup: boolean('is_group').default(false).notNull(),
  jid: text('jid'),
  lastMessageAt: timestamp('last_message_at'),
  lastMessagePreview: text('last_message_preview'),
  unreadCount: integer('unread_count').default(0).notNull(),
  pipedriveContactId: integer('pipedrive_contact_id'),
  isInvestor: boolean('is_investor').default(false).notNull(),
  isBlocked: boolean('is_blocked').default(false).notNull(),
  timelinesChatId: integer('timelines_chat_id'),
  isPriority: boolean('is_priority').default(false).notNull(),
  isFamily: boolean('is_family').default(false).notNull(),
  isStaff: boolean('is_staff').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table: whatsapp_messages
export const whatsappMessages = pgTable('whatsapp_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').references(() => whatsappThreads.id, { onDelete: 'cascade' }),
  panel: varchar('panel', { length: 10 }).notNull(),
  channelType: varchar('channel_type', { length: 20 }).notNull(),
  direction: varchar('direction', { length: 10 }).notNull(),
  body: text('body'),
  mediaUrl: text('media_url'),
  mediaType: text('media_type'),
  mediaFilename: text('media_filename'),
  timelinesUid: varchar('timelines_uid', { length: 255 }).unique(),
  fromPhone: varchar('from_phone', { length: 50 }),
  fromName: text('from_name'),
  sentAt: timestamp('sent_at'),
  status: varchar('status', { length: 50 }),
  isGroupMessage: boolean('is_group_message').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table: roster (Contacts Board)
export const roster = pgTable('roster', {
  sourceRow: integer('source_row').primaryKey(),
  phone: varchar('phone', { length: 50 }).unique(),
  boardStage: varchar('board_stage', { length: 50 }),
  threadJson: jsonb('thread_json'),
  awaitingUs: boolean('awaiting_us').default(false),
  lastReplyAt: timestamp('last_reply_at'),
  lastReplyText: text('last_reply_text'),
  lastFrom: varchar('last_from', { length: 10 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table: outbound_asks
export const outboundAsks = pgTable('outbound_asks', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  senderIdentity: varchar('sender_identity', { length: 255 }).notNull(),
  recipientIdentifier: varchar('recipient_identifier', { length: 255 }).notNull(),
  channel: varchar('channel', { length: 50 }).notNull(),
  body: text('body'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  expectedReplyBy: timestamp('expected_reply_by').notNull(),
  status: varchar('status', { length: 50 }).default('open').notNull(),
  relatedThreadId: uuid('related_thread_id'),
  remindedAt: timestamp('reminded_at'),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  notes: many(notes),
  briefings: many(briefings),
  contacts: many(contacts),
  auditLogs: many(auditLogs),
  whatsappThreads: many(whatsappThreads),
  outboundAsks: many(outboundAsks),
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

export const notesRelations = relations(notes, ({ one }) => ({
  organization: one(organizations, {
    fields: [notes.orgId],
    references: [organizations.id],
  }),
  author: one(orgMembers, {
    fields: [notes.createdBy],
    references: [orgMembers.id],
  }),
}));

export const briefingsRelations = relations(briefings, ({ one }) => ({
  organization: one(organizations, {
    fields: [briefings.orgId],
    references: [organizations.id],
  }),
  recipient: one(orgMembers, {
    fields: [briefings.generatedFor],
    references: [orgMembers.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contacts.orgId],
    references: [organizations.id],
  }),
  labels: many(contactLabels),
}));

export const contactLabelsRelations = relations(contactLabels, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactLabels.contactId],
    references: [contacts.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.orgId],
    references: [organizations.id],
  }),
  actor: one(orgMembers, {
    fields: [auditLogs.actorId],
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

export const whatsappThreadsRelations = relations(whatsappThreads, ({ many }) => ({
  messages: many(whatsappMessages),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  thread: one(whatsappThreads, {
    fields: [whatsappMessages.threadId],
    references: [whatsappThreads.id],
  }),
}));

export const outboundAsksRelations = relations(outboundAsks, ({ one }) => ({
  organization: one(organizations, {
    fields: [outboundAsks.orgId],
    references: [organizations.id],
  }),
}));

