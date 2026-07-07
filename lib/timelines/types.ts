export type Panel = '718' | '305'
export type ChannelType = 'whatsapp' | 'sms' | 'imessage' | 'google_voice'
export type Direction = 'in' | 'out'

/** Investor tier from Pipedrive TAG: investor-{A|B|C|D}-{principal|connector} */
export type InvestorTier = 'A' | 'B' | 'C' | 'D'
export type InvestorRole = 'principal' | 'connector'

export interface TimelinesChat {
  id: number
  name: string
  phone: string
  jid: string
  is_group: boolean
  closed: boolean
  read: boolean
  labels: string[]
  whatsapp_account_id: string
  chat_url: string
  created_timestamp: string
  last_message_uid: string | null
  last_message_timestamp: string | null
  unattended: boolean
  photo: string | null
  is_allowed_to_message: boolean
  group_members: unknown[]
}

export interface TimelinesMessage {
  uid: string
  chat_id: number
  timestamp: string
  sender_phone: string
  sender_name: string
  recipient_phone: string
  recipient_name: string
  from_me: boolean
  text: string
  attachment_url: string | null
  attachment_filename: string | null
  status: string
  origin: string
  has_attachment: boolean
  message_type: string
  reactions: { users: unknown[]; reactions: Record<string, unknown>; total: number }
  data: Record<string, unknown>
}

export interface DashboardThread {
  id: string
  panel: Panel
  channel_type: ChannelType
  phone: string
  contact_name: string | null
  is_group: boolean
  jid: string | null
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  pipedrive_contact_id: number | null
  is_investor: boolean
  /** Tier letter parsed from Pipedrive TAG `investor-A-principal` etc. Null if investor flag came only from the Supabase tags table. */
  investor_tier: InvestorTier | null
  /** Role parsed from Pipedrive TAG. Null if from tags table. */
  investor_role: InvestorRole | null
  /** True for synthetic stubs returned for investor-tagged Pipedrive contacts who have no WhatsApp thread yet. The UI should render contact metadata but no message preview. */
  is_stub?: boolean
  /** AI-flagged as important (deal interest, urgency, commitment language) */
  is_priority: boolean
  /** Contact is flagged as family */
  is_family: boolean
  /** Contact is flagged as staff */
  is_staff: boolean
  /** Contact is blocked */
  is_blocked?: boolean
}

export interface DashboardMessage {
  id: string
  thread_id: string
  panel: Panel
  channel_type: ChannelType
  direction: Direction
  body: string | null
  media_url: string | null
  media_type: string | null
  media_filename: string | null
  timelines_uid: string | null
  from_phone: string | null
  from_name: string | null
  sent_at: string | null
  status: string | null
  is_group_message: boolean
}
