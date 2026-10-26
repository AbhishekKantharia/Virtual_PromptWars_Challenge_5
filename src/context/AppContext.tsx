// ============================================================
// EventWise AI  -  App Context (State Management)
// Central store using React Context + useReducer.
// ============================================================

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  AppState,
  EventDetails,
  Task,
  Vendor,
  BudgetPlan,
  Expense,
  Recommendation,
} from '../types';
import { loadState, saveState, emptyState } from '../data/persistence';
import {
  createBudgetPlan,
  recalculateActuals,
  addExpense,
  editExpense as editExpenseRecord,
  deleteExpense as deleteExpenseRecord,
  updateCategoryAmount,
  reallocateBudget,
  setContingencyPercent,
  calculateBudgetSummary,
} from '../engine/budget';
import {
  generateTimeline,
  completeTask,
  reopenTask,
  addTask,
  editTask,
  deleteTask,
} from '../engine/timeline';
import { addVendor, editVendor, deleteVendor, getSampleVendors } from '../engine/vendors';
import { generateRecommendations } from '../engine/recommendations';
import { computeReplanDiff, applyReplan } from '../engine/replanning';
import { computeReadiness } from '../engine/readiness';

// ----------------------------------------------------------------
// Actions
// ----------------------------------------------------------------
export type Action =
  | { type: 'CREATE_EVENT'; payload: EventDetails }
  | { type: 'UPDATE_EVENT'; payload: Partial<EventDetails> }
  | { type: 'UPDATE_CATEGORY_AMOUNT'; categoryId: string; amount: number }
  | { type: 'REALLOCATE_BUDGET' }
  | { type: 'SET_CONTINGENCY'; percent: number }
  | { type: 'ADD_EXPENSE'; payload: Omit<Expense, 'id' | 'createdAt'> }
  | { type: 'EDIT_EXPENSE'; expenseId: string; patch: Partial<Expense> }
  | { type: 'DELETE_EXPENSE'; expenseId: string }
  | { type: 'COMPLETE_TASK'; taskId: string }
  | { type: 'REOPEN_TASK'; taskId: string }
  | { type: 'ADD_TASK'; payload: Omit<Task, 'id' | 'isGenerated'> }
  | { type: 'EDIT_TASK'; taskId: string; patch: Partial<Task> }
  | { type: 'DELETE_TASK'; taskId: string }
  | { type: 'ADD_VENDOR'; payload: Omit<Vendor, 'id' | 'createdAt' | 'isSampleData'> }
  | { type: 'EDIT_VENDOR'; vendorId: string; patch: Partial<Vendor> }
  | { type: 'DELETE_VENDOR'; vendorId: string }
  | { type: 'SET_RECOMMENDATIONS'; payload: Recommendation[] }
  | { type: 'CLEAR_REPLAN_NOTICE' }
  | { type: 'RESET' };

