/**
 * Security: Secret Redactor
 * 
 * Strips sensitive values from log output and error messages.
 * Used by the audit logger and error handlers.
 */

const SENSITIVE_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'TIMELINES_API_KEY',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'SENDGRID_API_KEY',
  'RESEND_API_KEY',
  'ELEVENLABS_API_KEY',
  'ZOOM_CLIENT_SECRET',
  'TWILIO_AUTH_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'UPSTASH_REDIS_REST_TOKEN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PIPEDRIVE_API_TOKEN',
  'QUO_API_KEY',
  'BLUEBUBBLES_WEBHOOK_SECRET',
  'META_WA_ACCESS_TOKEN',
]

/** Build a list of actual secret values from env vars (excluding empty/mock) */
function getSecretValues(): string[] {
  const values: string[] = []
  for (const key of SENSITIVE_ENV_KEYS) {
    const val = process.env[key]
    if (val && val.length > 8 && !val.includes('mock')) {
      values.push(val)
    }
  }
  return values
}

/** Redact all known secret values from a string */
export function redactSecrets(text: string): string {
  const secrets = getSecretValues()
  let result = text
  for (const secret of secrets) {
    if (secret.length < 8) continue
    // Show first 4 and last 4 chars
    const redacted = `${secret.slice(0, 4)}…[REDACTED]…${secret.slice(-4)}`
    // Use global replace
    while (result.includes(secret)) {
      result = result.replace(secret, redacted)
    }
  }
  return result
}

/** Redact secrets from an Error object */
export function redactError(err: Error): Error {
  const redacted = new Error(redactSecrets(err.message))
  redacted.name = err.name
  if (err.stack) {
    redacted.stack = redactSecrets(err.stack)
  }
  return redacted
}

/** Redact secrets from an arbitrary object (for logging) */
export function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const SENSITIVE_KEY_RE = /key|token|secret|password|auth|credential|api_key|apikey/i

  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_RE.test(k) && typeof v === 'string') {
      result[k] = v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-4)}` : '***'
    } else if (typeof v === 'string') {
      result[k] = redactSecrets(v)
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = redactObject(v as Record<string, unknown>)
    } else {
      result[k] = v
    }
  }
  return result
}
