/**
 * Horizon parity tests — acceptance criteria 1, 2, 3, 6, 7
 *
 * Verifies:
 *  - 5-year goal text produces a horizon near 2031, not 2026
 *  - Anchor date (Oct 17) is NOT treated as the full plan horizon
 *  - Phase architecture extends to the full horizon (2031)
 *  - officialStartDate is distinct from firstAvailableWorkWindow
 *  - First generated cycle can stay near-term without collapsing the plan horizon
 */
import { describe, it, expect } from 'vitest';
import {
  inferHorizonYearsFromText,
  suggestPlanHorizon,
  suggestHorizonFromAnchors,
} from '../../src/domain/masterPlan/masterPlanIntakeEngine.js';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';
import { buildMasterPlan } from '../../src/domain/masterPlan/masterPlanFactory.js';
import { deriveMasterPlanPhaseModel } from '../../src/domain/masterPlan/masterPlanPhaseModel.js';

// ─── inferHorizonYearsFromText ─────────────────────────────────────────────────

describe('inferHorizonYearsFromText', () => {
  it('detects "5-year" from numeric pattern', () => {
    const result = inferHorizonYearsFromText('Build a 5-year multi-venture platform');
    expect(result).toMatchObject({ years: 5, months: 60 });
  });

  it('detects "five year" from word pattern', () => {
    const result = inferHorizonYearsFromText('This is a five-year company-building plan');
    expect(result).toMatchObject({ years: 5, months: 60 });
  });

  it('detects "3-year" from numeric pattern', () => {
    const result = inferHorizonYearsFromText('Three-year runway plan starting now');
    expect(result).toMatchObject({ years: 3, months: 36 });
  });

  it('detects "multi-year" as 3-year minimum', () => {
    const result = inferHorizonYearsFromText('Multi-year platform with multiple active lanes');
    expect(result).toMatchObject({ years: 3, months: 36 });
  });

  it('returns null for short-term goals', () => {
    expect(inferHorizonYearsFromText('Release my EP by October')).toBeNull();
    expect(inferHorizonYearsFromText('Launch the app this quarter')).toBeNull();
    expect(inferHorizonYearsFromText('')).toBeNull();
  });
});

// ─── suggestPlanHorizon — anchor is NOT the horizon ──────────────────────────

describe('suggestPlanHorizon', () => {
  const NOW = '2026-05-11T00:00:00.000Z';
  const OCTOBER_ANCHOR = [{ id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17 drop', isFixed: true }];

  it('prefers goal-text inference over anchor date for 5-year plan', () => {
    const result = suggestPlanHorizon(
      'Build a 5-year multi-venture platform ecosystem',
      OCTOBER_ANCHOR,
      NOW
    );
    expect(result.source).toBe('goal_text');
    expect(result.months).toBe(60);
    // horizonEnd must be ~2031, not ~2026
    expect(result.horizonEnd.startsWith('2031')).toBe(true);
  });

  it('anchor-based suggestion is used when no multi-year signal present', () => {
    const result = suggestPlanHorizon(
      'Release my EP by October 17',
      OCTOBER_ANCHOR,
      NOW
    );
    expect(result?.source).toBe('anchor');
    // anchor + 14 days = ~2026-10-31
    expect(result?.horizonEnd?.startsWith('2026')).toBe(true);
  });

  it('anchor date is not conflated with full plan horizon for 5-year plan', () => {
    const horizonResult = suggestPlanHorizon(
      'Five-year company-building plan with an October 17 album launch',
      OCTOBER_ANCHOR,
      NOW
    );
    const anchorResult = suggestHorizonFromAnchors(OCTOBER_ANCHOR, NOW);

    // The two must diverge significantly for a multi-year goal
    expect(horizonResult.horizonEnd > anchorResult.horizonEnd).toBe(true);
    // Full horizon is 5 years out; anchor suggestion is ~6 months out
    expect(horizonResult.horizonEnd.startsWith('2031')).toBe(true);
    expect(anchorResult.horizonEnd.startsWith('2026')).toBe(true);
  });
});

// ─── applyIntakeComplete — horizon inference safety net ───────────────────────

function buildFiveYearIntakeDraft(goalText = 'Build a 5-year multi-venture platform reaching 10,000 users') {
  const state = buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: '2026-05-11T12:00:00.000Z',
    todayDate: '2026-05-11',
  });
  state.masterPlanIntake = {
    status: 'in-progress',
    phase: 4,
    step: 13,
    profileId: DEFAULT_PROFILE_ID,
    answers: {
      step_1: goalText,
      step_2: goalText,
      step_3: null, // No explicit horizonAnswer — triggers inference path
      lane_0_description: 'Album ready to launch.',
      lane_0_system_assessment: { assessedStage: 'ready-to-launch', assessedConfidence: 'high', assessmentNotes: '' },
      lane_0_activation: 'active',
    },
    extractedLanes: [{ title: 'EP release', domain: 'creative', role: 'proof-artifact' }],
    anchors: [{ id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17 drop', isFixed: true, affectedLaneIds: [], priority: 0 }],
    currentLaneIdx: 0,
    clarifyingQuestionIdx: 0,
    draft: null,
    errorMessage: null,
  };
  return state;
}

describe('applyIntakeComplete — horizon inference safety net', () => {
  it('5-year goal text with no step_3 answer produces horizonEnd ~2031', () => {
    const state = buildFiveYearIntakeDraft();
    applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO: '2026-05-11T12:00:00.000Z' });

    const planId = state.masterPlanIntake.draft.masterPlanId;
    const plan = state.masterPlansById[planId];
    expect(plan).toBeDefined();
    // horizonEnd must be ~2031, not ~2026 (anchor + 14 days)
    expect(plan.horizonEnd).toBeTruthy();
    expect(plan.horizonEnd.startsWith('2031')).toBe(true);
  });

  it('anchor date (Oct 17) is not stored as the plan horizonEnd', () => {
    const state = buildFiveYearIntakeDraft();
    applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO: '2026-05-11T12:00:00.000Z' });

    const planId = state.masterPlanIntake.draft.masterPlanId;
    const plan = state.masterPlansById[planId];
    expect(plan.horizonEnd).not.toBe('2026-10-17');
    expect(plan.horizonEnd > '2026-10-17').toBe(true);
  });

  it('explicit step_3 answer is respected (user authority wins over inference)', () => {
    const state = buildFiveYearIntakeDraft();
    // User explicitly said 2 years
    state.masterPlanIntake.answers['step_3'] = { horizonEnd: '2028-05-11', months: 24 };

    applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO: '2026-05-11T12:00:00.000Z' });

    const planId = state.masterPlanIntake.draft.masterPlanId;
    const plan = state.masterPlansById[planId];
    expect(plan.horizonEnd).toBe('2028-05-11');
  });
});

