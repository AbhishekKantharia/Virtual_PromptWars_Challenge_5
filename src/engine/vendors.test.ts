import { describe, expect, it } from 'vitest'
import { addVendor, deleteVendor, editVendor, validateVendor } from './vendors'

describe('vendors', () => {
  it('validates vendor fields', () => {
    const result = validateVendor({
      name: 'A',
      category: 'Venue',
      estimatedCost: -1,
      quotedCost: -5,
      contactName: '',
      contactEmail: 'bad',
      contactPhone: '',
      status: 'quoted',
      notes: '',
      cancellationTerms: '',
      accessibilityInfo: '',
    } as any)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === 'name')).toBe(true)
    expect(result.errors.some((e) => e.field === 'estimatedCost')).toBe(true)
    expect(result.errors.some((e) => e.field === 'contactEmail')).toBe(true)
  })

  it('ignores invalid edits and never overwrites identity fields', () => {
    const vendors = addVendor([], {
      name: 'Venue Co',
      category: 'Venue',
      estimatedCost: 1000,
      contactName: 'Pat',
      contactEmail: 'pat@venue.com',
      contactPhone: '123',
      status: 'researching',
      notes: '',
      cancellationTerms: '',
      accessibilityInfo: '',
    })
    const originalId = vendors[0].id
    const edited = editVendor(vendors, originalId, {
      id: 'hacked',
      createdAt: '2000-01-01T00:00:00.000Z',
      isSampleData: true,
      estimatedCost: -10,
    } as any)
    expect(edited[0].id).toBe(originalId)
    expect(edited[0].createdAt).toBe(vendors[0].createdAt)
    expect(edited[0].isSampleData).toBe(false)
    expect(edited[0].estimatedCost).toBe(1000)
  })

  it('deletes vendors', () => {
    const vendors = addVendor([], {
      name: 'Caterer',
      category: 'Catering',
      estimatedCost: 2000,
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      status: 'contacted',
      notes: '',
      cancellationTerms: '',
      accessibilityInfo: '',
    })
    const remaining = deleteVendor(vendors, vendors[0].id)
    expect(remaining).toHaveLength(0)
  })
})
