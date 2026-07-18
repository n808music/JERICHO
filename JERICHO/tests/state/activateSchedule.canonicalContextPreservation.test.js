import { describe, expect, it } from 'vitest';
import { computeDerivedState, getCanonicalBlocks } from '../../src/state/identityCompute.js';
import { resolveBlockPlainLanguage } from '../../src/domain/product/resolveBlockPlainLanguage.js';

/**
 * Regression: live first activated calendar block detail-authority failure.
 *
 * Symptom — BlockDetailsPanel renders the first visible activated block with
 *   "Plan quality failed for this block detail"
 *   UNKNOWN_LANE_IDENTITY
 *   LANE_CONTEXT_NOT_APPLIED
 *
 * Root cause — the schedule_active transformation in activateSchedule strips
 * canonical identity context (masterPlanLaneId, producesArtifact, passEvidence,
 * missConsequence, completionAssertion, derivedFrom, consumedBy/consumedByRef,
 * phaseJustification, initiativeLabel, projectLabel, milestoneType) from the
 * review block when copying into state.blockStore. When BlockDetailsPanel reads
 * that activated block, the resolver's molecular gate sees stripped lane and
 * artifact fields and reports the block as under-specified — even though the
 * upstream proposal carried full canonical context.
 *
 * Specifically targets the hard-anchor protection block (the visible first
 * activated block in Operation Endgame).
 */

function buildHardAnchorProposalState() {
  const cycleId = 'cycle-hard-anchor';
  const masterPlanId = 'plan-operation-endgame';
  const dayKey = '2026-06-22';
  const hardAnchorBlock = {
    id: 'p-hard-anchor',
    goalId: 'goal-operation-endgame',
    cycleId,
    status: 'suggested',
    title: 'Validate Operation Endgame hard-anchor protection rules',
    label: 'Validate Operation Endgame hard-anchor protection rules',
    laneId: 'lane-operations',
    laneLabel: 'Operation Endgame studio operations system',
    entityId: 'global-state-solutions',
    entityLabel: 'Global State Solutions',
    phaseId: 'phase-p1',
    phaseLabel: 'P1',
    initiativeLabel: 'Operating System',
    projectLabel: 'Operating System',
    workType: 'Validation',
    masterPlanId,
    masterPlanLaneId: 'lane-operations',
    milestoneType: 'gate',
    derivedFrom: 'master_plan_fixed_anchors',
    derivationReason: 'master_plan_fixed_anchors',
    owner: 'James / Operation Endgame',
    producesArtifact: 'Validated hard-anchor rule set with explicit non-movable constraints and allowed reflow rules.',
    expectedOutput: 'Validated hard-anchor rule set with explicit non-movable constraints and allowed reflow rules.',
    passEvidence:
      'Written hard-anchor protection rule set showing preserved fixed anchors, allowed schedule reflow boundaries, and the next reassessment trigger.',
    acceptanceEvidence:
      'Written hard-anchor protection rule set showing preserved fixed anchors, allowed schedule reflow boundaries, and the next reassessment trigger.',
    missConsequence: 'Anchor drift weakens every downstream lane sequence.',
    completionAssertion:
      'Completing this asserts the operator produced a validated hard-anchor rule set and it meets the stated completion condition.',
    phaseJustification: 'Foundation gate prerequisite',
    consumedBy: ['masterPlanLane:lane-operations'],
    consumedByRef: { type: 'masterPlanLane', id: 'lane-operations' },
    // Attestation contract — operator verifies, Jericho does not.
    target: 'Validated hard-anchor protection rules linked to fixed anchors and preserved mandatory work',
    verificationSource: 'Operation Endgame plan-quality review record',
    operatorAttestation:
      'Operator opens the plan-quality review record, confirms the hard-anchor protection rules cover every fixed anchor, and attests completion.',
    startISO: `${dayKey}T16:00:00.000Z`,
    dayKey,
    durationMinutes: 45,
    domain: 'FOCUS',
    practice: 'FOCUS',
  };
  return {
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [hardAnchorBlock],
    suggestedBlocks: [],
    constraints: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        masterPlanId,
        scheduleGeneratedAtISO: null,
        goalContract: { goalId: 'goal-operation-endgame', startDayKey: dayKey, endDayKey: '2026-10-17' },
        proposedBlocks: [hardAnchorBlock],
        suggestedBlocks: [],
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId: 'goal-operation-endgame', startDayKey: dayKey, endDayKey: '2026-10-17' },
    masterPlansById: {
      [masterPlanId]: {
        id: masterPlanId,
        laneIds: ['lane-operations'],
        anchors: [{ id: 'anchor-1', date: '2026-10-17', label: 'October 17 album drop', isFixed: true }],
      },
    },
    masterPlanLanesById: {
      'lane-operations': {
        id: 'lane-operations',
        domain: 'brand',
        title: 'Operation Endgame brand and operations system',
        label: 'Operation Endgame brand and operations system',
      },
    },
    deliverablesByCycleId: {
      [cycleId]: {
        deliverables: [{ id: 'd-hard-anchor', title: 'Hard-anchor protection package', requiredBlocks: 1 }],
        suggestionLinks: {},
      },
    },
    lastPlanError: null,
  };
}

