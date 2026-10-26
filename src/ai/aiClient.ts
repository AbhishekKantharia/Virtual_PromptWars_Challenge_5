// ============================================================
// EventWise AI — Optional AI suggestion client
// The deterministic engine is always the source of truth.
// This client only calls a same-origin server endpoint after an
// explicit user action, and validates every returned field.
// ============================================================

import { BudgetSummary, EventDetails, Recommendation } from '../types';
import { sanitizeText } from '../engine/validation';
import { nanoid } from '../utils/nanoid';

export interface AiEnhanceResult {
  ok: boolean;
  recommendations: Recommendation[];
  message: string;
}

const AI_ENDPOINT = '/api/ai/recommendations';
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_AI_RECOMMENDATIONS = 8;

/** Build a deliberately small payload: no names, contacts, or free-form notes. */
export function buildAiPayload(event: EventDetails, budgetSummary: BudgetSummary) {
  return {
    event: {
      type: event.type,
      date: event.date,
      guestCount: event.guestCount,
      budget: event.budget,
      currency: event.currency,
      preference: event.preference,
      theme: event.theme.slice(0, 200),
      city: event.city.slice(0, 100),
      dietaryRequirements: event.dietaryRequirements.slice(0, 500),
      accessibilityNeeds: event.accessibilityNeeds.slice(0, 500),
      priorities: event.priorities.slice(0, 20).map((priority) => priority.slice(0, 80)),
    },
    budget: {
      totalBudget: budgetSummary.totalBudget,
      totalPlanned: budgetSummary.totalPlanned,
      totalActual: budgetSummary.totalActual,
      contingencyAmount: budgetSummary.contingencyAmount,
      remainingAfterContingency: budgetSummary.remainingAfterContingency,
      isOverBudget: budgetSummary.isOverBudget,
      isOverContingency: budgetSummary.isOverContingency,
    },
  };
}

/**
 * Request optional AI ideas. Any failure returns ok:false with a safe message,
 * so the UI can keep showing deterministic recommendations.
 */
export async function requestAiRecommendations(
  event: EventDetails,
  budgetSummary: BudgetSummary,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; endpoint?: string } = {}
): Promise<AiEnhanceResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = options.endpoint ?? AI_ENDPOINT;
  const payload = buildAiPayload(event, budgetSummary);

  if (JSON.stringify(payload).length > 12_000) {
    return failure('The event details are too large to send for optional AI suggestions.');
  }

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      credentials: 'same-origin',
    });

    if (!response.ok) {
      return failure(safeStatusMessage(response.status));
    }

    const data: unknown = await response.json();
    const recommendations = parseAiRecommendations(data);
    if (recommendations.length === 0) {
      return failure('The AI service returned no usable suggestions. Deterministic ideas are still available.');
    }
    return {
      ok: true,
      recommendations,
      message: `Added ${recommendations.length} optional AI suggestion(s). Review them before acting.`,
    };
  } catch (error) {
    if (isAbortError(error)) {
      return failure('The AI request timed out. Deterministic ideas are still available.');
    }
    return failure('The AI service is unavailable right now. Deterministic ideas are still available.');
  } finally {
    globalThis.clearTimeout(timer);
  }
}

/**
 * Validate untrusted model output. Invalid items are dropped rather than
 * partially rendered, and all strings are sanitized and length-limited.
 */
export function parseAiRecommendations(raw: unknown): Recommendation[] {
  if (!isRecord(raw) || !Array.isArray(raw.recommendations)) return [];

  const output: Recommendation[] = [];
  for (const item of raw.recommendations.slice(0, MAX_AI_RECOMMENDATIONS)) {
    if (!isRecord(item)) continue;
    if (!isCategory(item.category)) continue;
    if (!isBudgetImpact(item.budgetImpact)) continue;
    const title = clean(item.title, 120);
    const description = clean(item.description, 800);
    const reasoning = clean(item.reasoning, 500);
    if (!title || !description || !reasoning) continue;

    const recommendation: Recommendation = {
      id: `ai-${nanoid()}`,
      category: item.category,
      title,
      description,
      reasoning,
      budgetImpact: item.budgetImpact,
      isLowCostAlternative: item.isLowCostAlternative === true,
      tags: Array.isArray(item.tags)
        ? item.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 8).map((tag) => clean(tag, 40)).filter(Boolean)
        : [],
      source: 'ai',
    };

    if (isNonNegativeNumber(item.estimatedCost)) {
      recommendation.estimatedCost = Math.round(item.estimatedCost * 100) / 100;
    }
    const dietary = clean(item.dietaryNote, 300);
    const accessibility = clean(item.accessibilityNote, 300);
    if (dietary) recommendation.dietaryNote = dietary;
    if (accessibility) recommendation.accessibilityNote = accessibility;

    output.push(recommendation);
  }
  return output;
}

export function safeStatusMessage(status: number): string {
  if (status === 429) return 'Too many AI requests. Please wait a moment and try again.';
  if (status === 503) return 'Optional AI suggestions are not configured on this server. Deterministic ideas are still available.';
  if (status === 504) return 'The AI provider timed out. Deterministic ideas are still available.';
  return 'The AI service could not provide suggestions. Deterministic ideas are still available.';
}

function failure(message: string): AiEnhanceResult {
  return { ok: false, recommendations: [], message };
}

function clean(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return sanitizeText(value).slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isCategory(value: unknown): value is Recommendation['category'] {
  return (
    value === 'theme' ||
    value === 'menu' ||
    value === 'activity' ||
    value === 'decoration' ||
    value === 'entertainment' ||
    value === 'logistics'
  );
}

function isBudgetImpact(value: unknown): value is Recommendation['budgetImpact'] {
  return value === 'saves' || value === 'neutral' || value === 'adds';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
