import { describe, expect, it } from 'vitest';

import { buildBlankIdentityState, DEFAULT_PROFILE_ID, identityReducer, rehydratePersistedState } from '../../src/state/identityStore.js';
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
      step_2: 'Build and coordinate Operation Endgame through a multi-lane master plan',
      step_3: { horizonEnd: '2026-11-01', months: 6, label: 'Oct 17' },
      step_5: { exists: true, urgency: 'high', notes: 'Need capacity clarity and near-term revenue.' },
      step_6: 'Ownership and execution discipline cannot slip.',
      lane_0_description: 'Album assets exist and release prep is underway.',
      lane_0_system_assessment: {
        assessedStage: 'ready-to-launch',
        assessedConfidence: 'high',
        assessmentNotes: 'Creative lane is launch-adjacent.',
      },
      lane_0_activation: 'active',
      lane_0_clarifying_0: 'masters and artwork are in progress',
      lane_1_description: '7 months into development, core architecture working.',
      lane_1_system_assessment: {
        assessedStage: 'in-development',
        assessedConfidence: 'high',
        assessmentNotes: 'Product lane is mid-build.',
      },
      lane_1_activation: 'active',
      lane_1_clarifying_0: 'local app works but beta gate still needs definition',
    },
    extractedLanes: [
      { title: 'Album rollout', domain: 'creative', role: 'proof-artifact' },
      { title: 'App launch', domain: 'product', role: 'revenue-engine' },
    ],
    anchors: [
      {
        id: 'anchor-oct17',
        date: '2026-10-17',
        label: 'Oct 17 launch target',
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
  applyMasterPlanAction(state, {
    type: 'MASTER_PLAN_INTAKE_COMPLETE',
    nowISO: '2026-05-04T12:00:00.000Z',
  });
  return computeDerivedState(state, { type: 'NO_OP' });
}

describe('master-plan cycle lifecycle semantics', () => {
  function saveWorkWindows(state, cycleId) {
    return computeDerivedState(state, {
      type: 'UPDATE_WORK_WINDOWS',
      payload: {
        cycleId,
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
  }

  it('creates an active executable cycle shell without generating a schedule', () => {
    const established = buildIntakeDraftState();
    const planId = established.masterPlanIntake.draft.masterPlanId;

    expect(established.activeCycleId).toBeNull();
    expect(established.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId).toBe(planId);

    const started = computeDerivedState(established, {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });

    expect(started.activeCycleId).toBe(`masterplan-cycle:${planId}`);
    expect(started.activeGoalId).toBe(`masterplan:${planId}`);
    expect(started.cyclesById[started.activeCycleId].masterPlanId).toBe(planId);
    expect(started.cyclesById[started.activeCycleId].status).toBe('active');
    expect(started.cyclesById[started.activeCycleId].reassessmentStatus).toBe('required');
    expect(started.cyclesById[started.activeCycleId].goalContract.activePhaseScheduleEndDayKey).toBe('2026-10-17');
    expect(started.cyclesById[started.activeCycleId].goalContract.fullHorizonEndDayKey).toBe('2026-11-01');
    expect(started.cyclesById[started.activeCycleId].goalContract.endDayKey).toBe('2026-10-17');
    expect(started.scheduleLifecycle).toBe('no_schedule');
    expect(started.scheduleLifecycleState).toBe('inter_cycle');
    expect(started.cyclesById[started.activeCycleId].scheduleLifecycle).toBe('no_schedule');
    expect(started.proposedBlocks).toHaveLength(0);
    expect(started.scheduleReviewBlocks).toHaveLength(0);
  });

  it('requires current-state reassessment before schedule generation', () => {
    const established = buildIntakeDraftState();
    const planId = established.masterPlanIntake.draft.masterPlanId;
    const started = computeDerivedState(established, {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });

    const blocked = computeDerivedState(started, {
      type: 'GENERATE_PLAN',
      payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
    });

    expect(blocked.lastPlanError?.code).toBe('CURRENT_STATE_REASSESSMENT_REQUIRED');
    expect(blocked.scheduleLifecycle).toBe('no_schedule');
    expect(blocked.scheduleLifecycleState).toBe('inter_cycle');
    expect(blocked.proposedBlocks).toHaveLength(0);
  });

  it('archives the active cycle but preserves the established master plan', () => {
    const established = buildIntakeDraftState();
    const planId = established.masterPlanIntake.draft.masterPlanId;
    const started = computeDerivedState(established, {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });
    const cycleId = started.activeCycleId;

    const archived = computeDerivedState(started, { type: 'END_CYCLE', cycleId });

    expect(archived.activeCycleId).toBeNull();
    expect(archived.activeGoalId).toBeNull();
    expect(archived.goalExecutionContract).toBeNull();
    expect(archived.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId).toBe(planId);
    expect(archived.masterPlansById[planId]).toBeDefined();
    expect(archived.cyclesById[cycleId].status).toBe('ended');
    expect(archived.scheduleLifecycle).toBe('no_schedule');
    expect(archived.scheduleLifecycleState).toBe('inter_cycle');
  });

  it('resets the active cycle execution state without removing the cycle shell or master plan', () => {
    const established = buildIntakeDraftState();
    const planId = established.masterPlanIntake.draft.masterPlanId;
    const started = computeDerivedState(established, {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });
    const reassessed = computeDerivedState(started, {
      type: 'COMPLETE_CYCLE_REASSESSMENT',
      cycleId: started.activeCycleId,
    });
    const constrained = saveWorkWindows(reassessed, reassessed.activeCycleId);
    const generated = computeDerivedState(constrained, {
      type: 'GENERATE_PLAN',
      payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
    });
    const cycleId = generated.activeCycleId;
    const applied = computeDerivedState(generated, { type: 'APPLY_PLAN' });

    expect(applied.scheduleLifecycle).toBe('applied_review');
    expect(applied.scheduleReviewBlocks.length).toBeGreaterThan(0);

    const reset = computeDerivedState(applied, { type: 'RESET_ACTIVE_CYCLE', cycleId });

    expect(reset.activeCycleId).toBe(cycleId);
    expect(reset.cyclesById[cycleId]).toBeDefined();
    expect(reset.cyclesById[cycleId].masterPlanId).toBe(planId);
    expect(reset.scheduleLifecycle).toBe('no_schedule');
    expect(reset.scheduleLifecycleState).toBe('inter_cycle');
    expect(reset.cyclesById[cycleId].scheduleLifecycle).toBe('no_schedule');
    expect(reset.cyclesById[cycleId].reassessmentStatus).toBe('required');
    expect(reset.proposedBlocks).toHaveLength(0);
    expect(reset.scheduleReviewBlocks).toHaveLength(0);
    expect(reset.executionEvents).toHaveLength(0);
    expect(reset.masterPlansById[planId]).toBeDefined();
  });

  it('deletes only the active cycle and does not restore it on rehydration', () => {
    const established = buildIntakeDraftState();
    const planId = established.masterPlanIntake.draft.masterPlanId;
    const started = computeDerivedState(established, {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });
    const cycleId = started.activeCycleId;

    const expanded = computeDerivedState(started, { type: 'SET_SELECTED_HORIZON_MODE', mode: 'full_horizon' });
    const deleted = computeDerivedState(expanded, { type: 'DELETE_CYCLE', cycleId });
    const rehydrated = rehydratePersistedState(JSON.parse(JSON.stringify(deleted)));

    expect(deleted.activeCycleId).toBeNull();
    expect(deleted.scheduleLifecycleState).toBe('inter_cycle');
    expect(deleted.selectedHorizonMode).toBe('current_cycle');
    expect(deleted.calendarDisplayBlocks).toEqual([]);
    expect(deleted.masterPlansById[planId]).toBeDefined();
    expect(deleted.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId).toBe(planId);
    expect(deleted.cyclesById[cycleId]).toBeUndefined();
    expect(rehydrated.activeCycleId).toBeNull();
    expect(rehydrated.scheduleLifecycleState).toBe('inter_cycle');
    expect(rehydrated.selectedHorizonMode).toBe('current_cycle');
    expect(rehydrated.calendarDisplayBlocks).toEqual([]);
    expect(rehydrated.cyclesById[cycleId]).toBeUndefined();
    expect(rehydrated.masterPlansById[planId]).toBeDefined();
  });

  it('reset identity clears master plan, cycle, and persisted ownership lineage', () => {
    const established = buildIntakeDraftState();
    const planId = established.masterPlanIntake.draft.masterPlanId;
    const started = computeDerivedState(established, {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });
    const reassessed = computeDerivedState(started, {
      type: 'COMPLETE_CYCLE_REASSESSMENT',
      cycleId: started.activeCycleId,
    });
    const constrained = saveWorkWindows(reassessed, reassessed.activeCycleId);
    const generated = computeDerivedState(constrained, {
      type: 'GENERATE_PLAN',
      payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
    });

    const reset = identityReducer(generated, { type: 'RESET_IDENTITY' });
    const rehydrated = rehydratePersistedState(JSON.parse(JSON.stringify(reset)));

    expect(reset.activeCycleId).toBeNull();
    expect(reset.activeGoalId).toBeNull();
    expect(reset.masterPlansById).toEqual({});
    expect(reset.masterPlanLanesById).toEqual({});
    expect(reset.masterPlanMilestonesById).toEqual({});
    expect(reset.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId).toBeNull();
    expect(reset.profilesById[DEFAULT_PROFILE_ID].masterPlanIds).toEqual([]);
    expect(rehydrated.masterPlansById).toEqual({});
    expect(rehydrated.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId).toBeNull();
    expect(rehydrated.activeCycleId).toBeNull();
  });
});
