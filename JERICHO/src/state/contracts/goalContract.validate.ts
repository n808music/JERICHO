import type { DomainName, GoalGovernanceContract } from './goalContract.ts';

export type GovernanceReasonCode =
  | 'inactive'
  | 'no_active_contract'
  | 'domain_not_allowed'
  | 'no_directive'
  | 'suggestions_disabled'
  | 'probability_disabled'
  | 'insufficient_evidence'
  | 'cooldown'
  | 'daily_limit'
  | 'forbidden_directive'
  | 'max_active_blocks'
  | 'cadence_missing'
  | 'invalid_contract';

const DOMAIN_KEYS: DomainName[] = ['Body', 'Focus', 'Creation', 'Resources'];

export function validateContract(contract: GoalGovernanceContract) {
  const errors: string[] = [];
  if (!contract) return { valid: false, errors: ['missing'] };
  if (contract.version !== 1) errors.push('version');
  if (!contract.contractId) errors.push('contractId');
  if (!contract.goalId) errors.push('goalId');
  if (!contract.scope?.timezone) errors.push('timezone');
  if (!contract.scope?.timeHorizon) errors.push('timeHorizon');
  const allowed = contract.scope?.domainsAllowed || [];
  allowed.forEach((d) => {
    if (!DOMAIN_KEYS.includes(d)) errors.push(`domain:${d}`);
  });
  if (!Number.isFinite(contract.governance?.minEvidenceEvents) || contract.governance.minEvidenceEvents < 0) {
    errors.push('minEvidenceEvents');
  }
  return { valid: errors.length === 0, errors };
}

export function isContractActive(contract: GoalGovernanceContract, nowISO: string) {
  if (!contract) return false;
  if (contract.activeFromISO && nowISO < contract.activeFromISO) return false;
  if (contract.activeUntilISO && nowISO > contract.activeUntilISO) return false;
  return true;
}

export function authorizeSuggestion(
  contract: GoalGovernanceContract | null | undefined,
  context: {
    nowISO: string;
    nowTimestampISO?: string;
    executionEventCount: number;
    activeBlocksCount: number;
    lastSuggestedAtISO?: string | null;
    suggestionsTodayCount?: number;
    directiveTags?: string[];
    directiveDomain?: string | null;
    cadenceMet?: boolean;
  }
) {
  const reasons: GovernanceReasonCode[] = [];
  if (!contract || !isContractActive(contract, context.nowISO)) reasons.push('inactive');
  if (contract && !contract.governance.suggestionsEnabled) reasons.push('suggestions_disabled');
  if (contract && contract.governance.minEvidenceEvents > 0 && context.executionEventCount < contract.governance.minEvidenceEvents) {
    reasons.push('insufficient_evidence');
  }
  if (contract?.constraints?.maxActiveBlocks && context.activeBlocksCount >= contract.constraints.maxActiveBlocks) {
    reasons.push('max_active_blocks');
  }
  if (contract?.constraints?.requiredCadence && context.cadenceMet === false) {
    reasons.push('cadence_missing');
  }
  const cooldowns = contract?.governance?.cooldowns;
  if (cooldowns?.resuggestMinutes && context.lastSuggestedAtISO) {
    const lastMs = Date.parse(context.lastSuggestedAtISO);
    const nowMs = Date.parse(context.nowTimestampISO || context.nowISO);
    if (Number.isFinite(lastMs) && Number.isFinite(nowMs)) {
      let diffMin = (nowMs - lastMs) / 60000;
      if (diffMin < 0) diffMin = 0;
      if (diffMin < cooldowns.resuggestMinutes) reasons.push('cooldown');
    }
  }
  if (cooldowns?.maxSuggestionsPerDay && (context.suggestionsTodayCount || 0) >= cooldowns.maxSuggestionsPerDay) {
    reasons.push('daily_limit');
  }
  const forbidden = new Set(contract?.constraints?.forbiddenDirectives || []);
  const tags = context.directiveTags || [];
  if (tags.some((tag) => forbidden.has(tag))) reasons.push('forbidden_directive');
  const allowedDomains = new Set(contract?.scope?.domainsAllowed || []);
  if (context.directiveDomain && allowedDomains.size && !allowedDomains.has(context.directiveDomain as any)) {
    reasons.push('domain_not_allowed');
  }

  return { allowed: reasons.length === 0, reasons };
}

export function authorizeProbability(
  contract: GoalGovernanceContract | null | undefined,
  context: {
    nowISO: string;
    executionEventCount: number;
  }
) {
  const reasons: GovernanceReasonCode[] = [];
  if (!contract || !isContractActive(contract, context.nowISO)) reasons.push('inactive');
  if (contract && contract.governance.minEvidenceEvents > 0 && context.executionEventCount < contract.governance.minEvidenceEvents) {
    reasons.push('insufficient_evidence');
  }
  return { allowed: reasons.length === 0, reasons };
}
