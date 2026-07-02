import { NextResponse, type NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import {
  findPersonByPhone,
  PIPEDRIVE_FIELD_KEYS,
  type PipedriveActivity,
  type PipedrivePerson,
} from '@/lib/pipedrive/client'
import { getAllChats } from '@/lib/timelines/client'
import { normalizePhone } from '@/lib/timelines/normalize-phone'
import {
  formatPhoneDisplay,
  panelFromAccountId,
  parseTimelinesTimestamp,
} from '@/lib/timelines/parse'
import type { Panel, TimelinesChat, DashboardThread } from '@/lib/timelines/types'

export const dynamic = 'force-dynamic'
// Pipedrive enrichment + Timelines paging can stack to >10s. Default Vercel
// fn timeout is 10s on hobby; 60 is the Pro ceiling. Without this the function
// gets killed mid-flight and the UI shows "Error loading threads. Retry".
export const maxDuration = 60

const PIPEDRIVE_CACHE_TTL_SECONDS = 3600

type PipedriveCachePayload = {
  person: PipedrivePerson | null
  activities?: PipedriveActivity[]
  fieldKeys?: { dashboard: string; tag: string }
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function chatToThreadRow(chat: TimelinesChat) {
  const normalizedPhone = normalizePhone(chat.phone) || chat.phone
  const derivedPanel = panelFromAccountId(chat.whatsapp_account_id || '')
  // BUG 4: fall back to created_timestamp when last_message_timestamp is absent
  const tsSource = chat.last_message_timestamp || chat.created_timestamp || null
  const lastAt = tsSource ? parseTimelinesTimestamp(tsSource).toISOString() : null
  // BUG 2: treat any digit-only / zero / empty name as useless → fall to phone display
  const rawName = (chat.name || '').trim()
  const isUseless = !rawName || rawName === '0' || /^\d+$/.test(rawName)
  const contactName = isUseless ? formatPhoneDisplay(normalizedPhone) : rawName
  return {
    panel: derivedPanel,
    channel_type: 'whatsapp' as const,
    phone: normalizedPhone,
    contact_name: contactName,
    is_group: false,
    jid: chat.jid || null,
    last_message_at: lastAt,
    last_message_preview: null,
    unread_count: chat.read === false ? 1 : 0,
    pipedrive_contact_id: null,
    is_investor: false,
    is_family: false,
    is_staff: false,
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      // Kiosk mode: allow unauthenticated access for Command Center
    }

    const panelParam = request.nextUrl.searchParams.get('panel')
    if (panelParam !== '718' && panelParam !== '305') {
      return NextResponse.json({ error: 'invalid panel' }, { status: 400 })
    }
    const panel: Panel = panelParam

    let allChats: TimelinesChat[] = []
    let timelinesSkipped = false
    try {
      allChats = await getAllChats(panel)
      if (allChats.length > 0) {
        console.log('[threads] sample chat keys', Object.keys(allChats[0] as unknown as Record<string, unknown>))
      }
    } catch (timelinesErr: unknown) {
      const msg = (timelinesErr as any).message ?? ''
      const detail = (timelinesErr as any).response?.data ?? (timelinesErr as any).data ?? ''
      console.warn('[/api/whatsapp/threads] Timelines unavailable — falling back to DB cache', { 
        panel, 
        msg: msg.slice(0, 200),
        detail: typeof detail === 'string' ? detail.slice(0, 500) : JSON.stringify(detail).slice(0, 500)
      })
      timelinesSkipped = true
    }
    const chatsForThisPanel = allChats.filter(
      (chat) => panelFromAccountId(chat.whatsapp_account_id || '') === panel
    )
    console.log('[/api/whatsapp/threads] panel filter', {
      panel,
      total: allChats.length,
      kept: chatsForThisPanel.length,
    })

    const kept: TimelinesChat[] = []
    let discardedCount = 0
    for (const c of chatsForThisPanel) {
      const raw = c.phone
      const isInvalidRaw = raw == null || raw === '' || raw === '+0' || raw === '0'
      const normalized = isInvalidRaw ? null : normalizePhone(raw)
      const isGroupJid =
        typeof c.whatsapp_account_id === 'string' && c.whatsapp_account_id.endsWith('@g.us')
      // Skip if the contact phone matches the account phone (self-chat — sends would 403)
      const isSelfPhone = normalized === '+17185505500' || normalized === '+13057784861'
      if (isInvalidRaw || !normalized || c.is_group === true || isGroupJid || isSelfPhone) {
        discardedCount++
        continue
      }
      kept.push(c)
    }
    console.log('[/api/whatsapp/threads] filtered', {
      panel,
      total: chatsForThisPanel.length,
      kept: kept.length,
      discarded: discardedCount,
    })

    if (kept.length > 0) {
      console.log(
        '[/api/whatsapp/threads] sample chat shape',
        JSON.stringify(kept[0], null, 2)
      )
    }

    const service = createServiceClient()
    // When Timelines was skipped (quota 403) kept is empty — skip upsert entirely
    const rows = timelinesSkipped ? [] : kept.map((c) => chatToThreadRow(c))

    const sortedRows = rows.sort((a, b) => {
      const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return at - bt
    })
    const dedupedRows = Array.from(
      new Map(sortedRows.map((r) => [`${r.panel}:${r.phone}`, r])).values()
    )

    console.log('[/api/whatsapp/threads] dedup', {
      panel,
      kept: rows.length,
      deduped: dedupedRows.length,
    })

    if (dedupedRows.length > 0) {
      const { error: upsertErr } = await service
        .from('whatsapp_threads')
        .upsert(dedupedRows, { onConflict: 'panel,phone,channel_type' })
      if (upsertErr) {
        console.error('[/api/whatsapp/threads] DB error', {
          error: upsertErr?.message,
          code: upsertErr?.code,
          details: upsertErr?.details,
          hint: upsertErr?.hint,
          panel,
        })
        return NextResponse.json(
          { error: 'db_upsert_failed', message: upsertErr.message },
          { status: 500 }
        )
      }
    }

    // Pull all channel types for this panel. The whatsapp_threads table is
    // shared across multiple channels — channel_type discriminates them:
    //   305 panel → 'whatsapp' (Timelines) + 'sms' (Quo)
    //   718 panel → 'whatsapp' (Timelines) + 'imessage' (BlueBubbles cloud Mac)
    //                                      + 'sms' (BlueBubbles when iPhone gets a real SMS)
    // ChatList renders a small badge for non-whatsapp channels (SMS, iMessage).
    const channelsToFetch =
      panel === '305'
        ? ['whatsapp', 'sms']
        : ['whatsapp', 'imessage', 'sms']
    const { data: threads, error: selectErr } = await service
      .from('whatsapp_threads')
      .select('*')
      .eq('panel', panel)
      .in('channel_type', channelsToFetch)
      .or('is_blocked.is.null,is_blocked.eq.false') // hide blocked contacts; null treats pre-migration rows as not-blocked
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (selectErr) {
      console.error('[/api/whatsapp/threads] DB error', {
        error: selectErr?.message,
        code: selectErr?.code,
        details: selectErr?.details,
        hint: selectErr?.hint,
        panel,
      })
      return NextResponse.json(
        { error: 'db_select_failed', message: selectErr.message },
        { status: 500 }
      )
    }

    const phoneToThreadId = new Map<string, string>()
    for (const t of threads ?? []) {
      if (t.phone && t.id && !phoneToThreadId.has(t.phone)) {
        phoneToThreadId.set(t.phone, t.id)
      }
    }
    const uniquePhones = Array.from(phoneToThreadId.keys())

    let cacheHits = 0
    let cacheMisses = 0
    let pipedriveErrors = 0
    let pipedriveMatches = 0
    const redis = getRedis()
    type EnrichmentPatch = {
      id: string
      pipedrive_contact_id: number | null
      contact_name: string
    }
    const patches: EnrichmentPatch[] = []

    await Promise.all(
      uniquePhones.map(async (phone) => {
        const cacheKey = `pipedrive:phone:${phone}`
        let payload: PipedriveCachePayload | null = null

        if (redis) {
          try {
            const cached = await redis.get<PipedriveCachePayload>(cacheKey)
            if (cached) {
              cacheHits++
              payload = cached
            } else {
              cacheMisses++
            }
          } catch (err) {
            console.error('[/api/whatsapp/threads] redis read failed', {
              phone,
              message: (err as Error).message,
            })
            cacheMisses++
          }
        } else {
          cacheMisses++
        }

        if (!payload) {
          try {
            const person = await findPersonByPhone(phone)
            payload = {
              person,
              activities: [],
              fieldKeys: {
                dashboard: PIPEDRIVE_FIELD_KEYS.NOTES_FROM_DASHBOARD,
                tag: PIPEDRIVE_FIELD_KEYS.TAG,
              },
            }
            if (redis) {
              try {
                await redis.set(cacheKey, payload, {
                  ex: PIPEDRIVE_CACHE_TTL_SECONDS,
                  nx: true,
                })
              } catch (err) {
                console.error('[/api/whatsapp/threads] redis write failed', {
                  phone,
                  message: (err as Error).message,
                })
              }
            }
          } catch (err) {
            pipedriveErrors++
            console.error('[/api/whatsapp/threads] pipedrive lookup failed', {
              phone,
              message: (err as Error).message,
            })
            return
          }
        }

        const person = payload.person
        const threadId = phoneToThreadId.get(phone)
        if (!threadId) return

        if (person) {
          pipedriveMatches++
          patches.push({
            id: threadId,
            pipedrive_contact_id: person.id,
            contact_name: person.name,
          })
          return
        }

        // No Pipedrive match — fall back to contact_directory phonebook
        // (the 939 NonInvestors_Final rows ingested from the xlsx).
        try {
          const { lookupByPhone } = await import('@/lib/contact-directory/client')
          const callerId = await lookupByPhone(phone)
          if (callerId?.canonical_name) {
            patches.push({
              id: threadId,
              pipedrive_contact_id: null, // matched via phonebook, no Pipedrive Person
              contact_name: callerId.canonical_name,
            })
          }
        } catch (err) {
          console.warn('[/api/whatsapp/threads] phonebook lookup failed', {
            phone,
            message: (err as Error).message,
          })
        }
      })
    )

    const cacheTotal = cacheHits + cacheMisses
    const cacheHitRate =
      cacheTotal > 0 ? (cacheHits / cacheTotal).toFixed(2) : '0.00'
    console.log('[/api/whatsapp/threads] pipedrive enrichment', {
      panel,
      uniquePhones: uniquePhones.length,
      cacheHits,
      cacheMisses,
      cacheHitRate,
      pipedriveMatches,
      pipedriveErrors,
    })

    if (patches.length > 0) {
      const updateResults = await Promise.all(
        patches.map((p) => {
          // Only patch pipedrive_contact_id when the enrichment came from
          // a real Pipedrive match — phonebook hits leave it null.
          const update: Record<string, unknown> = { contact_name: p.contact_name }
          if (p.pipedrive_contact_id !== null) {
            update.pipedrive_contact_id = p.pipedrive_contact_id
          }
          return service
            .from('whatsapp_threads')
            .update(update)
            .eq('id', p.id)
        })
      )
      const updateErrorCount = updateResults.filter((r) => r.error).length
      if (updateErrorCount > 0) {
        console.error('[/api/whatsapp/threads] enrichment update errors', {
          count: updateErrorCount,
          panel,
        })
      }

      const patchById = new Map(patches.map((p) => [p.id, p]))
      for (const t of threads ?? []) {
        const p = patchById.get(t.id)
        if (p) {
          t.contact_name = p.contact_name
          t.pipedrive_contact_id = p.pipedrive_contact_id
        }
      }
    }

    const threadIds = (threads || []).map((t) => t.id)
    let investorIds = new Set<string>()
    if (threadIds.length > 0) {
      const { data: tagJoins } = await service
        .from('thread_tags')
        .select('thread_id, tags!inner(is_investor)')
        .in('thread_id', threadIds)
        .eq('tags.is_investor', true)
      investorIds = new Set((tagJoins || []).map((t: { thread_id: string }) => t.thread_id))
    }

    // UNION with Pipedrive TAG-based investor flag (Pipedrive is now source of truth).
    // Reuses the same Upstash cache key as /api/whatsapp/investor-chat-threads.
    const investorTierByThreadId = new Map<string, { tier: 'A' | 'B' | 'C' | 'D' | null; role: 'principal' | 'connector' | null }>()
    try {
      const cacheKey = 'pipedrive:investors:tagged:v1'
      let pdInvestors: Array<{ id: number; tier: 'A' | 'B' | 'C' | 'D' | null; role: 'principal' | 'connector' | null; phones: string[] }> | null = null
      if (redis) {
        try {
          const cached = await redis.get<typeof pdInvestors>(cacheKey)
          if (cached && Array.isArray(cached)) pdInvestors = cached
        } catch {}
      }
      if (!pdInvestors) {
        const { listInvestorTaggedPersons } = await import('@/lib/pipedrive/client')
        const fresh = await listInvestorTaggedPersons()
        pdInvestors = fresh.map((p) => ({ id: p.id, tier: p.tier, role: p.role, phones: p.phones }))
        if (redis) {
          try { await redis.set(cacheKey, pdInvestors, { ex: 3600 }) } catch {}
        }
      }
      const pdById = new Map(pdInvestors.map((p) => [p.id, p]))
      const pdByPhone = new Map<string, typeof pdInvestors[number]>()
      for (const p of pdInvestors) {
        for (const ph of p.phones) {
          const norm = normalizePhone(ph)
          if (norm) pdByPhone.set(norm, p)
        }
      }
      for (const t of threads ?? []) {
        let pd = t.pipedrive_contact_id ? pdById.get(t.pipedrive_contact_id) : undefined
        if (!pd) pd = pdByPhone.get(t.phone)
        if (pd) {
          investorIds.add(t.id)
          investorTierByThreadId.set(t.id, { tier: pd.tier, role: pd.role })
        }
      }
    } catch (err) {
      console.warn('[/api/whatsapp/threads] Pipedrive investor list failed — keeping thread_tags-only', { message: (err as Error).message })
    }

    const previewByChatId = new Map<number, string>()
    for (const c of allChats) {
      if (c.last_message_uid && (c as TimelinesChat & { last_message_text?: string }).last_message_text) {
        previewByChatId.set(c.id, (c as TimelinesChat & { last_message_text?: string }).last_message_text || '')
      }
    }

    const result: DashboardThread[] = (threads || []).map(
      (t: {
        id: string
        panel: Panel
        phone: string
        contact_name: string | null
        is_group: boolean
        jid: string | null
        last_message_at: string | null
        last_message_preview: string | null
        unread_count: number | null
        pipedrive_contact_id: number | null
        timelines_chat_id: number | null
        is_priority: boolean | null
      }) => ({
        id: t.id,
        panel: t.panel,
        channel_type: 'whatsapp' as const,
        phone: t.phone,
        contact_name: t.contact_name,
        is_group: t.is_group,
        jid: t.jid,
        last_message_at: t.last_message_at,
        last_message_preview: t.last_message_preview,
        unread_count: t.unread_count ?? 0,
        pipedrive_contact_id: t.pipedrive_contact_id,
        is_investor: investorIds.has(t.id),
        is_family: t.is_family ?? false,
        is_staff: t.is_staff ?? false,
        investor_tier: investorTierByThreadId.get(t.id)?.tier ?? null,
        investor_role: investorTierByThreadId.get(t.id)?.role ?? null,
        is_priority: t.is_priority ?? false,
      })
    )

    return NextResponse.json({ threads: result })
  } catch (e: unknown) {
    console.error('[/api/whatsapp/threads] handler error', { message: (e as Error)?.message, stack: (e as Error)?.stack })
    return NextResponse.json({ error: 'Failed to load threads', detail: (e as Error)?.message }, { status: 502 })
  }
}
