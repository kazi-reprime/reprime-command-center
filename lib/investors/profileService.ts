import { db } from '@/db';
import { desc, eq, and, or, inArray } from 'drizzle-orm';
import { messages as dbMessages, whatsappMessages, whatsappThreads } from '@/db/schema';
import { getPerson } from '@/lib/pipedrive/client';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function getLiveInvestorProfile(pipedriveId: number) {
  // 1. Fetch Pipedrive data
  const person = await getPerson(pipedriveId);
  if (!person) return null;

  // 2. Fetch recent communications from our DB to augment the profile
  const email = (person.email as any[])?.[0]?.value;
  const phone = (person.phone as any[])?.[0]?.value;

  // Fetch recent WhatsApp — find threads for this phone, then messages from those threads
  let recentWA: (typeof whatsappMessages.$inferSelect)[] = [];
  if (phone) {
    const threads = await db.select({ id: whatsappThreads.id })
      .from(whatsappThreads)
      .where(eq(whatsappThreads.phone, phone))
      .limit(5);
    const threadIds = threads.map(t => t.id);
    if (threadIds.length > 0) {
      recentWA = await db.select()
        .from(whatsappMessages)
        .where(inArray(whatsappMessages.threadId, threadIds))
        .orderBy(desc(whatsappMessages.createdAt))
        .limit(10);
    }
  }

  // 3. Use LLM to generate Summary and Recommendation
  const prompt = `
    Investor Profile: ${person.name}
    Company: ${person.org_name || 'Unknown'}
    Recent Messages:
    ${recentWA.map(m => `- [${m.createdAt}] ${m.fromPhone}: ${m.body}`).join('\n')}
    
    Pipedrive Notes: ${person.notes || 'No notes.'}
    
    Generate a 3-paragraph summary of who this investor is, their relationship with Gideon (Reprime), and their current interests based on the messages.
    Also generate a "Next Action" recommendation.
    
    Return JSON format: { summary: string, recommendation: { headline: string, detail: string, actions: { label: string, variant: string }[] } }
  `;

  const { object } = await generateText({
    model: openai('gpt-4o'),
    prompt,
    system: 'You are Gideon\'s business brain. Be concise, strategic, and direct. Use the second person "You" when referring to Gideon.',
  }).then(res => ({ object: JSON.parse(res.text) })).catch(() => ({ 
    object: { 
      summary: `Investor ${person.name} is active in Pipedrive. Recent communications show engagement on WhatsApp.`,
      recommendation: { 
        headline: 'Follow up on recent interest', 
        detail: 'The investor has been active recently. A quick check-in is advised.', 
        actions: [{ label: 'WhatsApp', variant: 'primary' }, { label: 'Wait', variant: 'tertiary' }] 
      } 
    } 
  }));

  return {
    id: `pipedrive:${pipedriveId}`,
    pipedriveContactId: pipedriveId,
    name: person.name,
    phone: phone || '',
    email: email || null,
    company: person.org_name || null,
    lastContactAt: recentWA[0]?.createdAt.toISOString() || null,
    lastContactChannel: recentWA[0] ? `WhatsApp ${recentWA[0].panel}` : 'N/A',
    lastContactMessage: recentWA[0]?.body || null,
    taggedDaysAgo: null,
    tier: (person as any).tier || 'B',
    role: (person as any).role || 'principal',
    activeDealsCount: (person as any).open_deals_count || 0,
    lastMeetingAgo: 'Check calendar',
    summary: object.summary,
    recommendation: object.recommendation,
    tasks: [],
    notes: person.notes || '',
    timeline: recentWA.map(m => ({
      id: m.id,
      icon: '💬',
      time: m.createdAt.toLocaleString(),
      title: m.direction === 'inbound' ? 'Inbound WhatsApp' : 'Outbound WhatsApp',
      body: m.body || ''
    })),
    tabCounts: {
      timeline: recentWA.length,
      emails: 0,
      whatsapp: recentWA.length,
      calls: 0,
      meetings: 0,
      tasks: 0
    }
  };
}
