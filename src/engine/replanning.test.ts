import { describe, expect, it } from 'vitest'
import { computeReplanDiff, applyReplan, mergeTimelineTasks } from './replanning'
import { createBudgetPlan } from './budget'
import { generateTimeline } from './timeline'
import { makeEvent } from '../test/fixtures'
import { Task } from '../types'

const TODAY = new Date(2026, 0, 1, 12)

describe('replanning', () => {
  it('explains meaningful changes without changing unrelated tasks', () => {
    const previous = makeEvent()
    const next = makeEvent({
      date: '2030-11-01',
      guestCount: 150,
      budget: 25000,
      currency: 'EUR',
    })
    const diff = computeReplanDiff(previous, next)

    expect(diff.changedFields).toEqual(
      expect.arrayContaining(['date', 'guestCount', 'budget', 'currency'])
    )
    expect(diff.explanations.join(' ')).toMatch(/Currency changed/)
    expect(diff.budgetChanged).toBe(true)
  })

  it('preserves completed, in-progress, and user-added tasks across a date replan', () => {
    const previous = makeEvent()
    const next = makeEvent({ date: '2030-11-01' })
    const plan = createBudgetPlan(previous.budget, previous.type, 10, [])
    const generated = generateTimeline(previous.type, previous.date, TODAY, previous.guestCount)

    const completed = generated[0]
    const inProgress = generated[1]
    const tasks: Task[] = [
      { ...completed, status: 'complete', completedAt: '2026-01-02T00:00:00.000Z' },
      { ...inProgress, status: 'in_progress' },
      {
        id: 'custom-1',
        title: 'Book a live band',
        description: 'Personal choice',
        dueDate: '2030-09-01',
        priority: 'high',
        status: 'pending',
        category: 'Music',
        dependsOn: [],
        isGenerated: false,
      },
    ]

    const result = applyReplan(previous, next, plan, tasks)

    const preservedCompleted = result.tasks.find((task) => task.title === completed.title)!
    expect(preservedCompleted.status).toBe('complete')
    expect(preservedCompleted.dueDate).toBe(completed.dueDate)
    expect(result.tasks.some((task) => task.id === 'custom-1')).toBe(true)
    expect(result.tasks.some((task) => task.title === inProgress.title && task.status === 'in_progress')).toBe(true)
  })

  it('remaps dependencies to preserved ids so no task is stuck on a stale reference', () => {
    const previous = makeEvent()
    const next = makeEvent({ date: '2030-12-01' })
    const plan = createBudgetPlan(previous.budget, previous.type, 10, [])
    const tasks = generateTimeline(previous.type, previous.date, TODAY, previous.guestCount)

    const result = applyReplan(previous, next, plan, tasks)
    const ids = new Set(result.tasks.map((task) => task.id))

    for (const item of result.tasks) {
      for (const dependency of item.dependsOn) {
        expect(ids.has(dependency)).toBe(true)
      }
    }
  })

  it('keeps user edits and dependencies when regenerating by title', () => {
    const existing = generateTimeline('wedding', '2030-10-01', TODAY, 100)
    const edited = existing[0]
    const fresh = generateTimeline('wedding', '2030-12-01', TODAY, 100)

    const merged = mergeTimelineTasks(
      [
        {
          ...edited,
          title: fresh[0].title,
          dueDate: '2028-01-01',
          description: 'My edited description',
          priority: 'low',
          isUserEdited: true,
        },
      ],
      fresh
    )

    const match = merged.find((task) => task.title === fresh[0].title)!
    expect(match.id).toBe(edited.id)
    expect(match.dueDate).toBe('2028-01-01')
    expect(match.description).toBe('My edited description')
    expect(match.priority).toBe('low')
  })

  it('rebalances budget categories proportionally on a budget change', () => {
    const previous = makeEvent()
    const next = makeEvent({ budget: 40000 })
    const plan = createBudgetPlan(previous.budget, previous.type, 10, [])

    const result = applyReplan(previous, next, plan, [])
    const total = result.plan.categories.reduce((sum, category) => sum + category.plannedAmount, 0)

    expect(result.plan.contingencyAmount).toBe(4000)
    expect(Math.round(total * 100) / 100).toBe(36000)
  })
})
