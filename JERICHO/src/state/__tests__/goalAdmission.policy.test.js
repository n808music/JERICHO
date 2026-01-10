import { describe, it, expect } from 'vitest';
import { admitGoal } from '../goalAdmission.ts';

const NOW_ISO = '2026-01-01T12:00:00.000Z';

const baseDraft = {
  label: 'Test goal',
  family: 'SKILL',
  mechanismClass: 'THROUGHPUT',
  objective: 'PRACTICE_HOURS_TOTAL',
  objectiveValue: 20,
  deadlineDayKey: '2026-02-01',
  deadlineType: 'HARD',
  workingFullTime: true,
  workDaysPerWeek: 5,
  workStartWindow: 'MID',
  workEndWindow: 'MID',
  minSleepHours: 8,
  sleepFixedWindow: false,
  sleepStartWindow: 'LATE',
  sleepEndWindow: 'EARLY',
  hasWeeklyRestDay: true,
  restDay: 0,
  blackoutBlocks: [],
  hasGymAccess: true,
  canCookMostDays: true,
  hasTransportLimitation: false,
  currentlyInjured: false,
  beginnerLevel: false,
  maxDailyWorkMinutes: 120,
  noEveningWork: false,
  noMorningWork: false,
  weekendsAllowed: true,
  travelThisPeriod: 'NONE',
  acceptsDailyMinimum: true,
  acceptsFixedSchedule: true,
  acceptsNoRenegotiation7d: true,
  acceptsAutomaticCatchUp: true
};

const ctx = {
  nowISO: NOW_ISO,
  timeZone: 'UTC',
  cycleId: 'cycle-1',
  constraints: {
    maxBlocksPerDay: 4,
    maxBlocksPerWeek: 16
  }
};

const admit = (draft) => admitGoal(draft, ctx);

describe('goal admission policy', () => {
  it('rejects missing goal family', () => {
    const res = admit({ ...baseDraft, family: undefined });
    expect(res.status).toBe('REJECTED_NO_MECHANISM');
    expect(res.reasonCodes).toContain('MISSING_GOAL_FAMILY');
  });

  it('rejects missing numeric target', () => {
    const res = admit({ ...baseDraft, objectiveValue: 0 });
    expect(res.status).toBe('REJECTED_NO_MECHANISM');
    expect(res.reasonCodes).toContain('MISSING_NUMERIC_TARGET');
  });

  it('rejects missing deadline', () => {
    const res = admit({ ...baseDraft, deadlineDayKey: '' });
    expect(res.status).toBe('REJECTED_NO_MECHANISM');
    expect(res.reasonCodes).toContain('MISSING_DEADLINE');
  });

  it('rejects missing mechanism class', () => {
    const res = admit({ ...baseDraft, mechanismClass: '' });
    expect(res.status).toBe('REJECTED_NO_MECHANISM');
    expect(res.reasonCodes).toContain('MISSING_MECHANISM_CLASS');
  });

  it('rejects missing constraints', () => {
    const res = admit({ ...baseDraft, maxDailyWorkMinutes: undefined, workDaysPerWeek: undefined, weekendsAllowed: undefined });
    expect(res.status).toBe('REJECTED_MISSING_CONSTRAINTS');
    expect(res.reasonCodes).toContain('MISSING_CONSTRAINTS');
  });

  it('rejects deadline in the past', () => {
    const res = admit({ ...baseDraft, deadlineDayKey: '2025-12-01' });
    expect(res.status).toBe('REJECTED_INFEASIBLE');
    expect(res.reasonCodes).toContain('DEADLINE_PASSED');
  });

  it('rejects infeasible pace', () => {
    const res = admit({
      ...baseDraft,
      objectiveValue: 300,
      deadlineDayKey: '2026-01-03',
      maxDailyWorkMinutes: 30,
      workDaysPerWeek: 3
    });
    expect(res.status).toBe('REJECTED_INFEASIBLE');
    expect(res.reasonCodes).toContain('REQUIRED_PACE_EXCEEDS_MAX_PER_DAY');
  });

  it('admits a feasible goal and returns planProof + schedulability', () => {
    const res = admit({ ...baseDraft });
    expect(res.status).toBe('ADMITTED');
    expect(res.planProof).toBeTruthy();
    expect(res.schedulability).toBeTruthy();
  });
});
