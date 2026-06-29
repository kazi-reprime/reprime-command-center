import { describe, it, expect } from 'vitest'
import { isFresh, BUCKET_CACHE_FRESH_MS, type BucketCacheEnvelope } from './cache'

describe('bucket/cache.isFresh', () => {
  it('returns false for null', () => {
    expect(isFresh(null)).toBe(false)
  })

  it('returns true for a freshly-cached envelope', () => {
    const env: BucketCacheEnvelope = { cachedAt: Date.now(), items: [] }
    expect(isFresh(env)).toBe(true)
  })

  it('returns true at the boundary minus 1ms', () => {
    const env: BucketCacheEnvelope = {
      cachedAt: Date.now() - (BUCKET_CACHE_FRESH_MS - 1),
      items: [],
    }
    expect(isFresh(env)).toBe(true)
  })

  it('returns false once older than the freshness window', () => {
    const env: BucketCacheEnvelope = {
      cachedAt: Date.now() - (BUCKET_CACHE_FRESH_MS + 1),
      items: [],
    }
    expect(isFresh(env)).toBe(false)
  })
})
