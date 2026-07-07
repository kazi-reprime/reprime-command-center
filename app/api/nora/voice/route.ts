/**
 * Nora Voice API Route — REST-based turn-taking
 *
 * POST /api/nora/voice
 *   Input: { audio: base64, format: 'webm', language?: 'en'|'he' }
 *   Output: { transcript, reply, audioUrl, language }
 *
 * Pipeline: Audio → STT (via gateway) → Nora Chat → TTS (via gateway) → Audio
 * Works on Vercel serverless (no WebSocket needed).
 */

import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  let body: { audio?: string; format?: string; language?: string; history?: Array<{ role: string; content: string }> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const audioBase64 = body.audio
  if (!audioBase64) {
    return NextResponse.json({ error: 'audio (base64) required' }, { status: 400 })
  }

  const format = body.format || 'webm'
  const preferredLanguage = body.language

  try {
    const { gateway } = await import('@/lib/gateway')

    // ── Step 1: STT — Transcribe audio ────────────────────────────────────
    const audioBuffer = Buffer.from(audioBase64, 'base64')

    const sttResult = await gateway.transcribe({
      audio: audioBuffer,
      format,
      language: preferredLanguage,
    })

    if (!sttResult.success || !sttResult.data?.text) {
      return NextResponse.json(
        { error: 'transcription_failed', details: sttResult.error },
        { status: 502 },
      )
    }

    const transcript = sttResult.data.text
    const detectedLanguage = sttResult.data.language || preferredLanguage || 'en'

    console.log('[nora/voice] transcribed:', transcript.slice(0, 100), `(${detectedLanguage})`)

    // ── Step 2: Nora Chat — Process through orchestrator ──────────────────
    const { processMessage } = await import('@/lib/agents/orchestrator')

    const agentResult = await processMessage({
      message: transcript,
      history: (body.history || []).map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      sessionId: `voice-${Date.now()}`,
    })

    const reply = agentResult.reply
    const replyLanguage = agentResult.language || detectedLanguage

    console.log('[nora/voice] reply:', reply.slice(0, 100), `(${replyLanguage})`)

    // ── Step 3: TTS — Synthesize reply ────────────────────────────────────
    let audioUrl: string | null = null

    try {
      const ttsResult = await gateway.synthesize({
        text: reply,
        voice: replyLanguage === 'he' ? 'hebrew_female' : 'nora',
        language: replyLanguage,
        format: 'mp3',
      })

      if (ttsResult.success && ttsResult.data?.audioUrl) {
        audioUrl = ttsResult.data.audioUrl
      } else if (ttsResult.success && ttsResult.data?.audio) {
        // Return base64 audio inline if no URL
        audioUrl = `data:audio/mp3;base64,${Buffer.from(ttsResult.data.audio).toString('base64')}`
      }
    } catch (ttsErr) {
      console.error('[nora/voice] TTS failed (non-fatal)', (ttsErr as Error).message)
      // Voice response without audio is still useful
    }

    return NextResponse.json({
      transcript,
      reply,
      language: replyLanguage,
      audioUrl,
      agentId: agentResult.agentId,
      toolTrace: agentResult.toolTrace?.length ? agentResult.toolTrace : undefined,
    })
  } catch (err) {
    console.error('[nora/voice] pipeline failed', (err as Error).message)
    return NextResponse.json(
      { error: 'voice_pipeline_failed', message: (err as Error).message },
      { status: 500 },
    )
  }
}
