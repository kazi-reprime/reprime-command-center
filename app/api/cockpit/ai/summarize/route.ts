import { NextRequest, NextResponse } from 'next/server';
import { generateSummary, generateNextAction, generateAI, getConfiguredProvider } from '@/lib/ai/provider';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, entityType, entityData, prompt } = body;

    if (type === 'summary' && entityType && entityData) {
      const result = await generateSummary(entityType, entityData);
      return NextResponse.json(result);
    }

    if (type === 'next-action' && entityType && entityData) {
      const result = await generateNextAction(entityType, entityData);
      return NextResponse.json(result);
    }

    if (type === 'custom' && prompt) {
      const result = await generateAI(prompt);
      return NextResponse.json(result);
    }

    if (type === 'test') {
      const provider = getConfiguredProvider();
      if (!provider) {
        return NextResponse.json({
          configured: false,
          error: 'AI provider is not configured. Add ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY to enable live AI features.',
        });
      }
      const result = await generateAI('Respond with exactly: "AI connection successful." Nothing else.');
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid request. Provide type: summary | next-action | custom | test' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'AI request failed', details: String(err) }, { status: 500 });
  }
}

export async function GET() {
  const provider = getConfiguredProvider();
  return NextResponse.json({
    configured: !!provider,
    provider: provider?.name || null,
    envKey: provider?.envKey || null,
  });
}
