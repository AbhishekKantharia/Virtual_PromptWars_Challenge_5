// ============================================================
// EventWise AI — Dynamic Replanning Engine
// Detects changes to event details and generates a ReplanDiff.
// Preserves user decisions (completed tasks, entered vendors).
// ============================================================

import { EventDetails, BudgetPlan, Task, ReplanDiff } from '../types';
import { rebalanceBudget } from './budget';
import { generateTimeline } from './timeline';

/**
 * Compare two event snapshots and return a structured diff.
 * This tells the UI exactly what changed and what the user should review.
 */
export function computeReplanDiff(
  previous: EventDetails,
  next: EventDetails
): ReplanDiff {
  const changedFields: string[] = [];
  const explanations: string[] = [];

  if (previous.budget !== next.budget) {
    changedFields.push('budget');
    explanations.push(`Budget changed from ${previous.currency} ${previous.budget.toLocaleString()} to ${next.currency} ${next.budget.toLocaleString()}.`);
  }
  if (previous.guestCount !== next.guestCount) {
    changedFields.push('guestCount');
    explanations.push(`Guest count changed from ${previous.guestCount} to ${next.guestCount}. Catering, venue, and per-guest costs may change.`);
  }
  if (previous.date !== next.date) {
    changedFields.push('date');
    explanations.push(`Event date changed from ${previous.date} to ${next.date}. Review all task due dates.`);
  }
  if (previous.type !== next.type) {
    changedFields.push('type');
    explanations.push(`Event type changed from ${previous.type} to ${next.type}. Timeline tasks and budget allocation have been regenerated.`);
  }
  if (previous.theme !== next.theme) {
    changedFields.push('theme');
    explanations.push(`Theme changed to "${next.theme}". Recommendations have been updated.`);
  }
  if (previous.priorities.join(',') !== next.priorities.join(',')) {
    changedFields.push('priorities');
    explanations.push('Planning priorities changed. Recommendations have been updated.');
  }
  if (previous.dietaryRequirements !== next.dietaryRequirements) {
    changedFields.push('dietaryRequirements');
    explanations.push('Dietary requirements changed. Review catering recommendations.');
  }
  if (previous.preference !== next.preference) {
    changedFields.push('preference');
    explanations.push(`Venue preference changed to ${next.preference}. Check venue and decoration suggestions.`);
  }

  // Which task categories are affected by changed fields?
  const affectedCategoryIds: string[] = [];
  if (changedFields.includes('budget') || changedFields.includes('guestCount')) {
    affectedCategoryIds.push('budget-categories');
  }
  const affectedTaskIds: string[] = [];
  if (changedFields.includes('date') || changedFields.includes('type')) {
    affectedTaskIds.push('all-generated-tasks');
  }

  return {
    changedFields,
    affectedTaskIds,
    affectedCategoryIds,
    budgetChanged: changedFields.includes('budget'),
    explanations,
  };
}

/**
 * Apply a replanning update:
 * - If budget changed: rebalance planned category amounts
 * - If date or type changed: regenerate timeline for generated tasks only,
 *   preserving user-added and completed tasks
 * - Returns updated plan and tasks
 */
export function applyReplan(
  previous: EventDetails,
  next: EventDetails,
  currentPlan: BudgetPlan,
  currentTasks: Task[],
  today: Date = new Date()
): { plan: BudgetPlan; tasks: Task[] } {
  let plan = currentPlan;
  let tasks = currentTasks;

  // Rebalance budget if amount or type changed
  if (previous.budget !== next.budget || previous.type !== next.type) {
    plan = rebalanceBudget(currentPlan, next.budget, next.type);
  }

  // Regenerate timeline tasks if date or type changed
  if (previous.date !== next.date || previous.type !== next.type) {
    const newGenerated = generateTimeline(next.type, next.date, today);

    // Keep user-added tasks and completed tasks
    const preserved = currentTasks.filter(
      (t) => !t.isGenerated || t.status === 'complete'
    );

    // Merge: add new generated tasks that don't already exist (by title)
    const preservedTitles = new Set(preserved.map((t) => t.title));
    const freshTasks = newGenerated.filter((t) => !preservedTitles.has(t.title));

    tasks = [...preserved, ...freshTasks];
  }

  return { plan, tasks };
}
