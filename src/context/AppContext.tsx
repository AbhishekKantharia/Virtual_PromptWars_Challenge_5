// ============================================================
// EventWise AI — App Context (State Management)
// Central store using React Context + useReducer.
// ============================================================

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { AppState, EventDetails, Task, Vendor, BudgetPlan, Expense, Recommendation } from '../types';
import { loadState, saveState, emptyState } from '../data/persistence';
import { createBudgetPlan, recalculateActuals, addExpense, editExpense as _editExpense, deleteExpense as _deleteExpense, updateCategoryAmount, calculateBudgetSummary } from '../engine/budget';
import { generateTimeline, completeTask, reopenTask, addTask, editTask, deleteTask } from '../engine/timeline';
import { addVendor, editVendor, deleteVendor, getSampleVendors } from '../engine/vendors';
import { generateRecommendations } from '../engine/recommendations';
import { computeReplanDiff, applyReplan } from '../engine/replanning';
import { computeReadiness } from '../engine/readiness';

// ----------------------------------------------------------------
// Actions
// ----------------------------------------------------------------
type Action =
  | { type: 'CREATE_EVENT'; payload: EventDetails }
  | { type: 'UPDATE_EVENT'; payload: Partial<EventDetails> }
  | { type: 'SET_BUDGET_PLAN'; payload: BudgetPlan }
  | { type: 'UPDATE_CATEGORY_AMOUNT'; categoryId: string; amount: number }
  | { type: 'ADD_EXPENSE'; payload: Omit<Expense, 'id' | 'createdAt'> }
  | { type: 'EDIT_EXPENSE'; expenseId: string; patch: Partial<Expense> }
  | { type: 'DELETE_EXPENSE'; expenseId: string }
  | { type: 'SET_TASKS'; payload: Task[] }
  | { type: 'COMPLETE_TASK'; taskId: string }
  | { type: 'REOPEN_TASK'; taskId: string }
  | { type: 'ADD_TASK'; payload: Omit<Task, 'id' | 'isGenerated'> }
  | { type: 'EDIT_TASK'; taskId: string; patch: Partial<Task> }
  | { type: 'DELETE_TASK'; taskId: string }
  | { type: 'ADD_VENDOR'; payload: Omit<Vendor, 'id' | 'createdAt' | 'isSampleData'> }
  | { type: 'EDIT_VENDOR'; vendorId: string; patch: Partial<Vendor> }
  | { type: 'DELETE_VENDOR'; vendorId: string }
  | { type: 'SET_RECOMMENDATIONS'; payload: Recommendation[] }
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'RESET' };

// ----------------------------------------------------------------
// Reducer
// ----------------------------------------------------------------
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'CREATE_EVENT': {
      const event = action.payload;
      const budget = createBudgetPlan(event.budget, event.type);
      const tasks = generateTimeline(event.type, event.date);
      const vendors = getSampleVendors();
      const budgetSummary = calculateBudgetSummary(budget, event.budget, event.guestCount, event.currency);
      const recommendations = generateRecommendations(event, budgetSummary);
      return { ...state, event, budget, tasks, vendors, recommendations };
    }

    case 'UPDATE_EVENT': {
      if (!state.event || !state.budget) return state;
      const previous = state.event;
      const next: EventDetails = { ...previous, ...action.payload, updatedAt: new Date().toISOString() };
      const diff = computeReplanDiff(previous, next);

      let { budget, tasks } = state;
      if (diff.changedFields.length > 0) {
        const result = applyReplan(previous, next, budget, tasks);
        budget = result.plan;
        tasks = result.tasks;
      }

      const updatedBudget = recalculateActuals(budget);
      const budgetSummary = calculateBudgetSummary(updatedBudget, next.budget, next.guestCount, next.currency);
      const recommendations = generateRecommendations(next, budgetSummary);

      return { ...state, event: next, budget: updatedBudget, tasks, recommendations };
    }

    case 'SET_BUDGET_PLAN':
      return { ...state, budget: action.payload };

    case 'UPDATE_CATEGORY_AMOUNT': {
      if (!state.budget) return state;
      const budget = updateCategoryAmount(state.budget, action.categoryId, action.amount);
      return { ...state, budget };
    }

    case 'ADD_EXPENSE': {
      if (!state.budget) return state;
      return { ...state, budget: addExpense(state.budget, action.payload) };
    }

    case 'EDIT_EXPENSE': {
      if (!state.budget) return state;
      return { ...state, budget: _editExpense(state.budget, action.expenseId, action.patch) };
    }

    case 'DELETE_EXPENSE': {
      if (!state.budget) return state;
      return { ...state, budget: _deleteExpense(state.budget, action.expenseId) };
    }

    case 'SET_TASKS':
      return { ...state, tasks: action.payload };

    case 'COMPLETE_TASK':
      return { ...state, tasks: completeTask(state.tasks, action.taskId) };

    case 'REOPEN_TASK':
      return { ...state, tasks: reopenTask(state.tasks, action.taskId) };

    case 'ADD_TASK':
      return { ...state, tasks: addTask(state.tasks, action.payload) };

    case 'EDIT_TASK':
      return { ...state, tasks: editTask(state.tasks, action.taskId, action.patch) };

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

    case 'LOAD_STATE':
      return action.payload;

    case 'RESET':
      return emptyState();

    default:
      return state;
  }
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
  const [state, dispatch] = useReducer(reducer, emptyState(), () => {
    const loaded = loadState();
    return loaded ?? emptyState();
  });

  // Persist on every state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Derived values
  const budgetSummary = state.event && state.budget
    ? calculateBudgetSummary(state.budget, state.event.budget, state.event.guestCount, state.event.currency)
    : null;

  const readiness = state.event && state.budget && budgetSummary
    ? computeReadiness(state.event, state.tasks, state.budget, budgetSummary)
    : null;

  const refreshRecommendations = useCallback(() => {
    if (!state.event || !budgetSummary) return;
    const recs = generateRecommendations(state.event, budgetSummary);
    dispatch({ type: 'SET_RECOMMENDATIONS', payload: recs });
  }, [state.event, budgetSummary]);

  return (
    <AppContext.Provider value={{ state, dispatch, budgetSummary, readiness, refreshRecommendations }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
