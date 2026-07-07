'use client'

import VoiceShell from './VoiceShell'

/**
 * VoiceShellFooter — pinned bottom chrome for the kiosk voice shell.
 *
 * Track A shipped the chrome; Track G (feat/center-voice) fills the inner
 * [data-slot="voice-shell"] element with the live <VoiceShell /> UI.
 */
export default function VoiceShellFooter() {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 40,
        height: 96,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(14, 52, 112, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 204, 51, 0.15)',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.4)',
        fontFamily: 'inherit',
        padding: '0 40px',
      }}
    >
      <div
        data-slot="voice-shell"
        style={{
          width: '100%',
          maxWidth: 1280,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <VoiceShell />
      </div>
    </div>
  )
}
