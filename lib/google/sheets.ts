/**
 * Captain 2026-05-25: Google Sheets logging for the Terminal outreach tracker.
 *
 * Every successful mint via /api/invitations appends a row to
 *   Spreadsheet: Terminal Outreach Tracker (id pinned in env)
 *   Tab:         "Sheet1" by default, override via SHEETS_OUTREACH_TAB env
 *
 * The header row Gideon set up is (left → right):
 *   minted_at | first_name | full_name | phone | panel | language | tier |
 *   observation | invite_id | invite_url | proposed_slots | message_draft | sent_at
 *
 * Plus we tack on (columns N-Q):
 *   contact_email | email_source | email_dispatched | recipient_reply_status
 *
 * Reuses the existing GOOGLE_REFRESH_TOKEN that powers calendar/freebusy.
 * If that refresh token lacks the spreadsheets scope, the append will 403 —
 * Gideon needs to re-consent the OAuth app with sheets scope added (one
 * 30-second click in the Google authorization flow).
 */

import { google } from 'googleapis'

const TRACKER_SHEET_ID = '1kzySuTayJWr8eUflVAg07YGi4nU1Qmn5HJlsNlqv7xw'

function getAuthClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return auth
}

export interface OutreachLogRow {
  first_name: string | null
  full_name: string | null
  phone: string | null
  panel: '305' | '718' | null
  language: 'he' | 'en' | null
  tier: string | null
  observation: string | null
  invite_id: string
  invite_url: string
  proposed_slots: Array<{ iso: string; display: string }>
  message_draft: string | null
  contact_email: string | null
  email_source: 'caller' | 'directory' | null
  email_dispatched: boolean
}

/**
 * Append a single outreach event row to the tracker sheet.
 * Fire-and-forget — never throws into the caller's critical path. Errors are
 * logged so failures show up in Vercel function logs.
 */
export async function appendOutreachRow(row: OutreachLogRow): Promise<void> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuthClient() })
    const tab = process.env.SHEETS_OUTREACH_TAB || 'Sheet1'

    const slotsText = (row.proposed_slots ?? [])
      .map((s) => s.display || s.iso)
      .join(' | ')

    const values = [[
      new Date().toISOString(),                  // A  minted_at
      row.first_name ?? '',                      // B  first_name
      row.full_name ?? '',                       // C  full_name
      row.phone ?? '',                           // D  phone
      row.panel ?? '',                           // E  panel
      row.language ?? '',                        // F  language
      row.tier ?? '',                            // G  tier
      row.observation ?? '',                     // H  observation
      row.invite_id,                             // I  invite_id
      row.invite_url,                            // J  invite_url
      slotsText,                                 // K  proposed_slots
      row.message_draft ?? '',                   // L  message_draft
      '',                                        // M  sent_at (filled later)
      row.contact_email ?? '',                   // N  contact_email
      row.email_source ?? '',                    // O  email_source
      row.email_dispatched ? 'yes' : 'no',       // P  email_dispatched
      '',                                        // Q  recipient_reply_status (filled later)
    ]]

    await sheets.spreadsheets.values.append({
      spreadsheetId: TRACKER_SHEET_ID,
      range: `${tab}!A:Q`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    })
  } catch (err) {
    console.warn('[sheets.outreach] append failed:', (err as Error).message)
  }
}
