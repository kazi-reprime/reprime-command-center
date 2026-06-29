// Simple shared-password gate for the Command Center. Gideon: password sbh770.
// (Override via CENTER_PASSWORD env in Vercel; rotate later — see source-of-truth doc.)
export const CENTER_PASS = process.env.CENTER_PASSWORD || 'sbh770'

export function centerAuthed(req: Request): boolean {
  const p = req.headers.get('x-center-pass') || ''
  return p === CENTER_PASS
}

// Parse one pasted line into {name, phone, email}. Tolerant of:
//   "Name", "Name, +972 5x", "Name | +972 | a@b.com", "+972...", "a@b.com",
//   tab/comma/pipe separated, Hebrew or English names.
export function parseLine(line: string): { name: string; phone: string; email: string } | null {
  const raw = (line || '').trim()
  if (!raw) return null
  const email = (raw.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/) || [''])[0]
  let rest = raw.replace(email, '')
  const phoneMatch = rest.match(/\+?\d[\d()\-\s]{6,}\d/)
  let phone = ''
  if (phoneMatch) {
    const d = phoneMatch[0].replace(/\D/g, '')
    if (d.length >= 9) {
      if (d.startsWith('972')) phone = '+' + d
      else if (d.startsWith('05') && d.length === 10) phone = '+972' + d.slice(1)
      else if (d.startsWith('5') && d.length === 9) phone = '+972' + d
      else if (d.startsWith('1') && d.length === 11) phone = '+' + d
      else if (d.length === 10) phone = '+1' + d
      else phone = '+' + d
      rest = rest.replace(phoneMatch[0], '')
    }
  }
  const name = rest.replace(/[|,;\t]+/g, ' ').replace(/\s+/g, ' ').trim()
  return { name, phone, email }
}
