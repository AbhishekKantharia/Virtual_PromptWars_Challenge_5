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

const VENDOR_STATUSES: VendorStatus[] = [
  'researching',
  'contacted',
  'quoted',
  'booked',
  'cancelled',
];

/** Validate a vendor form before it is stored or exported. */
export function validateVendor(
  vendor: Omit<Vendor, 'id' | 'createdAt' | 'isSampleData'>
): ValidationResult {
  const errors: ValidationError[] = [];
  const name = typeof vendor.name === 'string' ? vendor.name.trim() : '';
  const contactName = typeof vendor.contactName === 'string' ? vendor.contactName.trim() : '';
  const contactEmail = typeof vendor.contactEmail === 'string' ? vendor.contactEmail : '';
  const contactPhone = typeof vendor.contactPhone === 'string' ? vendor.contactPhone : '';
  const notes = typeof vendor.notes === 'string' ? vendor.notes : '';
  const cancellationTerms =
    typeof vendor.cancellationTerms === 'string' ? vendor.cancellationTerms : '';
  const accessibilityInfo =
    typeof vendor.accessibilityInfo === 'string' ? vendor.accessibilityInfo : '';
  const reviewNotes = typeof vendor.reviewNotes === 'string' ? vendor.reviewNotes : '';

  if (name.length < 2) {
    errors.push({ field: 'name', message: 'Vendor name must be at least 2 characters.' });
  }
  if (name.length > 120) {
    errors.push({ field: 'name', message: 'Vendor name must be 120 characters or fewer.' });
  }
  if (!VENDOR_CATEGORIES.includes(vendor.category as (typeof VENDOR_CATEGORIES)[number])) {
    errors.push({ field: 'category', message: 'Choose a valid vendor category.' });
  }
  if (!VENDOR_STATUSES.includes(vendor.status)) {
    errors.push({ field: 'status', message: 'Choose a valid vendor status.' });
  }
  if (contactName.length > 80) {
    errors.push({ field: 'contactName', message: 'Contact name must be 80 characters or fewer.' });
  }
  if (!Number.isFinite(vendor.estimatedCost) || vendor.estimatedCost < 0) {
    errors.push({ field: 'estimatedCost', message: 'Estimated cost must be zero or more.' });
  } else if (vendor.estimatedCost > 100_000_000) {
    errors.push({ field: 'estimatedCost', message: 'Estimated cost exceeds the allowed maximum.' });
  }
  if (
    vendor.quotedCost !== undefined &&
    (!Number.isFinite(vendor.quotedCost) || vendor.quotedCost < 0)
  ) {
    errors.push({ field: 'quotedCost', message: 'Quoted cost must be zero or more.' });
  } else if (vendor.quotedCost !== undefined && vendor.quotedCost > 100_000_000) {
    errors.push({ field: 'quotedCost', message: 'Quoted cost exceeds the allowed maximum.' });
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    errors.push({ field: 'contactEmail', message: 'Enter a valid email address or leave it blank.' });
  }
  if (contactEmail.length > 150) {
    errors.push({ field: 'contactEmail', message: 'Email must be 150 characters or fewer.' });
  }
  if (contactPhone.length > 30) {
    errors.push({ field: 'contactPhone', message: 'Phone must be 30 characters or fewer.' });
  }
  if (cancellationTerms.length > 300) {
    errors.push({ field: 'cancellationTerms', message: 'Cancellation terms must be 300 characters or fewer.' });
  }
  if (accessibilityInfo.length > 300) {
    errors.push({ field: 'accessibilityInfo', message: 'Accessibility info must be 300 characters or fewer.' });
  }
  if (notes.length > 500) {
    errors.push({ field: 'notes', message: 'Notes must be 500 characters or fewer.' });
  }
  if (reviewNotes.length > 500) {
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

/**
 * Edit an existing vendor. Immutable identity fields are ignored even if a
 * caller supplies them, and an invalid patch leaves the record unchanged.
 */
export function editVendor(vendors: Vendor[], vendorId: string, patch: Partial<Vendor>): Vendor[] {
  return vendors.map((vendor) => {
    if (vendor.id !== vendorId) return vendor;
    const merged = { ...vendor, ...patch };
    const candidate = {
      name: merged.name,
      category: merged.category,
      estimatedCost: merged.estimatedCost,
      quotedCost: merged.quotedCost,
      contactName: merged.contactName,
      contactEmail: merged.contactEmail,
      contactPhone: merged.contactPhone,
      status: merged.status,
      notes: merged.notes,
      cancellationTerms: merged.cancellationTerms,
      accessibilityInfo: merged.accessibilityInfo,
      reviewNotes: merged.reviewNotes,
    };

    if (!validateVendor(candidate).valid) return vendor;

    return {
      ...vendor,
      ...candidate,
      name: candidate.name.trim(),
      contactName: candidate.contactName.trim(),
      contactEmail: candidate.contactEmail.trim(),
      contactPhone: candidate.contactPhone.trim(),
      id: vendor.id,
      createdAt: vendor.createdAt,
      isSampleData: vendor.isSampleData,
    };
  });
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

/**
 * Comparison score: lower = better value. Combines quoted cost and booking
 * progress. Deliberately does not invent ratings or endorsements.
 */
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

/** Sort non-cancelled vendors by the transparent comparison score. */
export function sortVendorsForComparison(vendors: Vendor[]): Vendor[] {
  return vendors
    .filter((vendor) => vendor.status !== 'cancelled')
    .slice()
    .sort((a, b) => vendorComparisonScore(a) - vendorComparisonScore(b));
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
      reviewNotes: 'Sample review: clear accessibility documentation provided with the quote.',
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
      reviewNotes: 'Sample review: asked detailed allergy questions before quoting.',
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
      reviewNotes: 'Sample review: portfolio review scheduled, no real rating available.',
      isSampleData: true,
      createdAt: now,
    },
  ];
}
