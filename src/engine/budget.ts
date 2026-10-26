// ============================================================
// EventWise AI — Budget Planning Engine
// Pure, deterministic, no side effects, fully testable.
// ============================================================

import { EventType, BudgetCategory, BudgetPlan, BudgetSummary, Expense } from '../types';
import { nanoid } from '../utils/nanoid';

// ----------------------------------------------------------------
// Allocation profiles
// Each profile sums to 1.0; values are DEFAULTS, always user-editable.
// These are planning starting points, not verified vendor prices.
// ----------------------------------------------------------------
interface AllocationProfile {
  venue: number;
  catering: number;
  decoration: number;
  photography: number;
  entertainment: number;
  logistics: number;
  invitations: number;
  attire: number;
  miscellaneous: number;
}

const PROFILES: Record<EventType, AllocationProfile> = {
  wedding: {
    venue: 0.30,
    catering: 0.30,
    decoration: 0.08,
    photography: 0.10,
    entertainment: 0.07,
    logistics: 0.04,
    invitations: 0.02,
    attire: 0.07,
    miscellaneous: 0.02,
  },
  birthday: {
    venue: 0.20,
    catering: 0.35,
    decoration: 0.12,
    photography: 0.08,
    entertainment: 0.15,
    logistics: 0.04,
    invitations: 0.02,
    attire: 0.00,
    miscellaneous: 0.04,
  },
  community: {
    venue: 0.25,
    catering: 0.30,
    decoration: 0.08,
    photography: 0.05,
    entertainment: 0.12,
    logistics: 0.10,
    invitations: 0.05,
    attire: 0.00,
    miscellaneous: 0.05,
  },
};

const CATEGORY_LABELS: Record<keyof AllocationProfile, string> = {
  venue: 'Venue',
  catering: 'Catering & Food',
  decoration: 'Decoration',
  photography: 'Photography & Video',
  entertainment: 'Entertainment',
  logistics: 'Logistics & Transport',
  invitations: 'Invitations & Stationery',
  attire: 'Attire & Styling',
  miscellaneous: 'Miscellaneous',
};

const CATEGORY_DESCRIPTIONS: Record<keyof AllocationProfile, string> = {
  venue: 'Rental, setup, breakdown, permits',
  catering: 'Food, beverages, service staff, tableware',
  decoration: 'Flowers, lighting, table settings, props',
  photography: 'Photographer, videographer, albums, editing',
  entertainment: 'DJ, band, speakers, activities',
  logistics: 'Transport, parking, coordination fees',
  invitations: 'Design, printing, postage, digital tools',
  miscellaneous: 'Tips, unexpected costs, small purchases',
};

const PRIORITY_BOOSTS: Record<string, Partial<AllocationProfile>> = {
  photography: { photography: 0.10 },
  catering: { catering: 0.10 },
  entertainment: { entertainment: 0.07 },
  decoration: { decoration: 0.05 },
  'guest comfort': { venue: 0.03, catering: 0.03 },
  'budget savings': { miscellaneous: 0.02 },
  'unique experience': { entertainment: 0.04, decoration: 0.03 },
  accessibility: { logistics: 0.04, venue: 0.02 },
};

const DEFAULT_CONTINGENCY_PERCENT = 10;
const MAX_CONTINGENCY_PERCENT = 50;

/** Build profile weights, then apply explicit user priorities without stereotyping. */
export function getAllocationWeights(
  eventType: EventType,
  priorities: string[] = []
): AllocationProfile {
  const profile = { ...PROFILES[eventType] };
  for (const priority of priorities) {
    const boosts = PRIORITY_BOOSTS[priority.trim().toLowerCase()];
    if (!boosts) continue;
    for (const [key, value] of Object.entries(boosts) as Array<
      [keyof AllocationProfile, number]
    >) {
      profile[key] += value;
    }
  }

  // Renormalise so the profile still sums to exactly 1.
  const total = Object.values(profile).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return PROFILES[eventType];
  for (const key of Object.keys(profile) as Array<keyof AllocationProfile>) {
    profile[key] = profile[key] / total;
  }
  return profile;
}

/**
 * Build a fresh BudgetPlan from total budget, event type, priorities, and
 * contingency. The allocatable amount (budget minus reserve) is split across
 * categories. All amounts are rounded, with the final cent assigned so the
 * category sum exactly equals the allocatable amount.
 */
