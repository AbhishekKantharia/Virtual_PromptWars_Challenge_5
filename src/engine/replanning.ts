// ============================================================
// EventWise AI — Dynamic Replanning Engine
// Detects changes to event details and generates a ReplanDiff.
// Preserves user decisions (completed/edited tasks, entered vendors).
// ============================================================

import { EventDetails, BudgetPlan, Task, ReplanDiff } from '../types';
import { rebalanceBudget } from './budget';
import { generateTimeline } from './timeline';

/**
 * Compare two event snapshots and return a structured diff.
 * Vendors are intentionally not touched by replanning.
 */
export function computeReplanDiff(previous: EventDetails, next: EventDetails): ReplanDiff {
  const changedFields: string[] = [];
  const explanations: string[] = [];

  if (previous.budget !== next.budget) {
    changedFields.push('budget');
    explanations.push(
      `Budget changed from ${previous.currency} ${previous.budget.toLocaleString()} to ${next.currency} ${next.budget.toLocaleString()}. Category allocations were scaled proportionally and expense records were preserved.`
    );
  }
  if (previous.guestCount !== next.guestCount) {
    changedFields.push('guestCount');
    explanations.push(
      `Guest count changed from ${previous.guestCount} to ${next.guestCount}. Catering, venue capacity, per-guest costs, and large-event tasks may be affected.`
    );
  }
  if (previous.date !== next.date) {
    changedFields.push('date');
    explanations.push(
      `Event date changed from ${previous.date} to ${next.date}. Pending generated task dates were recalculated; completed tasks kept their original dates.`
    );
  }
  if (previous.type !== next.type) {
    changedFields.push('type');
    explanations.push(
      `Event type changed from ${previous.type} to ${next.type}. Timeline tasks were regenerated and budget allocations were scaled, while completed tasks and vendors were kept.`
    );
  }
  if (previous.theme !== next.theme) {
    changedFields.push('theme');
    explanations.push(`Theme changed to "${next.theme || 'not specified'}". Ideas were refreshed.`);
  }
  if (previous.priorities.join(',') !== next.priorities.join(',')) {
    changedFields.push('priorities');
    explanations.push('Planning priorities changed. Budget defaults and ideas were refreshed.');
  }
  if (previous.dietaryRequirements !== next.dietaryRequirements) {
    changedFields.push('dietaryRequirements');
    explanations.push('Dietary requirements changed. Catering ideas and labelling guidance were refreshed.');
  }
  if (previous.accessibilityNeeds !== next.accessibilityNeeds) {
    changedFields.push('accessibilityNeeds');
    explanations.push('Accessibility needs changed. Venue and logistics guidance was refreshed.');
  }
  if (previous.preference !== next.preference) {
    changedFields.push('preference');
    explanations.push(
      `Venue preference changed to ${next.preference}. Check weather contingency, venue, and decoration ideas.`
    );
  }
  if (previous.city !== next.city) {
    changedFields.push('city');
    explanations.push(`Location changed to "${next.city || 'not specified'}". Local-supplier guidance was refreshed.`);
  }
  if (previous.notes !== next.notes) {
    changedFields.push('notes');
    explanations.push('Notes changed. Review recommendations for anything the notes should influence.');
  }

  const affectedCategoryIds: string[] = [];
  if (changedFields.includes('budget') || changedFields.includes('guestCount')) {
    affectedCategoryIds.push('budget-categories');
  }
  const affectedTaskIds: string[] = [];
  if (
    changedFields.includes('date') ||
    changedFields.includes('type') ||
    changedFields.includes('guestCount')
  ) {
    affectedTaskIds.push('generated-tasks');
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
 * - Budget/type changes rescale planned category amounts proportionally.
 * - Date/type/guest-count changes regenerate generated tasks while preserving
 *   completed tasks, in-progress tasks, and user-edited tasks.
 * - User-entered vendor records are never modified here.
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

  if (previous.budget !== next.budget || previous.type !== next.type) {
    plan = rebalanceBudget(currentPlan, next.budget, next.type);
  }

  if (
    previous.date !== next.date ||
    previous.type !== next.type ||
    previous.guestCount !== next.guestCount
  ) {
    const freshGenerated = generateTimeline(next.type, next.date, today, next.guestCount);
    tasks = mergeTimelineTasks(currentTasks, freshGenerated);
  }

  return { plan, tasks };
}

/**
 * Merge regenerated tasks with existing ones by title.
 * Completed tasks keep their date and history; user-edited tasks keep their
 * edits; in-progress tasks keep their status. Dependencies are remapped to the
 * preserved IDs so no task becomes permanently blocked by a stale reference.
 */
export function mergeTimelineTasks(currentTasks: Task[], freshGenerated: Task[]): Task[] {
  const existingByTitle = new Map<string, Task>();
  for (const task of currentTasks) {
    if (task.isGenerated) existingByTitle.set(task.title, task);
  }

  const freshIdToTitle = new Map<string, string>();
  for (const task of freshGenerated) freshIdToTitle.set(task.id, task.title);

  const titleToMergedId = new Map<string, string>();
  for (const fresh of freshGenerated) {
    const existing = existingByTitle.get(fresh.title);
    titleToMergedId.set(fresh.title, existing?.id ?? fresh.id);
  }

  const mergedGenerated = freshGenerated.map((fresh) => {
    const existing = existingByTitle.get(fresh.title);
    if (!existing) return fresh;

    const preserveDate = existing.isUserEdited || existing.status === 'complete';
    const preserveEdits = Boolean(existing.isUserEdited);

    return {
      ...fresh,
      id: existing.id,
      dueDate: preserveDate ? existing.dueDate : fresh.dueDate,
      description: preserveEdits ? existing.description : fresh.description,
      priority: preserveEdits ? existing.priority : fresh.priority,
      category: preserveEdits ? existing.category : fresh.category,
      status: existing.status,
      completedAt: existing.completedAt,
      isUserEdited: existing.isUserEdited,
      dependsOn: preserveEdits
        ? existing.dependsOn
        : fresh.dependsOn
            .map((freshId) => freshIdToTitle.get(freshId))
            .filter((title): title is string => Boolean(title))
            .map((title) => titleToMergedId.get(title))
            .filter((id): id is string => Boolean(id)),
    };
  });

  const freshTitles = new Set(freshGenerated.map((task) => task.title));
  const preserved = currentTasks.filter((task) => {
    if (!task.isGenerated) return true; // user-added tasks always stay
    if (freshTitles.has(task.title)) return false; // already merged above
    return (
      task.status === 'complete' ||
      task.status === 'in_progress' ||
      Boolean(task.isUserEdited)
    );
  });

  const finalTasks = [...preserved, ...mergedGenerated];
  const existingIds = new Set(finalTasks.map((task) => task.id));

  return finalTasks.map((task) => ({
    ...task,
    dependsOn: task.dependsOn.filter((depId) => existingIds.has(depId)),
  }));
}