function runApplyAndActivate(state) {
  const reviewed = computeDerivedState(state, {
    type: 'APPLY_DRAFT_SCHEDULE',
    payload: { cycleId: state.activeCycleId },
  });
  const activated = computeDerivedState(reviewed, {
    type: 'ACTIVATE_SCHEDULE',
    payload: { cycleId: state.activeCycleId },
  });
  return { reviewed, activated };
}

describe('ACTIVATE_SCHEDULE — canonical identity context preservation', () => {
  it('preserves canonical lane, master plan, and artifact context on the activated hard-anchor block', () => {
    const { activated } = runApplyAndActivate(buildHardAnchorProposalState());
    const canonicalBlocks = getCanonicalBlocks(activated);
    expect(canonicalBlocks.length).toBeGreaterThan(0);

    const hardAnchorActivated = canonicalBlocks.find((block) =>
      /hard-anchor protection rules/i.test(String(block?.title || block?.label || ''))
    );
    expect(hardAnchorActivated).toBeTruthy();
    expect(hardAnchorActivated).toEqual(
      expect.objectContaining({
        laneId: 'lane-operations',
        laneLabel: 'Operation Endgame studio operations system',
        masterPlanLaneId: 'lane-operations',
        masterPlanId: 'plan-operation-endgame',
        entityId: 'global-state-solutions',
        entityLabel: 'Global State Solutions',
        phaseId: 'phase-p1',
        phaseLabel: 'P1',
        workType: 'Validation',
      })
    );

    expect(String(hardAnchorActivated.producesArtifact || '')).toMatch(/hard-anchor rule set/i);
    expect(String(hardAnchorActivated.expectedOutput || '')).toMatch(/hard-anchor rule set/i);
    expect(String(hardAnchorActivated.passEvidence || '')).toMatch(/hard-anchor protection rule set/i);
    expect(String(hardAnchorActivated.missConsequence || '')).toMatch(/anchor drift/i);
    expect(String(hardAnchorActivated.completionAssertion || '')).toMatch(/asserts the operator/i);
    expect(hardAnchorActivated.consumedByRef).toEqual({ type: 'masterPlanLane', id: 'lane-operations' });
    expect(hardAnchorActivated.consumedBy).toContain('masterPlanLane:lane-operations');
    expect(String(hardAnchorActivated.derivedFrom || hardAnchorActivated.derivationReason || '')).toContain(
      'master_plan_fixed_anchors'
    );
  });

  it('passes BlockDetailsPanel detail-authority for the first activated hard-anchor block', () => {
    const { activated } = runApplyAndActivate(buildHardAnchorProposalState());
    const hardAnchorActivated = getCanonicalBlocks(activated).find((block) =>
      /hard-anchor protection rules/i.test(String(block?.title || block?.label || ''))
    );
    expect(hardAnchorActivated).toBeTruthy();

    // Hierarchy projection as BlockDetailsPanel receives it from ZionDashboard.
    const hierarchy = {
      block: hardAnchorActivated.title,
      phase: 'P1',
      operatingCycle: 'Foundation / Launch Proof',
      sprint: 'Jun 22 — Oct 17',
      lane: 'Operation Endgame studio operations system',
      initiative: 'Operating System',
    };
    const detail = resolveBlockPlainLanguage(hardAnchorActivated, { hierarchy });

    const failureCodes = detail?.quality?.failureCodes || [];
    expect(failureCodes).not.toContain('UNKNOWN_LANE_IDENTITY');
    expect(failureCodes).not.toContain('LANE_CONTEXT_NOT_APPLIED');
    expect(failureCodes).not.toContain('MISSING_EXPECTED_OUTPUT');
    expect(failureCodes).not.toContain('MISSING_ACCEPTANCE_EVIDENCE');
    expect(detail?.quality?.status).not.toBe('under_specified');
  });
});
