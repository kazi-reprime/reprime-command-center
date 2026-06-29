'use client'

import SecretaryTab from '@/components/center/columns/SecretaryTab'

/**
 * SecretaryWindow — thin wrapper that hosts SecretaryTab inside a
 * floating Window. SecretaryTab is column-shaped (height: 100%, owns its
 * own scroll), so the wrapper just provides a flex container so the
 * inner component fills the window body.
 */
export default function SecretaryWindow() {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--rp-navy)',
      }}
    >
      <SecretaryTab />
    </div>
  )
}
