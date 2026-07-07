import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
// Dynamic import to avoid playwright build failures
// import { runInforuptcyIngestion } from '@/lib/inforuptcy';

export async function POST(req: Request) {
  try {
    const { prompt, context } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const service = createServiceClient();
    const lowerPrompt = prompt.toLowerCase();

    // 1. Intercept Inforuptcy Scraper Requests
    if (lowerPrompt.includes('inforuptcy') || lowerPrompt.includes('scraper')) {
      const { runInforuptcyIngestion } = await import('@/lib/inforuptcy');
      const dockets = await runInforuptcyIngestion();
      const memoriesToStore: string[] = [];
      const tasksToCreate: Array<{ title: string; priority: number; projectTag: string }> = [];

      for (const doc of dockets) {
        memoriesToStore.push(`Debtor: ${doc.debtor}, Case: ${doc.caseNumber}, Chapter: ${doc.chapter}, Court: ${doc.court}, Filed: ${doc.dateFiled}`);
        tasksToCreate.push({
          title: `Review filing: ${doc.debtor} (${doc.caseNumber})`,
          priority: doc.chapter.includes('11') ? 1 : 3,
          projectTag: 'Inforuptcy',
        });
      }

      // Execute side-effects: Store new memories as notes
      for (const content of memoriesToStore) {
        try {
          const title = content.length > 50 ? content.slice(0, 47) + '...' : content;
          await service.from('notes').insert({
            title: `Inforuptcy: ${title}`,
            body: content,
            is_pinned: false,
          });
        } catch (e) {
          console.error('Failed to store scraped memory as note:', e);
        }
      }

      // Execute side-effects: Create tasks in bucket_items
      for (const task of tasksToCreate) {
        try {
          await service.from('bucket_items').insert({
            title: task.title,
            priority: task.priority,
            source_type: task.projectTag,
            status: 'open',
          });
        } catch (e) {
          console.error('Failed to create scraped task:', e);
        }
      }

      return NextResponse.json({
        reply: `Inforuptcy ingestion complete, Gideon. Scraped ${dockets.length} new filing records. I have registered them to notes memory and created corresponding items in your Tasks Bucket.`,
        memoriesToStore,
        tasksToCreate,
      });
    }

    // 2. Fetch context from notes table (keyword matching)
    let contextMemories: string[] = [];
    try {
      const { data: notesData, error: notesError } = await service
        .from('notes')
        .select('title, body')
        .order('updated_at', { ascending: false })
        .limit(40);

      if (!notesError && notesData) {
        const promptWords = prompt.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3);
        if (promptWords.length > 0) {
          contextMemories = notesData
            .filter((n) => {
              const text = `${n.title || ''} ${n.body || ''}`.toLowerCase();
              return promptWords.some((word: string) => text.includes(word));
            })
            .slice(0, 5)
            .map((n) => `[Note: ${n.title}] ${n.body}`);
        } else {
          // If query is short, just use the 3 most recently updated notes as general context
          contextMemories = notesData.slice(0, 3).map((n) => `[Note: ${n.title}] ${n.body}`);
        }
      }
    } catch (e) {
      console.error('Context notes retrieval failed, proceeding without context:', e);
    }

    // 3. Call OpenAI (primary) or Anthropic (fallback)
    // Guard: system env may have a Groq key misnamed as OPENAI_API_KEY (gsk_ prefix)
    const rawOpenaiKey = process.env.OPENAI_API_KEY;
    const openaiKey = rawOpenaiKey && rawOpenaiKey.startsWith('sk-') ? rawOpenaiKey : undefined;
    const groqKey = process.env.GROQ_API_KEY || (rawOpenaiKey && rawOpenaiKey.startsWith('gsk_') ? rawOpenaiKey : undefined);
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    let noraResponse = {
      reply: `I received your prompt: "${prompt}". Ready to execute.`,
      memoriesToStore: [] as string[],
      tasksToCreate: [] as Array<{ title: string; priority: number; projectTag?: string }>,
    };

    const systemPrompt = `You are Nora, the elite AI executive assistant for Gideon Menachem Gratsiani and the RePrime Command Center team.
Analyze the user's message and the provided context memories to formulate a response.

Style constraints:
- Speak in a premium, ultra-professional, and direct "Dugri" tone (direct, no fluff, zero corporate BS).
- Be brief and high-density.
- Refer to team members by name (Gideon, Kazi, Shirel, Steve, Adir, Yaron, Chaim).
- When speaking Hebrew, use native Israeli Hebrew, never machine-translated.

Context Memories (retrieved from notes):
${contextMemories.length > 0 ? contextMemories.map((m) => `- ${m}`).join('\n') : 'No past memories found for this context.'}

Current Cockpit Context (Live Dashboard State):
${context ? JSON.stringify(context, null, 2) : 'No live context provided.'}

You can take action by returning a structured JSON response:
1. If the user gives you a new piece of information that is worth remembering long-term (e.g. contact details, preferences, client info, deal notes), include it in the "memoriesToStore" array.
2. If the user tells you to do something, assign a task, or sets a reminder, include it in the "tasksToCreate" array.

Output format MUST be valid JSON:
{
  "reply": "Your response to the user",
  "memoriesToStore": ["Specific string/fact to save in memory (if any)"],
  "tasksToCreate": [
    {
      "title": "Short title of the task",
      "priority": 1,
      "projectTag": "optional-tag"
    }
  ]
}`;

    let aiSuccess = false;

    // ── Primary path: Multi-agent orchestrator ─────────────────────────────
    // Routes to specialist agents (email, whatsapp, meeting, contact, etc.)
    // with real tool access. Falls back to direct AI if orchestrator fails.
    try {
      const { processMessage, persistConversation } = await import('@/lib/agents/orchestrator');
      const result = await processMessage({
        message: prompt,
        liveContext: context || undefined,
        sessionId: `nora-chat-${Date.now()}`,
      });

      if (result.reply) {
        noraResponse = {
          reply: result.reply,
          memoriesToStore: [],
          tasksToCreate: [],
        };

        // Extract any pending approvals for the UI
        if (result.pendingApprovals?.length) {
          (noraResponse as Record<string, unknown>).pendingApprovals = result.pendingApprovals;
        }

        // Include tool trace for transparency
        if (result.toolTrace?.length) {
          (noraResponse as Record<string, unknown>).toolTrace = result.toolTrace;
        }

        // Include which agent handled the request
        (noraResponse as Record<string, unknown>).agentId = result.agentId;

        aiSuccess = true;

        // Persist via orchestrator's own persistence (handles vector memory)
        persistConversation(`nora-chat`, prompt, result).catch(e =>
          console.error('[nora-route] orchestrator persist failed:', (e as Error).message)
        );
      }
    } catch (orchErr) {
      console.warn('[nora-route] orchestrator failed, falling back to direct AI:', (orchErr as Error).message);
    }

    // Try OpenAI first (if key is valid sk- prefix)
    if (!aiSuccess && openaiKey && !openaiKey.includes('mock')) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const parsed = JSON.parse(json.choices[0].message.content);
          noraResponse = {
            reply: parsed.reply || '',
            memoriesToStore: parsed.memoriesToStore || [],
            tasksToCreate: parsed.tasksToCreate || [],
          };
          aiSuccess = true;
        } else {
          console.warn('OpenAI API error:', await res.text());
        }
      } catch (e) {
        console.error('OpenAI invocation failed:', e);
      }
    }

    // Try Groq as second option (system env has gsk_ key)
    if (!aiSuccess && groqKey && groqKey.startsWith('gsk_')) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const parsed = JSON.parse(json.choices[0].message.content);
          noraResponse = {
            reply: parsed.reply || '',
            memoriesToStore: parsed.memoriesToStore || [],
            tasksToCreate: parsed.tasksToCreate || [],
          };
          aiSuccess = true;
        } else {
          console.warn('Groq API error:', await res.text());
        }
      } catch (e) {
        console.error('Groq invocation failed:', e);
      }
    }

    // Try Anthropic as third option
    if (!aiSuccess && anthropicKey && !anthropicKey.includes('mock')) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
              { role: 'user', content: prompt },
            ],
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const rawText = json.content?.[0]?.text || '{}';
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            noraResponse = {
              reply: parsed.reply || rawText,
              memoriesToStore: parsed.memoriesToStore || [],
              tasksToCreate: parsed.tasksToCreate || [],
            };
            aiSuccess = true;
          } else {
            noraResponse.reply = rawText;
            aiSuccess = true;
          }
        } else {
          console.warn('Anthropic API error:', res.status, await res.text());
        }
      } catch (e) {
        console.error('Anthropic invocation failed:', e);
      }
    }

    // Local fallback when no AI provider succeeded
    if (!aiSuccess) {
      const lower = prompt.toLowerCase();
      if (lower.includes('remember') || lower.includes('save')) {
        noraResponse.reply = `Understood, Gideon. Saving "${prompt}" to notes memory.`;
        noraResponse.memoriesToStore.push(prompt);
      } else if (lower.includes('todo') || lower.includes('task') || lower.includes('remind')) {
        noraResponse.reply = `Adding task: "${prompt}" to your Tasks Bucket.`;
        noraResponse.tasksToCreate.push({
          title: prompt,
          priority: 2,
          projectTag: 'Nora AI',
        });
      } else {
        noraResponse.reply = `Understood. Ready to execute your request. ${
          contextMemories.length > 0 ? `I pulled ${contextMemories.length} relevant facts from notes.` : ''
        }`;
      }
    }

    // 4. Execute Side-Effects: Store new memories in notes
    if (noraResponse.memoriesToStore.length > 0) {
      for (const content of noraResponse.memoriesToStore) {
        try {
          const title = content.length > 40 ? content.slice(0, 37) + '...' : content;
          await service.from('notes').insert({
            title: `Memory: ${title}`,
            body: content,
            is_pinned: false,
          });
        } catch (e) {
          console.error('Failed to store memory note:', e);
        }
      }
    }

    // 5. Execute Side-Effects: Create new tasks in bucketItems
    if (noraResponse.tasksToCreate.length > 0) {
      for (const task of noraResponse.tasksToCreate) {
        try {
          await service.from('bucket_items').insert({
            title: task.title,
            priority: task.priority || 3,
            source_type: task.projectTag || 'Nora AI',
            status: 'open',
          });
        } catch (e) {
          console.error('Failed to create task:', e);
        }
      }
    }

    // 6. Persist to chat history
    try {
      const HEBREW_RE = /[א-ת]/;
      const userLanguage = HEBREW_RE.test(prompt) ? 'he' : 'en';
      const replyLanguage = HEBREW_RE.test(noraResponse.reply) ? 'he' : 'en';
      
      const { error: persistError } = await service.from('nora_chat_messages').insert([
        { role: 'user', content: prompt, language: userLanguage },
        { role: 'assistant', content: noraResponse.reply, language: replyLanguage },
      ]);
      
      if (persistError) {
        console.error('Failed to persist Nora chat message:', persistError.message);
      }
    } catch (e) {
      console.error('Failed to persist Nora chat message exception:', e);
    }

    return NextResponse.json(noraResponse);
  } catch (err) {
    console.error('Error in Nora API:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
