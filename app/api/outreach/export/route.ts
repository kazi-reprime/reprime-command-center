/**
 * Captain 2026-05-25: /api/outreach/export — download a fresh xlsx of every
 * Terminal Invitation Gideon has minted, on demand.
 *
 * Same column layout as the Google Sheet (Terminal Outreach Tracker), so the
 * two stay conceptually in sync. Gideon clicks the download link → gets a
 * .xlsx file he can email, drop in Drive, share with anyone.
 *
 * Auth: dashboard cookie (g@reprime.com) via proxy.ts. Not added to
 * PUBLIC_PATHS — this is operator-only.
 */

import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type InvitationRow = {
  id: string
  contact_first_name: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  proposed_slots: Array<{ iso: string; display: string }> | null
  status: string
  confirmed_slot_iso: string | null
  zoom_join_url: string | null
  expires_at: string | null
  view_count: number | null
  first_opened_at: string | null
  last_opened_at: string | null
  created_at: string
}

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('invitations')
    .select(
      'id, contact_first_name, contact_name, contact_email, contact_phone, proposed_slots, status, confirmed_slot_iso, zoom_join_url, expires_at, view_count, first_opened_at, last_opened_at, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) {
    return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || 'https://project-7e87w.vercel.app'
  ).replace(/\/$/, '')

  const rows = (data as InvitationRow[]).map((inv) => {
    const slots = inv.proposed_slots ?? []
    const slotsText = slots.map((s) => s.display || s.iso).join(' | ')
    const inviteUrl = `${appUrl}/invite/${inv.id}`
    const emailDispatched = Boolean(inv.contact_email && slots.length > 0)

    return {
      minted_at: inv.created_at,
      first_name: inv.contact_first_name ?? '',
      full_name: inv.contact_name ?? '',
      phone: inv.contact_phone ?? '',
      contact_email: inv.contact_email ?? '',
      email_dispatched: emailDispatched ? 'yes' : 'no',
      status: inv.status,
      invite_id: inv.id,
      invite_url: inviteUrl,
      proposed_slots: slotsText,
      confirmed_slot: inv.confirmed_slot_iso ?? '',
      zoom_url: inv.zoom_join_url ?? '',
      view_count: inv.view_count ?? 0,
      first_opened_at: inv.first_opened_at ?? '',
      last_opened_at: inv.last_opened_at ?? '',
      expires_at: inv.expires_at ?? '',
    }
  })

  // Build the workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Set sensible column widths
  ws['!cols'] = [
    { wch: 24 }, // minted_at
    { wch: 14 }, // first_name
    { wch: 22 }, // full_name
    { wch: 16 }, // phone
    { wch: 28 }, // contact_email
    { wch: 10 }, // email_dispatched
    { wch: 10 }, // status
    { wch: 38 }, // invite_id
    { wch: 60 }, // invite_url
    { wch: 80 }, // proposed_slots
    { wch: 24 }, // confirmed_slot
    { wch: 60 }, // zoom_url
    { wch: 8 },  // view_count
    { wch: 22 }, // first_opened_at
    { wch: 22 }, // last_opened_at
    { wch: 22 }, // expires_at
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Outreach Log')

  // Generate xlsx buffer. NextResponse wants a BodyInit; wrapping the binary
  // in a Blob is the cleanest cross-platform path.
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const filename = `RePrime_Terminal_Outreach_Log_${yyyy}-${mm}-${dd}.xlsx`

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
