// ============================================================
// EventWise AI — Readiness Assessment Engine
// ============================================================

import { Task, BudgetPlan, BudgetSummary, ReadinessSummary, EventDetails } from '../types';
import { completionPercent } from './timeline';
import { parseISO, differenceInDays, isValid } from 'date-fns';

/**
 * Compute an honest event readiness summary.
 * Never labels an event ready if critical tasks remain incomplete.
 */
export function computeReadiness(
  event: EventDetails,
  tasks: Task[],
  budget: BudgetPlan,
  budgetSummary: BudgetSummary,
  today: Date = new Date()
): ReadinessSummary {
  const completedPct = completionPercent(tasks);

  const criticalIncomplete = tasks.filter(
    (t) => t.priority === 'critical' && t.status !== 'complete'
  );

  const upcoming = tasks
    .filter((t) => {
      if (t.status === 'complete') return false;
      const due = parseISO(t.dueDate);
      if (!isValid(due)) return false;
      const days = differenceInDays(due, today);
      return days >= 0 && days <= 14;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Budget risk
  let budgetRisk: ReadinessSummary['budgetRisk'] = 'ok';
  let budgetRiskDetail = '';
  if (budgetSummary.isOverBudget) {
    budgetRisk = 'critical';
    budgetRiskDetail = `Actual spending (${fmt(budgetSummary.totalActual, budgetSummary.currency)}) exceeds total budget (${fmt(budgetSummary.totalBudget, budgetSummary.currency)}).`;
  } else if (budgetSummary.isOverContingency) {
    budgetRisk = 'warning';
    budgetRiskDetail = `Planned spend plus contingency exceeds budget. Review category allocations.`;
  } else if (budgetSummary.remainingAfterContingency < budgetSummary.totalBudget * 0.05) {
    budgetRisk = 'warning';
    budgetRiskDetail = 'Less than 5% of budget remains after contingency.';
  }

  const nextActions: string[] = [];
  if (criticalIncomplete.length > 0) {
    nextActions.push(`Complete ${criticalIncomplete.length} critical task(s): ${criticalIncomplete.slice(0, 2).map((t) => t.title).join(', ')}${criticalIncomplete.length > 2 ? '...' : ''}`);
  }
  if (upcoming.length > 0) {
    nextActions.push(`${upcoming.length} task(s) due in the next 14 days — review your timeline.`);
  }
  if (budgetRisk !== 'ok') {
    nextActions.push(budgetRiskDetail);
  }
  if (nextActions.length === 0) {
    nextActions.push('Great progress! Continue checking off timeline tasks and confirming vendors.');
  }

  return {
    completionPercent: completedPct,
    criticalIncomplete,
    upcomingDeadlines: upcoming,
    budgetRisk,
    budgetRiskDetail,
    nextActions,
    // Only ready when ALL critical tasks complete and budget is not in critical state
    isReady: criticalIncomplete.length === 0 && budgetRisk !== 'critical',
  };
}

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
