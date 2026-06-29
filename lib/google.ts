/**
 * Google APIs Client Integration.
 * Handles OAuth 2.0 token refreshes, Gmail triage/scoring, and Calendar meeting link parsing.
 * Includes a simulation mode for development when OAuth credentials are absent.
 */

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  score: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  meetingUrl?: string;
}

/**
 * Refreshes the Google OAuth token using the environment variables.
 */
export async function getGoogleAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken || clientId === 'mock') {
    throw new Error('Google OAuth credentials not configured.');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to refresh Google OAuth token: ${errorText}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Score emails based on priority keywords and sender authority.
 */
export function scoreEmail(subject: string, from: string, snippet: string): number {
  let score = 0;
  const text = `${subject} ${snippet}`.toLowerCase();

  // Sender domain analysis
  const criticalDomains = ['reprime.com', 'riverside', 'gideon', 'kazi', 'legal'];
  if (criticalDomains.some((d) => from.toLowerCase().includes(d))) {
    score += 15;
  }

  // Hot keyword scoring rules
  if (text.includes('term sheet') || text.includes('termsheet')) score += 12;
  if (text.includes('investment') || text.includes('capital') || text.includes('funding')) score += 10;
  if (text.includes('nda') || text.includes('agreement') || text.includes('contract')) score += 8;
  if (text.includes('wire') || text.includes('payment') || text.includes('transfer')) score += 8;
  if (text.includes('urgent') || text.includes('asap') || text.includes('deadline')) score += 6;
  if (text.includes('zoom') || text.includes('meeting') || text.includes('call')) score += 4;

  // Negative filtering for newsletters/automated alerts
  if (text.includes('unsubscribe') || text.includes('newsletter') || text.includes('digest')) {
    score -= 15;
  }

  return score;
}

/**
 * Extract Zoom or Google Meet URLs from text strings.
 */
export function extractMeetingUrl(location?: string, description?: string): string | undefined {
  const urlRegex = /(https?:\/\/[^\s$.?#].[^\s]*)/gi;
  const matches = [
    ...(location?.match(urlRegex) || []),
    ...(description?.match(urlRegex) || []),
  ];

  const meetingDomains = ['zoom.us', 'meet.google.com', 'teams.microsoft.com', 'teams.live.com'];
  return matches.find((url) => meetingDomains.some((domain) => url.includes(domain)));
}

/**
 * List high-priority email messages from Gmail API, with mock fallback.
 */
export async function getGmailTriageList(): Promise<GmailMessage[]> {
  try {
    const accessToken = await getGoogleAccessToken();

    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=-category:promotions',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!listRes.ok) {
      throw new Error(`Gmail List API returned status ${listRes.status}`);
    }

    const listData = await listRes.json();
    if (!listData.messages || listData.messages.length === 0) {
      return [];
    }

    const detailedList: GmailMessage[] = [];

    for (const msg of listData.messages) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!msgRes.ok) continue;
        const msgData = await msgRes.json();

        // Extract headers
        interface GmailHeader {
          name: string;
          value: string;
        }
        const headers = (msgData.payload?.headers || []) as GmailHeader[];
        const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
        const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || 'Unknown';
        const date = headers.find((h) => h.name.toLowerCase() === 'date')?.value || new Date().toISOString();
        const snippet = msgData.snippet || '';

        const score = scoreEmail(subject, from, snippet);

        detailedList.push({
          id: msg.id,
          threadId: msg.threadId,
          from,
          subject,
          snippet,
          date,
          score,
        });
      } catch (innerErr) {
        console.error(`Failed to parse Gmail message ${msg.id}:`, innerErr);
      }
    }

    // Sort by priority score descending
    return detailedList.sort((a, b) => b.score - a.score);
  } catch (err) {
    console.warn('Google API integration is using simulated data:', err instanceof Error ? err.message : err);
    return getSimulatedGmailMessages();
  }
}

/**
 * Fetch calendar meetings from Google Calendar API, with mock fallback.
 */
export async function getCalendarAgendas(): Promise<CalendarEvent[]> {
  try {
    const accessToken = await getGoogleAccessToken();
    const timeMin = new Date().toISOString();

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&maxResults=10&singleEvents=true&orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!calRes.ok) {
      throw new Error(`Calendar API returned status ${calRes.status}`);
    }

    const calData = await calRes.json();
    if (!calData.items || calData.items.length === 0) {
      return [];
    }

    interface GoogleCalendarEvent {
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      hangoutLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }

    return (calData.items as GoogleCalendarEvent[]).map((item) => {
      const start = item.start?.dateTime || item.start?.date || '';
      const end = item.end?.dateTime || item.end?.date || '';
      const meetingUrl = extractMeetingUrl(item.location, item.description) || item.hangoutLink;

      return {
        id: item.id,
        summary: item.summary || 'Meeting Agenda',
        description: item.description,
        start,
        end,
        meetingUrl,
      };
    });
  } catch (err) {
    console.warn('Calendar API integration is using simulated data:', err instanceof Error ? err.message : err);
    return getSimulatedCalendarEvents();
  }
}

// --- Simulation Datasets ---

function getSimulatedGmailMessages(): GmailMessage[] {
  return [
    {
      id: 'm1',
      threadId: 't_m1',
      from: 'Steve Philipp <steve@reprime.com>',
      subject: 'Riverside LP Deal - Term Sheet & Signatures Required ASAP',
      snippet: 'Gideon, Kazi, I have compiled the legal edits for the Riverside LP capital raise. Please verify page 8 details and sign before 5 PM EST.',
      date: new Date(Date.now() - 1000 * 60 * 20).toISOString(), // 20 mins ago
      score: 30, // High score
    },
    {
      id: 'm2',
      threadId: 't_m2',
      from: 'Adir Yonasi <adir@reprime.com>',
      subject: 'Inforuptcy scraping flow update',
      snippet: 'Running our login scraper tests today. Playwright scripts look good, waiting on Twilio 2FA passcodes to finalize live ingestion stream.',
      date: new Date(Date.now() - 1000 * 60 * 90).toISOString(), // 90 mins ago
      score: 18,
    },
    {
      id: 'm3',
      threadId: 't_m3',
      from: 'Chaim Abrahams <chaim@reprime.com>',
      subject: 'NDA Draft Review',
      snippet: 'Sent over the new NDA template for the upcoming Florida real estate developer partnership. Standard terms apply.',
      date: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
      score: 16,
    },
  ];
}

function getSimulatedCalendarEvents(): CalendarEvent[] {
  const now = new Date();
  return [
    {
      id: 'c1',
      summary: 'Riverside LP Term Sheet Review',
      description: 'Gideon / Steve / Riverside Investment Committee. Discussing final adjustments to capital call schedules. Zoom link: https://zoom.us/j/91827381273',
      start: new Date(now.getTime() + 1000 * 60 * 30).toISOString(), // in 30 mins
      end: new Date(now.getTime() + 1000 * 60 * 90).toISOString(),
      meetingUrl: 'https://zoom.us/j/91827381273',
    },
    {
      id: 'c2',
      summary: 'Sync on Playwright Webhook Pipelines',
      description: 'Adir / Kazi. Technical review of Twilio 2FA automatic verification handlers. Google Meet: https://meet.google.com/abc-defg-hij',
      start: new Date(now.getTime() + 1000 * 60 * 150).toISOString(), // in 2.5 hours
      end: new Date(now.getTime() + 1000 * 60 * 210).toISOString(),
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    },
  ];
}
