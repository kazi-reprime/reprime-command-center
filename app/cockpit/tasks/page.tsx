'use client'

import React, { useState, useMemo } from 'react'
import { Card, StatusBadge, ActionButton, SearchInput, TabGroup, Modal, EmptyState, PriorityBadge } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery, useCockpitMutation } from '@/hooks/useCockpitData'
// Seed data removed — live data only
import { useToast } from '@/lib/contexts/ToastContext'

export default function TasksPage() {
  const { addToast } = useToast()
  const tasksQ = useCockpitQuery<any[]>('tasks', '/api/cockpit/tasks')
  const createMutation = useCockpitMutation<{ title: string; priority: number; projectTag: string; dueDate: string | null }>('/api/cockpit/tasks', {
    invalidateKeys: ['tasks'],
    successMessage: 'Task created successfully',
  })
  const toggleMutation = useCockpitMutation<{ id: string }>('/api/cockpit/tasks', {
    method: 'PATCH',
    invalidateKeys: ['tasks'],
  })

  const tasks = tasksQ.data?.data ?? []
  const dataSource = tasksQ.data?.source ?? 'unavailable'
  const dataWarning = tasksQ.data?.warning

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState('3')
  const [newProject, setNewProject] = useState('')
  const [newDue, setNewDue] = useState('')

  const filtered = useMemo(() => tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'done') return t.status === 'done'
    if (filter === 'todo') return t.status === 'todo'
    if (filter === 'in_progress') return t.status === 'in_progress'
    if (filter === 'overdue') return t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()
    return true
  }).sort((a, b) => a.priority - b.priority), [tasks, search, filter])

  const statusCounts = useMemo(() => ({
    all: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length,
  }), [tasks])

  const handleCreate = () => {
    if (!newTitle.trim()) { addToast('Title is required', 'error'); return }
    createMutation.mutate({
      title: newTitle.trim(),
      priority: parseInt(newPriority),
      projectTag: newProject.trim() || 'General',
      dueDate: newDue || null,
    })
    setShowCreate(false)
    setNewTitle(''); setNewPriority('3'); setNewProject(''); setNewDue('')
  }

  const handleToggle = (id: string) => {
    toggleMutation.mutate({ id })
  }

  if (tasksQ.isLoading) return <LoadingState message="Loading tasks..." />

  return (
    <div>
      <DataSourceBanner source={dataSource} warning={dataWarning} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>Task Command</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
            {statusCounts.done} completed • {statusCounts.todo + statusCounts.in_progress} remaining • {statusCounts.overdue} overdue
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: 240 }}><SearchInput value={search} onChange={setSearch} placeholder="Search tasks..." /></div>
          <ActionButton label="+ New Task" variant="primary" size="md" onClick={() => setShowCreate(true)} />
        </div>
      </div>

      <TabGroup
        tabs={[
          { key: 'all', label: 'All', count: statusCounts.all },
          { key: 'todo', label: 'To Do', count: statusCounts.todo },
          { key: 'in_progress', label: 'In Progress', count: statusCounts.in_progress },
          { key: 'done', label: 'Done', count: statusCounts.done },
          { key: 'overdue', label: 'Overdue', count: statusCounts.overdue },
        ]}
        active={filter}
        onChange={setFilter}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '1rem' }}>
        {filtered.map(task => (
          <div key={task.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem', background: 'rgba(14,52,112,0.4)',
            border: '1px solid rgba(255,204,51,0.06)', borderRadius: 8,
            opacity: task.status === 'done' ? 0.6 : 1,
            borderLeftWidth: 3,
            borderLeftColor: task.priority === 1 ? '#EF4444' : task.priority === 2 ? '#F59E0B' : task.priority === 3 ? '#3B82F6' : '#94A3B8',
          }}>
            <button
              onClick={() => handleToggle(task.id)}
              style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: task.status === 'done' ? '#00A980' : 'rgba(255,204,51,0.08)',
                border: `2px solid ${task.status === 'done' ? '#00A980' : 'rgba(255,204,51,0.2)'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '0.6rem',
              }}
            >
              {task.status === 'done' ? '✓' : ''}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500,
                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{task.title}</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', fontSize: '0.65rem', color: 'rgba(255,204,51,0.4)' }}>
                <span>{task.projectTag}</span>
                {task.owner && <><span>•</span><span>{task.owner}</span></>}
                {task.dueDate && <><span>•</span><span style={{
                  color: task.status !== 'done' && new Date(task.dueDate) < new Date() ? '#EF4444' : 'inherit',
                }}>Due {task.dueDate}</span></>}
              </div>
            </div>
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
        ))}
        {filtered.length === 0 && <EmptyState icon="✅" title="No tasks found" description="All caught up or try adjusting filters." />}
      </div>

      {/* Create Task Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Task" width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', color: 'rgba(255,204,51,0.6)', fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 500 }}>Title *</label>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task title"
              style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,204,51,0.1)', borderRadius: 8, color: '#fff', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,204,51,0.6)', fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 500 }}>Priority</label>
              <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,204,51,0.1)', borderRadius: 8, color: '#fff', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
              >
                <option value="1">Critical</option>
                <option value="2">High</option>
                <option value="3">Medium</option>
                <option value="4">Low</option>
                <option value="5">Minimal</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,204,51,0.6)', fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 500 }}>Due Date</label>
              <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,204,51,0.1)', borderRadius: 8, color: '#fff', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', color: 'rgba(255,204,51,0.6)', fontSize: '0.7rem', marginBottom: '0.25rem', fontWeight: 500 }}>Project Tag</label>
            <input value={newProject} onChange={e => setNewProject(e.target.value)} placeholder="General"
              style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,204,51,0.1)', borderRadius: 8, color: '#fff', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <ActionButton label={createMutation.isPending ? 'Creating...' : 'Create Task'} variant="primary" size="md" onClick={handleCreate} />
            <ActionButton label="Cancel" variant="ghost" size="md" onClick={() => setShowCreate(false)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
