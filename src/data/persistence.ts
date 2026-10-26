// ============================================================
// EventWise AI — Data Persistence Layer
// Browser localStorage with schema versioning and safe recovery.
// Never stores credentials or external API keys.
// ============================================================

import {
  AppState,
  BudgetCategory,
  BudgetPlan,
  EventDetails,
  Expense,
  Recommendation,
  ReplanDiff,
  Task,
  Vendor,
} from '../types';
import { isValidIsoDate, sanitizeText } from '../engine/validation';

const STORAGE_KEY = 'eventwise-ai-v1';
export const CURRENT_SCHEMA_VERSION = 2;

const MAX_TASKS = 2000;
const MAX_VENDORS = 500;
const MAX_EXPENSES = 5000;
const MAX_RECOMMENDATIONS = 100;

/** Safely save app state to localStorage. */
export function saveState(state: AppState): boolean {
  try {
    const payload = JSON.stringify({
      ...state,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastSaved: new Date().toISOString(),
    });
    // Keep well inside the typical 5 MB localStorage quota.
    if (payload.length > 4.5 * 1024 * 1024) {
      console.warn('[EventWise] State exceeded the local storage soft limit — save skipped.');
      return false;
    }
    localStorage.setItem(STORAGE_KEY, payload);
    return true;
  } catch (err) {
    // Do not log the payload: it may contain user-entered contact details.
    console.warn('[EventWise] Could not save local data:', err instanceof Error ? err.name : 'unknown error');
    return false;
  }
}

/** Load and validate state from localStorage. Returns null on any failure. */
export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeStoredState(parsed);
    if (!normalized) {
      console.warn('[EventWise] Stored data failed validation — clearing it.');
      clearState();
    }
    return normalized;
  } catch {
    console.warn('[EventWise] Corrupt local data — clearing it.');
    clearState();
    return null;
  }
}

/** Wipe all stored event data. */
export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Validate and migrate arbitrary stored data to the current schema.
 * Exported for tests. Returns null when the data cannot be trusted.
 */
export function normalizeStoredState(raw: unknown): AppState | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.schemaVersion !== 'number') return null;
  if (raw.schemaVersion > CURRENT_SCHEMA_VERSION) return null;

  // v1 -> v2: add lastReplan and recommendation source.
  const candidate = { ...raw };
  if (raw.schemaVersion === 1) {
    candidate.lastReplan = null;
    if (Array.isArray(raw.recommendations)) {
      candidate.recommendations = raw.recommendations.map((item) =>
        isRecord(item) ? { ...item, source: item.source ?? 'deterministic' } : item
      );
    }
  }

  const event = candidate.event == null ? null : normalizeEvent(candidate.event);
  if (candidate.event != null && !event) return null;

  const budget = candidate.budget == null ? null : normalizeBudgetPlan(candidate.budget);
  if (candidate.budget != null && !budget) return null;

  const tasks = normalizeTasks(candidate.tasks);
  if (!tasks) return null;
  const vendors = normalizeVendors(candidate.vendors);
  if (!vendors) return null;
  const recommendations = normalizeRecommendations(candidate.recommendations);
  if (!recommendations) return null;
  const lastReplan = normalizeReplanDiff(candidate.lastReplan);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    event,
    budget,
    tasks,
    vendors,
    recommendations,
    lastReplan,
    lastSaved:
      typeof candidate.lastSaved === 'string' && !Number.isNaN(Date.parse(candidate.lastSaved))
        ? candidate.lastSaved
        : new Date().toISOString(),
  };
}

