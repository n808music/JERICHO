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
      { title: 'EP release', domain: 'creative', role: 'proof-artifact' },
      { title: 'PM company', domain: 'brand', role: 'revenue-engine' },
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

describe('TMP title dump', () => {
  it('dumps all generated first-cycle titles', () => {
    const draft = buildIntakeDraftState();
    applyMasterPlanAction(draft, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO: '2026-05-04T12:00:00.000Z' });
    const planId = draft.masterPlanIntake.draft.masterPlanId;
    const started = computeDerivedState(draft, {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });
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
    const applied = computeDerivedState(generated, { type: 'APPLY_PLAN' });

    const gate = applied.cyclesById[applied.activeCycleId]?.planQualityGate;
    console.log('\n=== GATE STATUS ===');
    console.log('Status:', gate?.status);
    console.log('Codes:', JSON.stringify(gate?.failureCodes || [], null, 2));

    console.log('\n=== ALL FIRST-CYCLE BLOCK TITLES ===');
    applied.scheduleReviewBlocks.forEach((b, i) => {
      const ms = b.masterPlanMilestoneId ? ' [MILESTONE]' : '';
      console.log(`  ${String(i + 1).padStart(2)}. ${b.title}${ms}`);
    });

    expect(applied.scheduleReviewBlocks.length).toBeGreaterThan(0);
  });
});
