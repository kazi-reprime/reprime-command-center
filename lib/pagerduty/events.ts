const ENQUEUE_URL = 'https://events.pagerduty.com/v2/enqueue'

export type Severity = 'critical' | 'error' | 'warning' | 'info'

export interface TriggerEventInput {
  summary: string
  source: string
  severity: Severity
  dedupKey?: string
  component?: string
  group?: string
  class?: string
  customDetails?: Record<string, unknown>
  links?: Array<{ href: string; text?: string }>
}

export interface EventResponse {
  status: string
  message: string
  dedup_key: string
}

function routingKey(): string {
  const k = process.env.PAGERDUTY_ROUTING_KEY
  if (!k) throw new Error('PAGERDUTY_ROUTING_KEY is not set')
  return k
}

async function send(body: Record<string, unknown>): Promise<EventResponse> {
  const res = await fetch(ENQUEUE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`PagerDuty enqueue failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<EventResponse>
}

export function triggerEvent(input: TriggerEventInput): Promise<EventResponse> {
  return send({
    routing_key: routingKey(),
    event_action: 'trigger',
    dedup_key: input.dedupKey,
    payload: {
      summary: input.summary,
      source: input.source,
      severity: input.severity,
      component: input.component,
      group: input.group,
      class: input.class,
      custom_details: input.customDetails,
    },
    links: input.links,
  })
}

export function resolveEvent(dedupKey: string): Promise<EventResponse> {
  return send({
    routing_key: routingKey(),
    event_action: 'resolve',
    dedup_key: dedupKey,
  })
}

export function acknowledgeEvent(dedupKey: string): Promise<EventResponse> {
  return send({
    routing_key: routingKey(),
    event_action: 'acknowledge',
    dedup_key: dedupKey,
  })
}
