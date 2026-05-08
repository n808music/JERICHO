import { describe, expect, it } from 'vitest';

import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';

function buildIntakeDraftState() {
  const state = buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: '2026-05-04T12:00:00.000Z',
    todayDate: '2026-05-04',
  });
  state.masterPlanIntake = {
    status: 'in-progress',
    phase: 4,
    step: 13,
    profileId: DEFAULT_PROFILE_ID,
    answers: {
      step_2: 'Release the EP and grow the PM company',
      step_3: { horizonEnd: '2026-11-01', months: 6, label: 'Oct 17' },
      step_5: { exists: true, urgency: 'immediate', notes: 'Need revenue this year.' },
      lane_0_description: 'Album is ready to launch with final masters complete.',
      lane_0_system_assessment: {
        assessedStage: 'ready-to-launch',
        assessedConfidence: 'high',
        assessmentNotes: 'Ready for release.',
      },
      lane_0_activation: 'active',
      lane_1_description: 'Starting from scratch on positioning and client outreach.',
      lane_1_system_assessment: {
        assessedStage: 'pre-concept',
        assessedConfidence: 'medium',
        assessmentNotes: 'Early lane.',
      },
      lane_1_activation: 'incubating',
    },
    extractedLanes: [
      {
        title: 'EP release',
        domain: 'creative',
        role: 'proof-artifact',
      },
      {
        title: 'PM company',
        domain: 'brand',
        role: 'revenue-engine',
      },
    ],
    anchors: [
      {
        id: 'anchor-oct17',
        date: '2026-10-17',
        label: 'Oct 17 drop',
        isFixed: true,
        affectedLaneIds: [],
        priority: 0,
      },
    ],
    currentLaneIdx: 0,
    clarifyingQuestionIdx: 0,
    draft: null,
    errorMessage: null,
  };
  return state;
}

