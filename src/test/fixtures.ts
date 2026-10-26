import { AppState, BudgetSummary, EventDetails } from '../types'
import { calculateBudgetSummary, createBudgetPlan } from '../engine/budget'
import { generateTimeline } from '../engine/timeline'
import { generateRecommendations } from '../engine/recommendations'
import { getSampleVendors } from '../engine/vendors'
import { saveState } from '../data/persistence'

export function makeEvent(overrides: Partial<EventDetails> = {}): EventDetails {
  return {
    id: 'event-test',
    name: 'Test Celebration',
    type: 'wedding',
    date: '2030-10-01',
    city: 'Testville',
    guestCount: 100,
    budget: 20000,
    currency: 'USD',
    preference: 'flexible',
    theme: 'Garden',
    dietaryRequirements: '',
    accessibilityNeeds: '',
    priorities: [],
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeBudgetSummary(overrides: Partial<BudgetSummary> = {}): BudgetSummary {
  return {
    totalBudget: 20000,
    totalPlanned: 18000,
    totalActual: 5000,
    contingencyAmount: 2000,
    plannedPlusContingency: 20000,
    remainingBudget: 15000,
    remainingAfterContingency: 13000,
    costPerGuest: 50,
    plannedCostPerGuest: 180,
    isOverBudget: false,
    isOverContingency: false,
    currency: 'USD',
    ...overrides,
  }
}

export function makeAppState(overrides: Partial<AppState> = {}): AppState {
  const event = overrides.event ?? makeEvent()
  const budget =
    overrides.budget ??
    (event ? createBudgetPlan(event.budget, event.type, 10, event.priorities) : null)
  const tasks =
    overrides.tasks ??
    (event ? generateTimeline(event.type, event.date, new Date(), event.guestCount) : [])
  const budgetSummary =
    event && budget
      ? calculateBudgetSummary(budget, event.budget, event.guestCount, event.currency)
      : null

  return {
    schemaVersion: 2,
    event,
    budget,
    tasks,
    vendors: overrides.vendors ?? getSampleVendors(),
    recommendations:
      overrides.recommendations ??
      (event && budgetSummary ? generateRecommendations(event, budgetSummary) : []),
    lastReplan: overrides.lastReplan ?? null,
    lastSaved: overrides.lastSaved ?? new Date().toISOString(),
  }
}

export function seedAppState(overrides: Partial<AppState> = {}): AppState {
  const state = makeAppState(overrides)
  saveState(state)
  return state
}
