'use client'

import { useEffect, useMemo, useState } from 'react'

interface SlotSelectorProps {
  value?: string[]
  onChange: (isoStrings: string[]) => void
}

function nextWeekdayBusinessSlots(): string[] {
  const slots: string[] = []
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)
  const candidate = new Date(tomorrow)
  while (slots.length < 3) {
    const dow = candidate.getDay()
    if (dow !== 0 && dow !== 6) {
      const yyyy = candidate.getFullYear()
      const mm = String(candidate.getMonth() + 1).padStart(2, '0')
      const dd = String(candidate.getDate()).padStart(2, '0')
      const hh = String(candidate.getHours()).padStart(2, '0')
      const mn = String(candidate.getMinutes()).padStart(2, '0')
      slots.push(`${yyyy}-${mm}-${dd}T${hh}:${mn}`)
    }
    candidate.setDate(candidate.getDate() + 1)
  }
  return slots
}

function offsetForCentral(localYmdHm: string): string {
  const [d, t] = localYmdHm.split('T')
  const [y, mo, day] = d.split('-').map(Number)
  const [hh, mm] = (t || '00:00').split(':').map(Number)
  if (!y || !mo || !day) return '-05:00'
  const utcCdt = Date.UTC(y, mo - 1, day, hh + 5, mm)
  const probe = new Date(utcCdt)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = fmt.formatToParts(probe)
  const get = (n: string) => Number(parts.find((p) => p.type === n)?.value)
  if (get('hour') === hh && get('day') === day && get('month') === mo) return '-05:00'
  return '-06:00'
}

function localToCentralIso(local: string): string {
  if (!local) return ''
  const offset = offsetForCentral(local)
  return `${local}:00${offset}`
}

function centralIsoToLocal(iso: string): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)
  return m ? m[1] : ''
}

export function formatSlotDisplay(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  })
  return `${fmt.format(d)} Central`
}

export default function SlotSelector({ value, onChange }: SlotSelectorProps) {
  const defaults = useMemo(() => nextWeekdayBusinessSlots(), [])
  const [locals, setLocals] = useState<string[]>(() =>
    value && value.length === 3 ? value.map(centralIsoToLocal) : defaults
  )

  useEffect(() => {
    onChange(locals.map(localToCentralIso))
  }, [locals, onChange])

  function update(idx: number, v: string) {
    setLocals((prev) => prev.map((p, i) => (i === idx ? v : p)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <label style={{ color: '#8A8680', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Three slots · 30 min each · Central
      </label>
      {locals.map((local, idx) => {
        const iso = localToCentralIso(local)
        return (
          <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ color: '#FFCC33', fontSize: '0.85rem', minWidth: '1.5rem' }}>{idx + 1}.</span>
            <input
              type="datetime-local"
              value={local}
              step={60 * 30}
              onChange={(e) => update(idx, e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                background: '#0E3470',
                color: '#fff',
                border: '1px solid rgba(14, 52, 112, 0.70)',
                borderRadius: '4px',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
              }}
            />
            <span style={{ color: '#8A8680', fontSize: '0.75rem', minWidth: '8rem' }}>
              {iso ? formatSlotDisplay(iso) : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