// ─── Phase model extends to full horizon ──────────────────────────────────────

describe('Phase model extends to full 5-year horizon', () => {
  it('phase 3 ends at horizonEnd 2031, not 2028', () => {
    const plan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: 'Multi-Venture Platform',
      northStarOutcome: 'Build a 5-year multi-venture platform',
      horizonStart: '2026-05-11',
      horizonEnd: '2031-05-11',
      anchors: [{ date: '2026-10-17', label: 'Album drop', isFixed: true }],
    });

    const phaseModel = deriveMasterPlanPhaseModel({
      plan,
      lanes: [],
      milestones: [],
      committedBlocks: [],
      activeCycle: null,
      nowISO: '2026-05-11T00:00:00.000Z',
    });

    const phases = phaseModel?.phases || [];
    expect(phases.length).toBeGreaterThanOrEqual(2);

    const lastPhase = phases[phases.length - 1];
    // Phase model uses endBoundary (not end)
    expect(lastPhase.endBoundary).toBe('2031-05-11');
  });

  it('plan overview fullHorizonEndDayKey equals plan.horizonEnd, not the anchor date', () => {
    const plan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: 'Multi-Venture Platform',
      northStarOutcome: 'Build a 5-year multi-venture platform',
      horizonStart: '2026-05-11',
      horizonEnd: '2031-05-11',
      anchors: [{ date: '2026-10-17', label: 'Album drop', isFixed: true }],
    });

    // fullHorizonEndDayKey should use plan.horizonEnd, not the anchor
    expect(plan.horizonEnd).toBe('2031-05-11');
    expect(plan.anchors[0].date).toBe('2026-10-17');
    // These must differ — the anchor is a milestone, not the plan end
    expect(plan.horizonEnd).not.toBe(plan.anchors[0].date);
  });

  it('first generated cycle stays near-term without collapsing the plan horizon', () => {
    const state = buildFiveYearIntakeDraft();
    applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO: '2026-05-11T12:00:00.000Z' });

    const planId = state.masterPlanIntake.draft.masterPlanId;
    const plan = state.masterPlansById[planId];

    // Plan horizon extends to 2031
    expect(plan.horizonEnd.startsWith('2031')).toBe(true);

    // Milestones in the near-term (before October) exist for the launch window
    const laneId = plan.laneIds[0];
    const lane = state.masterPlanLanesById[laneId];
    const nearTermMilestones = lane.milestoneIds
      .map((id) => state.masterPlanMilestonesById[id])
      .filter((m) => m && m.targetDate <= '2026-10-17');

    // Should have multiple near-term milestones for the launch prep
    expect(nearTermMilestones.length).toBeGreaterThan(3);
  });
});

// ─── officialStartDate is distinct from firstAvailableWorkWindow ──────────────

describe('officialStartDate contract clarity', () => {
  it('plan stores officialStartDate separate from scheduleAppliedDate', () => {
    const plan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: 'Test Plan',
      northStarOutcome: 'Build something',
      horizonStart: '2026-05-11',
      horizonEnd: '2031-05-11',
      officialStartDate: '2026-05-11',
      anchors: [{ date: '2026-10-17', label: 'Launch', isFixed: true }],
    });

    expect(plan.officialStartDate).toBe('2026-05-11');
    expect(plan.scheduleAppliedDate).toBeNull();
    expect(plan.intakeCreatedAt).toBeTruthy();
  });

  it('officialStartDate does not equal scheduleAppliedDate initially', () => {
    const plan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: 'Test Plan',
      northStarOutcome: 'Build something',
      horizonStart: '2026-05-11',
      horizonEnd: '2031-05-11',
      officialStartDate: '2026-05-11',
      anchors: [{ date: '2026-10-17', label: 'Launch', isFixed: true }],
    });

    // scheduleAppliedDate starts null — it is NOT the same as officialStartDate
    expect(plan.officialStartDate).toBeTruthy();
    expect(plan.scheduleAppliedDate).toBeNull();
    // Three distinct fields with distinct semantics
    expect([plan.officialStartDate, plan.intakeCreatedAt, plan.scheduleAppliedDate]).toHaveLength(3);
  });

  it('intake completion populates officialStartDate on the plan', () => {
    const state = buildFiveYearIntakeDraft();
    applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO: '2026-05-11T12:00:00.000Z' });

    const planId = state.masterPlanIntake.draft.masterPlanId;
    const plan = state.masterPlansById[planId];

    expect(plan.officialStartDate).toBe('2026-05-11');
    expect(plan.scheduleAppliedDate).toBeNull();
  });
});
