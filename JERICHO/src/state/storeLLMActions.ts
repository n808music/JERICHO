/**
 * storeLLMActions.ts
 * Async store action layer for LLM-powered plan generation.
 *
 * Sits in the same layer as store.applyDraftSchedule() and store.generatePlan().
 * Keeps reducers pure — all async work happens here, results dispatched in.
 */

// DEV — uses mock, no API key needed:
import { callClaudeForActionGraph, callClaudeForSessionPlan } from './mockLLMActionGraph';
// PROD — real API call:
// import { callClaudeForActionGraph } from './llmActionGraph';
import { LLM_CALL_PROFILES } from './llmActionGraph';
import { getCanonicalCycleContract } from './cycleSelectors.js';
import { buildGoalIntakeContract, getIntakeGateCode } from '../domain/goal/GoalIntakeContract.ts';
import { planQualityAudit, addBusinessDays } from '../domain/goal/planQualityAudit';
import { deriveFeasibility } from '../domain/feasibility/feasibilityDerivation';

type GoalDraftV2 = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Execution types that use the LLM path
// ---------------------------------------------------------------------------

const LLM_EXECUTION_TYPES = new Set([
  'VentureLaunch',
  'SkillAcquisition',
  'ProfessionalQualification',
  'PhysicalTraining',
  'JobSearchPipeline',
  'CreativeProduction',
  'BrandLaunch',
  'SalesPipeline',
  'Fundraising',
  'GenericStructured',
]);
const SKIP_API_KEY_CHECK = true; // set false when real API key is present

type DependencyType = 'hard_gate' | 'directional' | 'informational';

function inferExecutionTypeFromPlanningIntake(planningIntake: Record<string, unknown> | null): string | null {
  const goalClassification = String(planningIntake?.goalClassification || '')
    .trim()
    .toLowerCase();
  if (goalClassification === 'regulated_physical_consumable') {
    return 'BrandLaunch';
  }
  return null;
}

function applyRecoveredFeasibilityPivot(
  planningIntake: Record<string, unknown> | null,
  contract: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!planningIntake) {
    return planningIntake;
  }
  const goalClassification = String(planningIntake.goalClassification || '')
    .trim()
    .toLowerCase();
  if (goalClassification !== 'regulated_physical_consumable') {
    return planningIntake;
  }

  const selectedPivot = String(contract?.selectedFeasibilityPivot || '')
    .trim()
    .toLowerCase();
  const capitalAvailable = Number(planningIntake.capitalAvailable || 0);
  const spotifyListeners = Number(
    (planningIntake.capitalAcquisitionAssets as Record<string, unknown> | undefined)?.existingAudience?.spotifyListeners || 0
  );
  const revenueAllocationPossible =
    (planningIntake.capitalAcquisitionAssets as Record<string, unknown> | undefined)?.existingRevenue
      ?.allocationToPossible === true;
  const hasAcquisitionPath = spotifyListeners >= 1000 || revenueAllocationPossible;

  if (
    selectedPivot === 'white_label_lower_capital' ||
    selectedPivot === 'white_label_pivot' ||
    selectedPivot === 'crowdfund_first' ||
    selectedPivot === 'crowdfund_pivot' ||
    selectedPivot === 'phased_research_only'
  ) {
    return {
      ...planningIntake,
      formulaPathway:
        planningIntake.formulaPathway && String(planningIntake.formulaPathway).trim() !== 'undecided'
          ? planningIntake.formulaPathway
          : 'white_label',
      capitalAcquisitionRequired: true,
    };
  }

  if (capitalAvailable === 0 && hasAcquisitionPath) {
    return {
      ...planningIntake,
      formulaPathway:
        planningIntake.formulaPathway && String(planningIntake.formulaPathway).trim() !== 'undecided'
          ? planningIntake.formulaPathway
          : 'white_label',
      capitalAcquisitionRequired: true,
    };
  }

  return planningIntake;
}

