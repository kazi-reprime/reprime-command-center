'use client'

import { useEffect, useState } from 'react'
import SearchModal from '@/components/chat/SearchModal'
import QuickCallModal from '@/components/phone/QuickCallModal'
import QuickEmailModal from '@/components/email/QuickEmailModal'
import BriefingModal from '@/components/briefing/BriefingModal'
import { dispatchOpenWindow } from '@/lib/windows/store'
import type { DashboardThread } from '@/lib/timelines/types'

/**
 * VoiceModalsHost — mounts the four voice-targeted modals on /center and
 * listens for the CustomEvents the VoiceShell dispatches.
 *
 *   center:open-search   { detail: { query?: string } }    → SearchModal
 *   center:open-call     { detail: { name?: string } }     → QuickCallModal
 *   center:open-email    { detail: { name?, subject?, body? } } → QuickEmailModal
 *   center:open-briefing                                   → BriefingModal
 *
 * The VoiceShell does not import these modals — events keep the dependency
 * graph one-way. Other tracks can dispatch the same events to open the
 * modals from anywhere on the kiosk.
 */
export default function VoiceModalsHost() {
  const [search, setSearch] = useState<{ open: boolean; q: string }>({ open: false, q: '' })
  const [call, setCall] = useState<{ open: boolean; name: string }>({ open: false, name: '' })
  const [email, setEmail] = useState<{ open: boolean; to: string; subject: string; body: string }>({
    open: false,
    to: '',
    subject: '',
    body: '',
  })
  const [briefing, setBriefing] = useState(false)

  useEffect(() => {
    const onSearch = (e: Event) => {
      const ce = e as CustomEvent<{ query?: string }>
      setSearch({ open: true, q: (ce.detail?.query ?? '').trim() })
    }
    const onCall = (e: Event) => {
      const ce = e as CustomEvent<{ name?: string }>
      setCall({ open: true, name: (ce.detail?.name ?? '').trim() })
    }
    const onEmail = (e: Event) => {
      const ce = e as CustomEvent<{ name?: string; subject?: string; body?: string }>
      const d = ce.detail ?? {}
      // Voice gives us a name, not a resolved address. Pre-fill the modal's
      // "to" field with the name as a hint; Gideon types or picks the real
      // address. Subject/body flow straight through.
      setEmail({
        open: true,
        to: (d.name ?? '').trim(),
        subject: (d.subject ?? '').trim(),
        body: (d.body ?? '').trim(),
      })
    }
    const onBriefing = () => setBriefing(true)

    window.addEventListener('center:open-search', onSearch)
    window.addEventListener('center:open-call', onCall)
    window.addEventListener('center:open-email', onEmail)
    window.addEventListener('center:open-briefing', onBriefing)
    return () => {
      window.removeEventListener('center:open-search', onSearch)
      window.removeEventListener('center:open-call', onCall)
      window.removeEventListener('center:open-email', onEmail)
      window.removeEventListener('center:open-briefing', onBriefing)
    }
  }, [])

  // SearchModal/BriefingModal both surface a thread-click. On /center the
  // legacy thread-pane flow doesn't exist yet, so route the click into the
  // window manager via an investor-profile component window. Closing the
  // modal is independent of opening the window.
  // BriefingModal uses its own BriefingThread shape — only the id/name/phone
  // fields we need overlap with DashboardThread, so type the adapter loosely.
  const openThreadWindow = (t: { id: string; contact_name?: string | null; phone?: string | null }) => {
    dispatchOpenWindow('investor-profile', {
      title: t.contact_name ?? 'Thread',
      componentProps: {
        id: t.id,
        name: t.contact_name ?? t.phone ?? '—',
      },
    })
  }

  return (
    <>
      <SearchModal
        open={search.open}
        onClose={() => setSearch((s) => ({ ...s, open: false }))}
        onSelect={(t) => {
          openThreadWindow(t)
          setSearch((s) => ({ ...s, open: false }))
        }}
        initialQuery={search.q}
      />
      <QuickCallModal
        open={call.open}
        onClose={() => setCall((s) => ({ ...s, open: false }))}
        initialName={call.name}
      />
      <QuickEmailModal
        open={email.open}
        onClose={() => setEmail((s) => ({ ...s, open: false }))}
        initialTo={email.to}
        initialSubject={email.subject}
        initialBody={email.body}
      />
      <BriefingModal
        open={briefing}
        onClose={() => setBriefing(false)}
        onThreadClick={openThreadWindow}
      />
    </>
  )
}
