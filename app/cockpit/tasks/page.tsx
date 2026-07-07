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

      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="m-0 text-text-primary text-2xl font-bold">Task Command</h1>
          <p className="mt-1 mb-0 text-text-secondary text-sm">
            {statusCounts.done} completed • {statusCounts.todo + statusCounts.in_progress} remaining • {statusCounts.overdue} overdue
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-60"><SearchInput value={search} onChange={setSearch} placeholder="Search tasks..." /></div>
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

      <div className="flex flex-col gap-1.5 mt-4">
        {filtered.map(task => (
          <div key={task.id}
            className="flex items-center gap-3 p-3 px-4 bg-surface border border-border rounded-lg"
            style={{
              opacity: task.status === 'done' ? 0.6 : 1,
              borderLeftWidth: 3,
              borderLeftColor: task.priority === 1 ? '#EF4444' : task.priority === 2 ? '#F59E0B' : task.priority === 3 ? '#3B82F6' : '#94A3B8',
            }}
          >
            <button
              onClick={() => handleToggle(task.id)}
              className="w-[22px] h-[22px] rounded-md flex-shrink-0 cursor-pointer flex items-center justify-center text-text-inverse text-[0.6rem]"
              style={{
                background: task.status === 'done' ? '#00A980' : 'rgba(255,204,51,0.08)',
                border: `2px solid ${task.status === 'done' ? '#00A980' : 'rgba(255,204,51,0.2)'}`,
              }}
            >
              {task.status === 'done' ? '✓' : ''}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-text-primary text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap ${task.status === 'done' ? 'line-through' : ''}`}>
                {task.title}
              </div>
              <div className="flex gap-2 mt-0.5 text-[0.65rem] text-text-secondary">
                <span>{task.projectTag}</span>
                {task.owner && <><span>•</span><span>{task.owner}</span></>}
                {task.dueDate && <><span>•</span><span className={task.status !== 'done' && new Date(task.dueDate) < new Date() ? 'text-status-error' : ''}>
                  Due {task.dueDate}
                </span></>}
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
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-text-secondary text-xs mb-1 font-medium">Title *</label>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task title"
              className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded-lg text-text-primary text-sm outline-none font-[inherit] box-border"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-text-secondary text-xs mb-1 font-medium">Priority</label>
              <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded-lg text-text-primary text-sm font-[inherit] box-border"
              >
                <option value="1">Critical</option>
                <option value="2">High</option>
                <option value="3">Medium</option>
                <option value="4">Low</option>
                <option value="5">Minimal</option>
              </select>
            </div>
            <div>
              <label className="block text-text-secondary text-xs mb-1 font-medium">Due Date</label>
              <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded-lg text-text-primary text-sm font-[inherit] box-border"
              />
            </div>
          </div>
          <div>
            <label className="block text-text-secondary text-xs mb-1 font-medium">Project Tag</label>
            <input value={newProject} onChange={e => setNewProject(e.target.value)} placeholder="General"
              className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded-lg text-text-primary text-sm outline-none font-[inherit] box-border"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <ActionButton label={createMutation.isPending ? 'Creating...' : 'Create Task'} variant="primary" size="md" onClick={handleCreate} />
            <ActionButton label="Cancel" variant="ghost" size="md" onClick={() => setShowCreate(false)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
