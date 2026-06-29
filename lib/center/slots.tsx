import type { ComponentType } from 'react'
import Column, { type ColumnProps } from '@/components/center/Column'
import type { ComponentRegistry } from '@/components/center/windows/WindowManager'
import type { InvestorProfileData } from '@/components/panels/InvestorProfile'

import CrewColumn, {
  useColumnCount as useCrewCount,
} from '@/components/center/columns/CrewColumn'
import InboxColumn, {
  useColumnCount as useInboxCount,
} from '@/components/center/columns/InboxColumn'
import PipelineColumn, {
  useColumnCount as usePipelineCount,
} from '@/components/center/columns/PipelineColumn'
import BucketColumn, {
  useColumnCount as useBucketCount,
} from '@/components/center/columns/BucketColumn'

import BucketItemDetail from '@/components/center/BucketItemDetail'
import InvestorCadenceWindow from '@/components/center/InvestorCadenceWindow'
import InvestorProfileWindow from '@/components/center/InvestorProfileWindow'
import SecretaryWindow from '@/components/center/windows/SecretaryWindow'
import SettingsWindow from '@/components/center/SettingsWindow'

import ReminderToast from '@/components/center/ReminderToast'
import VoiceModalsHost from '@/components/center/VoiceModalsHost'
import SettingsApplier from '@/components/center/SettingsApplier'

/**
 * Mount points for the /center kiosk.
 *
 * app/center/page.tsx is intentionally dumb layout chrome. Add a new
 * column, window, or overlay HERE — never in page.tsx. Wave 2-5 tracks
 * collided on page.tsx every time; this file is the merge surface.
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
  { label: 'Pipeline', component: PipelineColumn, fullBleed: true, useCount: usePipelineCount },
  { label: 'Inbox', component: InboxColumn, fullBleed: true, useCount: useInboxCount },
  { label: 'Bucket', component: BucketColumn, fullBleed: true, useCount: useBucketCount },
  { label: 'Crew', component: CrewColumn, useCount: useCrewCount },
]

/**
 * ColumnSlot renderer — calls each slot's count hook (so the badge updates
 * live) and wraps the column component in <Column>. Lives here so
 * page.tsx stays dumb layout chrome and slots.tsx remains the single
 * mount-point file for the kiosk.
 */
export function ColumnSlotRenderer({ slot }: { slot: ColumnSlot }) {
  const count = slot.useCount ? slot.useCount() : undefined
  const Component = slot.component
  return (
    <Column label={slot.label} fullBleed={slot.fullBleed} count={count}>
      {Component ? <Component /> : null}
    </Column>
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
}

export const FOOTER_OVERLAYS: ComponentType[] = [
  ReminderToast,
  VoiceModalsHost,
  SettingsApplier,
]
