import { describe, expect, it, vi } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  clearState,
  emptyState,
  exportStateAsJson,
  loadState,
  normalizeStoredState,
  sanitizeFilename,
  saveState,
} from './persistence'
import { createBudgetPlan } from '../engine/budget'
import { generateTimeline } from '../engine/timeline'
import { makeEvent } from '../test/fixtures'
import { AppState } from '../types'

function makeState(): AppState {
  const event = makeEvent()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    event,
    budget: createBudgetPlan(event.budget, event.type, 10, event.priorities),
    tasks: generateTimeline(event.type, event.date, new Date(2026, 0, 1), event.guestCount),
    vendors: [],
    recommendations: [],
    lastReplan: null,
    lastSaved: new Date().toISOString(),
  }
}

describe('persistence', () => {
  it('saves and reloads a complete state', () => {
    const state = makeState()
    expect(saveState(state)).toBe(true)

    const loaded = loadState()
    expect(loaded).not.toBeNull()
    expect(loaded!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(loaded!.event!.name).toBe(state.event!.name)
    expect(loaded!.budget!.categories.length).toBe(state.budget!.categories.length)
    expect(loaded!.tasks.length).toBe(state.tasks.length)
  })

  it('migrates v1 data and defaults recommendation sources', () => {
    const state = makeState()
    const v1 = {
      ...state,
      schemaVersion: 1,
      lastReplan: undefined,
      recommendations: [
        {
          id: 'old',
          category: 'theme',
          title: 'Old idea',
          description: 'From v1',
          reasoning: 'Because',
          budgetImpact: 'neutral',
          isLowCostAlternative: false,
          tags: [],
        },
      ],
    }

    const normalized = normalizeStoredState(v1)
    expect(normalized).not.toBeNull()
    expect(normalized!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(normalized!.lastReplan).toBeNull()
    expect(normalized!.recommendations[0].source).toBe('deterministic')
  })

  it('drops dangling task dependencies during normalization', () => {
    const state = makeState()
    const raw = {
      ...state,
      tasks: [
        {
          ...state.tasks[0],
          id: 'kept',
          dependsOn: ['missing-id'],
        },
      ],
    }

    const normalized = normalizeStoredState(raw)
    expect(normalized).not.toBeNull()
    expect(normalized!.tasks[0].dependsOn).toEqual([])
  })

  it('rejects future schemas and malformed structures', () => {
    expect(normalizeStoredState({ ...makeState(), schemaVersion: 999 })).toBeNull()
    expect(normalizeStoredState({ schemaVersion: 2, event: { name: 'x' } })).toBeNull()
    expect(normalizeStoredState('not an object')).toBeNull()
  })

  it('clears corrupt localStorage instead of crashing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    localStorage.setItem('eventwise-ai-v1', '{not valid json')
    expect(loadState()).toBeNull()
    expect(localStorage.getItem('eventwise-ai-v1')).toBeNull()
    warn.mockRestore()
  })

  it('exports JSON, builds safe filenames, and clears state', () => {
    const state = makeState()
    const json = exportStateAsJson(state)
    expect(JSON.parse(json).event.name).toBe(state.event!.name)
    expect(sanitizeFilename('  Sarah & James: Wedding / 2026  ')).toBe('sarah-&-james-wedding-2026')

    saveState(state)
    clearState()
    expect(loadState()).toBeNull()
  })

  it('returns an empty state with the current schema', () => {
    const empty = emptyState()
    expect(empty.event).toBeNull()
    expect(empty.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(empty.lastReplan).toBeNull()
  })
})
