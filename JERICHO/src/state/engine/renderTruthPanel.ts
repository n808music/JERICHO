type TruthPanelViewModel = {
  goalId: string;
  nowISO: string;
  sections: {
    feasibility: {
      status: 'FEASIBLE' | 'REQUIRED' | 'INFEASIBLE';
      remainingBlocksTotal: number;
      workableDaysRemaining: number;
      requiredBlocksPerDay: number | null;
      requiredBlocksToday: number | null;
      completedBlocksToday: number;
      delta?: {
        blocksShort?: number;
        extraBlocksPerDayNeeded?: number;
      };
      reasons: string[];
    };
    guidance: {
      hasDirective: boolean;
      directive?: {
        title: string;
        workItemId: string;
      };
      enabled: boolean | null;
      reasons: string[];
    };
    probabilityEligibility: {
      status: 'disabled' | 'insufficient_evidence' | 'eligible';
      requiredEvents: number | null;
      evidenceSummary?: {
        totalEvents: number;
        completedCount: number;
        daysCovered: number;
      };
      reasons: string[];
    };
  };
  errors?: Array<{
    code: 'MISSING_ENGINE_ARTIFACT' | 'UNKNOWN_GOAL';
    fields?: string[];
  }>;
};

export function renderTruthPanel(state: any, nowISO: string): TruthPanelViewModel {
  const goalId = resolveGoalId(state);
  const errors: TruthPanelViewModel['errors'] = [];

  if (!goalId) {
    return {
      goalId: '',
      nowISO,
      sections: {
        feasibility: emptyFeasibility(),
        guidance: emptyGuidance(),
        probabilityEligibility: emptyProbability()
      },
      errors: [{ code: 'UNKNOWN_GOAL' }]
    };
  }

  const missingFields: string[] = [];
  const feasibilityByGoal = state?.feasibilityByGoal || null;
  const directiveEligibilityByGoal = state?.directiveEligibilityByGoal || null;
  const probabilityStatusByGoal = state?.probabilityStatusByGoal || null;

  const feasibility = feasibilityByGoal?.[goalId];
  const eligibility = directiveEligibilityByGoal?.[goalId];
  const probability = probabilityStatusByGoal?.[goalId];

  if (!feasibilityByGoal || !feasibility) missingFields.push('feasibilityByGoal');
  if (!directiveEligibilityByGoal || !eligibility) missingFields.push('directiveEligibilityByGoal');
  if (!probabilityStatusByGoal || !probability) missingFields.push('probabilityStatusByGoal');

  if (missingFields.length) {
    errors.push({ code: 'MISSING_ENGINE_ARTIFACT', fields: missingFields });
  }

  const directive = state?.goalDirective && state.goalDirective.goalId === goalId ? state.goalDirective : null;

  const guidanceSection = directive
    ? {
        hasDirective: true,
        directive: {
          title: directive.title || directive.workItemId || directive.blockId || 'Directive',
          workItemId: directive.workItemId || directive.blockId || directive.title || ''
        },
        enabled: eligibility ? Boolean(eligibility.allowed) : null,
        reasons: eligibility && !eligibility.allowed ? eligibility.reasons || [] : []
      }
    : {
        hasDirective: false,
        enabled: null,
        reasons: []
      };

  const probabilitySection = probability
    ? {
        status: probability.status === 'computed' ? 'eligible' : probability.status,
        requiredEvents: Number.isFinite(probability.requiredEvents) ? probability.requiredEvents : null,
        evidenceSummary: probability.evidenceSummary,
        reasons: probability.reasons || []
      }
    : emptyProbability();

  const feasibilitySection = feasibility
    ? {
        status: feasibility.status,
        remainingBlocksTotal: feasibility.remainingBlocksTotal,
        workableDaysRemaining: feasibility.workableDaysRemaining,
        requiredBlocksPerDay: feasibility.requiredBlocksPerDay,
        requiredBlocksToday: feasibility.requiredBlocksToday,
        completedBlocksToday: feasibility.completedBlocksToday,
        delta: feasibility.delta,
        reasons: feasibility.reasons || []
      }
    : emptyFeasibility();

  return {
    goalId,
    nowISO,
    sections: {
      feasibility: feasibilitySection,
      guidance: guidanceSection,
      probabilityEligibility: probabilitySection
    },
    errors: errors.length ? errors : undefined
  };
}

function resolveGoalId(state: any) {
  if (state?.activeGoalId) return state.activeGoalId;
  if (state?.goalDirective?.goalId) return state.goalDirective.goalId;
  if (state?.activeCycleId && state?.cyclesById?.[state.activeCycleId]?.goalGovernanceContract?.goalId) {
    return state.cyclesById[state.activeCycleId].goalGovernanceContract.goalId;
  }
  const keys = Object.keys(state?.feasibilityByGoal || {});
  return keys.length ? keys.sort()[0] : null;
}

function emptyFeasibility(): TruthPanelViewModel['sections']['feasibility'] {
  return {
    status: 'INFEASIBLE',
    remainingBlocksTotal: 0,
    workableDaysRemaining: 0,
    requiredBlocksPerDay: null,
    requiredBlocksToday: null,
    completedBlocksToday: 0,
    delta: {},
    reasons: []
  };
}

function emptyGuidance(): TruthPanelViewModel['sections']['guidance'] {
  return {
    hasDirective: false,
    enabled: null,
    reasons: []
  };
}

function emptyProbability(): TruthPanelViewModel['sections']['probabilityEligibility'] {
  return {
    status: 'disabled',
    requiredEvents: null,
    reasons: []
  };
}