function synthesizeGoalDraftV2(
  cycle: Record<string, unknown> | null,
  contract: Record<string, unknown> | null,
  fallbackState: Record<string, unknown>,
  input: { anchorDayKey?: string | null } = {}
): GoalDraftV2 | null {
  const planningIntake =
    (contract?.planningIntake as Record<string, unknown> | null) ||
    (contract?.goalIntakeContract as Record<string, unknown> | null)?.planningIntake ||
    ((fallbackState?.goalExecutionContract as Record<string, unknown> | undefined)?.planningIntake as
      | Record<string, unknown>
      | null) ||
    null;
  const goalText =
    String(
      contract?.goalText ||
        contract?.goalLabel ||
        (contract?.terminalOutcome as Record<string, unknown> | undefined)?.text ||
        cycle?.definiteGoal?.outcome ||
        (fallbackState?.goalExecutionContract as Record<string, unknown> | undefined)?.goalText ||
        (planningIntake as Record<string, unknown> | null)?.goalDescription ||
        ''
    ).trim() || null;
  const executionType =
    String(
      inferExecutionTypeFromPlanningIntake(planningIntake) ||
        contract?.executionType ||
        (fallbackState?.goalExecutionContract as Record<string, unknown> | undefined)?.executionType ||
        (cycle as Record<string, unknown> | null)?.goalDraftV2?.executionType ||
        ''
    ).trim() ||
    null;
  const startDate =
    String(
      contract?.startDayKey ||
        contract?.startDateISO ||
        contract?.startDate ||
        cycle?.startedAtDayKey ||
        cycle?.goalGovernanceContract?.activeFromISO ||
        (fallbackState?.goalExecutionContract as Record<string, unknown> | undefined)?.startDayKey ||
        input?.anchorDayKey ||
        (fallbackState?.appTime as Record<string, unknown> | undefined)?.activeDayKey ||
        ''
    )
      .trim()
      .slice(0, 10) || null;

  if (!goalText || !executionType) {
    return null;
  }

  return {
    goalLabel: goalText,
    goalText,
    executionType,
    ...(startDate ? { startDate } : {}),
    ...(planningIntake ? { answeredContext: planningIntake } : {}),
  };
}

function classifyContractSource(
  cycle: Record<string, unknown> | null,
  state: Record<string, unknown>
): 'canonical' | 'mirror' | 'adapter' | 'none' {
  if (cycle?.goalContract) {
    return 'canonical';
  }
  if ((state?.goalExecutionContract as Record<string, unknown> | undefined)?.goalId) {
    return 'mirror';
  }
  if (cycle?.contract) {
    return 'adapter';
  }
  return 'none';
}

function normalizeDependencyType(value: unknown): DependencyType | null {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'hard_gate' || normalized === 'hard-gate' || normalized === 'hard') {
    return 'hard_gate';
  }
  if (normalized === 'directional' || normalized === 'soft') {
    return 'directional';
  }
  if (normalized === 'informational' || normalized === 'info') {
    return 'informational';
  }
  return null;
}

function classifyBrandLaunchDependencyType(action: Record<string, unknown>, dependencyId: string): DependencyType {
  const actionId = String(action?.id || '').trim();
  const actionType = String(action?.actionType || '').trim().toLowerCase();
  const depId = String(dependencyId || '').trim();

  if (!actionId || !depId) {
    return 'hard_gate';
  }

  if (depId.startsWith('brand:00:')) {
    if (actionId.startsWith('brand:01:')) {
      return 'hard_gate';
    }
    if (actionId.startsWith('brand:02:') || actionId.startsWith('brand:03:')) {
      if (depId.startsWith('brand:00:05:') || depId.startsWith('brand:00:04:') || depId.startsWith('brand:00:01:')) {
        return 'directional';
      }
      return 'informational';
    }
    if (actionId.startsWith('brand:04:') || actionId.startsWith('brand:05:')) {
      if (depId.startsWith('brand:00:05:') || depId.startsWith('brand:00:04:')) {
        return 'directional';
      }
      return 'informational';
    }
  }

  if ((actionId.startsWith('brand:02:') || actionId.startsWith('brand:03:')) && depId.startsWith('brand:01:')) {
    return 'directional';
  }
  if (actionId.startsWith('brand:03:') && depId.startsWith('brand:02:')) {
    return 'directional';
  }
  if (actionType === 'execution' && (depId.startsWith('brand:02:') || depId.startsWith('brand:03:'))) {
    return 'directional';
  }

  return 'hard_gate';
}

function normalizeTypedDependenciesForActions(actions: unknown[], executionType: string) {
  return (Array.isArray(actions) ? actions : []).map((action) => {
    if (!action || typeof action !== 'object') {
      return action;
    }
    const typedAction = action as Record<string, unknown>;
    const dependencies = Array.isArray(typedAction.dependencies)
      ? typedAction.dependencies.map((dependency) => String(dependency || '').trim()).filter(Boolean)
      : [];
    const rawDetails = Array.isArray(typedAction.dependencyDetails) ? typedAction.dependencyDetails : [];
    const detailById = new Map<string, { actionId: string; dependencyType: DependencyType }>();

    rawDetails.forEach((detail) => {
      const detailRecord = detail as Record<string, unknown>;
      const actionId = String(detailRecord?.actionId || detailRecord?.dependencyId || detailRecord?.id || '').trim();
      if (!actionId) {
        return;
      }
      detailById.set(actionId, {
        actionId,
        dependencyType:
          normalizeDependencyType(detailRecord?.dependencyType) ||
          (executionType === 'BrandLaunch'
            ? classifyBrandLaunchDependencyType(typedAction, actionId)
            : 'hard_gate'),
      });
    });

    dependencies.forEach((dependencyId) => {
      if (!detailById.has(dependencyId)) {
        detailById.set(dependencyId, {
          actionId: dependencyId,
          dependencyType:
            executionType === 'BrandLaunch'
              ? classifyBrandLaunchDependencyType(typedAction, dependencyId)
              : 'hard_gate',
        });
      }
    });

    return {
      ...typedAction,
      dependencies,
      dependencyDetails: dependencies
        .map((dependencyId) => detailById.get(dependencyId))
        .filter((detail): detail is { actionId: string; dependencyType: DependencyType } => Boolean(detail)),
    };
  });
}