// ----------------------------------------------------------------
// Reducer
// ----------------------------------------------------------------
export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'CREATE_EVENT': {
      const event = action.payload;
      const budget = createBudgetPlan(
        event.budget,
        event.type,
        10,
        event.priorities
      );
      const tasks = generateTimeline(event.type, event.date, new Date(), event.guestCount);
      const vendors = getSampleVendors();
      return withDerived({ ...state, lastReplan: null }, event, budget, tasks, vendors);
    }

    case 'UPDATE_EVENT': {
      if (!state.event) return state;
      const previous = state.event;
      const next: EventDetails = {
        ...previous,
        ...action.payload,
        updatedAt: new Date().toISOString(),
      };
      const diff = computeReplanDiff(previous, next);
      const currentBudget =
        state.budget ??
        createBudgetPlan(next.budget, next.type, 10, next.priorities);

      let budget = currentBudget;
      let tasks = state.tasks;
      let lastReplan: typeof diff | null = null;
      if (diff.changedFields.length > 0) {
        const existingIds = new Set(state.tasks.map((task) => task.id));
        const result = applyReplan(previous, next, currentBudget, tasks);
        budget = result.plan;
        tasks = result.tasks;
        lastReplan = {
          ...diff,
          tasksPreserved: result.tasks.filter(
            (task) =>
              existingIds.has(task.id) &&
              (task.status === 'complete' ||
                task.status === 'in_progress' ||
                Boolean(task.isUserEdited) ||
                !task.isGenerated)
          ).length,
          tasksAdded: result.tasks.filter((task) => !existingIds.has(task.id)).length,
        };
      }

      const updated = withDerived(state, next, budget, tasks, state.vendors);
      return { ...updated, lastReplan };
    }

    case 'UPDATE_CATEGORY_AMOUNT': {
      if (!state.event || !state.budget) return state;
      const budget = updateCategoryAmount(state.budget, action.categoryId, action.amount);
      return withDerived(state, state.event, budget, state.tasks, state.vendors);
    }

    case 'REALLOCATE_BUDGET': {
      if (!state.event || !state.budget) return state;
      const budget = reallocateBudget(
        state.budget,
        state.event.budget,
        state.event.type,
        state.event.priorities
      );
      return withDerived(state, state.event, budget, state.tasks, state.vendors);
    }

    case 'SET_CONTINGENCY': {
      if (!state.event || !state.budget) return state;
      const budget = setContingencyPercent(state.budget, state.event.budget, action.percent);
      return withDerived(state, state.event, budget, state.tasks, state.vendors);
    }

    case 'ADD_EXPENSE': {
      if (!state.event || !state.budget) return state;
      const budget = addExpense(state.budget, action.payload);
      return withDerived(state, state.event, budget, state.tasks, state.vendors);
    }

    case 'EDIT_EXPENSE': {
      if (!state.event || !state.budget) return state;
      const budget = editExpenseRecord(state.budget, action.expenseId, action.patch);
      return withDerived(state, state.event, budget, state.tasks, state.vendors);
    }

    case 'DELETE_EXPENSE': {
      if (!state.event || !state.budget) return state;
      const budget = deleteExpenseRecord(state.budget, action.expenseId);
      return withDerived(state, state.event, budget, state.tasks, state.vendors);
    }

    case 'COMPLETE_TASK':
      return { ...state, tasks: completeTask(state.tasks, action.taskId) };

    case 'REOPEN_TASK':
      return { ...state, tasks: reopenTask(state.tasks, action.taskId) };

    case 'ADD_TASK':
      return { ...state, tasks: addTask(state.tasks, action.payload) };

    case 'EDIT_TASK': {
      const target = state.tasks.find((task) => task.id === action.taskId);
      if (!target) return state;
      const patch: Partial<Task> = {
        ...action.patch,
        isUserEdited: target.isGenerated ? true : target.isUserEdited,
      };
      delete patch.id;
      if (action.patch.status === 'complete') {
        patch.completedAt = new Date().toISOString();
      } else if (action.patch.status) {
        patch.completedAt = undefined;
      }
      return { ...state, tasks: editTask(state.tasks, action.taskId, patch) };
    }

    case 'DELETE_TASK':
      return { ...state, tasks: deleteTask(state.tasks, action.taskId) };

    case 'ADD_VENDOR':
      return { ...state, vendors: addVendor(state.vendors, action.payload) };

    case 'EDIT_VENDOR':
      return { ...state, vendors: editVendor(state.vendors, action.vendorId, action.patch) };

    case 'DELETE_VENDOR':
      return { ...state, vendors: deleteVendor(state.vendors, action.vendorId) };

    case 'SET_RECOMMENDATIONS':
      return { ...state, recommendations: action.payload };

    case 'CLEAR_REPLAN_NOTICE':
      return { ...state, lastReplan: null };

    case 'RESET':
      return emptyState();

    default:
      return state;
  }
}

/**
 * Recalculate actuals, the summary, and recommendations whenever an input that
 * affects them changes. Vendors and task completion are passed through.
 */
function withDerived(
  state: AppState,
  event: EventDetails,
  budget: BudgetPlan,
  tasks: Task[],
  vendors: Vendor[]
): AppState {
  const recalculated = recalculateActuals(budget);
  const summary = calculateBudgetSummary(
    recalculated,
    event.budget,
    event.guestCount,
    event.currency
  );
  return {
    ...state,
    event,
    budget: recalculated,
    tasks,
    vendors,
    recommendations: generateRecommendations(event, summary),
  };
}

/** Recover a usable state if a stored event somehow has no budget. */
function hydrateState(): AppState {
  const loaded = loadState();
  if (!loaded) return emptyState();
  if (!loaded.event || loaded.budget) return loaded;

  const budget = createBudgetPlan(
    loaded.event.budget,
    loaded.event.type,
    10,
    loaded.event.priorities
  );
  const tasks =
    loaded.tasks.length > 0
      ? loaded.tasks
      : generateTimeline(loaded.event.type, loaded.event.date, new Date(), loaded.event.guestCount);
  return withDerived(loaded, loaded.event, budget, tasks, loaded.vendors);
}

// ----------------------------------------------------------------
// Context
// ----------------------------------------------------------------
interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  budgetSummary: ReturnType<typeof calculateBudgetSummary> | null;
  readiness: ReturnType<typeof computeReadiness> | null;
  refreshRecommendations: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, hydrateState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const budgetSummary = useMemo(
    () =>
      state.event && state.budget
        ? calculateBudgetSummary(
            state.budget,
            state.event.budget,
            state.event.guestCount,
            state.event.currency
          )
        : null,
    [state.event, state.budget]
  );

  const readiness = useMemo(
    () =>
      state.event && budgetSummary
        ? computeReadiness(state.event, state.tasks, budgetSummary)
        : null,
    [state.event, state.tasks, budgetSummary]
  );

  const refreshRecommendations = useCallback(() => {
    if (!state.event || !budgetSummary) return;
    dispatch({
      type: 'SET_RECOMMENDATIONS',
      payload: generateRecommendations(state.event, budgetSummary),
    });
  }, [state.event, budgetSummary]);

  return (
    <AppContext.Provider
      value={{ state, dispatch, budgetSummary, readiness, refreshRecommendations }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
