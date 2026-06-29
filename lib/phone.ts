/**
 * Normalizes phone numbers to standard E.164 format (+[country_code][number]).
 * Implements heuristics to handle typical US (+1) and international formats.
 */
export function normalizePhone(phone: string): string {
  // 1. Strip all spaces, hyphens, brackets, and characters except numbers and '+'
  const cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // 2. If it's a 10-digit number (standard US/Canada), prepend '+1'
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // 3. If it's an 11-digit number starting with '1' (US country code omitted prefix), prepend '+'
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // 4. Default fallback: prepend '+' if missing, assuming it's already structured internationally
  return `+${cleaned}`;
}
