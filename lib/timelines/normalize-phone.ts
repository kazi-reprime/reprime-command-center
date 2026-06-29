export function normalizePhone(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 0) return null
  // WhatsApp internal IDs: country code + 10+ extra digits → reject
  if (digits.startsWith('1') && digits.length > 11) return null
  // E.164 max 15 digits
  if (digits.length > 15) return null
  // Too short
  if (digits.length < 7) return null
  // US 10-digit → prepend +1
  if (digits.length === 10) return `+1${digits}`
  // Already has country code
  return `+${digits}`
}
