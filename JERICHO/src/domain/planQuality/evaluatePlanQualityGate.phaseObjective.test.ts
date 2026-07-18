import { describe, it, expect } from 'vitest';
import { evaluatePlanQualityGate } from './evaluatePlanQualityGate';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GOAL = 'Build and document a personal finance tracking system with weekly spending analysis';
const VERIFY = 'System running with 52 weeks of documented weekly analysis reports and accuracy metrics';

const TEMPORAL_SHORT = {
  contractStartDayKey: '2026-01-01',
  contractEndDayKey: '2026-11-30',
};

function makePhase(label: string, overrides: Record<string, unknown> = {}) {
  const objectives: Record<string, string> = {
    P1: 'Build the core tracking substrate, validate data capture, and produce the first weekly analysis report',
    P2: 'Convert validated tracking into repeatable weekly cadence with dashboard visibility and anomaly detection',
    P3: 'Scale the system to full household coverage and produce terminal evidence package for the 3-year review',
  };
  const criteria: Record<string, string[]> = {
    P1: [
      'Core tracking module is validated with 4 consecutive weeks of accurate data.',
      'First weekly analysis report is produced and reviewed.',
    ],
    P2: [
      'Weekly cadence is running with no missed reports for 8 consecutive weeks.',
      'Dashboard is live and anomaly detection has flagged at least one issue.',
    ],
    P3: [
      'Full household coverage achieved and documented with terminal evidence package.',
      'Three-year trend analysis is complete and reviewed against original targets.',
    ],
  };
  return {
    id: `phase-${label.toLowerCase()}`,
    label,
    phaseObjective: objectives[label] ?? objectives['P1'],
    unlockCriteria: criteria[label] ?? criteria['P1'],
    ...overrides,
  };
}

function makeExecBlock(phaseLabel: string, overrides: Record<string, unknown> = {}) {
  const downstream =
    phaseLabel === 'P1'
      ? { consumedBy: ['phase:P2'], consumedByRef: { type: 'phaseObjective', id: 'P2' } }
      : phaseLabel === 'P2'
        ? { consumedBy: ['phase:P3'], consumedByRef: { type: 'phaseObjective', id: 'P3' } }
        : { consumedBy: ['terminal-review:cross-lane'], consumedByRef: { type: 'terminalOutcome', id: 'cross-lane' } };
  return {
    id: `exec-${phaseLabel}-${overrides.idx ?? 1}`,
    title: `Build tracking module for ${phaseLabel} deliverable scope`,
    deliverableId: 'deliv-1',
    blockType: 'action',
    owner: 'executor',
    durationMinutes: 60,
    producesArtifact: `${phaseLabel} tracking module with validated data capture and test coverage`,
    passEvidence: `${phaseLabel} integration test passing with documented output and acceptance criteria met`,
    phaseLabel,
    dayKey: phaseLabel === 'P1' ? '2026-03-01' : phaseLabel === 'P2' ? '2027-03-01' : '2028-03-01',
    ...downstream,
    ...overrides,
  };
}

function makeReviewBlock(phaseLabel: string) {
  return {
    id: `review-${phaseLabel}-1`,
    title: `Review ${phaseLabel} work quality`,
    deliverableId: 'deliv-1',
    blockType: 'review',
    owner: 'reviewer',
    phaseLabel,
    dayKey: phaseLabel === 'P1' ? '2026-04-01' : phaseLabel === 'P2' ? '2027-04-01' : '2028-04-01',
  };
}

function runGate(phases: unknown[], blocks: unknown[] = [], temporal = TEMPORAL_SHORT) {
  return evaluatePlanQualityGate({
    goalText: GOAL,
    verificationText: VERIFY,
    proposedBlocks: blocks as any,
    committedBlocks: [],
    phases: phases as any,
    temporalContext: temporal,
  });
}

// ---------------------------------------------------------------------------
// MISSING_PHASE_OBJECTIVE
// ---------------------------------------------------------------------------

describe('Phase Objective Authenticity: MISSING_PHASE_OBJECTIVE', () => {
  it('fails when phaseObjective is null', () => {
    const result = runGate([makePhase('P1', { phaseObjective: null })], [makeExecBlock('P1')]);
    expect(result.failureCodes).toContain('MISSING_PHASE_OBJECTIVE');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails when phaseObjective is empty string', () => {
    const result = runGate([makePhase('P1', { phaseObjective: '' })], [makeExecBlock('P1')]);
    expect(result.failureCodes).toContain('MISSING_PHASE_OBJECTIVE');
  });

  it('fails when phaseObjective is undefined', () => {
    const result = runGate([makePhase('P1', { phaseObjective: undefined })], [makeExecBlock('P1')]);
    expect(result.failureCodes).toContain('MISSING_PHASE_OBJECTIVE');
  });
});

