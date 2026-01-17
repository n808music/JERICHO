/**
 * deadline.ts
 *
 * Canonical deadline parsing and validation.
 * Source of truth: deadline.dayKey in GoalExecutionContract (YYYY-MM-DD format).
 *
 * Handles conversion from various formats and ensures consistency across
 * pre-admission drafts and admitted contracts.
 */

import { dayKeyFromISO } from '../state/time/time';

/**
 * Extracts the canonical deadline day key from a goal contract
 *
 * Priority:
 * 1. deadline.dayKey (preferred, already normalized)
 * 2. deadlineISO (legacy, converts to dayKey)
 * 3. deadlineDayKey (fallback)
 * 4. definiteGoal.deadlineDayKey (fallback)
 *
 * @returns dayKey in YYYY-MM-DD format, or null if missing/invalid
 */
export function getDeadlineDayKey(goalContract: any, timeZone = 'UTC'): string | null {
  if (!goalContract) return null;

  // 1. Preferred: deadline.dayKey (already in correct format)
  if (goalContract.deadline?.dayKey && isValidDayKey(goalContract.deadline.dayKey)) {
    return goalContract.deadline.dayKey;
  }

  // 2. Legacy: deadlineISO (convert using timezone-safe helper)
  if (goalContract.deadlineISO && typeof goalContract.deadlineISO === 'string') {
    try {
      const dayKey = dayKeyFromISO(goalContract.deadlineISO, timeZone);
      if (isValidDayKey(dayKey)) {
        return dayKey;
      }
    } catch (err) {
      // Fall through to next option
    }
  }

  // 3. Fallback: deadlineDayKey (sometimes stored directly)
  if (goalContract.deadlineDayKey && isValidDayKey(goalContract.deadlineDayKey)) {
    return goalContract.deadlineDayKey;
  }

  // 4. Last resort: definiteGoal.deadlineDayKey
  if (goalContract.definiteGoal?.deadlineDayKey && isValidDayKey(goalContract.definiteGoal.deadlineDayKey)) {
    return goalContract.definiteGoal.deadlineDayKey;
  }

  // Not found or invalid
  return null;
}

/**
 * Validates that a string is in YYYY-MM-DD format
 */
export function isValidDayKey(dayKey: any): boolean {
  if (typeof dayKey !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dayKey);
}

/**
 * Converts a deadline to dayKey, normalizing from various sources
 *
 * Useful for ensuring consistency when storing/admitting contracts
 */
export function normalizeDayKey(dayKeyOrISO: string | null | undefined, timeZone = 'UTC'): string | null {
  if (!dayKeyOrISO) return null;

  // Already in dayKey format
  if (isValidDayKey(dayKeyOrISO)) {
    return dayKeyOrISO;
  }

  // Try to parse as ISO
  if (typeof dayKeyOrISO === 'string' && dayKeyOrISO.includes('T')) {
    try {
      return dayKeyFromISO(dayKeyOrISO, timeZone);
    } catch (err) {
      return null;
    }
  }

  return null;
}

/**
 * Diagnostic info for deadline parsing issues
 */
export interface DeadlineDiagnostic {
  raw: any;
  dayKey: string | null;
  source: 'deadline.dayKey' | 'deadlineISO' | 'deadlineDayKey' | 'definiteGoal.deadlineDayKey' | 'unknown' | 'invalid';
  isValid: boolean;
  error?: string;
}

/**
 * Debug helper: show why a deadline is/isn't parsing
 */
export function debugDeadline(goalContract: any, timeZone = 'UTC'): DeadlineDiagnostic {
  if (!goalContract) {
    return {
      raw: null,
      dayKey: null,
      source: 'unknown',
      isValid: false,
      error: 'No goal contract provided'
    };
  }

  // Check each potential source
  if (goalContract.deadline?.dayKey && isValidDayKey(goalContract.deadline.dayKey)) {
    return {
      raw: goalContract.deadline.dayKey,
      dayKey: goalContract.deadline.dayKey,
      source: 'deadline.dayKey',
      isValid: true
    };
  }

  if (goalContract.deadlineISO && typeof goalContract.deadlineISO === 'string') {
    try {
      const dayKey = dayKeyFromISO(goalContract.deadlineISO, timeZone);
      if (isValidDayKey(dayKey)) {
        return {
          raw: goalContract.deadlineISO,
          dayKey,
          source: 'deadlineISO',
          isValid: true
        };
      }
    } catch (err) {
      // Continue to next source
    }
  }

  if (goalContract.deadlineDayKey && isValidDayKey(goalContract.deadlineDayKey)) {
    return {
      raw: goalContract.deadlineDayKey,
      dayKey: goalContract.deadlineDayKey,
      source: 'deadlineDayKey',
      isValid: true
    };
  }

  if (goalContract.definiteGoal?.deadlineDayKey && isValidDayKey(goalContract.definiteGoal.deadlineDayKey)) {
    return {
      raw: goalContract.definiteGoal.deadlineDayKey,
      dayKey: goalContract.definiteGoal.deadlineDayKey,
      source: 'definiteGoal.deadlineDayKey',
      isValid: true
    };
  }

  // All sources exhausted
  return {
    raw: goalContract.deadline || goalContract.deadlineISO || goalContract.deadlineDayKey,
    dayKey: null,
    source: 'invalid',
    isValid: false,
    error: 'Could not extract valid deadline from contract'
  };
}
