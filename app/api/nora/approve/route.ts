/**
 * Nora Approval API Route
 *
 * POST /api/nora/approve
 *   Input: { actionId, approved: boolean, modification?: string }
 *   
 * Handles the approval/rejection of pending actions (send WhatsApp,
 * send email, create meeting, etc.).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ApprovalRequest {
  actionId: string
  approved: boolean
  modification?: string
}

export async function POST(request: NextRequest) {
  let body: ApprovalRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.actionId) {
    return NextResponse.json({ error: 'actionId required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Look up the pending action
  const { data: action, error: fetchErr } = await supabase
    .from('nora_pending_actions')
    .select('*')
    .eq('id', body.actionId)
    .single()

  if (fetchErr) {
    // Table might not exist yet
    if (fetchErr.message.includes('does not exist') || fetchErr.message.includes('schema cache')) {
      return NextResponse.json({ error: 'approval_table_not_migrated', message: 'Run the DB migration to create nora_pending_actions table.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'action_not_found' }, { status: 404 })
  }

  if (!action) {
    return NextResponse.json({ error: 'action_not_found' }, { status: 404 })
  }

  const actionData = action as {
    id: string
    action_type: string
    payload: Record<string, unknown>
    status: string
  }

  if (actionData.status !== 'pending') {
    return NextResponse.json({ error: 'action_already_processed', status: actionData.status })
  }

  if (!body.approved) {
    // Reject the action
    await supabase
      .from('nora_pending_actions')
      .update({ status: 'rejected', resolved_at: new Date().toISOString() })
      .eq('id', body.actionId)

    return NextResponse.json({ success: true, status: 'rejected' })
  }

  // ── Execute the approved action ─────────────────────────────────────────
  let result: Record<string, unknown> = {}

  try {
    const { gateway } = await import('@/lib/gateway')
    const payload = body.modification
      ? { ...actionData.payload, body: body.modification }
      : actionData.payload

    switch (actionData.action_type) {
      case 'whatsapp:send': {
        const waResult = await gateway.sendWhatsApp({
          to: String(payload.to),
          body: String(payload.body),
          lane: (payload.lane as '305' | '718') || '305',
        })
        result = { success: waResult.success, provider: waResult.providerId }
        break
      }

      case 'email:send': {
        const { sendGmailMessage } = await import('@/lib/email/unified-inbox')
        const emailResult = await sendGmailMessage({
          to: String(payload.to),
          subject: String(payload.subject),
          body: String(payload.body),
          html: payload.html as string | undefined,
          threadId: payload.threadId as string | undefined,
          inReplyTo: payload.inReplyTo as string | undefined,
        })
        result = { success: true, messageId: emailResult.id }
        break
      }

      case 'meeting:create': {
        const meetingResult = await gateway.createMeeting({
          topic: String(payload.topic),
          startTime: String(payload.startTime),
          duration: Number(payload.duration) || 30,
          agenda: payload.agenda as string | undefined,
        })
        result = { success: meetingResult.success, meeting: meetingResult.data }
        break
      }

      default:
        result = { error: `Unknown action type: ${actionData.action_type}` }
    }
  } catch (err) {
    result = { error: (err as Error).message }
  }

  // Update action status
  await supabase
    .from('nora_pending_actions')
    .update({
      status: result.error ? 'failed' : 'executed',
      result,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', body.actionId)

  return NextResponse.json({
    success: !result.error,
    status: result.error ? 'failed' : 'executed',
    result,
  })
}

// GET — list pending actions
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('nora_pending_actions')
    .select('id, action_type, payload, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    // Table might not exist yet — return empty list
    if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
      return NextResponse.json({ actions: [], note: 'nora_pending_actions table not yet created. Run DB migration.' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ actions: data || [] })
}
