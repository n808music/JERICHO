import { describe, expect, it } from 'vitest';

import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
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
});
