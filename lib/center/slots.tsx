import type { ComponentType } from 'react'
import Column, { type ColumnProps } from '@/components/center/Column'
import type { ComponentRegistry } from '@/components/center/windows/WindowManager'
import type { InvestorProfileData } from '@/components/panels/InvestorProfile'

/*
import CalendarColumn, {
  useColumnCount as useCalendarCount,
} from '@/components/center/columns/CalendarColumn'
*/
import PipelineColumn, {
  useColumnCount as usePipelineCount,
} from '@/components/center/columns/PipelineColumn'
import InboxColumn, {
  useColumnCount as useInboxCount,
} from '@/components/center/columns/InboxColumn'
/*
import NotesColumn, {
  useColumnCount as useNotesCount,
} from '@/components/center/columns/NotesColumn'
*/
import CommsColumn, {
  useColumnCount as useCommsCount,
} from '@/components/center/columns/CommsColumn'
/*
import BucketColumn, {
  useColumnCount as useBucketCount,
} from '@/components/center/columns/BucketColumn'
import CrewColumn, {
  useColumnCount as useCrewCount,
} from '@/components/center/columns/CrewColumn'
*/
import NoraDeskColumn, {
  useColumnCount as useNoraCount,
} from '@/components/center/columns/NoraDeskColumn'
import GmailClient from '@/components/cockpit/GmailClient'

import BucketItemDetail from '@/components/center/BucketItemDetail'
import InvestorCadenceWindow from '@/components/center/InvestorCadenceWindow'
import InvestorProfileWindow from '@/components/center/InvestorProfileWindow'
import SecretaryWindow from '@/components/center/windows/SecretaryWindow'
import SettingsWindow from '@/components/center/SettingsWindow'
import ChatWindow from '@/components/center/windows/ChatWindow'


import ReminderToast from '@/components/center/ReminderToast'
import VoiceModalsHost from '@/components/center/VoiceModalsHost'
import SettingsApplier from '@/components/center/SettingsApplier'

/**
 * Mount points for the /center kiosk.
 *
 * Layout matches the screenshot: Calendar → Pipeline/Brief → Email Triage →
 * Notes → Comms (305/718/Staff/Investors) → Bucket/Tasks → Crew → Nora's Desk
 *
 * app/center/page.tsx is intentionally dumb layout chrome. Add a new
 * column, window, or overlay HERE — never in page.tsx.
 */

export type ColumnSlot = {
  label: ColumnProps['label']
  component?: ComponentType
  fullBleed?: boolean
  /**
   * Hook that returns the visible-item count for the column header badge.
   * Sharing the column's React Query key means no extra fetch.
   */
  useCount?: () => number
}

export const COLUMN_SLOTS: ColumnSlot[] = [
  { 
    label: "Nora's Command Desk", 
    component: NoraDeskColumn, 
    fullBleed: true, 
    useCount: useNoraCount 
  },
  { 
    label: 'Intelligence & Comms', 
    component: () => (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <CommsColumn />
          </div>
          <div style={{ flex: 1, minHeight: 0, borderTop: '2px solid rgba(255,204,51,0.2)' }}>
            <GmailClient />
          </div>
        </div>
        <div style={{ flex: 0.6, minHeight: 0, borderTop: '2px solid rgba(255,204,51,0.2)', display: 'flex' }}>
          <div style={{ flex: 1, borderRight: '1px solid rgba(255,204,51,0.1)' }}>
            <InboxColumn />
          </div>
          <div style={{ flex: 1 }}>
            <PipelineColumn />
          </div>
        </div>
      </div>
    ), 
    fullBleed: true, 
    useCount: () => (useCommsCount() || 0) + (useInboxCount() || 0) + (usePipelineCount() || 0)
  },
]


/**
 * Per-column error boundary so one column crash doesn't nuke the page.
 */
import React from 'react'

class ColumnErrorBoundary extends React.Component<
  { label: string; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { label: string; children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <Column label={this.props.label}>
          <div style={{ padding: 16, color: '#EF4444', fontSize: 11 }}>
            ⚠ {this.props.label} crashed: {this.state.error.message}
            <br />
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              style={{ marginTop: 8, fontSize: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '4px 8px', color: '#EF4444', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        </Column>
      )
    }
    return this.props.children
  }
}

/**
 * ColumnSlot renderer — calls each slot's count hook (so the badge updates
 * live) and wraps the column component in <Column>. Lives here so
 * page.tsx stays dumb layout chrome and slots.tsx remains the single
 * mount-point file for the kiosk.
 */
export function ColumnSlotRenderer({ slot }: { slot: ColumnSlot }) {
  // Wrap useCount in try/catch — if the hook throws during render,
  // the error boundary will catch it.
  let count: number | undefined
  try {
    count = slot.useCount ? slot.useCount() : undefined
  } catch {
    count = undefined
  }
  const Component = slot.component
  return (
    <ColumnErrorBoundary label={slot.label}>
      <Column label={slot.label} fullBleed={slot.fullBleed} count={count}>
        {Component ? <Component /> : null}
      </Column>
    </ColumnErrorBoundary>
  )
}

export const WINDOW_REGISTRY: ComponentRegistry = {
  'bucket-item': (props) => (
    <BucketItemDetail
      {...(props as { itemId?: string; title?: string })}
    />
  ),
  'investor-profile': (props) => (
    <InvestorProfileWindow
      {...(props as {
        pipedriveContactId?: number
        name?: string
        fallbackData?: InvestorProfileData
      })}
    />
  ),
  secretary: () => <SecretaryWindow />,
  'investor-cadence': () => <InvestorCadenceWindow />,
  settings: () => <SettingsWindow />,
  chat: (props) => (
    <ChatWindow
      {...(props as {
        threadId: string
        panel?: string
        name?: string
      })}
    />
  ),
}


export const FOOTER_OVERLAYS: ComponentType[] = [
  ReminderToast,
  VoiceModalsHost,
  SettingsApplier,
]
