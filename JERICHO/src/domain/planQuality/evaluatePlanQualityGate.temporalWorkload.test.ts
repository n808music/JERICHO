import { describe, it, expect } from 'vitest';
import { evaluatePlanQualityGate } from './evaluatePlanQualityGate';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GOAL = 'Build and launch SaaS product to $10k MRR over 3 years';
const VERIFY = 'Monthly recurring revenue of $10,000 confirmed by Stripe dashboard';

const TEMPORAL_3Y = {
  contractStartDayKey: '2026-01-01',
  contractEndDayKey: '2028-12-31',
};

const TEMPORAL_SHORT = {
  contractStartDayKey: '2026-01-01',
  contractEndDayKey: '2026-06-30', // < 365 days
};

const EXEMPT_TYPES = new Set(['review', 'audit', 'terminal-review', 'terminal-readiness', 'gate', 'checkpoint']);

function makeExecBlock(phaseLabel: string, dayKey: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `exec-${phaseLabel}-${dayKey}`,
    title: `Build feature in ${phaseLabel}`,
    deliverableId: 'deliv-1',
    blockType: 'action',
    owner: 'executor',
    durationMinutes: 60,
    producesArtifact: 'Feature artifact with evidence',
    consumedBy: [`phase:${phaseLabel === 'P1' ? 'P2' : phaseLabel === 'P2' ? 'P3' : 'terminal-review'}`],
    consumedByRef: {
      type: 'phaseObjective',
      id: phaseLabel === 'P1' ? 'P2' : phaseLabel === 'P2' ? 'P3' : 'P3',
    },
    passEvidence: 'Feature tested with passing integration test',
    phaseLabel,
    dayKey,
    start: `${dayKey}T09:00:00.000Z`,
    ...overrides,
  };
}

function makeReviewBlock(phaseLabel: string, dayKey: string) {
  return {
    id: `review-${phaseLabel}-${dayKey}`,
    title: `Review work in ${phaseLabel}`,
    deliverableId: 'deliv-1',
    blockType: 'review',
    owner: 'reviewer',
    phaseLabel,
    dayKey,
    start: `${dayKey}T09:00:00.000Z`,
  };
}

// Generate evenly-spaced day keys within a range
function dayKeys(start: string, count: number, stepDays = 14): string[] {
  const result: string[] = [];
  let current = new Date(start + 'T12:00:00Z');
  for (let i = 0; i < count; i++) {
    result.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + stepDays * 86400000);
  }
  return result;
}

function runGate(blocks: Record<string, unknown>[], temporal = TEMPORAL_3Y) {
  return evaluatePlanQualityGate({
    goalText: GOAL,
    verificationText: VERIFY,
    proposedBlocks: blocks as any,
    committedBlocks: [],
    temporalContext: temporal,
  });
}

// ---------------------------------------------------------------------------
// PHASE_WITHOUT_EXECUTION_WORK
// ---------------------------------------------------------------------------

