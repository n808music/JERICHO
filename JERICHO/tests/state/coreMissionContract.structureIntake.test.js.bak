import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';
import { createCoreMissionContractAction } from '../../src/state/coreMissionContractStore.js';
import { requiresCoreMissionContract } from '../../src/domain/goal/planningTierClassifier.ts';

// ─── requiresCoreMissionContract ─────────────────────────────────────────────

describe('requiresCoreMissionContract', () => {
  it('returns true for master_plan tier', () => {
    expect(requiresCoreMissionContract('master_plan', 'Build a company')).toBe(true);
  });

  it('returns false for long_term_complex tier (EP-scale goal)', () => {
    expect(requiresCoreMissionContract('long_term_complex', 'Launch my EP by October')).toBe(false);
  });

  it('returns false for short_term_simple tier', () => {
    expect(requiresCoreMissionContract('short_term_simple', 'Finish mixing three tracks this week')).toBe(false);
  });

  it('returns false for long_term_simple tier', () => {
    expect(requiresCoreMissionContract('long_term_simple', 'Get 1000 followers in six months')).toBe(false);
  });

  it('returns false for short_term_complex tier', () => {
    expect(requiresCoreMissionContract('short_term_complex', 'Launch a podcast with distribution setup')).toBe(false);
  });
});

// ─── applyIntakeComplete links to active Core Mission ─────────────────────────

function buildIntakeDraft(profileId = DEFAULT_PROFILE_ID) {
  const state = buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: '2026-05-04T12:00:00.000Z',
    todayDate: '2026-05-04',
  });
  state.masterPlanIntake = {
    status: 'in-progress',
    phase: 4,
    step: 13,
    profileId,
    answers: {
      step_2: 'Build a multi-venture platform reaching 10,000 users',
      step_3: { horizonEnd: '2029-01-01', months: 32 },
      step_5: null,
      lane_0_description: 'Music label in development.',
      lane_0_system_assessment: { assessedStage: 'in-development', assessedConfidence: 'medium', assessmentNotes: '' },
      lane_0_activation: 'active',
    },
    extractedLanes: [{ title: 'Music label', domain: 'creative', role: 'proof-artifact' }],
    anchors: [],
    currentLaneIdx: 0,
    clarifyingQuestionIdx: 0,
    draft: null,
    errorMessage: null,
  };
  return state;
}

describe('applyIntakeComplete — Core Mission linking', () => {
  it('links plan.coreMissionContractId to existing active mission when one is present', () => {
    const state = buildIntakeDraft();

    // Simulate: Structure intake already created the mission via onPlanningTierRouted
    const createAction = createCoreMissionContractAction({
      profileId: DEFAULT_PROFILE_ID,
      durableObjective: 'Build a multi-venture platform reaching 10,000 users',
      currentPhase: 'foundation',
      horizonYears: 3,
    });
    const contract = createAction.contract;
    state.coreMissionContractsById[contract.missionId] = contract;
    state.profilesById[DEFAULT_PROFILE_ID].activeCoreMissionContractId = contract.missionId;

    applyMasterPlanAction(state, {
      type: 'MASTER_PLAN_INTAKE_COMPLETE',
      nowISO: '2026-05-04T12:00:00.000Z',
    });

    const planId = state.masterPlanIntake.draft.masterPlanId;
    const plan = state.masterPlansById[planId];
    expect(plan.coreMissionContractId).toBe(contract.missionId);
  });

  it('does not set coreMissionContractId when no active mission exists', () => {
    const state = buildIntakeDraft();
    // No mission created — EP-scale goal scenario

    applyMasterPlanAction(state, {
      type: 'MASTER_PLAN_INTAKE_COMPLETE',
      nowISO: '2026-05-04T12:00:00.000Z',
    });

    const planId = state.masterPlanIntake.draft.masterPlanId;
    const plan = state.masterPlansById[planId];
    expect(plan.coreMissionContractId).toBeFalsy();
  });

  it('does not create a second Core Mission Contract when intake completes with an existing mission', () => {
    const state = buildIntakeDraft();

    const createAction = createCoreMissionContractAction({
      profileId: DEFAULT_PROFILE_ID,
      durableObjective: 'Build a multi-venture platform',
      currentPhase: 'foundation',
    });
    const contract = createAction.contract;
    state.coreMissionContractsById[contract.missionId] = contract;
    state.profilesById[DEFAULT_PROFILE_ID].activeCoreMissionContractId = contract.missionId;

    const contractCountBefore = Object.keys(state.coreMissionContractsById).length;

    applyMasterPlanAction(state, {
      type: 'MASTER_PLAN_INTAKE_COMPLETE',
      nowISO: '2026-05-04T12:00:00.000Z',
    });

    const contractCountAfter = Object.keys(state.coreMissionContractsById).length;
    expect(contractCountAfter).toBe(contractCountBefore);
  });

  it('durableObjective is preserved after intake completes and plan is linked', () => {
    const state = buildIntakeDraft();
    const DURABLE = 'Build a multi-venture platform reaching 10,000 users';

    const createAction = createCoreMissionContractAction({
      profileId: DEFAULT_PROFILE_ID,
      durableObjective: DURABLE,
      currentPhase: 'foundation',
    });
    const contract = createAction.contract;
    state.coreMissionContractsById[contract.missionId] = contract;
    state.profilesById[DEFAULT_PROFILE_ID].activeCoreMissionContractId = contract.missionId;

    applyMasterPlanAction(state, {
      type: 'MASTER_PLAN_INTAKE_COMPLETE',
      nowISO: '2026-05-04T12:00:00.000Z',
    });

    // durableObjective must not be overwritten by intake completion
    expect(state.coreMissionContractsById[contract.missionId].durableObjective).toBe(DURABLE);
  });
});
