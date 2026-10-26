// ============================================================
// EventWise AI — Event Validation Engine
// Pure functions; no side effects; fully testable.
// ============================================================

import { EventDetails, ValidationResult, ValidationError } from '../types';
import { differenceInDays, parseISO, isValid } from 'date-fns';

const TODAY_FN: () => Date = () => new Date();

/** Validate every field of the event creation / edit form. */
export function validateEventDetails(
  data: Partial<EventDetails>,
  today: Date = TODAY_FN()
): ValidationResult {
  const errors: ValidationError[] = [];

  // Name
  if (!data.name || data.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Event name must be at least 2 characters.' });
  }
  if (data.name && data.name.length > 120) {
    errors.push({ field: 'name', message: 'Event name must be 120 characters or fewer.' });
  }

  // Type
  const validTypes = ['wedding', 'birthday', 'community'];
  if (!data.type || !validTypes.includes(data.type)) {
    errors.push({ field: 'type', message: 'Please select a valid event type.' });
  }

  // Date
  if (!data.date) {
    errors.push({ field: 'date', message: 'Event date is required.' });
  } else {
    const parsed = parseISO(data.date);
    if (!isValid(parsed)) {
      errors.push({ field: 'date', message: 'Please enter a valid date (YYYY-MM-DD).' });
    } else {
      const daysAway = differenceInDays(parsed, today);
      if (daysAway < 0) {
        errors.push({ field: 'date', message: 'Event date cannot be in the past.' });
      }
      if (daysAway < 7) {
        // Not a validation error — we warn instead (handled by caller via warnings)
        // but we allow it; very short notice is valid input
      }
    }
  }

  // Guest count
  if (data.guestCount === undefined || data.guestCount === null) {
    errors.push({ field: 'guestCount', message: 'Guest count is required.' });
  } else if (!Number.isInteger(data.guestCount) || data.guestCount < 1) {
    errors.push({ field: 'guestCount', message: 'Guest count must be a whole number of at least 1.' });
  } else if (data.guestCount > 50000) {
    errors.push({ field: 'guestCount', message: 'Guest count seems unrealistically large (max 50,000).' });
  }

  // Budget
  if (data.budget === undefined || data.budget === null) {
    errors.push({ field: 'budget', message: 'Total budget is required.' });
  } else if (typeof data.budget !== 'number' || isNaN(data.budget) || data.budget < 0) {
    errors.push({ field: 'budget', message: 'Budget must be a non-negative number.' });
  } else if (data.budget > 100_000_000) {
    errors.push({ field: 'budget', message: 'Budget exceeds maximum allowed value.' });
  }

  // Currency
  const validCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'];
  if (!data.currency || !validCurrencies.includes(data.currency)) {
    errors.push({ field: 'currency', message: 'Please select a valid currency.' });
  }

  // Venue preference
  const validPrefs = ['indoor', 'outdoor', 'flexible'];
  if (!data.preference || !validPrefs.includes(data.preference)) {
    errors.push({ field: 'preference', message: 'Please select indoor, outdoor, or flexible.' });
  }

  // Theme — optional but bounded
  if (data.theme && data.theme.length > 200) {
    errors.push({ field: 'theme', message: 'Theme description must be 200 characters or fewer.' });
  }

  // Dietary requirements — optional but bounded
  if (data.dietaryRequirements && data.dietaryRequirements.length > 500) {
    errors.push({ field: 'dietaryRequirements', message: 'Dietary requirements must be 500 characters or fewer.' });
  }

  return { valid: errors.length === 0, errors };
}

/** Return days until event, or null if date is invalid. */
export function daysUntilEvent(dateStr: string, today: Date = TODAY_FN()): number | null {
  const parsed = parseISO(dateStr);
  if (!isValid(parsed)) return null;
  return differenceInDays(parsed, today);
}

/** True if the event is within the given number of days. */
export function isShortNotice(dateStr: string, thresholdDays = 30, today: Date = TODAY_FN()): boolean {
  const days = daysUntilEvent(dateStr, today);
  return days !== null && days >= 0 && days < thresholdDays;
}

/** Sanitize a free-text string: trim and strip dangerous patterns. */
export function sanitizeText(raw: string): string {
  // Remove HTML tags to prevent injection into text nodes
  return raw.trim().replace(/<[^>]*>/g, '');
}
