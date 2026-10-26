// ============================================================
// EventWise AI — Vendor Management Engine
// Pure functions for CRUD and vendor comparison.
// ============================================================

import { Vendor, VendorStatus } from '../types';
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

/** Create a new blank vendor record. */
export function createVendor(
  partial: Omit<Vendor, 'id' | 'createdAt' | 'isSampleData'>
): Vendor {
  return {
    ...partial,
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
