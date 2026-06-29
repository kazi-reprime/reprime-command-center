import OpenAI, { toFile } from 'openai'
import { createServiceClient } from '@/lib/supabase/server'

// WhatsApp voice notes arrive as audio (.oga) with NO text and a TEMPORARY
// Timelines S3 link that expires. This helper makes a voice note usable on the
// secretary board: it downloads the bytes, stores a DURABLE copy in Supabase
// Storage (so the ▶ player keeps working), and transcribes it with Whisper
// (auto-detects Hebrew/English) so the board shows real words instead of a dead
// "📎 document". Every step is best-effort — a failure in one returns whatever
// succeeded, never throws.

const BUCKET = 'attachments' // existing public bucket

export type VoiceNoteResult = { durableUrl: string | null; transcript: string }

// Store a durable copy of audio bytes + transcribe them. Shared by the inbound
// path (processVoiceNote downloads first) and the outbound path (the recorded
// reply already has the bytes). folder lets outbound notes live under voice/out/.
export async function storeAndTranscribe(buf: Buffer, uid: string, filename?: string | null, folder = 'voice'): Promise<VoiceNoteResult> {
  let durableUrl: string | null = null
  let transcript = ''
  if (!buf || !buf.length) return { durableUrl, transcript }

  const ext = ((filename || '').split('.').pop() || 'oga').toLowerCase().replace(/[^a-z0-9]/g, '') || 'oga'
  // Durable copy (Supabase Storage — the Timelines link expires in 15 min).
  try {
    const service = createServiceClient()
    const path = `${folder}/${(uid || String(Date.now())).replace(/[^A-Za-z0-9_-]/g, '')}.${ext}`
    const { error } = await service.storage.from(BUCKET).upload(path, buf, { contentType: 'audio/ogg', upsert: true })
    if (!error) {
      const { data } = service.storage.from(BUCKET).getPublicUrl(path)
      durableUrl = data?.publicUrl || null
    }
  } catch { /* keep durableUrl null */ }

  // Transcribe (Whisper auto-detects Hebrew/English).
  const key = process.env.OPENAI_API_KEY
  if (key) {
    try {
      const openai = new OpenAI({ apiKey: key })
      const file = await toFile(buf, filename || 'voice.oga')
      const out = await openai.audio.transcriptions.create({ file, model: 'whisper-1', response_format: 'json' })
      transcript = (out.text || '').trim()
    } catch { /* leave transcript '' */ }
  }
  return { durableUrl, transcript }
}

export async function processVoiceNote(opts: {
  srcUrl: string
  uid: string
  filename?: string | null
}): Promise<VoiceNoteResult> {
  // Download the audio from the (temporary) Timelines URL, then store + transcribe.
  let buf: Buffer | null = null
  try {
    const r = await fetch(opts.srcUrl)
    if (r.ok) buf = Buffer.from(await r.arrayBuffer())
  } catch { /* leave buf null */ }
  if (!buf || !buf.length) return { durableUrl: null, transcript: '' }
  return storeAndTranscribe(buf, opts.uid, opts.filename, 'voice')
}