// ---------------------------------------------------------------------------
// Store action — call this from UI instead of store.generatePlan()
// for all typed execution types
// ---------------------------------------------------------------------------

/**
 * store.generatePlanWithLLM(cycleId?)
 *
 * 1. Reads goalDraftV2 + contract from current state
 * 2. Dispatches GENERATE_PLAN_STARTED (shows spinner)
 * 3. Calls Claude API with execution-type-specific prompt
 * 4. Dispatches GENERATE_PLAN_WITH_ACTIONS (success) or GENERATE_PLAN_FAILED (error)
 * 5. On success, triggers REBUILD_SCHEDULE to populate draft cache
 */
export function createGeneratePlanWithLLM(store: JerichoStore) {
  return async function generatePlanWithLLM(
    input: {
      cycleId?: string | null;
      anchorDayKey?: string | null;
      // Role A — confirmed intake answers from the Intake Drafting Assistant.
      // These are passed here only after explicit user confirmation in the UI.
      // No agent output reaches this field automatically.
      answeredContext?: Record<string, unknown> | null;
    } = {}
  ): Promise<void> {
    try {
      // eslint-disable-next-line no-console
      console.log('[LLM] generatePlanWithLLM entered', { cycleId: input?.cycleId ?? null });
      // eslint-disable-next-line no-console
      console.log('[LLM] step 1 - resolving state');
      const state = store.getState() || {};
      // eslint-disable-next-line no-console
      console.log('[LLM] step 2 - state resolved', { activeCycleId: state?.activeCycleId });
      const resolvedCycleId = input?.cycleId ?? state.activeCycleId;
      const cycle = resolvedCycleId ? state.cyclesById?.[resolvedCycleId] : null;
      // eslint-disable-next-line no-console
      console.log('[LLM] step 3 - cycle', { found: !!cycle, resolvedCycleId });

      if (!cycle) {
        store.dispatch({
          type: 'GENERATE_PLAN_FAILED',
          payload: {
            cycleId: resolvedCycleId,
            error: { code: 'CYCLE_NOT_FOUND', reason: 'No active cycle found for plan generation.' },
          },
        });
        return;
      }

      const canonicalContract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
      const contract = canonicalContract || {};
      const executionType =
        inferExecutionTypeFromPlanningIntake(
          (contract?.planningIntake as Record<string, unknown> | undefined) ||
            ((contract?.goalIntakeContract as Record<string, unknown> | undefined)?.planningIntake as
              | Record<string, unknown>
              | undefined) ||
            ((state.goalExecutionContract as Record<string, unknown> | undefined)?.planningIntake as
              | Record<string, unknown>
              | undefined) ||
            null
        ) ??
        contract.executionType ??
        cycle?.goalDraftV2?.executionType ??
        'GenericStructured';
      let goalDraftV2 =
        (cycle.goalDraftV2 as GoalDraftV2) ??
        (contract.goalDraftV2 as GoalDraftV2) ??
        (state.goalDraftV2 as GoalDraftV2) ??
        (state.goalExecutionContract?.goalDraftV2 as GoalDraftV2) ??
        (state.planDraft?.goalDraftV2 as GoalDraftV2) ??
        null;
      if (goalDraftV2) {
        if (!cycle.goalDraftV2) {
          cycle.goalDraftV2 = goalDraftV2;
        }
        if (cycle.goalContract && typeof cycle.goalContract === 'object' && !cycle.goalContract.goalDraftV2) {
          cycle.goalContract.goalDraftV2 = goalDraftV2;
        }
        if (state.goalExecutionContract && typeof state.goalExecutionContract === 'object' && !state.goalExecutionContract.goalDraftV2) {
          state.goalExecutionContract.goalDraftV2 = goalDraftV2;
        }
        if (cycle?.contract && typeof cycle.contract === 'object' && !cycle.contract.goalDraftV2) {
          cycle.contract.goalDraftV2 = goalDraftV2;
        }
      } else {
        // Merge the pre-resolved executionType (with 'GenericStructured' fallback) into the
        // contract view passed to synthesis so the function's !executionType guard never fires
        // on cycles that lack an explicit contract.executionType field.
        goalDraftV2 = synthesizeGoalDraftV2(
          cycle as Record<string, unknown>,
          { ...(contract as Record<string, unknown>), executionType: (contract as Record<string, unknown>).executionType || executionType },
          state,
          input,
        );
        if (goalDraftV2) {
          cycle.goalDraftV2 = goalDraftV2;
          if (cycle.goalContract && typeof cycle.goalContract === 'object') {
            cycle.goalContract.goalDraftV2 = goalDraftV2;
          }
          if (state.goalExecutionContract && typeof state.goalExecutionContract === 'object') {
            state.goalExecutionContract.goalDraftV2 = goalDraftV2;
          }
          if (cycle?.contract && typeof cycle.contract === 'object') {
            cycle.contract.goalDraftV2 = goalDraftV2;
          }
        }
      }
      // eslint-disable-next-line no-console
      console.log('[LLM] step 4 - executionType', {
        executionType,
        isLLMType: LLM_EXECUTION_TYPES.has(executionType),
      });
      // eslint-disable-next-line no-console
      console.log('[LLM] step 5 - goalDraftV2', {
        found: !!goalDraftV2,
        keys: goalDraftV2 ? Object.keys(goalDraftV2) : null,
      });

      // Route non-LLM types to the existing synchronous path
      if (!LLM_EXECUTION_TYPES.has(executionType)) {
        store.generatePlan?.({ cycleId: resolvedCycleId });
        return;
      }

      if (!goalDraftV2) {
        const prefill = buildMissingGoalDraftRecoveryPrefill(state, cycle, contract);
        store.dispatch({
          type: 'GENERATE_PLAN_FAILED',
          payload: {
            cycleId: resolvedCycleId,
            error: {
              code: 'MISSING_GOAL_DRAFT',
              reason: 'goalDraftV2 is missing. Cannot generate LLM plan without structured goal data.',
            },
            recovery: {
              required: 'GOAL_DRAFT_CONTEXT',
              route: 'STRUCTURE_GATE_2',
              prefill,
            },
          },
        });
        return;
      }

      const recoveredPlanningIntake = applyRecoveredFeasibilityPivot(
        ((contract?.planningIntake as Record<string, unknown> | undefined) ||
          ((contract?.goalIntakeContract as Record<string, unknown> | undefined)?.planningIntake as
            | Record<string, unknown>
            | undefined) ||
          null) as Record<string, unknown> | null,
        contract as Record<string, unknown>
      );
      if (recoveredPlanningIntake && contract && typeof contract === 'object') {
        contract.planningIntake = recoveredPlanningIntake;
        if (contract.goalIntakeContract && typeof contract.goalIntakeContract === 'object') {
          contract.goalIntakeContract.planningIntake = recoveredPlanningIntake;
        }
      }

      const intakeContract = buildGoalIntakeContract({
        goalId: contract?.goalId || resolvedCycleId || cycle?.id || null,
        rawGoalText:
          goalDraftV2?.goalLabel ||
          goalDraftV2?.goalText ||
          contract?.goalText ||
          contract?.goalLabel ||
          contract?.terminalOutcome?.text ||
          contract?.terminalOutcome?.verificationCriteria ||
          '',
        verificationCriteria: contract?.terminalOutcome?.verificationCriteria || '',
        executionType,
        deadline:
          contract?.deadline?.dayKey || contract?.endDayKey || contract?.deadlineISO || contract?.deadline || null,
        goalDraftV2,
        contract,
        // Role A: user-confirmed intake answers from the Intake Drafting Assistant.
        // Passed through only after explicit user confirmation in MissionSetupFlow.
        answeredContext:
          (input?.answeredContext as Record<string, string | number | boolean | string[]>) ||
          ((goalDraftV2 as Record<string, unknown>)?.answeredContext as Record<
            string,
            string | number | boolean | string[]
          >) ||
          undefined,
      });

      const contractSource = classifyContractSource(cycle as Record<string, unknown>, state as Record<string, unknown>);
      const gatePlanningIntake =
        (intakeContract?.planningIntake as Record<string, unknown> | undefined) ||
        (recoveredPlanningIntake as Record<string, unknown> | null) ||
        {};
      const gateAudience =
        (gatePlanningIntake?.capitalAcquisitionAssets as Record<string, unknown> | undefined)?.existingAudience as
          | Record<string, unknown>
          | undefined;
      const gateSnapshot = {
        source: contractSource,
        sourceDetails: {
          hasCanonicalGoalContract: !!cycle?.goalContract,
          hasGoalExecutionMirror: !!state?.goalExecutionContract,
          hasLegacyCycleContract: !!cycle?.contract,
        },
        prePlanStatus: intakeContract?.prePlanFeasibility?.status || null,
        admittedFeasibilityStatus:
          contract?.prePlanFeasibility?.status ||
          contract?.goalIntakeContract?.prePlanFeasibility?.status ||
          contract?.capitalAcquisitionFeasibility?.status ||
          contract?.goalIntakeContract?.capitalAcquisitionFeasibility?.status ||
          null,
        availableCapital: gatePlanningIntake?.capitalAvailable ?? null,
        capitalCommitmentConfidence: gatePlanningIntake?.capitalCommitmentConfidence ?? null,
        capitalAcquisitionRequired: gatePlanningIntake?.capitalAcquisitionRequired === true,
        selectedFeasibilityPivot: contract?.selectedFeasibilityPivot || null,
        hasAudience:
          Number(gateAudience?.spotifyListeners || 0) > 0 || Number(gateAudience?.instagramFollowers || 0) > 0,
        audience: {
          spotifyListeners: Number(gateAudience?.spotifyListeners || 0),
          instagramFollowers: Number(gateAudience?.instagramFollowers || 0),
        },
        hasRevenueAllocation:
          (gatePlanningIntake?.capitalAcquisitionAssets as Record<string, unknown> | undefined)?.existingRevenue
            ?.allocationToPossible === true,
        formulaPathway: gatePlanningIntake?.formulaPathway || null,
        targetCategory: gatePlanningIntake?.targetCategory || null,
        distributionChannel: gatePlanningIntake?.distributionChannel || null,
      };
      // eslint-disable-next-line no-console
      console.log(`[LLM] feasibility gate snapshot\n${JSON.stringify(gateSnapshot, null, 2)}`);

      if (!intakeContract.readiness.isReadyForPlanning) {
        store.dispatch({
          type: 'GENERATE_PLAN_FAILED',
          payload: {
            cycleId: resolvedCycleId,
            error: {
              code: getIntakeGateCode(intakeContract),
              reason: intakeContract.requiredContextQuestions[0]?.prompt || 'Goal intake is not ready for planning.',
            },
            recovery: {
              required: 'INTAKE_SCOPE_RESOLUTION',
              route: 'STRUCTURE_INTAKE',
              prefill: {
                goalContract: {
                  ...(contract || {}),
                  goalIntakeContract: intakeContract,
                },
                goalDraftV2: {
                  ...(goalDraftV2 || {}),
                  goalLabel: goalDraftV2?.goalLabel || goalDraftV2?.goalText || contract?.goalText || '',
                  goalText: goalDraftV2?.goalText || goalDraftV2?.goalLabel || contract?.goalText || '',
                },
              },
            },
          },
        });
        return;
      }

      const unresolvedPlanningQuestions = Array.isArray(intakeContract.requiredContextQuestions)
        ? intakeContract.requiredContextQuestions.filter((question) => question?.domain === 'planning')
        : [];

      if (unresolvedPlanningQuestions.length > 0) {
        store.dispatch({
          type: 'GENERATE_PLAN_FAILED',
          payload: {
            cycleId: resolvedCycleId,
            error: {
              code: unresolvedPlanningQuestions[0]?.reasonCode || 'PLANNING_INTAKE_REQUIRED',
              reason:
                unresolvedPlanningQuestions[0]?.prompt ||
                'Planning intake must be confirmed before graph generation can begin.',
            },
            recovery: {
              required: 'PLANNING_INTAKE_RESOLUTION',
              route: 'STRUCTURE_INTAKE',
              prefill: {
                goalContract: {
                  ...(contract || {}),
                  goalIntakeContract: intakeContract,
                  planningIntake: intakeContract.planningIntake,
                  prePlanFeasibility: intakeContract.prePlanFeasibility,
                },
                goalDraftV2: {
                  ...(goalDraftV2 || {}),
                  answeredContext: {
                    ...(((goalDraftV2 as Record<string, unknown>)?.answeredContext as Record<string, unknown>) || {}),
                    ...(input?.answeredContext || {}),
                  },
                },
              },
            },
          },
        });
        return;
      }

      if (
        intakeContract.prePlanFeasibility?.status &&
        !['VIABLE', 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED'].includes(intakeContract.prePlanFeasibility.status)
      ) {
        store.dispatch({
          type: 'GENERATE_PLAN_FAILED',
          payload: {
            cycleId: resolvedCycleId,
            error: {
              code: intakeContract.prePlanFeasibility.status,
              reason: intakeContract.prePlanFeasibility.explanation,
              reasonCodes: [intakeContract.prePlanFeasibility.status],
            },
            recovery: {
              required: 'PRE_PLAN_FEASIBILITY_RESOLUTION',
              route: 'STRUCTURE_INTAKE',
              prefill: {
                goalContract: {
                  ...(contract || {}),
                  goalIntakeContract: intakeContract,
                  planningIntake: intakeContract.planningIntake,
                  prePlanFeasibility: intakeContract.prePlanFeasibility,
                  capitalAcquisitionFeasibility: intakeContract.capitalAcquisitionFeasibility,
                },
                goalDraftV2: {
                  ...(goalDraftV2 || {}),
                  answeredContext: {
                    ...(((goalDraftV2 as Record<string, unknown>)?.answeredContext as Record<string, unknown>) || {}),
                    ...(input?.answeredContext || {}),
                  },
                },
              },
            },
          },
        });
        return;
      }

      // Step 1: signal generation started
      store.dispatch({
        type: 'GENERATE_PLAN_STARTED',
        payload: {
          cycleId: resolvedCycleId,
          executionType,
          source: 'LLM',
        },
      });

      // Step 2: call Claude
      const apiKey =
        store.getAnthropicApiKey?.() ??
        (typeof window !== 'undefined' ? ((window as Record<string, unknown>).__ANTHROPIC_API_KEY__ as string) : '');

      if (!apiKey && !SKIP_API_KEY_CHECK) {
        store.dispatch({
          type: 'GENERATE_PLAN_FAILED',
          payload: {
            cycleId: resolvedCycleId,
            error: {
              code: 'MISSING_API_KEY',
              reason: 'Anthropic API key is not configured. Set __ANTHROPIC_API_KEY__ or provide via store.',
            },
          },
        });
        return;
      }

      // eslint-disable-next-line no-console
      console.log('[LLM] step 6 - about to call mock');
      const result = await callClaudeForActionGraph(goalDraftV2, contract, executionType, apiKey || 'dev-mock-key');
      // eslint-disable-next-line no-console
      console.log('[LLM] step 7 - mock result', { ok: result.ok, error: result.error ?? null });

      // Step 3a: success — dispatch actions into reducer
      if (result.ok) {
        const normalizedActions = normalizeTypedDependenciesForActions(result.graph.actions, executionType);
        const sessionResult = await callClaudeForSessionPlan(
          {
            goalDraftV2,
            contract,
            executionType,
            actions: normalizedActions as Parameters<typeof callClaudeForSessionPlan>[0]['actions'],
            cycleId: resolvedCycleId || cycle?.id || null,
            nowISO: state?.appTime?.nowISO || new Date().toISOString(),
            planningIntake: intakeContract.planningIntake,
            callProfile: LLM_CALL_PROFILES.PLAN_SESSIONS,
          } as Parameters<typeof callClaudeForSessionPlan>[0],
          apiKey || 'dev-mock-key'
        );
        const sessions: unknown[] = sessionResult.ok && Array.isArray(sessionResult.sessions) ? sessionResult.sessions : [];

        // Build audit blocks from sessions enriched with action-level metadata
        // so the quality gate can check duration constraints, merchant timing, etc.
        const actionMetaById = new Map(
          normalizedActions.map((action) => {
            const typedAction = action as Record<string, unknown>;
            return [String(typedAction?.id || ''), typedAction];
          })
        );
        const auditBlocks = sessions.map((session, idx) => {
          const typedSession = session as Record<string, unknown>;
          const actionId = String(typedSession?.actionId || '');
          const actionMeta = actionMetaById.get(actionId) || {};
          const date = String(typedSession?.date || '');
          const startISO = date ? `${date}T09:00:00.000Z` : '';
          const minDays = Number(actionMeta?.minimumDurationBusinessDays);
          const endISO =
            startISO && Number.isFinite(minDays) && minDays > 0
              ? (addBusinessDays(startISO, minDays) ?? startISO)
              : startISO;
          return {
            id: `audit-session-${idx}`,
            title: String(typedSession?.title || ''),
            actionId: actionId || null,
            startISO,
            endISO,
            blockType: String(actionMeta?.blockType || '') || null,
            waitType: String(actionMeta?.waitType || '') || null,
            minimumDurationBusinessDays: Number.isFinite(minDays) && minDays > 0 ? minDays : null,
            requiredWorkFamily: String(actionMeta?.requiredWorkFamily || '') || null,
            capitalGateId: String(actionMeta?.capitalGateId || '') || null,
            parallelWorkSuggestions: Array.isArray(actionMeta?.parallelWorkSuggestions)
              ? (actionMeta.parallelWorkSuggestions as string[])
              : [],
            directDependencyDetails: Array.isArray(actionMeta?.dependencyDetails)
              ? (actionMeta.dependencyDetails as Array<{ actionId: string; dependencyType: 'hard_gate' | 'directional' | 'informational' }>)
              : [],
            transitiveDependencyDetails: Array.isArray(actionMeta?.dependencyDetails)
              ? (actionMeta.dependencyDetails as Array<{ actionId: string; dependencyType: 'hard_gate' | 'directional' | 'informational' }>)
              : [],
          };
        });

        const auditActions = normalizedActions.map((action) => {
          const typedAction = action as Record<string, unknown>;
          const requiredWorkFamily = String(typedAction?.requiredWorkFamily || '');
          const pathwayTag = String(typedAction?.pathwayTag || '');
          const capitalGateId = String(typedAction?.capitalGateId || '');
          return {
            id: String(typedAction?.id || ''),
            title: String(typedAction?.title || ''),
            dependencies: Array.isArray(typedAction?.dependencies)
              ? (typedAction.dependencies as string[])
              : [],
            dependencyDetails: Array.isArray(typedAction?.dependencyDetails)
              ? (typedAction.dependencyDetails as Array<{ actionId: string; dependencyType: 'hard_gate' | 'directional' | 'informational' }>)
              : [],
            ...(requiredWorkFamily ? { requiredWorkFamily } : {}),
            ...(pathwayTag ? { pathwayTag } : {}),
            ...(capitalGateId ? { capitalGateId } : {}),
          };
        });

        const auditResult = planQualityAudit({
          intake: intakeContract.planningIntake,
          actions: auditActions,
          blocks: auditBlocks,
        });

        if (!auditResult.passed) {
          // Temporary debug log for enriched temporal violation diagnostics
          const temporalViolations = auditResult.violations.filter((v) => v.rule === 'TEMPORAL_VIOLATION');
          if (temporalViolations.length > 0) {
            // eslint-disable-next-line no-console
            console.log(
              'ENT-01 Live Temporal Violation Diagnostics:\n' +
                JSON.stringify(
                  temporalViolations.slice(0, 10).map((v) => ({
                    blockId: v.blockId,
                    blockTitle: v.blockTitle,
                    blockActionId: v.blockActionId,
                    blockEndISO: v.blockEndISO,
                    dependencyActionId: v.dependencyActionId,
                    scheduledStartISO: v.actual,
                    allowedEarliestISO: v.expected,
                    gapDays: v.gapDays,
                    violationBucket: v.violationBucket,
                    deliverableId: auditActions.find((a) => a.id === v.blockActionId)?.deliverableId || null,
                    commercialCycleIndex: auditActions.find((a) => a.id === v.blockActionId)?.commercialCycleIndex || null,
                    phaseHint: auditActions.find((a) => a.id === v.blockActionId)?.phaseHint || null,
                  })),
                  null,
                  2
                )
            );
          }

          store.dispatch({
            type: 'GENERATE_PLAN_FAILED',
            payload: {
              cycleId: resolvedCycleId,
              error: {
                code: 'PLAN_QUALITY_VIOLATION',
                reason: auditResult.violations[0]?.message || 'Plan quality audit failed.',
                reasonCodes: auditResult.violations.map((v) => v.rule),
              },
              planQualityViolations: auditResult.violations,
              source: 'LLM',
            },
          });
          return;
        }

        const horizonStartDayKey =
          String(
            contract?.startDayKey ||
              contract?.temporalBinding?.startDayKey ||
              goalDraftV2?.startDate ||
              input?.anchorDayKey ||
              ''
          ).trim() || null;
        const horizonEndDayKey =
          String(
            contract?.endDayKey ||
              contract?.deadline?.dayKey ||
              contract?.deadlineISO ||
              goalDraftV2?.deadline ||
              ''
          )
            .trim()
            .slice(0, 10) || null;
        const horizonDayCount =
          horizonStartDayKey && horizonEndDayKey
            ? Math.max(
                1,
                Math.round(
                  (Date.parse(`${horizonEndDayKey}T12:00:00.000Z`) - Date.parse(`${horizonStartDayKey}T12:00:00.000Z`)) /
                    86400000
                ) + 1
              )
            : 0;
        const feasibilityAssessment = deriveFeasibility(
          {
            actions: auditActions,
            scheduledBlocks: auditBlocks,
            summary: {
              planStatus: 'VALID_AND_FULLY_SCHEDULED',
              horizonDayCount,
              scheduledBlockCount: auditBlocks.length,
            },
            startDayKey: horizonStartDayKey,
            deadlineDayKey: horizonEndDayKey,
            prePlanFeasibility: intakeContract.capitalAcquisitionFeasibility || null,
            capitalAcquisitionFeasibility: intakeContract.capitalAcquisitionFeasibility || null,
          },
          intakeContract.planningIntake
        );

        if (feasibilityAssessment.overallStatus === 'NOT_VIABLE_AS_STATED') {
          store.dispatch({
            type: 'GENERATE_PLAN_FAILED',
            payload: {
              cycleId: resolvedCycleId,
              error: {
                code: 'FEASIBILITY_BLOCKED',
                reason: feasibilityAssessment.confidenceStatement,
                reasonCodes: ['NOT_VIABLE_AS_STATED'],
              },
              feasibility: feasibilityAssessment,
              source: 'LLM',
            },
          });
          return;
        }

        store.dispatch({
          type: 'GENERATE_PLAN_WITH_ACTIONS',
          payload: {
            cycleId: resolvedCycleId,
            executionType,
            actions: normalizedActions,
            sessions,
            templates: result.graph.templates,
            diagnostics: result.graph.diagnostics,
            goalIntakeContract: intakeContract,
            planningIntake: intakeContract.planningIntake,
            prePlanFeasibility: intakeContract.prePlanFeasibility,
            capitalAcquisitionFeasibility: intakeContract.capitalAcquisitionFeasibility,
            planQualityWarnings: auditResult.warnings,
            feasibilityAssessment,
            source: 'LLM',
          },
        });

        // Step 4: rebuild schedule draft cache now that actions exist
        store.dispatch({
          type: 'REBUILD_SCHEDULE',
          payload: { cycleId: resolvedCycleId, anchorDayKey: input?.anchorDayKey || null },
        });
        return;
      }

      // Step 3b: failure
      store.dispatch({
        type: 'GENERATE_PLAN_FAILED',
        payload: {
          cycleId: resolvedCycleId,
          error: result.error,
          executionType,
          source: 'LLM',
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[LLM] UNCAUGHT ERROR in generatePlanWithLLM:', err);
      const fallbackState = store.getState?.() || {};
      const fallbackCycleId = input?.cycleId ?? fallbackState?.activeCycleId ?? null;
      store.dispatch({
        type: 'GENERATE_PLAN_FAILED',
        payload: {
          cycleId: fallbackCycleId,
          error: {
            code: 'LLM_GENERATION_EXCEPTION',
            reason: err instanceof Error ? err.message : 'Unexpected LLM generation exception.',
          },
          source: 'LLM',
        },
      });
    }
  };
}

function normalizeToDayKey(value: unknown): string | null {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return text.slice(0, 10) || null;
}

function buildMissingGoalDraftRecoveryPrefill(state: any, cycle: any, contract: any) {
  const pending = state?.pendingOnboardingInputs || {};
  const activeDayKey = String(state?.appTime?.activeDayKey || '').trim() || new Date().toISOString().slice(0, 10);
  const goalText = String(
    pending?.goalText ||
      pending?.goalDraftV2?.goalLabel ||
      pending?.goalDraftV2?.goalText ||
      contract?.goalText ||
      contract?.goalLabel ||
      contract?.terminalOutcome?.text ||
      ''
  ).trim();
  const executionType = String(
    pending?.executionType ||
      pending?.goalDraftV2?.executionType ||
      contract?.executionType ||
      cycle?.goalDraftV2?.executionType ||
      'GenericStructured'
  ).trim();
  const inferredStartDate =
    normalizeToDayKey(
      pending?.startDate ||
        pending?.goalContract?.startDateISO ||
        contract?.startDayKey ||
        contract?.startDateISO ||
        activeDayKey
    ) || activeDayKey;
  const startDate = inferredStartDate < activeDayKey ? activeDayKey : inferredStartDate;
  const deadline =
    normalizeToDayKey(
      pending?.deadline || pending?.goalContract?.deadlineISO || contract?.deadline?.dayKey || contract?.deadlineISO
    ) || '';
  const definitionOfDone = String(
    pending?.definitionOfDone ||
      pending?.goalContract?.target?.definitionOfDone ||
      contract?.terminalOutcome?.verificationCriteria ||
      ''
  ).trim();

  return {
    ...pending,
    goalText,
    executionType,
    startDate,
    deadline,
    definitionOfDone,
    goalDraftV2: {
      executionType,
      goalLabel: goalText,
      goalText,
      startDate,
      ...(pending?.goalDraftV2 || {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Type stubs — replace with your actual store types
// ---------------------------------------------------------------------------

interface JerichoStore {
  getState(): any;
  dispatch(action: { type: string; payload?: unknown }): void;
  generatePlan?(payload?: { cycleId?: string | null }): void;
  getAnthropicApiKey?(): string;
}
