import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ParsedIntent } from '@/lib/voice/parser'

export const dynamic = 'force-dynamic'

const CONDUCER_SYSTEM = `You are "The Conductor", the intent classification engine for Gideon Gratsiani's Command Center.
Your job is to take a voice transcript and return a JSON object representing the user's intent.

INTENT TYPES:
1. add_to_bucket: { text: string }
   - Examples: "add to bucket check the plumbing", "bucket buy some milk"
2. remind: { text: string, minutes: number }
   - Examples: "remind me to call steve in 10 minutes", "remind me about the meeting in 2 hours"
3. delegate: { name: string, text: string }
   - Examples: "tell musharraf to fix the css", "tell adi to check the deal"
4. open_window: { target: "perplexity" | "gmail" | "costar" | "loopnet" | "pipedrive", opts: { query?: string } }
   - Examples: "open perplexity ask about real estate trends", "open gmail"
5. search: { text: string }
   - Examples: "search for athens property", "search deals"
6. call: { name: string }
   - Examples: "call steve", "call my broker"
7. email: { name: string, subject: string, body: string }
   - Examples: "email steve: deal 3 / let's move forward"
8. briefing: {}
   - Examples: "brief me", "morning brief"

RULES:
- Return ONLY valid JSON.
- If unsure, use intent "unknown".
- For "remind", always convert hours/days to minutes.
- For "email", use the slash "/" to separate subject and body if present in the transcript.

OUTPUT FORMAT:
{ "intent": "...", "params": { ... } }`

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json()
    if (!transcript) return NextResponse.json({ error: 'Missing transcript' }, { status: 400 })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: CONDUCER_SYSTEM,
      messages: [{ role: 'user', content: transcript }],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    const result = JSON.parse(content.text) as ParsedIntent
    result.raw = transcript

    return NextResponse.json(result)
  } catch (error) {
    console.error('[conductor] parsing failed:', error)
    return NextResponse.json({ intent: 'unknown', params: {}, raw: '' }, { status: 500 })
  }
}
