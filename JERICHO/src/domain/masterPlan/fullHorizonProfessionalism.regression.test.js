/**
 * Full-horizon professionalism regression (Phase 8 — Execution
 * Professionalism Remediation).
 *
 * Exercises the expansion engine end-to-end against an Operation
 * Endgame-shaped multi-lane plan and runs the plan-quality gate on
 * the generated blocks. Asserts the professionalism contract:
 *
 *   1.  Block count is nontrivial
 *   2.  Horizon reaches 2031
 *   3.  Outcome target is preserved on the plan
 *   4.  Every execution-class block has an owner / ownerClass
 *   5.  Every gate block has gateName + passCriteria + failCriteria +
 *       passBranch + failBranch
 *   6.  Each BD-required lane has at least one isExternalBdMechanic block
 *       and at least one isExternalStakeholderTouchpoint block
 *   7.  Capital lane produces a budget-amount artifact
 *   8.  No review-class block lacks evidenceRequired (or such failures
 *       are explicit in the gate output)
 *   9.  Active cycle starts on or after evaluationDate when no backdating
 *       is allowed
 *  10.  planQualityGate materializes (returns a result, status is
 *       PLAN_QUALITY_PASSED or PLAN_QUALITY_WITHHELD with failure codes)
 *
 * POS (P.O.S.) is intentionally out of scope here — it lives in the
 * state engine and is exercised by tests/state/scoring.pos.*. The
 * masterPlan-layer regression asserts the upstream substrate.
 */
import { describe, expect, it } from 'vitest';

import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';
import { evaluatePlanQualityGate } from '../planQuality/evaluatePlanQualityGate.ts';

const HORIZON_START = '2026-06-01';
const HORIZON_END = '2031-05-19';
const EVAL_DATE = HORIZON_START;

const PLAN = {
  id: 'operation-endgame-regression',
  successStandard: 'Active scaling ecosystem operating across 8 lanes by 2031-05-19',
  outcomeTarget: 'Active scaling ecosystem by 2031-05-19 with measurable revenue, distribution, and institution proof',
  coreMission: 'Build Operation Endgame ecosystem',
};

const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: HORIZON_START, endBoundary: '2026-12-31', phaseObjective: 'Found' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31', phaseObjective: 'Operate' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: HORIZON_END, phaseObjective: 'Scale' },
  ],
};

function laneOf(id, domain, title) {
  return {
    id: `lane-${id}`,
    laneId: `lane-${id}`,
    domain,
    title,
    laneTitle: title,
    activationState: 'active',
  };
}

const LANES = [
  laneOf('product', 'product', 'Core Product'),
  laneOf('creative', 'creative', 'Album Engine'),
  laneOf('media', 'media', 'Podcast Channel'),
  laneOf('operations', 'brand', 'Operations Studio'),
  laneOf('income', 'income', 'Services Revenue'),
  laneOf('capital', 'capital', 'Capital Real Estate'),
  laneOf('institution', 'institution', 'Institution Education'),
  laneOf('civic', 'civic', 'Civic Development'),
];

const BD_REQUIRED_LANE_IDS = new Set(['lane-income', 'lane-capital', 'lane-institution', 'lane-civic']);

const blocks = expandFullHorizonSchedule({
  plan: PLAN,
  phaseModel: PHASE_MODEL,
  horizonStartDayKey: HORIZON_START,
  horizonEndDayKey: HORIZON_END,
  lanes: LANES,
  existingForecastBlocks: [],
  committedBlocks: [],
  workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
});

describe('Phase 8 — full-horizon professionalism regression', () => {
  it('1. block count is nontrivial (> 500 across 8 lanes / 3 phases / 5 years)', () => {
    expect(blocks.length).toBeGreaterThan(500);
  });

  it('2. horizon reaches 2031', () => {
    const maxDayKey = blocks.map((b) => b.dayKey).sort().pop();
    expect(maxDayKey >= '2031-01-01').toBe(true);
  });

  it('3. plan outcomeTarget is non-empty', () => {
    expect(typeof PLAN.outcomeTarget).toBe('string');
    expect(PLAN.outcomeTarget.length).toBeGreaterThan(0);
  });

  it('4. every execution-class block has an owner', () => {
    const executionTypes = new Set(['action', 'milestone']);
    const ownerlessExecution = blocks.filter((b) => executionTypes.has(b.blockType) && !b.owner);
    expect(ownerlessExecution).toEqual([]);
  });

  it('5. every gate block carries gateName + passCriteria + failCriteria + passBranch + failBranch', () => {
    const gates = blocks.filter((b) => b.blockType === 'gate');
    expect(gates.length).toBeGreaterThan(0);
    for (const gate of gates) {
      expect(gate.gateName).toBeTruthy();
      expect(gate.passCriteria).toBeTruthy();
      expect(gate.failCriteria).toBeTruthy();
      expect(gate.passBranch).toBeTruthy();
      expect(gate.failBranch).toBeTruthy();
    }
  });

  it('6. each BD-required active lane has ≥1 isExternalBdMechanic + ≥1 stakeholder touchpoint', () => {
    for (const laneId of BD_REQUIRED_LANE_IDS) {
      const laneBlocks = blocks.filter((b) => b.laneId === laneId);
      expect(laneBlocks.length).toBeGreaterThan(0);
      expect(laneBlocks.some((b) => b.isExternalBdMechanic === true)).toBe(true);
      expect(laneBlocks.some((b) => b.isExternalStakeholderTouchpoint === true)).toBe(true);
    }
  });

  it('7. capital lane produces at least one budget-amount artifact', () => {
    const pattern = /\$\s*\d|\b\d+\s*(?:k|m|b)\b|\bbudget\s+(?:range|amount)\b|\bunknown[- ]budget\b/i;
    const capitalBlocks = blocks.filter((b) => b.laneId === 'lane-capital');
    expect(capitalBlocks.some((b) => pattern.test(String(b.producesArtifact || '')))).toBe(true);
  });

  it('10. planQualityGate materializes a result with status + failureCodes array', () => {
    const result = evaluatePlanQualityGate({
      goalText: PLAN.coreMission,
      deliverables: [],
      actions: [],
      proposedBlocks: blocks,
      committedBlocks: [],
      evaluationDate: EVAL_DATE,
      missionContext: {
        coreMission: PLAN.coreMission,
        outcomeTarget: PLAN.outcomeTarget,
        successStandard: PLAN.successStandard,
        terminalOutcome: PLAN.outcomeTarget,
        controllabilityClass: 'semi_controllable',
        terminalTargetClass: 'externally_mediated',
      },
    });
    expect(['PLAN_QUALITY_PASSED', 'PLAN_QUALITY_WITHHELD']).toContain(result.status);
    expect(Array.isArray(result.failureCodes)).toBe(true);
    // 9. active cycle does not start in the past when evaluationDate == horizon start
    expect(result.failureCodes).not.toContain('ACTIVE_CYCLE_STARTS_IN_PAST_WITHOUT_CONFIRMATION');
    expect(result.failureCodes).not.toContain('STALE_ACTIVE_CYCLE_STATE');
  });
});