function normalizeEvent(raw: unknown): EventDetails | null {
  if (!isRecord(raw)) return null;
  const type = raw.type;
  const currency = raw.currency;
  const preference = raw.preference;
  if (type !== 'wedding' && type !== 'birthday' && type !== 'community') return null;
  if (currency !== 'USD' && currency !== 'EUR' && currency !== 'GBP' && currency !== 'INR' && currency !== 'CAD' && currency !== 'AUD') return null;
  if (preference !== 'indoor' && preference !== 'outdoor' && preference !== 'flexible') return null;
  if (typeof raw.date !== 'string' || !isValidIsoDate(raw.date)) return null;
  if (typeof raw.name !== 'string' || raw.name.trim().length < 2) return null;
  if (!isFiniteNumber(raw.guestCount) || raw.guestCount < 1 || raw.guestCount > 50000) return null;
  if (!isFiniteNumber(raw.budget) || raw.budget < 0 || raw.budget > 100_000_000) return null;

  const priorities = Array.isArray(raw.priorities)
    ? raw.priorities.filter((p): p is string => typeof p === 'string').slice(0, 20).map((p) => sanitizeText(p).slice(0, 80))
    : [];

  return {
    id: safeString(raw.id, 80) || 'imported-event',
    name: sanitizeText(raw.name).slice(0, 120),
    type,
    date: raw.date,
    city: safeString(raw.city, 100),
    guestCount: Math.round(raw.guestCount),
    budget: Math.max(0, roundMoney(raw.budget)),
    currency,
    preference,
    theme: safeString(raw.theme, 200),
    dietaryRequirements: safeString(raw.dietaryRequirements, 500),
    accessibilityNeeds: safeString(raw.accessibilityNeeds, 500),
    priorities,
    notes: safeString(raw.notes, 1000),
    createdAt: safeDate(raw.createdAt) ?? new Date().toISOString(),
    updatedAt: safeDate(raw.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizeBudgetPlan(raw: unknown): BudgetPlan | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.categories) || raw.categories.length === 0) return null;
  if (raw.categories.length > 50) return null;
  if (!Array.isArray(raw.expenses) || raw.expenses.length > MAX_EXPENSES) return null;
  if (!isFiniteNumber(raw.contingencyPercent) || raw.contingencyPercent < 0 || raw.contingencyPercent > 50) {
    return null;
  }
  if (!isFiniteNumber(raw.contingencyAmount) || raw.contingencyAmount < 0) return null;

  const categories: BudgetCategory[] = [];
  for (const item of raw.categories) {
    if (!isRecord(item)) return null;
    if (!isFiniteNumber(item.plannedAmount) || !isFiniteNumber(item.actualAmount)) return null;
    const category: BudgetCategory = {
      id: safeString(item.id, 80) || `category-${categories.length}`,
      name: safeString(item.name, 80) || 'Unnamed category',
      plannedAmount: Math.max(0, roundMoney(item.plannedAmount)),
      actualAmount: Math.max(0, roundMoney(item.actualAmount)),
      description: safeString(item.description, 200),
    };
    categories.push(category);
  }
  const categoryIds = new Set(categories.map((category) => category.id));
  if (categoryIds.size !== categories.length) return null;

  const expenses: Expense[] = [];
  for (const item of raw.expenses) {
    if (!isRecord(item)) return null;
    if (!categoryIds.has(safeString(item.categoryId, 80))) return null;
    if (!isFiniteNumber(item.amount) || item.amount < 0) return null;
    expenses.push({
      id: safeString(item.id, 80) || `expense-${expenses.length}`,
      categoryId: safeString(item.categoryId, 80),
      label: safeString(item.label, 120) || 'Expense',
      amount: roundMoney(item.amount),
      isQuoted: item.isQuoted === true,
      notes: safeString(item.notes, 300),
      createdAt: safeDate(item.createdAt) ?? new Date().toISOString(),
    });
  }

  return {
    categories,
    expenses,
    contingencyPercent: raw.contingencyPercent,
    contingencyAmount: roundMoney(raw.contingencyAmount),
  };
}

function normalizeTasks(raw: unknown): Task[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_TASKS) return null;
  const tasks: Task[] = [];
  const ids = new Set<string>();

  for (const item of raw) {
    if (!isRecord(item)) return null;
    if (typeof item.title !== 'string' || item.title.trim().length === 0) return null;
    if (typeof item.dueDate !== 'string' || !isValidIsoDate(item.dueDate)) return null;
    if (!isTaskPriority(item.priority) || !isTaskStatus(item.status)) return null;
    const id = safeString(item.id, 80) || `task-${tasks.length}`;
    if (ids.has(id)) return null;
    ids.add(id);
    tasks.push({
      id,
      title: sanitizeText(item.title).slice(0, 120),
      description: safeString(item.description, 500),
      dueDate: item.dueDate,
      priority: item.priority,
      status: item.status,
      category: safeString(item.category, 60),
      dependsOn: Array.isArray(item.dependsOn)
        ? item.dependsOn.filter((dep): dep is string => typeof dep === 'string').slice(0, 20)
        : [],
      isGenerated: item.isGenerated === true,
      isUserEdited: item.isUserEdited === true,
      completedAt: safeDate(item.completedAt),
    });
  }

  // Remove dangling dependency references so tasks cannot become stuck.
  const finalIds = new Set(tasks.map((task) => task.id));
  return tasks.map((task) => ({
    ...task,
    dependsOn: task.dependsOn.filter((depId) => finalIds.has(depId)),
  }));
}

function normalizeVendors(raw: unknown): Vendor[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_VENDORS) return null;
  const vendors: Vendor[] = [];

  for (const item of raw) {
    if (!isRecord(item)) return null;
    if (typeof item.name !== 'string' || item.name.trim().length === 0) return null;
    if (!isFiniteNumber(item.estimatedCost) || item.estimatedCost < 0) return null;
    if (item.quotedCost !== undefined && (!isFiniteNumber(item.quotedCost) || item.quotedCost < 0)) {
      return null;
    }
    if (!isVendorStatus(item.status)) return null;
    vendors.push({
      id: safeString(item.id, 80) || `vendor-${vendors.length}`,
      name: sanitizeText(item.name).slice(0, 120),
      category: safeString(item.category, 80) || 'Other',
      estimatedCost: roundMoney(item.estimatedCost),
      quotedCost: item.quotedCost === undefined ? undefined : roundMoney(item.quotedCost),
      contactName: safeString(item.contactName, 80),
      contactEmail: safeString(item.contactEmail, 150),
      contactPhone: safeString(item.contactPhone, 30),
      status: item.status,
      notes: safeString(item.notes, 500),
      cancellationTerms: safeString(item.cancellationTerms, 300),
      accessibilityInfo: safeString(item.accessibilityInfo, 300),
      reviewNotes: safeString(item.reviewNotes, 500) || undefined,
      isSampleData: item.isSampleData === true,
      createdAt: safeDate(item.createdAt) ?? new Date().toISOString(),
    });
  }
  return vendors;
}

