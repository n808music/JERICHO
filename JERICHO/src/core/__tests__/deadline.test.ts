/**
 * deadline.test.ts
 *
 * Tests for canonical deadline extraction and validation
 */

import { describe, it, expect } from 'vitest';
import { getDeadlineDayKey, isValidDayKey, normalizeDayKey, debugDeadline } from '../deadline';

describe('deadline utilities', () => {
  describe('isValidDayKey', () => {
    it('accepts YYYY-MM-DD format', () => {
      expect(isValidDayKey('2026-01-12')).toBe(true);
      expect(isValidDayKey('2025-12-31')).toBe(true);
      expect(isValidDayKey('2024-02-29')).toBe(true); // Leap year
    });

    it('rejects invalid formats', () => {
      expect(isValidDayKey('2026-1-12')).toBe(false);
      expect(isValidDayKey('01-12-2026')).toBe(false);
      expect(isValidDayKey('2026/01/12')).toBe(false);
      expect(isValidDayKey('')).toBe(false);
      expect(isValidDayKey(null)).toBe(false);
      expect(isValidDayKey(undefined)).toBe(false);
      expect(isValidDayKey(12345)).toBe(false);
    });
  });

  describe('getDeadlineDayKey', () => {
    it('extracts from deadline.dayKey (preferred source)', () => {
      const contract = {
        deadline: { dayKey: '2026-04-08', isHardDeadline: true }
      };
      expect(getDeadlineDayKey(contract)).toBe('2026-04-08');
    });

    it('converts from deadlineISO (legacy)', () => {
      const contract = {
        deadlineISO: '2026-04-08T00:00:00Z'
      };
      expect(getDeadlineDayKey(contract, 'UTC')).toBe('2026-04-08');
    });

    it('uses deadlineDayKey fallback', () => {
      const contract = {
        deadlineDayKey: '2026-04-08'
      };
      expect(getDeadlineDayKey(contract)).toBe('2026-04-08');
    });

    it('uses definiteGoal.deadlineDayKey as last resort', () => {
      const contract = {
        definiteGoal: { deadlineDayKey: '2026-04-08' }
      };
      expect(getDeadlineDayKey(contract)).toBe('2026-04-08');
    });

    it('prefers deadline.dayKey over other sources', () => {
      const contract = {
        deadline: { dayKey: '2026-04-08', isHardDeadline: true },
        deadlineISO: '2025-01-01T00:00:00Z',
        deadlineDayKey: '2024-01-01',
        definiteGoal: { deadlineDayKey: '2023-01-01' }
      };
      expect(getDeadlineDayKey(contract)).toBe('2026-04-08');
    });

    it('returns null for missing deadline', () => {
      const contract = {};
      expect(getDeadlineDayKey(contract)).toBeNull();
    });

    it('returns null for invalid deadline', () => {
      const contract = {
        deadline: { dayKey: 'invalid-date', isHardDeadline: true }
      };
      expect(getDeadlineDayKey(contract)).toBeNull();
    });

    it('returns null for null contract', () => {
      expect(getDeadlineDayKey(null)).toBeNull();
      expect(getDeadlineDayKey(undefined)).toBeNull();
    });

    it('handles malformed ISO gracefully', () => {
      const contract = {
        deadlineISO: 'not-a-valid-iso'
      };
      expect(getDeadlineDayKey(contract)).toBeNull();
    });
  });

  describe('normalizeDayKey', () => {
    it('returns dayKey unchanged if already valid', () => {
      expect(normalizeDayKey('2026-04-08')).toBe('2026-04-08');
    });

    it('converts ISO to dayKey', () => {
      expect(normalizeDayKey('2026-04-08T00:00:00Z', 'UTC')).toBe('2026-04-08');
    });

    it('returns null for invalid input', () => {
      expect(normalizeDayKey(null)).toBeNull();
      expect(normalizeDayKey(undefined)).toBeNull();
      expect(normalizeDayKey('')).toBeNull();
      expect(normalizeDayKey('invalid')).toBeNull();
    });

    it('handles timezone-aware ISO conversion', () => {
      // ISO is always in UTC, dayKey is relative to specified timezone
      const iso = '2026-04-08T00:00:00Z';
      const result = normalizeDayKey(iso, 'UTC');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('debugDeadline', () => {
    it('identifies deadline.dayKey source', () => {
      const contract = {
        deadline: { dayKey: '2026-04-08', isHardDeadline: true }
      };
      const debug = debugDeadline(contract);
      expect(debug.source).toBe('deadline.dayKey');
      expect(debug.dayKey).toBe('2026-04-08');
      expect(debug.isValid).toBe(true);
    });

    it('identifies deadlineISO source', () => {
      const contract = {
        deadlineISO: '2026-04-08T12:00:00Z'
      };
      const debug = debugDeadline(contract);
      expect(debug.source).toBe('deadlineISO');
      expect(debug.isValid).toBe(true);
    });

    it('marks invalid deadline as invalid', () => {
      const contract = {
        deadline: { dayKey: 'not-a-date', isHardDeadline: true }
      };
      const debug = debugDeadline(contract);
      expect(debug.isValid).toBe(false);
      expect(debug.source).toBe('invalid');
      expect(debug.error).toBeTruthy();
    });

    it('handles missing deadline', () => {
      const contract = {};
      const debug = debugDeadline(contract);
      expect(debug.isValid).toBe(false);
      expect(debug.dayKey).toBeNull();
    });
  });

  // Integration scenarios
  describe('real-world scenarios', () => {
    it('admitted contract with deadline.dayKey parses correctly', () => {
      const admittedContract = {
        goalId: 'goal_123',
        deadline: {
          dayKey: '2026-04-08',
          isHardDeadline: true
        },
        admissionStatus: 'ADMITTED',
        admittedAtISO: '2026-01-12T10:30:00Z'
      };

      expect(getDeadlineDayKey(admittedContract)).toBe('2026-04-08');
    });

    it('legacy draft contract with ISO deadline normalizes correctly', () => {
      const draftContract = {
        goalId: 'goal_456',
        deadlineISO: '2026-04-08T00:00:00Z',
        admissionStatus: 'PENDING'
      };

      const normalized = getDeadlineDayKey(draftContract, 'UTC');
      expect(normalized).toBe('2026-04-08');
    });

    it('contract with multiple deadline fields prefers canonical', () => {
      const mixedContract = {
        goalId: 'goal_789',
        deadline: { dayKey: '2026-04-08', isHardDeadline: true },
        deadlineISO: '2025-01-01T00:00:00Z', // Different!
        deadlineDayKey: '2024-01-01' // Different!
      };

      // Should use deadline.dayKey (preferred)
      expect(getDeadlineDayKey(mixedContract)).toBe('2026-04-08');
    });

    it('handles plan generation scenario with goalContract', () => {
      const cycle = {
        id: 'cycle_1',
        goalContract: {
          goalId: 'goal_123',
          deadline: { dayKey: '2026-04-15', isHardDeadline: true }
        }
      };

      const deadlineKey = getDeadlineDayKey(cycle.goalContract, 'UTC');
      expect(deadlineKey).toBe('2026-04-15');
      expect(/^\d{4}-\d{2}-\d{2}$/.test(deadlineKey || '')).toBe(true);
    });
  });

  // Determinism tests
  describe('determinism', () => {
    it('same contract produces same result on repeated calls', () => {
      const contract = {
        deadline: { dayKey: '2026-04-08', isHardDeadline: true }
      };

      const r1 = getDeadlineDayKey(contract);
      const r2 = getDeadlineDayKey(contract);
      const r3 = getDeadlineDayKey(contract);

      expect(r1).toBe(r2);
      expect(r2).toBe(r3);
      expect(r1).toBe('2026-04-08');
    });

    it('normalizeDayKey is deterministic', () => {
      const iso = '2026-04-08T12:34:56Z';

      const r1 = normalizeDayKey(iso, 'UTC');
      const r2 = normalizeDayKey(iso, 'UTC');
      const r3 = normalizeDayKey(iso, 'UTC');

      expect(r1).toBe(r2);
      expect(r2).toBe(r3);
    });
  });
});
