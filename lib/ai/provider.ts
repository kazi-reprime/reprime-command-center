/**
 * Unified AI provider abstraction.
 * Checks available API keys in order: Anthropic → OpenAI → Gemini → Groq
 * Returns a structured result so callers can show proper warnings when no provider is configured.
 */

import { logInfo, logError, logWarning } from '@/lib/logging/systemLog';

export interface AIProviderResult {
  configured: boolean;
  provider?: string;
  response?: string;
  error?: string;
}

type ProviderDef = {
  name: string;
  envKey: string;
  generate: (prompt: string, apiKey: string) => Promise<string>;
};

const providers: ProviderDef[] = [
  {
    name: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    generate: async (prompt: string, apiKey: string) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.content?.[0]?.text || '';
    },
  },
  {
    name: 'openai',
    envKey: 'OPENAI_API_KEY',
    generate: async (prompt: string, apiKey: string) => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    },
  },
  {
    name: 'gemini',
    envKey: 'GEMINI_API_KEY',
    generate: async (prompt: string, apiKey: string) => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 512 },
          }),
        }
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },
  },
  {
    name: 'groq',
    envKey: 'GROQ_API_KEY',
    generate: async (prompt: string, apiKey: string) => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    },
  },
];

/** Returns which AI provider is available, or null */
export function getConfiguredProvider(): { name: string; envKey: string } | null {
  for (const p of providers) {
    const key = process.env[p.envKey];
    if (key && key.length > 5 && !key.includes('mock')) {
      return { name: p.name, envKey: p.envKey };
    }
  }
  return null;
}

/** Generate text using the first available AI provider */
export async function generateAI(prompt: string): Promise<AIProviderResult> {
  for (const p of providers) {
    const key = process.env[p.envKey];
    if (!key || key.length <= 5 || key.includes('mock')) continue;

    try {
      logInfo('ai', `Calling ${p.name} provider`, { promptLength: prompt.length });
      const response = await p.generate(prompt, key);
      logInfo('ai', `${p.name} responded successfully`, { responseLength: response.length });
      return { configured: true, provider: p.name, response };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logError('ai', `${p.name} call failed: ${errorMsg}`);
      // Try next provider
      continue;
    }
  }

  logWarning('ai', 'No AI provider configured or all providers failed');
  return {
    configured: false,
    error: 'AI provider is not configured. Add ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY to enable live AI features.',
  };
}

/** Generate a summary for a business entity */
export async function generateSummary(entityType: string, entityData: Record<string, unknown>): Promise<AIProviderResult> {
  const prompt = `You are a concise business intelligence assistant for a commercial real estate firm. Generate a brief 2-3 sentence executive summary for this ${entityType}. Be specific, actionable, and professional. Data: ${JSON.stringify(entityData)}`;
  return generateAI(prompt);
}

/** Generate next best action recommendation */
export async function generateNextAction(entityType: string, entityData: Record<string, unknown>): Promise<AIProviderResult> {
  const prompt = `You are a business advisor for a commercial real estate firm. Based on this ${entityType} data, suggest the single most impactful next action in 1-2 sentences. Be specific and actionable. Data: ${JSON.stringify(entityData)}`;
  return generateAI(prompt);
}
