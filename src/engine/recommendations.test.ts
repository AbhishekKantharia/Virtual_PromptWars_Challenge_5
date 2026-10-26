import { describe, expect, it } from 'vitest'
import { deriveAssumptions, generateRecommendations } from './recommendations'
import { makeBudgetSummary, makeEvent } from '../test/fixtures'

describe('recommendations', () => {
  it('uses dietary and accessibility flags', () => {
    const event = makeEvent({
      dietaryRequirements: 'vegan, gluten-free',
      accessibilityNeeds: 'wheelchair access',
      priorities: ['accessibility'],
    })
    const summary = makeBudgetSummary()
    const recs = generateRecommendations(event, summary)
    expect(recs.some((r) => r.category === 'menu')).toBe(true)
    expect(recs.some((r) => r.accessibilityNote)).toBe(true)
  })

  it('gives budget-aware suggestions', () => {
    const event = makeEvent()
    const summary = makeBudgetSummary({ isOverBudget: true, remainingAfterContingency: -1000 })
    const recs = generateRecommendations(event, summary)
    expect(recs.some((r) => r.budgetImpact === 'saves')).toBe(true)
  })

  it('returns assumptions when details missing', () => {
    const assumptions = deriveAssumptions(makeEvent({ theme: '', city: '', dietaryRequirements: '', accessibilityNeeds: '' }))
    expect(assumptions.length).toBeGreaterThan(0)
  })
})
