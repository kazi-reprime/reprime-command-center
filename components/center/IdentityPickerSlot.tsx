'use client'

import IdentityPicker from './IdentityPicker'

/**
 * IdentityPickerSlot — TopStrip mount point for the IdentityPicker.
 *
 * Track A shipped the slot; Track F shipped the IdentityPicker; this wave 1.5
 * wiring renders the picker inside the slot. Slot keeps a minimum width so
 * the TopStrip layout does not jump while the picker hydrates.
 */
export default function IdentityPickerSlot() {
  return (
    <div
      data-slot="identity-picker"
      style={{
        minWidth: 180,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexShrink: 0,
      }}
    >
      <IdentityPicker />
    </div>
  )
}
