import { describe, expect, it } from 'vitest'
import {
  addExpense,
  calculateBudgetSummary,
  createBudgetPlan,
  rebalanceBudget,
  setContingencyPercent,
  updateCategoryAmount,
} from './budget'

function plannedTotal(plan: ReturnType<typeof createBudgetPlan>): number {
  return Math.round(plan.categories.reduce((sum, category) => sum + category.plannedAmount, 0) * 100) / 100
}

describe('budget engine', () => {
  it('creates allocations that conserve the budget minus contingency', () => {
    const plan = createBudgetPlan(10000, 'wedding', 10, ['Photography'])

    expect(plan.contingencyPercent).toBe(10)
    expect(plan.contingencyAmount).toBe(1000)
    expect(plannedTotal(plan)).toBe(9000)

    const summary = calculateBudgetSummary(plan, 10000, 100, 'USD')
    expect(summary.totalPlanned).toBe(9000)
    expect(summary.plannedPlusContingency).toBe(10000)
    expect(summary.isOverContingency).toBe(false)
    expect(summary.plannedCostPerGuest).toBe(90)
  })

  it('keeps category sums exact to the cent when percentages create fractions', () => {
    const plan = createBudgetPlan(999.99, 'community', 10, [])

    expect(plannedTotal(plan)).toBe(899.99)
    expect(plan.contingencyAmount).toBe(100)
  })

  it('rescales categories when the contingency changes', () => {
    const plan = createBudgetPlan(10000, 'birthday', 10, [])
    const updated = setContingencyPercent(plan, 10000, 25)

    expect(updated.contingencyAmount).toBe(2500)
    expect(plannedTotal(updated)).toBe(7500)
    expect(updated.contingencyPercent).toBe(25)
  })

  it('rebalances proportionally when the total budget changes', () => {
    const plan = createBudgetPlan(10000, 'wedding', 10, [])
    const firstShare =
      plan.categories.find((category) => category.name === 'Venue')!.plannedAmount / plannedTotal(plan)
    const updated = rebalanceBudget(plan, 20000, 'wedding')
    const secondShare =
      updated.categories.find((category) => category.name === 'Venue')!.plannedAmount / plannedTotal(updated)

    expect(plannedTotal(updated)).toBe(18000)
    expect(updated.contingencyAmount).toBe(2000)
    expect(secondShare).toBeCloseTo(firstShare, 5)
  })

  it('recalculates actuals and flags overspending honestly', () => {
    const plan = createBudgetPlan(10000, 'wedding', 10, [])
    const venue = plan.categories.find((category) => category.name === 'Venue')!
    const catering = plan.categories.find((category) => category.name === 'Catering & Food')!

    const withExpense = addExpense(plan, {
      categoryId: venue.id,
      label: 'Venue deposit',
      amount: 3000,
      isQuoted: true,
      notes: '',
    })

    expect(withExpense.categories.find((category) => category.id === venue.id)!.actualAmount).toBe(3000)

    const over = addExpense(withExpense, {
      categoryId: catering.id,
      label: 'Catering',
      amount: 8000,
      isQuoted: true,
      notes: '',
    })
    const summary = calculateBudgetSummary(over, 10000, 50, 'USD')

    expect(summary.totalActual).toBe(11000)
    expect(summary.isOverBudget).toBe(true)
    expect(summary.remainingBudget).toBe(-1000)
  })

  it('allows an intentionally over-allocated category and surfaces it', () => {
    const plan = createBudgetPlan(10000, 'wedding', 10, [])
    const venue = plan.categories.find((category) => category.name === 'Venue')!
    const updated = updateCategoryAmount(plan, venue.id, 50000)
    const summary = calculateBudgetSummary(updated, 10000, 100, 'USD')

    expect(updated.categories.find((category) => category.id === venue.id)!.plannedAmount).toBe(50000)
    expect(summary.isOverContingency).toBe(true)
  })

  it('clamps negative money values instead of storing them', () => {
    const plan = createBudgetPlan(10000, 'wedding', 10, [])
    const venue = plan.categories[0]
    const updated = updateCategoryAmount(plan, venue.id, -500)

    expect(updated.categories[0].plannedAmount).toBe(0)
  })
})
