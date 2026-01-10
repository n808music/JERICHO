import { nowDayKey } from '../time/time.ts';

export type GoalStatus = 'draft' | 'active' | 'degraded' | 'invalidated' | 'achieved';

export type MetricType = 'binary' | 'threshold' | 'cumulative' | 'comparative';

export type ValidationMethod = 'user_attest' | 'system_derived' | 'external_import';

export type DomainName = 'Body' | 'Focus' | 'Creation' | 'Resources';

export type SuccessCondition = {
  metricType: MetricType;
  metricName: string;
  targetValue: number | boolean;
  validationMethod: ValidationMethod;
};

export type ExecutionRequirements = {
  requiredDomains: DomainName[];
  minimumCadencePerDomain: Record<DomainName, number>;
  expectedDomainMix: Record<DomainName, number>;
  maxAllowedVariance: number;
};

export type GoalExecutionContract = {
  goalId: string;
  status: GoalStatus;
  activationDateISO: string;
  deadlineISO: string;
  success: SuccessCondition[];
  requirements: ExecutionRequirements;
  lastCompiledAtISO?: string;
};

export type GovernanceTimeHorizon = 'day' | 'week' | 'month';

export type GoalGovernanceContract = {
  contractId: string;
  version: 1;
  goalId: string;
  activeFromISO?: string;
  activeUntilISO?: string;
  scope: {
    domainsAllowed: DomainName[];
    timeHorizon: GovernanceTimeHorizon;
    timezone: string;
  };
  governance: {
    suggestionsEnabled: boolean;
    probabilityEnabled: boolean;
    minEvidenceEvents: number;
    cooldowns?: {
      resuggestMinutes?: number;
      maxSuggestionsPerDay?: number;
    };
  };
  constraints?: {
    forbiddenDirectives?: string[];
    requiredCadence?: Record<DomainName, number>;
    maxActiveBlocks?: number;
  };
};

const DOMAIN_KEYS: DomainName[] = ['Body', 'Focus', 'Creation', 'Resources'];

const EPSILON = 0.0001;

export function validateGoalContractForActivation(contract: GoalExecutionContract, nowISO: string = nowDayKey()) {
  const errors: string[] = [];
  if (!contract.success || contract.success.length < 1) {
    errors.push('success:missing');
  }
  if (!contract.deadlineISO || contract.deadlineISO <= nowISO) {
    errors.push('deadline:invalid');
  }
  const mixErrors = validateExecutionRequirements(contract.requirements);
  errors.push(...mixErrors);
  return {
    valid: errors.length === 0,
    errors
  };
}

export function activateGoalContract(contract: GoalExecutionContract, nowISO: string = nowDayKey()) {
  const validation = validateGoalContractForActivation(contract, nowISO);
  if (!validation.valid) {
    return { contract: { ...contract, status: 'draft' }, errors: validation.errors };
  }
  return { contract: { ...contract, status: 'active' }, errors: [] };
}

export function deriveGoalStatus(
  contract: GoalExecutionContract,
  {
    nowISO = nowDayKey(),
    successMet = false,
    degrade = false
  }: { nowISO?: string; successMet?: boolean; degrade?: boolean } = {}
) {
  if (contract.deadlineISO && contract.deadlineISO < nowISO) return 'invalidated';
  if (successMet && contract.status === 'active') return 'achieved';
  if (degrade && contract.status === 'active') return 'degraded';
  return contract.status;
}

function validateExecutionRequirements(requirements: ExecutionRequirements) {
  const errors: string[] = [];
  if (!requirements) {
    return ['requirements:missing'];
  }
  const mix = requirements.expectedDomainMix || ({} as Record<DomainName, number>);
  const cadence = requirements.minimumCadencePerDomain || ({} as Record<DomainName, number>);
  let sum = 0;
  (requirements.requiredDomains || []).forEach((entry) => {
    if (!DOMAIN_KEYS.includes(entry)) errors.push(`required:invalid:${entry}`);
  });
  DOMAIN_KEYS.forEach((key) => {
    const mixVal = Number(mix[key]);
    const cadenceVal = Number(cadence[key]);
    if (!Number.isFinite(mixVal) || mixVal < 0) errors.push(`mix:invalid:${key}`);
    if (!Number.isFinite(cadenceVal) || cadenceVal < 0) errors.push(`cadence:invalid:${key}`);
    sum += Number.isFinite(mixVal) ? mixVal : 0;
  });
  if (Math.abs(sum - 1) > EPSILON) errors.push('mix:sum');
  if (!Number.isFinite(requirements.maxAllowedVariance) || requirements.maxAllowedVariance < 0 || requirements.maxAllowedVariance > 1) {
    errors.push('variance:invalid');
  }
  return errors;
}
