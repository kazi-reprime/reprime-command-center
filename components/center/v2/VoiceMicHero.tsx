'use client'

import VoiceShell from '@/components/center/VoiceShell'

/**
 * VoiceMicHero — band 3 of /center/v2. Replaces the small dot in
 * VoiceShellFooter with a centered circle that presents as the screen
 * hero. The existing VoiceShell owns all mic logic, SpeechRecognition,
 * MediaRecorder, and dispatch — we wrap it in a hero container instead
 * of forking the engine.
 *
 * Layout (Spec §6):
 *   - 160px circle, navy fill, gold rim
 *   - "Hold space to talk" caption
 *   - Live transcript line below the circle while recording (driven by
 *     VoiceShell's existing aria-live span)
 *
 * The four chips around the mic (TTS speed, EN/HE, Read briefing,
 * Settings) are deliberately deferred to a follow-up — Settings already
 * owns those preferences and we route to it via the chrome action button.
 */
export default function VoiceMicHero() {
  return (
    <div
      data-component="voice-mic-hero"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: '14px 24px',
        background: 'rgba(14, 52, 112, 0.6)',
        borderTop: '1px solid rgba(255, 204, 51, 0.22)',
        borderBottom: '1px solid rgba(255, 204, 51, 0.18)',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 50% 50%, rgba(255, 204, 51, 0.18) 0%, rgba(14, 52, 112, 0.85) 70%)',
          border: '2px solid rgba(255, 204, 51, 0.65)',
          boxShadow:
            '0 0 0 6px rgba(255, 204, 51, 0.08), 0 0 24px rgba(255, 204, 51, 0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFCC33',
          fontSize: 44,
          flexShrink: 0,
          position: 'relative',
        }}
        aria-hidden
      >
        🎙
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          color: '#F5EFD8',
        }}
      >
        {/* VoiceShell renders its own status dot + transcript line. We let
            it sit in the row next to the hero circle so the live
            transcription drives the same single line of copy Gideon's
            already familiar with from v1. */}
        <VoiceShell />
      </div>
    </div>
  )
}
