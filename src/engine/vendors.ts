// ============================================================
// EventWise AI — Vendor Management Engine
// Pure functions for CRUD and vendor comparison.
// ============================================================

import { Vendor, VendorStatus, ValidationResult, ValidationError } from '../types';
import { nanoid } from '../utils/nanoid';

export const VENDOR_CATEGORIES = [
  'Venue',
  'Catering',
  'Photography',
  'Videography',
  'Decoration',
  'Entertainment',
  'DJ / Music',
  'Flowers',
  'Transport',
  'Officiant',
  'Cake / Desserts',
  'Stationery',
  'Audio / Visual',
  'Security',
  'Cleaning',
  'Other',
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

/** Validate a vendor form before it is stored or exported. */
export function validateVendor(
  vendor: Omit<Vendor, 'id' | 'createdAt' | 'isSampleData'>
): ValidationResult {
  const errors: ValidationError[] = [];
  const name = vendor.name.trim();
  if (name.length < 2) {
    errors.push({ field: 'name', message: 'Vendor name must be at least 2 characters.' });
  }
  if (name.length > 120) {
    errors.push({ field: 'name', message: 'Vendor name must be 120 characters or fewer.' });
  }
  if (!VENDOR_CATEGORIES.includes(vendor.category as (typeof VENDOR_CATEGORIES)[number])) {
    errors.push({ field: 'category', message: 'Choose a valid vendor category.' });
  }
  if (!Number.isFinite(vendor.estimatedCost) || vendor.estimatedCost < 0) {
    errors.push({ field: 'estimatedCost', message: 'Estimated cost must be zero or more.' });
  }
  if (
    vendor.quotedCost !== undefined &&
    (!Number.isFinite(vendor.quotedCost) || vendor.quotedCost < 0)
  ) {
    errors.push({ field: 'quotedCost', message: 'Quoted cost must be zero or more.' });
  }
  if (vendor.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendor.contactEmail)) {
    errors.push({ field: 'contactEmail', message: 'Enter a valid email address or leave it blank.' });
  }
  if (vendor.contactEmail.length > 150) {
    errors.push({ field: 'contactEmail', message: 'Email must be 150 characters or fewer.' });
  }
  if (vendor.contactPhone.length > 30) {
    errors.push({ field: 'contactPhone', message: 'Phone must be 30 characters or fewer.' });
  }
  if (vendor.cancellationTerms.length > 300) {
    errors.push({ field: 'cancellationTerms', message: 'Cancellation terms must be 300 characters or fewer.' });
  }
  if (vendor.accessibilityInfo.length > 300) {
    errors.push({ field: 'accessibilityInfo', message: 'Accessibility info must be 300 characters or fewer.' });
  }
  if (vendor.notes.length > 500) {
    errors.push({ field: 'notes', message: 'Notes must be 500 characters or fewer.' });
  }
  if ((vendor.reviewNotes ?? '').length > 500) {
    errors.push({ field: 'reviewNotes', message: 'Review notes must be 500 characters or fewer.' });
  }
  return { valid: errors.length === 0, errors };
}

/** Create a new vendor record. */
export function createVendor(
  partial: Omit<Vendor, 'id' | 'createdAt' | 'isSampleData'>
): Vendor {
  return {
    ...partial,
    name: partial.name.trim(),
    id: nanoid(),
    isSampleData: false,
    createdAt: new Date().toISOString(),
  };
}

/** Add a vendor to the list. */
export function addVendor(vendors: Vendor[], vendor: Omit<Vendor, 'id' | 'createdAt' | 'isSampleData'>): Vendor[] {
  return [...vendors, createVendor(vendor)];
}

/** Edit an existing vendor. */
export function editVendor(vendors: Vendor[], vendorId: string, patch: Partial<Vendor>): Vendor[] {
  return vendors.map((v) => (v.id === vendorId ? { ...v, ...patch } : v));
}

/** Remove a vendor. */
export function deleteVendor(vendors: Vendor[], vendorId: string): Vendor[] {
  return vendors.filter((v) => v.id !== vendorId);
}

/** Total quoted cost across booked vendors. */
export function totalBookedCost(vendors: Vendor[]): number {
  return vendors
    .filter((v) => v.status === 'booked')
    .reduce((sum, v) => sum + (v.quotedCost ?? v.estimatedCost), 0);
}

/** Total estimated cost across all non-cancelled vendors. */
export function totalEstimatedCost(vendors: Vendor[]): number {
  return vendors
    .filter((v) => v.status !== 'cancelled')
    .reduce((sum, v) => sum + v.estimatedCost, 0);
}

/** Group vendors by category for display. */
export function groupByCategory(vendors: Vendor[]): Record<string, Vendor[]> {
  const groups: Record<string, Vendor[]> = {};
  for (const vendor of vendors) {
    if (!groups[vendor.category]) groups[vendor.category] = [];
    groups[vendor.category].push(vendor);
  }
  return groups;
}

/** Filter vendors by category. Pass undefined to get all. */
export function filterVendors(vendors: Vendor[], category?: string, status?: VendorStatus): Vendor[] {
  return vendors.filter((v) => {
    if (category && v.category !== category) return false;
    if (status && v.status !== status) return false;
    return true;
  });
}

/** Comparison score: lower = better value. Combines quoted cost and status weight. */
export function vendorComparisonScore(vendor: Vendor): number {
  const cost = vendor.quotedCost ?? vendor.estimatedCost;
  const statusWeights: Record<VendorStatus, number> = {
    booked: 0,
    quoted: 1,
    contacted: 2,
    researching: 3,
    cancelled: 999,
  };
  return cost + statusWeights[vendor.status] * 100;
}

/** Return sample vendor data for demo mode. All items are clearly labelled isSampleData: true. */
export function getSampleVendors(): Vendor[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'sample-1',
      name: 'Sunrise Garden Venue (Sample)',
      category: 'Venue',
      estimatedCost: 3500,
      quotedCost: 3200,
      contactName: 'Sample Contact',
      contactEmail: 'venue@example.com',
      contactPhone: '+1-555-0101',
      status: 'quoted',
      notes: 'Capacity 200. Has accessible ramp. ADA compliant bathrooms.',
      cancellationTerms: '30-day notice for full refund (sample terms)',
      accessibilityInfo: 'Wheelchair accessible, hearing loop available',
      isSampleData: true,
      createdAt: now,
    },
    {
      id: 'sample-2',
      name: 'Flavor Artisans Catering (Sample)',
      category: 'Catering',
      estimatedCost: 5000,
      contactName: 'Sample Contact',
      contactEmail: 'catering@example.com',
      contactPhone: '+1-555-0102',
      status: 'researching',
      notes: 'Offers vegan, gluten-free, and nut-free options. Not a real vendor.',
      cancellationTerms: '14-day notice for 50% refund (sample terms)',
      accessibilityInfo: 'Staff trained in allergy awareness',
      isSampleData: true,
      createdAt: now,
    },
    {
      id: 'sample-3',
      name: 'Luminary Photography (Sample)',
      category: 'Photography',
      estimatedCost: 2500,
      quotedCost: 2200,
      contactName: 'Sample Contact',
      contactEmail: 'photo@example.com',
      contactPhone: '+1-555-0103',
      status: 'contacted',
      notes: 'Package includes 8 hours coverage + edited album. Not a real vendor.',
      cancellationTerms: '60-day notice for 75% refund (sample terms)',
      accessibilityInfo: '',
      isSampleData: true,
      createdAt: now,
    },
  ];
}
