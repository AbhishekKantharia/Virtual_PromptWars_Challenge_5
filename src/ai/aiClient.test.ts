import { describe, expect, it, vi } from 'vitest'
import {
  buildAiPayload,
  parseAiRecommendations,
  requestAiRecommendations,
  safeStatusMessage,
} from './aiClient'
import { makeBudgetSummary, makeEvent } from '../test/fixtures'

const VALID_RECOMMENDATION = {
  category: 'menu',
  title: 'Seasonal vegetarian menu',
  description: 'Use locally grown produce for a flexible menu.',
  reasoning: 'Lower food miles and broad dietary coverage.',
  budgetImpact: 'saves',
  estimatedCost: 1200,
  isLowCostAlternative: true,
  dietaryNote: 'Confirm allergens with the caterer.',
  accessibilityNote: 'Offer large-print menus.',
  tags: ['vegetarian', '<b>seasonal</b>'],
}

describe('AI client payload privacy', () => {
  it('does not send event names, notes, or vendor contact data', () => {
    const event = makeEvent({
      name: 'Private Name',
      notes: 'Confidential surprise details',
      city: 'Testville',
    })
    const payload = buildAiPayload(event, makeBudgetSummary())

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('Private Name')
    expect(serialized).not.toContain('Confidential surprise details')
    expect(serialized).toContain('Testville')
  })

  it('only uses a small validated payload', () => {
    const payload = buildAiPayload(makeEvent(), makeBudgetSummary())
    expect(payload.event).not.toHaveProperty('name')
    expect(payload.event).not.toHaveProperty('notes')
    expect(payload.event).not.toHaveProperty('id')
  })
})

describe('AI response validation', () => {
  it('keeps valid suggestions and drops malformed ones', () => {
    const parsed = parseAiRecommendations({
      recommendations: [
        VALID_RECOMMENDATION,
        { ...VALID_RECOMMENDATION, category: 'not-a-category' },
        { ...VALID_RECOMMENDATION, reasoning: '' },
        null,
      ],
    })

    expect(parsed).toHaveLength(1)
    expect(parsed[0].source).toBe('ai')
    expect(parsed[0].title).toBe('Seasonal vegetarian menu')
    expect(parsed[0].tags).toEqual(['vegetarian', 'seasonal'])
    expect(parsed[0].id).toMatch(/^ai-/)
  })

  it('rejects non-object responses and clamps the number of suggestions', () => {
    expect(parseAiRecommendations(null)).toEqual([])
    expect(parseAiRecommendations({ recommendations: 'nope' })).toEqual([])

    const many = parseAiRecommendations({
      recommendations: Array.from({ length: 20 }, () => VALID_RECOMMENDATION),
    })
    expect(many.length).toBeLessThanOrEqual(8)
  })
})

describe('optional AI request', () => {
  it('returns validated suggestions from a successful endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ recommendations: [VALID_RECOMMENDATION] }),
    }) as unknown as typeof fetch

    const result = await requestAiRecommendations(makeEvent(), makeBudgetSummary(), {
      fetchImpl,
    })

    expect(result.ok).toBe(true)
    expect(result.recommendations).toHaveLength(1)
    expect(result.message).toMatch(/Review them before acting/)
  })

  it('fails safely when the server is not configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as unknown as typeof fetch

    const result = await requestAiRecommendations(makeEvent(), makeBudgetSummary(), {
      fetchImpl,
    })

    expect(result.ok).toBe(false)
    expect(result.recommendations).toEqual([])
    expect(result.message).toMatch(/not configured/)
    expect(safeStatusMessage(429)).toMatch(/Too many/)
  })

  it('fails safely on network errors and unusable responses', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch
    const failed = await requestAiRecommendations(makeEvent(), makeBudgetSummary(), {
      fetchImpl: failing,
    })
    expect(failed.ok).toBe(false)
    expect(failed.message).toMatch(/unavailable/)

    const empty = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ recommendations: [] }),
    }) as unknown as typeof fetch
    const noIdeas = await requestAiRecommendations(makeEvent(), makeBudgetSummary(), {
      fetchImpl: empty,
    })
    expect(noIdeas.ok).toBe(false)
    expect(noIdeas.message).toMatch(/no usable suggestions/i)
  })
})
