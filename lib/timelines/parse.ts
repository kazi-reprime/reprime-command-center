export function parseTimelinesTimestamp(ts: string): Date {
  const m = ts.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{4})/)
  if (!m) return new Date(ts)
  return new Date(`${m[1]}T${m[2]}${m[3]}`)
}

export function panelFromAccountId(accountId: string): '718' | '305' {
  const digits = accountId.replace(/\D/g, '')
  if (digits === '17185505500' || digits === '7185505500') return '718'
  if (digits === '13057784861' || digits === '3057784861') return '305'
  return digits.startsWith('1718') ? '718' : '305'
}

export function formatPhoneDisplay(phone: string): string {
  if (!phone) return ''
  const m = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  if (m) return `+1 (${m[1]}) ${m[2]}-${m[3]}`
  const m972 = phone.match(/^\+972(\d{1,2})(\d{3})(\d{4})$/)
  if (m972) return `+972 ${m972[1]}-${m972[2]}-${m972[3]}`
  return phone
}

export function getMediaType(filename: string | null): 'image' | 'document' | 'audio' | 'video' | null {
  if (!filename) return null
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (['jpg','jpeg','png','gif','webp','heic','heif'].includes(ext)) return 'image'
  // WhatsApp voice notes arrive as .oga (Ogg/Opus); .amr/.mka also seen. Without
  // these here a voice note falls through to 'document' and shows as "📎 document".
  if (['mp3','ogg','oga','opus','wav','m4a','aac','amr','mka'].includes(ext)) return 'audio'
  if (['mp4','mov','avi','mkv','webm','m4v','3gp'].includes(ext)) return 'video'
  if (['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','rtf','zip'].includes(ext)) return 'document'
  return 'document'
}

export function isHebrew(text: string | null | undefined): boolean {
  if (!text) return false
  return /[֐-׿יִ-ﭏ]/.test(text)
}
