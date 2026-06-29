// ─────────────────────────────────────────────────────────────────────────────
// Terminal Invitation Email Template
// ─────────────────────────────────────────────────────────────────────────────
//
// HOW TO SWAP IN STEVE'S DESIGN (one-time, takes 2 minutes):
//
//   1. Steve delivers a .html file with these three placeholders in the source:
//        {{FIRST_NAME}}  — recipient's first name
//        {{INVITE_URL}}  — the booking link (put on the CTA button href)
//        {{SLOTS_HTML}}  — pre-formatted slot list (optional; may be omitted)
//
//   2. Copy Steve's entire HTML (from <!DOCTYPE html> to </html>)
//
//   3. Replace the TEMPLATE string below with Steve's HTML — keeping the three
//      {{...}} placeholders exactly as-is in the source.
//
//   4. Push. Vercel deploys in ~30 seconds. Done forever.
//      Every Terminal invitation automatically uses the new design.
//
// ─────────────────────────────────────────────────────────────────────────────
// CURRENT STATUS: placeholder design (navy/gold). Replace with Steve's build.
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0; padding:0; background:#FAFAF9; font-family:'Poppins',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;">
    <tr><td align="center" style="padding:2rem 1rem;">
      <table width="100%" style="max-width:600px; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:#0E3470; padding:1.75rem 2rem; border-bottom:3px solid #FFCC33;">
          <span style="color:#FFCC33; letter-spacing:0.1em; font-size:0.8rem; text-transform:uppercase;">RePrime Group · Terminal Introduction</span>
        </td></tr>
        {{PERSONAL_MESSAGE_SECTION}}
        <tr><td style="padding:2.5rem 2rem;">
          <p style="color:#1F1D1A; font-size:1.05rem; margin:0 0 1.25rem; line-height:1.6;">{{FIRST_NAME}},</p>
          <p style="color:#1F1D1A; font-size:1rem; margin:0 0 1.25rem; line-height:1.7;">A time to connect properly — 30 minutes, direct.</p>
          <p style="color:#1F1D1A; font-size:1rem; margin:0 0 1.5rem; line-height:1.7;">Pick what works. One click confirms the slot, generates the Zoom link, and locks it on both our calendars.</p>
          {{SLOTS_HTML}}
          <table cellpadding="0" cellspacing="0"><tr><td style="background:#FFCC33; border-radius:4px;">
            <a href="{{INVITE_URL}}" style="display:inline-block; padding:0.85rem 2rem; color:#0E3470; text-decoration:none; font-weight:600; font-size:1rem;">Pick Your Time</a>
          </td></tr></table>
          <p style="color:#8A8680; font-size:0.85rem; margin:2.5rem 0 0; padding-top:1.5rem; border-top:1px solid #E5E2DB;">
            Gideon Gratsiani<br>Founder, RePrime Group
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

interface TerminalInvitationParams {
  firstName: string
  inviteUrl: string
  slots: Array<{ display: string }>
  /** Gideon's personal note — appears above the professional template in the email */
  personalMessage?: string
}

export function buildTerminalInvitationEmail(p: TerminalInvitationParams): { subject: string; html: string; text: string } {
  const subject = `Terminal Introduction — ${p.firstName}`

  const slotsHtml = p.slots.length > 0
    ? `<ul style="list-style:none; padding:0; margin:0 0 2rem;">${
        p.slots.map(s =>
          `<li style="padding:0.5rem 0; color:#1F1D1A; font-size:0.95rem; border-bottom:1px solid #F0EDE8;">${s.display}</li>`
        ).join('')
      }</ul>`
    : ''

  // Personal note section — shown between header and body when present
  const personalMessageSection = p.personalMessage
    ? `<tr><td style="padding:1.75rem 2rem 0; border-bottom:1px solid #E5E2DB;">
        <p style="color:#1F1D1A; font-size:1rem; line-height:1.75; margin:0; white-space:pre-wrap;">${p.personalMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </td></tr>`
    : ''

  const html = TEMPLATE
    .replace(/\{\{FIRST_NAME\}\}/g, p.firstName)
    .replace(/\{\{INVITE_URL\}\}/g, p.inviteUrl)
    .replace(/\{\{SLOTS_HTML\}\}/g, slotsHtml)
    .replace(/\{\{PERSONAL_MESSAGE_SECTION\}\}/g, personalMessageSection)

  const personalPart = p.personalMessage ? `${p.personalMessage}\n\n` : ''
  const text = `${personalPart}${p.firstName},

A time to connect properly — 30 minutes, direct.
${p.slots.length > 0 ? '\nAvailable times:\n' + p.slots.map(s => `  · ${s.display}`).join('\n') + '\n' : ''}
Book here: ${p.inviteUrl}

—
Gideon Gratsiani
Founder, RePrime Group`

  return { subject, html, text }
}
