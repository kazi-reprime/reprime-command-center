/**
 * CRM Integration Manager (Pipedrive) with Upstash Redis cache layering.
 * Falls back to local Target Crew Roster mappings if external services are unavailable.
 */

import { Redis } from '@upstash/redis';
import { normalizePhone } from './phone';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    })
  : null;

export interface CRMContact {
  id?: string;
  name: string;
  email: string;
  orgName?: string;
  dealStatus?: string;
}

export async function resolveContact(rawPhone: string): Promise<CRMContact | null> {
  const normalized = normalizePhone(rawPhone);
  const cacheKey = `crm:contact:${normalized}`;

  // 1. Check Upstash Redis Cache Layer
  if (redis) {
    try {
      const cached = await redis.get<CRMContact>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      console.warn('Redis Cache reading failed, proceeding to direct check:', e);
    }
  }

  // 2. Query Pipedrive Person Search APIs
  const pipedriveKey = process.env.PIPEDRIVE_API_KEY;
  if (pipedriveKey && pipedriveKey !== 'mock') {
    try {
      const searchUrl = `https://api.pipedrive.com/v1/persons/search?term=${encodeURIComponent(normalized)}&fields=phone&api_token=${pipedriveKey}`;
      const res = await fetch(searchUrl);
      if (res.ok) {
        const body = await res.json();
        if (body.data?.items && body.data.items.length > 0) {
          interface PipedriveItem {
            id: number;
            name: string;
            emails?: string[];
            organization?: { name?: string };
          }
          const item = body.data.items[0].item as PipedriveItem;
          const contact: CRMContact = {
            id: String(item.id),
            name: item.name,
            email: item.emails?.[0] || '',
            orgName: item.organization?.name || 'Independent',
            dealStatus: 'Active Deal Flow',
          };

          // Cache in Redis for 24 hours
          if (redis) {
            await redis.set(cacheKey, contact, { ex: 86400 });
          }
          return contact;
        }
      }
    } catch (e) {
      console.warn('Pipedrive connection failed, checking static roster:', e);
    }
  }

  // 3. Fallback to Target Crew Roster simulation
  const mockRoster: Record<string, CRMContact> = {
    '+13057784861': { name: 'Gideon Menachem Gratsiani', email: 'g@reprime.com', orgName: 'RePrime Capital', dealStatus: 'Principal' },
    '+17185505500': { name: 'Gideon Menachem Gratsiani', email: 'g@reprime.com', orgName: 'RePrime Capital', dealStatus: 'Principal' },
    '+12345678901': { name: 'Shirel Ben-Haroush', email: 'shirel@reprime.com', orgName: 'RePrime Capital', dealStatus: 'Operations' },
    '+12345678902': { name: 'Steve Philipp', email: 'steve@reprime.com', orgName: 'RePrime Capital', dealStatus: 'Investment Counsel' },
    '+12345678903': { name: 'Adir Yonasi', email: 'adir@reprime.com', orgName: 'RePrime Capital', dealStatus: 'Tech Lead' },
    '+12345678904': { name: 'Yaron Sitbon', email: 'yaron@reprime.com', orgName: 'RePrime Capital', dealStatus: 'Underwriter' },
    '+12345678905': { name: 'Chaim Abrahams', email: 'chaim@reprime.com', orgName: 'RePrime Capital', dealStatus: 'Legal Counsel' },
  };

  const matched = mockRoster[normalized];
  if (matched) {
    if (redis) {
      try {
        await redis.set(cacheKey, matched, { ex: 3600 }); // Cache mock entries for 1 hour
      } catch {
        // Ignore cache write errors
      }
    }
    return matched;
  }

  return null;
}