// ---------------------------------------------------------------------------
// VAGUE_PHASE_OBJECTIVE
// ---------------------------------------------------------------------------

describe('Phase Objective Authenticity: VAGUE_PHASE_OBJECTIVE', () => {
  it('fails when objective is "Scale" (single shell word)', () => {
    const result = runGate([makePhase('P2', { phaseObjective: 'Scale' })], [makeExecBlock('P2')]);
    expect(result.failureCodes).toContain('VAGUE_PHASE_OBJECTIVE');
  });

  it('fails when objective is "Build momentum" (generic 2-token phrase)', () => {
    const result = runGate([makePhase('P1', { phaseObjective: 'Build momentum' })], [makeExecBlock('P1')]);
    expect(result.failureCodes).toContain('VAGUE_PHASE_OBJECTIVE');
  });

  it('fails when objective is "Prepare for growth"', () => {
    const result = runGate([makePhase('P2', { phaseObjective: 'Prepare for growth' })], [makeExecBlock('P2')]);
    expect(result.failureCodes).toContain('VAGUE_PHASE_OBJECTIVE');
  });

  it('fails when objective is "Continue execution"', () => {
    const result = runGate([makePhase('P3', { phaseObjective: 'Continue execution' })], [makeExecBlock('P3')]);
    expect(result.failureCodes).toContain('VAGUE_PHASE_OBJECTIVE');
  });

  it('fails when objective is "Improve operations"', () => {
    const result = runGate([makePhase('P1', { phaseObjective: 'Improve operations' })], [makeExecBlock('P1')]);
    expect(result.failureCodes).toContain('VAGUE_PHASE_OBJECTIVE');
  });

  it('does not fire for a specific multi-token objective', () => {
    const result = runGate(
      [makePhase('P1', {
        phaseObjective: 'Validate product MVP with first-user onboarding evidence and conversion issue log',
      })],
      [makeExecBlock('P1')],
    );
    expect(result.failureCodes).not.toContain('VAGUE_PHASE_OBJECTIVE');
  });
});

// ---------------------------------------------------------------------------
// MISSING_PHASE_UNLOCK_CRITERIA
// ---------------------------------------------------------------------------

describe('Phase Objective Authenticity: MISSING_PHASE_UNLOCK_CRITERIA', () => {
  it('fails when unlockCriteria is null', () => {
    const result = runGate([makePhase('P1', { unlockCriteria: null })], [makeExecBlock('P1')]);
    expect(result.failureCodes).toContain('MISSING_PHASE_UNLOCK_CRITERIA');
  });

  it('fails when unlockCriteria is an empty array', () => {
    const result = runGate([makePhase('P1', { unlockCriteria: [] })], [makeExecBlock('P1')]);
    expect(result.failureCodes).toContain('MISSING_PHASE_UNLOCK_CRITERIA');
  });

  it('fails when unlockCriteria is undefined', () => {
    const result = runGate([makePhase('P1', { unlockCriteria: undefined })], [makeExecBlock('P1')]);
    expect(result.failureCodes).toContain('MISSING_PHASE_UNLOCK_CRITERIA');
  });
});

// ---------------------------------------------------------------------------
// VAGUE_PHASE_UNLOCK_CRITERIA
// ---------------------------------------------------------------------------

describe('Phase Objective Authenticity: VAGUE_PHASE_UNLOCK_CRITERIA', () => {
  it('fails when all criteria are vague single words ("Done", "Ready")', () => {
    const result = runGate([makePhase('P1', { unlockCriteria: ['Done', 'Ready'] })], [makeExecBlock('P1')]);
    expect(result.failureCodes).toContain('VAGUE_PHASE_UNLOCK_CRITERIA');
  });

  it('fails when single criterion is a shell word "Complete"', () => {
    const result = runGate([makePhase('P2', { unlockCriteria: ['Complete'] })], [makeExecBlock('P2')]);
    expect(result.failureCodes).toContain('VAGUE_PHASE_UNLOCK_CRITERIA');
  });

  it('passes when at least one criterion is specific and measurable', () => {
    const result = runGate(
      [makePhase('P1', { unlockCriteria: ['Tracking module validated with 4 consecutive weeks of accurate data and reviewed report.'] })],
      [makeExecBlock('P1')],
    );
    expect(result.failureCodes).not.toContain('VAGUE_PHASE_UNLOCK_CRITERIA');
  });
});

