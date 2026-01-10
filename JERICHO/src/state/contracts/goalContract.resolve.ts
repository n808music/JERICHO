import type { GoalGovernanceContract } from './goalContract.ts';

export type ActiveContractResolution = {
  contract: GoalGovernanceContract | null;
  reasonCode: 'none' | 'no_match' | 'inactive' | 'multiple_active';
};

export function resolveActiveContract(
  goalId: string,
  contracts: GoalGovernanceContract[] = [],
  nowISO: string
): ActiveContractResolution {
  const matching = (contracts || []).filter((c) => c && c.goalId === goalId);
  if (!matching.length) return { contract: null, reasonCode: 'no_match' };
  const active = matching.filter((c) => {
    if (c.activeFromISO && nowISO < c.activeFromISO) return false;
    if (c.activeUntilISO && nowISO > c.activeUntilISO) return false;
    return true;
  });
  if (!active.length) return { contract: null, reasonCode: 'inactive' };
  const sorted = [...active].sort((a, b) => {
    if (a.version !== b.version) return b.version - a.version;
    return a.contractId.localeCompare(b.contractId);
  });
  return {
    contract: sorted[0],
    reasonCode: active.length > 1 ? 'multiple_active' : 'none'
  };
}
