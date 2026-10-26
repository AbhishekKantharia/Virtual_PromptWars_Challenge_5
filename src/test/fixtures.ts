import { BudgetSummary, EventDetails } from '../types'

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
