import { describe, expect, it } from 'vitest'
import { appReducer } from './AppContext'
import { emptyState } from '../data/persistence'
import { makeEvent } from '../test/fixtures'

describe('app reducer', () => {
  it('creates a complete starting workspace', () => {
    const state = appReducer(emptyState(), {
      type: 'CREATE_EVENT',
      payload: makeEvent(),
    })

    expect(state.event?.id).toBe('event-test')
    expect(state.budget).not.toBeNull()
    expect(state.tasks.length).toBeGreaterThan(0)
    expect(state.vendors.length).toBeGreaterThan(0)
    expect(state.recommendations.length).toBeGreaterThan(0)
    expect(state.recommendations.every((rec) => rec.source === 'deterministic')).toBe(true)
    expect(state.lastReplan).toBeNull()
  })

  it('replans on a date change without overwriting completed work or vendors', () => {
    let state = appReducer(emptyState(), {
      type: 'CREATE_EVENT',
      payload: makeEvent(),
    })

    const target = state.tasks.find((task) => task.title === 'Create guest list')!
    state = appReducer(state, { type: 'COMPLETE_TASK', taskId: target.id })

    const vendorsBefore = state.vendors
    state = appReducer(state, {
      type: 'UPDATE_EVENT',
      payload: { date: '2030-11-01' },
    })

    const preserved = state.tasks.find((task) => task.id === target.id)!
    expect(preserved.status).toBe('complete')
    expect(preserved.dueDate).toBe(target.dueDate)
    expect(state.vendors).toBe(vendorsBefore)
    expect(state.lastReplan).not.toBeNull()
    expect(state.lastReplan!.changedFields).toContain('date')
    expect(state.lastReplan!.tasksPreserved).toBeGreaterThanOrEqual(1)
  })

  it('updates the budget summary through expenses and reset clears everything', () => {
    let state = appReducer(emptyState(), {
      type: 'CREATE_EVENT',
      payload: makeEvent({ budget: 10000, guestCount: 50 }),
    })

    const category = state.budget!.categories[0]
    state = appReducer(state, {
      type: 'ADD_EXPENSE',
      payload: {
        categoryId: category.id,
        label: 'Test deposit',
        amount: 2500,
        isQuoted: true,
        notes: '',
      },
    })

    expect(state.budget!.categories.find((item) => item.id === category.id)!.actualAmount).toBe(2500)
    expect(state.budget!.expenses).toHaveLength(1)

    const reset = appReducer(state, { type: 'RESET' })
    expect(reset.event).toBeNull()
    expect(reset.tasks).toEqual([])
  })

  it('marks edited generated tasks for preservation on later replans', () => {
    let state = appReducer(emptyState(), {
      type: 'CREATE_EVENT',
      payload: makeEvent(),
    })
    const task = state.tasks.find((item) => item.isGenerated)!

    state = appReducer(state, {
      type: 'EDIT_TASK',
      taskId: task.id,
      patch: { title: 'My custom venue task', priority: 'low' },
    })

    expect(state.tasks.find((item) => item.id === task.id)!.isUserEdited).toBe(true)
    expect(state.tasks.find((item) => item.id === task.id)!.title).toBe('My custom venue task')
  })

  it('never allows an edit to overwrite immutable task identity', () => {
    let state = appReducer(emptyState(), {
      type: 'CREATE_EVENT',
      payload: makeEvent(),
    })
    const task = state.tasks[0]

    state = appReducer(state, {
      type: 'EDIT_TASK',
      taskId: task.id,
      patch: { id: 'hijacked-id', title: 'Safe edit' },
    })

    const edited = state.tasks.find((item) => item.title === 'Safe edit')!
    expect(edited.id).toBe(task.id)
  })
})