describe('Temporal workload: PHASE_WITHOUT_EXECUTION_WORK', () => {
  it('fails when P3 exists but has only review blocks', () => {
    const blocks = [
      ...dayKeys('2026-01-15', 5).map((d) => makeExecBlock('P1', d)),
      ...dayKeys('2026-09-01', 5).map((d) => makeExecBlock('P2', d)),
      ...dayKeys('2027-05-01', 3).map((d) => makeReviewBlock('P3', d)),
    ];
    const result = runGate(blocks);
    expect(result.failureCodes).toContain('PHASE_WITHOUT_EXECUTION_WORK');
    expect(result.meta?.phasesWithoutExecution).toContain('P3');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails when P1 exists but has only review blocks (review-class)', () => {
    const blocks = [
      ...dayKeys('2026-01-15', 4).map((d) => makeReviewBlock('P1', d)),
      ...dayKeys('2026-09-01', 5).map((d) => makeExecBlock('P2', d)),
      ...dayKeys('2027-05-01', 5).map((d) => makeExecBlock('P3', d)),
    ];
    const result = runGate(blocks);
    expect(result.failureCodes).toContain('PHASE_WITHOUT_EXECUTION_WORK');
    expect(result.meta?.phasesWithoutExecution).toContain('P1');
  });

  it('does not fire when all phases have execution blocks', () => {
    const blocks = [
      ...dayKeys('2026-01-15', 4).map((d) => makeExecBlock('P1', d)),
      ...dayKeys('2026-09-01', 4).map((d) => makeExecBlock('P2', d)),
      ...dayKeys('2027-05-01', 4).map((d) => makeExecBlock('P3', d)),
    ];
    const result = runGate(blocks);
    expect(result.failureCodes).not.toContain('PHASE_WITHOUT_EXECUTION_WORK');
  });

  it('does not fire for goal-level blocks without blockType', () => {
    // Goal-level blocks don't have blockType — phase check is skipped entirely
    const blocks = dayKeys('2026-01-15', 8).map((d) => ({
      id: `goal-${d}`,
      title: 'Build feature',
      deliverableId: 'deliv-1',
      kind: 'CORE',
      durationMinutes: 60,
      dayKey: d,
    }));
    const result = runGate(blocks);
    expect(result.failureCodes).not.toContain('PHASE_WITHOUT_EXECUTION_WORK');
  });
});

// ---------------------------------------------------------------------------
// FRONT_LOADED_EXECUTION
// ---------------------------------------------------------------------------

describe('Temporal workload: FRONT_LOADED_EXECUTION', () => {
  it('fails when P3 has <15% of total execution blocks and total >= 10', () => {
    // 5 P1 exec + 5 P2 exec + 0 P3 exec = P3 is 0% of 10 total
    const blocks = [
      ...dayKeys('2026-01-15', 5).map((d) => makeExecBlock('P1', d)),
      ...dayKeys('2026-09-01', 5).map((d) => makeExecBlock('P2', d)),
      // P3 gets only 1 execution block out of 11 total = 9% < 15%
      makeExecBlock('P3', '2027-05-01'),
      ...dayKeys('2027-05-15', 4).map((d) => makeReviewBlock('P3', d)),
    ];
    const result = runGate(blocks);
    expect(result.failureCodes).toContain('FRONT_LOADED_EXECUTION');
  });

  it('does not fire when P3 has enough execution blocks (>= 15%)', () => {
    // 5 P1 + 5 P2 + 4 P3 = 14 total, P3 = 29% > 15%
    const blocks = [
      ...dayKeys('2026-01-15', 5).map((d) => makeExecBlock('P1', d)),
      ...dayKeys('2026-09-01', 5).map((d) => makeExecBlock('P2', d)),
      ...dayKeys('2027-05-01', 4).map((d) => makeExecBlock('P3', d)),
    ];
    const result = runGate(blocks);
    expect(result.failureCodes).not.toContain('FRONT_LOADED_EXECUTION');
  });

  it('does not fire when total exec blocks < 10 (not enough data)', () => {
    const blocks = [
      ...dayKeys('2026-01-15', 4).map((d) => makeExecBlock('P1', d)),
      ...dayKeys('2026-09-01', 4).map((d) => makeExecBlock('P2', d)),
      makeExecBlock('P3', '2027-05-01'),
    ];
    // total = 9, below minimum of 10 — don't fire
    const result = runGate(blocks);
    expect(result.failureCodes).not.toContain('FRONT_LOADED_EXECUTION');
  });
});

// ---------------------------------------------------------------------------
// LONG_HORIZON_WORK_GAPS (extended to non-commercial via phase check)
// ---------------------------------------------------------------------------

