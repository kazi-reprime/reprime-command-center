'use client'

import React, { useState } from 'react'
import { Card, StatusBadge, PriorityBadge, ActionButton, SearchInput, TabGroup, Modal, FormInput, FormSelect, FormTextarea, EmptyState } from '@/components/ui/shared'
import { seedTasks, type SeedTask } from '@/lib/data/seed'

export default function TasksPage() {
  const [tasks, setTasks] = useState(seedTasks)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', priority: '3', projectTag: 'General', dueDate: '' })

  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'today') return t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()
    if (filter === 'overdue') return t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done'
    if (filter !== 'all' && t.status !== filter) return false
    return true
  }).sort((a, b) => a.priority - b.priority)

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'done' ? 'todo' as const : 'done' as const } : t))
  }

  const handleCreate = () => {
    if (!form.title) return
    const newTask: SeedTask = {
      id: `t${Date.now()}`, title: form.title, priority: parseInt(form.priority) as SeedTask['priority'],
      status: 'todo', dueDate: form.dueDate || null, owner: 'Gideon', relatedTo: null,
      projectTag: form.projectTag, checklist: [], aiNextStep: null,
      createdAt: new Date().toISOString().split('T')[0],
    }
    setTasks(prev => [newTask, ...prev])
    setShowCreate(false)
    setForm({ title: '', priority: '3', projectTag: 'General', dueDate: '' })
  }

  const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Task & Operations Center</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
            {tasks.filter(t => t.status !== 'done').length} open • {tasks.filter(t => t.status === 'done').length} completed
            {overdue > 0 && <span style={{ color: '#EF4444' }}> • {overdue} overdue</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ width: 240 }}><SearchInput value={search} onChange={setSearch} placeholder="Search tasks..." /></div>
          <ActionButton label="+ Add Task" onClick={() => setShowCreate(true)} variant="primary" size="md" />
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <TabGroup
          tabs={[
            { key: 'all', label: 'All', count: tasks.length },
            { key: 'today', label: 'Today' },
            { key: 'overdue', label: 'Overdue', count: overdue },
            { key: 'todo', label: 'To Do', count: tasks.filter(t => t.status === 'todo').length },
            { key: 'in_progress', label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length },
            { key: 'done', label: 'Done', count: tasks.filter(t => t.status === 'done').length },
            { key: 'blocked', label: 'Blocked', count: tasks.filter(t => t.status === 'blocked').length },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.map(task => (
          <div key={task.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.85rem 1rem', background: 'rgba(14,52,112,0.4)',
            border: '1px solid rgba(255,204,51,0.06)', borderRadius: 10,
            borderLeftWidth: 3,
            borderLeftColor: task.priority === 1 ? '#EF4444' : task.priority === 2 ? '#F59E0B' : '#3B82F6',
            opacity: task.status === 'done' ? 0.5 : 1,
          }}>
            <button
              onClick={() => toggleTask(task.id)}
              style={{
                width: 22, height: 22, borderRadius: 6, border: `2px solid ${task.status === 'done' ? '#00A980' : 'rgba(255,204,51,0.3)'}`,
                background: task.status === 'done' ? '#00A980' : 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                color: '#fff', fontSize: '0.65rem',
              }}
            >
              {task.status === 'done' && '✓'}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: '#fff', fontSize: '0.85rem', fontWeight: 500,
                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{task.title}</div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                <span style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>{task.projectTag}</span>
                <span style={{ color: 'rgba(255,204,51,0.2)' }}>·</span>
                <span style={{ color: 'rgba(255,204,51,0.4)', fontSize: '0.65rem' }}>{task.owner}</span>
                {task.dueDate && (
                  <>
                    <span style={{ color: 'rgba(255,204,51,0.2)' }}>·</span>
                    <span style={{
                      fontSize: '0.65rem',
                      color: new Date(task.dueDate) < new Date() && task.status !== 'done' ? '#EF4444' : 'rgba(255,204,51,0.4)',
                    }}>
                      {new Date(task.dueDate) < new Date() && task.status !== 'done' ? '⚠️ ' : ''}
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>
              {task.aiNextStep && task.status !== 'done' && (
                <div style={{ marginTop: '0.35rem', padding: '0.3rem 0.5rem', background: 'rgba(168,85,247,0.06)', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.6rem' }}>🧠</span>
                  <span style={{ color: '#A855F7', fontSize: '0.65rem' }}>{task.aiNextStep}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState icon="✅" title="No tasks found" description="All caught up or try a different filter." />}
      </div>

      {/* Create Task Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Task">
        <FormInput label="Title" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} required placeholder="Task title..." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <FormSelect label="Priority" value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))} options={[
            { value: '1', label: 'Critical' }, { value: '2', label: 'High' },
            { value: '3', label: 'Medium' }, { value: '4', label: 'Low' }, { value: '5', label: 'Minimal' },
          ]} />
          <FormInput label="Project Tag" value={form.projectTag} onChange={v => setForm(f => ({ ...f, projectTag: v }))} placeholder="Deals, Sales..." />
        </div>
        <FormInput label="Due Date" value={form.dueDate} onChange={v => setForm(f => ({ ...f, dueDate: v }))} type="date" />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <ActionButton label="Cancel" onClick={() => setShowCreate(false)} variant="ghost" size="md" />
          <ActionButton label="Create Task" onClick={handleCreate} variant="primary" size="md" disabled={!form.title} />
        </div>
      </Modal>
    </div>
  )
}
