import { describe, expect, it } from 'vitest'
import { computeReadiness } from './readiness'
import { calculateBudgetSummary, createBudgetPlan } from './budget'
import { generateTimeline } from './timeline'
import { makeEvent } from '../test/fixtures'

describe('readiness', () => {
  it('is not ready when critical tasks are incomplete', () => {
    const event = makeEvent({ date: '2030-06-01', budget: 20000, guestCount: 100 })
    const plan = createBudgetPlan(event.budget, event.type, 10, event.priorities)
    const tasks = generateTimeline(event.type, event.date, new Date(), event.guestCount)
    const summary = calculateBudgetSummary(plan, event.budget, event.guestCount, event.currency)
    const readiness = computeReadiness(event, tasks, summary, new Date())

    expect(readiness.criticalIncomplete.length).toBeGreaterThan(0)
    expect(readiness.isReady).toBe(false)
  })
})