// ---------------------------------------------------------------------------
// PHASE_OBJECTIVE_WITHOUT_SUPPORTING_BLOCKS
// ---------------------------------------------------------------------------

describe('Phase Objective Authenticity: PHASE_OBJECTIVE_WITHOUT_SUPPORTING_BLOCKS', () => {
  it('fails when phase has no blocks at all', () => {
    const result = runGate([makePhase('P1')], []);
    expect(result.failureCodes).toContain('PHASE_OBJECTIVE_WITHOUT_SUPPORTING_BLOCKS');
  });

  it('fails when only review-class blocks exist for the phase', () => {
    const result = runGate([makePhase('P1')], [makeReviewBlock('P1')]);
    expect(result.failureCodes).toContain('PHASE_OBJECTIVE_WITHOUT_SUPPORTING_BLOCKS');
  });

  it('fails when execution blocks exist only for a different phase', () => {
    const result = runGate(
      [makePhase('P1'), makePhase('P2')],
      [makeExecBlock('P2')],
    );
    expect(result.failureCodes).toContain('PHASE_OBJECTIVE_WITHOUT_SUPPORTING_BLOCKS');
  });

  it('passes when at least one execution block has matching phaseLabel', () => {
    const result = runGate([makePhase('P1')], [makeExecBlock('P1')]);
    expect(result.failureCodes).not.toContain('PHASE_OBJECTIVE_WITHOUT_SUPPORTING_BLOCKS');
  });
});

// ---------------------------------------------------------------------------
// Valid phase model — full pass
// ---------------------------------------------------------------------------

describe('Phase Objective Authenticity: valid phase model passes all checks', () => {
  it('passes when all three phases have specific objectives, criteria, and execution blocks', () => {
    const result = runGate(
      [makePhase('P1'), makePhase('P2'), makePhase('P3')],
      [makeExecBlock('P1'), makeExecBlock('P2'), makeExecBlock('P3')],
    );
    expect(result.failureCodes).not.toContain('MISSING_PHASE_OBJECTIVE');
    expect(result.failureCodes).not.toContain('VAGUE_PHASE_OBJECTIVE');
    expect(result.failureCodes).not.toContain('MISSING_PHASE_UNLOCK_CRITERIA');
    expect(result.failureCodes).not.toContain('VAGUE_PHASE_UNLOCK_CRITERIA');
    expect(result.failureCodes).not.toContain('PHASE_OBJECTIVE_WITHOUT_SUPPORTING_BLOCKS');
    expect(result.status).toBe('PLAN_QUALITY_PASSED');
  });
});

// ---------------------------------------------------------------------------
// Non-phased plans are not penalized
// ---------------------------------------------------------------------------

describe('Phase Objective Authenticity: non-phased plans are not penalized', () => {
  it('does not fire phase codes when phases is not provided', () => {
    const result = evaluatePlanQualityGate({
      goalText: GOAL,
      verificationText: VERIFY,
      proposedBlocks: [makeExecBlock('P1')] as any,
      committedBlocks: [],
      temporalContext: TEMPORAL_SHORT,
    });
    expect(result.failureCodes).not.toContain('MISSING_PHASE_OBJECTIVE');
    expect(result.failureCodes).not.toContain('VAGUE_PHASE_OBJECTIVE');
    expect(result.failureCodes).not.toContain('PHASE_OBJECTIVE_WITHOUT_SUPPORTING_BLOCKS');
  });

  it('does not fire phase codes when phases is an empty array', () => {
    const result = runGate([], [makeExecBlock('P1')]);
    expect(result.failureCodes).not.toContain('MISSING_PHASE_OBJECTIVE');
    expect(result.failureCodes).not.toContain('VAGUE_PHASE_OBJECTIVE');
    expect(result.failureCodes).not.toContain('PHASE_OBJECTIVE_WITHOUT_SUPPORTING_BLOCKS');
  });
});

// ---------------------------------------------------------------------------
// Multiple phases: one vague still fails the gate
// ---------------------------------------------------------------------------

describe('Phase Objective Authenticity: partial failure in multi-phase plan', () => {
  it('fails when one phase has a vague objective while others are good', () => {
    const result = runGate(
      [makePhase('P1'), makePhase('P2', { phaseObjective: 'Scale' }), makePhase('P3')],
      [makeExecBlock('P1'), makeExecBlock('P2'), makeExecBlock('P3')],
    );
    expect(result.failureCodes).toContain('VAGUE_PHASE_OBJECTIVE');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });
});