function normalizeRecommendations(raw: unknown): Recommendation[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_RECOMMENDATIONS) return null;
  const recs: Recommendation[] = [];

  for (const item of raw) {
    if (!isRecord(item)) return null;
    if (typeof item.title !== 'string' || typeof item.description !== 'string') return null;
    if (typeof item.reasoning !== 'string' || !isRecommendationCategory(item.category)) return null;
    if (item.budgetImpact !== 'saves' && item.budgetImpact !== 'neutral' && item.budgetImpact !== 'adds') {
      return null;
    }
    if (item.estimatedCost !== undefined && (!isFiniteNumber(item.estimatedCost) || item.estimatedCost < 0)) {
      return null;
    }
    recs.push({
      id: safeString(item.id, 80) || `rec-${recs.length}`,
      category: item.category,
      title: sanitizeText(item.title).slice(0, 120),
      description: safeString(item.description, 800),
      reasoning: safeString(item.reasoning, 500),
      budgetImpact: item.budgetImpact,
      estimatedCost: item.estimatedCost === undefined ? undefined : roundMoney(item.estimatedCost),
      isLowCostAlternative: item.isLowCostAlternative === true,
      dietaryNote: safeString(item.dietaryNote, 300) || undefined,
      accessibilityNote: safeString(item.accessibilityNote, 300) || undefined,
      tags: Array.isArray(item.tags)
        ? item.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 10)
        : [],
      source: item.source === 'ai' ? 'ai' : 'deterministic',
    });
  }
  return recs;
}

function normalizeReplanDiff(raw: unknown): ReplanDiff | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.changedFields) || !Array.isArray(raw.explanations)) return null;
  return {
    changedFields: raw.changedFields.filter((field): field is string => typeof field === 'string').slice(0, 20),
    affectedTaskIds: Array.isArray(raw.affectedTaskIds)
      ? raw.affectedTaskIds.filter((id): id is string => typeof id === 'string').slice(0, 50)
      : [],
    affectedCategoryIds: Array.isArray(raw.affectedCategoryIds)
      ? raw.affectedCategoryIds.filter((id): id is string => typeof id === 'string').slice(0, 50)
      : [],
    budgetChanged: raw.budgetChanged === true,
    explanations: raw.explanations
      .filter((line): line is string => typeof line === 'string')
      .slice(0, 20)
      .map((line) => sanitizeText(line).slice(0, 500)),
    tasksPreserved: isFiniteNumber(raw.tasksPreserved) ? Math.max(0, Math.round(raw.tasksPreserved)) : 0,
    tasksAdded: isFiniteNumber(raw.tasksAdded) ? Math.max(0, Math.round(raw.tasksAdded)) : 0,
  };
}

// ----------------------------------------------------------------
// Export
// ----------------------------------------------------------------
/** Export the current app state as a formatted JSON string. */
export function exportStateAsJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

/** Trigger a browser file download of the exported plan. */
export function downloadExport(state: AppState, filename?: string): void {
  const json = exportStateAsJson(state);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = sanitizeFilename(state.event?.name ?? 'event-plan').slice(0, 80) || 'event-plan';
  a.href = url;
  a.download = filename ?? `eventwise-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the browser can start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function sanitizeFilename(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127 && !'<>:"/\\|?*'.includes(char);
    })
    .join('')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .toLowerCase();
}

/** Return an empty default AppState. */
export function emptyState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    event: null,
    budget: null,
    tasks: [],
    vendors: [],
    recommendations: [],
    lastReplan: null,
    lastSaved: new Date().toISOString(),
  };
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return sanitizeText(value).slice(0, maxLength);
}

function safeDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return Number.isNaN(Date.parse(value)) ? undefined : value;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isTaskStatus(value: unknown): value is Task['status'] {
  return value === 'pending' || value === 'in_progress' || value === 'complete' || value === 'blocked';
}

function isTaskPriority(value: unknown): value is Task['priority'] {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low';
}

function isVendorStatus(value: unknown): value is Vendor['status'] {
  return (
    value === 'researching' ||
    value === 'contacted' ||
    value === 'quoted' ||
    value === 'booked' ||
    value === 'cancelled'
  );
}

function isRecommendationCategory(value: unknown): value is Recommendation['category'] {
  return (
    value === 'theme' ||
    value === 'menu' ||
    value === 'activity' ||
    value === 'decoration' ||
    value === 'entertainment' ||
    value === 'logistics'
  );
}