export function createBudgetPlan(
  totalBudget: number,
  eventType: EventType,
  contingencyPercent = DEFAULT_CONTINGENCY_PERCENT,
  priorities: string[] = []
): BudgetPlan {
  const safeBudget = sanitizeMoney(totalBudget);
  const clampedContingency = clampContingency(contingencyPercent);
  const contingencyAmount = round2(safeBudget * (clampedContingency / 100));
  const allocatableBudget = Math.max(0, round2(safeBudget - contingencyAmount));
  const profile = getAllocationWeights(eventType, priorities);

  const categories: BudgetCategory[] = (Object.keys(profile) as Array<keyof AllocationProfile>)
    .filter((key) => profile[key] > 0)
    .map((key) => ({
      id: nanoid(),
      name: CATEGORY_LABELS[key],
      plannedAmount: round2(allocatableBudget * profile[key]),
      actualAmount: 0,
      description: CATEGORY_DESCRIPTIONS[key],
    }));

  applyRoundingResidual(categories, allocatableBudget);

  return {
    categories,
    expenses: [],
    contingencyPercent: clampedContingency,
    contingencyAmount,
  };
}

/** Recalculate actualAmount for every category from the current expenses. */
export function recalculateActuals(plan: BudgetPlan): BudgetPlan {
  const actualByCategory: Record<string, number> = {};
  for (const expense of plan.expenses) {
    actualByCategory[expense.categoryId] =
      (actualByCategory[expense.categoryId] ?? 0) + expense.amount;
  }

  const updatedCategories = plan.categories.map((cat) => ({
    ...cat,
    actualAmount: round2(actualByCategory[cat.id] ?? 0),
  }));

  return { ...plan, categories: updatedCategories };
}

/** Calculate a full budget summary for display and alerting. */
export function calculateBudgetSummary(
  plan: BudgetPlan,
  totalBudget: number,
  guestCount: number,
  currency: string
): BudgetSummary {
  const safeBudget = sanitizeMoney(totalBudget);
  const totalPlanned = round2(plan.categories.reduce((s, c) => s + c.plannedAmount, 0));
  const totalActual = round2(plan.categories.reduce((s, c) => s + c.actualAmount, 0));
  const contingency = round2(plan.contingencyAmount);
  const plannedPlusContingency = round2(totalPlanned + contingency);
  const remainingBudget = round2(safeBudget - totalActual);
  const remainingAfterContingency = round2(safeBudget - totalActual - contingency);
  const safeGuests = Number.isFinite(guestCount) && guestCount > 0 ? guestCount : 0;

  return {
    totalBudget: safeBudget,
    totalPlanned,
    totalActual,
    contingencyAmount: contingency,
    plannedPlusContingency,
    remainingBudget,
    remainingAfterContingency,
    costPerGuest: safeGuests > 0 ? round2(totalActual / safeGuests) : 0,
    plannedCostPerGuest: safeGuests > 0 ? round2(totalPlanned / safeGuests) : 0,
    isOverBudget: totalActual > safeBudget + 0.001,
    isOverContingency: plannedPlusContingency > safeBudget + 0.001,
    currency,
  };
}

/**
 * Rebalance category allocations when the total budget changes.
 * Existing category ratios are preserved so user edits are not silently
 * discarded. If no allocations exist, fall back to the event-type profile.
 */
export function rebalanceBudget(
  plan: BudgetPlan,
  newTotalBudget: number,
  eventType: EventType
): BudgetPlan {
  const safeBudget = sanitizeMoney(newTotalBudget);
  const clampedContingency = clampContingency(plan.contingencyPercent);
  const contingencyAmount = round2(safeBudget * (clampedContingency / 100));
  const allocatable = Math.max(0, round2(safeBudget - contingencyAmount));
  const currentTotal = round2(
    plan.categories.reduce((sum, category) => sum + category.plannedAmount, 0)
  );

  let categories: BudgetCategory[];
  if (currentTotal > 0) {
    const factor = allocatable / currentTotal;
    categories = plan.categories.map((category) => ({
      ...category,
      plannedAmount: round2(category.plannedAmount * factor),
    }));
  } else {
    const profile = getAllocationWeights(eventType);
    categories = plan.categories.map((category) => {
      const key = findProfileKey(category.name);
      return {
        ...category,
        plannedAmount: key ? round2(allocatable * profile[key]) : 0,
      };
    });
  }

  applyRoundingResidual(categories, allocatable);

  return {
    ...plan,
    categories,
    contingencyPercent: clampedContingency,
    contingencyAmount,
  };
}

