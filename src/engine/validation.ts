// ============================================================
// EventWise AI — Event Validation Engine
// Pure functions; no side effects; fully testable.
// ============================================================

import { EventDetails, ValidationResult, ValidationError } from '../types';
import { differenceInDays, parseISO, isValid, format, startOfDay } from 'date-fns';

const TODAY_FN: () => Date = () => new Date();

const VALID_TYPES = ['wedding', 'birthday', 'community'];
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'];
const VALID_PREFERENCES = ['indoor', 'outdoor', 'flexible'];

/** Strictly validate a YYYY-MM-DD calendar date, rejecting normalised dates. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return false;
  return format(parsed, 'yyyy-MM-dd') === value;
}

/** Validate every field of the event creation / edit form. */
export function validateEventDetails(
  data: Partial<EventDetails>,
  today: Date = TODAY_FN()
): ValidationResult {
  const errors: ValidationError[] = [];

  // Name
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (name.length < 2) {
    errors.push({ field: 'name', message: 'Event name must be at least 2 characters.' });
  }
  if (name.length > 120) {
    errors.push({ field: 'name', message: 'Event name must be 120 characters or fewer.' });
  }

  // Type
  if (!data.type || !VALID_TYPES.includes(data.type)) {
    errors.push({ field: 'type', message: 'Please select a valid event type.' });
  }

  // Date
  if (!data.date) {
    errors.push({ field: 'date', message: 'Event date is required.' });
  } else if (!isValidIsoDate(data.date)) {
    errors.push({ field: 'date', message: 'Please enter a valid date (YYYY-MM-DD).' });
  } else {
    const daysAway = differenceInDays(startOfDay(parseISO(data.date)), startOfDay(today));
    if (daysAway < 0) {
      errors.push({ field: 'date', message: 'Event date cannot be in the past.' });
    }
  }

  // Guest count
  if (data.guestCount === undefined || data.guestCount === null) {
    errors.push({ field: 'guestCount', message: 'Guest count is required.' });
  } else if (
    !Number.isFinite(data.guestCount) ||
    !Number.isInteger(data.guestCount) ||
    data.guestCount < 1
  ) {
    errors.push({ field: 'guestCount', message: 'Guest count must be a whole number of at least 1.' });
  } else if (data.guestCount > 50000) {
    errors.push({ field: 'guestCount', message: 'Guest count seems unrealistically large (max 50,000).' });
  }

  // Budget
  if (data.budget === undefined || data.budget === null) {
    errors.push({ field: 'budget', message: 'Total budget is required.' });
  } else if (typeof data.budget !== 'number' || !Number.isFinite(data.budget) || data.budget < 0) {
    errors.push({ field: 'budget', message: 'Budget must be a non-negative number.' });
  } else if (data.budget > 100_000_000) {
    errors.push({ field: 'budget', message: 'Budget exceeds maximum allowed value.' });
  }

  // Currency
  if (!data.currency || !VALID_CURRENCIES.includes(data.currency)) {
    errors.push({ field: 'currency', message: 'Please select a valid currency.' });
  }

  // Venue preference
  if (!data.preference || !VALID_PREFERENCES.includes(data.preference)) {
    errors.push({ field: 'preference', message: 'Please select indoor, outdoor, or flexible.' });
  }

  // Optional text fields — bounded to keep local storage and exports small.
  if (data.city && data.city.length > 100) {
    errors.push({ field: 'city', message: 'City or venue must be 100 characters or fewer.' });
  }
  if (data.theme && data.theme.length > 200) {
    errors.push({ field: 'theme', message: 'Theme description must be 200 characters or fewer.' });
  }
  if (data.dietaryRequirements && data.dietaryRequirements.length > 500) {
    errors.push({
      field: 'dietaryRequirements',
      message: 'Dietary requirements must be 500 characters or fewer.',
    });
  }
  if (data.accessibilityNeeds && data.accessibilityNeeds.length > 500) {
    errors.push({
      field: 'accessibilityNeeds',
      message: 'Accessibility needs must be 500 characters or fewer.',
    });
  }
  if (data.notes && data.notes.length > 1000) {
    errors.push({ field: 'notes', message: 'Notes must be 1,000 characters or fewer.' });
  }

  if (data.priorities !== undefined) {
    if (!Array.isArray(data.priorities) || data.priorities.length > 20) {
      errors.push({ field: 'priorities', message: 'Choose up to 20 planning priorities.' });
    } else if (data.priorities.some((priority) => typeof priority !== 'string' || priority.length > 80)) {
      errors.push({ field: 'priorities', message: 'One or more priorities are invalid.' });
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Return days until event, or null if date is invalid. */
export function daysUntilEvent(dateStr: string, today: Date = TODAY_FN()): number | null {
  if (!isValidIsoDate(dateStr)) return null;
  return differenceInDays(startOfDay(parseISO(dateStr)), startOfDay(today));
}

/** True if the event is within the given number of days. */
export function isShortNotice(dateStr: string, thresholdDays = 30, today: Date = TODAY_FN()): boolean {
  const days = daysUntilEvent(dateStr, today);
  return days !== null && days >= 0 && days < thresholdDays;
}

/**
 * Sanitize free text. React already escapes rendered strings; this removes
 * HTML tags and control characters before data is persisted or exported, so
 * even non-React consumers cannot receive markup from these fields.
 */
export function sanitizeText(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

/** Validate a positive money input and return null when invalid. */
export function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '-') return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}
