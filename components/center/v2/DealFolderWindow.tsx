'use client'

import { useDealFolder } from '@/hooks/useDealFolder'

/**
 * DealFolderWindow — opens when a DealTile in /center/v2 is clicked.
 *
 * Groups everything related to one deal in a single window:
 *   - Header: deal name, value, stage, "open in Pipedrive" link
 *   - Bucket items tab (placeholder — gracefully empty if untagged)
 *   - Reminders / Threads / Files tabs are scaffolded for a follow-up
 *
 * Reuses the existing WindowManager — registered via the v2 WINDOW_REGISTRY
 * in app/center/v2/page.tsx so v1 doesn't accidentally inherit a half-
 * wired component.
 */

type DealFolderProps = {
  dealId?: number
  title?: string
  pipedriveUrl?: string
  stage?: string
  value?: number
  currency?: string
}

function formatCurrency(value?: number, currency?: string): string {
  if (!value || !Number.isFinite(value)) return ''
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `$${Math.round(value).toLocaleString('en-US')}`
  }
}

export default function DealFolderWindow({
  dealId,
  title,
  pipedriveUrl,
  stage,
  value,
  currency,
}: DealFolderProps) {
  const folder = useDealFolder(dealId ?? null)
  const valueStr = formatCurrency(value, currency)

  return (
    <div
      data-component="deal-folder-window"
      style={{
        height: '100%',
        width: '100%',
        background: '#0E3470',
        color: '#F5EFD8',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255, 204, 51, 0.22)',
          background: 'rgba(255, 204, 51, 0.06)',
        }}
      >
        <div
          style={{
            color: '#FFCC33',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.005em',
          }}
        >
          {title ?? 'Deal'}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            marginTop: 6,
            color: '#F5EFD8',
            fontSize: 13,
            opacity: 0.85,
          }}
        >
          {stage && (
            <span
              style={{
                background: 'rgba(255, 204, 51, 0.12)',
                border: '1px solid rgba(255, 204, 51, 0.45)',
                color: '#FFCC33',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {stage}
            </span>
          )}
          {valueStr && <span>{valueStr}</span>}
          {pipedriveUrl && (
            <a
              href={pipedriveUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: 'auto',
                color: '#FFCC33',
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              ↗ Open in Pipedrive
            </a>
          )}
        </div>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background:
            'var(--rp-reading-bg, linear-gradient(180deg, #F8F0DA 0%, #F4EEE0 60%, #EFE2C4 100%))',
          color: 'var(--rp-reading-fg, #3B2F1A)',
          padding: '18px 22px',
        }}
      >
        <Section title="Bucket items">
          {folder.isLoading && (
            <Placeholder>Loading bucket items…</Placeholder>
          )}
          {!folder.isLoading && folder.bucketItems.length === 0 && (
            <Placeholder>
              No bucket items tagged to this deal yet. Drag any open bucket
              item onto the tile to link it.
            </Placeholder>
          )}
          {!folder.isLoading && folder.bucketItems.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {folder.bucketItems.slice(0, 8).map((b) => (
                <li
                  key={b.id}
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(14, 52, 112, 0.06)',
                    border: '1px solid rgba(14, 52, 112, 0.14)',
                    borderRadius: 6,
                    marginBottom: 6,
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  {b.title}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Reminders">
          <Placeholder>Reminder grouping by deal lands in a follow-up.</Placeholder>
        </Section>
        <Section title="Related investors">
          <Placeholder>
            Pipedrive contacts on this deal — wires in once Pipedrive
            participants endpoint is exposed.
          </Placeholder>
        </Section>
        <Section title="Threads">
          <Placeholder>
            WhatsApp threads tagged to this deal will land here.
          </Placeholder>
        </Section>
        <Section title="Notes">
          <textarea
            placeholder="Your notes for this deal — auto-saves locally"
            defaultValue=""
            onBlur={(e) => {
              if (typeof window === 'undefined' || dealId == null) return
              try {
                window.localStorage.setItem(
                  `deal-folder:notes:${dealId}`,
                  e.target.value,
                )
              } catch {
                /* quota — ignore */
              }
            }}
            style={{
              width: '100%',
              minHeight: 100,
              padding: '10px 12px',
              fontFamily: 'inherit',
              fontSize: 14,
              lineHeight: 1.55,
              background: 'rgba(14, 52, 112, 0.04)',
              border: '1px solid rgba(14, 52, 112, 0.18)',
              borderRadius: 6,
              color: '#3B2F1A',
              resize: 'vertical',
            }}
          />
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#0E3470',
          opacity: 0.7,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        lineHeight: 1.55,
        color: 'rgba(14, 52, 112, 0.65)',
        background: 'rgba(14, 52, 112, 0.04)',
        border: '1px dashed rgba(14, 52, 112, 0.18)',
        borderRadius: 6,
        padding: '10px 12px',
      }}
    >
      {children}
    </div>
  )
}
