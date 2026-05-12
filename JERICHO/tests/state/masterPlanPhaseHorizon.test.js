/**
 * Phase horizon correction tests
 *
 * Doctrine: The Full Phase Plan must cover the declared multi-year strategic horizon.
 *   - A plan whose goal text says "5-year" must have P3 end near the 5-year mark.
 *   - The active execution cycle can remain short (e.g., first cycle = 5 months).
 *   - Old plans with truncated horizonEnd get extended by the compute normalization pass.
 *   - fullHorizonEndDayKey is the authoritative field; horizonEnd is the legacy fallback.
 *
 * Acceptance criteria (from spec):
 *   1. Five-year plan starting in 2026 renders Full Phase Plan through approximately 2031.
 *   2. P3 ends around 2031, not 2028.
 *   3. P2/P3 can remain locked/gated but still cover the correct future horizon.
 *   4. Active execution cycle horizon remains bounded (does not dump 5 years into Today).
 *   5. Locked future phases still preserve full-horizon dates.
 */

import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';
import { deriveMasterPlanPhaseModel } from '../../src/domain/masterPlan/masterPlanPhaseModel.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildFiveYearPlanState({ nowISO = '2026-05-11T10:00:00.000Z', todayDate = '2026-05-11' } = {}) {
  const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate });
  state.masterPlanIntake = {
    status: 'in-progress', phase: 4, step: 13, profileId: DEFAULT_PROFILE_ID,
    answers: {
      step_2: 'Build a 5-year multi-venture platform reaching 10k users — coordinate Operation Endgame through a multi-lane master plan',
      step_3: { horizonEnd: '2031-05-11', months: 60, label: 'May 2031' },
      step_5: { exists: true, urgency: 'high', notes: '' },
      step_6: 'Execute.',
      lane_0_description: 'App in development.',
      lane_0_system_assessment: { assessedStage: 'in-development', assessedConfidence: 'high', assessmentNotes: '' },
      lane_0_activation: 'active',
      lane_0_clarifying_0: 'beta complete',
    },
    extractedLanes: [{ title: 'App launch', domain: 'product', role: 'revenue-engine' }],
    anchors: [{ id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17 launch', isFixed: true, affectedLaneIds: [], priority: 0 }],
    currentLaneIdx: 0, clarifyingQuestionIdx: 0, draft: null, errorMessage: null,
  };
  applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
  return computeDerivedState(state, { type: 'NO_OP' });
}

function buildTruncatedHorizonPlanState({ nowISO = '2026-05-09T10:00:00.000Z', todayDate = '2026-05-09' } = {}) {
  // Simulates an OLD plan: goal text says "5-year" but horizonEnd was stored as 2 years (old form default).
  const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate });
  state.masterPlanIntake = {
    status: 'in-progress', phase: 4, step: 13, profileId: DEFAULT_PROFILE_ID,
    answers: {
      step_2: 'Build a 5-year multi-venture platform reaching 10k users — coordinate Operation Endgame through a multi-lane master plan',
      // Simulate old form behavior: user entered 24 months despite 5-year intent
      step_3: { horizonEnd: '2028-05-09', months: 24, label: 'May 2028' },
      step_5: { exists: true, urgency: 'high', notes: '' },
      step_6: 'Execute.',
      lane_0_description: 'App in development.',
      lane_0_system_assessment: { assessedStage: 'in-development', assessedConfidence: 'high', assessmentNotes: '' },
      lane_0_activation: 'active',
      lane_0_clarifying_0: 'beta complete',
    },
    extractedLanes: [{ title: 'App launch', domain: 'product', role: 'revenue-engine' }],
    anchors: [{ id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17 launch', isFixed: true, affectedLaneIds: [], priority: 0 }],
    currentLaneIdx: 0, clarifyingQuestionIdx: 0, draft: null, errorMessage: null,
  };
  applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
  return computeDerivedState(state, { type: 'NO_OP' });
}

function getPlan(derived) {
  const plans = Object.values(derived.masterPlansById || {});
  return plans[0] || null;
}

function getPhaseModel(derived) {
  const plan = getPlan(derived);
  if (!plan) return null;
  const lanes = (plan.laneIds || []).map(id => derived.masterPlanLanesById?.[id]).filter(Boolean);
  const milestones = lanes.flatMap(l => (l.milestoneIds || []).map(id => derived.masterPlanMilestonesById?.[id])).filter(Boolean);
  return deriveMasterPlanPhaseModel({
    plan,
    lanes,
    milestones,
    anchors: plan.anchors || [],
    planCycle: null,
    committedBlocks: [],
    criticQuestionsByLane: {},
  });
}

// ─── Suite 1: Correct 5-year plan (no truncation) ────────────────────────────

describe('phase horizon — correctly declared 5-year plan', () => {
  it('stores horizonEnd as 2031', () => {
    const derived = buildFiveYearPlanState();
    const plan = getPlan(derived);
    expect(plan?.horizonEnd).toBe('2031-05-11');
  });

  it('fullHorizonEndDayKey equals horizonEnd', () => {
    const derived = buildFiveYearPlanState();
    const plan = getPlan(derived);
    expect(plan?.fullHorizonEndDayKey).toBe('2031-05-11');
  });

  it('P3 ends at or near 2031', () => {
    const derived = buildFiveYearPlanState();
    const model = getPhaseModel(derived);
    const p3 = model?.phases?.find(p => p.label === 'P3');
    expect(p3).toBeDefined();
    expect(p3.endBoundary).toMatch(/^203[01]/);
  });

  it('P1 ends well before 2031 (first cycle is bounded)', () => {
    const derived = buildFiveYearPlanState();
    const model = getPhaseModel(derived);
    const p1 = model?.phases?.find(p => p.label === 'P1');
    expect(p1).toBeDefined();
    expect(p1.endBoundary < '2029-01-01').toBe(true);
  });

  it('phases collectively span from 2026 to 2031', () => {
    const derived = buildFiveYearPlanState();
    const model = getPhaseModel(derived);
    const phases = model?.phases || [];
    expect(phases.length).toBe(3);
    expect(phases[0].startBoundary).toMatch(/^2026/);
    expect(phases[phases.length - 1].endBoundary).toMatch(/^203[01]/);
  });

  it('locked future phases (P2, P3) still carry correct horizon dates', () => {
    const derived = buildFiveYearPlanState();
    const model = getPhaseModel(derived);
    const p2 = model?.phases?.find(p => p.label === 'P2');
    const p3 = model?.phases?.find(p => p.label === 'P3');
    expect(p2?.activeState).toBe('locked');
    expect(p3?.activeState).toBe('locked');
    expect(p2?.endBoundary > '2027-01-01').toBe(true);
    expect(p3?.endBoundary).toMatch(/^203[01]/);
  });
});

// ─── Suite 2: Truncated horizon migration (old plan) ─────────────────────────

describe('phase horizon — truncated old-plan migration (2-year stored, 5-year declared)', () => {
  it('compute pass extends horizonEnd from 2028 to ~2031', () => {
    const derived = buildTruncatedHorizonPlanState();
    const plan = getPlan(derived);
    // Stored was 2028-05-09; goal text says 5-year so compute should extend to ~2031
    expect(plan?.horizonEnd > '2030-01-01').toBe(true);
  });

  it('fullHorizonEndDayKey is extended to ~2031 for old plans', () => {
    const derived = buildTruncatedHorizonPlanState();
    const plan = getPlan(derived);
    expect(plan?.fullHorizonEndDayKey > '2030-01-01').toBe(true);
  });

  it('P3 ends near 2031 after migration, not 2028', () => {
    const derived = buildTruncatedHorizonPlanState();
    const model = getPhaseModel(derived);
    const p3 = model?.phases?.find(p => p.label === 'P3');
    expect(p3).toBeDefined();
    expect(p3.endBoundary > '2030-01-01').toBe(true);
  });

  it('P1 remains bounded (does not extend to 5-year horizon)', () => {
    const derived = buildTruncatedHorizonPlanState();
    const model = getPhaseModel(derived);
    const p1 = model?.phases?.find(p => p.label === 'P1');
    expect(p1).toBeDefined();
    // P1 ends shortly after Oct 17 anchor + proof capture, well before 2030
    expect(p1.endBoundary < '2029-01-01').toBe(true);
  });

  it('Oct 17 anchor remains in P1, not treated as terminal horizon', () => {
    const derived = buildTruncatedHorizonPlanState();
    const model = getPhaseModel(derived);
    const p1 = model?.phases?.find(p => p.label === 'P1');
    const anchorRole = p1?.anchorsInPhase?.find(a => a.date === '2026-10-17')?.role;
    expect(anchorRole).toBe('convergence_event');
  });
});

// ─── Suite 3: Short plan not incorrectly extended ────────────────────────────

describe('phase horizon — short intentional plan is not incorrectly extended', () => {
  it('2-year plan without multi-year goal text keeps 2-year horizon', () => {
    const nowISO = '2026-05-11T10:00:00.000Z';
    const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate: '2026-05-11' });
    state.masterPlanIntake = {
      status: 'in-progress', phase: 4, step: 13, profileId: DEFAULT_PROFILE_ID,
      answers: {
        step_2: 'Launch my app and album by the end of 2028',
        step_3: { horizonEnd: '2028-05-11', months: 24, label: 'May 2028' },
        step_5: { exists: false, urgency: 'low', notes: '' },
        step_6: 'Execute.',
        lane_0_description: 'App in development.',
        lane_0_system_assessment: { assessedStage: 'in-development', assessedConfidence: 'high', assessmentNotes: '' },
        lane_0_activation: 'active',
        lane_0_clarifying_0: 'beta complete',
      },
      extractedLanes: [{ title: 'App launch', domain: 'product', role: 'revenue-engine' }],
      anchors: [{ id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17 launch', isFixed: true, affectedLaneIds: [], priority: 0 }],
      currentLaneIdx: 0, clarifyingQuestionIdx: 0, draft: null, errorMessage: null,
    };
    applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const plan = getPlan(derived);
    // No multi-year text → should NOT be extended past 2028
    expect(plan?.horizonEnd).toMatch(/^2028/);
    expect(plan?.fullHorizonEndDayKey).toMatch(/^2028/);
  });
});

// ─── Suite 3b: Word-form and "master plan" normalization ─────────────────────

describe('phase horizon — word-form year and "master plan" text normalization', () => {
  it('"five-year" word form extends truncated horizon the same as numeric "5-year"', () => {
    const nowISO = '2026-05-11T10:00:00.000Z';
    const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate: '2026-05-11' });
    state.masterPlanIntake = {
      status: 'in-progress', phase: 4, step: 13, profileId: DEFAULT_PROFILE_ID,
      answers: {
        step_2: 'Execute a five-year growth plan for my creative company',
        step_3: { horizonEnd: '2028-05-11', months: 24, label: 'May 2028' },
        step_5: { exists: false, urgency: 'low', notes: '' },
        step_6: 'Execute.',
        lane_0_description: 'Creative company in early stage.',
        lane_0_system_assessment: { assessedStage: 'in-development', assessedConfidence: 'high', assessmentNotes: '' },
        lane_0_activation: 'active',
        lane_0_clarifying_0: 'foundation stage',
      },
      extractedLanes: [{ title: 'Creative company', domain: 'creative', role: 'proof-artifact' }],
      anchors: [],
      currentLaneIdx: 0, clarifyingQuestionIdx: 0, draft: null, errorMessage: null,
    };
    applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const plan = getPlan(derived);
    expect(plan?.horizonEnd > '2030-01-01').toBe(true);
    expect(plan?.fullHorizonEndDayKey > '2030-01-01').toBe(true);
  });

  it('"master plan" text triggers 3-year minimum — a 6-month stored horizon is extended', () => {
    const nowISO = '2026-05-11T10:00:00.000Z';
    const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate: '2026-05-11' });
    state.masterPlanIntake = {
      status: 'in-progress', phase: 4, step: 13, profileId: DEFAULT_PROFILE_ID,
      answers: {
        step_2: 'Coordinate Operation Endgame through a multi-lane master plan',
        step_3: { horizonEnd: '2026-11-11', months: 6, label: 'Nov 2026' },
        step_5: { exists: false, urgency: 'low', notes: '' },
        step_6: 'Execute.',
        lane_0_description: 'App in development.',
        lane_0_system_assessment: { assessedStage: 'in-development', assessedConfidence: 'high', assessmentNotes: '' },
        lane_0_activation: 'active',
        lane_0_clarifying_0: 'foundation stage',
      },
      extractedLanes: [{ title: 'App launch', domain: 'product', role: 'revenue-engine' }],
      anchors: [],
      currentLaneIdx: 0, clarifyingQuestionIdx: 0, draft: null, errorMessage: null,
    };
    applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const plan = getPlan(derived);
    // "master plan" triggers 3-year minimum; stored 6-month horizon should be extended
    expect(plan?.horizonEnd > '2028-01-01').toBe(true);
    expect(plan?.fullHorizonEndDayKey > '2028-01-01').toBe(true);
  });
});

// ─── Suite 4: Active cycle remains bounded ───────────────────────────────────

describe('phase horizon — active execution cycle remains bounded for 5-year plan', () => {
  it('first cycle ends around Oct 2026, not 2031', () => {
    const derived = buildFiveYearPlanState();
    const started = computeDerivedState(derived, { type: 'START_NEW_CYCLE_WITH_DECISION', payload: { mode: 'archive' } });
    const cycleId = started.activeCycleId;
    const cycle = started.cyclesById?.[cycleId];
    if (cycle?.deadlineDayKey) {
      // First cycle deadline should be at the anchor (Oct 2026) or nearby, not 2031
      expect(cycle.deadlineDayKey < '2028-01-01').toBe(true);
    }
    // Even without a cycle deadline, verify P1 boundaries are bounded
    const model = getPhaseModel(derived);
    const p1 = model?.phases?.find(p => p.label === 'P1');
    expect(p1?.endBoundary < '2029-01-01').toBe(true);
  });
});