describe('masterPlanStore intake completion', () => {
  it('persists generated milestones into masterPlanMilestonesById and links them to lanes', () => {
    const draft = buildIntakeDraftState();

    const handled = applyMasterPlanAction(draft, {
      type: 'MASTER_PLAN_INTAKE_COMPLETE',
      nowISO: '2026-05-04T12:00:00.000Z',
    });

    expect(handled).toBe(true);
    expect(draft.masterPlanIntake.status).toBe('complete');

    const planId = draft.masterPlanIntake.draft.masterPlanId;
    const plan = draft.masterPlansById[planId];
    expect(plan).toBeDefined();
    expect(plan.laneIds).toHaveLength(2);

    const creativeLane = plan.laneIds
      .map((id) => draft.masterPlanLanesById[id])
      .find((lane) => lane.domain === 'creative');
    const brandLane = plan.laneIds
      .map((id) => draft.masterPlanLanesById[id])
      .find((lane) => lane.domain === 'brand');

    expect(creativeLane.anchorIds).toEqual(['anchor-oct17']);
    expect(creativeLane.milestoneIds.length).toBeGreaterThan(0);
    expect(brandLane.anchorIds).toEqual([]);
    expect(brandLane.milestoneIds.length).toBeGreaterThan(0);

    const creativeMilestones = creativeLane.milestoneIds.map((id) => draft.masterPlanMilestonesById[id]);
    const brandMilestones = brandLane.milestoneIds.map((id) => draft.masterPlanMilestonesById[id]);

    expect(creativeMilestones.map((m) => m.title)).toEqual(
      expect.arrayContaining(['Distribution submitted', 'Artwork finalized', 'DROP'])
    );
    expect(creativeMilestones.every((m) => m.derivedFrom.includes('anchorId:anchor-oct17'))).toBe(true);
    expect(creativeMilestones.every((m) => m.flex && m.milestoneType && typeof m.missConsequence === 'string')).toBe(true);

    expect(brandMilestones.map((m) => m.title)).toEqual(
      expect.arrayContaining(['Positioning complete', 'Outreach started', 'First client or contract closed'])
    );
    expect(brandMilestones.every((m) => m.derivedFrom.startsWith('forward from today + '))).toBe(true);
    expect(brandMilestones.every((m) => m.targetDate >= '2026-05-18')).toBe(true);
  });

  it('produces canonical master-plan policy with initial feasibility while keeping Live P.O.S. withheld', () => {
    const draft = buildIntakeDraftState();

    const handled = applyMasterPlanAction(draft, {
      type: 'MASTER_PLAN_INTAKE_COMPLETE',
      nowISO: '2026-05-04T12:00:00.000Z',
    });

    expect(handled).toBe(true);

    const next = computeDerivedState(draft, { type: 'NO_OP' });
    const planId = next.masterPlanIntake.draft.masterPlanId;
    const plan = next.masterPlansById[planId];
    const goalPolicy = plan?.policyState?.goalPolicy;

    expect(goalPolicy).toBeDefined();
    expect(next.masterPlanPolicyByPlanId[planId]).toEqual(goalPolicy);
    expect(goalPolicy.feasibility).toBeDefined();
    expect(goalPolicy.feasibility.state).not.toBe('withheld');
    expect(goalPolicy.feasibility.percent).toEqual(expect.any(Number));
    expect(goalPolicy.livePos.state).toBe('withheld');
    expect(goalPolicy.livePos.reasonCodes).toContain('LIVE_POS_WITHHELD_SCHEDULE_NOT_LIVE');
  });

  it('marks unresolved critical structure answers as assumption debt in the master-plan policy substrate', () => {
    const draft = buildIntakeDraftState();
    draft.masterPlanIntake.answers.step_5 = 'not sure yet';
    draft.masterPlanIntake.answers.step_6 = 'ownership and execution discipline cannot slip';
    draft.masterPlanIntake.answers.lane_0_clarifying_0 = 'unknown';
    draft.masterPlanIntake.answers.lane_1_clarifying_0 = 'need first client revenue quickly';

    const handled = applyMasterPlanAction(draft, {
      type: 'MASTER_PLAN_INTAKE_COMPLETE',
      nowISO: '2026-05-04T12:00:00.000Z',
    });

    expect(handled).toBe(true);

    const next = computeDerivedState(draft, { type: 'NO_OP' });
    const planId = next.masterPlanIntake.draft.masterPlanId;
    const plan = next.masterPlansById[planId];
    const goalPolicy = plan?.policyState?.goalPolicy;

    expect(plan.structureCritic.unresolvedReasonCodes).toEqual(
      expect.arrayContaining(['STRUCTURE_WEEKLY_CAPACITY_UNRESOLVED', 'STRUCTURE_CREATIVE_ASSET_STATE_UNRESOLVED'])
    );
    expect(goalPolicy.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(goalPolicy.scopeClassification.assumedBaselineSupporting).toEqual(
      expect.arrayContaining(['STRUCTURE_WEEKLY_CAPACITY_UNRESOLVED', 'STRUCTURE_CREATIVE_ASSET_STATE_UNRESOLVED'])
    );
  });

  it('bridges a finalized master plan into a first operational cycle with proposed schedule blocks', () => {
    const draft = buildIntakeDraftState();

    const handled = applyMasterPlanAction(draft, {
      type: 'MASTER_PLAN_INTAKE_COMPLETE',
      nowISO: '2026-05-04T12:00:00.000Z',
    });

    expect(handled).toBe(true);

    const planId = draft.masterPlanIntake.draft.masterPlanId;
    const generated = computeDerivedState(draft, {
      type: 'GENERATE_PLAN',
      payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
    });

    expect(generated.activeCycleId).toBe(`masterplan-cycle:${planId}`);
    expect(generated.activeGoalId).toBe(`masterplan:${planId}`);
    expect(generated.scheduleLifecycle).toBe('draft_schedule_ready');
    expect(generated.pendingPlanConfirmation).toBe(true);
    expect(generated.scheduleApplied).toBe(false);
    expect(generated.lastPlanError).toBe(null);
    expect(generated.proposedBlocks.length).toBeGreaterThan(0);
    expect(generated.proposedBlocks.length).toBeLessThanOrEqual(8);
    expect(generated.proposedBlocks.every((block) => block.profileId === DEFAULT_PROFILE_ID)).toBe(true);
    expect(
      generated.proposedBlocks.every((block) => block.masterCalendarId === `calendar-${DEFAULT_PROFILE_ID}`)
    ).toBe(true);
    expect(generated.proposedBlocks.every((block) => block.masterPlanId === planId)).toBe(true);
    expect(
      generated.proposedBlocks.some(
        (block) => block.masterPlanMilestoneId && block.masterPlanLaneId && block.source === 'master_plan_first_cycle'
      )
    ).toBe(true);

    const applied = computeDerivedState(generated, { type: 'APPLY_PLAN' });
    expect(applied.scheduleLifecycle).toBe('applied_review');
    expect(applied.scheduleReviewBlocks.length).toBeGreaterThan(0);
  });
});
