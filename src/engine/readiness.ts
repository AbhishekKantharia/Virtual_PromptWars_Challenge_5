// ============================================================
// EventWise AI — Readiness Assessment Engine
// ============================================================

import {
  Task,
  BudgetSummary,
  ReadinessSummary,
  EventDetails,
} from '../types';
import { auditTasks, completionPercent, isTaskOverdue } from './timeline';
import { parseISO, differenceInDays, isValid, startOfDay } from 'date-fns';

/**
 * Compute an honest event readiness summary.
 * Never labels an event ready if critical tasks remain incomplete.
 */
export function computeReadiness(
  event: EventDetails,
  tasks: Task[],
  budgetSummary: BudgetSummary,
  today: Date = new Date()
): ReadinessSummary {
  const baseToday = startOfDay(today);
  const audited = auditTasks(tasks, today);
  const completedPct = completionPercent(tasks);

  const criticalIncomplete = audited.filter(
    (t) => t.priority === 'critical' && t.status !== 'complete'
  );
  const blockedTasks = audited.filter((t) => t.status === 'blocked');
  const overdueTasks = audited
    .filter((task) => isTaskOverdue(task, today))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const upcoming = audited
    .filter((t) => {
      if (t.status === 'complete') return false;
      const due = parseISO(t.dueDate);
      if (!isValid(due)) return false;
      const days = differenceInDays(startOfDay(due), baseToday);
      return days >= 0 && days <= 14;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Budget risk
  let budgetRisk: ReadinessSummary['budgetRisk'] = 'ok';
  let budgetRiskDetail = '';
  if (budgetSummary.isOverBudget) {
    budgetRisk = 'critical';
    budgetRiskDetail = `Actual spending (${fmt(budgetSummary.totalActual, budgetSummary.currency)}) exceeds the total budget (${fmt(budgetSummary.totalBudget, budgetSummary.currency)}).`;
  } else if (budgetSummary.isOverContingency) {
    budgetRisk = 'warning';
    budgetRiskDetail = 'Planned spend plus contingency exceeds the total budget. Review category allocations.';
  } else if (
    budgetSummary.totalBudget > 0 &&
    budgetSummary.remainingAfterContingency < budgetSummary.totalBudget * 0.05
  ) {
    budgetRisk = 'warning';
    budgetRiskDetail = 'Less than 5% of the budget remains after the contingency reserve.';
  }

  const nextActions: string[] = [];
  if (criticalIncomplete.length > 0) {
    nextActions.push(
      `Complete ${criticalIncomplete.length} critical task(s): ${criticalIncomplete
        .slice(0, 2)
        .map((t) => t.title)
        .join(', ')}${criticalIncomplete.length > 2 ? '…' : ''}`
    );
  }
  if (blockedTasks.length > 0) {
    nextActions.push(
      `${blockedTasks.length} task(s) are blocked by incomplete dependencies. Finish the prerequisite tasks or remove the dependency.`
    );
  }
  if (overdueTasks.length > 0) {
    nextActions.push(
      `${overdueTasks.length} task(s) are overdue. Reschedule or complete them first.`
    );
  }
  if (upcoming.length > 0) {
    nextActions.push(`${upcoming.length} task(s) are due in the next 14 days — review the timeline.`);
  }
  if (budgetRisk !== 'ok') {
    nextActions.push(budgetRiskDetail);
  }
  if (nextActions.length === 0) {
    const daysLeft = differenceInDays(startOfDay(parseISO(event.date)), baseToday);
    if (Number.isFinite(daysLeft) && daysLeft >= 0) {
      nextActions.push(
        `All critical checklist items are complete with ${daysLeft} day(s) until the event. Continue confirming vendor details.`
      );
    } else {
      nextActions.push('All critical checklist items are complete. Continue confirming vendor details.');
    }
  }

  return {
    completionPercent: completedPct,
    criticalIncomplete,
    blockedTasks,
    overdueTasks,
    upcomingDeadlines: upcoming,
    budgetRisk,
    budgetRiskDetail,
    nextActions,
    isReady: criticalIncomplete.length === 0 && budgetRisk !== 'critical' && tasks.length > 0,
  };
}

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
