import { describe, expect, it } from 'vitest'
import {
  daysUntilEvent,
  isShortNotice,
  isValidIsoDate,
  parseMoney,
  sanitizeText,
  validateEventDetails,
} from './validation'
import { makeEvent } from '../test/fixtures'

const TODAY = new Date(2026, 0, 15, 12)

describe('event validation', () => {
  it('accepts a complete, valid event', () => {
    const result = validateEventDetails(makeEvent(), TODAY)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects impossible and past dates', () => {
    const impossible = validateEventDetails(makeEvent({ date: '2030-02-30' }), TODAY)
    expect(impossible.valid).toBe(false)
    expect(impossible.errors.some((error) => error.field === 'date')).toBe(true)

    const past = validateEventDetails(makeEvent({ date: '2025-12-31' }), TODAY)
    expect(past.errors.some((error) => error.field === 'date')).toBe(true)
  })

  it('validates guest count, budget, type, currency, and preference', () => {
    const result = validateEventDetails(
      makeEvent({
        guestCount: 0,
        budget: -1,
        type: 'festival' as never,
        currency: 'BTC' as never,
        preference: 'rooftop' as never,
      }),
      TODAY
    )

    const fields = result.errors.map((error) => error.field)
    expect(fields).toEqual(
      expect.arrayContaining(['guestCount', 'budget', 'type', 'currency', 'preference'])
    )
  })

  it('checks strict ISO calendar dates', () => {
    expect(isValidIsoDate('2030-02-28')).toBe(true)
    expect(isValidIsoDate('2030-02-30')).toBe(false)
    expect(isValidIsoDate('2030-2-3')).toBe(false)
    expect(isValidIsoDate('not-a-date')).toBe(false)
  })

  it('detects short notice without treating past dates as upcoming', () => {
    expect(daysUntilEvent('2026-01-25', TODAY)).toBe(10)
    expect(isShortNotice('2026-01-25', 30, TODAY)).toBe(true)
    expect(isShortNotice('2026-03-25', 30, TODAY)).toBe(false)
    expect(isShortNotice('2026-01-01', 30, TODAY)).toBe(false)
  })

  it('sanitizes markup and control characters from free text', () => {
    expect(sanitizeText('  <script>alert(1)</script>Garden party\u0007  ')).toBe(
      'alert(1)Garden party'
    )
  })
})

describe('money parsing', () => {
  it('parses formatted amounts and rejects invalid input', () => {
    expect(parseMoney('1,234.56')).toBe(1234.56)
    expect(parseMoney('$ 50')).toBe(50)
    expect(parseMoney('0')).toBe(0)
    expect(parseMoney('-5')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('')).toBeNull()
  })
})
