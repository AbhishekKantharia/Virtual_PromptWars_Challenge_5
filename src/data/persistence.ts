// ============================================================
// EventWise AI — Data Persistence Layer
// Browser localStorage with schema versioning and safe recovery.
// Never stores credentials or external API keys.
// ============================================================

import { AppState } from '../types';

const STORAGE_KEY = 'eventwise-ai-v1';
const CURRENT_SCHEMA_VERSION = 1;

/** Safely save app state to localStorage. */
export function saveState(state: AppState): void {
  try {
    const payload = JSON.stringify({
      ...state,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastSaved: new Date().toISOString(),
    });
    // Enforce a 5 MB soft limit to prevent quota errors on most browsers
    if (payload.length > 5 * 1024 * 1024) {
      console.warn('[EventWise] State exceeded 5 MB soft limit — skipping save.');
      return;
    }
    localStorage.setItem(STORAGE_KEY, payload);
  } catch (err) {
    // QuotaExceededError or other serialisation failures — fail silently
    console.warn('[EventWise] Could not save to localStorage:', err);
  }
}

/** Load and validate state from localStorage. Returns null on any failure. */
export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrateState(parsed);
  } catch {
    // Malformed JSON — clear corrupt data and return null
    console.warn('[EventWise] Corrupt localStorage data — clearing.');
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
 * Migrate stored state to the current schema version.
 * Returns a safe default if the schema is unrecognised.
 */
function migrateState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // Validate required top-level shape
  if (typeof obj.schemaVersion !== 'number') return null;

  if (obj.schemaVersion === CURRENT_SCHEMA_VERSION) {
    // Basic shape validation
    if (!isPartialAppState(obj)) return null;
    return obj as AppState;
  }

  // Future migration paths go here (v1 -> v2, etc.)
  console.warn(`[EventWise] Unknown schema version ${obj.schemaVersion} — resetting.`);
  return null;
}

function isPartialAppState(obj: Record<string, unknown>): boolean {
  // Validate minimum required fields exist
  if (obj.event !== null && obj.event !== undefined && typeof obj.event !== 'object') return false;
  if (!Array.isArray(obj.tasks)) return false;
  if (!Array.isArray(obj.vendors)) return false;
  if (!Array.isArray(obj.recommendations)) return false;
  return true;
}

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
  a.href = url;
  a.download = filename ?? `eventwise-plan-${state.event?.name ?? 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
    lastSaved: new Date().toISOString(),
  };
}
