// ─── Core Mission Contract State Slice ────────────────────────────────────────
// Manages Core Mission Contract lifecycle in canonical identity state.
// Core Mission Contracts are the highest layer: durable life-scale objectives
// above changing master plans and execution cycles.

import { useCallback } from 'react';
import { createMinimalCoreMissionContract } from '../domain/core/CoreMissionContractMinimal';

// Private string constants — used internally to keep switch and action creators in sync.
const AC_CREATED  = 'CORE_MISSION_CONTRACT_CREATED';
const AC_UPDATED  = 'CORE_MISSION_CONTRACT_UPDATED';
const AC_REVISION = 'CORE_MISSION_REVISION_RECORDED';

// Set export — used by identityStore reducer guard (.has() requires a Set, not a plain object).
export const CORE_MISSION_CONTRACT_ACTION_TYPES = new Set([AC_CREATED, AC_UPDATED, AC_REVISION]);

// ─── State slice initializer ──────────────────────────────────────────────────
// Spread the return value into buildBlankIdentityState's blankState object.

export function buildCoreMissionContractStateFields() {
  return {
    coreMissionContractsById: {},
  };
}

// ─── Profile field management ────────────────────────────────────────────────

export function ensureCoreMissionContractProfileFields(profile) {
  if (!profile) {return;}
  if (!('activeCoreMissionContractId' in profile)) {
    profile.activeCoreMissionContractId = null;
  }
}

// ─── Action handlers ─────────────────────────────────────────────────────────

export function applyCoreMissionContractAction(draft, action) {
  switch (action.type) {
    case AC_CREATED: {
      const contract = action.contract;
      draft.coreMissionContractsById[contract.missionId] = contract;
      if (contract.profileId && draft.profilesById[contract.profileId]) {
        draft.profilesById[contract.profileId].activeCoreMissionContractId = contract.missionId;
      }
      break;
    }

    case AC_UPDATED: {
      const { missionId, updates } = action;
      if (draft.coreMissionContractsById[missionId]) {
        draft.coreMissionContractsById[missionId] = {
          ...draft.coreMissionContractsById[missionId],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      }
      break;
    }

    case AC_REVISION: {
      const { missionId, revision } = action;
      const contract = draft.coreMissionContractsById[missionId];
      if (contract) {
        // Only revisionHistory and updatedAt change — durableObjective is never touched.
        draft.coreMissionContractsById[missionId] = {
          ...contract,
          revisionHistory: [...(contract.revisionHistory || []), revision],
          updatedAt: new Date().toISOString(),
        };
      }
      break;
    }

    default:
      break;
  }
}

// ─── Action creators ─────────────────────────────────────────────────────────

export function createCoreMissionContractAction(params) {
  const contract = createMinimalCoreMissionContract(params);
  return { type: AC_CREATED, contract };
}

export function updateCoreMissionContractAction(missionId, updates) {
  return { type: AC_UPDATED, missionId, updates };
}

export function recordCoreMissionRevisionAction(missionId, note, changes = {}) {
  return {
    type: AC_REVISION,
    missionId,
    revision: { timestamp: new Date().toISOString(), note, changes },
  };
}

// ─── Hook for actions ─────────────────────────────────────────────────────────
// Accepts dispatch so returned functions actually reach the reducer.
// Pattern mirrors useMasterPlanActions(dispatch) in masterPlanStore.js.

export function useCoreMissionContractActions(dispatch) {
  const createCoreMissionContract = useCallback(
    (params) => dispatch(createCoreMissionContractAction(params)),
    [dispatch]
  );

  const updateCoreMissionContract = useCallback(
    (missionId, updates) => dispatch(updateCoreMissionContractAction(missionId, updates)),
    [dispatch]
  );

  const recordCoreMissionRevision = useCallback(
    (missionId, note, changes) => dispatch(recordCoreMissionRevisionAction(missionId, note, changes)),
    [dispatch]
  );

  return { createCoreMissionContract, updateCoreMissionContract, recordCoreMissionRevision };
}
