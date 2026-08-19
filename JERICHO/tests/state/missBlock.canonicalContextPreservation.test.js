import { describe, expect, it } from 'vitest';
import { computeDerivedState, getAllBlocks, getCanonicalBlocks } from '../../src/state/identityCompute.js';
import { resolveBlockPlainLanguage } from '../../src/domain/product/resolveBlockPlainLanguage.js';

/**
 * Regression: MISS_BLOCK shares the same materialization boundary as
 * COMPLETE_BLOCK, so canonical lane / artifact context must survive a missed
 * transition for the same reason — the panel must still pass
 * BlockDetailsPanel detail-authority after the user marks a block missed.
 *
 * This is the companion regression to completeBlock.canonicalContextPreservation;
 * MISS_BLOCK runs through materializeBlocksFromEvents which previously stripped
 * canonical context just as the complete path did.
 */

function buildHardAnchorState() {
  const cycleId = 'cycle-hard-anchor-miss';
  const masterPlanId = 'plan-operation-endgame';
  const dayKey = '2026-06-22';
  const hardAnchorBlock = {
    id: 'p-hard-anchor-miss',
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
    ledger: [],
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

function findHardAnchorBlock(blocks) {
  return (blocks || []).find((block) =>
    /hard-anchor protection rules/i.test(String(block?.title || block?.label || ''))
  );
}

function applyAndActivate(state) {
  const reviewed = computeDerivedState(state, {
    type: 'APPLY_DRAFT_SCHEDULE',
    payload: { cycleId: state.activeCycleId },
  });
  return computeDerivedState(reviewed, {
    type: 'ACTIVATE_SCHEDULE',
    payload: { cycleId: state.activeCycleId },
  });
}

describe('MISS_BLOCK on first activated calendar block', () => {
  it('preserves canonical lane / master plan / artifact context after MISS_BLOCK', () => {
    const activated = applyAndActivate(buildHardAnchorState());
    const activatedBlock = findHardAnchorBlock(getCanonicalBlocks(activated));
    expect(activatedBlock).toBeTruthy();

    const missed = computeDerivedState(activated, {
      type: 'MISS_BLOCK',
      id: activatedBlock.id,
    });

    const missedTodayBlock = findHardAnchorBlock(missed.today?.blocks || []);
    const missedCycleBlock = findHardAnchorBlock(
      (missed.cycle || []).flatMap((d) => d.blocks || [])
    );
    const missedCanonical = findHardAnchorBlock(getCanonicalBlocks(missed));

    [missedTodayBlock, missedCycleBlock, missedCanonical].forEach((block) => {
      if (!block) return;
      expect(block).toEqual(
        expect.objectContaining({
          laneId: 'lane-operations',
          laneLabel: 'Operation Endgame studio operations system',
          masterPlanLaneId: 'lane-operations',
        })
      );
    });
  });

  it('still passes BlockDetailsPanel detail-authority after MISS_BLOCK', () => {
    const activated = applyAndActivate(buildHardAnchorState());
    const activatedBlock = findHardAnchorBlock(getCanonicalBlocks(activated));
    const missed = computeDerivedState(activated, {
      type: 'MISS_BLOCK',
      id: activatedBlock.id,
    });

    const subjectBlocks = [
      findHardAnchorBlock(missed.today?.blocks || []),
      findHardAnchorBlock((missed.cycle || []).flatMap((d) => d.blocks || [])),
      findHardAnchorBlock(getCanonicalBlocks(missed)),
    ].filter(Boolean);

    expect(subjectBlocks.length).toBeGreaterThan(0);

    const hierarchy = {
      block: activatedBlock.title,
      phase: 'P1',
      operatingCycle: 'Foundation / Launch Proof',
      sprint: 'Jun 22 — Oct 17',
      lane: 'Operation Endgame studio operations system',
      initiative: 'Operating System',
    };

    subjectBlocks.forEach((block) => {
      const detail = resolveBlockPlainLanguage(block, { hierarchy });
      const failureCodes = detail?.quality?.failureCodes || [];
      expect(failureCodes).not.toContain('UNKNOWN_LANE_IDENTITY');
      expect(failureCodes).not.toContain('LANE_CONTEXT_NOT_APPLIED');
    });
  });
});
