/**
 * Tasks / Commitment Agent — Bucket items, reminders, waiting-on
 * 
 * Manages Gideon's task list (bucket_items table), creates tasks,
 * marks items complete, and tracks commitments.
 */

import { type AgentDefinition, type AgentTool, registerAgent } from './types'
import { createServiceClient } from '@/lib/supabase/server'

const createTask: AgentTool = {
  name: 'create_task',
  description: "Create a task in Gideon's bucket (task list).",
  parameters: {
    title: { type: 'string', description: 'Task title / what needs to be done' },
    priority: { type: 'number', description: 'Priority 1 (highest) to 5 (lowest). Default 3' },
    source_type: { type: 'string', description: "Where it came from: 'nora', 'whatsapp', 'email', 'voice'" },
  },
  async execute(params) {
    const title = String(params.title || '').trim()
    if (!title) return JSON.stringify({ error: 'title is required' })

    const priority = Math.max(1, Math.min(5, Number(params.priority) || 3))
    const sourceType = String(params.source_type || 'nora')

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('bucket_items')
      .insert({ title, priority, source_type: sourceType, status: 'open' })
      .select('id')
      .single()

    if (error) return JSON.stringify({ error: error.message })
    return JSON.stringify({ success: true, id: data?.id, message: `Task "${title}" created (priority ${priority})` })
  },
}

const listTasks: AgentTool = {
  name: 'list_tasks',
  description: "List open tasks from Gideon's bucket, optionally filtered by status or priority.",
  parameters: {
    status: { type: 'string', description: "'open', 'in_progress', 'done', or 'all' (default: 'open')" },
    limit: { type: 'number', description: 'Max tasks to return (default 10)' },
  },
  async execute(params) {
    const status = String(params.status || 'open')
    const limit = Math.min(Number(params.limit) || 10, 30)

    const supabase = createServiceClient()
    let query = supabase
      .from('bucket_items')
      .select('id, title, priority, status, source_type, created_at')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) return JSON.stringify({ error: error.message })
    return JSON.stringify({ count: data?.length ?? 0, tasks: data ?? [] })
  },
}

const completeTask: AgentTool = {
  name: 'complete_task',
  description: 'Mark a task as complete by its ID.',
  parameters: {
    id: { type: 'string', description: 'Task ID' },
  },
  async execute(params) {
    const id = String(params.id)
    if (!id) return JSON.stringify({ error: 'id required' })

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('bucket_items')
      .update({ status: 'done' })
      .eq('id', id)

    if (error) return JSON.stringify({ error: error.message })
    return JSON.stringify({ success: true, message: 'Task marked as done' })
  },
}

const createNote: AgentTool = {
  name: 'create_note',
  description: "Create a note in Gideon's notes.",
  parameters: {
    title: { type: 'string', description: 'Short title' },
    body: { type: 'string', description: 'Full note content' },
  },
  async execute(params) {
    const title = String(params.title || '').trim()
    const body = String(params.body || '').trim()
    if (!title || !body) return JSON.stringify({ error: 'title and body required' })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('notes')
      .insert({ title, body })
      .select('id')
      .single()

    if (error) return JSON.stringify({ error: error.message })
    return JSON.stringify({ success: true, id: data?.id, message: `Note "${title}" created` })
  },
}

const tasksAgent: AgentDefinition = {
  id: 'tasks',
  name: 'Tasks Agent',
  description: 'Manages bucket items, reminders, notes, and commitments',
  systemPrompt: `You are Nora's Task Management specialist. You manage Gideon's tasks and notes.

Your tools:
- create_task: Add a new task to the bucket
- list_tasks: Show open/all tasks
- complete_task: Mark a task done
- create_note: Save a note

Rules:
1. When Gideon says "add/remember/remind/note/task", use the right tool
2. Assign sensible priorities (1=urgent, 3=normal, 5=low)
3. Confirm back what was created
4. For "what's on my plate", list open tasks sorted by priority`,
  tools: [createTask, listTasks, completeTask, createNote],
  canHandoffTo: ['orchestrator'],
  maxToolRounds: 3,
}

registerAgent(tasksAgent)

export { tasksAgent }
