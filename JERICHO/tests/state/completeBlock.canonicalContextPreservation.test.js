import { describe, expect, it } from 'vitest';
import { computeDerivedState, getAllBlocks, getCanonicalBlocks } from '../../src/state/identityCompute.js';
import { resolveBlockPlainLanguage } from '../../src/domain/product/resolveBlockPlainLanguage.js';

/**
 * Regression: live first activated calendar block, after pressing Activate
 * then Complete, renders with status "missed" AND with the failure banner:
 *   - UNKNOWN_LANE_IDENTITY
 *   - LANE_CONTEXT_NOT_APPLIED
 *
 * Two defects to guard:
 * 1. Complete must NOT route to missed status. After COMPLETE_BLOCK, the
 *    block surface BlockDetailsPanel reads must have status 'completed'.
 * 2. The complete-state transformation must NOT strip canonical lane / master
 *    plan / artifact / evidence context. Specifically materializeBlocksFromEvents
 *    rebuilds state.today.blocks and state.cycle from events; canonical context
 *    must survive that rebuild (event-derived blocks or merge-from-blockStore).
 */

function buildHardAnchorPostActivationState() {
  const cycleId = 'cycle-hard-anchor-complete';
  const masterPlanId = 'plan-operation-endgame';
  const dayKey = '2026-06-22';
  const hardAnchorBlock = {
    id: 'p-hard-anchor-complete',
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

describe('COMPLETE_BLOCK on first activated calendar block', () => {
  it('marks the activated block as completed, NOT missed', () => {
    const activated = applyAndActivate(buildHardAnchorPostActivationState());
    const activatedBlock = findHardAnchorBlock(getCanonicalBlocks(activated));
    expect(activatedBlock).toBeTruthy();
    expect(activatedBlock.status).toBe('planned');

    const completed = computeDerivedState(activated, {
      type: 'COMPLETE_BLOCK',
      id: activatedBlock.id,
    });

    const completedCanonical = findHardAnchorBlock(getCanonicalBlocks(completed));
    expect(completedCanonical?.status).toBe('completed');

    const completedTodayBlock = findHardAnchorBlock(completed.today?.blocks || []);
    if (completedTodayBlock) {
      expect(completedTodayBlock.status).toBe('completed');
      expect(completedTodayBlock.status).not.toBe('missed');
    }

    const completedAnywhere = findHardAnchorBlock(getAllBlocks(completed));
    expect(completedAnywhere?.status).toBe('completed');
    expect(completedAnywhere?.status).not.toBe('missed');
  });

  it('preserves canonical lane / master plan / artifact context after COMPLETE_BLOCK', () => {
    const activated = applyAndActivate(buildHardAnchorPostActivationState());
    const activatedBlock = findHardAnchorBlock(getCanonicalBlocks(activated));
    expect(activatedBlock).toBeTruthy();

    const completed = computeDerivedState(activated, {
      type: 'COMPLETE_BLOCK',
      id: activatedBlock.id,
    });

    // The block read by BlockDetailsPanel (today.blocks / cycle / blockStore)
    // must still carry canonical identity context after COMPLETE.
    const completedTodayBlock = findHardAnchorBlock(completed.today?.blocks || []);
    const completedCycleBlock = findHardAnchorBlock(
      (completed.cycle || []).flatMap((d) => d.blocks || [])
    );
    const completedCanonical = findHardAnchorBlock(getCanonicalBlocks(completed));

    [completedTodayBlock, completedCycleBlock, completedCanonical].forEach((block) => {
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

  it('still passes BlockDetailsPanel detail-authority after COMPLETE_BLOCK', () => {
    const activated = applyAndActivate(buildHardAnchorPostActivationState());
    const activatedBlock = findHardAnchorBlock(getCanonicalBlocks(activated));
    const completed = computeDerivedState(activated, {
      type: 'COMPLETE_BLOCK',
      id: activatedBlock.id,
    });

    // The block surface BlockDetailsPanel reads from (selectedDayBlocks ←
    // state.today.blocks / cycle days). Any of these must satisfy the
    // detail-authority gate.
    const subjectBlocks = [
      findHardAnchorBlock(completed.today?.blocks || []),
      findHardAnchorBlock((completed.cycle || []).flatMap((d) => d.blocks || [])),
      findHardAnchorBlock(getCanonicalBlocks(completed)),
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
