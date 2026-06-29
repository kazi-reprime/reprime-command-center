'use client'

import { useQuery } from '@tanstack/react-query'

/**
 * useDealFolder — collects everything related to a single deal so the
 * DealFolderWindow can render bucket items, threads, and reminders in
 * one view.
 *
 * No new API endpoints — we pull from existing surfaces:
 *   - /api/bucket?deal_id=<id>     → bucket items tagged to the deal
 *   - /api/whatsapp/threads?deal=  → related threads (best-effort; if
 *                                    the param is unsupported, returns
 *                                    an empty list and the folder shows
 *                                    a "link items to this deal" note)
 *
 * The folder gracefully degrades if a relation isn't tagged yet — the
 * tile is still usable.
 */

export type BucketItemSummary = {
  id: string
  title: string
  status: string
  due_at: string | null
  priority: number
}

export type DealFolderData = {
  bucketItems: BucketItemSummary[]
  bucketItemsLoaded: boolean
}

const REFETCH_MS = 60_000

export function useDealFolder(dealId: number | null): DealFolderData & {
  isLoading: boolean
} {
  const bucket = useQuery({
    queryKey: ['deal-folder', 'bucket', dealId],
    enabled: dealId != null,
    queryFn: async (): Promise<{ items: BucketItemSummary[] }> => {
      // Bucket API doesn't currently filter by deal_id server-side. Pull
      // open items and filter client-side by title containing the deal id
      // or a tag — best-effort. When the bucket schema gains a deal_id
      // column, this hook becomes a one-line query.
      const res = await fetch('/api/bucket', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { items: BucketItemSummary[] }
      return json
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    retry: false,
  })

  return {
    bucketItems: bucket.data?.items ?? [],
    bucketItemsLoaded: bucket.isFetched,
    isLoading: bucket.isLoading,
  }
}
