import { describe, expect, it } from 'vitest'
import {
  auditTasks,
  completionPercent,
  generateTimeline,
  isTaskOverdue,
  reopenTask,
} from './timeline'
import { Task } from '../types'

const TODAY = new Date(2026, 0, 1, 12)

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Task',
    description: '',
    dueDate: '2026-01-15',
    priority: 'medium',
    status: 'pending',
    category: 'General',
    dependsOn: [],
    isGenerated: true,
    ...overrides,
  }
}

describe('timeline generation', () => {
  it('generates dated tasks with resolved dependencies for a future event', () => {
    const tasks = generateTimeline('wedding', '2026-06-01', TODAY, 120)

    expect(tasks.length).toBeGreaterThan(10)
    expect(tasks.every((item) => item.dueDate >= '2026-01-01')).toBe(true)
    expect(tasks.every((item) => item.isGenerated)).toBe(true)

    const invite = tasks.find((item) => item.title === 'Send save-the-dates or invitations')!
    expect(invite.dependsOn.length).toBe(1)
    expect(tasks.some((item) => item.id === invite.dependsOn[0])).toBe(true)
  })

  it('adds guest-count complexity tasks only when thresholds are met', () => {
    const small = generateTimeline('wedding', '2026-06-01', TODAY, 50)
    const large = generateTimeline('wedding', '2026-06-01', TODAY, 120)

    expect(small.some((item) => item.title.includes('overflow parking'))).toBe(false)
    expect(large.some((item) => item.title.includes('overflow parking'))).toBe(true)
    expect(large.some((item) => item.title.includes('accommodation block'))).toBe(true)
  })

  it('condenses short-notice tasks and skips those needing more lead time', () => {
    const tasks = generateTimeline('wedding', '2026-01-10', TODAY, 50)

    expect(tasks.some((item) => item.title === 'Confirm venue booking')).toBe(false)
    expect(tasks.some((item) => item.title === 'Confirm catering / food arrangements')).toBe(true)
    expect(tasks.every((item) => item.dueDate >= '2026-01-01')).toBe(true)
  })

  it('returns an empty list for an invalid event date', () => {
    expect(generateTimeline('wedding', 'not-a-date', TODAY, 50)).toEqual([])
  })
})

describe('task auditing', () => {
  it('derives blocked status from incomplete dependencies', () => {
    const first = task({ id: 'a', title: 'First', status: 'pending' })
    const second = task({ id: 'b', title: 'Second', dependsOn: ['a'] })

    const audited = auditTasks([first, second], TODAY)
    expect(audited[1].status).toBe('blocked')

    const completedFirst = { ...first, status: 'complete' as const }
    const unblocked = auditTasks([completedFirst, second], TODAY)
    expect(unblocked[1].status).toBe('pending')
  })

  it('ignores dangling dependency ids', () => {
    const audited = auditTasks([task({ id: 'b', dependsOn: ['missing'] })], TODAY)
    expect(audited[0].status).toBe('pending')
  })

  it('detects overdue incomplete tasks and reopens completed ones', () => {
    const overdue = task({ dueDate: '2025-12-31' })
    expect(isTaskOverdue(overdue, TODAY)).toBe(true)
    expect(isTaskOverdue({ ...overdue, status: 'complete' }, TODAY)).toBe(false)

    const reopened = reopenTask([{ ...overdue, status: 'complete', completedAt: 'x' }], overdue.id)
    expect(reopened[0].status).toBe('pending')
    expect(reopened[0].completedAt).toBeUndefined()
  })

  it('weights completion toward higher-priority tasks', () => {
    const tasks = [
      task({ id: 'a', priority: 'critical', status: 'complete' }),
      task({ id: 'b', priority: 'low' }),
    ]
    expect(completionPercent(tasks)).toBe(86)
  })
})
