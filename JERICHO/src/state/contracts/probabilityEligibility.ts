import { resolveActiveContract } from './goalContract.resolve.ts';
import { authorizeProbability } from './goalContract.validate.ts';

export type ProbabilityStatus = 'disabled' | 'insufficient_evidence' | 'computed';

export type ProbabilityEligibilityResult = {
  status: ProbabilityStatus;
  reasons: string[];
  contractId: string | null;
  requiredEvents: number;
  evidenceSummary: {
    totalEvents: number;
    completedCount: number;
    daysCovered: number;
  };
};

export function deriveProbabilityStatus({
  goalId,
  nowISO,
  executionEventCount,
  contracts,
  executionEvents = []
}: {
  goalId: string;
  nowISO: string;
  executionEventCount: number;
  contracts: Array<{ goalId: string; contractId: string; version: number; activeFromISO?: string; activeUntilISO?: string; scope: any; governance: any }>;
  executionEvents?: Array<{ dateISO?: string; completed?: boolean }>;
}): ProbabilityEligibilityResult {
  const evidenceSummary = buildEvidenceSummary(executionEvents);
  const resolution = resolveActiveContract(goalId, contracts as any, nowISO);
  const requiredEvents = resolution.contract?.governance?.minEvidenceEvents || 0;
  if (!resolution.contract) {
    return {
      status: 'disabled',
      reasons: [resolution.reasonCode],
      contractId: null,
      requiredEvents,
      evidenceSummary
    };
  }

  const gate = authorizeProbability(resolution.contract as any, {
    nowISO,
    executionEventCount
  });
  if (!gate.allowed) {
    const status = gate.reasons.includes('inactive')
      ? 'disabled'
      : gate.reasons.includes('insufficient_evidence')
      ? 'insufficient_evidence'
      : 'disabled';
    return {
      status,
      reasons: gate.reasons,
      contractId: resolution.contract.contractId,
      requiredEvents,
      evidenceSummary
    };
  }

  return {
    status: 'computed',
    reasons: [],
    contractId: resolution.contract.contractId,
    requiredEvents,
    evidenceSummary
  };
}

function buildEvidenceSummary(events: Array<{ dateISO?: string; completed?: boolean }>) {
  const totalEvents = (events || []).length;
  const completedCount = (events || []).filter((e) => e?.completed).length;
  const dayKeys = new Set((events || []).map((e) => e?.dateISO).filter(Boolean));
  return {
    totalEvents,
    completedCount,
    daysCovered: dayKeys.size
  };
}
