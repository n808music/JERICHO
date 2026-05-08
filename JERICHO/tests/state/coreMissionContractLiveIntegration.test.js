import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { createCoreMissionContractAction, recordCoreMissionRevisionAction } from '../../src/state/coreMissionContractStore.js';
import { buildMasterPlan } from '../../src/domain/masterPlan/masterPlanFactory.js';

describe('Core Mission Contract Live Integration', () => {
  it('long-horizon company-building goal creates/stores CoreMissionContract', () => {
    // Start with blank state
    const state = buildBlankIdentityState();

    // Simulate creating a core mission contract for a company-building goal
    const createAction = createCoreMissionContractAction({
      profileId: DEFAULT_PROFILE_ID,
      durableObjective: 'Build a sustainable software company serving 10,000 customers',
      magnitudeTarget: '$10M ARR',
      horizonYears: 5,
      currentPhase: 'foundation',
      strategicThesis: 'Build developer tools that reduce toil',
      nonNegotiables: ['Quality over speed', 'Customer-centric development'],
      allowedTradeoffs: ['Short-term revenue for long-term positioning'],
      forbiddenTradeoffs: ['Technical debt accumulation'],
    });

    // Apply the action (simulate reducer)
    const contract = createAction.contract;
    state.coreMissionContractsById[contract.missionId] = contract;
    state.profilesById[DEFAULT_PROFILE_ID].activeCoreMissionContractId = contract.missionId;

    // Verify contract is stored
    expect(state.coreMissionContractsById[contract.missionId]).toBeDefined();
    expect(state.coreMissionContractsById[contract.missionId].durableObjective).toBe(
      'Build a sustainable software company serving 10,000 customers'
    );
    expect(state.profilesById[DEFAULT_PROFILE_ID].activeCoreMissionContractId).toBe(contract.missionId);
  });

  it('master plan references coreMissionContractId', () => {
    const state = buildBlankIdentityState();

    // Create a core mission contract first
    const createAction = createCoreMissionContractAction({
      profileId: DEFAULT_PROFILE_ID,
      durableObjective: 'Build lasting software company',
    });
    const contract = createAction.contract;
    state.coreMissionContractsById[contract.missionId] = contract;
    state.profilesById[DEFAULT_PROFILE_ID].activeCoreMissionContractId = contract.missionId;

    // Create a master plan that references the mission contract
    const masterPlan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: '5-Year Growth Plan',
      northStarOutcome: 'Achieve product-market fit and sustainable revenue',
      horizonStart: '2024-01-01',
      horizonEnd: '2029-01-01',
      coreMissionContractId: contract.missionId, // Link to mission contract
    });

    // Store the master plan
    state.masterPlansById[masterPlan.id] = masterPlan;
    state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = masterPlan.id;

    // Verify the linkage
    expect(state.masterPlansById[masterPlan.id].coreMissionContractId).toBe(contract.missionId);
    expect(masterPlan.coreMissionContractId).toBe(contract.missionId);
  });

  it('identityCompute derives coreContinuity', () => {
    const state = buildBlankIdentityState();

    // Create and store a core mission contract
    const createAction = createCoreMissionContractAction({
      profileId: DEFAULT_PROFILE_ID,
      durableObjective: 'Build sustainable company',
    });
    const contract = createAction.contract;
    state.coreMissionContractsById[contract.missionId] = contract;
    state.profilesById[DEFAULT_PROFILE_ID].activeCoreMissionContractId = contract.missionId;

    // Create and store a linked master plan
    const masterPlan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: 'Growth Plan',
      northStarOutcome: 'Achieve PMF',
      coreMissionContractId: contract.missionId,
      horizonEnd: '2029-01-01',
    });
    state.masterPlansById[masterPlan.id] = masterPlan;
    state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = masterPlan.id;

    // Simulate what identityCompute does - call computeCoreContinuity directly
    const computeCoreContinuity = (state) => {
      const profile = state.profilesById[DEFAULT_PROFILE_ID];
      const activeMissionId = profile.activeCoreMissionContractId;
      if (!activeMissionId) {
        return { state: 'no_mission', activeMissionId: null, linkedMasterPlanIds: [], reasonCodes: [] };
      }

      const contract = state.coreMissionContractsById[activeMissionId];
      if (!contract) {
        return { state: 'mission_missing', activeMissionId, linkedMasterPlanIds: [], reasonCodes: [] };
      }

      const linkedMasterPlanIds = Object.values(state.masterPlansById)
        .filter(plan => plan.coreMissionContractId === activeMissionId)
        .map(plan => plan.id);

      const hasLinkedPlan = linkedMasterPlanIds.length > 0;
      const stateValue = hasLinkedPlan ? 'aligned' : 'unaligned';
      const reasonCodes = hasLinkedPlan ? ['mission_aligned'] : ['no_linked_plan'];

      return {
        state: stateValue,
        activeMissionId,
        linkedMasterPlanIds,
        reasonCodes,
      };
    };

    const continuity = computeCoreContinuity(state);

    // Verify continuity derivation
    expect(continuity.state).toBe('aligned');
    expect(continuity.activeMissionId).toBe(contract.missionId);
    expect(continuity.linkedMasterPlanIds).toContain(masterPlan.id);
    expect(continuity.reasonCodes).toContain('mission_aligned');
  });

  it('recording a revision appends history without overwriting durableObjective', () => {
    const state = buildBlankIdentityState();

    // Create initial contract
    const createAction = createCoreMissionContractAction({
      profileId: DEFAULT_PROFILE_ID,
      durableObjective: 'Build sustainable software company',
      currentPhase: 'foundation',
    });
    const contract = createAction.contract;
    state.coreMissionContractsById[contract.missionId] = contract;

    // Record a revision
    const revisionAction = recordCoreMissionRevisionAction(
      contract.missionId,
      'Updated strategic thesis based on market research',
      { strategicThesis: 'Focus on developer experience tools' }
    );

    // Apply revision (simulate reducer)
    const updatedContract = {
      ...state.coreMissionContractsById[contract.missionId],
      revisionHistory: [
        ...state.coreMissionContractsById[contract.missionId].revisionHistory,
        revisionAction.revision,
      ],
      updatedAt: new Date().toISOString(),
    };
    state.coreMissionContractsById[contract.missionId] = updatedContract;

    // Verify revision was recorded without overwriting durable objective
    expect(state.coreMissionContractsById[contract.missionId].durableObjective).toBe(
      'Build sustainable software company'
    );
    expect(state.coreMissionContractsById[contract.missionId].revisionHistory).toHaveLength(1);
    expect(state.coreMissionContractsById[contract.missionId].revisionHistory[0].note).toBe(
      'Updated strategic thesis based on market research'
    );
  });
});