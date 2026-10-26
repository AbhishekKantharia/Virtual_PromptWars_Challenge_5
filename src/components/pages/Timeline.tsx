import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { Task, TaskStatus, TaskPriority } from '../../types'
import { format, parseISO, differenceInDays, isValid } from 'date-fns'
import { Check, RotateCcw, Plus, Edit2, Trash2, AlertTriangle, Clock, Lock, Search } from 'lucide-react'

type Filter = 'all' | TaskStatus | TaskPriority

export function Timeline() {
  const { state, dispatch } = useApp()
  const { event, tasks } = state
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskForm, setTaskForm] = useState<Partial<Task>>({
    title: '', description: '', dueDate: '', priority: 'medium', category: '', status: 'pending', dependsOn: []
  })

  const today = new Date()

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
        if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [tasks, statusFilter, priorityFilter, search])

  if (!event) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <AlertTriangle size={40} aria-hidden="true" />
          <h2>No event yet</h2>
          <p>Create an event first to see your planning timeline.</p>
        </div>
      </div>
    )
  }

  const total = tasks.length
  const completed = tasks.filter((t) => t.status === 'complete').length

  function startEdit(task: Task) {
    setEditingTask(task)
    setTaskForm({ ...task })
    setShowForm(true)
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!taskForm.title || !taskForm.dueDate) return
    if (editingTask) {
      dispatch({ type: 'EDIT_TASK', taskId: editingTask.id, patch: taskForm })
    } else {
      dispatch({
        type: 'ADD_TASK',
        payload: {
          title: taskForm.title!,
          description: taskForm.description ?? '',
          dueDate: taskForm.dueDate!,
          priority: taskForm.priority as TaskPriority ?? 'medium',
          status: 'pending',
          category: taskForm.category ?? 'Custom',
          dependsOn: [],
          completedAt: undefined,
        },
      })
    }
    resetForm()
  }

  function resetForm() {
    setShowForm(false)
    setEditingTask(null)
    setTaskForm({ title: '', description: '', dueDate: '', priority: 'medium', category: '', status: 'pending', dependsOn: [] })
  }

  return (
    <div className="page-content">
      <div className="page-heading">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1>Planning Timeline</h1>
            <p>{completed} of {total} tasks complete</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={15} aria-hidden="true" /> Add Task
          </button>
        </div>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="progress-bar-container" style={{ height: '12px' }}>
          <div
            className={`progress-bar-fill ${completed === total ? 'success' : completed / total > 0.5 ? '' : 'warning'}`}
            style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            role="progressbar"
            aria-valuenow={completed}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={`${completed} of ${total} tasks completed`}
          />
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-warm-gray-400)' }} aria-hidden="true" />
          <input
            type="search"
            className="form-input"
            style={{ paddingLeft: '30px' }}
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search tasks"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all', 'pending', 'in_progress', 'complete', 'blocked'] as const).map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              className={`btn btn-sm ${priorityFilter === p ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPriorityFilter(p)}
              aria-pressed={priorityFilter === p}
            >
              {p === 'all' ? 'All' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit task form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--color-plum-200)' }}>
          <h2 className="card-title" style={{ marginBottom: '1rem' }}>{editingTask ? 'Edit Task' : 'New Task'}</h2>
          <form onSubmit={submitForm} aria-label={editingTask ? 'Edit task form' : 'Add task form'}>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label required" htmlFor="task-title">Task Title</label>
                <input
                  id="task-title"
                  type="text"
                  className="form-input"
                  value={taskForm.title ?? ''}
                  onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                  required
                  maxLength={120}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="task-desc">Description</label>
                <textarea
                  id="task-desc"
                  className="form-textarea"
                  value={taskForm.description ?? ''}
                  onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  maxLength={500}
                />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="task-due">Due Date</label>
                <input
                  id="task-due"
                  type="date"
                  className="form-input"
                  value={taskForm.dueDate ?? ''}
                  onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="task-priority">Priority</label>
                <select
                  id="task-priority"
                  className="form-select"
                  value={taskForm.priority ?? 'medium'}
                  onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="task-category">Category</label>
                <input
                  id="task-category"
                  type="text"
                  className="form-input"
                  value={taskForm.category ?? ''}
                  onChange={(e) => setTaskForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Venue, Catering"
                  maxLength={60}
                />
              </div>
              {editingTask && (
                <div className="form-group">
                  <label className="form-label required" htmlFor="task-status">Status</label>
                  <select
                    id="task-status"
                    className="form-select"
                    value={taskForm.status ?? 'pending'}
                    onChange={(e) => setTaskForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="complete">Complete</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary btn-sm">{editingTask ? 'Save' : 'Add Task'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Search size={36} aria-hidden="true" />
          <h3>No tasks found</h3>
          <p>Adjust your filters or add a new task.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '0' }}>
          <ul role="list" style={{ listStyle: 'none' }}>
            {filtered.map((task, i) => {
              const dueDate = parseISO(task.dueDate)
              const daysLeft = isValid(dueDate) ? differenceInDays(dueDate, today) : null
              const isOverdue = daysLeft !== null && daysLeft < 0 && task.status !== 'complete'

              return (
                <li key={task.id} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '1rem 1.25rem',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--color-warm-gray-100)' : 'none',
                  background: task.status === 'blocked' ? '#fff8f0' : '#fff',
                }}>
                  {/* Complete/Reopen button */}
                  <button
                    onClick={() => {
                      if (task.status === 'complete') dispatch({ type: 'REOPEN_TASK', taskId: task.id })
                      else dispatch({ type: 'COMPLETE_TASK', taskId: task.id })
                    }}
                    className={`task-checkbox${task.status === 'complete' ? ' checked' : ''}`}
                    aria-label={task.status === 'complete' ? `Reopen: ${task.title}` : `Complete: ${task.title}`}
                    aria-pressed={task.status === 'complete'}
                    style={{ marginTop: '2px' }}
                  >
                    {task.status === 'complete' && <Check size={11} style={{ color: '#fff' }} aria-hidden="true" />}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <p className={`task-title${task.status === 'complete' ? ' complete' : ''}`}>
                        {task.title}
                      </p>
                      <span className={`badge badge-${task.priority === 'critical' ? 'danger' : task.priority === 'high' ? 'warning' : 'gray'}`}>
                        {task.priority}
                      </span>
                      {task.status === 'blocked' && (
                        <span className="badge badge-warning">
                          <Lock size={10} aria-hidden="true" /> blocked
                        </span>
                      )}
                      {task.isGenerated && (
                        <span className="badge badge-navy" title="Auto-generated task">generated</span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted" style={{ marginTop: '2px' }}>{task.description}</p>
                    )}
                    <div className="task-meta">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: isOverdue ? 'var(--color-danger)' : daysLeft !== null && daysLeft <= 7 ? 'var(--color-warning)' : undefined }}>
                        <Clock size={11} aria-hidden="true" />
                        {isValid(dueDate) ? format(dueDate, 'MMM d, yyyy') : 'No date'}
                        {isOverdue && ' (overdue)'}
                        {!isOverdue && daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && ` (${daysLeft}d left)`}
                      </span>
                      {task.category && <span>{task.category}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => startEdit(task)}
                      aria-label={`Edit: ${task.title}`}
                    >
                      <Edit2 size={13} aria-hidden="true" />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => dispatch({ type: 'DELETE_TASK', taskId: task.id })}
                      aria-label={`Delete: ${task.title}`}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
