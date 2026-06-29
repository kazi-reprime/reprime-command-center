/**
 * Inforuptcy Scraper Task using Playwright.
 * Handles headless login to Inforuptcy, polls Redis/Database for Twilio 2FA codes,
 * and ingests new bankruptcy filing records.
 */

import { chromium } from 'playwright';
import { Redis } from '@upstash/redis';
import { createServiceClient } from '@/lib/supabase/server';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    })
  : null;

export interface DocketFiling {
  caseNumber: string;
  debtor: string;
  chapter: string;
  dateFiled: string;
  court: string;
}

/**
 * Polls Redis or the messages table for an incoming 2FA code.
 */
async function pollFor2FACode(maxWaitSeconds = 60): Promise<string> {
  const startTime = Date.now();
  console.log('Inforuptcy Worker: Polling for 2FA passcode...');

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    // 1. Check Redis memory cache
    if (redis) {
      try {
        const cachedCode = await redis.get<string>('auth:2fa:inforuptcy');
        if (cachedCode) {
          await redis.del('auth:2fa:inforuptcy'); // Consume code
          console.log('Inforuptcy Worker: Found 2FA code in Redis cache!');
          return cachedCode;
        }
      } catch (err) {
        console.warn('Redis 2FA poll failed, falling back:', err);
      }
    }

    // 2. Check Postgres messages table for recent SMS
    try {
      const twoMinutesAgo = new Date(Date.now() - 120 * 1000).toISOString();
      const service = createServiceClient();
      const { data: recentMessages, error } = await service
        .from('whatsapp_messages')
        .select('body, created_at')
        .gte('created_at', twoMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error && recentMessages) {
        for (const msg of recentMessages) {
          const bodyLower = (msg.body || '').toLowerCase();
          if (bodyLower.includes('inforuptcy') || bodyLower.includes('verification') || bodyLower.includes('code')) {
            const digitsMatch = (msg.body || '').match(/\b\d{5,6}\b/);
            if (digitsMatch) {
              console.log('Inforuptcy Worker: Found 2FA code in Database messages!');
              return digitsMatch[0];
            }
          }
        }
      }
    } catch (err) {
      console.warn('Database messages check failed:', err);
    }

    // Wait 2.5s before next polling attempt
    await new Promise((r) => setTimeout(r, 2500));
  }

  throw new Error('Inforuptcy Worker: 2FA passcode polling timed out.');
}

/**
 * Runs the Playwright automation flow.
 * If credentials are not configured, runs in high-fidelity simulation mode.
 */
export async function runInforuptcyIngestion(): Promise<DocketFiling[]> {
  const username = process.env.INFORUPTCY_USERNAME;
  const password = process.env.INFORUPTCY_PASSWORD;

  if (!username || !password || username === 'mock') {
    console.log('Inforuptcy Worker: Running in simulation mode (credentials unconfigured).');
    await new Promise((r) => setTimeout(r, 1500)); // simulate load
    return getSimulatedFilings();
  }

  console.log('Inforuptcy Worker: Launching headless browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Navigate to login
    await page.goto('https://www.inforuptcy.com/login');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // 2. Wait for 2FA screen or input field
    console.log('Inforuptcy Worker: Reached authentication challenge. Waiting for 2FA input field...');
    await page.waitForSelector('input[name="two_factor_code"]', { timeout: 10000 });

    // 3. Poll for the 2FA SMS from Twilio Webhook
    const passcode = await pollFor2FACode(60);

    // 4. Submit 2FA code
    await page.fill('input[name="two_factor_code"]', passcode);
    await page.click('button[type="submit"]');

    // 5. Navigate to filings dashboard / search
    console.log('Inforuptcy Worker: Logged in successfully. Navigating to docket feed...');
    await page.goto('https://www.inforuptcy.com/dashboard/filings');
    await page.waitForSelector('.filings-table', { timeout: 10000 });

    // 6. Scrape recent docket rows
    const filings: DocketFiling[] = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.filings-table tr.filing-row'));
      return rows.map((row) => {
        const cells = Array.from(row.querySelectorAll('td'));
        return {
          caseNumber: cells[0]?.innerText.trim() || '',
          debtor: cells[1]?.innerText.trim() || '',
          chapter: cells[2]?.innerText.trim() || '',
          dateFiled: cells[3]?.innerText.trim() || '',
          court: cells[4]?.innerText.trim() || '',
        };
      });
    });

    console.log(`Inforuptcy Worker: Scraped ${filings.length} new filings.`);
    return filings;
  } catch (err) {
    console.error('Inforuptcy Worker failed during execution:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

function getSimulatedFilings(): DocketFiling[] {
  return [
    {
      caseNumber: '26-10492-JKS',
      debtor: 'Riverside Retail Developers LLC',
      chapter: 'Chapter 11',
      dateFiled: new Date().toLocaleDateString(),
      court: 'Southern District of Florida',
    },
    {
      caseNumber: '26-20512-RAM',
      debtor: 'South Beach Logistics Group Inc.',
      chapter: 'Chapter 7',
      dateFiled: new Date(Date.now() - 24 * 3600 * 1000).toLocaleDateString(),
      court: 'Southern District of Florida',
    },
    {
      caseNumber: '26-11204-SMB',
      debtor: 'Empire State Holdings Ltd.',
      chapter: 'Chapter 11',
      dateFiled: new Date(Date.now() - 48 * 3600 * 1000).toLocaleDateString(),
      court: 'Southern District of New York',
    },
  ];
}