/**
 * Set the contingency reserve and rescale allocations so that planned
 * categories plus the reserve never exceed the total budget.
 */
export function setContingencyPercent(
  plan: BudgetPlan,
  totalBudget: number,
  percent: number
): BudgetPlan {
  const safeBudget = sanitizeMoney(totalBudget);
  const clamped = clampContingency(percent);
  const contingencyAmount = round2(safeBudget * (clamped / 100));
  const allocatable = Math.max(0, round2(safeBudget - contingencyAmount));
  const currentTotal = round2(
    plan.categories.reduce((sum, category) => sum + category.plannedAmount, 0)
  );

  let categories: BudgetCategory[];
  if (currentTotal > 0) {
    const factor = allocatable / currentTotal;
    categories = plan.categories.map((category) => ({
      ...category,
      plannedAmount: round2(category.plannedAmount * factor),
    }));
  } else {
    // Distributing evenly is the least surprising fallback if all categories
    // were previously zeroed by the user.
    const share = plan.categories.length > 0 ? allocatable / plan.categories.length : 0;
    categories = plan.categories.map((category) => ({
      ...category,
      plannedAmount: round2(share),
    }));
  }

  applyRoundingResidual(categories, allocatable);

  return {
    ...plan,
    categories,
    contingencyPercent: clamped,
    contingencyAmount,
  };
}

/** Add an expense and update actuals. */
export function addExpense(
  plan: BudgetPlan,
  expense: Omit<Expense, 'id' | 'createdAt'>
): BudgetPlan {
  const newExpense: Expense = {
    ...expense,
    amount: sanitizeMoney(expense.amount),
    id: nanoid(),
    createdAt: new Date().toISOString(),
  };
  const updated = { ...plan, expenses: [...plan.expenses, newExpense] };
  return recalculateActuals(updated);
}

/** Edit an existing expense. */
export function editExpense(
  plan: BudgetPlan,
  expenseId: string,
  patch: Partial<Expense>
): BudgetPlan {
  const updated = {
    ...plan,
    expenses: plan.expenses.map((e) =>
      e.id === expenseId
        ? {
            ...e,
            ...patch,
            amount: patch.amount === undefined ? e.amount : sanitizeMoney(patch.amount),
          }
        : e
    ),
  };
  return recalculateActuals(updated);
}

/** Delete an expense and update actuals. */
export function deleteExpense(plan: BudgetPlan, expenseId: string): BudgetPlan {
  const updated = {
    ...plan,
    expenses: plan.expenses.filter((e) => e.id !== expenseId),
  };
  return recalculateActuals(updated);
}

/**
 * Update a category's planned amount. We allow the total to exceed the budget
 * so the UI can surface an honest warning; the value itself is never negative.
 */
export function updateCategoryAmount(
  plan: BudgetPlan,
  categoryId: string,
  newAmount: number
): BudgetPlan {
  const safeAmount = sanitizeMoney(newAmount);
  return {
    ...plan,
    categories: plan.categories.map((c) =>
      c.id === categoryId ? { ...c, plannedAmount: safeAmount } : c
    ),
  };
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sanitizeMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, round2(value));
}

function clampContingency(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CONTINGENCY_PERCENT;
  return Math.max(0, Math.min(MAX_CONTINGENCY_PERCENT, value));
}

function findProfileKey(name: string): keyof AllocationProfile | undefined {
  return (Object.keys(CATEGORY_LABELS) as Array<keyof AllocationProfile>).find(
    (key) => CATEGORY_LABELS[key] === name
  );
}

/** Assign rounding drift to the largest category so sums are exact to the cent. */
function applyRoundingResidual(categories: BudgetCategory[], target: number): void {
  if (categories.length === 0) return;
  const sum = round2(categories.reduce((total, category) => total + category.plannedAmount, 0));
  const residual = round2(target - sum);
  if (residual === 0) return;

  let largestIndex = 0;
  for (let i = 1; i < categories.length; i += 1) {
    if (categories[i].plannedAmount > categories[largestIndex].plannedAmount) {
      largestIndex = i;
    }
  }
  categories[largestIndex].plannedAmount = Math.max(
    0,
    round2(categories[largestIndex].plannedAmount + residual)
  );
}