describe('Temporal workload: LONG_HORIZON_WORK_GAPS (phase-level 60-day threshold)', () => {
  it('fails when execution blocks have a gap > 60 days within the same phase', () => {
    const blocks = [
      makeExecBlock('P1', '2026-01-15'),
      makeExecBlock('P1', '2026-04-01'), // 75 day gap from Jan 15 > 60 days
    ];
    const result = runGate(blocks);
    expect(result.failureCodes).toContain('LONG_HORIZON_WORK_GAPS');
  });

  it('does not fail when execution gap is exactly 60 days or less', () => {
    const blocks = [
      makeExecBlock('P1', '2026-01-15'),
      makeExecBlock('P1', '2026-03-16'), // exactly 60 days
      ...dayKeys('2026-09-01', 3).map((d) => makeExecBlock('P2', d)),
      ...dayKeys('2027-05-01', 3).map((d) => makeExecBlock('P3', d)),
    ];
    const result = runGate(blocks);
    expect(result.failureCodes).not.toContain('LONG_HORIZON_WORK_GAPS');
  });
});

// ---------------------------------------------------------------------------
// SPARSE_HORIZON_COVERAGE
// ---------------------------------------------------------------------------

describe('Temporal workload: SPARSE_HORIZON_COVERAGE', () => {
  it('fails when execution blocks are too sparse for the horizon length', () => {
    // 3-year plan: needs >= floor(36/2) = 18 execution blocks minimum
    // Only 3 execution blocks across 3 phases
    const blocks = [
      makeExecBlock('P1', '2026-02-01'),
      makeExecBlock('P2', '2026-10-01'),
      makeExecBlock('P3', '2027-06-01'),
    ];
    const result = runGate(blocks);
    expect(result.failureCodes).toContain('SPARSE_HORIZON_COVERAGE');
  });

  it('does not fail when execution density is adequate', () => {
    // 3-year plan: 30 exec blocks across 3 phases — well above threshold of 18
    const blocks = [
      ...dayKeys('2026-01-15', 10, 21).map((d) => makeExecBlock('P1', d)),
      ...dayKeys('2026-09-01', 10, 21).map((d) => makeExecBlock('P2', d)),
      ...dayKeys('2027-05-01', 10, 21).map((d) => makeExecBlock('P3', d)),
    ];
    const result = runGate(blocks);
    expect(result.failureCodes).not.toContain('SPARSE_HORIZON_COVERAGE');
  });
});

// ---------------------------------------------------------------------------
// Short-horizon guard
// ---------------------------------------------------------------------------

describe('Temporal workload: short-horizon plans are not penalized', () => {
  it('does not fire PHASE_WITHOUT_EXECUTION_WORK for plans shorter than 365 days', () => {
    const blocks = [
      ...dayKeys('2026-01-15', 4).map((d) => makeReviewBlock('P3', d)),
    ];
    const result = runGate(blocks, TEMPORAL_SHORT);
    expect(result.failureCodes).not.toContain('PHASE_WITHOUT_EXECUTION_WORK');
    expect(result.failureCodes).not.toContain('FRONT_LOADED_EXECUTION');
    expect(result.failureCodes).not.toContain('SPARSE_HORIZON_COVERAGE');
  });
});

// ---------------------------------------------------------------------------
// Reasonable multi-phase distribution passes
// ---------------------------------------------------------------------------

describe('Temporal workload: balanced plan passes all phase checks', () => {
  it('does not fire any phase workload codes for a well-distributed plan', () => {
    const TEMPORAL_CODES = [
      'PHASE_WITHOUT_EXECUTION_WORK',
      'FRONT_LOADED_EXECUTION',
      'SPARSE_HORIZON_COVERAGE',
    ];
    // 10 per phase, bi-weekly cadence within each phase
    const blocks = [
      ...dayKeys('2026-01-15', 10, 21).map((d) => makeExecBlock('P1', d)),
      ...dayKeys('2026-09-01', 10, 21).map((d) => makeExecBlock('P2', d)),
      ...dayKeys('2027-05-01', 10, 21).map((d) => makeExecBlock('P3', d)),
    ];
    const result = runGate(blocks);
    const found = result.failureCodes.filter((c) => TEMPORAL_CODES.includes(c));
    expect(found).toEqual([]);
  });
});
