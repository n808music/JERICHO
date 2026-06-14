import { describe, expect, it } from 'vitest';

import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';
import { extractLanesFromDescription } from '../../src/domain/masterPlan/masterPlanIntakeEngine.js';

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
      expect.arrayContaining([
        'Submit distribution package for EP release',
        'Finalize artwork for EP release',
        'Release EP to distribution',
      ])
    );
    expect(creativeMilestones.every((m) => m.derivedFrom.includes('anchorId:anchor-oct17'))).toBe(true);
    expect(creativeMilestones.every((m) => m.flex && m.milestoneType && typeof m.missConsequence === 'string')).toBe(true);

    expect(brandMilestones.map((m) => m.title)).toEqual(
      expect.arrayContaining([
        'Define Global State Solutions client outreach position',
        'Build Global State Solutions prospect outreach list',
        'Close first Global State Solutions client contract',
      ])
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

  it('extracts core mission, outcome target, and success standard separately for named empire-scale goals', () => {
    const draft = buildIntakeDraftState();
    const goalText =
      'Build and execute Operation Endgame: a five-year push coordinating the Jericho app, album release, podcast support campaign, project-management brand, record label, production company, real-estate campaign, private school, and district revitalization.';
    draft.masterPlanIntake.answers.step_1 = goalText;
    draft.masterPlanIntake.extractedLanes = extractLanesFromDescription(goalText);
    draft.masterPlanIntake.answers.step_2 =
      'Build and execute Operation Endgame: a five-year push toward net worth of $3.5B through a coordinated company and media ecosystem.';

    const handled = applyMasterPlanAction(draft, {
      type: 'MASTER_PLAN_INTAKE_COMPLETE',
      nowISO: '2026-05-04T12:00:00.000Z',
    });

    expect(handled).toBe(true);

    const planId = draft.masterPlanIntake.draft.masterPlanId;
    const plan = draft.masterPlansById[planId];
    const next = computeDerivedState(draft, { type: 'NO_OP' });
    const goalPolicy = next.masterPlansById[planId]?.policyState?.goalPolicy;

    expect(plan.title).toBe('Operation Endgame');
    expect(plan.coreMission).toBe('Operation Endgame');
    expect(plan.outcomeTarget).toMatch(/\$3\.5B/i);
    expect(plan.successStandard).toMatch(/revenue architecture/i);
    expect(plan.successStandard).toMatch(/operating cadence/i);
    expect(plan.controllabilityClass).toBe('externally_mediated');
    expect(plan.terminalTargetClass).toBe('valuation_dependent');
    expect(plan.goalArchitecture).toBe('integrated_master_plan');
    expect(plan.primaryLane).toBe('product');
    expect(plan.laneComposition).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ domain: 'product' }),
        expect.objectContaining({ domain: 'creative' }),
        expect.objectContaining({ domain: 'media' }),
        expect.objectContaining({ domain: 'capital' }),
        expect.objectContaining({ domain: 'institution' }),
        expect.objectContaining({ domain: 'civic' }),
      ])
    );
    expect(goalPolicy.feasibility.reasonCodes).toEqual(expect.arrayContaining(['FEASIBILITY_UNCERTAINTY_BURDEN_HIGH']));
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

  it('preserves derived diagnostic reason codes from answered master-plan questions', () => {
    const draft = buildIntakeDraftState();
    draft.masterPlanIntake.answers.step_5 = 'About 18 hours a week, with admin and interview burden taking some of it.';
    draft.masterPlanIntake.answers.step_6 =
      'We will collect payments and user data, use contractors, and the app is still local-only with no deployed URL.';
    draft.masterPlanIntake.answers.lane_1_clarifying_0 =
      'There is a working local version, but no deployed URL, refresh loses progress, and only I have tested it.';

    const handled = applyMasterPlanAction(draft, {
      type: 'MASTER_PLAN_INTAKE_COMPLETE',
      nowISO: '2026-05-04T12:00:00.000Z',
    });

    expect(handled).toBe(true);

    const next = computeDerivedState(draft, { type: 'NO_OP' });
    const planId = next.masterPlanIntake.draft.masterPlanId;
    const plan = next.masterPlansById[planId];

    expect(plan.structureCritic.derivedReasonCodes).toEqual(
      expect.arrayContaining([
        'APP_DEPLOYMENT_MISSING',
        'APP_PERSISTENCE_UNPROVEN',
        'USER_TESTING_MISSING',
        'LEGAL_REVIEW_REQUIRED',
        'PRIVACY_POLICY_REQUIRED',
        'CONTRACT_STRUCTURE_REQUIRED',
      ])
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
    draft.masterPlansById[planId].structureCritic = {
      ...(draft.masterPlansById[planId].structureCritic || {}),
      deferredQuestions: [
        {
          question: 'What cannot be sacrificed if timing slips?',
          domain: 'core_mission',
          criticality: 'medium',
          reason: 'Tradeoff protection must become executable.',
          resolvesField: 'mission.nonNegotiables',
        },
        {
          question: 'What must stay true for the hard anchor dates to remain real?',
          domain: 'master_calendar',
          criticality: 'medium',
          reason: 'Anchor protection must be operationalized.',
          resolvesField: 'anchor.protectionRules',
        },
      ],
    };
    const started = computeDerivedState(draft, {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });
    expect(started.activeCycleId).toBe(`masterplan-cycle:${planId}`);
    expect(started.cyclesById[started.activeCycleId].reassessmentStatus).toBe('required');

    const reassessed = computeDerivedState(started, {
      type: 'COMPLETE_CYCLE_REASSESSMENT',
      cycleId: started.activeCycleId,
    });
    const constrained = computeDerivedState(reassessed, {
      type: 'UPDATE_WORK_WINDOWS',
      payload: {
        cycleId: reassessed.activeCycleId,
        workWindows: {
          mon: [{ start: '09:00', end: '12:00' }],
          tue: [{ start: '09:00', end: '12:00' }],
          wed: [{ start: '09:00', end: '12:00' }],
          thu: [{ start: '09:00', end: '12:00' }],
          fri: [{ start: '09:00', end: '12:00' }],
          sat: [],
          sun: [],
        },
      },
    });

    const generated = computeDerivedState(constrained, {
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
    expect(generated.proposedBlocks.every((block) => block.profileId === DEFAULT_PROFILE_ID)).toBe(true);
    expect(generated.proposedBlocks.every((block) => block.owner === 'Local Profile')).toBe(true);
    expect(
      generated.proposedBlocks.every((block) => block.masterCalendarId === `calendar-${DEFAULT_PROFILE_ID}`)
    ).toBe(true);
    expect(generated.proposedBlocks.every((block) => block.masterPlanId === planId)).toBe(true);
    expect(
      generated.proposedBlocks.some(
        (block) => block.masterPlanMilestoneId && block.masterPlanLaneId && block.source === 'master_plan_first_cycle'
      )
    ).toBe(true);
    expect(generated.masterPlansById[planId].structureCritic.deferredQuestions.length).toBeGreaterThan(0);
    expect(generated.proposedBlocks.every((block) => !String(block.title || '').includes('?'))).toBe(true);
    expect(
      generated.proposedBlocks.every(
        (block) => !/^(what|why|how|when|where|which|do|does|can|should|will)\b/i.test(String(block.title || '').trim())
      )
    ).toBe(true);
    const generatedTitles = generated.proposedBlocks.map((block) => block.title);
    expect(generatedTitles).toEqual(
      expect.arrayContaining([
        'Validate Operation Endgame hard-anchor protection rules',
        'Document album, app, and podcast launch asset inventory',
        'Validate first-cycle milestone dependency sequence',
        'Map job-search and income demands against the execution calendar',
        'Prepare EP distribution metadata package',
        'Finalize EP artwork delivery package',
        'Prepare Global State Solutions contract conversion path',
        'Define Global State Solutions client outreach position',
        'Build Global State Solutions prospect outreach list',
        'Close first Global State Solutions client contract',
      ])
    );
    expect(generatedTitles.filter((title) => title === 'Submit distribution package for EP release')).toHaveLength(1);
    expect(generatedTitles).not.toEqual(
      expect.arrayContaining([
        'Confirm Operation Endgame hard anchors',
        'Audit existing album, app, and podcast assets',
        'Complete inventory album, app, and podcast launch assets',
        'Review first-cycle milestone sequence',
        'Identify job-search/income calendar burden',
        'Review PM company outreach and positioning progress',
        'Complete positioning for PM company',
        'Activate outreach for PM company',
        'Close first client or contract for PM company',
      ])
    );
    expect(generated.cyclesById[generated.activeCycleId].autoAsanaPlan.summary.scheduledBlockCount).toBe(
      generated.proposedBlocks.length
    );
    expect(generated.cyclesById[generated.activeCycleId].autoAsanaPlan.summary.requiredBlockCount).toBeGreaterThanOrEqual(
      generated.proposedBlocks.length
    );
    expect(generated.cyclesById[generated.activeCycleId].goalContract.activePhaseScheduleEndDayKey).toBe('2026-10-17');
    expect(generated.cyclesById[generated.activeCycleId].autoAsanaPlan.summary.activePhaseDeadlineDayKey).toBe('2026-10-17');
    expect(generated.cyclesById[generated.activeCycleId].autoAsanaPlan.summary.coverageStatus).toBe('complete_to_anchor');
    expect(generated.cyclesById[generated.activeCycleId].autoAsanaPlan.summary.calendarCoverageThroughDayKey >= '2026-10-16').toBe(
      true
    );
    expect(generated.cyclesById[generated.activeCycleId].planQualityGate?.failureCodes || []).toEqual([
      'BLOCK_DETAIL_TOO_ABSTRACT',
      'BLOCK_DETAIL_DO_THIS_EMPTY',
      'BLOCK_DETAIL_DONE_WHEN_EMPTY',
    ]);

    const applied = computeDerivedState(generated, { type: 'APPLY_PLAN' });
    expect(applied.scheduleLifecycle).toBe('applied_review');
    expect(applied.scheduleReviewBlocks.length).toBeGreaterThan(0);
  });
});
