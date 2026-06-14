import structuredClone from '@ungap/structured-clone';
import { PRACTICE_KEYS } from './metricsPolicy.js';
import { normalizeDomain } from './domain.js';
import { normalizeBlocksDomain } from './normalizeBlock.js';
import {
  addDays,
  dayKeyFromDate,
  dayKeyFromISO,
  dayKeyFromParts,
  nowDayKey,
  buildLocalStartISO,
  assertValidISO,
  isValidISO,
  APP_TIME_ZONE,
} from './time/time.ts';
import { buildDefaultStrategy, generateColdPlan, generateDailyProjection } from './coldPlan.ts';
import { compileGoalEquationPlan } from './goalEquation.ts';
import { admitGoal, isAdmitted } from './goalAdmission.ts';
import { compileAutoAsanaPlan } from './engine/autoAsanaPlan.ts';
import { buildAssumptionsHash, normalizeDeliverables, normalizeRouteOption } from './strategy.ts';
import { buildAutoDeliverablesFromGoalContract } from '../domain/autoStrategy.ts';
import { inferHorizonYearsFromText } from '../domain/masterPlan/masterPlanIntakeEngine.js';
import { expandFullHorizonSchedule } from '../domain/masterPlan/fullHorizonScheduleExpansion.js';
import { auditFullHorizonCoverage } from '../domain/masterPlan/fullHorizonCoverageAudit.js';
import { evaluateFullHorizonPlanQuality } from '../domain/masterPlan/fullHorizonPlanQuality.js';
import { evaluateFullHorizonBlockQuality } from '../domain/masterPlan/fullHorizonBlockQuality.js';
import {
  buildFullHorizonAgendaVersion,
  buildFullHorizonConstraintVersion,
} from '../domain/masterPlan/fullHorizonScheduledAgenda.js';
import {
  auditFullHorizonRenderTruth,
  applyRenderTruthToCoverageAudit,
} from '../domain/masterPlan/fullHorizonRenderTruthAudit.js';
import { projectBlocksForDisplay } from '../domain/masterPlan/blockDisplayProjection.js';
import { buildGoalIntakeContract, getIntakeGateCode } from '../domain/goal/GoalIntakeContract.ts';
import { buildGoalPolicySnapshot } from '../domain/goal/GoalPolicy.ts';
import { evaluatePlanQualityGate } from '../domain/planQuality/evaluatePlanQualityGate.ts';
import { generateAutoDeliverables, debugAutoDeliverablesGeneration } from '../core/autoDeliverables.ts';
import { getDeadlineDayKey } from '../core/deadline.ts';

import { generateDeterministicPlan } from '../core/deterministicPlanGenerator.ts';
import { canEmitExecutionEvent } from './engine/executionContract.ts';
import {
  appendExternalEvidenceEvent,
  appendExecutionEvent,
  appendPlanMutationEvent,
  buildExternalEvidenceEvent,
  buildExecutionEventFromBlock,
  buildPlanMutationEventFromBlock,
  annotateRepeatedSessionTitles,
  deriveExecutionTruthClassification,
  materializeBlocksFromEvents,
} from './engine/todayAuthority.ts';
import { derivePlanProof } from './engine/planProof.ts';
import { resolveActiveContract } from './contracts/goalContract.resolve.ts';
import { authorizeSuggestion } from './contracts/goalContract.validate.ts';
import { deriveProbabilityStatus } from './contracts/probabilityEligibility.ts';
import { scoreGoalSuccessProbability } from './engine/probabilityScore.ts';
import { computeFeasibility } from './engine/feasibility.ts';
import { computeNextBestMove as computeGoalDirective } from './aimCompute.js';
import { generateSuggestions } from './suggestions.ts';
import { summarizeCycle } from './cycleSummary.ts';
import { computeProfileLearning } from './learning.ts';
import { computeTerminalConvergence } from './convergenceTerminal.ts';
import { rolloverAtMidnight, shouldRollover } from '../core/engine/rollover.ts';
import { buildPolicyAndQualityDiagnostics } from './draftSchedule.js';
import { IS_PRODUCTION, isRuntimeEnvFlagEnabled } from '../utils/runtimeEnv.js';
import {
  appendFrictionEvent,
  buildFrictionEvent,
  deriveProfileExecutionContainment,
} from './engine/profileExecutionContainment.ts';
import {
  getCanonicalCycleActions,
  getCanonicalCycleContract,
  getCanonicalCycleDeliverables,
  getCanonicalLongHorizonPlanMetadata,
  getCanonicalProposedBlocks,
} from './cycleSelectors.js';
import { buildHistoryProfile, deriveCycleHistorySignals } from '../planner/scoring/historySignals.ts';
import { computeCycleIntegrityScore, computeCyclePOS } from '../domain/scoring/cycleScoring.ts';
import { aggregateCycleOutcomes, buildPosExplanation } from '../domain/scoring/posExplanation.ts';
import { buildCycleDynamicsTransitionPatch, deriveCycleDynamicsProfile } from './engine/cycleDynamics.ts';
import { compileGoalToDeliverables, toLegacyWorkspaceDeliverables } from './engine/goalToDeliverables.ts';
import { evaluateExecutionCorrection } from './engine/executionCorrectionEvaluator.ts';
import { deriveSystemShotClock } from './engine/shotClock.ts';
import { deriveForecastBlocks, resolveHorizonEndForMode } from '../domain/masterPlan/forecastBlockDerivation.js';
import { deriveMasterPlanPhaseModel } from '../domain/masterPlan/masterPlanPhaseModel.js';
import { resolveEffectiveExecutableStartDayKey } from '../domain/product/resolveEffectiveExecutableStartDayKey.js';
import { projectEnterpriseDisplay } from '../domain/enterprise/enterpriseDisplayProjection';
import { evaluateEnterpriseIdentityAudit } from '../domain/enterprise/evaluateEnterpriseIdentityAudit';

/**
 * Computes core continuity state from active mission contract and linked master plans.
 * Returns continuity assessment with state, reason codes, and linked plan IDs.
 */
function computeCoreContinuity(state) {
  const profile = state.profilesById?.[state.activeProfileId];
  const activeMissionId = profile?.activeCoreMissionContractId;
  
  if (!activeMissionId) {
    return {
      state: 'absent',
      activeMissionId: null,
      linkedMasterPlanIds: [],
      reasonCodes: ['no_active_mission_contract'],
    };
  }

  const contract = state.coreMissionContractsById?.[activeMissionId];
  if (!contract) {
    return {
      state: 'absent',
      activeMissionId,
      linkedMasterPlanIds: [],
      reasonCodes: ['mission_contract_not_found'],
    };
  }

  // Find master plans linked to this mission contract
  const linkedMasterPlanIds = Object.values(state.masterPlansById || {})
    .filter(plan => plan.coreMissionContractId === activeMissionId)
    .map(plan => plan.id);

  const activeMasterPlanId = profile?.activeMasterPlanId;
  const hasActiveMasterPlan = activeMasterPlanId && linkedMasterPlanIds.includes(activeMasterPlanId);

  // Assess continuity based on contract state and plan linkage
  let continuityState = 'aligned';
  const reasonCodes = [];

  if (!hasActiveMasterPlan) {
    continuityState = 'strained';
    reasonCodes.push('no_active_master_plan');
  }

  // Check for recent revisions (within last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const recentRevisions = (contract.revisionHistory || []).filter(
    rev => new Date(rev.timestamp) > ninetyDaysAgo
  );

  if (recentRevisions.length > 2) {
    continuityState = 'drifting';
    reasonCodes.push('frequent_revisions');
  }

  // Check for derailment signals
  if (contract.derailmentSignals && contract.derailmentSignals.length > 0) {
    continuityState = 'endangered';
    reasonCodes.push('active_derailment_signals');
  }

  if (reasonCodes.length === 0) {
    reasonCodes.push('mission_aligned');
  }

  return {
    state: continuityState,
    activeMissionId,
    linkedMasterPlanIds,
    reasonCodes,
  };
}

export function applyEnterpriseIdentityAudit(next) {
  if (!next || typeof next !== 'object') return;
  const profile = next.profilesById?.[next.activeProfileId] || null;
  const activeMissionId = profile?.activeCoreMissionContractId || null;
  const contract = activeMissionId ? next.coreMissionContractsById?.[activeMissionId] || null : null;
  const activeMasterPlan = Object.values(next.masterPlansById || {}).find(
    (plan) => plan?.coreMissionContractId === activeMissionId,
  ) || null;
  const declaredLaneIds = Array.isArray(activeMasterPlan?.laneIds) ? activeMasterPlan.laneIds : [];
  const intakeSignals = {
    goalText: String(contract?.goalText || contract?.goal || contract?.label || '').trim(),
    declaredLaneIds,
  };
  const projections = declaredLaneIds.map((laneId) => {
    const lane = next.masterPlanLanesById?.[laneId] || null;
    return projectEnterpriseDisplay({
      laneId,
      laneLabel: lane?.label || laneId,
      intakeSignals,
    });
  });
  const blocks = Array.isArray(next.days)
    ? next.days.flatMap((day) => Array.isArray(day?.blocks) ? day.blocks : [])
    : [];
  next.enterpriseProjections = projections;
  next.enterpriseIdentityAudit = evaluateEnterpriseIdentityAudit({
    projections,
    chartRows: projections.map((p) => ({ primaryLabel: p.displayName, laneId: p.internalLane })),
    blocks: blocks.map((block) => ({
      id: String(block?.id || ''),
      laneId: block?.laneId || block?.domain || null,
      phaseLabel: block?.phaseLabel,
      blockType: block?.blockType,
      expectedOutput: block?.expectedOutput,
      acceptanceEvidence: block?.acceptanceEvidence,
    })),
  });
}

/**
 * @typedef {import('./identityTypes.js').IdentityState} IdentityState
 */
/**
 * @typedef {import('./identityTypes.js').LensesConfig} LensesConfig
 */

const DEFAULT_PROFILE_ID = 'profile-local-default';
const DEFAULT_PROFILE_LABEL = 'Local Profile';

/**
 * @typedef {{ type: 'BEGIN_BLOCK'; id: string } | { type: 'COMPLETE_BLOCK'; id: string } | { type: 'RESCHEDULE_BLOCK'; id: string; start: string; end: string } | { type: 'APPLY_LENSES'; lenses: Partial<LensesConfig> } | { type: 'SET_VIEW_DATE'; date: string } | { type: 'REBALANCE_TODAY'; mode?: 'CLEAR_AFTERNOON' } | { type: 'COMPLETE_ONBOARDING'; onboarding: any } | { type: 'UPDATE_PENDING_ONBOARDING_INPUTS'; onboarding: any } | { type: 'START_NEW_CYCLE'; payload: any } | { type: 'START_NEW_CYCLE_WITH_DECISION'; payload: { mode: 'archive' | 'delete' } } | { type: 'END_CYCLE'; cycleId: string } | { type: 'ARCHIVE_AND_CLONE_CYCLE'; cycleId: string; overrides?: any } | { type: 'SET_ACTIVE_CYCLE'; cycleId: string } | { type: 'DELETE_CYCLE'; cycleId: string } | { type: 'HARD_DELETE_CYCLE'; cycleId: string } | { type: 'ADD_TRUTH_ENTRY'; payload: any } | { type: 'CREATE_BLOCK'; payload: any } | { type: 'UPDATE_BLOCK'; payload: any } | { type: 'DELETE_BLOCK'; id: string } | { type: 'ADD_RECURRING_PATTERN'; pattern: any } | { type: 'SET_PRIMARY_OBJECTIVE'; objectiveId: string | null } | { type: 'SET_CALIBRATION_DAYS'; daysPerWeek: number; uncertain?: boolean } | { type: 'GENERATE_PLAN' } | { type: 'APPLY_PLAN' } | { type: 'ACTIVATE_SCHEDULE' } | { type: 'REBASE_SCHEDULE'; payload?: any } | { type: 'ACCEPT_SUGGESTED_BLOCK'; proposalId: string } | { type: 'REJECT_SUGGESTED_BLOCK'; proposalId: string; reason: string } | { type: 'IGNORE_SUGGESTED_BLOCK'; proposalId: string } | { type: 'DISMISS_SUGGESTED_BLOCK'; proposalId: string } | { type: 'CREATE_DELIVERABLE'; payload: any } | { type: 'UPDATE_DELIVERABLE'; payload: any } | { type: 'DELETE_DELIVERABLE'; payload: any } | { type: 'CREATE_CRITERION'; payload: any } | { type: 'TOGGLE_CRITERION_DONE'; payload: any } | { type: 'DELETE_CRITERION'; payload: any } | { type: 'LINK_BLOCK_TO_DELIVERABLE'; payload: any } | { type: 'ASSIGN_SUGGESTION_LINK'; payload: any } | { type: 'SET_STRATEGY'; payload: any } | { type: 'GENERATE_COLD_PLAN'; payload?: any } | { type: 'REBASE_COLD_PLAN'; payload?: any } | { type: 'SET_DEFINITE_GOAL'; outcome: string; deadlineDayKey: string } | { type: 'COMPILE_GOAL_EQUATION'; payload: any } | { type: 'APPLY_RENEGOTIATION_OPTION'; payload?: any }} Action
 */

export function computeDerivedState(state, action) {
  /** @type {IdentityState} */
  let next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  if (!next.templates) {
    next.templates = { objectives: {} };
  }
  if (!next.templates.objectives) {
    next.templates.objectives = {};
  }
  if (!next.lastAdaptedDate) {
    next.lastAdaptedDate = null;
  }
  if (!next.stability) {
    next.stability = {};
  }
  if (!next.meta) {
    next.meta = { version: '1.0.0', onboardingComplete: false };
  }
  if (!next.recurringPatterns) {
    next.recurringPatterns = [];
  }
  if (!next.ledger) {
    next.ledger = [];
  }
  if (typeof next.pendingPlanConfirmation !== 'boolean') {
    next.pendingPlanConfirmation = false;
  }
  if (!next.selectedHorizonMode) {
    next.selectedHorizonMode = 'current_cycle';
  }
  if (!Array.isArray(next.calendarDisplayBlocks)) {
    next.calendarDisplayBlocks = [];
  }
  ensureCycleStructures(next);
  ensureAdmissionStores(next);
  ensureDeliverablesStore(next);
  ensureProfileOwnership(next);
  ensureMasterPlanOwnership(next);
  quarantineOrphanedActiveExecution(next);
  deriveProfileExecutionContainment(next);
  hydrateActiveCycleState(next);
  const hadCycleRecords = Boolean(next.cyclesById && Object.keys(next.cyclesById).length);
  if (!next.executionEvents) {
    next.executionEvents = [];
  }
  if (!Array.isArray(next.externalEvidenceEvents)) {
    next.externalEvidenceEvents = [];
  }
  if (!Array.isArray(next.planMutationEvents)) {
    next.planMutationEvents = [];
  }
  refreshColdPlanDailyProjection(next);
  const previousTodayBlocks = next.today?.blocks ? [...next.today.blocks] : [];

  const prevSuggestion = next.nextSuggestion;
  const debugPerfActions = isRuntimeEnvFlagEnabled('JERICHO_DEBUG_PERF_ACTIONS');
  const perfActionStart = debugPerfActions ? Date.now() : 0;

  switch (action.type) {
    case 'BEGIN_BLOCK':
      updateBlockStatus(next, action.id, 'in_progress');
      break;
    case 'COMPLETE_BLOCK': {
      updateBlockStatus(next, action.id, 'completed');
      const completedBlock = findBlockById(next, action.id);
      if (completedBlock) {
        const nowISO = next.appTime?.nowISO || new Date().toISOString();
        const truth = deriveExecutionTruthClassification({
          block: completedBlock,
          nowISO,
          activeDayKey: next.appTime?.activeDayKey || next.today?.date || null,
          timeZone: next.appTime?.timeZone || 'UTC',
          executionEvents: next.executionEvents || [],
          canonicalActions: getCanonicalCycleActions(next.cyclesById?.[completedBlock?.cycleId || next.activeCycleId] || null),
          source: action.source || 'user_action',
          reasonCode: action.reasonCode || null,
          note: action.note || null,
        });
        const completionEvent = buildExecutionEventFromBlock(completedBlock, {
          kind: 'complete',
          completed: true,
          status: 'completed',
          dateISO: truth.eventDate,
          completedAtISO: nowISO,
          ...truth,
        });
        if (canEmitExecutionEvent(next.executionEvents || [], completionEvent)) {
          appendExecutionEvent(next, completionEvent);
        }
      }
      appendTraceLog(next, {
        traceId: `trace-block-complete-${action.id || 'unknown'}-${Date.now()}`,
        moduleName: 'executionContract',
        stepName: 'block_completed',
        status: 'success',
        inputSummary: { blockId: action.id || null },
        outputSummary: {
          completedAt: next.appTime?.nowISO || new Date().toISOString(),
        },
        timestamp: next.appTime?.nowISO || new Date().toISOString(),
      });
      break;
    }
    case 'ADD_EXTERNAL_EVIDENCE': {
      const payload = action.payload || {};
      const cycleId = payload.cycleId || next.activeCycleId || null;
      const goalId =
        payload.goalId ||
        next.cyclesById?.[cycleId || '']?.goalContract?.goalId ||
        next.cyclesById?.[cycleId || '']?.goalGovernanceContract?.goalId ||
        next.goalExecutionContract?.goalId ||
        null;
      if (!payload?.evidenceType || !goalId) {
        break;
      }
      const event = buildExternalEvidenceEvent({
        ...payload,
        goalId,
        cycleId,
        dateISO: payload.dateISO || next.appTime?.activeDayKey || next.today?.date || nowDayKey(),
        recordedAtISO: payload.recordedAtISO || next.appTime?.nowISO || new Date().toISOString(),
      });
      const exists = (next.externalEvidenceEvents || []).some((candidate) => candidate?.id === event.id);
      if (!exists) {
        appendExternalEvidenceEvent(next, event);
      }
      break;
    }
    case 'ADD_FRICTION_EVENT': {
      const payload = action.payload || {};
      const cycleId = payload.cycleId || next.activeCycleId || null;
      const goalId =
        payload.goalId ||
        next.cyclesById?.[cycleId || '']?.goalContract?.goalId ||
        next.cyclesById?.[cycleId || '']?.goalGovernanceContract?.goalId ||
        next.goalExecutionContract?.goalId ||
        next.activeGoalId ||
        null;
      const profileId =
        payload.profileId ||
        next.goalsById?.[goalId || '']?.profileId ||
        next.cyclesById?.[cycleId || '']?.profileId ||
        next.activeProfileId ||
        null;
      const event = buildFrictionEvent({
        ...payload,
        profileId,
        goalId,
        cycleId,
        startDateISO: payload.startDateISO || next.appTime?.activeDayKey || next.today?.date || nowDayKey(),
      });
      if (event) {
        appendFrictionEvent(next, event);
      }
      break;
    }
    case 'RESCHEDULE_BLOCK':
      rescheduleBlock(next, action.id, action.start, action.end);
      break;
    case 'APPLY_LENSES': {
      const withoutPractice = { ...(action.lenses || {}) };
      if (withoutPractice.practice) {
        delete withoutPractice.practice;
      }
      next.lenses = { ...next.lenses, ...withoutPractice };
      ensureCycleStructures(next);
      const patternTargets = sanitizePatternTargets((next.lenses.pattern && next.lenses.pattern.dailyTargets) || []);
      if (next.activeCycleId && next.cyclesById?.[next.activeCycleId]) {
        next.cyclesById[next.activeCycleId].pattern = { dailyTargets: patternTargets };
        next.cyclesById[next.activeCycleId].aim = { text: next.lenses.aim?.description || '' };
        next.cyclesById[next.activeCycleId].flow = next.lenses.flow;
      }
      next.lenses.pattern = { ...(next.lenses.pattern || {}), dailyTargets: patternTargets };
      break;
    }
    case 'SET_DEFINITE_GOAL': {
      setDefiniteGoal(next, action);
      break;
    }
    case 'COMPILE_GOAL_EQUATION': {
      compileGoalEquation(next, action.payload);
      break;
    }
    case 'SET_VIEW_DATE':
      next.viewDate = action.date;
      break;
    case 'REBALANCE_TODAY': {
      const beforeSummary = next.today?.summaryLine || '';
      rebalanceTodayPlan(next, action.mode);
      recomputeSummaries(next);
      next.vector = recalculateIdentityVector(next);
      next.lastSessionChange = {
        type: action.mode || 'REBALANCE_TODAY',
        timestamp: new Date().toISOString(),
        beforeSummary,
        afterSummary: next.today?.summaryLine || '',
      };
      break;
    }
    case 'CREATE_GOAL':
    case 'SAVE_ONBOARDING':
    case 'COMPLETE_ONBOARDING': {
      const onboardingPayload = action.onboarding || action.payload || {};
      applyOnboardingInputs(next, onboardingPayload);
      next.meta = {
        ...(next.meta || {}),
        onboardingComplete: true,
        scenarioLabel: onboardingPayload?.scenarioLabel || next.meta?.scenarioLabel || '',
      };
      enforceOnboardingExecutionGraphGate(next, next.activeCycleId, action.type);
      break;
    }
    case 'FINISH_ONBOARDING_GATE': {
      const onboardingPayload = action.onboarding || action.payload || {};
      const scenarioLabel =
        onboardingPayload?.goalText ||
        onboardingPayload?.goalDraftV2?.goalLabel ||
        onboardingPayload?.goalDraftV2?.goalText ||
        next.meta?.scenarioLabel ||
        '';
      next.meta = {
        ...(next.meta || {}),
        onboardingComplete: true,
        scenarioLabel: String(scenarioLabel || '').slice(0, 120),
      };
      next.pendingOnboardingInputs = onboardingPayload || null;
      break;
    }
    case 'UPDATE_PENDING_ONBOARDING_INPUTS': {
      const onboardingPayload = action.onboarding || action.payload || null;
      next.pendingOnboardingInputs = onboardingPayload;
      break;
    }
    case 'START_NEW_CYCLE':
      startNewCycle(next, action.payload);
      break;
    case 'START_NEW_CYCLE_WITH_DECISION':
      startNewCycleWithDecision(next, action.payload || {});
      break;
    case 'RESET_ACTIVE_CYCLE':
      resetActiveCycleExecutionState(next, action.cycleId || next.activeCycleId || null);
      break;
    case 'COMPLETE_CYCLE_REASSESSMENT':
      completeCycleReassessment(next, action.cycleId || next.activeCycleId || null);
      break;
    case 'END_CYCLE':
      endCycle(next, action.cycleId);
      break;
    case 'ARCHIVE_AND_CLONE_CYCLE':
      archiveAndCloneCycle(next, action.cycleId, action.overrides);
      break;
    case 'SET_ACTIVE_CYCLE':
      setActiveCycle(next, action.cycleId);
      break;
    case 'DELETE_CYCLE':
      deleteCycle(next, action.cycleId);
      break;
    case 'HARD_DELETE_CYCLE':
      hardDeleteCycle(next, action.cycleId);
      break;
    case 'CREATE_DELIVERABLE':
      createDeliverable(next, action.payload);
      break;
    case 'UPDATE_DELIVERABLE':
      updateDeliverable(next, action.payload);
      break;
    case 'DELETE_DELIVERABLE':
      deleteDeliverable(next, action.payload);
      break;
    case 'CREATE_CRITERION':
      createCriterion(next, action.payload);
      break;
    case 'TOGGLE_CRITERION_DONE':
      toggleCriterionDone(next, action.payload);
      break;
    case 'DELETE_CRITERION':
      deleteCriterion(next, action.payload);
      break;
    case 'LINK_BLOCK_TO_DELIVERABLE':
      linkBlockToDeliverable(next, action.payload);
      break;
    case 'ASSIGN_SUGGESTION_LINK':
      assignSuggestionLink(next, action.payload);
      break;
    case 'ADD_TRUTH_ENTRY':
      addTruthEntry(next, action.payload);
      break;
    case 'APPLY_ONBOARDING_INPUTS': {
      const onboardingPayload = action.onboarding || action.payload || {};
      applyOnboardingInputs(next, onboardingPayload);
      enforceOnboardingExecutionGraphGate(next, next.activeCycleId, action.type);
      break;
    }
    case 'CREATE_BLOCK':
      createBlock(next, action.payload);
      break;
    case 'DRAFT_SCHEDULE_CLEAR':
      handleDraftScheduleClear(next, action);
      break;
    case 'DRAFT_BLOCK_CREATE':
      handleDraftBlockCreate(next, action);
      break;
    case 'TICK_NOW': {
      const nowISO = action.nowISO || action.atISO || new Date().toISOString();
      const timezone = action.timeZone || action.timezone || next.appTime?.timeZone || APP_TIME_ZONE;
      const currentDayKey = dayKeyFromISO(nowISO, timezone);

      const baseBlocks = next.today?.blocks || [];
      baseBlocks.forEach((block) => {
        if (!block?.id) {
          return;
        }
        const existingCreate = (next.executionEvents || []).some(
          (event) => event.blockId === block.id && event.kind === 'create'
        );
        if (existingCreate) {
          return;
        }
        const event = buildExecutionEventFromBlock(block, {
          id: `base-create-${block.id}`,
          kind: 'create',
          completed: false,
          dateISO: dayKeyFromISO(block.start || block.date, timezone) || currentDayKey,
          startISO: block.start,
          endISO: block.end,
          status: block.status || 'in_progress',
        });
        if (canEmitExecutionEvent(next.executionEvents || [], event)) {
          appendExecutionEvent(next, event);
        }
      });

      if (shouldRollover({ state: next, nowISO, timezone })) {
        const { eventsEmitted, lastRolloverDayISO } = rolloverAtMidnight({
          state: next,
          nowISO,
          timezone,
        });
        if (eventsEmitted?.length) {
          eventsEmitted.forEach((event) => appendExecutionEvent(next, event));
        }
        next.lastRolloverDayISO = lastRolloverDayISO || dayKeyFromISO(nowISO, timezone);
      }

      next.appTime = {
        ...next.appTime,
        nowISO,
        timeZone: timezone,
        activeDayKey: currentDayKey || next.appTime?.activeDayKey,
      };
      if (!next.today) {
        next.today = {};
      }
      next.today.date = currentDayKey;
      break;
    }
    case 'UPDATE_BLOCK':
      updateBlock(next, action.payload);
      break;
    case 'DELETE_BLOCK':
      deleteBlock(next, action.id, action);
      break;
    case 'ADD_RECURRING_PATTERN':
      addRecurringPattern(next, action.pattern);
      break;
    case 'SET_PRIMARY_OBJECTIVE':
      setPrimaryObjective(next, action.objectiveId);
      break;
    case 'APPLY_NEXT_SUGGESTION':
      applyNextSuggestion(next);
      break;
    case 'SET_CALIBRATION_DAYS':
      applyCalibrationDays(next, action.daysPerWeek, action.uncertain);
      break;
    case 'GENERATE_PLAN_STARTED': {
      const cycleId = action.payload?.cycleId || next.activeCycleId || null;
      const cycle = cycleId ? next.cyclesById?.[cycleId] : null;
      if (!cycle) {
        break;
      }
      cycle.planStatus = 'generating';
      cycle.planGenerationSource = action.payload?.source || 'UNKNOWN';
      cycle.llmActionGraph = null;
      next.lastPlanError = null;
      next.planRecovery = null;
      setGenerateHeartbeat(next, cycleId, 0, null);
      break;
    }
    case 'GENERATE_PLAN_WITH_ACTIONS': {
      const payload = action.payload || {};
      const cycleId = payload.cycleId || next.activeCycleId || null;
      const cycle = cycleId ? next.cyclesById?.[cycleId] : null;
      if (!cycle) {
        next.lastPlanError = {
          code: 'CYCLE_NOT_FOUND',
          reason: 'Cycle missing when applying LLM actions.',
          cycleId,
        };
        setGenerateHeartbeat(next, cycleId, 0, 'CYCLE_NOT_FOUND');
        break;
      }
      const actions = Array.isArray(payload.actions) ? payload.actions : [];
      if (actions.length === 0) {
        cycle.planStatus = 'error';
        next.lastPlanError = {
          code: 'EMPTY_LLM_ACTIONS',
          reason: 'LLM returned empty actions array.',
          cycleId,
        };
        setGenerateHeartbeat(next, cycleId, 0, 'EMPTY_LLM_ACTIONS');
        break;
      }
      cycle.llmActionGraph = {
        actions,
        templates: Array.isArray(payload.templates) ? payload.templates : [],
        diagnostics: payload.diagnostics || {},
      };
      cycle.goalContract = cycle.goalContract || {};
      if (payload.goalIntakeContract) {
        cycle.goalContract.goalIntakeContract = payload.goalIntakeContract;
      }
      if (payload.planningIntake) {
        cycle.goalContract.planningIntake = payload.planningIntake;
      }
      if (payload.prePlanFeasibility) {
        cycle.goalContract.prePlanFeasibility = payload.prePlanFeasibility;
      }
      if (payload.capitalAcquisitionFeasibility) {
        cycle.goalContract.capitalAcquisitionFeasibility = payload.capitalAcquisitionFeasibility;
      }
      if (payload.feasibilityAssessment) {
        cycle.goalContract.feasibilityAssessment = payload.feasibilityAssessment;
      }
      if (cycle.goalContract?.goalIntakeContract) {
        cycle.goalContract.goalIntakeContract.planningIntake =
          payload.planningIntake || cycle.goalContract.goalIntakeContract.planningIntake || null;
        cycle.goalContract.goalIntakeContract.prePlanFeasibility =
          payload.prePlanFeasibility || cycle.goalContract.goalIntakeContract.prePlanFeasibility || null;
        cycle.goalContract.goalIntakeContract.capitalAcquisitionFeasibility =
          payload.capitalAcquisitionFeasibility ||
          cycle.goalContract.goalIntakeContract.capitalAcquisitionFeasibility ||
          null;
        cycle.goalContract.goalIntakeContract.feasibilityAssessment =
          payload.feasibilityAssessment || cycle.goalContract.goalIntakeContract.feasibilityAssessment || null;
      }
      cycle.llmSessionPlan = Array.isArray(payload.sessions) ? payload.sessions.map((entry) => ({ ...entry })) : [];
      cycle.planGenerationSource = payload.source || cycle.planGenerationSource || 'LLM';
      cycle.actions = actions.map((item) => ({ ...item }));
      const compiledDeliverables = compileGoalToDeliverables({
        executionType: payload.executionType || cycle?.goalContract?.executionType || 'GenericStructured',
        actions: cycle.actions,
        contract: cycle.goalContract || null,
        cycleId: cycleId || cycle?.id || 'cycle',
      });
      if (compiledDeliverables.usesCanonicalDeliverablePath && compiledDeliverables.deliverables.length > 0) {
        const nowISO = next.appTime?.nowISO || new Date().toISOString();
        const workspace = getDeliverableWorkspace(next, cycleId);
        if (workspace) {
          workspace.deliverables = toLegacyWorkspaceDeliverables(compiledDeliverables.deliverables, nowISO);
          workspace.scaffoldGroups = compiledDeliverables.scaffoldGroups;
          workspace.compilerSummary = {
            archetype: compiledDeliverables.archetype,
            usesCanonicalDeliverablePath: true,
            deliverableCount: compiledDeliverables.deliverables.length,
            scaffoldGroupCount: compiledDeliverables.scaffoldGroups.length,
            actionSeedCount: compiledDeliverables.actionSeeds.length,
            estimatedSessionCount: compiledDeliverables.estimatedSessionCount,
            legacyFallbackUsed: false,
            invalidDeliverables: compiledDeliverables.invalidDeliverables,
          };
          workspace.autoGenerated = true;
          workspace.autoGeneratedAt = nowISO;
          workspace.autoStrategy = {
            method: 'goal_to_deliverable_compiler_phase_a',
            detectedType: compiledDeliverables.archetype,
            rationale: 'Deliverables compiled from canonical action graph outputs.',
          };
          workspace.lastUpdatedAtISO = nowISO;
          next.deliverablesByCycleId[cycleId] = workspace;
        }
        cycle.canonicalDeliverables = compiledDeliverables.deliverables;
      }
      cycle.planStatus = 'ready';
      if (!cycle.planProof) {
        cycle.planProof = buildPlanProofFromLLMActions(actions, cycle);
      }
      next.lastPlanError = null;
      next.planRecovery = null;
      generatePlan(next, { cycleId });
      if (next.lastPlanError?.code) {
        cycle.planStatus = 'error';
      }
      break;
    }
    case 'GENERATE_PLAN_FAILED': {
      const cycleId = action.payload?.cycleId || next.activeCycleId || null;
      const error = action.payload?.error || {};
      const cycle = cycleId ? next.cyclesById?.[cycleId] : null;
      if (cycle) {
        cycle.planStatus = 'error';
        cycle.planGenerationSource = action.payload?.source || cycle.planGenerationSource || 'UNKNOWN';
        cycle.llmActionGraph = null;
      }
      next.lastPlanError = {
        code: error.code || 'GENERATE_PLAN_FAILED',
        reason: error.reason || 'Plan generation failed.',
        reasonCodes: Array.isArray(error.reasonCodes) ? error.reasonCodes : [],
        cycleId,
      };
      const normalizedErrorCode = String(error.code || '')
        .trim()
        .toUpperCase();
      const recovery = action.payload?.recovery || {};
      const hasExplicitRecovery = recovery && typeof recovery === 'object' && Object.keys(recovery).length > 0;
      if (hasExplicitRecovery || normalizedErrorCode === 'MISSING_GOAL_DRAFT' || normalizedErrorCode.startsWith('INTAKE_')) {
        const prefill = recovery?.prefill && typeof recovery.prefill === 'object' ? recovery.prefill : null;
        next.planRecovery = {
          required:
            recovery?.required ||
            (normalizedErrorCode.startsWith('INTAKE_') ? 'INTAKE_SCOPE_RESOLUTION' : 'GOAL_DRAFT_CONTEXT'),
          route:
            recovery?.route || (normalizedErrorCode.startsWith('INTAKE_') ? 'STRUCTURE_INTAKE' : 'STRUCTURE_GATE_2'),
          prefill,
          sourceErrorCode: error.code || 'MISSING_GOAL_DRAFT',
          createdAtISO: next.appTime?.nowISO || new Date().toISOString(),
        };
        if (prefill) {
          next.pendingOnboardingInputs = {
            ...(next.pendingOnboardingInputs || {}),
            ...prefill,
            goalDraftV2: {
              ...((next.pendingOnboardingInputs || {}).goalDraftV2 || {}),
              ...(prefill.goalDraftV2 || {}),
            },
          };
        }
      } else {
        next.planRecovery = null;
      }
      setGenerateHeartbeat(next, cycleId, 0, next.lastPlanError.code);
      break;
    }
    case 'CLEAR_PLAN_RECOVERY':
      next.planRecovery = null;
      break;
    /*
     * MODULE CONTRACT — Schedule Proposal Generation
     *
     * Preconditions:
     *   - valid canonical goal contract must exist
     *   - action graph / planning proof must be compiled (COMPILE_GOAL_EQUATION)
     *   - COMPLETE_ONBOARDING alone is not sufficient
     *
     * Canonical output:
     *   - writes to state.proposedBlocks via setCycleProposedBlocks()
     *   - writes preview metadata to state.planPreview and cycle.autoAsanaPlan
     *
     * Behavior branches:
     *   - normal flow: may auto-commit proposals after generation
     *   - preview flow: payload.source === 'RENEGOTIATION_APPLY'
     *       proposals remain in 'suggested' state, no auto-commit
     *
     * Canonical read source for downstream modules:
     *   - state.proposedBlocks (not suggestedBlocks)
     *
     * Scope boundary:
     *   - this module generates proposals only
     *   - commit/persistence is Module 8 (APPLY_DRAFT_SCHEDULE)
     *   - do not add commit logic here
     */
    case 'GENERATE_PLAN':
      generatePlan(next, action.payload || {});
      break;
    case 'REBUILD_SCHEDULE':
      generatePlan(next, action.payload || {});
      break;
    case 'APPLY_PLAN':
      // The user-facing "Apply schedule" action must commit the reviewed draft
      // proposal, not bypass preview by replaying the legacy auto-plan branch.
      applyDraftSchedule(next, action.payload || {});
      break;
    case 'SET_PLAN_RESOLUTION_KIND':
      setPlanResolutionKind(next, action.payload || {});
      break;
    case 'ACTIVATE_SCHEDULE':
      activateSchedule(next, action.payload || {});
      break;
    case 'REBASE_SCHEDULE':
      rebaseSchedule(next, action.payload || {});
      break;
    case 'APPLY_DRAFT_SCHEDULE':
      applyDraftSchedule(next, action.payload || {});
      break;
    case 'APPLY_RENEGOTIATION_OPTION':
      applyRenegotiationOption(next, action.payload || {});
      break;
    case 'SET_SCHEDULING_CONSTRAINTS': {
      const payload = action.payload || {};
      const nextConstraints = payload.constraints || {};
      next.constraints = {
        ...(next.constraints || {}),
        ...nextConstraints,
      };
      if (payload.availabilityPolicy) {
        next.availabilityPolicy = {
          ...(next.availabilityPolicy || {}),
          ...payload.availabilityPolicy,
        };
      }
      break;
    }
    case 'UPDATE_WORK_WINDOWS': {
      const payload = action.payload || {};
      const cycleId = payload.cycleId || next.activeCycleId;
      const cycle = cycleId ? next.cyclesById?.[cycleId] : null;
      if (!cycle) {
        break;
      }
      if (!cycle.goalContract) {
        cycle.goalContract = {};
      }
      const normalizedWorkWindows = normalizeCanonicalWorkWindows(payload.workWindows || {});
      const workWindowCount = countRawWorkWindows(normalizedWorkWindows);
      const workWindowsSource = workWindowCount > 0 ? 'user_defined' : 'unset';
      const capacityValidation =
        workWindowCount > 0 ? buildCycleCapacityValidation(next, cycle, normalizedWorkWindows) : null;
      const constraintsStatus =
        workWindowCount === 0 ? 'unsaved' : capacityValidation?.status === 'insufficient' ? 'insufficient' : 'approved';
      cycle.goalContract.workWindows = normalizedWorkWindows;
      cycle.goalContract.workWindowsSource = workWindowsSource;
      cycle.goalContract.workWindowsSavedAtISO = next.appTime?.nowISO || new Date().toISOString();
      cycle.goalContract.constraintsStatus = constraintsStatus;
      cycle.goalContract.capacityValidation = capacityValidation;
      cycle.constraintsStatus = constraintsStatus;
      cycle.capacityValidation = capacityValidation;
      if (next.activeCycleId === cycleId) {
        next.goalExecutionContract = {
          ...(next.goalExecutionContract || {}),
          workWindows: normalizedWorkWindows,
          workWindowsSource,
          constraintsStatus,
          capacityValidation,
        };
      }
      next.availabilityPolicy = {
        ...(next.availabilityPolicy || {}),
        workWindows: normalizedWorkWindows,
        weeklyWindows: toSchedulerWeeklyWindows(normalizedWorkWindows),
        constraintsStatus,
        workWindowsSource,
        workWindowsSavedAtISO: cycle.goalContract.workWindowsSavedAtISO,
        capacityValidation,
        availableWeeklyMinutes: Number(capacityValidation?.availableWeeklyMinutes || 0),
      };
      next.cyclesById[cycleId] = cycle;
      break;
    }
    case 'COMMIT_PREVIEW_ITEMS': {
      const payload = action.payload || {};
      const cycleId = payload.cycleId || next.activeCycleId;
      const items = Array.isArray(payload.items) ? payload.items : [];
      const cycle = cycleId ? next.cyclesById?.[cycleId] : null;
      if (!cycle) {
        next.lastPlanError = {
          code: 'CYCLE_NOT_FOUND',
          reason: 'Active cycle missing for commit.',
        };
        break;
      }
      if (items.length === 0) {
        next.lastPlanError = {
          code: 'NO_PROPOSED_BLOCKS',
          reason: 'No preview items to commit.',
        };
        break;
      }
      const goalId = cycle.goalContract?.goalId || next.goalExecutionContract?.goalId;
      items.forEach((item, index) => {
        const startISO = item.startISO || (item.dayKey ? `${item.dayKey}T09:00:00.000Z` : null);
        const minutes = Number.isFinite(item.minutes)
          ? item.minutes
          : Number.isFinite(item.durationMin)
            ? item.durationMin
            : 30;
        const title = item.title?.trim() ? item.title.trim() : `Planned work ${index + 1}`;
        if (!startISO || !title) {
          next.lastPlanError = {
            code: 'INVALID_PREVIEW_ITEM',
            reason: `Preview item ${index + 1} missing required metadata.`,
          };
          return;
        }
        createBlock(next, {
          cycleId,
          goalId,
          startISO,
          durationMinutes: minutes,
          domain: item.domainKey || 'FOCUS',
          title,
          origin: 'preview_commit',
          surface: 'today',
        });
      });
      if (!next.lastPlanError || next.lastPlanError.code !== 'INVALID_PREVIEW_ITEM') {
        next.lastPlanError = null;
      }
      break;
    }
    case 'SET_STRATEGY':
      setStrategy(next, action.payload);
      break;
    case 'GENERATE_COLD_PLAN':
      generateColdPlanForCycle(next, { rebaseMode: 'NONE' });
      break;
    case 'REBASE_COLD_PLAN':
      generateColdPlanForCycle(next, { rebaseMode: 'REMAINING_FROM_TODAY' });
      break;
    case 'ACCEPT_SUGGESTED_BLOCK':
      acceptSuggestedBlock(next, action.proposalId);
      break;
    case 'REJECT_SUGGESTED_BLOCK':
      rejectSuggestedBlock(next, action.proposalId, action.reason);
      break;
    case 'IGNORE_SUGGESTED_BLOCK':
      ignoreSuggestedBlock(next, action.proposalId);
      break;
    case 'DISMISS_SUGGESTED_BLOCK':
      dismissSuggestedBlock(next, action.proposalId);
      break;
    case 'SET_SELECTED_HORIZON_MODE': {
      const VALID_HORIZON_MODES = new Set(['current_cycle', '1_year', '2_year', '3_year', '4_year', '5_year', 'full_horizon']);
      if (VALID_HORIZON_MODES.has(action.mode)) {
        next.selectedHorizonMode = action.mode;
      }
      break;
    }
    case 'NO_OP':
      break;
    default:
      break;
  }
  const perfApplyEventsStart = debugPerfActions ? Date.now() : 0;
  applyExecutionEvents(next);
  const perfApplyEventsMs = debugPerfActions ? Date.now() - perfApplyEventsStart : 0;
  const survivingPriorBlocks = previousTodayBlocks.filter(
    (block) => !block?.cycleId || block?.cycleId === next.activeCycleId
  );
  const perfMergeStart = debugPerfActions ? Date.now() : 0;
  mergePriorTodayBlocks(next, survivingPriorBlocks);
  const perfMergeMs = debugPerfActions ? Date.now() - perfMergeStart : 0;
  const activeCycleForReview = next.activeCycleId ? next.cyclesById?.[next.activeCycleId] || null : null;
  if (activeCycleForReview) {
    mergeScheduleReviewBlocksIntoCycleProjection(next, activeCycleForReview);
  }
  const perfRecomputeStart = debugPerfActions ? Date.now() : 0;
  recomputeSummaries(next);
  const perfRecomputeMs = debugPerfActions ? Date.now() - perfRecomputeStart : 0;
  next.vector = recalculateIdentityVector(next);
  const allowAdapt =
    action.type === 'COMPLETE_BLOCK' || action.type === 'BEGIN_BLOCK' || action.type === 'RESCHEDULE_BLOCK';
  const adapted = allowAdapt && adaptPatternTargets(next);
  if (adapted) {
    recomputeSummaries(next);
    next.vector = recalculateIdentityVector(next);
  }
  next.stability = {
    headline: buildStabilityHeadline(next.vector, next.currentWeek),
    actionLine: buildStabilityAction(next.vector),
  };
  next.coreContinuity = computeCoreContinuity(next);
  const governed = computeNextSuggestion(next);
  next.nextSuggestion = governed.suggestion;
  applySuggestionGovernance(next, prevSuggestion, governed);
  normalizeActiveCycleExecutionGraph(next);
  applyGoalDirective(next);
  if (debugPerfActions) {
    next.debug = next.debug || {};
    next.debug.lastPerfAction = {
      type: action.type,
      totalMs: Date.now() - perfActionStart,
      applyExecutionEventsMs: perfApplyEventsMs,
      mergePriorTodayBlocksMs: perfMergeMs,
      recomputeSummariesMs: perfRecomputeMs,
      applyDraftSchedulePhases: next.debug?.applyDraftSchedulePhases || null,
    };
  }
  applyProbabilityEligibility(next);
  applyPlanQualityGates(next);
  applyEnterpriseIdentityAudit(next);
  applyProbabilityScoring(next);
  applyFeasibility(next);
  applyProgressCredit(next);
  applyCycleDynamics(next);
  next.profileLearning = computeProfileLearning(next.cyclesById);
  if (applySuggestionEventOverrides(next)) {
    next.planPreview = computePlanPreview({
      suggestedBlocks: next.proposedBlocks || [],
      planDraft: next.planDraft,
      contract: next.goalExecutionContract,
      policyState: getCurrentPolicyState(next),
      historyProfile: buildHistoryProfileForDraft(next, next.planDraft),
      timeZone: next.appTime?.timeZone || APP_TIME_ZONE,
    });
  }
  applyCycleScoring(next);
  applySystemShotClock(next);
  applyExecutionCorrection(next);
  applyGoalPolicy(next);
  applyScheduleLifecycleState(next);
  applyLongHorizonCalendarBlocks(next);
  applyInterCycleConsistencyDiagnostics(next);
  applyGoalLifecycleState(next);
  next.correctionSignals = computeCorrectionSignals(next, 14);
  mergePriorTodayBlocks(next, previousTodayBlocks);
  syncPlacementStateFromEvents(next);
  enforceSafeDefaults(next);
  syncSuggestedBlocksMirror(next);
  flagDraftBlocks(next);
  ensureProfileOwnership(next);
  ensureMasterPlanOwnership(next);
  quarantineOrphanedActiveExecution(next);
  deriveProfileExecutionContainment(next);
  persistActiveCycleState(next);
  enforceActiveCycleTodayBlocks(next, hadCycleRecords);
  enforceExecutionStartBoundary(next);
  return next;
}

function ensureProfileOwnership(state) {
  const requestedProfileId = String(state?.activeProfileId || DEFAULT_PROFILE_ID).trim() || DEFAULT_PROFILE_ID;
  state.activeProfileId = requestedProfileId;
  state.profilesById =
    state?.profilesById && typeof state.profilesById === 'object' && !Array.isArray(state.profilesById)
      ? state.profilesById
      : {};
  state.goalsById =
    state?.goalsById && typeof state.goalsById === 'object' && !Array.isArray(state.goalsById) ? state.goalsById : {};

  const ensureProfileRecord = (profileId, fallbackLabel = DEFAULT_PROFILE_LABEL) => {
    const normalizedProfileId = String(profileId || requestedProfileId).trim() || requestedProfileId;
    const existing = state.profilesById[normalizedProfileId] || {};
    const displayName = String(existing.displayName || existing.label || fallbackLabel).trim() || fallbackLabel;
    const roleLabel = String(existing.roleLabel || existing.profileRole || '').trim();
    state.profilesById[normalizedProfileId] = {
      ...existing,
      id: normalizedProfileId,
      label: existing.label || displayName,
      displayName,
      roleLabel: roleLabel || null,
      goalIds: Array.isArray(existing.goalIds) ? [...new Set(existing.goalIds.filter(Boolean).map(String))] : [],
      activeGoalId: existing.activeGoalId || null,
      createdAtISO: existing.createdAtISO || state?.meta?.createdAtISO || state?.appTime?.nowISO || new Date().toISOString(),
      status: existing.status || 'active',
      // Agenda metadata ownership
      agendaVersionIds: Array.isArray(existing.agendaVersionIds) ? [...new Set(existing.agendaVersionIds.filter(Boolean).map(String))] : [],
      agendaConstraintVersionIds: Array.isArray(existing.agendaConstraintVersionIds) ? [...new Set(existing.agendaConstraintVersionIds.filter(Boolean).map(String))] : [],
    };
    return state.profilesById[normalizedProfileId];
  };

  ensureProfileRecord(requestedProfileId);

  const goalToProfile = new Map();
  Object.entries(state.goalsById || {}).forEach(([goalId, goalRecord]) => {
    if (!goalId) {
      return;
    }
    const profileId =
      String(goalRecord?.profileId || requestedProfileId).trim() || requestedProfileId;
    const existing = state.goalsById[goalId] || {};
    state.goalsById[goalId] = {
      ...existing,
      id: String(goalId),
      profileId,
      cycleIds: Array.isArray(existing.cycleIds) ? [...new Set(existing.cycleIds.filter(Boolean).map(String))] : [],
      activeCycleId: existing.activeCycleId || null,
      status: existing.status || 'active',
    };
    ensureProfileRecord(profileId);
    goalToProfile.set(String(goalId), profileId);
  });

  Object.values(state.cyclesById || {}).forEach((cycle) => {
    if (!cycle?.id) {
      return;
    }
    const goalId =
      String(
        cycle.goalId ||
          cycle.goalGovernanceContract?.goalId ||
          cycle.goalContract?.goalId ||
          cycle.contract?.goalId ||
          ''
      ).trim() || null;
    if (!goalId) {
      return;
    }
    const profileId =
      String(
        cycle.profileId ||
          cycle.goalGovernanceContract?.profileId ||
          cycle.goalContract?.profileId ||
          cycle.contract?.profileId ||
          goalToProfile.get(goalId) ||
          requestedProfileId
      ).trim() || requestedProfileId;

    cycle.goalId = goalId;
    cycle.profileId = profileId;
    if (cycle.goalContract) {
      cycle.goalContract.goalId = cycle.goalContract.goalId || goalId;
      cycle.goalContract.profileId = cycle.goalContract.profileId || profileId;
    }
    if (cycle.goalGovernanceContract) {
      cycle.goalGovernanceContract.goalId = cycle.goalGovernanceContract.goalId || goalId;
      cycle.goalGovernanceContract.profileId = cycle.goalGovernanceContract.profileId || profileId;
    }
    if (cycle.contract) {
      cycle.contract.goalId = cycle.contract.goalId || goalId;
      cycle.contract.profileId = cycle.contract.profileId || profileId;
    }

    ensureProfileRecord(profileId);
    const existingGoal = state.goalsById[goalId] || {};
    const cycleIds = Array.isArray(existingGoal.cycleIds) ? existingGoal.cycleIds : [];
    state.goalsById[goalId] = {
      ...existingGoal,
      id: goalId,
      profileId,
      cycleIds: cycleIds.includes(cycle.id) ? cycleIds : [...cycleIds, cycle.id],
      activeCycleId:
        state.activeCycleId === cycle.id
          ? cycle.id
          : existingGoal.activeCycleId || cycle.id,
      status: existingGoal.status || 'active',
      title:
        existingGoal.title ||
        cycle.goalContract?.goalLabel ||
        cycle.goalContract?.goalText ||
        cycle.contract?.goalText ||
        null,
    };
    goalToProfile.set(goalId, profileId);
  });

  Object.values(state.profilesById || {}).forEach((profile) => {
    if (!profile?.id) {
      return;
    }
    profile.goalIds = [];
    profile.activeGoalId = null;
  });

  Object.entries(state.goalsById || {}).forEach(([goalId, goalRecord]) => {
    if (!goalId) {
      return;
    }
    const profileId = String(goalRecord?.profileId || requestedProfileId).trim() || requestedProfileId;
    const profile = ensureProfileRecord(profileId);
    if (!profile.goalIds.includes(goalId)) {
      profile.goalIds.push(goalId);
    }
    if (goalRecord?.activeCycleId && state.activeCycleId === goalRecord.activeCycleId) {
      profile.activeGoalId = goalId;
    }
  });

  const activeCycle = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] || null : null;
  if (activeCycle?.id) {
    const activeCycleProfileId = String(activeCycle.profileId || requestedProfileId).trim() || requestedProfileId;
    if (activeCycleProfileId !== state.activeProfileId) {
      state.activeCycleId = null;
      state.activeGoalId = null;
    } else {
      state.activeGoalId = activeCycle.goalId || state.activeGoalId || null;
      state.profilesById[state.activeProfileId].activeGoalId = state.activeGoalId || null;
    }
  } else if (state.activeGoalId) {
    const activeGoal = state.goalsById?.[state.activeGoalId] || null;
    if (!activeGoal || activeGoal.profileId !== state.activeProfileId) {
      state.activeGoalId = null;
    } else {
      state.profilesById[state.activeProfileId].activeGoalId = state.activeGoalId;
    }
  }

  if (state.goalExecutionContract) {
    const goalId = String(state.goalExecutionContract.goalId || state.activeGoalId || '').trim() || null;
    const profileId =
      (goalId && state.goalsById?.[goalId]?.profileId) ||
      activeCycle?.profileId ||
      state.activeProfileId;
    state.goalExecutionContract.profileId = profileId;
    if (goalId) {
      state.goalExecutionContract.goalId = goalId;
    }
    if (
      activeCycle?.goalContract?.workWindows &&
      countRawWorkWindows(state.goalExecutionContract.workWindows || {}) === 0 &&
      countRawWorkWindows(activeCycle.goalContract.workWindows || {}) > 0
    ) {
      state.goalExecutionContract.workWindows = normalizeCanonicalWorkWindows(activeCycle.goalContract.workWindows);
      state.goalExecutionContract.workWindowsSource =
        activeCycle.goalContract.workWindowsSource || state.goalExecutionContract.workWindowsSource || 'user_defined';
      state.goalExecutionContract.constraintsStatus =
        activeCycle.goalContract.constraintsStatus || state.goalExecutionContract.constraintsStatus || 'approved';
      state.goalExecutionContract.capacityValidation =
        activeCycle.goalContract.capacityValidation || state.goalExecutionContract.capacityValidation || null;
    }
  }
}

function getMasterPlanIdFromGoalId(goalId) {
  const normalizedGoalId = String(goalId || '').trim();
  if (!normalizedGoalId.startsWith('masterplan:')) {
    return null;
  }
  return normalizedGoalId.slice('masterplan:'.length) || null;
}

function ensureMasterPlanOwnership(state) {
  const requestedProfileId = String(state?.activeProfileId || DEFAULT_PROFILE_ID).trim() || DEFAULT_PROFILE_ID;
  state.masterPlansById =
    state?.masterPlansById && typeof state.masterPlansById === 'object' && !Array.isArray(state.masterPlansById)
      ? state.masterPlansById
      : {};

  Object.values(state.profilesById || {}).forEach((profile) => {
    if (!profile?.id) {
      return;
    }
    profile.masterPlanIds = Array.isArray(profile.masterPlanIds)
      ? [...new Set(profile.masterPlanIds.filter(Boolean).map(String))]
      : [];
    if (!('activeMasterPlanId' in profile)) {
      profile.activeMasterPlanId = null;
    }
  });

  Object.entries(state.masterPlansById || {}).forEach(([planId, planRecord]) => {
    if (!planId || !planRecord) {
      return;
    }
    const profileId = String(planRecord.profileId || requestedProfileId).trim() || requestedProfileId;
    planRecord.id = String(planId);
    planRecord.profileId = profileId;
    const profile = state.profilesById?.[profileId];
    if (!profile) {
      return;
    }
    if (!profile.masterPlanIds.includes(planRecord.id)) {
      profile.masterPlanIds.push(planRecord.id);
    }
  });

  const activeCycle = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] || null : null;
  const inferredPlanIdCandidate =
    activeCycle?.masterPlanId ||
    getMasterPlanIdFromGoalId(activeCycle?.goalId) ||
    getMasterPlanIdFromGoalId(activeCycle?.goalGovernanceContract?.goalId) ||
    getMasterPlanIdFromGoalId(activeCycle?.goalContract?.goalId) ||
    getMasterPlanIdFromGoalId(state?.activeGoalId) ||
    null;
  const inferredPlanIdFromCycle = inferredPlanIdCandidate ? String(inferredPlanIdCandidate).trim() || null : null;

  Object.values(state.profilesById || {}).forEach((profile) => {
    if (!profile?.id) {
      return;
    }
    const validPlanIds = profile.masterPlanIds.filter((planId) => {
      const plan = state.masterPlansById?.[planId] || null;
      return Boolean(plan && plan.profileId === profile.id);
    });
    profile.masterPlanIds = validPlanIds;
    const activeMasterPlanId = String(profile.activeMasterPlanId || '').trim() || null;
    if (activeMasterPlanId && validPlanIds.includes(activeMasterPlanId)) {
      return;
    }
    if (profile.id === requestedProfileId && inferredPlanIdFromCycle && validPlanIds.includes(inferredPlanIdFromCycle)) {
      profile.activeMasterPlanId = inferredPlanIdFromCycle;
      return;
    }
    profile.activeMasterPlanId = validPlanIds.length === 1 ? validPlanIds[0] : null;
  });
}

function setPersistenceRecovery(state, details = {}) {
  const required = details.required || 'PERSISTED_PLAN_MISSING';
  const nowISO = state?.appTime?.nowISO || new Date().toISOString();
  state.planRecovery = {
    required,
    route: details.route || 'STRUCTURE_INTAKE',
    sourceErrorCode: details.sourceErrorCode || required,
    createdAtISO: nowISO,
    persistenceFailure: {
      profileFound: Boolean(state?.activeProfileId),
      activeProfileId: state?.activeProfileId || null,
      orphanedCycleId: details.orphanedCycleId || null,
      missingGoalId: details.missingGoalId || null,
      missingMasterPlanId: details.missingMasterPlanId || null,
      reasonCodes: Array.isArray(details.reasonCodes) ? details.reasonCodes : [],
    },
  };
}

function clearExecutionResidue(state) {
  state.activeCycleId = null;
  state.activeGoalId = null;
  if (state?.activeProfileId && state?.profilesById?.[state.activeProfileId]) {
    state.profilesById[state.activeProfileId].activeGoalId = null;
  }
  state.goalExecutionContract = null;
  state.proposedBlocks = [];
  state.suggestedBlocks = [];
  state.executionEvents = [];
  state.externalEvidenceEvents = [];
  state.planMutationEvents = [];
  state.truthEntries = [];
  state.planDraft = null;
  state.planPreview = null;
  state.correctionSignals = null;
  state.scheduleApplied = false;
  state.scheduleLifecycle = 'no_schedule';
  state.scheduleReviewBlocks = [];
}

function quarantineOrphanedActiveExecution(state) {
  const activeProfileId = String(state?.activeProfileId || DEFAULT_PROFILE_ID).trim() || DEFAULT_PROFILE_ID;
  const activeProfile = state?.profilesById?.[activeProfileId] || null;
  const activeCycleId = String(state?.activeCycleId || '').trim() || null;
  if (!activeCycleId) {
    if (
      activeProfile &&
      !activeProfile.activeMasterPlanId &&
      !state.activeGoalId &&
      Array.isArray(activeProfile.masterPlanIds) &&
      activeProfile.masterPlanIds.length === 0 &&
      state.planRecovery?.required === 'PERSISTED_PLAN_MISSING'
    ) {
      return;
    }
    return;
  }

  const activeCycle = state?.cyclesById?.[activeCycleId] || null;
  const activeGoalId =
    String(
      activeCycle?.goalId ||
        activeCycle?.goalGovernanceContract?.goalId ||
        activeCycle?.goalContract?.goalId ||
        activeCycle?.contract?.goalId ||
        state?.activeGoalId
    ).trim() || null;
  const activeGoal = activeGoalId ? state?.goalsById?.[activeGoalId] || null : null;
  const masterPlanIdCandidate =
    activeCycle?.masterPlanId ||
    getMasterPlanIdFromGoalId(activeGoalId) ||
    getMasterPlanIdFromGoalId(state?.activeGoalId) ||
    null;
  const masterPlanId = masterPlanIdCandidate ? String(masterPlanIdCandidate).trim() || null : null;
  const activeMasterPlan = masterPlanId ? state?.masterPlansById?.[masterPlanId] || null : null;
  const reasonCodes = [];

  if (!activeCycle) {
    reasonCodes.push('ACTIVE_CYCLE_RECORD_MISSING');
  }
  if (activeCycle && !activeGoal) {
    reasonCodes.push('ACTIVE_CYCLE_GOAL_MISSING');
  }
  if (activeGoal && activeGoal.profileId && activeGoal.profileId !== activeProfileId) {
    reasonCodes.push('ACTIVE_GOAL_PROFILE_MISMATCH');
  }
  if (masterPlanId && !activeMasterPlan) {
    reasonCodes.push('ACTIVE_MASTER_PLAN_MISSING');
  }
  if (activeMasterPlan && activeMasterPlan.profileId && activeMasterPlan.profileId !== activeProfileId) {
    reasonCodes.push('ACTIVE_MASTER_PLAN_PROFILE_MISMATCH');
  }

  if (reasonCodes.length === 0) {
    if (state.planRecovery?.required === 'PERSISTED_PLAN_MISSING') {
      state.planRecovery = null;
    }
    return;
  }

  if (activeCycle) {
    activeCycle.status = 'orphaned';
    activeCycle.orphanedAtISO = state?.appTime?.nowISO || new Date().toISOString();
    activeCycle.orphanedReasonCodes = reasonCodes;
  }

  clearExecutionResidue(state);
  setPersistenceRecovery(state, {
    required: 'PERSISTED_PLAN_MISSING',
    sourceErrorCode: 'PERSISTED_PLAN_MISSING',
    orphanedCycleId: activeCycleId,
    missingGoalId: !activeGoal ? activeGoalId : null,
    missingMasterPlanId: masterPlanId && !activeMasterPlan ? masterPlanId : null,
    reasonCodes,
  });
}

export function hydrateActiveCycleState(state) {
  ensureCycleStructures(state);
  const cycle = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] : null;
  if (!cycle) {
    return state;
  }
  state.executionEvents = Array.isArray(cycle.executionEvents) ? cycle.executionEvents : state.executionEvents || [];
  state.externalEvidenceEvents = Array.isArray(cycle.externalEvidenceEvents)
    ? cycle.externalEvidenceEvents
    : state.externalEvidenceEvents || [];
  state.suggestionEvents = cycle.suggestionEvents || [];
  state.proposedBlocks = cycle.proposedBlocks || cycle.suggestedBlocks || [];
  if (!state.proposedBlocksByCycleId || typeof state.proposedBlocksByCycleId !== 'object') {
    state.proposedBlocksByCycleId = {};
  }
  state.proposedBlocksByCycleId[cycle.id] = state.proposedBlocks;
  state.suggestedBlocks = state.proposedBlocks;
  state.planDraft = cycle.planDraft || null;
  state.planCalibration = cycle.calibration ||
    state.planCalibration || { confidence: 0, assumptions: [], missingInfo: [] };
  state.planPreview = cycle.planPreview || null;
  state.correctionSignals = cycle.correctionSignals || null;
  state.scheduleLifecycle = normalizeScheduleLifecycle(
    cycle.scheduleLifecycle || state.scheduleLifecycle || 'no_schedule'
  );
  state.scheduleReviewBlocks = Array.isArray(cycle.scheduleReviewBlocks) ? cycle.scheduleReviewBlocks : [];
  state.scheduleApplied = Boolean(
    state.scheduleApplied ||
    state.scheduleLifecycle === 'applied_review' ||
    state.scheduleLifecycle === 'active_schedule'
  );
  state.goalExecutionContract = {
    ...(state.goalExecutionContract || {}),
    ...(cycle.goalContract || cycle.contract || {}),
  };
  if (
    countRawWorkWindows(state.goalExecutionContract?.workWindows || {}) === 0 &&
    countRawWorkWindows(cycle?.goalContract?.workWindows || {}) > 0
  ) {
    state.goalExecutionContract.workWindows = normalizeCanonicalWorkWindows(cycle.goalContract.workWindows);
    state.goalExecutionContract.workWindowsSource =
      cycle.goalContract.workWindowsSource || state.goalExecutionContract.workWindowsSource || 'user_defined';
    state.goalExecutionContract.constraintsStatus =
      cycle.goalContract.constraintsStatus || state.goalExecutionContract.constraintsStatus || 'approved';
    state.goalExecutionContract.capacityValidation =
      cycle.goalContract.capacityValidation || state.goalExecutionContract.capacityValidation || null;
  }
  state.activeProfileId = cycle.profileId || state.goalExecutionContract?.profileId || state.activeProfileId || DEFAULT_PROFILE_ID;
  state.goalExecutionContract.profileId = state.goalExecutionContract.profileId || cycle.profileId || state.activeProfileId;
  state.activeGoalId =
    cycle.goalId ||
    cycle.goalGovernanceContract?.goalId ||
    cycle.goalContract?.goalId ||
    cycle.contract?.goalId ||
    state.activeGoalId ||
    null;
  state.truthEntries = cycle.truthEntries || state.truthEntries || [];
  state.suggestionHistory = cycle.suggestionHistory || state.suggestionHistory || null;
  state.lastPlanError = null;
  return state;
}

export function persistActiveCycleState(state) {
  ensureCycleStructures(state);
  const cycle = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] : null;
  if (!cycle) {
    return state;
  }
  cycle.executionEvents = state.executionEvents || [];
  cycle.externalEvidenceEvents = state.externalEvidenceEvents || [];
  cycle.suggestionEvents = state.suggestionEvents || [];
  cycle.proposedBlocks = state.proposedBlocks || [];
  cycle.suggestedBlocks = cycle.proposedBlocks;
  cycle.planDraft = state.planDraft || null;
  cycle.calibration = state.planCalibration || null;
  cycle.planPreview = state.planPreview || null;
  cycle.correctionSignals = state.correctionSignals || null;
  cycle.scheduleLifecycle = normalizeScheduleLifecycle(
    state.scheduleLifecycle || cycle.scheduleLifecycle || 'no_schedule'
  );
  cycle.scheduleReviewBlocks = Array.isArray(state.scheduleReviewBlocks)
    ? state.scheduleReviewBlocks
    : Array.isArray(cycle.scheduleReviewBlocks)
      ? cycle.scheduleReviewBlocks
      : [];
  cycle.scheduleAppliedAtISO = cycle.scheduleAppliedAtISO || state.draftScheduleAppliedAtISO || null;
  cycle.scheduleActivatedAtISO = cycle.scheduleActivatedAtISO || null;
  cycle.contract = cycle.goalContract || cycle.contract || state.goalExecutionContract || null;
  cycle.goalId = cycle.goalId || cycle.goalGovernanceContract?.goalId || cycle.goalContract?.goalId || state.activeGoalId || null;
  cycle.profileId = cycle.profileId || state.goalExecutionContract?.profileId || state.activeProfileId || DEFAULT_PROFILE_ID;
  state.goalExecutionContract = {
    ...(state.goalExecutionContract || {}),
    ...(cycle.goalContract || cycle.contract || {}),
  };
  state.goalExecutionContract.profileId =
    state.goalExecutionContract.profileId || cycle.profileId || state.activeProfileId || DEFAULT_PROFILE_ID;
  cycle.truthEntries = state.truthEntries || cycle.truthEntries || [];
  cycle.suggestionHistory = state.suggestionHistory || cycle.suggestionHistory || null;
  state.cyclesById[state.activeCycleId] = cycle;
  return state;
}

function getActiveCycleId(state) {
  return state.activeCycleId || state.cycles?.activeId || state.cycle?.id || state.activeCycle?.id || null;
}

function enforceActiveCycleTodayBlocks(state, hadCycleRecords = false) {
  const activeCycleId = getActiveCycleId(state);
  const hasCycleRecords = hadCycleRecords || Boolean(state.cyclesById && Object.keys(state.cyclesById).length);
  if (!state.today) {
    state.today = { blocks: [] };
    return;
  }
  if (!state.today.blocks) {
    state.today.blocks = [];
    if (!activeCycleId && hasCycleRecords) {
      state.today.blocks = [];
    }
    return;
  }
  if (!activeCycleId) {
    if (hasCycleRecords) {
      state.today.blocks = [];
    }
    return;
  }
  state.today.blocks = state.today.blocks.filter((block) => block?.cycleId === activeCycleId);
}

function collectGovernanceContracts(state) {
  const fallbackGoalId = state?.activeGoalId || state?.goalExecutionContract?.goalId || null;
  const cycle =
    (state?.activeCycleId ? state?.cyclesById?.[state.activeCycleId] || null : null) ||
    resolveCycleForGoal(state, fallbackGoalId);
  if (!cycle) {
    return [];
  }
  const activeContract = cycle.goalGovernanceContract || null;
  const canonicalContract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
  const canonicalGoalId = canonicalContract?.goalId || null;
  if (activeContract?.goalId) {
    if (canonicalGoalId && activeContract.goalId !== canonicalGoalId) {
      return [{ ...activeContract, goalId: canonicalGoalId }];
    }
    return [activeContract];
  }
  if (activeContract && canonicalGoalId) {
    return [{ ...activeContract, goalId: canonicalGoalId }];
  }
  if (!canonicalGoalId) {
    return [];
  }
  const timezone = canonicalContract?.timezone || state?.appTime?.timeZone || APP_TIME_ZONE;
  return [
    {
      contractId: activeContract?.contractId || `gov-synth-${cycle.id || state.activeCycleId}`,
      version: Number.isFinite(Number(activeContract?.version)) ? Number(activeContract.version) : 1,
      goalId: canonicalGoalId,
      activeFromISO: canonicalContract?.startDayKey || state?.appTime?.activeDayKey || nowDayKey(timezone),
      activeUntilISO: canonicalContract?.endDayKey || canonicalContract?.deadline?.dayKey || null,
      scope: {
        domainsAllowed: [],
        timeHorizon: 'week',
        timezone,
      },
      governance: {
        suggestionsEnabled: true,
        probabilityEnabled: true,
        minEvidenceEvents: 1,
      },
      constraints: {
        forbiddenDirectives: ['repair'],
        maxActiveBlocks: 6,
      },
    },
  ];
}

function sameSuggestion(a, b) {
  if (!a || !b) {
    return false;
  }
  return a.type === b.type && a.blockId === b.blockId && a.startISO === b.startISO && a.endISO === b.endISO;
}

function applySuggestionGovernance(state, previousSuggestion, governed) {
  const nowISO = nowDayKey();
  const nowTimestampISO = new Date().toISOString();
  const history = state.suggestionHistory || {
    dayKey: nowISO,
    count: 0,
    lastSuggestedAtISO: null,
    lastSuggestedAtISOByGoal: {},
    dailyCountByGoal: {},
    denials: [],
  };
  state.suggestionEligibility = governed.eligibilityByGoal || {};

  if (!state.nextSuggestion || !governed.selectedGoalId) {
    state.suggestionHistory = history;
    return;
  }

  const goalId = governed.selectedGoalId;
  const perGoalLast = history.lastSuggestedAtISOByGoal || {};
  const perGoalDaily = history.dailyCountByGoal || {};
  const dayCounts = perGoalDaily[goalId] || {};
  const dayKey = nowISO;
  const existingCount = dayCounts[dayKey] || 0;

  if (!sameSuggestion(state.nextSuggestion, previousSuggestion)) {
    dayCounts[dayKey] = existingCount + 1;
    perGoalDaily[goalId] = dayCounts;
    perGoalLast[goalId] = nowTimestampISO;
  }

  state.suggestionHistory = {
    ...history,
    dayKey: nowISO,
    count: history.dayKey === nowISO ? history.count : 0,
    lastSuggestedAtISO: history.lastSuggestedAtISO,
    lastSuggestedAtISOByGoal: perGoalLast,
    dailyCountByGoal: perGoalDaily,
  };
  if (governed.denials?.length) {
    const denials = [...(history.denials || [])];
    governed.denials.forEach((d) => denials.push(d));
    if (denials.length > 50) {
      denials.splice(0, denials.length - 50);
    }
    state.suggestionHistory.denials = denials;
  }
}

function applyExecutionEvents(state) {
  const events = state.executionEvents || [];
  if (!events.length) {
    return;
  }
  const { days, todayBlocks } = materializeBlocksFromEvents(events, { todayISO: state.today?.date });
  state.today.blocks = todayBlocks || [];
  state.cycle = days || [];
}

function normalizeScheduleLifecycle(value) {
  const lifecycle = String(value || '')
    .trim()
    .toLowerCase();
  if (
    lifecycle === 'draft_schedule_ready' ||
    lifecycle === 'applied_review' ||
    lifecycle === 'active_schedule' ||
    lifecycle === 'reschedule_pending' ||
    lifecycle === 'stale_draft_invalidated' ||
    lifecycle === 'no_schedule'
  ) {
    return lifecycle;
  }
  return 'no_schedule';
}

function getCycleScheduleLifecycle(cycle = null, state = null) {
  return normalizeScheduleLifecycle(cycle?.scheduleLifecycle || state?.scheduleLifecycle || 'no_schedule');
}

function deriveScheduleLifecycleState(state) {
  const activeProfileId = String(state?.activeProfileId || '').trim();
  const activeProfile = activeProfileId ? state?.profilesById?.[activeProfileId] || null : null;
  const activeCycle = state?.activeCycleId ? state?.cyclesById?.[state.activeCycleId] || null : null;
  const activeMasterPlanId = String(activeProfile?.activeMasterPlanId || '').trim();
  const hasStrategicGoalContext = Boolean(
    activeCycle?.goalContract ||
      state?.goalExecutionContract ||
      state?.activeGoalId ||
      activeProfile?.activeGoalId ||
      activeMasterPlanId
  );
  if (!hasStrategicGoalContext) {
    return 'no_goal';
  }
  if (!activeCycle) {
    return state?.scheduleLifecycleState === 'inter_cycle' ? 'inter_cycle' : 'goal_admitted';
  }
  const cycleStatus = String(activeCycle?.status || activeCycle?.state || '')
    .trim()
    .toLowerCase();
  if (['completed', 'ended', 'archived', 'deleted', 'abandoned'].includes(cycleStatus)) {
    return 'terminal';
  }
  const lifecycle = getCycleScheduleLifecycle(activeCycle, state);
  if (lifecycle === 'active_schedule') {
    return hasMeaningfulExecutionEvidence(activeCycle?.executionEvents || state?.executionEvents || [])
      ? 'in_execution'
      : 'activated';
  }
  if (lifecycle === 'applied_review') {
    return 'schedule_applied';
  }
  if (
    lifecycle === 'draft_schedule_ready' ||
    (Array.isArray(activeCycle?.proposedBlocks) && activeCycle.proposedBlocks.length > 0) ||
    (Array.isArray(state?.proposedBlocksByCycleId?.[activeCycle?.id || '']) &&
      state.proposedBlocksByCycleId[activeCycle.id].length > 0)
  ) {
    return 'schedule_preview_ready';
  }
  return 'inter_cycle';
}

function applyScheduleLifecycleState(state) {
  state.scheduleLifecycleState = deriveScheduleLifecycleState(state);
}

function applyInterCycleConsistencyDiagnostics(state) {
  const reasonCodes = [];
  const scheduleLifecycleState = String(state?.scheduleLifecycleState || '').trim().toLowerCase();
  const selectedHorizonMode = String(state?.selectedHorizonMode || 'current_cycle').trim().toLowerCase();
  const calendarDisplayBlocks = Array.isArray(state?.calendarDisplayBlocks) ? state.calendarDisplayBlocks : [];
  if (scheduleLifecycleState === 'inter_cycle' && calendarDisplayBlocks.length > 0) {
    reasonCodes.push(
      'INTER_CYCLE_SCHEDULE_ARTIFACT_LEAK',
      'DELETED_CYCLE_BLOCKS_VISIBLE',
      'TODAY_SHOWS_BLOCKS_WITHOUT_GENERATED_SCHEDULE',
      'CALENDAR_DISPLAY_BLOCKS_NOT_CLEARED_ON_CYCLE_DELETE'
    );
    if (selectedHorizonMode !== 'current_cycle') {
      reasonCodes.push('FORECAST_SUBSTRATE_MISLABELED_AS_SCHEDULED');
    }
  }
  state.interCycleConsistencyReasonCodes = [...new Set(reasonCodes)];
}

function buildScheduleDraftHash(items = []) {
  return JSON.stringify(
    (Array.isArray(items) ? items : []).map((item) => ({
      id: item?.id || null,
      startISO: item?.startISO || null,
      durationMinutes: Number.isFinite(item?.durationMinutes) ? Number(item.durationMinutes) : null,
      title: String(item?.title || '').trim() || null,
      actionId: item?.actionId || null,
      identityKey: item?.identityKey || null,
      deliverableId: item?.deliverableId ?? item?.payload?.deliverableId ?? null,
      criterionId: item?.criterionId ?? item?.payload?.criterionId ?? null,
    }))
  );
}

function normalizeTitleForSpecificity(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s*[-–—:]*\s*session\s+\d+\s+(?:of|\/)\s+\d+\s*$/i, '')
    .replace(/\s*\(\s*session\s+\d+\s*\/\s*\d+\s*\)\s*$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleTokenCount(value) {
  return normalizeTitleForSpecificity(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3).length;
}

const ACTIONABLE_BLOCK_LEAD_VERBS = new Set([
  'activate', 'analyze', 'archive', 'assemble', 'assess', 'audit',
  'backup', 'brief', 'build',
  'close', 'collect', 'communicate', 'compile', 'complete', 'configure', 'confirm', 'connect',
  'consolidate', 'coordinate', 'create',
  'debug', 'define', 'deliver', 'demo', 'deploy', 'design', 'develop', 'document', 'draft',
  'establish', 'evaluate', 'execute',
  'finalize', 'fix', 'gather', 'generate', 'harden', 'hire',
  'identify', 'implement', 'improve', 'integrate',
  'launch', 'map', 'measure', 'migrate', 'model', 'monitor',
  'onboard', 'optimize', 'outline', 'package', 'plan', 'prepare', 'present', 'produce',
  'prototype', 'publish',
  'reconcile', 'record', 'release', 'resolve', 'review', 'revise', 'run',
  'secure', 'select', 'sequence', 'set', 'share', 'ship', 'stress-test', 'submit', 'sync',
  'test', 'track', 'train', 'update', 'validate', 'verify', 'write',
]);

function isActionableBlockTitle(title) {
  const text = String(title || '').trim();
  if (!text) {
    return false;
  }
  const words = text.split(/\s+/);
  if (words.length < 3) {
    return false;
  }
  const firstWord = (words[0] || '').toLowerCase().replace(/[^a-z-]/g, '');
  return ACTIONABLE_BLOCK_LEAD_VERBS.has(firstWord);
}

function isExecutionProposalBlockType(blockType) {
  const normalized = String(blockType || '').trim().toLowerCase();
  return normalized === 'execution' || normalized === 'action';
}

function shouldPreserveExecutableProposalTitle({
  explicitProposalTitle,
  canonicalActionTitle,
  blockType,
  proposalSource,
}) {
  if (!isExecutionProposalBlockType(blockType)) {
    return false;
  }
  if (proposalSource !== 'action_graph') {
    return false;
  }
  if (!isActionableBlockTitle(explicitProposalTitle)) {
    return false;
  }
  if (!canonicalActionTitle) {
    return true;
  }
  return !isActionableBlockTitle(canonicalActionTitle);
}

function shouldPreferProposalTitle(explicitProposalTitle, canonicalActionTitle) {
  const explicit = String(explicitProposalTitle || '').trim();
  const canonical = String(canonicalActionTitle || '').trim();
  if (!explicit) {
    return false;
  }
  if (!canonical) {
    return true;
  }
  if (explicit === canonical) {
    return true;
  }
  const normalizedExplicit = normalizeTitleForSpecificity(explicit);
  const normalizedCanonical = normalizeTitleForSpecificity(canonical);
  if (!normalizedExplicit) {
    return false;
  }
  if (normalizedExplicit === normalizedCanonical) {
    return false;
  }
  const explicitHasOperationalObject =
    /\b(compare|request|configure|test|send|log|capture|define|draft|review|choose|select|outline|write|compile|lock|segment|adjust)\b/i.test(
      explicit
    ) &&
    /\b(moq|manufacturer|checkout|payment|shipping|fulfillment|buyer|outreach|objection|conversion|formula|sample|packaging|pricing|product page|purchase|order|evidence)\b/i.test(
      explicit
    );
  if (explicitHasOperationalObject) {
    return true;
  }
  return titleTokenCount(explicit) > titleTokenCount(canonical) + 2;
}

function buildScheduleReviewBlock(
  state,
  item,
  { cycleId = null, goalId = null, timeZone = 'UTC', defaultDomain = 'FOCUS' } = {}
) {
  if (!item?.startISO) {
    return null;
  }
  const startDate = new Date(item.startISO);
  if (!Number.isFinite(startDate.getTime())) {
    return null;
  }
  const duration = Number.isFinite(item.durationMinutes) ? Number(item.durationMinutes) : 30;
  const minutes = clampDurationMinutes(duration);
  const endDate = item.endISO ? new Date(item.endISO) : new Date(startDate.getTime() + minutes * 60000);
  if (!Number.isFinite(endDate.getTime())) {
    return null;
  }
  const { domain, practice } = normalizeDomainValue(item.domain || item.domainKey || defaultDomain || 'FOCUS');
  return {
    id: item.id || nextDeterministicId(state, 'blk'),
    cycleId,
    goalId,
    origin: 'schedule_review',
    suggestionId: item.id || null,
    identityKey: item.identityKey || null,
    laneId: item.laneId ?? item.masterPlanLaneId ?? null,
    laneLabel: item.laneLabel ?? item.payload?.laneLabel ?? null,
    masterPlanLaneId: item.masterPlanLaneId ?? item.laneId ?? null,
    deliverableId: item.deliverableId ?? item.payload?.deliverableId ?? null,
    actionId: item.actionId ?? null,
    directDependencyIds: Array.isArray(item.directDependencyIds) ? [...item.directDependencyIds] : [],
    directDependencyDetails: Array.isArray(item.directDependencyDetails) ? [...item.directDependencyDetails] : [],
    transitiveDependencyIds: Array.isArray(item.transitiveDependencyIds) ? [...item.transitiveDependencyIds] : [],
    transitiveDependencyDetails: Array.isArray(item.transitiveDependencyDetails)
      ? [...item.transitiveDependencyDetails]
      : [],
    commerceReadinessLevel: item.commerceReadinessLevel || null,
    placementBasis: item.placementBasis || 'confirmed',
    assumedDependencies: Array.isArray(item.assumedDependencies) ? [...item.assumedDependencies] : [],
    sessionIndex: Number.isFinite(item.sessionIndex) ? Number(item.sessionIndex) : null,
    criterionId: item.criterionId ?? item.payload?.criterionId ?? null,
    lockedUntilDayKey: item.lockedUntilDayKey ?? item.payload?.lockedUntilDayKey ?? null,
    practice,
    domain,
    title: item.title || 'Scheduled action',
    label: item.title || 'Scheduled action',
    displayTitle: item.displayTitle || item.title || 'Scheduled action',
    requiredSystemBlock: Boolean(item.requiredSystemBlock),
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString(),
    status: 'planned',
    optional: Boolean(item.optional),
    objectiveId: state.today?.primaryObjectiveId || null,
    scheduleLifecycle: 'applied_review',
  };
}

function getTemporalBlockDayKey(block, timeZone = 'UTC') {
  return (
    coerceDayKey(block?.dayKey, timeZone) ||
    coerceDayKey(block?.startISO, timeZone) ||
    coerceDayKey(block?.start, timeZone) ||
    coerceDayKey(block?.date, timeZone) ||
    null
  );
}

function hasCanonicalExecutionOutcome(state, blockId) {
  const targetId = String(blockId || '').trim();
  if (!targetId) {
    return false;
  }
  return (Array.isArray(state?.executionEvents) ? state.executionEvents : []).some((event) => {
    const eventBlockId = String(event?.blockId || '').trim();
    const kind = String(event?.kind || '').trim().toLowerCase();
    return eventBlockId === targetId && (kind === 'complete' || kind === 'missed' || kind === 'skipped');
  });
}

function buildScheduleTemporalAudit(state, cycle, blocks = [], { referenceDayKey = null, timeZone = 'UTC' } = {}) {
  const normalizedBlocks = (Array.isArray(blocks) ? blocks : []).filter(Boolean);
  const sortedDayKeys = normalizedBlocks
    .map((block) => getTemporalBlockDayKey(block, timeZone))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const generatedAtISO =
    cycle?.scheduleGeneratedAtISO ||
    cycle?.autoAsanaPlan?.audit?.generatedAtISO ||
    cycle?.goalPlan?.generatedAtISO ||
    null;
  const generatedDayKey = coerceDayKey(generatedAtISO, timeZone) || null;
  const executionStartDayKey =
    coerceDayKey(referenceDayKey, timeZone) ||
    coerceDayKey(state?.appTime?.activeDayKey, timeZone) ||
    coerceDayKey(state?.today?.date, timeZone) ||
    nowDayKey(timeZone);
  const generatedForStartDayKey = sortedDayKeys[0] || generatedDayKey || executionStartDayKey;
  const freshnessDays = 7;
  const validUntilDayKey = generatedDayKey ? addDays(generatedDayKey, freshnessDays - 1, timeZone) : executionStartDayKey;
  const daysSinceGenerated = generatedDayKey ? Math.max(0, daysBetween(generatedDayKey, executionStartDayKey)) : 0;
  const pastDatedBlocks = normalizedBlocks.filter((block) => {
    const blockDayKey = getTemporalBlockDayKey(block, timeZone);
    return Boolean(blockDayKey && blockDayKey < executionStartDayKey && !hasCanonicalExecutionOutcome(state, block?.id));
  });
  const pastDatedBlockCount = pastDatedBlocks.length;
  const scheduleDebtMinutes = pastDatedBlocks.reduce(
    (sum, block) => sum + Math.max(0, Number(block?.durationMinutes || block?.minutes || 0)),
    0
  );
  const compressionDelta =
    sortedDayKeys.length > 0
      ? Math.max(0, daysBetween(generatedForStartDayKey, sortedDayKeys[sortedDayKeys.length - 1]) - Math.max(0, daysBetween(executionStartDayKey, sortedDayKeys[sortedDayKeys.length - 1])))
      : 0;
  const reasonCodes = [];
  const isStale = generatedDayKey ? executionStartDayKey > validUntilDayKey : false;
  if (isStale) {
    reasonCodes.push('GENERATED_SCHEDULE_STALE');
  }
  if (pastDatedBlockCount > 0) {
    reasonCodes.push('PAST_DATED_UNEXECUTED_BLOCKS');
    reasonCodes.push('ACTIVATION_REANCHOR_REQUIRED');
    reasonCodes.push('SCHEDULE_REBASE_REQUIRED');
  }
  if (compressionDelta > 0) {
    reasonCodes.push('HARD_ANCHOR_COMPRESSION_CHANGED');
  }
  if (reasonCodes.length > 0) {
    reasonCodes.push('REASSESSMENT_TEMPORAL_DRIFT_DETECTED');
  }
  const temporalStatus =
    pastDatedBlockCount > 0
      ? 'rebase_required'
      : isStale
        ? 'stale'
        : reasonCodes.length > 0
          ? 'drifted'
          : 'fresh';
  return {
    generatedAtISO,
    generatedForStartDayKey,
    validUntilDayKey,
    activationRequestedAtISO: state?.appTime?.nowISO || new Date().toISOString(),
    executionStartDayKey,
    temporalStatus,
    rebaseRequired: pastDatedBlockCount > 0,
    pastDatedBlockCount,
    scheduleDebtMinutes,
    compressionDelta,
    daysSinceGenerated,
    temporalReasonCodes: Array.from(new Set(reasonCodes)),
  };
}

function buildActivationDelayAssessment(state, cycle, blocks = [], temporalAudit, { timeZone = 'UTC' } = {}) {
  const normalizedBlocks = (Array.isArray(blocks) ? blocks : []).filter(Boolean);
  const appliedStartDayKey =
    normalizedBlocks
      .map((block) => getTemporalBlockDayKey(block, timeZone))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))[0] ||
    coerceDayKey(cycle?.generatedForStartDayKey, timeZone) ||
    null;
  const requestedExecutionStartDayKey =
    coerceDayKey(temporalAudit?.executionStartDayKey, timeZone) ||
    coerceDayKey(state?.appTime?.activeDayKey, timeZone) ||
    coerceDayKey(state?.today?.date, timeZone) ||
    nowDayKey(timeZone);
  const appliedAtISO = cycle?.scheduleAppliedAtISO || state?.draftScheduleAppliedAtISO || null;
  if (!appliedAtISO || !appliedStartDayKey || appliedStartDayKey >= requestedExecutionStartDayKey) {
    return {
      status: 'not_required',
      appliedAtISO,
      activationRequestedAtISO: temporalAudit?.activationRequestedAtISO || state?.appTime?.nowISO || new Date().toISOString(),
      appliedStartDayKey,
      requestedExecutionStartDayKey,
      delayDays: 0,
      pastDatedBlockCount: 0,
      scheduleDebtMinutes: 0,
      reasonCodes: [],
    };
  }
  const unverifiedDelayBlocks = normalizedBlocks.filter((block) => {
    const blockDayKey = getTemporalBlockDayKey(block, timeZone);
    return Boolean(
      blockDayKey &&
        blockDayKey >= appliedStartDayKey &&
        blockDayKey < requestedExecutionStartDayKey &&
        !hasCanonicalExecutionOutcome(state, block?.id)
    );
  });
  const scheduleDebtMinutes = unverifiedDelayBlocks.reduce(
    (sum, block) => sum + Math.max(0, Number(block?.durationMinutes || block?.minutes || 0)),
    0
  );
  const existing = cycle?.activationDelayAssessment || {};
  const selectedResolution = existing?.selectedResolution || null;
  const reasonCodes = [];
  if (unverifiedDelayBlocks.length > 0) {
    reasonCodes.push('APPLIED_TO_ACTIVATION_GAP_DETECTED');
    reasonCodes.push('USER_CONFIRMATION_REQUIRED_FOR_DELAY_WINDOW');
    if (!selectedResolution) {
      reasonCodes.push('ACTIVATION_DELAY_REASSESSMENT_REQUIRED');
      reasonCodes.push('DELAY_WINDOW_EXECUTION_UNKNOWN');
    }
  }
  return {
    status:
      unverifiedDelayBlocks.length === 0
        ? 'not_required'
        : selectedResolution
          ? selectedResolution === 'rebase'
            ? 'ready_to_rebase'
            : 'blocked'
          : 'requires_user_investigation',
    appliedAtISO,
    activationRequestedAtISO: temporalAudit?.activationRequestedAtISO || state?.appTime?.nowISO || new Date().toISOString(),
    appliedStartDayKey,
    requestedExecutionStartDayKey,
    delayDays: Math.max(0, daysBetween(appliedStartDayKey, requestedExecutionStartDayKey)),
    userDelayExplanation: existing?.userDelayExplanation || null,
    workHappenedDuringDelay: existing?.workHappenedDuringDelay || (unverifiedDelayBlocks.length > 0 ? 'unknown' : 'none'),
    selectedResolution,
    pastDatedBlockCount: unverifiedDelayBlocks.length,
    scheduleDebtMinutes,
    reasonCodes: Array.from(new Set(reasonCodes)),
  };
}

function enforceExecutionStartBoundary(state) {
  const activeCycleId = state.activeCycleId || null;
  const activeCycle = activeCycleId ? (state.cyclesById?.[activeCycleId] || null) : null;
  const executionStartDayKey = activeCycle?.executionStartDayKey || null;
  if (!executionStartDayKey) return;
  const isEvidenced = (blockId) => {
    const id = String(blockId || '').trim();
    if (!id) return false;
    return (state.executionEvents || []).some((e) => {
      const eid = String(e?.blockId || '').trim();
      const kind = String(e?.kind || '').trim().toLowerCase();
      return eid === id && (kind === 'complete' || kind === 'missed' || kind === 'skipped' || kind === 'backfill');
    });
  };
  const shouldExclude = (block) => {
    const dk = block?.dayKey || (block?.startISO || block?.start || '').slice(0, 10) || '';
    return Boolean(dk && dk < executionStartDayKey && !isEvidenced(block?.id));
  };
  if (Array.isArray(state.cycle)) {
    state.cycle = state.cycle.map((day) => ({
      ...day,
      blocks: (Array.isArray(day?.blocks) ? day.blocks : []).filter((block) => !shouldExclude(block)),
    }));
  }
  if (state.today && Array.isArray(state.today.blocks)) {
    state.today.blocks = state.today.blocks.filter((block) => !shouldExclude(block));
  }
}

function mergeBlocksIntoDays(days = [], blocks = []) {
  const byDate = new Map();
  const cloneDay = (day) => ({
    ...day,
    blocks: Array.isArray(day?.blocks) ? [...day.blocks] : [],
  });
  const normalizedDays = (Array.isArray(days) ? days : []).map(cloneDay);
  normalizedDays.forEach((day) => {
    if (day?.date) {
      byDate.set(day.date, day);
    }
  });
  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    if (!block?.start) {
      return;
    }
    const dayKey = dayKeyFromISO(block.start, 'UTC');
    if (!dayKey) {
      return;
    }
    let day = byDate.get(dayKey);
    if (!day) {
      day = {
        date: dayKey,
        blocks: [],
        completionRate: 0,
        driftSignal: 'contained',
        loadByPractice: {},
        practices: [],
      };
      byDate.set(dayKey, day);
      normalizedDays.push(day);
    }
    if (!day.blocks.some((existing) => existing?.id === block.id)) {
      day.blocks.push(block);
    }
  });
  normalizedDays.sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
  normalizedDays.forEach((day) => {
    day.blocks.sort((a, b) => {
      const aStart = a?.start || '';
      const bStart = b?.start || '';
      if (aStart !== bStart) {
        return aStart.localeCompare(bStart);
      }
      return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
  });
  return normalizedDays;
}

function mergeScheduleReviewBlocksIntoCycleProjection(state, cycle = null) {
  const reviewBlocks = Array.isArray(cycle?.scheduleReviewBlocks) ? cycle.scheduleReviewBlocks : [];
  const cycleId = cycle?.id || state.activeCycleId || null;
  const filteredCycleDays = (Array.isArray(state.cycle) ? state.cycle : []).map((day) => ({
    ...day,
    blocks: (Array.isArray(day?.blocks) ? day.blocks : []).filter(
      (block) => !(cycleId && block?.cycleId === cycleId && String(block?.origin || '').trim() === 'schedule_review')
    ),
  }));
  // During activation-delay investigation, exclude review blocks before the requested
  // execution start so the calendar does not render stale pre-activation work.
  const delayBoundaryDayKey =
    cycle?.activationDelayAssessment?.status === 'requires_user_investigation'
      ? (cycle.activationDelayAssessment?.requestedExecutionStartDayKey || null)
      : null;
  const visibleReviewBlocks = delayBoundaryDayKey
    ? reviewBlocks.filter((block) => {
        const timeZone = state?.appTime?.timeZone || 'UTC';
        const dk = getTemporalBlockDayKey(block, timeZone) || '';
        return !dk || dk >= delayBoundaryDayKey;
      })
    : reviewBlocks;
  state.cycle = visibleReviewBlocks.length ? mergeBlocksIntoDays(filteredCycleDays, visibleReviewBlocks) : filteredCycleDays;
}

function ensureCycleStructures(state) {
  if (!state.history) {
    state.history = { cycles: [] };
  }
  if (!state.cyclesById) {
    state.cyclesById = {};
  }
  if (!state.historySignalsByCycleId) {
    state.historySignalsByCycleId = {};
  }
  if (!state.historyProfile) {
    state.historyProfile = null;
  }
  if (typeof state.activeCycleId === 'undefined') {
    state.activeCycleId = null;
  }
}

function nextDeterministicId(state, prefix = 'id') {
  if (!Number.isFinite(state._deterministicIdSeq)) {
    state._deterministicIdSeq = 0;
  }
  state._deterministicIdSeq += 1;
  return `${prefix}-${String(state._deterministicIdSeq).padStart(8, '0')}`;
}

function ensureAdmissionStores(state) {
  if (!state.goalAdmissionByGoal) {
    state.goalAdmissionByGoal = {};
  }
  if (!state.aspirationsByCycleId) {
    state.aspirationsByCycleId = {};
  }
  if (!('lastPlanError' in state)) {
    state.lastPlanError = null;
  }
  if (!state.debug || typeof state.debug !== 'object') {
    state.debug = {};
  }
  if (!Array.isArray(state.debug.traceLog)) {
    state.debug.traceLog = [];
  }
  if (!state.debug.lastGenerateClickAtISO) {
    state.debug.lastGenerateClickAtISO = null;
  }
  if (!state.debug.lastGenerateClickCycleId) {
    state.debug.lastGenerateClickCycleId = null;
  }
  if (!state.debug.lastGenerateResult || typeof state.debug.lastGenerateResult !== 'object') {
    state.debug.lastGenerateResult = { proposedBlocksCount: 0, lastPlanErrorCode: null };
  }
}

function appendTraceLog(state, entry) {
  if (!state.debug || typeof state.debug !== 'object') {
    state.debug = {};
  }
  const traceLog = Array.isArray(state.debug.traceLog) ? state.debug.traceLog : [];
  state.debug.traceLog = [...traceLog.slice(-19), entry];
}

export function appendTransitionTrace(state, { transition, blockId = null, label = '' } = {}) {
  appendTraceLog(state, {
    timestamp: state.appTime?.nowISO || new Date().toISOString(),
    transition: String(transition || '').trim() || 'unknown',
    blockId: blockId || null,
    label: String(label || '').trim() || '',
  });
}

function ensureDeliverablesStore(state) {
  if (!state.deliverablesByCycleId) {
    state.deliverablesByCycleId = {};
  }
}

function bootstrapCycleActionsFromDeliverables(state, cycleId, deliverables = []) {
  const items = Array.isArray(deliverables) ? deliverables : [];
  return items
    .filter((deliverable) => deliverable && deliverable.id)
    .map((deliverable, index) => ({
      id: `act-${cycleId}-${index + 1}`,
      title: String(deliverable.title || `Deliverable ${index + 1}`).trim() || `Deliverable ${index + 1}`,
      status: 'todo',
      priority: index + 1,
      topoIndex: index,
      dependencies: [],
      readinessCondition: null,
      actionType: 'execution',
      assumptions: [],
      estimateMin: Math.max(30, Number(deliverable.estimateMin || 60)),
      deliverableId: deliverable.id,
    }));
}

function normalizeActiveCycleExecutionGraph(state) {
  ensureDeliverablesStore(state);
  const cycleId = state.activeCycleId || null;
  if (!cycleId) {
    return;
  }
  const cycle = state.cyclesById?.[cycleId];
  if (!cycle) {
    return;
  }

  const workspaceDeliverables = state.deliverablesByCycleId?.[cycleId]?.deliverables || [];
  const deliverablesCount = Array.isArray(workspaceDeliverables) ? workspaceDeliverables.length : 0;
  const currentActions = Array.isArray(cycle.actions) ? cycle.actions : [];
  let nextActions = currentActions;
  if (!nextActions.length && deliverablesCount > 0) {
    nextActions = bootstrapCycleActionsFromDeliverables(state, cycleId, workspaceDeliverables);
    cycle.actions = nextActions;
  }

  const llmActions = Array.isArray(cycle.llmActionGraph?.actions) ? cycle.llmActionGraph.actions : [];
  const hasGraph = nextActions.length > 0 || llmActions.length > 0;
  cycle.executionGraphReady = hasGraph;
  state.cyclesById[cycleId] = cycle;

  if (!hasGraph && deliverablesCount > 0) {
    if (!state.lastPlanError || state.lastPlanError.code === 'ACTION_GRAPH_MISSING') {
      state.lastPlanError = {
        code: 'ACTION_GRAPH_MISSING',
        reason: 'Active cycle has deliverables but no validated execution graph.',
        reasonCodes: ['NO_ACTION_GRAPH'],
        cycleId,
      };
    }
  } else if (hasGraph && state.lastPlanError?.code === 'ACTION_GRAPH_MISSING') {
    state.lastPlanError = null;
  }
}

function getActiveCycle(state) {
  return state.activeCycleId ? state.cyclesById?.[state.activeCycleId] : null;
}

function getTargetCycle(state, cycleId) {
  if (cycleId && state?.cyclesById?.[cycleId]) {
    return state.cyclesById[cycleId];
  }
  return getActiveCycle(state);
}

function isCycleReadOnly(cycle) {
  if (!cycle) {
    return true;
  }
  const normalizedStatus = String(cycle.status || cycle.state || '')
    .trim()
    .toLowerCase();
  return normalizedStatus === 'ended' || normalizedStatus === 'archived';
}

function setGenerateHeartbeat(state, cycleId, proposedBlocksCount, lastPlanErrorCode) {
  state.debug = state.debug && typeof state.debug === 'object' ? state.debug : {};
  state.debug.lastGenerateClickAtISO = state.appTime?.nowISO || null;
  state.debug.lastGenerateClickCycleId = cycleId || null;
  state.debug.lastGenerateResult = {
    proposedBlocksCount: Number.isFinite(proposedBlocksCount) ? proposedBlocksCount : 0,
    lastPlanErrorCode: lastPlanErrorCode || null,
    planStatus: state?.cyclesById?.[cycleId || '']?.autoAsanaPlan?.summary?.planStatus || null,
    requiredBlockCount: Number(state?.cyclesById?.[cycleId || '']?.autoAsanaPlan?.summary?.requiredBlockCount || 0),
    scheduledBlockCount: Number(state?.cyclesById?.[cycleId || '']?.autoAsanaPlan?.summary?.scheduledBlockCount || 0),
    unscheduledBlockCount: Number(state?.cyclesById?.[cycleId || '']?.autoAsanaPlan?.summary?.unscheduledBlockCount || 0),
  };
}

function countRawWorkWindows(workWindows) {
  if (!workWindows || typeof workWindows !== 'object') {
    return 0;
  }
  return Object.values(workWindows).reduce((sum, rows) => {
    if (!Array.isArray(rows)) {
      return sum;
    }
    return sum + rows.length;
  }, 0);
}

function countNormalizedSchedulerWindows(weeklyWindows) {
  if (!weeklyWindows || typeof weeklyWindows !== 'object') {
    return 0;
  }
  return Object.values(weeklyWindows).reduce((sum, rows) => {
    if (!Array.isArray(rows)) {
      return sum;
    }
    return (
      sum +
      rows.filter((row) => {
        const start = String(row?.startHHMM || '').trim();
        const end = String(row?.endHHMM || '').trim();
        return Boolean(start && end && start < end);
      }).length
    );
  }, 0);
}

function logGenerateDiagnostics({
  state,
  cycleId,
  goalId,
  deliverableCount,
  actionCount,
  rawWorkWindowsCount,
  normalizedCandidateWindowCount,
  horizonDays,
  materializedWorkableDays,
  proposedBlocks,
  lastPlanErrorCode,
  traceId,
  moduleName,
  stepName,
  status,
  inputSummary,
  outputSummary,
  reasonCodes,
}) {
  if (IS_PRODUCTION) {
    return;
  }
  if (isRuntimeEnvFlagEnabled('JERICHO_DISABLE_GENERATE_TRACE')) {
    return;
  }
  const firstThree = (proposedBlocks || []).slice(0, 3).map((block) => ({
    id: block?.id || null,
    dayKey: block?.dayKey || null,
    startISO: block?.startISO || null,
    status: block?.status || null,
  }));
  const errorCode = lastPlanErrorCode || null;
  // eslint-disable-next-line no-console
  console.group('JERICHO_GENERATE_TRACE');
  console.log({
    traceId: traceId || `trace-${cycleId}-${Date.now()}`,
    cycleId: cycleId || null,
    goalId: goalId || null,
    moduleName: moduleName || 'generatePlan',
    stepName: stepName || 'complete',
    status: status || (errorCode ? 'fail' : 'ok'),
    timestamp: new Date().toISOString(),
    inputSummary: inputSummary || {
      deliverableCount: Number(deliverableCount || 0),
      actionCount: Number(actionCount || 0),
      horizonDays: Number.isFinite(Number(horizonDays)) ? Number(horizonDays) : null,
      rawWorkWindowsCount: Number(rawWorkWindowsCount || 0),
      normalizedCandidateWindowCount: Number(normalizedCandidateWindowCount || 0),
    },
    outputSummary: outputSummary || {
      proposedBlocksCount: Array.isArray(proposedBlocks) ? proposedBlocks.length : 0,
      materializedWorkableDays: Number.isFinite(Number(materializedWorkableDays))
        ? Number(materializedWorkableDays)
        : null,
      firstThreeProposedBlocks: firstThree,
    },
    errorCode,
    reasonCodes: reasonCodes || [],
  });
  console.groupEnd();
  if (!state?.debug || typeof state.debug !== 'object') {
    return;
  }
  const resolvedTraceId = traceId || `trace-${cycleId}-${Date.now()}`;
  const resolvedStatus = status || (errorCode ? 'fail' : 'ok');
  appendTraceLog(state, {
    traceId: resolvedTraceId,
    moduleName: moduleName || 'generatePlan',
    stepName:
      moduleName === 'applyDraftSchedule'
        ? 'schedule_committed'
        : moduleName === 'generatePlan'
          ? 'schedule_generated'
          : stepName || 'complete',
    status: resolvedStatus === 'fail' ? 'error' : 'success',
    inputSummary: inputSummary || {
      cycleId: cycleId || null,
      goalId: goalId || null,
    },
    outputSummary: {
      ...(outputSummary || {
        proposedBlocksCount: Array.isArray(proposedBlocks) ? proposedBlocks.length : 0,
      }),
      errorCode,
    },
    errorCode,
    timestamp: new Date().toISOString(),
  });
}

function isActiveCycleStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();
  return normalized === 'ACTIVE';
}

function isAdmittedGoalStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();
  return normalized === 'ADMITTED' || normalized === 'ACTIVE';
}

export function assertActiveCycleInvariant(state) {
  const active = getActiveCycle(state);
  if (!active || !isActiveCycleStatus(active.status || active.state)) {
    throw new Error('ACTIVE_CYCLE_INVALID');
  }
}

function archivePreviousCycle(state, previousCycleId) {
  if (!previousCycleId || !state.cyclesById?.[previousCycleId]) {
    return;
  }
  const previous = state.cyclesById[previousCycleId];
  if (!isActiveCycleStatus(previous.status)) {
    return;
  }
  endCycle(state, previousCycleId);
  const ended = state.cyclesById[previousCycleId];
  state.history = state.history || { cycles: [] };
  state.history.cycles.push({
    id: ended.id,
    status: ended.status,
    startedAtDayKey: ended.startedAtDayKey,
    endedAtDayKey: ended.endedAtDayKey,
    definiteGoal: ended.definiteGoal,
    pattern: ended.pattern,
    aim: ended.aim,
    flow: ended.flow,
  });
}

function maxDayKey(a, b) {
  if (!a) {
    return b || null;
  }
  if (!b) {
    return a || null;
  }
  return a >= b ? a : b;
}

function coerceDayKey(value, timeZone) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const isoDay = dayKeyFromISO(raw, timeZone);
  if (isoDay) {
    return isoDay;
  }
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function buildPlanProofFromLLMActions(actions = [], cycle = {}) {
  const totalRequiredUnits = Math.max(1, Array.isArray(actions) ? actions.length : 1);
  const workableDaysRemaining = 14;
  const requiredPacePerDay = Math.max(1, Math.ceil(totalRequiredUnits / workableDaysRemaining));
  const maxPerDay = Math.max(1, requiredPacePerDay);
  const maxPerWeek = Math.max(1, requiredPacePerDay * 7);
  const slackUnits = Math.max(0, workableDaysRemaining * maxPerDay - totalRequiredUnits);
  const slackRatio = totalRequiredUnits > 0 ? slackUnits / totalRequiredUnits : 0;
  const intensityRatio = maxPerDay > 0 ? requiredPacePerDay / maxPerDay : 1;
  return {
    workableDaysRemaining,
    totalRequiredUnits,
    requiredPacePerDay,
    maxPerDay,
    maxPerWeek,
    slackUnits,
    slackRatio,
    intensityRatio,
  };
}

function annotateActionsWithDeliverableIds(cycle, actions = [], canonicalDeliverablesOverride = null) {
  const list = Array.isArray(actions) ? actions : [];
  if (!list.length) {
    return [];
  }
  const byActionId = new Map();
  const canonicalDeliverables = Array.isArray(canonicalDeliverablesOverride)
    ? canonicalDeliverablesOverride
    : Array.isArray(cycle?.canonicalDeliverables)
      ? cycle.canonicalDeliverables
      : [];
  canonicalDeliverables.forEach((deliverable) => {
    const deliverableId = String(deliverable?.id || '').trim();
    if (!deliverableId) {
      return;
    }
    const deliverableTitle = String(deliverable?.title || '').trim();
    const actionIds = Array.isArray(deliverable?.actionIds) ? deliverable.actionIds : [];
    actionIds.forEach((actionId) => {
      const key = String(actionId || '').trim();
      if (!key) {
        return;
      }
      byActionId.set(key, { deliverableId, deliverableTitle });
    });
  });
  return list.map((action, index) => {
    const actionId = String(action?.id || '').trim();
    const mapped = byActionId.get(actionId) || null;
    const deliverableId =
      String(action?.deliverableId || '').trim() || mapped?.deliverableId || `deliv-synthetic-${index + 1}`;
    return {
      ...action,
      deliverableId,
      deliverableTitle: action?.deliverableTitle || mapped?.deliverableTitle || null,
    };
  });
}

function dayKeyToDow(dayKey) {
  if (!dayKey) {
    return null;
  }
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return days[date.getUTCDay()] || null;
}

function parseHHMMToMinutes(hhmm) {
  const text = String(hhmm || '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) {
    return 0;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }
  return Math.max(0, Math.min(24 * 60, hours * 60 + minutes));
}

const WORK_WINDOW_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function normalizeCanonicalWorkWindows(workWindows) {
  return WORK_WINDOW_DAYS.reduce((acc, day) => {
    const rows = Array.isArray(workWindows?.[day]) ? workWindows[day] : [];
    acc[day] = rows
      .map((row) => ({
        start: String(row?.start || '').trim(),
        end: String(row?.end || '').trim(),
      }))
      .filter((row) => row.start && row.end && row.start < row.end);
    return acc;
  }, {});
}

function emptyCanonicalWorkWindows() {
  return normalizeCanonicalWorkWindows({});
}

function getWorkDaysFromWindows(workWindows) {
  if (!workWindows || typeof workWindows !== 'object') {
    return ['mon', 'tue', 'wed', 'thu', 'fri'];
  }
  const workDays = Object.entries(workWindows)
    .filter(([, windows]) => Array.isArray(windows) && windows.length > 0)
    .map(([day]) =>
      String(day || '')
        .trim()
        .toLowerCase()
    );
  return workDays.length ? workDays : ['mon', 'tue', 'wed', 'thu', 'fri'];
}

function getAvailableMinutesForDow(dow, workWindows) {
  if (!workWindows || typeof workWindows !== 'object') {
    return 60;
  }
  const windows = Array.isArray(workWindows?.[dow]) ? workWindows[dow] : [];
  return windows.reduce((total, window) => {
    const start = parseHHMMToMinutes(window?.start);
    const end = parseHHMMToMinutes(window?.end);
    return total + Math.max(0, end - start);
  }, 0);
}

function getFirstWindowStartForDow(dow, workWindows) {
  if (!workWindows || typeof workWindows !== 'object') {
    return '09:00';
  }
  const windows = Array.isArray(workWindows?.[dow]) ? workWindows[dow] : [];
  return windows[0]?.start || '09:00';
}

function toSchedulerWeeklyWindows(workWindows) {
  const dayMap = {
    sun: 'SUN',
    mon: 'MON',
    tue: 'TUE',
    wed: 'WED',
    thu: 'THU',
    fri: 'FRI',
    sat: 'SAT',
  };
  if (!workWindows || typeof workWindows !== 'object') {
    return {};
  }
  return Object.entries(workWindows).reduce((acc, [day, windows]) => {
    const schedulerDay = dayMap[String(day || '').toLowerCase()];
    if (!schedulerDay || !Array.isArray(windows) || windows.length === 0) {
      return acc;
    }
    const mapped = windows
      .map((window) => ({
        startHHMM: window?.start || '',
        endHHMM: window?.end || '',
      }))
      .filter((window) => window.startHHMM && window.endHHMM && window.startHHMM < window.endHHMM);
    if (mapped.length) {
      acc[schedulerDay] = mapped;
    }
    return acc;
  }, {});
}

function hasAnySchedulerWindows(weeklyWindows) {
  if (!weeklyWindows || typeof weeklyWindows !== 'object') {
    return false;
  }
  return Object.values(weeklyWindows).some((rows) => Array.isArray(rows) && rows.length > 0);
}

function computeWeeklyCapacityFromWorkWindows(workWindows) {
  const workDays = getWorkDaysFromWindows(workWindows);
  return workDays.reduce((total, dow) => total + getAvailableMinutesForDow(dow, workWindows), 0);
}

function buildCapacityMitigationSuggestions() {
  return [
    'Expand availability',
    'Extend the execution-cycle horizon',
    'Reduce first-cycle scope',
    'Defer lower-priority lanes',
    'Lower cadence',
    'Revise the success standard',
  ];
}

function estimateCycleRequiredWeeklyMinutes(state, cycle) {
  if (!cycle) {
    return null;
  }
  if (cycle?.source === 'master_plan' && cycle?.masterPlanId && state?.masterPlansById?.[cycle.masterPlanId]) {
    const plan = state.masterPlansById[cycle.masterPlanId];
    const descriptors = ensureMasterPlanOperationalCycle(state, plan);
    const proposalResult = buildMasterPlanFirstCycleProposals(state, plan, descriptors);
    const proposals = proposalResult.blocks;
    const totalMinutes = proposals.reduce((sum, proposal) => sum + Number(proposal?.durationMinutes || 0), 0);
    return {
      totalMinutes,
      windowWeeks: 4,
      requiredWeeklyMinutes: Math.ceil(totalMinutes / 4),
      proposedBlockCount: proposals.length,
    };
  }

  const actionCount = Math.max(
    Number(getCanonicalCycleActions(cycle)?.length || 0),
    Number(Array.isArray(cycle?.llmSessionPlan) ? cycle.llmSessionPlan.length : 0)
  );
  if (actionCount <= 0) {
    return null;
  }
  const totalMinutes = actionCount * 45;
  return {
    totalMinutes,
    windowWeeks: 2,
    requiredWeeklyMinutes: Math.ceil(totalMinutes / 2),
    proposedBlockCount: actionCount,
  };
}

function buildCycleCapacityValidation(state, cycle, workWindows) {
  const normalizedWorkWindows = normalizeCanonicalWorkWindows(workWindows || {});
  const availableWeeklyMinutes = computeWeeklyCapacityFromWorkWindows(normalizedWorkWindows);
  const estimate = estimateCycleRequiredWeeklyMinutes(state, cycle);
  if (!estimate) {
    return {
      status: availableWeeklyMinutes > 0 ? 'approved' : 'unsaved',
      availableWeeklyMinutes,
      requiredWeeklyMinutes: null,
      gapWeeklyMinutes: null,
      mitigationSuggestions: [],
      proposedBlockCount: null,
    };
  }
  const requiredWeeklyMinutes = Number(estimate.requiredWeeklyMinutes || 0);
  const gapWeeklyMinutes = Math.max(0, requiredWeeklyMinutes - availableWeeklyMinutes);
  return {
    status:
      availableWeeklyMinutes > 0 && (requiredWeeklyMinutes <= 0 || availableWeeklyMinutes >= requiredWeeklyMinutes)
        ? 'approved'
        : 'insufficient',
    availableWeeklyMinutes,
    requiredWeeklyMinutes,
    gapWeeklyMinutes,
    mitigationSuggestions: gapWeeklyMinutes > 0 ? buildCapacityMitigationSuggestions() : [],
    proposedBlockCount: estimate.proposedBlockCount,
  };
}

function deriveCycleSchedulingAuthority(state, cycle, contract = null) {
  const canonicalContract = contract || cycle?.goalContract || null;
  const contractWindows = normalizeCanonicalWorkWindows(canonicalContract?.workWindows || {});
  const fallbackWindows =
    countRawWorkWindows(contractWindows) > 0
      ? contractWindows
      : normalizeCanonicalWorkWindows(state?.availabilityPolicy?.workWindows || {});
  const normalizedWorkWindows = fallbackWindows;
  const workWindowCount = countRawWorkWindows(normalizedWorkWindows);
  const workWindowsSource =
    canonicalContract?.workWindowsSource ||
    cycle?.workWindowsSource ||
    (workWindowCount > 0 ? 'user_defined' : 'unset');
  const explicitStatus =
    canonicalContract?.constraintsStatus || cycle?.constraintsStatus || state?.availabilityPolicy?.constraintsStatus || null;
  const constraintsStatus =
    explicitStatus ||
    (workWindowCount === 0 ? 'unsaved' : workWindowsSource === 'system_inferred' ? 'unsaved' : 'approved');
  const capacityValidation =
    canonicalContract?.capacityValidation ||
    cycle?.capacityValidation ||
    state?.availabilityPolicy?.capacityValidation ||
    (workWindowCount > 0 ? buildCycleCapacityValidation(state, cycle, normalizedWorkWindows) : null);
  return {
    workWindows: normalizedWorkWindows,
    workWindowCount,
    workWindowsSource,
    constraintsStatus,
    capacityValidation,
  };
}

function clearCycleTransientState(state) {
  state.selectedHorizonMode = 'current_cycle';
  state.proposedBlocks = [];
  if (!state.proposedBlocksByCycleId || typeof state.proposedBlocksByCycleId !== 'object') {
    state.proposedBlocksByCycleId = {};
  }
  if (state.activeCycleId) {
    state.proposedBlocksByCycleId[state.activeCycleId] = [];
  }
  state.proposedBlocks = [];
  state.suggestedBlocks = [];
  state.suggestionEvents = [];
  state.lastPlanError = null;
  state.draftScheduleAppliedAtISO = null;
  state.scheduleApplied = false;
  state.scheduleLifecycle = 'no_schedule';
  state.scheduleReviewBlocks = [];
  state.pendingPlanConfirmation = false;
  state.overdueBlockIds = [];
  state.blockLifecycleById = {};
  state.executionEvents = [];
  state.externalEvidenceEvents = [];
  state.planMutationEvents = [];
  state.truthEntries = [];
  state.planPreview = null;
  state.planDraft = null;
  state.planCalibration = null;
  state.correctionSignals = null;
  const cycle = getActiveCycle(state);
  if (cycle) {
    cycle.scheduleAppliedAtISO = null;
    cycle.scheduleActivatedAtISO = null;
    cycle.scheduleLifecycle = 'no_schedule';
    cycle.scheduleReviewBlocks = [];
    cycle.scheduleDraftHash = null;
    cycle.scheduleActiveHash = null;
  }
  if (cycle?.metrics) {
    cycle.metrics = {
      ...cycle.metrics,
      posSnapshot: null,
      posSnapshotAtISO: null,
      posExplanation: null,
    };
    state.cyclesById[cycle.id] = cycle;
  }
}

function clearGoalSessionStateToBlank(state) {
  state.selectedHorizonMode = 'current_cycle';
  state.calendarDisplayBlocks = [];
  state.fullHorizonScheduleBlocks = [];
  state.activeCycleId = null;
  state.activeGoalId = null;
  if (state.activeProfileId && state?.profilesById?.[state.activeProfileId]) {
    state.profilesById[state.activeProfileId].activeGoalId = null;
  }
  state.goalExecutionContract = null;
  state.pendingOnboardingInputs = null;
  state.proposedBlocks = [];
  state.suggestedBlocks = [];
  state.suggestionEvents = [];
  state.executionEvents = [];
  state.externalEvidenceEvents = [];
  state.planMutationEvents = [];
  state.truthEntries = [];
  state.planDraft = null;
  state.planPreview = null;
  state.planCalibration = null;
  state.correctionSignals = null;
  state.lastPlanError = null;
  state.planRecovery = null;
  state.blockLifecycleById = {};
  state.overdueBlockIds = [];
  state.scheduleApplied = false;
  state.scheduleLifecycle = 'no_schedule';
  state.scheduleReviewBlocks = [];
  state.draftScheduleAppliedAtISO = null;
  state.pendingPlanConfirmation = false;
  state.cycle = [];
  state.today = { ...(state.today || {}), blocks: [] };
  state.currentWeek = { ...(state.currentWeek || {}), days: [], metrics: {} };
  state.blockStore = { blocks: {} };
  state.goalPolicyByGoalId = {};
  state.planQualityGateByGoal = {};
  state.systemShotClockByGoal = {};
  state.executionCorrectionByGoal = {};
  state.cycleDynamicsByCycleId = {};
  if (!state.proposedBlocksByCycleId || typeof state.proposedBlocksByCycleId !== 'object') {
    state.proposedBlocksByCycleId = {};
  } else {
    Object.keys(state.proposedBlocksByCycleId).forEach((key) => {
      state.proposedBlocksByCycleId[key] = [];
    });
  }
}

function clearActiveCycleSessionState(state) {
  state.selectedHorizonMode = 'current_cycle';
  state.calendarDisplayBlocks = [];
  state.activeCycleId = null;
  state.activeGoalId = null;
  if (state.activeProfileId && state?.profilesById?.[state.activeProfileId]) {
    state.profilesById[state.activeProfileId].activeGoalId = null;
  }
  state.goalExecutionContract = null;
  state.pendingOnboardingInputs = null;
  state.proposedBlocks = [];
  state.suggestedBlocks = [];
  state.suggestionEvents = [];
  state.executionEvents = [];
  state.externalEvidenceEvents = [];
  state.planMutationEvents = [];
  state.truthEntries = [];
  state.planDraft = null;
  state.planPreview = null;
  state.planCalibration = null;
  state.correctionSignals = null;
  state.lastPlanError = null;
  state.planRecovery = null;
  state.blockLifecycleById = {};
  state.overdueBlockIds = [];
  state.scheduleApplied = false;
  state.scheduleLifecycle = 'no_schedule';
  state.scheduleReviewBlocks = [];
  state.draftScheduleAppliedAtISO = null;
  state.pendingPlanConfirmation = false;
  state.cycle = [];
  state.today = { ...(state.today || {}), blocks: [] };
  state.currentWeek = { ...(state.currentWeek || {}), days: [], metrics: {} };
  state.blockStore = { blocks: {} };
  if (!state.proposedBlocksByCycleId || typeof state.proposedBlocksByCycleId !== 'object') {
    state.proposedBlocksByCycleId = {};
  } else {
    Object.keys(state.proposedBlocksByCycleId).forEach((key) => {
      state.proposedBlocksByCycleId[key] = [];
    });
  }
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
}

function uniqueById(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function unlinkGoalCycleReference(state, goalId, cycleId) {
  const normalizedGoalId = String(goalId || '').trim();
  const normalizedCycleId = String(cycleId || '').trim();
  if (!normalizedGoalId || !normalizedCycleId || !state.goalsById?.[normalizedGoalId]) {
    return;
  }
  const goal = state.goalsById[normalizedGoalId];
  goal.cycleIds = Array.isArray(goal.cycleIds)
    ? goal.cycleIds.filter((candidateId) => String(candidateId || '').trim() !== normalizedCycleId)
    : [];
  if (goal.activeCycleId === normalizedCycleId) {
    goal.activeCycleId = null;
  }
  state.goalsById[normalizedGoalId] = goal;
}

function buildCycleReassessmentSnapshot(state, cycle) {
  if (!cycle) {
    return null;
  }
  const timeZone = state?.appTime?.timeZone || APP_TIME_ZONE;
  const todayDayKey = state?.appTime?.activeDayKey || state?.today?.date || nowDayKey(timeZone);
  const startDayKey = cycle?.startedAtDayKey || cycle?.goalContract?.startDayKey || todayDayKey;
  const endDayKey = cycle?.goalContract?.endDayKey || todayDayKey;
  const elapsedDays = Math.max(0, daysBetween(startDayKey, todayDayKey));
  const remainingHorizonDays = Math.max(0, daysBetween(todayDayKey, endDayKey));
  const activeFrictionCount = (Array.isArray(state?.frictionEvents) ? state.frictionEvents : []).filter((event) => {
    if (event?.cycleId && cycle?.id) {
      return event.cycleId === cycle.id;
    }
    return event?.goalId && cycle?.goalContract?.goalId && event.goalId === cycle.goalContract.goalId;
  }).length;
  const archivedCycleCount = Object.values(state?.cyclesById || {}).filter((candidate) => {
    if (!candidate || candidate.id === cycle.id) {
      return false;
    }
    const sameMasterPlan = candidate?.masterPlanId && cycle?.masterPlanId && candidate.masterPlanId === cycle.masterPlanId;
    const sameGoal =
      candidate?.goalContract?.goalId &&
      cycle?.goalContract?.goalId &&
      candidate.goalContract.goalId === cycle.goalContract.goalId;
    const status = String(candidate?.status || candidate?.state || '')
      .trim()
      .toLowerCase();
    return (sameMasterPlan || sameGoal) && (status === 'ended' || status === 'archived');
  }).length;
  const assumptionCount = uniqueStrings([
    ...(cycle?.goalContract?.goalIntakeContract?.readiness?.assumptionReasons || []),
    ...(cycle?.policyState?.goalPolicy?.assumptions || []),
  ]).length;
  const weeklyCapacityHours = Number(cycle?.goalContract?.planningIntake?.weeklyHoursAvailable || 0) || 0;
  return {
    assessedAtDayKey: todayDayKey,
    elapsedDaysSinceCycleStart: elapsedDays,
    remainingHorizonDays,
    activeFrictionCount,
    completedEvidenceCount: Array.isArray(cycle?.executionEvents) ? cycle.executionEvents.length : 0,
    archivedCycleCount,
    openAssumptionCount: assumptionCount,
    weeklyCapacityHours,
    currentPhaseOrMilestone: cycle?.definiteGoal?.outcome || cycle?.goalLabel || cycle?.goalText || null,
  };
}

function markCycleReassessmentRequired(state, cycle) {
  if (!cycle) {
    return;
  }
  cycle.reassessmentStatus = 'required';
  cycle.reassessmentRequiredAtISO = state?.appTime?.nowISO || new Date().toISOString();
  cycle.reassessmentCompletedAtISO = null;
  cycle.reassessmentSnapshot = buildCycleReassessmentSnapshot(state, cycle);
}

function completeCycleReassessment(state, cycleId) {
  ensureCycleStructures(state);
  const targetCycleId = cycleId || state.activeCycleId || null;
  if (!targetCycleId || !state.cyclesById?.[targetCycleId]) {
    return;
  }
  const cycle = state.cyclesById[targetCycleId];
  cycle.reassessmentStatus = 'complete';
  cycle.reassessmentCompletedAtISO = state?.appTime?.nowISO || new Date().toISOString();
  cycle.reassessmentSnapshot = buildCycleReassessmentSnapshot(state, cycle);
  state.cyclesById[targetCycleId] = cycle;
  if (state.lastPlanError?.code === 'CURRENT_STATE_REASSESSMENT_REQUIRED') {
    state.lastPlanError = null;
  }
}

function resetActiveCycleExecutionState(state, cycleId) {
  ensureCycleStructures(state);
  const targetCycleId = cycleId || state.activeCycleId || null;
  if (!targetCycleId || !state.cyclesById?.[targetCycleId]) {
    return;
  }
  const cycle = state.cyclesById[targetCycleId];
  state.activeCycleId = targetCycleId;
  clearCycleTransientState(state);
  cycle.executionEvents = [];
  cycle.externalEvidenceEvents = [];
  cycle.planMutationEvents = [];
  cycle.suggestionEvents = [];
  cycle.proposedBlocks = [];
  cycle.suggestedBlocks = [];
  cycle.truthEntries = [];
  cycle.planDraft = null;
  cycle.planPreview = null;
  cycle.calibration = null;
  cycle.correctionSignals = null;
  cycle.autoAsanaPlan = null;
  cycle.coldPlan = null;
  cycle.scheduleAppliedAtISO = null;
  cycle.scheduleActivatedAtISO = null;
  cycle.scheduleLifecycle = 'no_schedule';
  cycle.scheduleReviewBlocks = [];
  cycle.scheduleDraftHash = null;
  cycle.scheduleActiveHash = null;
  cycle.planStatus = cycle.goalContract ? 'ready' : cycle.planStatus || 'ready';
  markCycleReassessmentRequired(state, cycle);
  state.cyclesById[targetCycleId] = cycle;
  state.goalExecutionContract = cycle.goalContract || cycle.contract || null;
  state.activeGoalId =
    cycle.goalContract?.goalId || cycle.goalGovernanceContract?.goalId || cycle.goalId || state.activeGoalId || null;
  if (state.activeProfileId && state?.profilesById?.[state.activeProfileId]) {
    state.profilesById[state.activeProfileId].activeGoalId = state.activeGoalId || null;
  }
}

function hasMeaningfulExecutionEvidence(events = []) {
  return (events || []).some((event) => ['complete', 'missed', 'skipped'].includes(String(event?.kind || '')));
}

function hasCycleOwnedScheduleState(cycle) {
  const scheduleLifecycle = String(cycle?.scheduleLifecycle || '').trim().toLowerCase();
  return (
    scheduleLifecycle === 'draft_schedule_ready' ||
    scheduleLifecycle === 'applied_review' ||
    scheduleLifecycle === 'active_schedule' ||
    (Array.isArray(cycle?.proposedBlocks) && cycle.proposedBlocks.length > 0) ||
    (Array.isArray(cycle?.scheduleReviewBlocks) && cycle.scheduleReviewBlocks.length > 0)
  );
}

export function isCanonicalBlankState(state) {
  const activeProfileId = String(state?.activeProfileId || '').trim();
  const activeProfile = activeProfileId ? state?.profilesById?.[activeProfileId] || null : null;
  const activeCycle = state?.activeCycleId ? state?.cyclesById?.[state.activeCycleId] || null : null;
  const hasGoalRecords = Object.keys(state?.goalsById || {}).length > 0;
  const hasMasterPlans = Object.keys(state?.masterPlansById || {}).length > 0;
  const hasGoalContract = Boolean(state?.goalExecutionContract || activeCycle?.goalContract || activeCycle?.contract);
  const hasActiveGoalPointer = Boolean(state?.activeGoalId || activeProfile?.activeGoalId);
  const hasActiveMasterPlanPointer = Boolean(activeProfile?.activeMasterPlanId);
  const scheduleLifecycle = String(activeCycle?.scheduleLifecycle || state?.scheduleLifecycle || '')
    .trim()
    .toLowerCase();
  const hasScheduleState =
    Boolean(state?.scheduleApplied) ||
    scheduleLifecycle === 'draft_schedule_ready' ||
    scheduleLifecycle === 'applied_review' ||
    scheduleLifecycle === 'active_schedule' ||
    (Array.isArray(state?.proposedBlocks) && state.proposedBlocks.length > 0) ||
    (Array.isArray(activeCycle?.proposedBlocks) && activeCycle.proposedBlocks.length > 0) ||
    (Array.isArray(activeCycle?.scheduleReviewBlocks) && activeCycle.scheduleReviewBlocks.length > 0);
  const hasExecutionEvidence =
    (Array.isArray(state?.executionEvents) && state.executionEvents.length > 0) ||
    (Array.isArray(state?.externalEvidenceEvents) && state.externalEvidenceEvents.length > 0) ||
    (Array.isArray(activeCycle?.executionEvents) && activeCycle.executionEvents.length > 0) ||
    (Array.isArray(activeCycle?.externalEvidenceEvents) && activeCycle.externalEvidenceEvents.length > 0);
  return !state?.pendingOnboardingInputs &&
    !hasGoalRecords &&
    !hasMasterPlans &&
    !hasGoalContract &&
    !state?.activeCycleId &&
    !hasActiveGoalPointer &&
    !hasActiveMasterPlanPointer &&
    !hasScheduleState &&
    !hasExecutionEvidence;
}

function deriveGoalLifecycleState(state, cycle) {
  const cycleStatus = String(cycle?.status || '').trim().toLowerCase();
  if (!cycle && !state?.pendingOnboardingInputs) {
    return 'blank';
  }
  if (!cycle && state?.pendingOnboardingInputs) {
    return 'intake_draft';
  }
  if (cycleStatus === 'completed' || cycleStatus === 'ended') {
    return 'completed';
  }
  if (cycleStatus === 'archived' || cycleStatus === 'deleted' || cycleStatus === 'abandoned') {
    return 'abandoned';
  }
  if (cycleStatus === 'reset') {
    return 'reset';
  }
  const hasContract = Boolean(cycle?.goalContract || cycle?.contract || state?.goalExecutionContract);
  const goalId =
    cycle?.goalGovernanceContract?.goalId || cycle?.goalContract?.goalId || cycle?.contract?.goalId || state?.activeGoalId || null;
  const admissionStatus = goalId ? state?.goalAdmissionByGoal?.[goalId]?.status || null : null;
  if (!hasContract && state?.pendingOnboardingInputs) {
    return 'intake_draft';
  }
  const scheduleLifecycle = String(cycle?.scheduleLifecycle || state?.scheduleLifecycle || '').trim().toLowerCase();
  if (scheduleLifecycle === 'active_schedule') {
    return hasMeaningfulExecutionEvidence(cycle?.executionEvents || state?.executionEvents || []) ? 'in_execution' : 'activated';
  }
  if (scheduleLifecycle === 'applied_review') {
    return 'schedule_applied';
  }
  if (
    scheduleLifecycle === 'draft_schedule_ready' ||
    Array.isArray(cycle?.proposedBlocks) && cycle.proposedBlocks.length > 0 ||
    Array.isArray(state?.proposedBlocksByCycleId?.[cycle?.id || '']) && state.proposedBlocksByCycleId[cycle.id].length > 0
  ) {
    return 'generated_preview';
  }
  if (admissionStatus === 'ADMITTED' || hasContract) {
    return 'admitted';
  }
  return state?.pendingOnboardingInputs ? 'intake_draft' : 'blank';
}

function applyGoalLifecycleState(state) {
  ensureCycleStructures(state);
  state.goalLifecycleByCycleId = state.goalLifecycleByCycleId || {};
  Object.values(state.cyclesById || {}).forEach((cycle) => {
    if (!cycle || !cycle.id) {
      return;
    }
    const lifecycle = deriveGoalLifecycleState(state, cycle);
    cycle.goalLifecycleState = lifecycle;
    state.goalLifecycleByCycleId[cycle.id] = lifecycle;
  });
  const activeCycle = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] || null : null;
  state.goalLifecycleState = deriveGoalLifecycleState(state, activeCycle);
}

export function resetCycleToGoalEntryReady(state, cycleId) {
  const targetCycleId = cycleId || state.activeCycleId || null;
  if (!targetCycleId || !state.cyclesById?.[targetCycleId]) {
    return;
  }

  const cycle = state.cyclesById[targetCycleId];
  cycle.goalContract = null;
  cycle.goalGovernanceContract = null;
  cycle.contract = null;
  cycle.planDraft = null;
  cycle.planPreview = null;
  cycle.calibration = null;
  cycle.proposedBlocks = [];
  cycle.suggestedBlocks = [];
  cycle.suggestionEvents = [];
  cycle.executionEvents = [];
  cycle.externalEvidenceEvents = [];
  cycle.planMutationEvents = [];
  cycle.scheduleAppliedAtISO = null;
  cycle.scheduleActivatedAtISO = null;
  cycle.scheduleLifecycle = 'no_schedule';
  cycle.scheduleReviewBlocks = [];
  cycle.scheduleDraftHash = null;
  cycle.scheduleActiveHash = null;
  cycle.truthEntries = [];
  if (cycle.metrics) {
    cycle.metrics = {
      ...cycle.metrics,
      posSnapshot: null,
      posSnapshotAtISO: null,
      posExplanation: null,
      posScore: null,
      feasibilityScore: null,
      integrityScore: null,
    };
  }
  state.cyclesById[targetCycleId] = cycle;

  state.goalExecutionContract = null;
  state.selectedHorizonMode = 'current_cycle';
  state.calendarDisplayBlocks = [];
  state.pendingOnboardingInputs = null;
  state.proposedBlocks = [];
  if (!state.proposedBlocksByCycleId || typeof state.proposedBlocksByCycleId !== 'object') {
    state.proposedBlocksByCycleId = {};
  }
  state.proposedBlocksByCycleId[targetCycleId] = [];
  state.planDraft = null;
  state.planPreview = null;
  state.planCalibration = null;
  state.proposedBlocks = [];
  state.suggestedBlocks = [];
  state.suggestionEvents = [];
  state.executionEvents = [];
  state.lastPlanError = null;
  state.activeGoalId = null;
  if (state.activeProfileId && state?.profilesById?.[state.activeProfileId]) {
    state.profilesById[state.activeProfileId].activeGoalId = null;
  }
  state.blockLifecycleById = {};
  state.overdueBlockIds = [];
  state.cycle = [];
  state.today = { ...(state.today || {}), blocks: [] };
  state.currentWeek = { ...(state.currentWeek || {}), days: [] };
  state.draftScheduleAppliedAtISO = null;
  state.scheduleApplied = false;
  state.scheduleLifecycle = 'no_schedule';
  state.scheduleReviewBlocks = [];
  state.pendingPlanConfirmation = false;
  clearCycleTransientState(state);
}

function setCycleProposedBlocks(state, cycleId, proposals = []) {
  const canonicalActions = Array.isArray(state?.cyclesById?.[cycleId]?.actions)
    ? state.cyclesById[cycleId].actions
    : [];
  const actionTitleById = new Map();
  canonicalActions.forEach((action) => {
    const actionId = String(action?.id || '').trim();
    const actionTitle = String(action?.title || '').trim();
    if (actionId && actionTitle) {
      actionTitleById.set(actionId, actionTitle);
    }
  });
  const normalized = [];
  const seen = new Set();
  (Array.isArray(proposals) ? proposals : []).forEach((proposal, index) => {
    if (!proposal || typeof proposal !== 'object') {
      return;
    }
    const actionId = String(proposal?.actionId || '').trim();
    const canonicalActionTitle = actionTitleById.get(actionId) || '';
    const explicitProposalTitle = String(proposal?.title || '').trim() || String(proposal?.label || '').trim() || '';
    const isLongHorizonClosureTitle = /final validation|terminal closure checkpoint|closure checkpoint/i.test(
      explicitProposalTitle
    );
    const preserveExecutableProposalTitle = shouldPreserveExecutableProposalTitle({
      explicitProposalTitle,
      canonicalActionTitle,
      blockType: proposal?.blockType,
      proposalSource: proposal?.source,
    });
    const resolvedTitle =
      preserveExecutableProposalTitle ||
      isLongHorizonClosureTitle ||
      shouldPreferProposalTitle(explicitProposalTitle, canonicalActionTitle)
        ? explicitProposalTitle
        : canonicalActionTitle || explicitProposalTitle || '';
    const identity = String(
      proposal.identityKey ||
        proposal.id ||
        `${cycleId || 'cycle'}::${proposal.deliverableId || 'deliv-synthetic'}::${proposal.actionId || `synthetic-action-${index + 1}`}::${proposal.sessionIndex || 0}`
    ).trim();
    if (!identity || seen.has(identity)) {
      return;
    }
    seen.add(identity);
    const rawFinalTitle = resolvedTitle || proposal.title;
    const safeFinalTitle = safeBlockTitle(rawFinalTitle, null);
    normalized.push({
      ...proposal,
      title: safeFinalTitle,
      label: safeFinalTitle,
      lineageTitle: canonicalActionTitle || proposal.lineageTitle || null,
      id: proposal.id || identity,
      identityKey: proposal.identityKey || identity,
    });
  });
  state.proposedBlocks = normalized;
  if (!state.proposedBlocksByCycleId || typeof state.proposedBlocksByCycleId !== 'object') {
    state.proposedBlocksByCycleId = {};
  }
  if (cycleId) {
    state.proposedBlocksByCycleId[cycleId] = normalized;
  }
  // Temporary compatibility mirror for 1.0.x.
  state.suggestedBlocks = normalized;
  if (cycleId && state.cyclesById?.[cycleId]) {
    state.cyclesById[cycleId].proposedBlocks = normalized;
    state.cyclesById[cycleId].suggestedBlocks = normalized;
  }
}

function syncSuggestedBlocksMirror(state) {
  state.proposedBlocks = Array.isArray(state.proposedBlocks) ? state.proposedBlocks : [];
  state.suggestedBlocks = state.proposedBlocks;
  if (!state.proposedBlocksByCycleId || typeof state.proposedBlocksByCycleId !== 'object') {
    state.proposedBlocksByCycleId = {};
  }
  const activeCycleId = state.activeCycleId || null;
  if (!activeCycleId) {
    return;
  }
  state.proposedBlocksByCycleId[activeCycleId] = Array.isArray(state.proposedBlocks) ? state.proposedBlocks : [];
}

function getDeliverableWorkspace(state, cycleId) {
  ensureDeliverablesStore(state);
  if (!cycleId) {
    return null;
  }
  if (!state.deliverablesByCycleId[cycleId]) {
    const nowISO = state.appTime?.nowISO || new Date().toISOString();
    state.deliverablesByCycleId[cycleId] = {
      cycleId,
      deliverables: [],
      suggestionLinks: {},
      lastUpdatedAtISO: nowISO,
    };
  }
  const workspace = state.deliverablesByCycleId[cycleId];
  syncDeliverableWorkspaceIndexes(workspace);
  return workspace;
}

function touchDeliverableWorkspace(state, cycleId) {
  const workspace = getDeliverableWorkspace(state, cycleId);
  if (!workspace) {
    return null;
  }
  workspace.lastUpdatedAtISO = state.appTime?.nowISO || new Date().toISOString();
  syncDeliverableWorkspaceIndexes(workspace);
  state.deliverablesByCycleId[cycleId] = workspace;
  return workspace;
}

function syncDeliverableWorkspaceIndexes(workspace) {
  // Numeric index aliasing removed.
  // Callers must read from workspace.deliverables directly.
  return workspace;
}

function getSuggestionLink(state, cycleId, suggestionId) {
  if (!cycleId || !suggestionId) {
    return null;
  }
  const workspace = getDeliverableWorkspace(state, cycleId);
  if (!workspace?.suggestionLinks) {
    return null;
  }
  return workspace.suggestionLinks[suggestionId] || null;
}

function flagDraftBlocks(state) {
  if (!state.today?.blocks?.length) {
    return;
  }
  state.today.blocks = state.today.blocks.map((block) => ({
    ...block,
    isDraft: block.origin === 'draft' ? true : block.isDraft || false,
  }));
}

function mergePriorTodayBlocks(state, previousBlocks = []) {
  if (!previousBlocks.length) {
    return;
  }
  const deletedIds = new Set(
    (state.executionEvents || [])
      .filter((event) => event?.kind === 'delete' && event?.blockId)
      .map((event) => event.blockId)
  );
  const existingIds = new Set((state.today?.blocks || []).map((block) => block?.id));
  const missing = previousBlocks
    .filter((block) => block?.id && !existingIds.has(block.id) && !deletedIds.has(block.id))
    .map((block) => ({
      ...block,
      placementState: block.placementState === 'COMMITTED' ? 'in_progress' : block.placementState || 'in_progress',
    }));
  if (!missing.length) {
    return;
  }
  state.today.blocks = [...missing, ...(state.today?.blocks || [])];
}

function syncPlacementStateFromEvents(state) {
  if (!state.today?.blocks?.length) {
    return;
  }
  const placementStateByBlock = new Map();
  (state.executionEvents || []).forEach((event) => {
    if (event?.blockId && event.placementState) {
      placementStateByBlock.set(event.blockId, event.placementState);
    }
  });
  state.today.blocks = state.today.blocks.map((block) => ({
    ...block,
    placementState: placementStateByBlock.get(block.id) || block.placementState || 'in_progress',
  }));
}

function countCompletedBlocks(events = [], todayISO) {
  if (!events.length) {
    return 0;
  }
  const { days } = materializeBlocksFromEvents(events, { todayISO });
  const all = (days || []).flatMap((d) => d.blocks || []);
  return all.filter((b) => b?.status === 'completed' || b?.status === 'complete').length;
}

function setStrategy(state, payload = {}) {
  const cycle = getActiveCycle(state);
  if (!cycle) {
    return;
  }
  const timeZone = state.appTime?.timeZone || payload?.constraints?.tz;
  const goalId = cycle.goalContract?.goalId || cycle.contract?.goalId || state.activeGoalId || 'goal';
  const deadlineISO =
    payload.deadlineISO || cycle.goalContract?.deadlineISO || cycle.definiteGoal?.deadlineDayKey || '';
  const deliverables = normalizeDeliverables(payload.deliverables || cycle.strategy?.deliverables || []);
  const base = cycle.strategy || buildDefaultStrategy({ goalId, deadlineISO, timeZone, deliverables });
  const next = {
    ...base,
    routeOption: normalizeRouteOption(payload.routeOption || base.routeOption),
    deliverables,
    deadlineISO,
    constraints: {
      ...(base.constraints || {}),
      ...(payload.constraints || {}),
      tz: timeZone || base.constraints?.tz,
    },
    milestoneProfile: payload.milestoneProfile || base.milestoneProfile || null,
  };
  next.assumptionsHash = buildAssumptionsHash(next);
  cycle.strategy = next;
  if (!cycle.coldPlan || cycle.coldPlan.assumptionsHash !== next.assumptionsHash) {
    generateColdPlanForCycle(state, { rebaseMode: 'NONE' });
  }
}

/**
 * Adapter: Convert DeterministicPlanResult to ColdPlanV1 format
 * Maps ProposedBlock[] into forecastByDayKey structure
 */
function adaptDeterministicResultToColdPlan(result, strategy, nowISO) {
  if (result.status === 'INFEASIBLE') {
    return {
      version: 1,
      generatorVersion: 'deterministicPlan_v1',
      strategyId: strategy.strategyId,
      assumptionsHash: strategy.assumptionsHash,
      createdAtISO: nowISO,
      forecastByDayKey: {},
      infeasible: {
        reason: result.error?.message || 'Plan generation is infeasible',
        requiredCapacityPerWeek: 0,
        availableCapacityPerWeek: 0,
      },
    };
  }

  // Group proposedBlocks by dayKey to build forecastByDayKey
  const forecastByDayKey = {};
  result.proposedBlocks.forEach((block) => {
    if (!forecastByDayKey[block.dayKey]) {
      forecastByDayKey[block.dayKey] = {
        totalBlocks: 0,
        byDeliverable: {},
      };
    }
    forecastByDayKey[block.dayKey].totalBlocks += 1;

    if (!forecastByDayKey[block.dayKey].byDeliverable[block.deliverableId]) {
      forecastByDayKey[block.dayKey].byDeliverable[block.deliverableId] = 0;
    }
    forecastByDayKey[block.dayKey].byDeliverable[block.deliverableId] += 1;
  });

  return {
    version: 1,
    generatorVersion: 'deterministicPlan_v1',
    strategyId: strategy.strategyId,
    assumptionsHash: strategy.assumptionsHash,
    createdAtISO: nowISO,
    forecastByDayKey,
    infeasible: undefined,
  };
}

function generateColdPlanForCycle(state, { rebaseMode = 'NONE' } = {}) {
  const cycle = getActiveCycle(state);
  if (!cycle) {
    state.lastPlanError = {
      code: 'NO_ACTIVE_CYCLE',
      reasons: ['No active cycle found'],
      timestamp: state.appTime?.nowISO || new Date().toISOString(),
    };
    return;
  }

  const timeZone = state.appTime?.timeZone || cycle.strategy?.constraints?.tz;
  const nowISO = state.appTime?.nowISO || '';
  const startDayKey = cycle.startedAtDayKey || dayKeyFromISO(nowISO, timeZone);

  if (!cycle.strategy) {
    const goalId = cycle.goalContract?.goalId || cycle.contract?.goalId || state.activeGoalId || 'goal';
    const deadlineDayKey = getDeadlineDayKey(cycle.goalContract, timeZone);
    const deliverables = normalizeDeliverables(cycle.strategy?.deliverables || []);
    cycle.strategy = buildDefaultStrategy({
      goalId,
      deadlineISO: deadlineDayKey ? `${deadlineDayKey}T00:00:00Z` : '',
      timeZone,
      deliverables,
    });
  }

  // Extract deadline consistently from goalContract using canonical helper
  const deadlineKey =
    getDeadlineDayKey(cycle.goalContract, timeZone) ||
    cycle.definiteGoal?.deadlineDayKey ||
    cycle.strategy?.deadlineISO?.slice(0, 10);

  // STEP 3: Auto-seed deliverables if they're empty instead of failing
  let deliverables = normalizeDeliverables(cycle.strategy?.deliverables || []);
  let totalRequired = deliverables.reduce((sum, d) => sum + d.requiredBlocks, 0);

  // If no deliverables in strategy, check workspace (set at admission time)
  if (deliverables.length === 0 || totalRequired === 0) {
    const workspace = getDeliverableWorkspace(state, cycle.id);
    if (workspace?.deliverables?.length > 0) {
      // Use persisted workspace deliverables (already auto-generated at admission)
      deliverables = normalizeDeliverables(workspace.deliverables);
      totalRequired = deliverables.reduce((sum, d) => sum + d.requiredBlocks, 0);
      // Update strategy with workspace deliverables
      cycle.strategy.deliverables = deliverables;
      cycle.strategy.assumptionsHash = buildAssumptionsHash(cycle.strategy);
    } else if (cycle.goalContract && deadlineKey && deadlineKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Only auto-seed if no workspace exists (shouldn't happen post-admission, but safe fallback)
      let autoStrategy = null;
      try {
        deliverables = generateAutoDeliverables(cycle.goalContract) || [];
        totalRequired = deliverables.reduce((sum, d) => sum + d.requiredBlocks, 0);
        autoStrategy = { method: 'mechanism-class', detectedType: 'derived from goal keywords' };
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[PLAN_GEN] mechanism-class generation failed, trying Phase 1 fallback', err?.message);
        }
      }

      // FALLBACK: If mechanism-class didn't work, use Phase 1 approach
      if (!deliverables || deliverables.length === 0) {
        const autoResult = buildAutoDeliverablesFromGoalContract(cycle.goalContract, startDayKey, timeZone);
        deliverables = autoResult.deliverables || [];
        totalRequired = deliverables.reduce((sum, d) => sum + d.requiredBlocks, 0);
        autoStrategy = { method: 'phase1-autostrategy', ...autoResult };
      }

      // Update strategy with auto-seeded deliverables
      if (deliverables.length > 0) {
        cycle.strategy.deliverables = deliverables;
        cycle.strategy.assumptionsHash = buildAssumptionsHash(cycle.strategy);

        // Persist to workspace
        const newWorkspace = getDeliverableWorkspace(state, cycle.id);
        if (newWorkspace && (!newWorkspace.deliverables || newWorkspace.deliverables.length === 0)) {
          newWorkspace.deliverables = deliverables;
          newWorkspace.autoGenerated = true;
          newWorkspace.autoGeneratedAt = nowISO;
          newWorkspace.autoStrategy = autoStrategy;
          state.deliverablesByCycleId[cycle.id] = newWorkspace;
        }
      }
    }
  }

  // PHASE 1A: Quick diagnostic checks for common failure modes (post-admission)
  const diagnosticReasons = [];

  // Check 1: Deliverables (after auto-seed attempt)
  if (deliverables.length === 0 || totalRequired === 0) {
    diagnosticReasons.push(
      'NO_DELIVERABLES: Could not generate deliverables; deadline or execution constraints may be infeasible'
    );
  }

  // NOTE: Deadline format validation is ENFORCED AT ADMISSION (Phase 3)
  // Post-admission, deadlineKey is guaranteed valid YYYY-MM-DD format
  // Remove this check to prevent false post-admission errors

  // If we have critical diagnostics, set error and return early
  if (diagnosticReasons.length > 0) {
    state.lastPlanError = {
      code: 'PLAN_PRECONDITIONS_FAILED',
      reasons: diagnosticReasons,
      details: {
        deliverableCount: deliverables.length,
        totalRequired,
        startDayKey,
        deadlineKey,
        timeZone,
      },
      timestamp: nowISO || new Date().toISOString(),
    };
    return;
  }

  const startISO = buildLocalStartISO(startDayKey, '00:00', timeZone);
  const deadlineISO =
    cycle.strategy?.deadlineISO || (deadlineKey ? buildLocalStartISO(deadlineKey, '23:59', timeZone).startISO : '');
  const strategy = {
    ...cycle.strategy,
    deadlineISO,
    constraints: {
      ...(cycle.strategy.constraints || {}),
      tz: timeZone || cycle.strategy.constraints?.tz,
    },
  };
  strategy.assumptionsHash = buildAssumptionsHash(strategy);
  cycle.strategy = strategy;
  const completedCountToDate = countCompletedBlocks(cycle.executionEvents || [], state.today?.date);

  // PHASE 3: Use deterministic generator if contract specifies GENERIC_DETERMINISTIC
  let nextPlan;
  const mechanismClass = cycle.goalContract?.planGenerationMechanismClass || 'GENERIC_DETERMINISTIC';

  if (mechanismClass === 'GENERIC_DETERMINISTIC') {
    // Use Phase 3 deterministic generator
    const nowDayKey = dayKeyFromISO(nowISO, timeZone);
    const execMode = rebaseMode === 'REMAINING_FROM_TODAY' ? 'REBASE_FROM_TODAY' : 'REGENERATE';

    const deterministicResult = generateDeterministicPlan({
      contractDeadlineDayKey: deadlineKey,
      contractStartDayKey: startDayKey,
      nowDayKey,
      causalChainSteps: cycle.goalContract?.execution?.causalChainSteps,
      constraints: {
        maxBlocksPerDay: cycle.strategy?.constraints?.maxBlocksPerDay || 4,
        maxBlocksPerWeek: cycle.strategy?.constraints?.maxBlocksPerWeek || 16,
        preferredDaysOfWeek: cycle.strategy?.constraints?.preferredDaysOfWeek,
        blackoutDayKeys: cycle.strategy?.constraints?.blackoutDayKeys,
        timezone: timeZone,
      },
      mode: execMode,
    });

    nextPlan = adaptDeterministicResultToColdPlan(deterministicResult, strategy, nowISO);

    // Seed action layer from workspace deliverables (closes RC-03)
    // Only seeds when actions are absent — never overwrites LLM or user-set actions.
    // Uses canonical workspace deliverable IDs so forward-link lineage resolves.
    // Maps deliverable.kind → actionType: PLANNING → preparation, all others → execution.
    if (deterministicResult.status === 'SUCCESS' && deliverables.length > 0) {
      const currentActions = Array.isArray(cycle.actions) ? cycle.actions : [];
      if (currentActions.length === 0) {
        const cycleId = cycle.id || state.activeCycleId || 'cycle';
        cycle.actions = deliverables.map((deliv, index) => {
          const actionId = `act-det-${cycleId}-${index + 1}`;
          const prevId = index > 0 ? `act-det-${cycleId}-${index}` : null;
          return {
            id: actionId,
            title: deliv.title,
            status: 'todo',
            priority: index + 1,
            topoIndex: index,
            dependencies: prevId ? [prevId] : [],
            readinessCondition: null,
            actionType: deliv.kind === 'PLANNING' ? 'preparation' : 'execution',
            assumptions: [],
            estimateMin: 60,
            deliverableId: deliv.id,
          };
        });
      }
    }
  } else {
    // Fall back to v1 generator for non-GENERIC_DETERMINISTIC (placeholder for future)
    nextPlan = generateColdPlan({
      cycleStartISO: startISO?.startISO || `${startDayKey}T00:00:00.000Z`,
      nowISO,
      strategy,
      completedCountToDate,
      rebaseMode,
    });
  }

  const shouldVersion =
    !cycle.coldPlan ||
    cycle.coldPlan.assumptionsHash !== nextPlan.assumptionsHash ||
    rebaseMode === 'REMAINING_FROM_TODAY';
  const version = shouldVersion ? (cycle.coldPlan?.version || 0) + 1 : cycle.coldPlan?.version || 1;
  cycle.coldPlan = { ...nextPlan, version };
  cycle.coldPlanHistory = cycle.coldPlanHistory || [];
  if (shouldVersion) {
    cycle.coldPlanHistory.push({
      version,
      strategyId: nextPlan.strategyId,
      assumptionsHash: nextPlan.assumptionsHash,
      createdAtISO: nextPlan.createdAtISO,
    });
  }

  // FORCED VISIBILITY: Set error if plan produced zero blocks or is infeasible
  const blockCount = Object.keys(nextPlan.forecastByDayKey || {}).length;
  if (blockCount === 0 || nextPlan.infeasible) {
    const reasons = [];
    if (blockCount === 0) {
      reasons.push('NO_BLOCKS_GENERATED: Planner could not fit required blocks within constraints');
    }
    if (nextPlan.infeasible) {
      reasons.push(`INFEASIBLE: ${nextPlan.infeasible.reason || 'unknown constraint violation'}`);
    }
    state.lastPlanError = {
      code: blockCount === 0 ? 'NO_BLOCKS_GENERATED' : 'INFEASIBLE',
      reasons,
      details: {
        totalRequired,
        constraints: cycle.strategy?.constraints,
        infeasibleDetails: nextPlan.infeasible,
      },
      timestamp: nowISO || new Date().toISOString(),
    };
  } else {
    // Clear error if plan succeeded
    state.lastPlanError = null;
  }

  refreshColdPlanDailyProjection(state);
}

function refreshColdPlanDailyProjection(state) {
  const cycle = getActiveCycle(state);
  if (!cycle || !cycle.strategy || !cycle.coldPlan || !Array.isArray(cycle.strategy.deliverables)) {
    return;
  }
  const timeZone = state.appTime?.timeZone || cycle.strategy.constraints?.tz;
  const nowISO = state.appTime?.nowISO;
  if (!timeZone || !nowISO) {
    return;
  }
  const asOfDayKey = dayKeyFromISO(nowISO, timeZone);
  const existing = cycle.coldPlan.dailyProjection;
  if (
    existing?.asOfDayKey === asOfDayKey &&
    existing?.derivedFrom?.assumptionsHash === cycle.strategy.assumptionsHash
  ) {
    return;
  }
  if (cycle.strategy.assumptionsHash !== cycle.coldPlan.assumptionsHash) {
    cycle.coldPlan.dailyProjection = {
      ...(existing || {}),
      asOfDayKey,
      remainingRequiredBlocks: 0,
      generatorVersion: cycle.coldPlan.generatorVersion,
      derivedFrom: {
        strategyId: cycle.strategy.strategyId,
        assumptionsHash: cycle.strategy.assumptionsHash,
        coldPlanVersion: cycle.coldPlan.version,
      },
      forecastByDayKey: {},
      infeasible: {
        reason: 'assumptions_changed',
        requiredCapacityPerWeek: 0,
        availableCapacityPerWeek: 0,
      },
    };
    return;
  }
  const completedCountToDate = countCompletedBlocks(cycle.executionEvents || [], state.today?.date);
  cycle.coldPlan.dailyProjection = generateDailyProjection({
    nowISO,
    strategy: cycle.strategy,
    completedCountToDate,
    coldPlanVersion: cycle.coldPlan.version,
  });
}

function getPatternConfig(state) {
  if (state.activeCycleId && state.cyclesById && state.cyclesById[state.activeCycleId]?.pattern) {
    return state.cyclesById[state.activeCycleId].pattern;
  }
  return state.lenses?.pattern || { dailyTargets: [] };
}

function sanitizePatternTargets(targets = []) {
  const map = {
    Body: 0,
    Resources: 0,
    Creation: 0,
    Focus: 0,
  };
  targets.forEach((t) => {
    if (!t?.name) {
      return;
    }
    if (!(t.name in map)) {
      return;
    }
    const val = Number(t.minutes);
    map[t.name] = Number.isFinite(val) && val >= 0 ? val : 0;
  });
  return Object.entries(map).map(([name, minutes]) => ({ name, minutes }));
}

function enforceSafeDefaults(state) {
  state.today = state.today || {};
  state.today.blocks = Array.isArray(state.today.blocks) ? state.today.blocks : [];
  if (!state.nextSuggestion) {
    state.nextSuggestion = null;
  }
  ensureCycleStructures(state);
  if (!('goalExecutionContract' in state)) {
    state.goalExecutionContract = null;
  }
  if (!('planDraft' in state)) {
    state.planDraft = null;
  }
  if (state.planDraft) {
    if (!state.planDraft.qualityPolicyId) {
      state.planDraft.qualityPolicyId = 'BALANCED';
    }
    if (typeof state.planDraft.autoPolicySelection !== 'boolean') {
      state.planDraft.autoPolicySelection = false;
    }
    if (!Number.isFinite(state.planDraft.minPolicyHoldDays)) {
      state.planDraft.minPolicyHoldDays = 7;
    }
    if (typeof state.planDraft.enableQualityOptimizer !== 'boolean') {
      state.planDraft.enableQualityOptimizer = false;
    }
    if (typeof state.planDraft.enableMilestonePacing !== 'boolean') {
      state.planDraft.enableMilestonePacing = false;
    }
    if (!state.planDraft.pacingCadenceMode) {
      state.planDraft.pacingCadenceMode = 'adaptive';
    }
    if (typeof state.planDraft.enableHistoryPolicySelection !== 'boolean') {
      state.planDraft.enableHistoryPolicySelection = false;
    }
    if (!Number.isFinite(state.planDraft.historyWindowCycles)) {
      state.planDraft.historyWindowCycles = 5;
    }
    if (!state.planDraft.historyInfluenceStrength) {
      state.planDraft.historyInfluenceStrength = 'standard';
    }
  }
  if (!state.planCalibration) {
    state.planCalibration = { confidence: 0, assumptions: [], missingInfo: [] };
  }
  if (!('planPreview' in state)) {
    state.planPreview = null;
  }
  if (!('correctionSignals' in state)) {
    state.correctionSignals = null;
  }
  if (!state.proposedBlocks) {
    state.proposedBlocks = [];
  }
  if (!state.proposedBlocksByCycleId || typeof state.proposedBlocksByCycleId !== 'object') {
    state.proposedBlocksByCycleId = {};
  }
  if (!state.cycleDynamicsByCycleId || typeof state.cycleDynamicsByCycleId !== 'object') {
    state.cycleDynamicsByCycleId = {};
  }
  if (!state.suggestedBlocks) {
    state.suggestedBlocks = [];
  }
  if (!state.suggestionEvents) {
    state.suggestionEvents = [];
  }
  if (!state.deliverablesByCycleId) {
    state.deliverablesByCycleId = {};
  }
  if (!state.executionEvents) {
    state.executionEvents = [];
  }
  if (!state.truthEntries) {
    state.truthEntries = [];
  }
  if (!state.calibrationEvents) {
    state.calibrationEvents = [];
  }
  state.cycle = Array.isArray(state.cycle) ? state.cycle : [];
  state.cycle = state.cycle.map((day) => ({
    ...day,
    completionRate: Number.isFinite(day.completionRate) ? day.completionRate : 0,
  }));
  state.currentWeek = state.currentWeek || { days: [] };
  state.currentWeek.days = Array.isArray(state.currentWeek.days) ? state.currentWeek.days : [];
  state.currentWeek.metrics = state.currentWeek.metrics || {};
  state.currentWeek.metrics.completionRate = Number.isFinite(state.currentWeek.metrics.completionRate)
    ? state.currentWeek.metrics.completionRate
    : 0;
  state.currentWeek.metrics.driftLabel =
    state.currentWeek.metrics.driftLabel || state.vector?.driftLabel || 'contained';
  state.currentWeek.summaryLine = state.currentWeek.summaryLine || buildWeekSummary(state.currentWeek);
  state.stability = state.stability || {};
  state.stability.headline = state.stability.headline || 'Stability read based on current cycle.';
  state.stability.actionLine =
    state.stability.actionLine || 'Rebalance by adding one underweight practice block before 18:00.';
  if (!state.currentWeek.metrics) {
    state.currentWeek.metrics = {};
  }
  state.currentWeek.metrics.driftLabel =
    state.currentWeek.metrics.driftLabel || state.vector?.driftLabel || 'contained';
  state.currentWeek.metrics.completionRate = Number.isFinite(state.currentWeek.metrics.completionRate)
    ? state.currentWeek.metrics.completionRate
    : 0;
  if (!state.ledger) {
    state.ledger = [];
  }
  if (!state.suggestionHistory) {
    state.suggestionHistory = {
      dayKey: state.today?.date || nowDayKey(),
      count: 0,
      lastSuggestedAtISO: null,
      lastSuggestedAtISOByGoal: {},
      dailyCountByGoal: {},
      denials: [],
    };
  }
  if (!state.suggestionEligibility) {
    state.suggestionEligibility = {};
  }
  if (!state.probabilityStatusByGoal) {
    state.probabilityStatusByGoal = {};
  }
  if (!state.planQualityGateByGoal || typeof state.planQualityGateByGoal !== 'object') {
    state.planQualityGateByGoal = {};
  }
  if (!state.directiveEligibilityByGoal) {
    state.directiveEligibilityByGoal = {};
  }
  if (!('goalDirective' in state)) {
    state.goalDirective = null;
  }
}

function computeNextSuggestion(state) {
  const { today, vector } = state;
  const blocks = today?.blocks || [];
  const contracts = collectGovernanceContracts(state);
  const goals = new Map();
  contracts.forEach((contract) => {
    if (!contract?.goalId) {
      return;
    }
    const list = goals.get(contract.goalId) || [];
    list.push(contract);
    goals.set(contract.goalId, list);
  });
  if (!goals.size) {
    return { suggestion: null, eligibilityByGoal: {}, selectedGoalId: null, denials: [] };
  }

  const nowISO = nowDayKey();
  const nowTimestampISO = new Date().toISOString();
  const history = state.suggestionHistory || {
    dayKey: nowISO,
    count: 0,
    lastSuggestedAtISO: null,
    lastSuggestedAtISOByGoal: {},
    dailyCountByGoal: {},
    denials: [],
  };
  const activeBlocksCount = blocks.filter((b) => b.status !== 'completed').length;
  const executionEventCount = (state.executionEvents || []).length;

  const candidate = computeBaseSuggestion(state, blocks, vector);
  const eligibilityByGoal = {};
  const allowed = [];
  const denials = [];

  goals.forEach((goalContracts, goalId) => {
    const resolution = resolveActiveContract(goalId, goalContracts, nowISO);
    if (!resolution.contract) {
      eligibilityByGoal[goalId] = { allowed: false, reasons: [resolution.reasonCode], contractId: null };
      denials.push({ goalId, reasons: [resolution.reasonCode], atISO: nowTimestampISO });
      return;
    }
    const lastSuggestedAtISO = history.lastSuggestedAtISOByGoal?.[goalId] || null;
    const dailyCount = history.dailyCountByGoal?.[goalId]?.[nowISO] || 0;
    const directiveDomain = candidate?.practice || null;
    const gate = authorizeSuggestion(resolution.contract, {
      nowISO,
      nowTimestampISO,
      executionEventCount,
      activeBlocksCount,
      lastSuggestedAtISO,
      suggestionsTodayCount: dailyCount,
      directiveTags: candidate ? [candidate.type] : [],
      directiveDomain,
    });
    eligibilityByGoal[goalId] = {
      allowed: gate.allowed,
      reasons: gate.reasons,
      contractId: resolution.contract.contractId,
    };
    if (!gate.allowed) {
      denials.push({ goalId, reasons: gate.reasons, atISO: nowTimestampISO });
      return;
    }
    if (candidate) {
      allowed.push({ goalId, suggestion: { ...candidate, goalId } });
    }
  });

  if (!allowed.length) {
    return { suggestion: null, eligibilityByGoal, selectedGoalId: null, denials };
  }

  allowed.sort((a, b) => {
    const aStart = a.suggestion.startISO || '';
    const bStart = b.suggestion.startISO || '';
    if (aStart !== bStart) {
      return aStart.localeCompare(bStart);
    }
    return a.goalId.localeCompare(b.goalId);
  });

  const winner = allowed[0];
  return { suggestion: winner.suggestion, eligibilityByGoal, selectedGoalId: winner.goalId, denials };
}

function applyProbabilityEligibility(state) {
  const nowISO = state.appTime?.nowISO || `${state.appTime?.activeDayKey || nowDayKey()}T12:00:00.000Z`;
  const contracts = collectGovernanceContracts(state);
  const goalIds = Array.from(new Set(contracts.map((c) => c.goalId)));
  const statuses = {};
  goalIds.forEach((goalId) => {
    const admission = state.goalAdmissionByGoal?.[goalId];
    if (admission && !isAdmittedGoalStatus(admission.status)) {
      return;
    }
    statuses[goalId] = deriveProbabilityStatus({
      goalId,
      nowISO,
      executionEventCount: (state.executionEvents || []).length,
      executionEvents: state.executionEvents || [],
      contracts,
    });
  });
  state.probabilityStatusByGoal = statuses;
}

function resolvePlanQualityGateForGoal(state, goalId) {
  const cycle = resolveCycleForGoal(state, goalId);
  return cycle?.planQualityGate || state?.planQualityGateByGoal?.[goalId] || null;
}

function buildFallbackPolicyIntakeContract(state, cycle, executionContract, goalId) {
  if (!goalId || !executionContract) {
    return null;
  }
  const goalDraft = cycle?.goalDraftV2 || state?.pendingOnboardingInputs?.goalDraftV2 || null;
  const answeredContext =
    goalDraft?.answeredContext ||
    state?.pendingOnboardingInputs?.answeredContext ||
    executionContract?.planningIntake ||
    {};
  const rawGoalText =
    executionContract?.goalText ||
    executionContract?.goalLabel ||
    executionContract?.terminalOutcome?.text ||
    goalDraft?.goalText ||
    state?.pendingOnboardingInputs?.goalText ||
    '';
  if (!String(rawGoalText || '').trim()) {
    return null;
  }
  const verificationCriteria =
    executionContract?.terminalOutcome?.verificationCriteria ||
    state?.pendingOnboardingInputs?.definitionOfDone ||
    '';
  const completionBoundaryStatus =
    String(rawGoalText || '').trim() && String(verificationCriteria || '').trim() ? 'resolved' : 'missing';
  return {
    goalId,
    rawGoalText,
    domain: executionContract?.goalIntakeContract?.domain || 'general',
    targetArtifactType: null,
    targetCount: executionContract?.target?.count ?? 1,
    targetUnit: executionContract?.target?.unit || null,
    deadline:
      executionContract?.deadline?.dayKey ||
      executionContract?.endDayKey ||
      state?.pendingOnboardingInputs?.deadline ||
      null,
    commitmentVerb: String(rawGoalText).split(/\s+/, 1)[0]?.toLowerCase() || null,
    completionBoundary: null,
    completionBoundaryStatus,
    deliveryMode: null,
    productionMode: null,
    startingState: null,
    requiredContextQuestions: [],
    answeredContext,
    scopePolicy: {
      required: [],
      recommended: [],
      optional: [],
      excluded: [],
      assumptionsNeedingConfirmation: [],
    },
    readiness: {
      state: 'fully_admitted',
      isReadyForPlanning: true,
      blockingReasons: [],
      assumptionReasons: [],
    },
    terminalOutcomeAuthority: executionContract?.goalIntakeContract?.terminalOutcomeAuthority || null,
    terminalEndpoint: executionContract?.goalIntakeContract?.terminalEndpoint || null,
  };
}

function formatMinutesAsHHMM(totalMinutes) {
  const safeMinutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(safeMinutes / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (safeMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function computeInclusiveDaySpan(startDayKey, endDayKey) {
  const startMs = Date.parse(`${String(startDayKey || '').trim()}T00:00:00.000Z`);
  const endMs = Date.parse(`${String(endDayKey || '').trim()}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  return Math.floor((endMs - startMs) / 86400000) + 1;
}

function buildMasterPlanWorkWindows(masterCalendar = null) {
  const availableCapacityHours = Number(masterCalendar?.availableCapacityHours);
  const baseCapacityHours = Number(masterCalendar?.baseWeeklyCapacityHours);
  const weeklyHours =
    Number.isFinite(availableCapacityHours) && availableCapacityHours > 0
      ? availableCapacityHours
      : Number.isFinite(baseCapacityHours) && baseCapacityHours > 0
        ? baseCapacityHours
        : 40;
  const dailyMinutes = Math.max(60, Math.round((weeklyHours * 60) / 5));
  const startMinutes = 9 * 60;
  const endMinutes = Math.min(23 * 60 + 59, startMinutes + dailyMinutes);
  const weekdayWindow = [{ start: formatMinutesAsHHMM(startMinutes), end: formatMinutesAsHHMM(endMinutes) }];
  return {
    mon: weekdayWindow,
    tue: weekdayWindow,
    wed: weekdayWindow,
    thu: weekdayWindow,
    fri: weekdayWindow,
    sat: [],
    sun: [],
  };
}

function attachFullHorizonAgendaMetadata(state, plan, descriptors, qualitySnapshot = {}) {
  if (!state || !plan?.id || !plan?.profileId) {
    return;
  }
  const blocks = Array.isArray(state.fullHorizonScheduleBlocks) ? state.fullHorizonScheduleBlocks : [];
  if (blocks.length === 0) {
    return;
  }

  const profileId = String(plan.profileId || '').trim();
  const profile = profileId ? state?.profilesById?.[profileId] || null : null;
  if (!profile) {
    return;
  }

  const createdAtISO = state?.appTime?.nowISO || new Date().toISOString();
  const workWindows =
    descriptors?.masterCalendar?.workWindows ||
    descriptors?.masterCalendar?.savedWorkWindows ||
    buildMasterPlanWorkWindows(descriptors?.masterCalendar);
  const weeklyCapacityMinutes = Math.max(
    0,
    Math.round(Number(descriptors?.weeklyCapacityHours || 0) * 60)
  );
  const constraintsStatus =
    descriptors?.masterCalendar?.constraintsStatus ||
    descriptors?.masterCalendar?.availabilityStatus ||
    (descriptors?.masterCalendar ? 'master_calendar_inferred' : 'no_saved_constraints');
  const constraintSource = descriptors?.masterCalendarId ? 'master_calendar' : 'manual';
  const constraintVersion = buildFullHorizonConstraintVersion({
    profileId,
    masterPlanId: plan.id,
    createdAtISO,
    officialStartDayKey: descriptors?.startDayKey || plan?.officialStartDate || plan?.horizonStart || null,
    weeklyCapacityMinutes,
    workWindows,
    source: constraintSource,
    masterCalendarId: descriptors?.masterCalendarId || null,
    constraintsStatus,
  });

  state.scheduleConstraintVersionsById = state.scheduleConstraintVersionsById || {};
  state.scheduleConstraintVersionsById[constraintVersion.id] = {
    ...(state.scheduleConstraintVersionsById[constraintVersion.id] || {}),
    ...constraintVersion,
  };

  const { agendaVersion, agendaVersionsById } = buildFullHorizonAgendaVersion({
    profileId,
    masterPlanId: plan.id,
    createdAtISO,
    range: {
      startDayKey: descriptors?.startDayKey || plan?.horizonStart || null,
      endDayKey: descriptors?.fullHorizonEndDayKey || plan?.fullHorizonEndDayKey || plan?.horizonEnd || null,
    },
    blocks,
    sourceConstraintVersionId: constraintVersion.id,
    strategicCoverageState: qualitySnapshot?.strategicCoverageState || null,
    planQualityState: qualitySnapshot?.planQualityState || null,
    blockQualityState: qualitySnapshot?.blockQualityState || null,
    existingAgendaVersionsById: state.masterPlanAgendaVersionsById || {},
    existingCurrentAgendaVersionId: plan?.currentAgendaVersionId || null,
  });

  state.masterPlanAgendaVersionsById = agendaVersionsById;
  plan.currentAgendaVersionId = agendaVersion.id;
  plan.agendaVersionIds = Array.from(new Set([...(Array.isArray(plan.agendaVersionIds) ? plan.agendaVersionIds : []), agendaVersion.id]));
  plan.currentScheduleConstraintVersionId = constraintVersion.id;
  plan.scheduleConstraintVersionIds = Array.from(
    new Set([...(Array.isArray(plan.scheduleConstraintVersionIds) ? plan.scheduleConstraintVersionIds : []), constraintVersion.id])
  );
  plan.fullHorizonAgendaState = agendaVersion.state;

  profile.agendaVersionIds = Array.from(
    new Set([...(Array.isArray(profile.agendaVersionIds) ? profile.agendaVersionIds : []), agendaVersion.id])
  );
  profile.scheduleConstraintVersionIds = Array.from(
    new Set([
      ...(Array.isArray(profile.scheduleConstraintVersionIds) ? profile.scheduleConstraintVersionIds : []),
      constraintVersion.id,
    ])
  );
}

function inferMasterPlanOutcomeAuthority(lanes = []) {
  const domains = new Set(
    lanes
      .map((lane) =>
        String(lane?.domain || '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );
  if (domains.has('income') || domains.has('brand')) {
    return 'market_dependent';
  }
  if (domains.has('product') || domains.has('software') || domains.has('creative') || domains.has('media')) {
    return 'mixed';
  }
  return 'unknown';
}

function resolveMasterPlanEndDayKey(plan, milestones = [], anchors = [], fallbackDayKey) {
  const explicitEnd = String(plan?.fullHorizonEndDayKey || plan?.horizonEnd || '').trim();
  if (explicitEnd) {
    return explicitEnd;
  }
  const datedAnchors = anchors
    .map((anchor) => String(anchor?.date || '').trim())
    .filter(Boolean)
    .sort();
  if (datedAnchors.length > 0) {
    return datedAnchors[datedAnchors.length - 1];
  }
  const targetDates = milestones
    .map((milestone) => String(milestone?.targetDate || '').trim())
    .filter(Boolean)
    .sort();
  return targetDates[targetDates.length - 1] || fallbackDayKey || null;
}

function getNextMasterPlanHardAnchorDayKey(plan, startDayKey) {
  const datedAnchors = (Array.isArray(plan?.anchors) ? plan.anchors : [])
    .filter((anchor) => anchor?.isFixed && String(anchor?.date || '').trim())
    .map((anchor) => String(anchor.date).trim())
    .sort();
  const normalizedStart = String(startDayKey || '').trim();
  return datedAnchors.find((dayKey) => !normalizedStart || dayKey >= normalizedStart) || null;
}

function hasSchedulableWorkWindowOnDay(dayKey, workWindows = {}) {
  const weekday = getWeekdayKeyFromDayKey(dayKey);
  const windows = Array.isArray(workWindows?.[weekday]) ? workWindows[weekday] : [];
  return windows.some((window) => Math.max(0, parseHHMMToMinutes(window?.end) - parseHHMMToMinutes(window?.start)) > 0);
}

function resolveSchedulableCoverageDayKey(startDayKey, deadlineDayKey, workWindows = {}, timeZone = APP_TIME_ZONE) {
  if (!deadlineDayKey) {
    return null;
  }
  let cursor = deadlineDayKey;
  const lowerBound = String(startDayKey || '').trim() || null;
  while (cursor && (!lowerBound || cursor >= lowerBound)) {
    if (hasSchedulableWorkWindowOnDay(cursor, workWindows)) {
      return cursor;
    }
    cursor = addDays(cursor, -1, timeZone);
  }
  return deadlineDayKey;
}

function hasOccupiedCycleSchedule(cycle) {
  if (!cycle) {
    return false;
  }
  const lifecycle = String(cycle?.scheduleLifecycle || '')
    .trim()
    .toLowerCase();
  if (lifecycle === 'active_schedule' || lifecycle === 'applied_review') {
    return true;
  }
  return (
    (Array.isArray(cycle?.executionEvents) && cycle.executionEvents.length > 0) ||
    (Array.isArray(cycle?.scheduleReviewBlocks) && cycle.scheduleReviewBlocks.length > 0) ||
    (Array.isArray(cycle?.proposedBlocks) && cycle.proposedBlocks.length > 0)
  );
}

function findNextSchedulableDayKey(startDayKey, workWindows = {}, timeZone = APP_TIME_ZONE, upperBoundDayKey = null) {
  const normalizedStart = String(startDayKey || '').trim();
  if (!normalizedStart) {
    return null;
  }
  let cursor = normalizedStart;
  let guard = 0;
  while (cursor && guard < 5000 && (!upperBoundDayKey || cursor <= upperBoundDayKey)) {
    if (hasSchedulableWorkWindowOnDay(cursor, workWindows)) {
      return cursor;
    }
    const next = addDays(cursor, 1, timeZone);
    if (!next || next === cursor) {
      break;
    }
    cursor = next;
    guard += 1;
  }
  return null;
}

function deriveFirstCycleDelayPolicy(plan = null, cycle = null, contract = null, timeZone = APP_TIME_ZONE) {
  const delayUntilDayKey = coerceDayKey(
    contract?.firstCycleDelayUntilDayKey ||
      contract?.startDateDelayUntilDayKey ||
      cycle?.firstCycleDelayUntilDayKey ||
      cycle?.startDateDelayUntilDayKey ||
      plan?.firstCycleDelayUntilDayKey ||
      plan?.startDateDelayUntilDayKey ||
      null,
    timeZone
  );
  const reasonCode =
    String(
      contract?.startDateDelayReasonCode ||
        cycle?.startDateDelayReasonCode ||
        plan?.startDateDelayReasonCode ||
        ''
    ).trim() || 'EXPLICIT_DELAY';
  const reasonLabel =
    String(contract?.startDateDelayReason || cycle?.startDateDelayReason || plan?.startDateDelayReason || '').trim() ||
    null;
  return {
    delayUntilDayKey,
    reasonCode,
    reasonLabel,
  };
}

export function resolveFirstCycleScheduleStart(
  state,
  { plan = null, cycle = null, contract = null, activationDayKey = null } = {}
) {
  const timeZone = state?.appTime?.timeZone || APP_TIME_ZONE;
  const todayDayKey =
    coerceDayKey(state?.today?.date, timeZone) ||
    coerceDayKey(state?.appTime?.activeDayKey, timeZone) ||
    nowDayKey(timeZone);
  const planStartDayKey =
    coerceDayKey(plan?.horizonStart, timeZone) ||
    coerceDayKey(plan?.officialStartDate, timeZone) ||
    null;
  const activationStartDayKey =
    coerceDayKey(
      activationDayKey ||
        contract?.activationDateISO ||
        cycle?.activationDateISO ||
        cycle?.goalGovernanceContract?.activeFromISO ||
        null,
      timeZone
    ) || null;
  const candidateStartDayKey =
    [todayDayKey, activationStartDayKey, planStartDayKey].filter(Boolean).sort().pop() || todayDayKey || null;
  const deadlineDayKey =
    coerceDayKey(contract?.endDayKey, timeZone) ||
    coerceDayKey(contract?.deadline?.dayKey, timeZone) ||
    coerceDayKey(contract?.deadlineISO, timeZone) ||
    coerceDayKey(plan?.fullHorizonEndDayKey, timeZone) ||
    coerceDayKey(plan?.horizonEnd, timeZone) ||
    null;
  const explicitDelay = deriveFirstCycleDelayPolicy(plan, cycle, contract, timeZone);
  if (explicitDelay.delayUntilDayKey && (!candidateStartDayKey || explicitDelay.delayUntilDayKey >= candidateStartDayKey)) {
    return {
      candidateStartDayKey,
      resolvedStartDayKey: explicitDelay.delayUntilDayKey,
      reasonCode: explicitDelay.reasonCode,
      reasonLabel:
        explicitDelay.reasonLabel || `Start delayed until ${explicitDelay.delayUntilDayKey} by an explicit planning rule.`,
      delayed: true,
    };
  }
  if (hasOccupiedCycleSchedule(cycle)) {
    const occupiedStartDayKey =
      resolveEffectiveExecutableStartDayKey({
        executionStartDayKey: cycle?.executionStartDayKey || null,
        reassessmentCompletedAtISO: cycle?.reassessmentCompletedAtISO || null,
        scheduleGeneratedAtISO: cycle?.scheduleGeneratedAtISO || cycle?.autoAsanaPlan?.audit?.generatedAtISO || null,
        fallbackStartDayKey:
          cycle?.startedAtDayKey ||
          cycle?.goalGovernanceContract?.activeFromISO ||
          cycle?.goalContract?.startDayKey ||
          cycle?.goalContract?.startDateISO ||
          cycle?.goalContract?.startDate ||
          candidateStartDayKey ||
          null,
      }) ||
      candidateStartDayKey ||
      null;
    return {
      candidateStartDayKey,
      resolvedStartDayKey: occupiedStartDayKey,
      reasonCode: 'ACTIVE_CYCLE_OCCUPANCY',
      reasonLabel: 'The active cycle remains authoritative, but its visible execution floor is clamped to the latest valid start.',
      delayed: Boolean(candidateStartDayKey && occupiedStartDayKey && occupiedStartDayKey > candidateStartDayKey),
    };
  }

  const contractWorkWindows = normalizeCanonicalWorkWindows(contract?.workWindows || {});
  const availabilityWorkWindows = normalizeCanonicalWorkWindows(state?.availabilityPolicy?.workWindows || {});
  const planWorkWindows = normalizeCanonicalWorkWindows(
    plan?.profileId
      ? buildMasterPlanWorkWindows(state?.masterCalendarsById?.[state?.profilesById?.[plan.profileId]?.masterCalendarId] || null)
      : {}
  );
  const workWindows =
    countRawWorkWindows(contractWorkWindows) > 0
      ? contractWorkWindows
      : countRawWorkWindows(availabilityWorkWindows) > 0
        ? availabilityWorkWindows
        : planWorkWindows;
  if (countRawWorkWindows(workWindows) === 0) {
    return {
      candidateStartDayKey,
      resolvedStartDayKey: candidateStartDayKey,
      reasonCode: 'EARLIEST_VALID_DATE',
      reasonLabel: 'Starts at the earliest valid date.',
      delayed: false,
    };
  }
  const firstAvailableDayKey = findNextSchedulableDayKey(candidateStartDayKey, workWindows, timeZone, deadlineDayKey);
  if (!firstAvailableDayKey) {
    return {
      candidateStartDayKey,
      resolvedStartDayKey: candidateStartDayKey,
      reasonCode: 'NO_AVAILABILITY_DEFINED',
      reasonLabel: 'No schedulable availability exists before the current deadline.',
      delayed: false,
    };
  }
  return {
    candidateStartDayKey,
    resolvedStartDayKey: firstAvailableDayKey,
    reasonCode: firstAvailableDayKey > candidateStartDayKey ? 'NO_AVAILABILITY_BEFORE_DATE' : 'EARLIEST_VALID_DATE',
    reasonLabel:
      firstAvailableDayKey > candidateStartDayKey
        ? `No saved availability exists before ${firstAvailableDayKey}.`
        : 'Starts at the earliest valid date.',
    delayed: firstAvailableDayKey > candidateStartDayKey,
  };
}

function buildMasterPlanPolicySnapshot(state, plan) {
  if (!plan?.id || !plan?.profileId) {
    return null;
  }
  const profile = state?.profilesById?.[plan.profileId] || null;
  const masterCalendarId = profile?.masterCalendarId || null;
  const masterCalendar = masterCalendarId ? state?.masterCalendarsById?.[masterCalendarId] || null : null;
  const fallbackToday = state?.today?.date || nowDayKey(state?.appTime?.timeZone || APP_TIME_ZONE);
  const lanes = (plan?.laneIds || [])
    .map((laneId) => state?.masterPlanLanesById?.[laneId] || null)
    .filter(Boolean);
  const milestones = lanes
    .flatMap((lane) =>
      (lane?.milestoneIds || []).map((milestoneId) => state?.masterPlanMilestonesById?.[milestoneId] || null)
    )
    .filter(Boolean)
    .sort((left, right) => String(left?.targetDate || '').localeCompare(String(right?.targetDate || '')));
  const goalId = `masterplan:${plan.id}`;
  const cycleId = `masterplan-cycle:${plan.id}`;
  // Phase 7 cycle-creation rebase: never let a fresh operational cycle start
  // in the past. plan.horizonStart is the plan's published start (which may
  // be backdated for narrative clarity); the active execution window must
  // begin on today unless the plan explicitly starts in the future.
  const horizonStart = String(plan?.horizonStart || '').trim();
  const startDayKey = horizonStart && horizonStart > fallbackToday ? horizonStart : fallbackToday;
  const endDayKey = resolveMasterPlanEndDayKey(plan, milestones, plan?.anchors || [], startDayKey);
  const laneStageSummary = lanes
    .map((lane) => {
      const laneTitle = String(lane?.title || '').trim();
      const stage = String(lane?.assessedStage || '').trim();
      return laneTitle && stage ? `${laneTitle}: ${stage}` : laneTitle || stage;
    })
    .filter(Boolean)
    .join('; ');
  const structureCritic = plan?.structureCritic || null;
  const criticUnresolvedQuestions = Array.isArray(structureCritic?.unresolvedQuestions)
    ? structureCritic.unresolvedQuestions
    : [];
  const criticReasonCodes = Array.isArray(structureCritic?.unresolvedReasonCodes)
    ? structureCritic.unresolvedReasonCodes
    : [];
  const verificationCriteria = [
    milestones.length > 0
      ? `${milestones.length} named milestones sequenced across ${Math.max(1, lanes.length)} active lanes`
      : null,
    lanes.length > 0 ? `lane coverage: ${lanes.map((lane) => lane.title).join(', ')}` : null,
    Array.isArray(plan?.anchors) && plan.anchors.length > 0
      ? `anchor coverage: ${plan.anchors.map((anchor) => `${anchor.label} on ${anchor.date}`).join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const answeredContext = {
    planningTier: 'master_plan',
    goalClassification: 'multi_lane_master_plan',
    startingState: laneStageSummary || 'multi-lane campaign baseline captured',
    masterCalendarId: masterCalendarId || '',
    coreMissionContractId: plan?.coreMissionContractId || '',
    coreMission: plan?.coreMission || '',
    outcomeTarget: plan?.outcomeTarget || '',
    successStandard: plan?.successStandard || '',
    controllabilityClass: plan?.controllabilityClass || 'controllable',
    terminalTargetClass: plan?.terminalTargetClass || 'controllable',
    controllableSuccessSignals: Array.isArray(plan?.controllableSuccessSignals) ? [...plan.controllableSuccessSignals] : [],
    externallyMediatedTargets: Array.isArray(plan?.externallyMediatedTargets) ? [...plan.externallyMediatedTargets] : [],
    weeklyCapacityHours:
      Number.isFinite(Number(masterCalendar?.availableCapacityHours)) && Number(masterCalendar?.availableCapacityHours) > 0
        ? Number(masterCalendar.availableCapacityHours)
        : Number.isFinite(Number(masterCalendar?.baseWeeklyCapacityHours)) && Number(masterCalendar?.baseWeeklyCapacityHours) > 0
          ? Number(masterCalendar.baseWeeklyCapacityHours)
          : 40,
    capitalAcquisitionRequired: Boolean(plan?.financialConstraint?.exists),
  };
  const baseIntakeContract = buildGoalIntakeContract({
    goalId,
    rawGoalText: String(getMasterPlanGoalText(plan)).trim(),
    goalText: String(getMasterPlanGoalText(plan)).trim(),
    verificationCriteria,
    executionType: 'StrategicExecution',
    deadline: endDayKey,
    answeredContext,
  });
  const intakeContract = {
    ...baseIntakeContract,
    goalId,
    rawGoalText: String(getMasterPlanGoalText(plan)).trim(),
    completionBoundary:
      /launch|release|publish|drop|ship|client|revenue|sale/i.test(String(getMasterPlanGoalText(plan)))
        ? 'launched'
        : 'delivered',
    completionBoundaryStatus: milestones.length > 0 ? 'resolved' : 'missing',
    answeredContext: {
      ...(baseIntakeContract?.answeredContext || {}),
      ...answeredContext,
    },
    startingState: answeredContext.startingState,
    requiredContextQuestions: criticUnresolvedQuestions
      .filter((question) => String(question?.criticality || '').trim().toLowerCase() === 'blocker')
      .map((question) => ({
        prompt: question?.question || 'Additional structure context is required.',
        reasonCode: question?.reasonCode || 'STRUCTURE_CONTEXT_UNRESOLVED',
      })),
    readiness: {
      state:
        milestones.length > 0 && lanes.length > 0
          ? criticReasonCodes.length > 0
            ? 'assumption_marked_draft'
            : 'fully_admitted'
          : 'assumption_marked_draft',
      isReadyForPlanning: milestones.length > 0 && lanes.length > 0,
      blockingReasons: [],
      assumptionReasons:
        uniqueStrings(
          milestones.length > 0 && lanes.length > 0
            ? [
                ...criticReasonCodes,
                ...(plan?.controllabilityClass && plan.controllabilityClass !== 'controllable'
                  ? ['terminal target remains externally mediated']
                  : []),
              ]
            : [
                'lane calibration incomplete',
                ...criticReasonCodes,
                ...(plan?.controllabilityClass && plan.controllabilityClass !== 'controllable'
                  ? ['terminal target remains externally mediated']
                  : []),
              ]
        ),
    },
  };

  const deliverables = lanes.map((lane) => ({
    id: `masterplan-deliverable:${lane.id}`,
    title: lane.title,
    actionIds: (lane?.milestoneIds || []).map((milestoneId) => `masterplan-action:${milestoneId}`),
    dependencyIds: (lane?.dependsOnLaneIds || []).map((laneId) => `masterplan-deliverable:${laneId}`),
  }));
  const laneMilestonesByLaneId = new Map(
    lanes.map((lane) => [
      lane.id,
      (lane?.milestoneIds || [])
        .map((milestoneId) => state?.masterPlanMilestonesById?.[milestoneId] || null)
        .filter(Boolean)
        .sort((left, right) => String(left?.targetDate || '').localeCompare(String(right?.targetDate || ''))),
    ])
  );
  const actions = lanes.flatMap((lane) => {
    const laneMilestones = laneMilestonesByLaneId.get(lane.id) || [];
    return laneMilestones.map((milestone, index) => {
      const previousMilestone = index > 0 ? laneMilestones[index - 1] : null;
      return {
        id: `masterplan-action:${milestone.id}`,
        title: milestone.title,
        deliverableId: `masterplan-deliverable:${lane.id}`,
        actionType: milestone?.milestoneType === 'gate' ? 'preparation' : 'execution',
        dependencies: previousMilestone ? [`masterplan-action:${previousMilestone.id}`] : [],
        readinessCondition: milestone?.milestoneType === 'gate' ? 'gate checkpoint satisfied' : null,
      };
    });
  });
  const preExecutionSchedule = {
    blockCount: milestones.length,
    totalMinutes: milestones.reduce((sum, milestone) => {
      const type = String(milestone?.milestoneType || '').trim().toLowerCase();
      const estimatedMinutes = type === 'anchor' ? 150 : type === 'gate' ? 120 : 90;
      return sum + estimatedMinutes;
    }, 0),
  };
  const workWindows = buildMasterPlanWorkWindows(masterCalendar);
  const executionContract = {
    goalId,
    cycleId,
    goalLabel: getMasterPlanGoalLabel(plan),
    goalText: getMasterPlanGoalText(plan),
    goalIntakeContract: intakeContract,
    startDayKey,
    endDayKey,
    deadline: { dayKey: endDayKey },
    workWindows,
    terminalOutcome: {
      text: String(getMasterPlanTargetText(plan)).trim(),
      verificationCriteria,
      isConcrete: milestones.length > 0,
    },
    target: {
      count: lanes.length || null,
      unit: lanes.length === 1 ? 'campaign' : 'campaigns',
    },
  };
  const horizonDays = startDayKey && endDayKey ? computeInclusiveDaySpan(startDayKey, endDayKey) : null;
  return buildGoalPolicySnapshot({
    goalId,
    intakeContract,
    executionContract,
    planProof: {
      feasibilityStatus: milestones.length > 0 && lanes.length > 0 ? 'FEASIBLE' : 'INFEASIBLE',
      totalRequiredUnits: milestones.length,
      workableDaysRemaining: horizonDays || 0,
    },
    probabilityStatus: 'insufficient_evidence',
    feasibilityStatus: milestones.length > 0 && lanes.length > 0 ? 'FEASIBLE' : 'REQUIRED',
    hasCommittedBlocks: false,
    hasProposedBlocks: milestones.length > 0,
    hasExecutionGraph: lanes.length > 0 && actions.length > 0 && deliverables.length > 0,
    canonicalActions: actions,
    canonicalDeliverables: deliverables,
    longTermPlan: {
      isLongHorizon: Boolean((horizonDays || 0) > 120),
      quality: { state: milestones.length > 0 ? 'trusted' : 'withheld', reasonCodes: [] },
      saturation: { saturationShape: milestones.length >= Math.max(3, lanes.length * 2) ? 'balanced' : 'understructured' },
      uncertainty: {
        bands: uniqueById(
          [
            plan?.controllabilityClass && plan.controllabilityClass !== 'controllable'
              ? {
                  id: `target-uncertainty:${plan.id}:controllability`,
                  certainty: 'provisional',
                  phaseTitle: plan?.outcomeTarget || plan?.northStarOutcome || plan?.title || 'Target outcome',
                }
              : null,
            plan?.terminalTargetClass &&
            !['', 'controllable'].includes(String(plan.terminalTargetClass).trim().toLowerCase())
              ? {
                  id: `target-uncertainty:${plan.id}:terminal-class`,
                  certainty: 'provisional',
                  phaseTitle: `${plan?.terminalTargetClass || 'target'} uncertainty`,
                }
              : null,
          ].filter(Boolean)
        ),
      },
      checkpoints: milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        targetDate: milestone.targetDate,
      })),
    },
    preExecutionSchedule,
    canonicalExecutionEvents: [],
    canonicalExternalEvidenceEvents: [],
    liveScheduleApplied: false,
    outcomeAuthorityClass: inferMasterPlanOutcomeAuthority(lanes),
    planQualityFailureCodes: [],
    executionCorrectionState: null,
    executionCorrectionLevel: null,
    blockedDownstreamCount: 0,
    timedDeadlineRiskCount: 0,
    paceState: 'insufficient_evidence',
  });
}

function getActiveMasterPlanRecord(state, requestedPlanId = null) {
  const explicitPlanId = String(requestedPlanId || '').trim() || null;
  if (explicitPlanId) {
    return state?.masterPlansById?.[explicitPlanId] || null;
  }
  const profile = state?.profilesById?.[state?.activeProfileId || ''] || null;
  const activeMasterPlanId = String(profile?.activeMasterPlanId || '').trim() || null;
  if (!activeMasterPlanId) {
    return null;
  }
  return state?.masterPlansById?.[activeMasterPlanId] || null;
}

function getMasterPlanGoalLabel(plan) {
  return plan?.coreMission || plan?.title || plan?.northStarOutcome || 'Master plan execution goal';
}

function getMasterPlanGoalText(plan) {
  return plan?.masterPlanSummary || plan?.northStarOutcome || plan?.outcomeTarget || plan?.title || '';
}

function getMasterPlanTargetText(plan) {
  return plan?.outcomeTarget || plan?.northStarOutcome || plan?.title || '';
}

function mapMasterPlanLaneToPractice(domain) {
  const normalized = String(domain || '')
    .trim()
    .toLowerCase();
  if (normalized === 'creative' || normalized === 'media') {
    return 'CREATION';
  }
  if (normalized === 'brand' || normalized === 'income' || normalized === 'resources') {
    return 'RESOURCES';
  }
  return 'FOCUS';
}

export function buildMasterPlanOperationalDescriptors(state, plan) {
  if (!plan?.id || !plan?.profileId) {
    return null;
  }
  const profile = state?.profilesById?.[plan.profileId] || null;
  const masterCalendarId = profile?.masterCalendarId || null;
  const masterCalendar = masterCalendarId ? state?.masterCalendarsById?.[masterCalendarId] || null : null;
  const timeZone = state?.appTime?.timeZone || APP_TIME_ZONE;
  const fallbackToday = state?.today?.date || nowDayKey(timeZone);
  const lanes = (plan?.laneIds || [])
    .map((laneId) => state?.masterPlanLanesById?.[laneId] || null)
    .filter(Boolean);
  const milestones = lanes
    .flatMap((lane) =>
      (lane?.milestoneIds || []).map((milestoneId) => {
        const milestone = state?.masterPlanMilestonesById?.[milestoneId] || null;
        return milestone ? { ...milestone, lane } : null;
      })
    )
    .filter(Boolean)
    .sort((left, right) => String(left?.targetDate || '').localeCompare(String(right?.targetDate || '')));
  const goalId = `masterplan:${plan.id}`;
  const cycleId = `masterplan-cycle:${plan.id}`;
  const existingCycle = state?.cyclesById?.[cycleId] || null;
  const startResolution = resolveFirstCycleScheduleStart(state, {
    plan,
    cycle: existingCycle,
    contract: existingCycle?.goalContract || null,
  });
  const startDayKey = startResolution.resolvedStartDayKey || fallbackToday;
  const fullHorizonEndDayKey = resolveMasterPlanEndDayKey(plan, milestones, plan?.anchors || [], startDayKey);
  const activePhaseScheduleEndDayKey = getNextMasterPlanHardAnchorDayKey(plan, startDayKey) || fullHorizonEndDayKey;
  const weeklyCapacityHours =
    Number.isFinite(Number(masterCalendar?.availableCapacityHours)) && Number(masterCalendar?.availableCapacityHours) > 0
      ? Number(masterCalendar.availableCapacityHours)
      : Number.isFinite(Number(masterCalendar?.baseWeeklyCapacityHours)) && Number(masterCalendar?.baseWeeklyCapacityHours) > 0
        ? Number(masterCalendar.baseWeeklyCapacityHours)
        : 40;
  return {
    profile,
    masterCalendarId,
    masterCalendar,
    lanes,
    milestones,
    goalId,
    cycleId,
    startDayKey,
    candidateStartDayKey: startResolution.candidateStartDayKey || startDayKey,
    startDateReasonCode: startResolution.reasonCode || null,
    startDateReasonLabel: startResolution.reasonLabel || null,
    startDateDelayed: Boolean(startResolution.delayed),
    endDayKey: fullHorizonEndDayKey,
    fullHorizonEndDayKey,
    activePhaseScheduleEndDayKey,
    timeZone,
    todayDayKey: fallbackToday,
    weeklyCapacityHours,
  };
}

function ensureMasterPlanOperationalCycle(state, plan) {
  const descriptors = buildMasterPlanOperationalDescriptors(state, plan);
  if (!descriptors) {
    return null;
  }
  const {
    profile,
    masterCalendarId,
    lanes,
    milestones,
    goalId,
    cycleId,
    startDayKey,
    candidateStartDayKey,
    startDateReasonCode,
    startDateReasonLabel,
    startDateDelayed,
    endDayKey,
    fullHorizonEndDayKey,
    activePhaseScheduleEndDayKey,
    timeZone,
    weeklyCapacityHours,
  } = descriptors;
  if (!profile) {
    return null;
  }
  state.goalsById = state.goalsById || {};
  state.cyclesById = state.cyclesById || {};
  state.goalAdmissionByGoal = state.goalAdmissionByGoal || {};
  ensureDeliverablesStore(state);

  const verificationCriteria = [
    milestones.length > 0
      ? `${milestones.length} named milestones sequenced across ${Math.max(1, lanes.length)} active lanes`
      : null,
    lanes.length > 0 ? `lane coverage: ${lanes.map((lane) => lane.title).join(', ')}` : null,
    Array.isArray(plan?.anchors) && plan.anchors.length > 0
      ? `anchor coverage: ${plan.anchors.map((anchor) => `${anchor.label} on ${anchor.date}`).join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const answeredContext = {
    planningTier: 'master_plan',
    goalClassification: 'multi_lane_master_plan',
    startingState: lanes
      .map((lane) => {
        const laneTitle = String(lane?.title || '').trim();
        const stage = String(lane?.assessedStage || '').trim();
        return laneTitle && stage ? `${laneTitle}: ${stage}` : laneTitle || stage;
      })
      .filter(Boolean)
      .join('; '),
    masterCalendarId: masterCalendarId || '',
    coreMissionContractId: plan?.coreMissionContractId || '',
    weeklyCapacityHours,
    capitalAcquisitionRequired: Boolean(plan?.financialConstraint?.exists),
  };
  const intakeContract = buildGoalIntakeContract({
    goalId,
    rawGoalText: String(getMasterPlanGoalText(plan)).trim(),
    goalText: String(getMasterPlanGoalText(plan)).trim(),
    verificationCriteria,
    executionType: 'StrategicExecution',
    deadline: endDayKey,
    answeredContext,
  });
  const goalContract = {
    goalId,
    profileId: profile.id,
    masterCalendarId,
    masterPlanId: plan.id,
    coreMissionContractId: plan?.coreMissionContractId || null,
    executionType: 'StrategicExecution',
    planningTier: 'master_plan',
    admissionStatus: 'ADMITTED',
    goalLabel: getMasterPlanGoalLabel(plan),
    goalText: getMasterPlanGoalText(plan),
    startDayKey,
    candidateStartDayKey,
    startDateReasonCode,
    startDateReason: startDateReasonLabel,
    startDateDelayed,
    endDayKey: activePhaseScheduleEndDayKey,
    activePhaseScheduleEndDayKey,
    fullHorizonEndDayKey,
    deadlineISO: `${activePhaseScheduleEndDayKey}T23:59:59.000Z`,
    endDateISO: `${activePhaseScheduleEndDayKey}T23:59:59.000Z`,
    deadline: { dayKey: activePhaseScheduleEndDayKey },
    workWindows: emptyCanonicalWorkWindows(),
    suggestedWorkWindows: buildMasterPlanWorkWindows(descriptors.masterCalendar),
    workWindowsSource: 'system_inferred',
    constraintsStatus: 'unsaved',
    capacityValidation: null,
    goalIntakeContract: intakeContract,
    planningIntake: {
      weeklyHoursAvailable: weeklyCapacityHours,
      executionContext: weeklyCapacityHours >= 30 ? 'full_time' : 'part_time',
    },
    terminalOutcome: {
      text: String(getMasterPlanTargetText(plan)).trim(),
      verificationCriteria,
      isConcrete: milestones.length > 0,
    },
    target: {
      count: lanes.length || null,
      unit: lanes.length === 1 ? 'campaign' : 'campaigns',
    },
  };
  const goalGovernanceContract = {
    contractId: `gov-${goalId}`,
    version: 1,
    goalId,
    profileId: profile.id,
    activeFromISO: startDayKey,
    activeUntilISO: activePhaseScheduleEndDayKey,
    scope: {
      domainsAllowed: [],
      timeHorizon: 'week',
      timezone: timeZone || 'UTC',
    },
    governance: {
      suggestionsEnabled: true,
      probabilityEnabled: true,
      minEvidenceEvents: 1,
      cooldowns: { resuggestMinutes: 30, maxSuggestionsPerDay: 6 },
    },
    constraints: {
      forbiddenDirectives: ['repair'],
      maxActiveBlocks: 8,
    },
  };
  const deliverables = lanes.map((lane) => {
    const projection = projectEnterpriseDisplay({
      laneId: lane.id || lane.domain || '',
      laneLabel: lane.title || lane.label || lane.domain || lane.id || '',
      intakeSignals: {
        goalText: String(plan?.goalText || plan?.title || '').trim(),
        declaredLaneIds: Array.isArray(plan?.laneIds) ? plan.laneIds : [],
      },
    });
    return {
      id: `masterplan-deliverable:${lane.id}`,
      title: projection.displayName || lane.title,
      domain: lane.domain,
      masterPlanLaneId: lane.id,
      laneLabel: projection.displayName || lane.title || lane.label || lane.id,
    };
  });
  const actions = milestones.map((milestone) => ({
    id: `masterplan-action:${milestone.id}`,
    title: milestone.title,
    deliverableId: `masterplan-deliverable:${milestone.lane?.id || milestone.laneId}`,
    masterPlanMilestoneId: milestone.id,
    masterPlanLaneId: milestone.lane?.id || milestone.laneId || null,
    dependencies: [],
  }));

  if (!state.goalsById[goalId]) {
    state.goalsById[goalId] = {
      id: goalId,
      title: getMasterPlanGoalLabel(plan),
      profileId: profile.id,
      masterCalendarId,
      masterPlanId: plan.id,
      coreMissionContractId: plan?.coreMissionContractId || null,
      status: 'active',
      source: 'master_plan',
      planningTier: 'master_plan',
      activeCycleId: cycleId,
    };
  } else {
    state.goalsById[goalId] = {
      ...state.goalsById[goalId],
      profileId: state.goalsById[goalId].profileId || profile.id,
      masterCalendarId: state.goalsById[goalId].masterCalendarId || masterCalendarId,
      masterPlanId: state.goalsById[goalId].masterPlanId || plan.id,
      coreMissionContractId: state.goalsById[goalId].coreMissionContractId || plan?.coreMissionContractId || null,
      activeCycleId: cycleId,
    };
  }
  profile.goalIds = Array.isArray(profile.goalIds) ? profile.goalIds : [];
  if (!profile.goalIds.includes(goalId)) {
    profile.goalIds.push(goalId);
  }
  profile.activeGoalId = goalId;

  if (!state.cyclesById[cycleId]) {
    state.cyclesById[cycleId] = {
      id: cycleId,
      status: 'active',
      source: 'master_plan',
      profileId: profile.id,
      masterCalendarId,
      masterPlanId: plan.id,
      coreMissionContractId: plan?.coreMissionContractId || null,
      startedAtDayKey: startDayKey,
      candidateStartDayKey,
      startDateReasonCode,
      startDateReason: startDateReasonLabel,
      reassessmentStatus: 'required',
      reassessmentRequiredAtISO: state.appTime?.nowISO || new Date().toISOString(),
      reassessmentCompletedAtISO: null,
      reassessmentSnapshot: null,
      definiteGoal: {
        outcome: getMasterPlanTargetText(plan) || getMasterPlanGoalLabel(plan),
        deadlineDayKey: activePhaseScheduleEndDayKey,
      },
      goalContract,
      goalGovernanceContract,
      goalAdmission: {
        status: 'ADMITTED',
        reasonCodes: [],
        admittedAtISO: state.appTime?.nowISO || new Date().toISOString(),
      },
      contract: goalContract,
      aim: { text: getMasterPlanGoalText(plan) },
      actions,
      strategy: {
        constraints: {
          maxBlocksPerDay: 2,
          maxBlocksPerWeek: Math.max(4, Math.min(10, Math.ceil(weeklyCapacityHours / 4))),
          workableDayPolicy: { weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] },
        },
      },
      coldPlan: null,
      coldPlanHistory: [],
      executionEvents: [],
      externalEvidenceEvents: [],
      planMutationEvents: [],
      suggestionEvents: [],
      proposedBlocks: [],
      scheduleReviewBlocks: [],
      truthEntries: [],
      planStatus: 'ready',
      suggestionHistory: {
        dayKey: state.today?.date || startDayKey,
        count: 0,
        lastSuggestedAtISO: null,
        lastSuggestedAtISOByGoal: {},
        dailyCountByGoal: {},
        denials: [],
      },
    };
  } else {
    state.cyclesById[cycleId] = {
      ...state.cyclesById[cycleId],
      source: 'master_plan',
      profileId: state.cyclesById[cycleId].profileId || profile.id,
      masterCalendarId: state.cyclesById[cycleId].masterCalendarId || masterCalendarId,
      masterPlanId: state.cyclesById[cycleId].masterPlanId || plan.id,
      coreMissionContractId:
        state.cyclesById[cycleId].coreMissionContractId || plan?.coreMissionContractId || null,
      startedAtDayKey: hasOccupiedCycleSchedule(state.cyclesById[cycleId])
        ? state.cyclesById[cycleId].startedAtDayKey || startDayKey
        : startDayKey,
      candidateStartDayKey,
      startDateReasonCode,
      startDateReason: startDateReasonLabel,
      reassessmentStatus: state.cyclesById[cycleId].reassessmentStatus || 'required',
      reassessmentRequiredAtISO:
        state.cyclesById[cycleId].reassessmentRequiredAtISO || state.appTime?.nowISO || new Date().toISOString(),
      reassessmentCompletedAtISO: state.cyclesById[cycleId].reassessmentCompletedAtISO || null,
      reassessmentSnapshot: state.cyclesById[cycleId].reassessmentSnapshot || null,
      goalContract: {
        ...goalContract,
        workWindows:
          state.cyclesById[cycleId]?.goalContract?.workWindows ||
          goalContract.workWindows,
        workWindowsSource:
          state.cyclesById[cycleId]?.goalContract?.workWindowsSource ||
          goalContract.workWindowsSource,
        constraintsStatus:
          state.cyclesById[cycleId]?.goalContract?.constraintsStatus ||
          goalContract.constraintsStatus,
        capacityValidation:
          state.cyclesById[cycleId]?.goalContract?.capacityValidation ||
          goalContract.capacityValidation,
      },
      goalGovernanceContract,
      goalAdmission: state.cyclesById[cycleId].goalAdmission || {
        status: 'ADMITTED',
        reasonCodes: [],
        admittedAtISO: state.appTime?.nowISO || new Date().toISOString(),
      },
      contract: goalContract,
      actions,
      planStatus: state.cyclesById[cycleId].planStatus || 'ready',
    };
  }
  state.goalAdmissionByGoal[goalId] = {
    status: 'ADMITTED',
    reasonCodes: [],
    admittedAtISO:
      state.goalAdmissionByGoal?.[goalId]?.admittedAtISO || state.appTime?.nowISO || new Date().toISOString(),
  };
  state.deliverablesByCycleId[cycleId] = state.deliverablesByCycleId[cycleId] || {
    deliverables: [],
    suggestionLinks: {},
  };
  state.deliverablesByCycleId[cycleId].deliverables = deliverables;
  state.deliverablesByCycleId[cycleId].suggestionLinks =
    state.deliverablesByCycleId[cycleId].suggestionLinks || {};

  state.activeProfileId = profile.id;
  state.activeGoalId = goalId;
  state.activeCycleId = cycleId;
  state.goalExecutionContract = goalContract;
  state.planDraft = state.planDraft || {
    id: `plan-${goalId}`,
    goalId,
    status: 'draft',
    createdAtISO: state.appTime?.nowISO || new Date().toISOString(),
    primaryDomain: 'FOCUS',
    horizonDays: Math.max(
      14,
      computeInclusiveDaySpan(state.today?.date || startDayKey, activePhaseScheduleEndDayKey)
    ),
    daysPerWeek: 5,
  };

  return { ...descriptors, cycle: state.cyclesById[cycleId], goalContract };
}

function getMasterPlanMilestonePriority(milestone) {
  const type = String(milestone?.milestoneType || '')
    .trim()
    .toLowerCase();
  if (type === 'gate') {
    return 100;
  }
  if (type === 'target') {
    return 90;
  }
  if (type === 'anchor') {
    return 80;
  }
  const missConsequence = String(milestone?.missConsequence || '').trim().toLowerCase();
  if (/launch|release|revenue|client|distribution|store|deadline|anchor/.test(missConsequence)) {
    return 85;
  }
  return 70;
}

function buildMasterPlanReadinessCandidates(plan, lanes = [], weeklyCapacityHours = 0) {
  const hasFixedAnchors = Array.isArray(plan?.anchors) && plan.anchors.some((anchor) => anchor?.isFixed);
  const productLane = lanes.find((lane) => String(lane?.domain || '').trim().toLowerCase() === 'product') || null;
  const creativeLane =
    lanes.find((lane) => String(lane?.domain || '').trim().toLowerCase() === 'creative') || null;
  const mediaLane = lanes.find((lane) => String(lane?.domain || '').trim().toLowerCase() === 'media') || null;
  const incomeLane = lanes.find((lane) => String(lane?.domain || '').trim().toLowerCase() === 'income') || null;
  const candidates = [];
  if (hasFixedAnchors) {
    candidates.push({
      key: 'confirm-hard-anchors',
      title: 'Confirm Operation Endgame hard anchors',
      minutes: 45,
      practice: 'FOCUS',
      priority: 125,
      missConsequence: 'Anchor drift weakens every downstream lane sequence.',
      derivedFrom: 'master_plan_fixed_anchors',
      laneId: null,
      milestoneId: null,
    });
  }
  if (creativeLane || productLane || mediaLane) {
    candidates.push({
      key: 'inventory-existing-assets',
      title: 'Inventory existing album/app/podcast assets',
      minutes: 60,
      practice: creativeLane ? mapMasterPlanLaneToPractice(creativeLane.domain) : 'FOCUS',
      priority: 120,
      missConsequence: 'Without asset inventory, first-cycle sequencing and readiness gates stay fuzzy.',
      derivedFrom: 'cross_lane_readiness_inventory',
      laneId: creativeLane?.id || productLane?.id || mediaLane?.id || null,
      milestoneId: null,
    });
  }
  if (productLane) {
    candidates.push({
      key: 'define-app-readiness-gate',
      title: 'Define first app launch readiness gate',
      minutes: 60,
      practice: mapMasterPlanLaneToPractice(productLane.domain),
      priority: 118,
      missConsequence: 'App lane can drift into pseudo-progress without a concrete first readiness gate.',
      derivedFrom: 'product_lane_readiness_gate',
      laneId: productLane.id,
      milestoneId: null,
    });
  }
  candidates.push({
    key: 'review-first-cycle-sequence',
    title: 'Review first-cycle milestone sequence',
    minutes: 45,
    practice: 'FOCUS',
    priority: 116,
    missConsequence: 'Sequence ambiguity increases schedule churn before execution begins.',
    derivedFrom: 'first_cycle_sequence_review',
    laneId: null,
    milestoneId: null,
  });
  if (incomeLane || plan?.financialConstraint?.exists) {
    candidates.push({
      key: 'identify-income-calendar-burden',
      title: 'Identify job-search/income calendar burden',
      minutes: 45,
      practice: incomeLane ? mapMasterPlanLaneToPractice(incomeLane.domain) : 'RESOURCES',
      priority: 114,
      missConsequence: 'Runway pressure can silently consume the master calendar if it is not made explicit.',
      derivedFrom: 'income_runway_calendar_pressure',
      laneId: incomeLane?.id || null,
      milestoneId: null,
    });
  }
  if (!(Number.isFinite(Number(weeklyCapacityHours)) && Number(weeklyCapacityHours) > 0)) {
    candidates.push({
      key: 'clarify-capacity',
      title: 'Clarify weekly execution capacity',
      minutes: 30,
      practice: 'FOCUS',
      priority: 112,
      missConsequence: 'Capacity ambiguity weakens first-cycle schedule realism.',
      derivedFrom: 'missing_weekly_capacity',
      laneId: null,
      milestoneId: null,
    });
  }
  const followupQuestions = [
    ...(Array.isArray(plan?.structureCritic?.unresolvedQuestions) ? plan.structureCritic.unresolvedQuestions : []),
    ...(Array.isArray(plan?.structureCritic?.deferredQuestions) ? plan.structureCritic.deferredQuestions : []),
  ];
  followupQuestions.slice(0, 2).forEach((question, index) => {
    candidates.push({
      key: `critic-clarification-${index + 1}`,
      title: String(question?.question || 'Clarify unresolved plan substrate').trim(),
      expectedOutput:
        String(question?.question || '').trim()
          ? `Written resolution for: ${String(question.question).trim().replace(/\?+$/g, '')}.`
          : 'Written resolution for the unresolved plan substrate item.',
      minutes: 30,
      practice: question?.domain === 'income_runway' ? 'RESOURCES' : 'FOCUS',
      priority: String(question?.criticality || '').trim().toLowerCase() === 'high' ? 117 - index : 109 - index,
      missConsequence:
        String(question?.reason || '').trim() || 'Unresolved structure context weakens schedule and feasibility trust.',
      derivedFrom: String(question?.resolvesField || 'structureCritic').trim(),
      laneId: question?.laneId || null,
      milestoneId: null,
    });
  });
  return candidates;
}

const QUESTION_TITLE_REWRITES = [
  {
    match: /^what cannot be sacrificed if timing slips\??$/i,
    title: 'Define timing-slip non-negotiables',
    expectedOutput: 'Written list of what cannot be sacrificed if anchor dates or sequence timing slip.',
  },
  {
    match: /^what must stay true for the hard anchor dates.*\??$/i,
    title: 'Document hard-anchor requirements',
    expectedOutput: 'Written rules describing what must stay true for the hard anchor dates to remain credible.',
  },
];

const QUESTION_PREFIX_ACTIONS = [
  { prefix: 'what', verb: 'Define' },
  { prefix: 'which', verb: 'Confirm' },
  { prefix: 'do', verb: 'Verify' },
  { prefix: 'does', verb: 'Verify' },
  { prefix: 'can', verb: 'Assess' },
  { prefix: 'should', verb: 'Decide' },
  { prefix: 'will', verb: 'Confirm' },
  { prefix: 'why', verb: 'Document rationale for' },
  { prefix: 'how', verb: 'Map' },
  { prefix: 'when', verb: 'Set timing for' },
  { prefix: 'where', verb: 'Identify location for' },
];

function isQuestionLikeScheduleTitle(title = '') {
  const normalized = String(title || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (normalized.includes('?')) {
    return true;
  }
  return QUESTION_PREFIX_ACTIONS.some(({ prefix }) => normalized.startsWith(`${prefix} `));
}

function stripQuestionPrefix(title = '') {
  return String(title || '')
    .trim()
    .replace(/\?+$/g, '')
    .replace(/^(what|why|how|when|where|which|do|does|can|should|will)\s+/i, '')
    .trim();
}

function toSentenceCaseTitle(text = '') {
  const normalized = String(text || '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return '';
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function actionizeMasterPlanCandidateTitle(candidate = {}) {
  const originalTitle = String(candidate?.title || '').trim();
  if (!originalTitle) {
    return null;
  }
  const rewrite = QUESTION_TITLE_REWRITES.find(({ match }) => match.test(originalTitle));
  if (rewrite) {
    return {
      title: rewrite.title,
      expectedOutput: rewrite.expectedOutput,
      originalQuestion: originalTitle,
      transformed: true,
    };
  }
  if (!isQuestionLikeScheduleTitle(originalTitle)) {
    return {
      title: originalTitle.replace(/\?+$/g, '').trim(),
      expectedOutput:
        String(candidate?.expectedOutput || '').trim() ||
        `Concrete progress documented for: ${originalTitle.replace(/\?+$/g, '').trim()}.`,
      originalQuestion: null,
      transformed: false,
    };
  }
  const stripped = stripQuestionPrefix(originalTitle);
  if (!stripped) {
    return null;
  }
  const prefix = QUESTION_PREFIX_ACTIONS.find(({ prefix: q }) => originalTitle.trim().toLowerCase().startsWith(`${q} `));
  const actionTitle = toSentenceCaseTitle(`${prefix?.verb || 'Resolve'} ${stripped}`);
  if (!actionTitle || isQuestionLikeScheduleTitle(actionTitle)) {
    return null;
  }
  return {
    title: actionTitle,
    expectedOutput:
      String(candidate?.expectedOutput || '').trim() ||
      `Written resolution for: ${originalTitle.replace(/\?+$/g, '').trim()}.`,
    originalQuestion: originalTitle,
    transformed: true,
  };
}

// Safety net: normalize legacy bare-token milestone titles at the block level.
// Guards against OLD plans created before normalizeMilestoneTitle was applied at intake time.
function safeBlockTitle(rawTitle, lane) {
  const t = String(rawTitle || '').trim();
  if (/^drop$/i.test(t)) return `Release ${lane?.title || 'project'}`;
  if (/^launch$/i.test(t)) return `Launch ${lane?.title || 'product'}`;
  return t;
}

// Numeric-range composite decomposer.
// Catches any candidate whose title still contains "(episodes N–M)" or "(episodes N-M)"
// after template fixes, and expands it into one candidate per episode.
// This is a safety net for legacy milestone data — template fixes are the primary source fix.
function tryDecomposeNumericRangeCandidate(candidate) {
  const title = String(candidate?.title || '').trim();
  // Match: "some title (episodes N–M)" or "... (episodes N-M)"
  const parenMatch = title.match(/^(.+?)\s*\(\s*episodes?\s+(\d+)\s*[–\-]\s*(\d+)\s*\)\s*$/i);
  if (parenMatch) {
    const base = parenMatch[1].replace(/\s*\bbatch\b\s*/i, ' ').replace(/\s+/g, ' ').trim();
    const start = parseInt(parenMatch[2], 10);
    const end = parseInt(parenMatch[3], 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 9) return null;
    return Array.from({ length: end - start + 1 }, (_, i) => {
      const n = start + i;
      return {
        ...candidate,
        key: `${candidate.key || 'ep'}:ep${n}`,
        title: `${base} ${n}`,
        derivedFrom: `${candidate.derivedFrom || 'composite'}:ep${n}`,
      };
    });
  }
  // Also catch bare inline range: "Record episodes 1–3" or "Film episodes 1-3"
  const inlineMatch = title.match(/^(.+?\s)episodes?\s+(\d+)\s*[–\-]\s*(\d+)(.*)$/i);
  if (inlineMatch) {
    const pre = inlineMatch[1].trim();
    const start = parseInt(inlineMatch[2], 10);
    const end = parseInt(inlineMatch[3], 10);
    const post = inlineMatch[4].trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 9) return null;
    return Array.from({ length: end - start + 1 }, (_, i) => {
      const n = start + i;
      const atomicTitle = [`${pre} episode ${n}`, post].filter(Boolean).join(' ').trim();
      return {
        ...candidate,
        key: `${candidate.key || 'ep'}:ep${n}`,
        title: atomicTitle,
        derivedFrom: `${candidate.derivedFrom || 'composite'}:ep${n}`,
      };
    });
  }
  return null;
}

// Runs decomposition on every candidate in the list.
// Returns a new flat array where composites are replaced by their atomic children.
function decomposeCompositeCandidates(candidates) {
  const result = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const decomposed = tryDecomposeNumericRangeCandidate(candidate);
    if (decomposed && decomposed.length > 0) {
      result.push(...decomposed);
    } else {
      result.push(candidate);
    }
  }
  return result;
}

// Lane cadence work: domain → rotating array of action-title functions.
// Each lane generates one block every CADENCE_INTERVAL_DAYS, cycling through its templates.
const LANE_CADENCE_INTERVAL_DAYS = 14;
const LANE_RECURRING_WORK = {
  creative: [
    (l) => `Complete recording session and advance ${l} toward release`,
    (l) => `Review and finalize ${l} mastering, mix, and artwork assets`,
    (l) => `Advance ${l} distribution setup, pre-save campaign, and promotion`,
    (l) => `Evaluate ${l} release readiness and confirm distribution timeline`,
    (l) => `Execute ${l} promo material batch — social, press, and visual assets`,
  ],
  product: [
    (l) => `Complete ${l} development sprint — feature, fix, or integration`,
    (l) => `Test and validate ${l} user flow, onboarding, and checkout path`,
    (l) => `Review ${l} beta feedback and prioritize next development cycle`,
    (l) => `Update ${l} app store listing, metadata, and landing page`,
    (l) => `Advance ${l} launch readiness — stability, monitoring, and go-live gate`,
  ],
  media: [
    (l) => `Record next ${l} episode`,
    (l) => `Edit and publish latest ${l} episode`,
    (l) => `Plan next ${l} content: outline topics and production structure`,
    (l) => `Review ${l} listener metrics and adjust content strategy`,
  ],
  income: [
    (l) => `Advance ${l} revenue pipeline — outreach, follow-ups, and deal progress`,
    (l) => `Review and update ${l} offer definition and pricing`,
    (l) => `Evaluate ${l} income progress and identify next high-leverage action`,
  ],
  brand: [
    (l) => `Advance ${l} partnerships and positioning — outreach and relationship progress`,
    (l) => `Review ${l} market presence and identify next visibility action`,
  ],
  company: [
    (l) => `Run cross-lane operations review — blockers, dependencies, and cadence check`,
    (l) => `Review company-level progress on ${l} and realign team priorities`,
  ],
  capital: [
    (l) => `Advance ${l} research — thesis, market analysis, and structure options`,
  ],
  institution: [
    (l) => `Review ${l} model definition and research progress`,
  ],
  civic: [
    (l) => `Review ${l} stakeholder mapping and preparation progress`,
  ],
  resources: [
    (l) => `Review ${l} resource pipeline and capacity planning`,
  ],
};

function buildLaneCadenceCandidates(lanes, todayDayKey, windowEndDayKey, timeZone) {
  const candidates = [];
  const activeLanes = (Array.isArray(lanes) ? lanes : []).filter((lane) => {
    const activation = String(lane?.activationState || '').trim().toLowerCase();
    return activation === 'active';
  });
  for (const lane of activeLanes) {
    const domain = String(lane?.domain || '').trim().toLowerCase();
    const templates = LANE_RECURRING_WORK[domain] || [];
    if (templates.length === 0) continue;
    const laneLabel = lane.title || `${domain} work`;
    const laneId = lane.id;
    const startDate = addDays(todayDayKey, 7, timeZone);
    if (!startDate || startDate > windowEndDayKey) continue;
    let cursor = startDate;
    let templateIdx = 0;
    while (cursor && cursor <= windowEndDayKey) {
      const titleFn = templates[templateIdx % templates.length];
      candidates.push({
        key: `cadence:${laneId}:${cursor}`,
        title: titleFn(laneLabel),
        minutes: 60,
        practice: mapMasterPlanLaneToPractice(domain),
        priority: 4,
        laneId,
        targetDate: cursor,
        milestoneType: 'checkpoint',
        derivedFrom: `cadence:${laneId}`,
        missConsequence: `Consistent execution in ${laneLabel} supports launch readiness.`,
      });
      cursor = addDays(cursor, LANE_CADENCE_INTERVAL_DAYS, timeZone);
      templateIdx += 1;
    }
  }
  return candidates;
}

const MILESTONE_WORK_EXPANSION = {
  creative: {
    anchor: [
      { title: (l) => `Finalize ${l} release checklist and confirm distribution is live`, offsetDays: -5, minutes: 60 },
      { title: (l) => `Prepare ${l} release-day social campaign and notification push`, offsetDays: -2, minutes: 45 },
      { title: (l) => `Release-day coordination and monitoring check for ${l}`, offsetDays: 0, minutes: 30 },
    ],
    gate: [
      { title: (l) => `Prepare ${l} distribution files and metadata`, offsetDays: -4, minutes: 45 },
      { title: (l) => `Finalize and upload ${l} artwork for distribution`, offsetDays: -3, minutes: 30 },
    ],
    checkpoint: [
      { title: (l) => `Review and approve ${l} checkpoint progress`, offsetDays: -1, minutes: 45 },
    ],
  },
  product: {
    anchor: [
      { title: (l) => `Run final pre-launch QA checklist for ${l}`, offsetDays: -4, minutes: 75 },
      { title: (l) => `Prepare ${l} launch-day onboarding flow and user communication`, offsetDays: -2, minutes: 60 },
      { title: (l) => `Review and confirm ${l} launch readiness gate`, offsetDays: 0, minutes: 45 },
    ],
    gate: [
      { title: (l) => `Prepare ${l} app store screenshots`, offsetDays: -5, minutes: 45 },
      { title: (l) => `Write ${l} app store metadata and description`, offsetDays: -4, minutes: 45 },
      { title: (l) => `Complete final pre-submission QA and regression review for ${l}`, offsetDays: -3, minutes: 60 },
    ],
    checkpoint: [
      { title: (l) => `Document and review ${l} milestone progress`, offsetDays: -1, minutes: 45 },
    ],
  },
  media: {
    anchor: [
      { title: (l) => `Finalize and upload ${l} launch content package`, offsetDays: -3, minutes: 60 },
    ],
    gate: [
      { title: (l) => `Complete and finalize ${l} episode production`, offsetDays: -5, minutes: 60 },
      { title: (l) => `Upload ${l} episode to distribution platform`, offsetDays: -4, minutes: 30 },
    ],
    checkpoint: [
      { title: (l) => `Record next ${l} episode`, offsetDays: -2, minutes: 75 },
    ],
  },
  brand: {
    checkpoint: [
      { title: (l) => `Review ${l} outreach and positioning progress`, offsetDays: 0, minutes: 45 },
    ],
  },
  income: {
    gate: [
      { title: (l) => `Review ${l} revenue pipeline and identify next revenue actions`, offsetDays: -2, minutes: 45 },
    ],
    checkpoint: [
      { title: (l) => `Assess ${l} income progress and update pipeline`, offsetDays: 0, minutes: 45 },
    ],
  },
  company: {
    checkpoint: [
      { title: (l) => `Review ${l} operating cadence and cross-lane alignment`, offsetDays: 0, minutes: 45 },
    ],
  },
};

function expandMilestoneToWorkCandidates(milestone, todayDayKey, timeZone) {
  const domain = String(milestone?.lane?.domain || milestone?.domain || '').trim().toLowerCase();
  const milestoneType = String(milestone?.milestoneType || 'checkpoint').trim().toLowerCase();
  const targetDate = String(milestone?.targetDate || '').trim();
  const laneLabel = milestone?.lane?.title || `${domain} work`;
  const laneId = milestone?.lane?.id || milestone?.laneId || null;
  const milestoneId = milestone?.id;
  if (!targetDate || !milestoneId) {
    return [];
  }
  const domainTemplates = MILESTONE_WORK_EXPANSION[domain] || {};
  const typeTemplates = domainTemplates[milestoneType] || domainTemplates.checkpoint || [];
  if (typeTemplates.length === 0) {
    return [];
  }
  const today = String(todayDayKey || '').trim();
  return typeTemplates
    .map((template, idx) => {
      const prepDate = addDays(targetDate, template.offsetDays, timeZone);
      if (!prepDate || (today && prepDate < today)) {
        return null;
      }
      return {
        key: `expand:${milestoneId}:${idx}`,
        title: template.title(laneLabel),
        minutes: template.minutes,
        practice: mapMasterPlanLaneToPractice(domain),
        priority: getMasterPlanMilestonePriority(milestone) - 3 - idx,
        missConsequence: `Preparation for ${laneLabel} milestone: ${milestone.title}`,
        derivedFrom: `expanded:${milestoneId}`,
        laneId,
        milestoneId,
        targetDate: prepDate,
        milestoneType: 'checkpoint',
      };
    })
    .filter(Boolean);
}

function buildMasterPlanFirstCycleProposals(state, plan, descriptors) {
  const { lanes, milestones, goalId, cycleId, profile, masterCalendarId, todayDayKey, timeZone, weeklyCapacityHours } =
    descriptors;
  const activePhaseDeadlineDayKey =
    String(descriptors?.goalContract?.activePhaseScheduleEndDayKey || descriptors?.activePhaseScheduleEndDayKey || '').trim() ||
    addDays(todayDayKey, 27, timeZone);
  const fullHorizonEndDayKey =
    String(descriptors?.goalContract?.fullHorizonEndDayKey || descriptors?.fullHorizonEndDayKey || '').trim() ||
    activePhaseDeadlineDayKey;
  const windowEndDayKey = activePhaseDeadlineDayKey;
  const milestoneCandidates = milestones
    .filter((milestone) => {
      const targetDate = String(milestone?.targetDate || '').trim();
      if (!targetDate) {
        return false;
      }
      return targetDate >= todayDayKey && targetDate <= windowEndDayKey;
    })
    .map((milestone) => ({
      key: `milestone:${milestone.id}`,
      title: safeBlockTitle(milestone.title, milestone.lane),
      minutes:
        String(milestone?.milestoneType || '').trim().toLowerCase() === 'gate'
          ? 90
          : String(milestone?.milestoneType || '').trim().toLowerCase() === 'anchor'
            ? 75
            : 60,
      practice: mapMasterPlanLaneToPractice(milestone?.lane?.domain || ''),
      priority: getMasterPlanMilestonePriority(milestone),
      missConsequence:
        milestone?.missConsequence || 'Missing this checkpoint weakens downstream launch sequencing.',
      derivedFrom: milestone?.derivedFrom || `masterPlanMilestone:${milestone.id}`,
      laneId: milestone?.lane?.id || milestone?.laneId || null,
      milestoneId: milestone.id,
      targetDate: milestone.targetDate,
      milestoneType: milestone?.milestoneType || 'checkpoint',
    }));
  const fallbackMilestonesByLane = lanes
    .map((lane) => {
      const firstMilestone = milestones.find(
        (milestone) => (milestone?.lane?.id || milestone?.laneId || null) === lane.id
      );
      return firstMilestone
        ? {
            key: `milestone:${firstMilestone.id}`,
            title: firstMilestone.title,
            minutes:
              String(firstMilestone?.milestoneType || '').trim().toLowerCase() === 'gate' ? 90 : 60,
            practice: mapMasterPlanLaneToPractice(lane.domain),
            priority: getMasterPlanMilestonePriority(firstMilestone) - 5,
            missConsequence:
              firstMilestone?.missConsequence || 'This lane needs an early concrete checkpoint to become executable.',
            derivedFrom: firstMilestone?.derivedFrom || `masterPlanMilestone:${firstMilestone.id}`,
            laneId: lane.id,
            milestoneId: firstMilestone.id,
            targetDate: firstMilestone.targetDate,
            milestoneType: firstMilestone?.milestoneType || 'checkpoint',
          }
        : null;
    })
    .filter(Boolean);
  const readinessCandidates = buildMasterPlanReadinessCandidates(plan, lanes, weeklyCapacityHours);
  const expansionCandidates = milestoneCandidates
    .filter((c) => c.milestoneType === 'anchor' || c.milestoneType === 'gate')
    .flatMap((candidate) => {
      const milestone = milestones.find((m) => m.id === candidate.milestoneId);
      if (!milestone) {
        return [];
      }
      return expandMilestoneToWorkCandidates(milestone, todayDayKey, timeZone);
    });
  const cadenceCandidates = buildLaneCadenceCandidates(lanes, todayDayKey, windowEndDayKey, timeZone);
  const rawCombined = [...readinessCandidates, ...milestoneCandidates, ...expansionCandidates, ...cadenceCandidates];
  if (milestoneCandidates.length === 0) {
    rawCombined.push(...fallbackMilestonesByLane);
  }
  const combined = decomposeCompositeCandidates(rawCombined);
  const deduped = [];
  const seen = new Set();
  combined
    .sort((left, right) => {
      if (Number(right.priority || 0) !== Number(left.priority || 0)) {
        return Number(right.priority || 0) - Number(left.priority || 0);
      }
      return String(left?.targetDate || '').localeCompare(String(right?.targetDate || ''));
    })
    .forEach((candidate) => {
      const identity = String(candidate?.key || '').trim();
      if (!identity || seen.has(identity)) {
        return;
      }
      seen.add(identity);
      deduped.push(candidate);
    });
  const descriptorWindows = normalizeCanonicalWorkWindows(descriptors?.goalContract?.workWindows || {});
  const cycleWindows = normalizeCanonicalWorkWindows(
    state?.cyclesById?.[cycleId || '']?.goalContract?.workWindows || {}
  );
  const policyWindows = normalizeCanonicalWorkWindows(state?.availabilityPolicy?.workWindows || {});
  const workWindows =
    countRawWorkWindows(descriptorWindows) > 0
      ? descriptorWindows
      : countRawWorkWindows(cycleWindows) > 0
        ? cycleWindows
        : policyWindows;
  const requiredCoverageDayKey = resolveSchedulableCoverageDayKey(
    todayDayKey,
    activePhaseDeadlineDayKey,
    workWindows,
    timeZone
  );
  const slots = [];
  let dayCursor = todayDayKey;
  while (dayCursor && dayCursor <= windowEndDayKey) {
    const weekday = getWeekdayKeyFromDayKey(dayCursor);
    const windows = Array.isArray(workWindows?.[weekday]) ? workWindows[weekday] : [];
    windows.forEach((window, windowIndex) => {
      const startMinutes = parseHHMMToMinutes(window?.start);
      const endMinutes = parseHHMMToMinutes(window?.end);
      const capacityMinutes = Math.max(0, endMinutes - startMinutes);
      if (capacityMinutes > 0) {
        slots.push({
          dayKey: dayCursor,
          startHHMM: window.start,
          capacityMinutes,
          windowIndex,
        });
      }
    });
    dayCursor = addDays(dayCursor, 1, timeZone);
  }
  const selected = deduped.slice(0, Math.max(0, slots.length));
  const scheduled = [];
  const skippedCandidates = [];
  const availableSlots = [...slots];
  selected.forEach((candidate) => {
    const titleResult = actionizeMasterPlanCandidateTitle(candidate);
    if (!titleResult) {
      skippedCandidates.push({
        key: candidate?.key || null,
        reasonCode: 'UNACTIONABLE_BLOCK_TITLE',
        originalTitle: String(candidate?.title || '').trim() || null,
      });
      return;
    }
    const durationMinutes = Number(candidate?.minutes || 60);
    const targetDate = String(candidate?.targetDate || '').trim() || null;
    let preferredSlotIndex = -1;
    if (targetDate) {
      for (let i = availableSlots.length - 1; i >= 0; i -= 1) {
        const slot = availableSlots[i];
        if (slot.capacityMinutes >= durationMinutes && slot.dayKey <= targetDate) {
          preferredSlotIndex = i;
          break;
        }
      }
      if (preferredSlotIndex === -1) {
        preferredSlotIndex = availableSlots.findIndex(
          (slot) => slot.capacityMinutes >= durationMinutes && slot.dayKey >= targetDate
        );
      }
    }
    if (preferredSlotIndex === -1) {
      preferredSlotIndex = availableSlots.findIndex((slot) => slot.capacityMinutes >= durationMinutes);
    }
    if (preferredSlotIndex === -1) {
      return;
    }
    const [slot] = availableSlots.splice(preferredSlotIndex, 1);
    scheduled.push({
      candidate: {
        ...candidate,
        title: titleResult.title,
        expectedOutput: titleResult.expectedOutput,
        originalQuestion: titleResult.originalQuestion,
        transformedFromQuestion: titleResult.transformed,
      },
      scheduledDayKey: slot.dayKey,
      slotStartHHMM: slot.startHHMM,
    });
  });
  const blocks = scheduled.map(({ candidate, scheduledDayKey, slotStartHHMM }, index) => {
    const start = buildLocalStartISO(scheduledDayKey, slotStartHHMM, timeZone);
    const startISO = start?.startISO || `${scheduledDayKey}T10:00:00.000Z`;
    const durationMinutes = Number(candidate?.minutes || 60);
    const lane = state?.masterPlanLanesById?.[candidate?.laneId || ''] || null;
    const laneProjection = projectEnterpriseDisplay({
      laneId: candidate?.laneId || lane?.domain || '',
      laneLabel: candidate?.laneLabel || candidate?.laneTitle || lane?.title || lane?.label || candidate?.laneId || '',
      intakeSignals: {
        goalText: String(plan?.goalText || plan?.title || '').trim(),
        declaredLaneIds: Array.isArray(plan?.laneIds) ? plan.laneIds : [],
      },
    });
    const laneLabel =
      laneProjection.displayName ||
      candidate?.laneLabel ||
      candidate?.laneTitle ||
      lane?.title ||
      lane?.label ||
      candidate?.laneId ||
      null;
    return {
      id: `suggested:masterplan:${plan.id}:${candidate.key}`,
      identityKey: `masterplan:${plan.id}:${candidate.key}`,
      goalId,
      cycleId,
      profileId: profile?.id || null,
      masterCalendarId: masterCalendarId || null,
      masterPlanId: plan.id,
      coreMissionContractId: plan?.coreMissionContractId || null,
      laneId: candidate?.laneId || null,
      laneLabel,
      masterPlanLaneId: candidate?.laneId || null,
      masterPlanMilestoneId: candidate?.milestoneId || null,
      title: candidate.title,
      label: candidate.title,
      expectedOutput:
        String(candidate?.expectedOutput || '').trim() ||
        `Concrete progress completed for ${String(candidate?.title || '').trim()}.`,
      domain: candidate.practice || 'FOCUS',
      durationMinutes,
      createdAtISO: state.appTime?.nowISO || new Date().toISOString(),
      startISO,
      endISO: new Date(new Date(startISO).getTime() + durationMinutes * 60000).toISOString(),
      dayKey: scheduledDayKey,
      actionId: candidate?.milestoneId ? `masterplan-action:${candidate.milestoneId}` : `masterplan-readiness:${index + 1}`,
      deliverableId: candidate?.laneId ? `masterplan-deliverable:${candidate.laneId}` : null,
      status: 'suggested',
      source: 'master_plan_first_cycle',
      blockType: candidate?.milestoneId ? 'master_plan_milestone' : 'master_plan_readiness',
      milestoneType: candidate?.milestoneType || null,
      flex: candidate?.flex || null,
      missConsequence: candidate?.missConsequence || '',
      derivedFrom: candidate?.derivedFrom || '',
      placementBasis: candidate?.milestoneId ? 'milestone_priority' : 'first_cycle_readiness',
      requiredSystemBlock: true,
      sessionIndex: index,
      sourceQuestion: candidate?.originalQuestion || null,
      transformedFromQuestion: candidate?.transformedFromQuestion === true,
    };
  });
  const scheduledMinutes = blocks.reduce((sum, block) => sum + Number(block?.durationMinutes || 0), 0);
  const unscheduledCandidates = selected.slice(blocks.length);
  const unscheduledMinutes = unscheduledCandidates.reduce((sum, candidate) => sum + Number(candidate?.minutes || 0), 0);
  const sortedScheduledDayKeys = blocks
    .map((block) => String(block?.dayKey || '').trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const calendarCoverageThroughDayKey = sortedScheduledDayKeys[sortedScheduledDayKeys.length - 1] || null;
  const coverageStatus =
    !requiredCoverageDayKey
      ? 'unbounded'
      : !calendarCoverageThroughDayKey
        ? 'failed_before_anchor'
        : calendarCoverageThroughDayKey >= requiredCoverageDayKey
          ? 'complete_to_anchor'
          : 'partial_before_anchor';
  const coverageFailureReason =
    coverageStatus === 'complete_to_anchor'
      ? null
      : 'Schedule does not reach the active phase hard deadline.';
  return {
    blocks,
    summary: {
      requiredBlockCount: selected.length,
      scheduledBlockCount: blocks.length,
      unscheduledBlockCount: unscheduledCandidates.length + skippedCandidates.length,
      scheduledMinutes,
      unscheduledMinutes,
      executionCycleWindowDays: computeInclusiveDaySpan(todayDayKey, activePhaseDeadlineDayKey),
      schedulePreviewWindowDays: computeInclusiveDaySpan(todayDayKey, activePhaseDeadlineDayKey),
      activePhaseDeadlineDayKey,
      requiredCoverageDayKey,
      activePhaseScheduleEndDayKey: activePhaseDeadlineDayKey,
      fullHorizonEndDayKey,
      calendarCoverageThroughDayKey,
      coverageStatus,
      coverageFailureReason,
      partialScheduleReason:
        unscheduledCandidates.length + skippedCandidates.length > 0
          ? coverageStatus === 'complete_to_anchor'
            ? 'The active phase is scheduled through its hard deadline, but some lower-priority work remains unscheduled.'
            : 'Only part of the active phase could be scheduled before the hard deadline inside the confirmed work windows.'
          : null,
      reasonCodes:
        [
          ...(unscheduledCandidates.length + skippedCandidates.length > 0 ? ['PARTIAL_FIRST_CYCLE_SCHEDULE'] : []),
          ...(coverageStatus === 'partial_before_anchor'
            ? ['PARTIAL_BEFORE_ANCHOR']
            : coverageStatus === 'failed_before_anchor'
              ? ['FAILED_BEFORE_ANCHOR']
              : []),
        ],
      unscheduledReasons: [
        ...(coverageFailureReason
          ? [
              {
                reasonCode: coverageStatus === 'failed_before_anchor' ? 'FAILED_BEFORE_ANCHOR' : 'PARTIAL_BEFORE_ANCHOR',
                latestScheduledDayKey: calendarCoverageThroughDayKey,
                activePhaseDeadlineDayKey,
              },
            ]
          : []),
        ...(unscheduledCandidates.length > 0
          ? [
              {
                reasonCode: 'INSUFFICIENT_SCHEDULE_SLOTS',
                count: unscheduledCandidates.length,
                minutes: unscheduledMinutes,
              },
            ]
          : []),
        ...skippedCandidates,
      ],
    },
  };
}

function generateMasterPlanFirstCycle(state, payload = {}) {
  const plan = getActiveMasterPlanRecord(state, payload?.masterPlanId || null);
  if (!plan) {
    state.lastPlanError = {
      code: 'MASTER_PLAN_TARGET_INVALID',
      reason: 'No active master plan is available for first-cycle generation.',
      masterPlanId: payload?.masterPlanId || null,
    };
    return;
  }
  const descriptors = ensureMasterPlanOperationalCycle(state, plan);
  if (!descriptors?.cycle || !descriptors?.goalContract) {
    state.lastPlanError = {
      code: 'MASTER_PLAN_CYCLE_INIT_FAILED',
      reason: 'Master plan execution cycle could not be initialized.',
      masterPlanId: plan.id,
    };
    return;
  }
  const cycle = descriptors.cycle;
  if (String(cycle?.reassessmentStatus || '').trim().toLowerCase() === 'required') {
    state.lastPlanError = {
      code: 'CURRENT_STATE_REASSESSMENT_REQUIRED',
      reason: 'Complete current-state reassessment before generating a schedule for this execution cycle.',
      cycleId: cycle.id,
      masterPlanId: plan.id,
    };
    state.scheduleLifecycle = 'no_schedule';
    cycle.scheduleLifecycle = 'no_schedule';
    state.cyclesById[cycle.id] = cycle;
    return;
  }
  const schedulingAuthority = deriveCycleSchedulingAuthority(state, cycle, cycle?.goalContract || descriptors.goalContract);
  if (schedulingAuthority.workWindowCount === 0 || schedulingAuthority.constraintsStatus === 'unsaved') {
    state.lastPlanError = {
      code: 'WORK_WINDOWS_UNSAVED',
      reason: 'Define and save work windows before generating a schedule.',
      cycleId: cycle.id,
      masterPlanId: plan.id,
      reasonCodes: schedulingAuthority.workWindowCount === 0 ? ['NO_WORK_WINDOWS'] : ['WORK_WINDOWS_UNSAVED'],
      meta: {
        workWindowsSource: schedulingAuthority.workWindowsSource,
      },
    };
    state.scheduleLifecycle = 'no_schedule';
    cycle.scheduleLifecycle = 'no_schedule';
    state.cyclesById[cycle.id] = cycle;
    return;
  }
  if (schedulingAuthority.constraintsStatus === 'stale') {
    state.lastPlanError = {
      code: 'CONSTRAINTS_STALE',
      reason: 'Re-save work windows to revalidate availability for this execution cycle.',
      cycleId: cycle.id,
      masterPlanId: plan.id,
    };
    state.scheduleLifecycle = 'no_schedule';
    cycle.scheduleLifecycle = 'no_schedule';
    state.cyclesById[cycle.id] = cycle;
    return;
  }
  if (schedulingAuthority.capacityValidation?.status === 'insufficient') {
    state.lastPlanError = {
      code: 'CAPACITY_INSUFFICIENT',
      reason: 'Current availability cannot support the required first-cycle workload.',
      cycleId: cycle.id,
      masterPlanId: plan.id,
      reasonCodes: ['CAPACITY_INSUFFICIENT'],
      meta: {
        availableWeeklyMinutes: schedulingAuthority.capacityValidation.availableWeeklyMinutes,
        requiredWeeklyMinutes: schedulingAuthority.capacityValidation.requiredWeeklyMinutes,
        gapWeeklyMinutes: schedulingAuthority.capacityValidation.gapWeeklyMinutes,
        mitigationSuggestions: schedulingAuthority.capacityValidation.mitigationSuggestions || [],
      },
    };
    state.scheduleLifecycle = 'no_schedule';
    cycle.scheduleLifecycle = 'no_schedule';
    state.cyclesById[cycle.id] = cycle;
    return;
  }
  if (isCycleReadOnly(cycle)) {
    state.lastPlanError = {
      code: 'CYCLE_READ_ONLY',
      reason: 'Cannot generate schedule for an ended or archived cycle.',
      cycleId: cycle.id,
    };
    return;
  }
  const currentScheduleLifecycle = getCycleScheduleLifecycle(cycle, state);
  if (currentScheduleLifecycle === 'active_schedule') {
    const canonicalCycleBlocks = getAllBlocks(state).filter((block) => block?.cycleId === cycle.id);
    if (canonicalCycleBlocks.length === 0) {
      cycle.scheduleLifecycle = 'stale_draft_invalidated';
      state.scheduleLifecycle = 'stale_draft_invalidated';
    } else {
      state.lastPlanError = {
        code: 'REGENERATE_BLOCKED_ACTIVE_SCHEDULE',
        reason: 'Active schedules must be rescheduled or rebuilt explicitly.',
        cycleId: cycle.id,
        goalId: descriptors.goalContract.goalId,
      };
      return;
    }
  }
  state.draftScheduleAppliedAtISO = null;
  state.scheduleApplied = false;
  state.pendingPlanConfirmation = false;
  if (
    currentScheduleLifecycle === 'applied_review' &&
    Array.isArray(cycle.scheduleReviewBlocks) &&
    cycle.scheduleReviewBlocks.length
  ) {
    cycle.scheduleReviewBlocks = [];
    cycle.scheduleAppliedAtISO = null;
    cycle.scheduleLifecycle = 'stale_draft_invalidated';
    state.scheduleLifecycle = 'stale_draft_invalidated';
  }
  const proposalResult = buildMasterPlanFirstCycleProposals(state, plan, descriptors);
  const suggestions = proposalResult.blocks;
  const proposalSummary = proposalResult.summary || {};
  cycle.autoAsanaPlan = {
    horizonBlocks: suggestions.map((suggestion) => ({
      id: suggestion.id,
      identityKey: suggestion.identityKey,
      title: suggestion.title,
      startISO: suggestion.startISO,
      endISO: suggestion.endISO,
      dayKey: suggestion.dayKey,
      durationMinutes: suggestion.durationMinutes,
      deliverableId: suggestion.deliverableId,
      actionId: suggestion.actionId,
      blockType: suggestion.blockType,
      placementBasis: suggestion.placementBasis,
    })),
    conflicts: [],
    summary: {
      planStatus:
        suggestions.length === 0
          ? 'NO_PROPOSED_BLOCKS'
          : Number(proposalSummary?.unscheduledBlockCount || 0) > 0
            ? 'VALID_BUT_PARTIALLY_SCHEDULED'
            : 'VALID_AND_FULLY_SCHEDULED',
      requiredBlockCount: Number(proposalSummary?.requiredBlockCount || suggestions.length),
      scheduledBlockCount: suggestions.length,
      unscheduledBlockCount: Number(proposalSummary?.unscheduledBlockCount || 0),
      scheduledMinutes: Number(proposalSummary?.scheduledMinutes || 0),
      unscheduledMinutes: Number(proposalSummary?.unscheduledMinutes || 0),
      executionCycleWindowDays: Number(proposalSummary?.executionCycleWindowDays || 28),
      schedulePreviewWindowDays: Number(proposalSummary?.schedulePreviewWindowDays || 28),
      activePhaseDeadlineDayKey: proposalSummary?.activePhaseDeadlineDayKey || null,
      activePhaseScheduleEndDayKey: proposalSummary?.activePhaseScheduleEndDayKey || null,
      fullHorizonEndDayKey: proposalSummary?.fullHorizonEndDayKey || null,
      calendarCoverageThroughDayKey: proposalSummary?.calendarCoverageThroughDayKey || null,
      coverageStatus: proposalSummary?.coverageStatus || null,
      coverageFailureReason: proposalSummary?.coverageFailureReason || null,
      partialScheduleReason: proposalSummary?.partialScheduleReason || null,
      unscheduledReasons: Array.isArray(proposalSummary?.unscheduledReasons) ? proposalSummary.unscheduledReasons : [],
      candidateResolutionKinds: [],
      recommendations: [],
      reasonCodes: Array.isArray(proposalSummary?.reasonCodes) ? proposalSummary.reasonCodes : [],
    },
  };
  cycle.planStatus = suggestions.length > 0 ? 'ready' : 'error';
  cycle.planGenerationSource = 'MASTER_PLAN_FIRST_CYCLE';
  setCycleProposedBlocks(state, cycle.id, suggestions);
  state.pendingPlanConfirmation = suggestions.length > 0;
  state.scheduleApplied = false;
  state.scheduleLifecycle = suggestions.length > 0 ? 'draft_schedule_ready' : 'no_schedule';
  cycle.scheduleLifecycle = suggestions.length > 0 ? 'draft_schedule_ready' : 'no_schedule';
  state.lastPlanError =
    suggestions.length > 0
      ? null
      : {
          code: 'NO_PROPOSED_BLOCKS',
          reason: 'No first-cycle preview items were available from the master plan.',
          cycleId: cycle.id,
          masterPlanId: plan.id,
        };
  state.planPreview = computePlanPreview({
    suggestedBlocks: state.proposedBlocks || [],
    planDraft: state.planDraft,
    contract: descriptors.goalContract,
    policyState: getCurrentPolicyState(state),
    historyProfile: buildHistoryProfileForDraft(state, state.planDraft),
    timeZone: descriptors.timeZone || APP_TIME_ZONE,
  });
  state.cyclesById[cycle.id] = cycle;
}

function applyPlanQualityGates(state) {
  const contracts = collectGovernanceContracts(state);
  const goalIds = Array.from(new Set(contracts.map((c) => c.goalId).filter(Boolean)));
  const gatesByGoal = {};

  goalIds.forEach((goalId) => {
    const cycle = resolveCycleForGoal(state, goalId);
    if (!cycle) {
      return;
    }
    const contract = cycle?.goalContract || state.goalExecutionContract || null;
    const canonicalDeliverables = getCanonicalCycleDeliverables(
      state?.deliverablesByCycleId || {},
      cycle?.id || null,
      cycle
    );
    const canonicalActions = annotateActionsWithDeliverableIds(
      cycle,
      getCanonicalCycleActions(cycle),
      canonicalDeliverables
    );
    const canonicalProposed = getCanonicalProposedBlocks(cycle?.proposedBlocks, cycle?.suggestedBlocks);
    const canonicalCommitted = getAllBlocks(state).filter((block) => {
      if (!block) {
        return false;
      }
      if (block?.goalId && block.goalId !== goalId) {
        return false;
      }
      if (block?.cycleId && cycle?.id && block.cycleId !== cycle.id) {
        return false;
      }
      return true;
    });

    const hasExecutionArtifacts = canonicalProposed.length > 0 || canonicalCommitted.length > 0;
    const declaredBranches = hasExecutionArtifacts
      ? canonicalDeliverables
          .filter((deliverable) => {
            const deliverableId = deliverable?.id;
            if (!deliverableId) {
              return false;
            }
            const hasExplicitActionIds = Array.isArray(deliverable?.actionIds) && deliverable.actionIds.length > 0;
            const hasLinkedActions = canonicalActions.some((action) => action?.deliverableId === deliverableId);
            return hasExplicitActionIds || hasLinkedActions;
          })
          .map((deliverable) => deliverable.id)
          .filter(Boolean)
      : [];

    const masterPlanId = contract?.masterPlanId || cycle?.masterPlanId || null;
    const masterPlanForGate = masterPlanId ? state?.masterPlansById?.[masterPlanId] || null : null;

    const result = evaluatePlanQualityGate({
      goalText: contract?.terminalOutcome?.text || contract?.goalText || contract?.goalLabel || '',
      verificationText: contract?.terminalOutcome?.verificationCriteria || '',
      deliverables: canonicalDeliverables,
      actions: canonicalActions,
      proposedBlocks: canonicalProposed,
      committedBlocks: canonicalCommitted,
      branchCoverageSummary: { declaredBranches },
      missionContext: masterPlanForGate
        ? {
            coreMission: masterPlanForGate.coreMission || null,
            outcomeTarget: masterPlanForGate.outcomeTarget || null,
            successStandard: masterPlanForGate.successStandard || null,
            terminalOutcome: contract?.terminalOutcome?.text || null,
            controllabilityClass: masterPlanForGate.controllabilityClass || null,
            terminalTargetClass: masterPlanForGate.terminalTargetClass || null,
          }
        : undefined,
      temporalContext: {
        contractStartDayKey:
          contract?.startDayKey ||
          contract?.startDateISO?.slice?.(0, 10) ||
          cycle?.startedAtDayKey ||
          cycle?.startDayKey ||
          null,
        contractEndDayKey:
          contract?.deadline?.dayKey ||
          contract?.endDayKey ||
          contract?.deadlineISO?.slice?.(0, 10) ||
          cycle?.endsAtDayKey ||
          null,
        isRecurring:
          contract?.executionType === 'recurring' ||
          contract?.cadence?.type === 'recurring' ||
          contract?.recurrence?.type === 'recurring',
        earlyCompletionJustification: contract?.earlyCompletionJustification || null,
      },
    });
    cycle.planQualityGate = result;
    gatesByGoal[goalId] = result;
  });

  state.planQualityGateByGoal = gatesByGoal;
}

function applyProbabilityScoring(state) {
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const contracts = collectGovernanceContracts(state);
  const goalIds = Array.from(new Set(contracts.map((c) => c.goalId)));
  const probabilityByGoal = {};
  goalIds.forEach((goalId) => {
    const admission = state.goalAdmissionByGoal?.[goalId];
    if (admission && !isAdmittedGoalStatus(admission.status)) {
      return;
    }
    const contract = contracts.find((c) => c.goalId === goalId);
    const timezone = contract?.scope?.timezone || 'UTC';
    const cycleForGoal = resolveCycleForGoal(state, goalId);
    const scopedConstraints = resolveCycleScopedConstraints(state, cycleForGoal, timezone);
    const constraints = {
      ...scopedConstraints,
      timezone,
    };
    seedCanonicalWorkModelIfMissing(state, goalId);
    const planQualityGate = resolvePlanQualityGateForGoal(state, goalId);
    if (planQualityGate?.status === 'PLAN_QUALITY_WITHHELD') {
      probabilityByGoal[goalId] = {
        value: null,
        status: 'INELIGIBLE',
        trustState: 'withheld',
        eligibilityStatus: 'computed',
        capApplied: false,
        reasons: ['POS_NOT_ADMITTED_PLAN_QUALITY_WITHHELD'],
        requiredEvents: null,
        proof: {
          inputs: { goalId },
          derived: { planQualityGate },
          policyVersion: 'probability_v2',
        },
        admissionStatus: 'withheld',
        failureCodes: planQualityGate.failureCodes || [],
      };
      return;
    }
    probabilityByGoal[goalId] = scoreGoalSuccessProbability(goalId, state, constraints, nowISO);
  });
  state.probabilityByGoal = probabilityByGoal;
}

function applyFeasibility(state) {
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const contracts = collectGovernanceContracts(state);
  const goalIds = Array.from(new Set(contracts.map((c) => c.goalId)));
  const feasibilityByGoal = {};
  goalIds.forEach((goalId) => {
    const contract = contracts.find((c) => c.goalId === goalId);
    const timezone = contract?.scope?.timezone || 'UTC';
    const cycleForGoal = resolveCycleForGoal(state, goalId);
    const scopedConstraints = resolveCycleScopedConstraints(state, cycleForGoal, timezone);
    const constraints = {
      ...scopedConstraints,
      timezone,
      maxBlocksPerDay: scopedConstraints?.maxBlocksPerDay ?? 4,
    };
    seedCanonicalWorkModelIfMissing(state, goalId);
    const deadlineISO = resolveGoalDeadline(goalId, state) || nowISO;
    const planQualityGate = resolvePlanQualityGateForGoal(state, goalId);
    if (planQualityGate?.status === 'PLAN_QUALITY_WITHHELD') {
      feasibilityByGoal[goalId] = {
        goalId,
        nowISO,
        deadlineISO,
        status: 'WITHHELD',
        reasons: ['FEASIBILITY_NOT_ADMITTED_PLAN_QUALITY_WITHHELD'],
        remainingBlocksTotal: 0,
        workableDaysRemaining: 0,
        requiredBlocksPerDay: null,
        requiredBlocksToday: null,
        completedBlocksToday: 0,
        delta: {},
        admissionStatus: 'withheld',
        failureCodes: planQualityGate.failureCodes || [],
      };
      return;
    }
    feasibilityByGoal[goalId] = computeFeasibility({ goalId, deadlineISO }, state, constraints, nowISO);
  });
  state.feasibilityByGoal = feasibilityByGoal;
}

function applyGoalPolicy(state) {
  const goalPolicyByGoalId = {};
  const masterPlanPolicyByPlanId = {};
  const contracts = collectGovernanceContracts(state);
  const goalIds = Array.from(new Set(contracts.map((c) => c.goalId)));
  goalIds.forEach((goalId) => {
    if (!goalId) {
      return;
    }
    const cycle = resolveCycleForGoal(state, goalId);
    const executionContract = cycle?.goalContract || state.goalExecutionContract || null;
    const intakeContract =
      cycle?.goalContract?.goalIntakeContract ||
      state.goalExecutionContract?.goalIntakeContract ||
      buildFallbackPolicyIntakeContract(state, cycle, executionContract, goalId);
    const planProof = cycle?.planProof || state.planPreview?.planProof || null;
    const probabilityStatus = state.probabilityStatusByGoal?.[goalId]?.status || null;
    const feasibilityStatus = state.feasibilityByGoal?.[goalId]?.status || null;
    const executionEvents = getCanonicalExecutionEventsForCycleGoal(state, cycle?.id || null, goalId);
    const externalEvidenceEvents = getCanonicalExternalEvidenceEventsForCycleGoal(state, cycle?.id || null, goalId);
    const proposedBlocks = getCanonicalProposedBlocks(cycle?.proposedBlocks, cycle?.suggestedBlocks).filter(
      (block) => {
        const blockGoalId = String(block?.goalId || '').trim();
        return !blockGoalId || blockGoalId === goalId;
      }
    );
    const reviewBlocks = (Array.isArray(cycle?.scheduleReviewBlocks) ? cycle.scheduleReviewBlocks : []).filter(
      (block) => {
        const blockGoalId = String(block?.goalId || '').trim();
        return !blockGoalId || blockGoalId === goalId;
      }
    );
    const preExecutionBlocks = reviewBlocks.length > 0 ? reviewBlocks : proposedBlocks;
    const canonicalActions = getCanonicalCycleActions(cycle);
    const canonicalDeliverables = getCanonicalCycleDeliverables(
      state?.deliverablesByCycleId || {},
      cycle?.id || null,
      cycle
    );
    const workspace = state?.deliverablesByCycleId?.[cycle?.id || ''] || null;
    const longTermPlan = getCanonicalLongHorizonPlanMetadata(cycle, workspace, preExecutionBlocks);
    const hasCommittedBlocks = Boolean(executionEvents.length);
    const hasProposedBlocks = Boolean(proposedBlocks.length);
    const hasExecutionGraph = Boolean(cycle?.executionGraphReady || cycle?.llmActionGraph || cycle?.actions?.length);
    const liveScheduleApplied = Boolean(
      cycle?.scheduleAppliedAtISO ||
      cycle?.lastPlanAppliedAtISO ||
      (state.activeCycleId === cycle?.id && state.scheduleApplied)
    );
    const planQualityGate = resolvePlanQualityGateForGoal(state, goalId);
    const outcomeAuthorityClass = intakeContract?.terminalOutcomeAuthority?.authority || null;
    const executionCorrection = state.executionCorrectionByGoal?.[goalId] || null;
    const executionCorrectionState = executionCorrection?.correctionState || null;
    const executionCorrectionLevel = executionCorrection?.level || null;
    const shotClock = state.systemShotClockByGoal?.[goalId] || null;
    const snapshot = buildGoalPolicySnapshot({
      goalId,
      intakeContract,
      executionContract,
      planProof,
      probabilityStatus,
      feasibilityStatus,
      hasCommittedBlocks,
      hasProposedBlocks,
      hasExecutionGraph,
      canonicalActions,
      canonicalDeliverables,
      canonicalExecutionEvents: executionEvents,
      canonicalExternalEvidenceEvents: externalEvidenceEvents,
      liveScheduleApplied,
      longTermPlan,
      planQualityFailureCodes: planQualityGate?.failureCodes || [],
      outcomeAuthorityClass,
      executionCorrectionState,
      executionCorrectionLevel,
      blockedDownstreamCount: executionCorrection?.blockedDownstreamCount ?? null,
      timedDeadlineRiskCount: executionCorrection?.timedDeadlineRiskCount ?? null,
      paceState: shotClock?.paceState || null,
      preExecutionSchedule: {
        blockCount: preExecutionBlocks.length,
        totalMinutes: preExecutionBlocks.reduce((sum, block) => {
          const durationMinutes = Number(block?.durationMinutes || block?.minutes || 0);
          return sum + (Number.isFinite(durationMinutes) ? durationMinutes : 0);
        }, 0),
      },
    });
    goalPolicyByGoalId[goalId] = snapshot;
    if (cycle) {
      cycle.policyState = {
        ...(cycle.policyState || {}),
        goalPolicy: snapshot,
        goalPolicyUpdatedAtISO: snapshot.evaluatedAtISO,
      };
    }
  });
  state.goalPolicyByGoalId = goalPolicyByGoalId;
  Object.values(state?.masterPlansById || {}).forEach((plan) => {
    if (!plan?.id) {
      return;
    }
    // Correct truncated horizonEnd: if the declared duration exceeds the stored horizon,
    // extend to match.  Only EXTENDS — never shrinks a correctly-set horizon.
    //
    // Signal priority (take the maximum of all sources):
    //   1. plan.declaredHorizonMonths — stored at intake from horizonAnswer.months
    //      (primary signal; reliable even when northStarOutcome has no year-count phrase)
    //   2. inferHorizonYearsFromText over user-written text (northStarOutcome + title).
    //      Explicit signals ("5-year", "five-year", "N months") are always used.
    //      Vague signals ("master plan", "multi-year") are only used when declaredHorizonMonths
    //      is absent — i.e., legacy plans created before this field existed.
    //      masterPlanSummary is excluded — always auto-generated "Master plan coordinating X".
    //   3. plan.executionHorizon: "60 months" via months pattern, or a date label like
    //      "may 2031" (year-date inference relative to horizonStart).
    const hasExplicitDeclaration = Number.isFinite(Number(plan.declaredHorizonMonths)) && Number(plan.declaredHorizonMonths) > 0;
    const inferText = [plan.northStarOutcome, plan.title, plan.coreMission].filter(Boolean).join(' ');
    const horizonInference = inferHorizonYearsFromText(inferText);
    // For plans with declaredHorizonMonths, ignore vague signals that would override a short
    // but legitimate declaration (e.g., 6-month plan that writes "master plan" in description).
    const textMonths = horizonInference
      ? (hasExplicitDeclaration && !horizonInference.explicit ? 0 : horizonInference.months)
      : 0;

    // executionHorizon-specific inference: "60 months" via months pattern, or a date label
    // like "may 2031" → compute months from horizonStart.  Applied to executionHorizon only
    // (not combined text) to avoid false positives from aspirational years in northStarOutcome.
    let executionHorizonMonths = 0;
    if (plan.executionHorizon) {
      const fromExecution = inferHorizonYearsFromText(plan.executionHorizon);
      if (fromExecution?.months) {
        executionHorizonMonths = fromExecution.months;
      } else if (plan.horizonStart) {
        const yearMatch = plan.executionHorizon.match(/\b(20[2-9]\d)\b/);
        if (yearMatch) {
          const targetYear = parseInt(yearMatch[1], 10);
          const startYear = parseInt(plan.horizonStart.slice(0, 4), 10);
          const approxMonths = (targetYear - startYear) * 12;
          if (approxMonths >= 24 && approxMonths <= 240) {
            executionHorizonMonths = approxMonths;
          }
        }
      }
    }

    // Take the maximum across all sources — none should shadow the others.
    // e.g. dropdown=24mo but text="five-year" → 60 wins; dropdown=60mo no text → 60 wins.
    const declaredMonths = Math.max(
      hasExplicitDeclaration ? Math.round(Number(plan.declaredHorizonMonths)) : 0,
      textMonths,
      executionHorizonMonths
    );
    if (declaredMonths >= 24 && plan.horizonStart && plan.horizonEnd) {
      const startMs = new Date(`${plan.horizonStart}T12:00:00Z`).getTime();
      const storedEndMs = new Date(`${plan.horizonEnd}T12:00:00Z`).getTime();
      const storedMonths = Math.round((storedEndMs - startMs) / (1000 * 60 * 60 * 24 * 30.44));
      if (storedMonths < declaredMonths * 0.7) {
        const extendedEnd = new Date(`${plan.horizonStart}T12:00:00Z`);
        extendedEnd.setMonth(extendedEnd.getMonth() + declaredMonths);
        const extendedEndKey = extendedEnd.toISOString().slice(0, 10);
        plan.horizonEnd = extendedEndKey;
        if (!plan.fullHorizonEndDayKey || plan.fullHorizonEndDayKey < extendedEndKey) {
          plan.fullHorizonEndDayKey = extendedEndKey;
        }
      }
    }
    if (!plan.fullHorizonEndDayKey && plan.horizonEnd) {
      plan.fullHorizonEndDayKey = plan.horizonEnd;
    }
    const snapshot = buildMasterPlanPolicySnapshot(state, plan);
    if (!snapshot) {
      return;
    }
    masterPlanPolicyByPlanId[plan.id] = snapshot;
    plan.policyState = {
      ...(plan.policyState || {}),
      goalPolicy: snapshot,
      goalPolicyUpdatedAtISO: snapshot.evaluatedAtISO,
    };
  });
  state.masterPlanPolicyByPlanId = masterPlanPolicyByPlanId;
}

function applyLongHorizonCalendarBlocks(state) {
  // Resolve active master plan
  const activeProfileId = String(state?.activeProfileId || '').trim();
  const activeProfile = state?.profilesById?.[activeProfileId] || null;
  const activeMasterPlanId = String(activeProfile?.activeMasterPlanId || '').trim();
  const plan = activeMasterPlanId ? state?.masterPlansById?.[activeMasterPlanId] || null : null;
  const operationalDescriptors = plan ? buildMasterPlanOperationalDescriptors(state, plan) : null;

  // Expose strategic horizon end for Plan/Today agreement
  state.strategicHorizonEndDayKey = plan?.fullHorizonEndDayKey || plan?.horizonEnd || null;
  const scheduleLifecycleState = String(state?.scheduleLifecycleState || deriveScheduleLifecycleState(state)).trim().toLowerCase();

  const mode = String(state?.selectedHorizonMode || 'current_cycle').trim();

  // In current_cycle mode: no forecast blocks — calendar uses execution pipeline only
  if (!plan || mode === 'current_cycle') {
    state.calendarDisplayBlocks = [];
    return;
  }

  // Build a lightweight phase model (no committed blocks needed for horizon derivation)
  const lanes = Array.isArray(plan.laneIds)
    ? plan.laneIds.map(id => state?.masterPlanLanesById?.[id]).filter(Boolean)
    : [];
  const milestones = lanes.flatMap(lane =>
    Array.isArray(lane?.milestoneIds)
      ? lane.milestoneIds.map(id => state?.masterPlanMilestonesById?.[id]).filter(Boolean)
      : []
  );
  const anchors = Array.isArray(plan.anchors) ? plan.anchors : [];

  const phaseModel = deriveMasterPlanPhaseModel({
    plan, lanes, milestones, anchors,
    planCycle: null, committedBlocks: [], criticQuestionsByLane: {},
  });

  if (!phaseModel?.phases?.length) {
    state.calendarDisplayBlocks = [];
    return;
  }

  // Compute the active cycle's deadline as the "cycle end" boundary for P1 post-cycle derivation.
  // Fall back to horizonVisibility.currentCycleEnd when no active cycle is established.
  const activeCycleId = String(state?.activeCycleId || '').trim();
  const activeCycle = activeCycleId ? state?.cyclesById?.[activeCycleId] || null : null;
  const activeCycleScheduleStatePresent = hasCycleOwnedScheduleState(activeCycle);
  const suppressTodayForecastForFreshCycle = Boolean(
    scheduleLifecycleState === 'inter_cycle' || (activeCycle && !activeCycleScheduleStatePresent)
  );
  const rawCycleDeadline =
    activeCycle?.deadlineDayKey ||
    activeCycle?.contract?.deadlineISO?.slice(0, 10) ||
    activeCycle?.goalContract?.deadlineISO?.slice(0, 10) ||
    null;
  const cycleEndDayKey = rawCycleDeadline || phaseModel.horizonVisibility?.currentCycleEnd || null;

  // Resolve the horizon end cutoff for this mode
  const horizonEndForMode = resolveHorizonEndForMode(
    phaseModel.horizonVisibility,
    mode,
    cycleEndDayKey
  ) || plan.fullHorizonEndDayKey || plan.horizonEnd;

  const fullHorizonStartDayKey =
    phaseModel.horizonVisibility?.horizonStart || plan.horizonStart || plan.officialStartDate || null;
  const fullHorizonEndDayKey = horizonEndForMode || plan.fullHorizonEndDayKey || plan.horizonEnd;
  // Derive forecast blocks for all phases within the selected horizon.
  // P1 yields post-cycle forecast work; P2/P3 yield phase-level planning blocks.
  const allForecastBlocks = [];
  for (const phase of phaseModel.phases) {
    // Skip phases that start entirely beyond the selected horizon
    if (horizonEndForMode && phase.startBoundary > horizonEndForMode) continue;
    const blocks = deriveForecastBlocks({
      plan, phase, horizonEndDayKey: horizonEndForMode, cycleEndDayKey,
    });
    allForecastBlocks.push(...blocks);
  }

  // Expand the sparse forecast markers into a full-horizon dated workload substrate.
  // This produces a canonical `fullHorizonScheduleBlocks` array that all UI surfaces
  // (Structure deliverables, Plan chart, Today calendar) should consume.
  const coverageFailureReasonCodes = [];
  const qualityFailureReasonCodes = [];
  let blockQuality = state.fullHorizonBlockQuality || null;
  let coverageAudit = null;
  let planQuality = null;
  let renderTruthAudit = null;
  try {
    const fullHorizonScheduleBlocks = expandFullHorizonSchedule({
      plan,
      phaseModel,
      horizonStartDayKey: fullHorizonStartDayKey,
      horizonEndDayKey: fullHorizonEndDayKey,
      lanes,
      existingForecastBlocks: allForecastBlocks,
      committedBlocks: [],
      // Long-horizon forecast blocks are inspectable planning artifacts, not
      // executable schedule commitments. Do not force them through cycle work-window
      // placement, which is both semantically wrong for locked future work and
      // explosively expensive at five-year substrate size.
      workDays: [],
      workWindows: null,
      timeZone: state.appTime?.timeZone || 'UTC',
    });
    coverageAudit = auditFullHorizonCoverage({
      fullHorizonScheduleBlocks,
      phaseModel,
      fullHorizonStartDayKey,
      fullHorizonEndDayKey,
      laneModel: lanes,
      selectedHorizonMode: mode,
    });
    blockQuality = evaluateFullHorizonBlockQuality({
      fullHorizonScheduleBlocks,
      phaseModel,
    });
    planQuality = evaluateFullHorizonPlanQuality({
      fullHorizonScheduleBlocks,
      fullHorizonCoverageAudit: coverageAudit,
      fullHorizonBlockQuality: blockQuality,
      phaseModel,
      laneModel: lanes,
      masterPlanContract: plan,
      anchors,
      successStandard: plan?.successStandard || plan?.northStarOutcome || null,
      outcomeTarget: plan?.outcomeTarget || null,
      constraints: plan?.financialConstraint || plan?.constraints || null,
    });
    coverageAudit = {
      ...coverageAudit,
      fullHorizonQualityTrusted: planQuality?.state === 'trusted',
    };
    const projectedFullHorizonScheduleBlocks = projectBlocksForDisplay(fullHorizonScheduleBlocks, {
      surface: 'full_horizon',
    });
    projectedFullHorizonScheduleBlocks.forEach((block) => {
      block.ownerScope = 'master_plan_forecast';
      block.cycleId = null;
      block.masterPlanId = block.masterPlanId || plan.id;
      block.scheduleCommitment = 'none';
      block.calendarEligible = false;
      block.executionEligible = false;
      block.forecastInspectionOnly = true;
    });
    state.fullHorizonScheduleBlocks = projectedFullHorizonScheduleBlocks;
    state.calendarDisplayBlocks = suppressTodayForecastForFreshCycle ? [] : projectedFullHorizonScheduleBlocks;
    renderTruthAudit = auditFullHorizonRenderTruth({
      state,
      fullHorizonScheduleBlocks: state.fullHorizonScheduleBlocks,
      calendarDisplayBlocks: state.calendarDisplayBlocks,
      selectedHorizonMode: mode,
      timeZone: state?.appTime?.timeZone || APP_TIME_ZONE,
    });
    coverageAudit = applyRenderTruthToCoverageAudit(coverageAudit, renderTruthAudit);

    // Emit reason codes for coverage issues even when expansion succeeds
    if (!fullHorizonScheduleBlocks || fullHorizonScheduleBlocks.length === 0) {
      coverageFailureReasonCodes.push('FULL_HORIZON_SCHEDULE_EXPANSION_EMPTY');
    }
    if (Array.isArray(renderTruthAudit?.reasonCodes) && renderTruthAudit.reasonCodes.length > 0) {
      coverageFailureReasonCodes.push(...renderTruthAudit.reasonCodes);
    }

    // Check for P2 and P3 block presence
    const p2Blocks = (fullHorizonScheduleBlocks || []).filter(b => b.phaseLabel === 'P2');
    const p3Blocks = (fullHorizonScheduleBlocks || []).filter(b => b.phaseLabel === 'P3');
    if (p2Blocks.length === 0) {
      const p2Phase = phaseModel.phases.find(p => p.label === 'P2');
      if (p2Phase && horizonEndForMode >= p2Phase.startBoundary) {
        coverageFailureReasonCodes.push('P2_DELIVERABLE_SCHEDULE_EMPTY');
      }
    }
    if (p3Blocks.length === 0) {
      const p3Phase = phaseModel.phases.find(p => p.label === 'P3');
      if (p3Phase && horizonEndForMode >= p3Phase.startBoundary) {
        coverageFailureReasonCodes.push('P3_DELIVERABLE_SCHEDULE_EMPTY');
      }
    }

    // Check for low work density: need at least one block per year on average
    if (fullHorizonScheduleBlocks && fullHorizonScheduleBlocks.length > 0) {
      // Conservative check: 5-year plan should have at least 5 blocks
      const isLongHorizon = horizonEndForMode && plan.horizonStart
        && horizonEndForMode.slice(0, 4) > String(parseInt(plan.horizonStart.slice(0, 4)) + 3);
      if (isLongHorizon && fullHorizonScheduleBlocks.length < 5) {
        coverageFailureReasonCodes.push('FULL_HORIZON_WORK_DENSITY_INSUFFICIENT');
      }
    }

    // Check phase-specific issues
    for (const phase of phaseModel.phases) {
      if (horizonEndForMode < phase.startBoundary) continue; // Phase not in scope
      const phaseBlocks = (fullHorizonScheduleBlocks || []).filter(b => b.phaseLabel === phase.label);
      if (phaseBlocks.length === 0) {
        coverageFailureReasonCodes.push(`PHASE_EXISTS_WITHOUT_SCHEDULED_WORK:${phase.label}`);
      }
    }
  } catch (err) {
    // Fallback to the derived forecast markers if expansion fails for safety.
    const projectedForecastBlocks = projectBlocksForDisplay(allForecastBlocks, { surface: 'full_horizon_fallback' });
    projectedForecastBlocks.forEach((block) => {
      block.ownerScope = 'master_plan_forecast';
      block.cycleId = null;
      block.masterPlanId = block.masterPlanId || plan.id;
      block.scheduleCommitment = 'none';
      block.calendarEligible = false;
      block.executionEligible = false;
      block.forecastInspectionOnly = true;
    });
    state.fullHorizonScheduleBlocks = projectedForecastBlocks;
    state.calendarDisplayBlocks = suppressTodayForecastForFreshCycle ? [] : projectedForecastBlocks;
    if (!IS_PRODUCTION) console.warn('Full-horizon expansion failed:', err && err.message);
    coverageFailureReasonCodes.push('FULL_HORIZON_SCHEDULE_EXPANSION_MISSING');
    
    // Still check allForecastBlocks for P2/P3 presence
    if (allForecastBlocks.length === 0) {
      coverageFailureReasonCodes.push('FULL_HORIZON_SCHEDULE_EXPANSION_EMPTY');
    }
  }

  // Store coverage failure reason codes in state for diagnostic access
  if (!coverageAudit && Array.isArray(state.fullHorizonScheduleBlocks) && state.fullHorizonScheduleBlocks.length > 0) {
    coverageAudit = auditFullHorizonCoverage({
      fullHorizonScheduleBlocks: state.fullHorizonScheduleBlocks,
      phaseModel,
      fullHorizonStartDayKey,
      fullHorizonEndDayKey,
      laneModel: lanes,
      selectedHorizonMode: mode,
    });
  }
  if (!planQuality && Array.isArray(state.fullHorizonScheduleBlocks) && state.fullHorizonScheduleBlocks.length > 0) {
    if (!blockQuality) {
      blockQuality = evaluateFullHorizonBlockQuality({
        fullHorizonScheduleBlocks: state.fullHorizonScheduleBlocks,
        phaseModel,
      });
    }
    planQuality = evaluateFullHorizonPlanQuality({
      fullHorizonScheduleBlocks: state.fullHorizonScheduleBlocks,
      fullHorizonCoverageAudit: coverageAudit,
      fullHorizonBlockQuality: blockQuality,
      phaseModel,
      laneModel: lanes,
      masterPlanContract: plan,
      anchors,
      successStandard: plan?.successStandard || plan?.northStarOutcome || null,
      outcomeTarget: plan?.outcomeTarget || null,
      constraints: plan?.financialConstraint || plan?.constraints || null,
    });
  }
  if (!blockQuality && Array.isArray(state.fullHorizonScheduleBlocks) && state.fullHorizonScheduleBlocks.length > 0) {
    blockQuality = evaluateFullHorizonBlockQuality({
      fullHorizonScheduleBlocks: state.fullHorizonScheduleBlocks,
      phaseModel,
    });
  }
  if (coverageAudit) {
    coverageAudit = {
      ...coverageAudit,
      fullHorizonQualityTrusted: planQuality?.state === 'trusted',
    };
  }
  if (Array.isArray(planQuality?.reasonCodes)) {
    qualityFailureReasonCodes.push(...planQuality.reasonCodes.filter(Boolean));
  }
  state.fullHorizonCoverageAudit = coverageAudit;
  state.fullHorizonPlanQuality = planQuality;
  state.fullHorizonBlockQuality = blockQuality;
  state.fullHorizonRenderTruthAudit = renderTruthAudit;
  state.fullHorizonCoverageFailureCodes = [
    ...new Set([
      ...(coverageFailureReasonCodes || []),
      ...(qualityFailureReasonCodes || []),
      ...((coverageAudit?.reasonCodes || []).filter(Boolean)),
    ]),
  ];
  attachFullHorizonAgendaMetadata(state, plan, operationalDescriptors, {
    strategicCoverageState: coverageAudit?.fullHorizonCovered ? 'covered' : coverageAudit?.horizonExpanded ? 'expanded' : 'unresolved',
    planQualityState: planQuality?.state || null,
    blockQualityState: blockQuality?.state || null,
  });
}

function applyExecutionCorrection(state) {
  const executionCorrectionByGoal = {};
  const goalIds = Object.keys(state.goalPolicyByGoalId || {});
  goalIds.forEach((goalId) => {
    if (!goalId) return;
    const cycle = resolveCycleForGoal(state, goalId);
    const executionEvents = getCanonicalExecutionEventsForCycleGoal(state, cycle?.id || null, goalId);
    const externalEvidenceEvents = getCanonicalExternalEvidenceEventsForCycleGoal(state, cycle?.id || null, goalId);
    const planMutationEvents = (Array.isArray(state.planMutationEvents) ? state.planMutationEvents : []).filter((event) => {
      if (!event?.blockId) return false;
      if (goalId && event?.goalId && event.goalId !== goalId) return false;
      if (cycle?.id && event?.cycleId && event.cycleId !== cycle.id) return false;
      return true;
    });
    const canonicalActions = getCanonicalCycleActions(cycle);
    const shotClock = state.systemShotClockByGoal?.[goalId] || null;
    executionCorrectionByGoal[goalId] = evaluateExecutionCorrection({
      goalId,
      cycleId: cycle?.id || null,
      executionEvents,
      externalEvidenceEvents,
      planMutationEvents,
      canonicalActions,
      shotClock,
    });
  });
  state.executionCorrectionByGoal = executionCorrectionByGoal;
}

function applySystemShotClock(state) {
  const systemShotClockByGoal = {};
  const contracts = collectGovernanceContracts(state);
  const goalIds = Array.from(new Set(contracts.map((c) => c.goalId).filter(Boolean)));
  goalIds.forEach((goalId) => {
    const cycle = resolveCycleForGoal(state, goalId);
    const executionContract = cycle?.goalContract || state.goalExecutionContract || null;
    const executionEvents = getCanonicalExecutionEventsForCycleGoal(state, cycle?.id || null, goalId);
    const blocks = getAllBlocks(state).filter((block) => {
      if (!block?.id) return false;
      if (goalId && block?.goalId && block.goalId !== goalId) return false;
      if (cycle?.id && block?.cycleId && block.cycleId !== cycle.id) return false;
      return true;
    });
    systemShotClockByGoal[goalId] = deriveSystemShotClock({
      goalId,
      cycleId: cycle?.id || null,
      contract: executionContract,
      blocks,
      executionEvents,
      nowISO: state.appTime?.nowISO || null,
      timeZone: state.appTime?.timeZone || APP_TIME_ZONE,
    });
  });
  state.systemShotClockByGoal = systemShotClockByGoal;
  const activeGoalId =
    state.goalExecutionContract?.goalId || state.cyclesById?.[state.activeCycleId]?.goalContract?.goalId || null;
  state.systemShotClock = activeGoalId ? systemShotClockByGoal[activeGoalId] || null : null;
}

function seedCanonicalWorkModelIfMissing(state, goalId) {
  if (!goalId) {
    return;
  }
  state.goalWorkById = state.goalWorkById || {};
  const existing = Array.isArray(state.goalWorkById[goalId]) ? state.goalWorkById[goalId] : [];
  if (existing.length > 0) {
    return;
  }
  const cycle = resolveCycleForGoal(state, goalId);
  if (!cycle) {
    return;
  }

  const canonicalActions = getCanonicalCycleActions(cycle);
  const canonicalDeliverables = getCanonicalCycleDeliverables(
    state?.deliverablesByCycleId || {},
    cycle?.id || null,
    cycle
  );
  const canonicalProposed = getCanonicalProposedBlocks(cycle?.proposedBlocks, cycle?.suggestedBlocks);
  const canonicalCommitted = getAllBlocks(state).filter((block) => {
    if (!block) {
      return false;
    }
    if (block?.goalId && block.goalId !== goalId) {
      return false;
    }
    if (block?.cycleId && cycle?.id && block.cycleId !== cycle.id) {
      return false;
    }
    const status = String(block?.status || '').toLowerCase();
    return status !== 'completed' && status !== 'complete' && status !== 'cancelled' && status !== 'canceled';
  });

  let derived = canonicalActions
    .filter((action) => action?.id || action?.title)
    .map((action, index) => ({
      workItemId: `derived-action-${goalId}-${index + 1}`,
      title: String(action?.title || `Action ${index + 1}`),
      blocksRemaining: Math.max(1, Math.ceil((Number(action?.estimateMin) || 60) / 60)),
    }));

  if (derived.length === 0) {
    derived = canonicalProposed.filter(Boolean).map((block, index) => ({
      workItemId: `derived-proposed-${goalId}-${index + 1}`,
      title: String(block?.title || `Planned block ${index + 1}`),
      blocksRemaining: 1,
    }));
  }
  if (derived.length === 0) {
    derived = canonicalCommitted.filter(Boolean).map((block, index) => ({
      workItemId: `derived-committed-${goalId}-${index + 1}`,
      title: String(block?.title || `Committed block ${index + 1}`),
      blocksRemaining: 1,
    }));
  }
  if (derived.length === 0) {
    derived = canonicalDeliverables.filter(Boolean).map((deliverable, index) => ({
      workItemId: `derived-deliverable-${goalId}-${index + 1}`,
      title: String(deliverable?.title || `Deliverable ${index + 1}`),
      blocksRemaining: Math.max(1, Math.ceil((Number(deliverable?.estimateMin) || 60) / 60)),
    }));
  }
  if (derived.length === 0) {
    return;
  }
  state.goalWorkById[goalId] = derived;
}

function resolveCycleForGoal(state, goalId) {
  if (!goalId) {
    return null;
  }
  const activeCycleId = state?.activeCycleId || null;
  const activeCycle = activeCycleId ? state?.cyclesById?.[activeCycleId] : null;
  if (activeCycle) {
    const activeGoalId =
      activeCycle?.goalContract?.goalId ||
      activeCycle?.goalGovernanceContract?.goalId ||
      activeCycle?.contract?.goalId ||
      null;
    if (activeGoalId === goalId) {
      return activeCycle;
    }
  }
  const cycles = Object.values(state?.cyclesById || {});
  return (
    cycles.find((cycle) => cycle?.goalContract?.goalId === goalId) ||
    cycles.find((cycle) => cycle?.goalGovernanceContract?.goalId === goalId) ||
    cycles.find((cycle) => cycle?.contract?.goalId === goalId) ||
    null
  );
}

function inferGoalIdForCycle(state, cycle = null) {
  const directGoalId =
    cycle?.goalContract?.goalId ||
    cycle?.goalGovernanceContract?.goalId ||
    cycle?.contract?.goalId ||
    state?.goalExecutionContract?.goalId ||
    state?.activeGoalId ||
    state?.planDraft?.goalId ||
    null;
  if (directGoalId) {
    return directGoalId;
  }

  const goalWorkIds = Object.keys(state?.goalWorkById || {}).filter(Boolean);
  if (goalWorkIds.length === 1) {
    return goalWorkIds[0];
  }

  const admissionIds = Object.keys(state?.goalAdmissionByGoal || {}).filter(Boolean);
  if (admissionIds.length === 1) {
    return admissionIds[0];
  }

  if (cycle?.id) {
    return `goal-${cycle.id}`;
  }

  return null;
}

function recoverCanonicalContractForCycle(state, cycle = null, contract = null) {
  if (!cycle) {
    return contract;
  }
  if (contract?.goalId) {
    return contract;
  }

  const inferredGoalId = inferGoalIdForCycle(state, cycle);
  if (!inferredGoalId) {
    return contract;
  }

  const startDayKey =
    cycle?.startedAtDayKey ||
    contract?.startDayKey ||
    state?.goalExecutionContract?.startDayKey ||
    state?.today?.date ||
    nowDayKey(state?.appTime?.timeZone || APP_TIME_ZONE);
  const endDayKey =
    cycle?.definiteGoal?.deadlineDayKey ||
    contract?.endDayKey ||
    state?.goalExecutionContract?.endDayKey ||
    addDays(startDayKey, 90, state?.appTime?.timeZone || APP_TIME_ZONE);
  const goalText =
    cycle?.definiteGoal?.outcome || state?.goalExecutionContract?.goalText || state?.lenses?.aim?.description || '';

  const repairedContract = {
    ...(contract || {}),
    goalId: inferredGoalId,
    goalText: contract?.goalText || goalText || null,
    goalLabel: contract?.goalLabel || goalText || null,
    startDayKey: contract?.startDayKey || startDayKey || null,
    endDayKey: contract?.endDayKey || endDayKey || null,
    deadlineISO: contract?.deadlineISO || endDayKey || null,
  };

  cycle.goalContract = {
    ...(cycle?.goalContract || {}),
    ...repairedContract,
  };
  cycle.goalGovernanceContract = cycle.goalGovernanceContract || {
    contractId: `gov-${inferredGoalId}`,
    version: 1,
    goalId: inferredGoalId,
    activeFromISO: startDayKey,
    activeUntilISO: endDayKey,
    scope: {
      domainsAllowed: [],
      timeHorizon: 'week',
      timezone: state?.appTime?.timeZone || 'UTC',
    },
    governance: {
      suggestionsEnabled: true,
      probabilityEnabled: true,
      minEvidenceEvents: 1,
      cooldowns: { resuggestMinutes: 30, maxSuggestionsPerDay: 6 },
    },
    constraints: {
      forbiddenDirectives: ['repair'],
      maxActiveBlocks: 6,
    },
  };
  state.goalExecutionContract = {
    ...(state.goalExecutionContract || {}),
    goalId: inferredGoalId,
    goalText: state?.goalExecutionContract?.goalText || goalText || null,
    startDayKey: state?.goalExecutionContract?.startDayKey || startDayKey || null,
    endDayKey: state?.goalExecutionContract?.endDayKey || endDayKey || null,
  };
  state.activeGoalId = state.activeGoalId || inferredGoalId;
  if (cycle?.id && state?.cyclesById?.[cycle.id]) {
    state.cyclesById[cycle.id] = cycle;
  }

  return cycle.goalContract;
}

function clampUnitScore(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(1, Number(value)));
}

function deriveCanonicalFeasibilityScore(state, cycle, goalId) {
  const feasibility = goalId ? state?.feasibilityByGoal?.[goalId] || null : null;
  const probability = goalId ? state?.probabilityByGoal?.[goalId] || null : null;
  const canonicalActions = getCanonicalCycleActions(cycle);
  const canonicalDeliverables = getCanonicalCycleDeliverables(
    state?.deliverablesByCycleId || {},
    cycle?.id || null,
    cycle
  );
  const canonicalProposed = getCanonicalProposedBlocks(cycle?.proposedBlocks, cycle?.suggestedBlocks);
  const canonicalWorkItems = Array.isArray(state?.goalWorkById?.[goalId]) ? state.goalWorkById[goalId] : [];
  const hasThroughputModel =
    canonicalWorkItems.length > 0 ||
    canonicalActions.length > 0 ||
    canonicalDeliverables.length > 0 ||
    canonicalProposed.length > 0;

  const diagnostics = {
    hasThroughputModel,
    workItemsCount: canonicalWorkItems.length,
    actionCount: canonicalActions.length,
    deliverablesCount: canonicalDeliverables.length,
    proposedCount: canonicalProposed.length,
    feasibilityStatus: feasibility?.status || null,
  };

  if (!hasThroughputModel) {
    return { feasibilityScore: null, reasonCode: 'POS_THROUGHPUT_MODEL_MISSING', diagnostics };
  }
  if (!feasibility) {
    return { feasibilityScore: null, reasonCode: 'POS_FEASIBILITY_INPUT_MISSING', diagnostics };
  }
  if (feasibility.status === 'INFEASIBLE') {
    return { feasibilityScore: 0, reasonCode: null, diagnostics };
  }

  const remaining = Number(feasibility.remainingBlocksTotal || 0);
  const workableDaysRemaining = Number(feasibility.workableDaysRemaining);
  const requiredPerDay = Number(feasibility.requiredBlocksPerDay);
  const capacityPerDay = resolveCycleCapacityPerDay(state, cycle);

  if (Number.isFinite(workableDaysRemaining) && workableDaysRemaining <= 0 && remaining > 0) {
    return { feasibilityScore: 0, reasonCode: null, diagnostics };
  }
  if (remaining <= 0) {
    const reasons = Array.isArray(feasibility?.reasons) ? feasibility.reasons : [];
    if (reasons.includes('GOAL_HAS_NO_REMAINING_WORK')) {
      if (canonicalWorkItems.length > 0) {
        return { feasibilityScore: 1, reasonCode: null, diagnostics };
      }
      return { feasibilityScore: null, reasonCode: 'POS_THROUGHPUT_MODEL_MISSING', diagnostics };
    }
    return { feasibilityScore: null, reasonCode: 'POS_FEASIBILITY_INPUT_MISSING', diagnostics };
  }
  if (!Number.isFinite(requiredPerDay) || !(requiredPerDay >= 0) || !(capacityPerDay > 0)) {
    return { feasibilityScore: null, reasonCode: 'POS_THROUGHPUT_MODEL_MISSING', diagnostics };
  }

  const feasibilityScore = clampUnitScore((capacityPerDay - requiredPerDay) / capacityPerDay);
  return { feasibilityScore, reasonCode: null, diagnostics };
}

function mapTrajectoryToReasonCode(trajectory) {
  const normalized = String(trajectory || '')
    .trim()
    .toUpperCase();
  if (normalized === 'ON_TRACK') {
    return 'POS_TRAJECTORY_ON_TRACK';
  }
  if (normalized === 'RECOVERABLE_DRIFT') {
    return 'POS_TRAJECTORY_RECOVERABLE_DRIFT';
  }
  if (normalized === 'AT_RISK') {
    return 'POS_TRAJECTORY_AT_RISK';
  }
  return 'POS_TRAJECTORY_INFEASIBLE';
}

function deriveDynamicOutcomeAggregate({
  blocks = [],
  cycleDynamics = null,
  feasibility = null,
  feasibilityScore = null,
  capacityPerDay = 4,
  supportHorizon = null,
}) {
  const normalizedBlocks = Array.isArray(blocks) ? blocks : [];
  let completedBlocks = 0;
  let missedBlocks = 0;
  let expiredBlocks = 0;
  let plannedBlocks = 0;
  let inProgressBlocks = 0;
  normalizedBlocks.forEach((block) => {
    const status = String(block?.status || '')
      .trim()
      .toLowerCase();
    if (status === 'completed' || status === 'complete') {
      completedBlocks += 1;
    } else if (status === 'missed') {
      missedBlocks += 1;
    } else if (status === 'expired') {
      expiredBlocks += 1;
    } else if (status === 'in_progress') {
      inProgressBlocks += 1;
    } else if (status === 'planned') {
      plannedBlocks += 1;
    }
  });

  const overdueUnfinished =
    Number(cycleDynamics?.totals?.overdueUnfinished || 0) > 0 ? Number(cycleDynamics.totals.overdueUnfinished) : 0;
  const missedRecoverable = Math.max(0, missedBlocks - expiredBlocks);
  const overdueRecoverableBurden = overdueUnfinished + missedRecoverable;
  const feasibilityRemaining = Number(feasibility?.remainingBlocksTotal);
  const supportRemaining = Number(supportHorizon?.remainingRequiredWork);
  const baseRemaining =
    Number.isFinite(feasibilityRemaining) && feasibilityRemaining > 0
      ? feasibilityRemaining
      : Number.isFinite(supportRemaining) && supportRemaining > 0
        ? supportRemaining
        : 0;
  const remainingRequiredWork = Math.max(baseRemaining, overdueRecoverableBurden + expiredBlocks);
  const feasibilityWorkableDays = Number(feasibility?.workableDaysRemaining);
  const supportWorkableDays = Number(supportHorizon?.workableDaysRemaining);
  const workableDaysRemaining =
    Number.isFinite(feasibilityWorkableDays) && feasibilityWorkableDays > 0
      ? feasibilityWorkableDays
      : Number.isFinite(supportWorkableDays) && supportWorkableDays > 0
        ? supportWorkableDays
        : 0;
  const requiredPerDay =
    workableDaysRemaining > 0 ? Math.ceil(remainingRequiredWork / workableDaysRemaining) : Number.POSITIVE_INFINITY;
  const requiredWeeklyThroughput = Number.isFinite(requiredPerDay) ? Math.ceil(requiredPerDay * 7) : null;
  const feasibilityRequiredPerDay = Number(feasibility?.requiredBlocksPerDay);
  const supportRequiredWeekly = Number(supportHorizon?.requiredWeeklyThroughput);
  const baseRequiredWeeklyThroughput = Number.isFinite(feasibilityRequiredPerDay)
    ? Math.ceil(feasibilityRequiredPerDay * 7)
    : Number.isFinite(supportRequiredWeekly)
      ? supportRequiredWeekly
      : null;
  const safeCapacityPerDay = Number.isFinite(capacityPerDay) && capacityPerDay > 0 ? capacityPerDay : 4;
  const capacityWeekly = safeCapacityPerDay * 7;
  const throughputPressure = Number.isFinite(requiredPerDay)
    ? requiredPerDay / safeCapacityPerDay
    : Number.POSITIVE_INFINITY;

  let trajectory = 'ON_TRACK';
  if (
    String(feasibility?.status || '').toUpperCase() === 'INFEASIBLE' ||
    (workableDaysRemaining <= 0 && remainingRequiredWork > 0)
  ) {
    trajectory = 'INFEASIBLE_TRAJECTORY';
  } else if (
    expiredBlocks > 0 ||
    throughputPressure >= 1 ||
    overdueRecoverableBurden >= Math.max(3, Math.ceil(remainingRequiredWork * 0.4))
  ) {
    trajectory = 'AT_RISK';
  } else if (missedBlocks > 0 || overdueRecoverableBurden > 0 || throughputPressure >= 0.75) {
    trajectory = 'RECOVERABLE_DRIFT';
  }

  const trajectoryMultiplier =
    trajectory === 'ON_TRACK' ? 1 : trajectory === 'RECOVERABLE_DRIFT' ? 0.85 : trajectory === 'AT_RISK' ? 0.65 : 0.35;
  const driftPenalty = Math.min(0.5, missedBlocks * 0.04 + expiredBlocks * 0.1 + overdueUnfinished * 0.03);
  const completionBonus =
    missedBlocks === 0 && expiredBlocks === 0 ? Math.min(0.08, Math.max(0, completedBlocks) * 0.01) : 0;
  const feasibilityAdjustment = clampUnitScore(trajectoryMultiplier - driftPenalty + completionBonus) ?? 0;
  const adjustedFeasibilityScore =
    Number.isFinite(feasibilityScore) && feasibilityScore !== null
      ? clampUnitScore(Number(feasibilityScore) * feasibilityAdjustment)
      : null;

  const reasonCodes = [mapTrajectoryToReasonCode(trajectory)];
  if (expiredBlocks > 0) {
    reasonCodes.push('POS_TERMINAL_DRIFT_EXPIRED');
  }
  if (
    Number.isFinite(requiredWeeklyThroughput) &&
    Number.isFinite(baseRequiredWeeklyThroughput) &&
    requiredWeeklyThroughput > baseRequiredWeeklyThroughput
  ) {
    reasonCodes.push('POS_REQUIRED_WEEKLY_THROUGHPUT_UP');
  }

  return {
    completedBlocks,
    missedBlocks,
    expiredBlocks,
    plannedBlocks,
    inProgressBlocks,
    overdueUnfinished,
    overdueRecoverableBurden,
    remainingRequiredWork,
    workableDaysRemaining: Number.isFinite(workableDaysRemaining) ? workableDaysRemaining : null,
    requiredWeeklyThroughput,
    baseRequiredWeeklyThroughput,
    actualAvgPerWeek: Number.isFinite(Number(supportHorizon?.actualAvgPerWeek))
      ? Number(supportHorizon.actualAvgPerWeek)
      : null,
    capacityWeekly,
    throughputPressure: Number.isFinite(throughputPressure) ? Number(throughputPressure.toFixed(3)) : null,
    trajectory,
    reasonCodes,
    feasibilityAdjustment,
    adjustedFeasibilityScore,
  };
}

function buildDynamicPosReasons(dynamicOutcome) {
  if (!dynamicOutcome || !Array.isArray(dynamicOutcome.reasonCodes)) {
    return [];
  }
  const directionByCode = {
    POS_TRAJECTORY_ON_TRACK: 'UP',
    POS_TRAJECTORY_RECOVERABLE_DRIFT: 'DOWN',
    POS_TRAJECTORY_AT_RISK: 'DOWN',
    POS_TRAJECTORY_INFEASIBLE: 'DOWN',
    POS_REQUIRED_WEEKLY_THROUGHPUT_UP: 'DOWN',
    POS_TERMINAL_DRIFT_EXPIRED: 'DOWN',
  };
  return dynamicOutcome.reasonCodes.map((code) => ({
    code,
    direction: directionByCode[code] || 'NEUTRAL',
    magnitude: code === 'POS_TERMINAL_DRIFT_EXPIRED' ? 1 : 0.5,
    evidence:
      code === 'POS_REQUIRED_WEEKLY_THROUGHPUT_UP'
        ? `required/week ${dynamicOutcome.baseRequiredWeeklyThroughput ?? '—'} -> ${dynamicOutcome.requiredWeeklyThroughput ?? '—'}`
        : code === 'POS_TERMINAL_DRIFT_EXPIRED'
          ? `expired ${dynamicOutcome.expiredBlocks}`
          : `trajectory ${String(dynamicOutcome.trajectory || '').toLowerCase()}`,
  }));
}

function deriveContractFailureRegistration({ activeDayKey, deadlineDayKey, feasibility, dynamicOutcome }) {
  const remainingRequiredWork = Number(dynamicOutcome?.remainingRequiredWork || 0);
  const requiredWeeklyThroughput = Number(dynamicOutcome?.requiredWeeklyThroughput || 0);
  const capacityWeekly = Number(dynamicOutcome?.capacityWeekly || 0);
  const trajectory = String(dynamicOutcome?.trajectory || '')
    .trim()
    .toUpperCase();
  const feasibilityStatus = String(feasibility?.status || '')
    .trim()
    .toUpperCase();
  const deadlinePassed = Boolean(deadlineDayKey && activeDayKey && activeDayKey > deadlineDayKey);
  const reasons = [];

  if (deadlinePassed && remainingRequiredWork > 0) {
    reasons.push('DEADLINE_PASSED_WITH_REMAINING_WORK', 'RENEGOTIATION_REQUIRED');
    return {
      state: 'DEADLINE_FAILED_RENEGOTIATION_REQUIRED',
      reasons,
      renegotiationRequired: true,
      details: {
        deadlineDayKey: deadlineDayKey || null,
        deadlinePassed,
        remainingRequiredWork,
        requiredWeeklyThroughput: Number.isFinite(requiredWeeklyThroughput) ? requiredWeeklyThroughput : null,
        capacityWeekly: Number.isFinite(capacityWeekly) ? capacityWeekly : null,
      },
    };
  }

  if (feasibilityStatus === 'INFEASIBLE' || trajectory === 'INFEASIBLE_TRAJECTORY') {
    reasons.push(
      ...(Array.isArray(feasibility?.reasons)
        ? feasibility.reasons.map((r) => `FEASIBILITY_${String(r || '').toUpperCase()}`)
        : [])
    );
    if (!reasons.length) {
      reasons.push('INFEASIBLE_UNDER_CURRENT_CONTRACT');
    }
    return {
      state: 'INFEASIBLE_CURRENT_CONTRACT',
      reasons,
      renegotiationRequired: true,
      details: {
        deadlineDayKey: deadlineDayKey || null,
        deadlinePassed,
        remainingRequiredWork,
        requiredWeeklyThroughput: Number.isFinite(requiredWeeklyThroughput) ? requiredWeeklyThroughput : null,
        capacityWeekly: Number.isFinite(capacityWeekly) ? capacityWeekly : null,
      },
    };
  }

  if (
    remainingRequiredWork > 0 &&
    Number.isFinite(requiredWeeklyThroughput) &&
    Number.isFinite(capacityWeekly) &&
    requiredWeeklyThroughput > capacityWeekly
  ) {
    reasons.push('REQUIRED_THROUGHPUT_EXCEEDS_CONTRACT_CAPACITY');
    return {
      state: 'OVERLOADED_CURRENT_CONTRACT',
      reasons,
      renegotiationRequired: true,
      details: {
        deadlineDayKey: deadlineDayKey || null,
        deadlinePassed,
        remainingRequiredWork,
        requiredWeeklyThroughput,
        capacityWeekly,
      },
    };
  }

  if (
    trajectory === 'RECOVERABLE_DRIFT' ||
    trajectory === 'AT_RISK' ||
    Number(dynamicOutcome?.missedBlocks || 0) > 0 ||
    Number(dynamicOutcome?.overdueRecoverableBurden || 0) > 0
  ) {
    reasons.push(trajectory === 'AT_RISK' ? 'TRAJECTORY_AT_RISK' : 'DRIFT_RECOVERABLE_UNDER_CONTRACT');
    return {
      state: 'RECOVERABLE_DRIFT',
      reasons,
      renegotiationRequired: false,
      details: {
        deadlineDayKey: deadlineDayKey || null,
        deadlinePassed,
        remainingRequiredWork,
        requiredWeeklyThroughput: Number.isFinite(requiredWeeklyThroughput) ? requiredWeeklyThroughput : null,
        capacityWeekly: Number.isFinite(capacityWeekly) ? capacityWeekly : null,
      },
    };
  }

  reasons.push('CONTRACT_CAPACITY_AND_DEADLINE_ALIGNED');
  return {
    state: 'ON_TRACK',
    reasons,
    renegotiationRequired: false,
    details: {
      deadlineDayKey: deadlineDayKey || null,
      deadlinePassed,
      remainingRequiredWork,
      requiredWeeklyThroughput: Number.isFinite(requiredWeeklyThroughput) ? requiredWeeklyThroughput : null,
      capacityWeekly: Number.isFinite(capacityWeekly) ? capacityWeekly : null,
    },
  };
}

function resolveBlockDurationMinutes(block) {
  const direct = Number(block?.durationMinutes);
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }
  const startMs = Date.parse(String(block?.start || block?.startISO || ''));
  const endMs = Date.parse(String(block?.end || block?.endISO || ''));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 60;
  }
  return Math.max(1, Math.round((endMs - startMs) / 60000));
}

function resolveMinutesCapPerDay(state, cycle, canonicalContract, blocks, capacityPerDay) {
  const explicitMaxMinutes = Number(state?.constraints?.maxMinutesPerDay);
  if (Number.isFinite(explicitMaxMinutes) && explicitMaxMinutes > 0) {
    return explicitMaxMinutes;
  }
  const strategyMaxMinutes = Number(cycle?.strategy?.constraints?.maxMinutesPerDay);
  if (Number.isFinite(strategyMaxMinutes) && strategyMaxMinutes > 0) {
    return strategyMaxMinutes;
  }
  const draftMinutes = Number(state?.planDraft?.minutesPerDay);
  if (Number.isFinite(draftMinutes) && draftMinutes > 0) {
    return draftMinutes;
  }

  const contractWorkWindows = canonicalContract?.workWindows || cycle?.goalContract?.workWindows || null;
  const hasExplicitContractWindows = countRawWorkWindows(contractWorkWindows) > 0;
  const weeklyCapacityFromWindows = hasExplicitContractWindows
    ? computeWeeklyCapacityFromWorkWindows(contractWorkWindows)
    : 0;
  if (hasExplicitContractWindows && Number.isFinite(weeklyCapacityFromWindows) && weeklyCapacityFromWindows > 0) {
    const workDays = Math.max(1, getWorkDaysFromWindows(contractWorkWindows).length);
    return Math.max(30, Math.floor(weeklyCapacityFromWindows / workDays));
  }
  return Math.max(30, Math.round((Number(capacityPerDay) || 1) * 60));
}

function resolveCycleScopedConstraints(state, cycle, timeZone = 'UTC') {
  const globalConstraints = state?.constraints || {};
  const strategyConstraints = cycle?.strategy?.constraints || {};
  return {
    ...globalConstraints,
    ...strategyConstraints,
    timezone: timeZone || globalConstraints.timezone || strategyConstraints.timezone || 'UTC',
  };
}

function resolveCycleCapacityPerDay(state, cycle) {
  const scopedConstraints = resolveCycleScopedConstraints(state, cycle, state?.appTime?.timeZone || APP_TIME_ZONE);
  const maxBlocksPerDay = Number(scopedConstraints?.maxBlocksPerDay);
  const strategyMaxBlocksPerDay = Number(cycle?.strategy?.constraints?.maxBlocksPerDay);
  return Number.isFinite(maxBlocksPerDay) && maxBlocksPerDay > 0
    ? maxBlocksPerDay
    : Number.isFinite(strategyMaxBlocksPerDay) && strategyMaxBlocksPerDay > 0
      ? strategyMaxBlocksPerDay
      : 4;
}

function buildRecoveryOption({ type, summary, delta = null, unit = null, reasonCode }) {
  return { type, summary, delta, unit, reasonCode };
}

function deriveRecoveryAnalysis({
  state,
  cycle,
  canonicalContract,
  dynamicOutcome,
  feasibility,
  blocks,
  capacityPerDay,
  contractFailure,
}) {
  const missedExpiredBurden =
    Math.max(0, Number(dynamicOutcome?.missedBlocks || 0)) + Math.max(0, Number(dynamicOutcome?.expiredBlocks || 0));
  const plannedCommitted =
    Math.max(0, Number(dynamicOutcome?.plannedBlocks || 0)) +
    Math.max(0, Number(dynamicOutcome?.inProgressBlocks || 0));
  const remainingRequiredBurden = Math.max(
    0,
    Number(dynamicOutcome?.remainingRequiredWork || feasibility?.remainingBlocksTotal || 0)
  );
  const unscheduledRequiredBurden = Math.max(0, remainingRequiredBurden - plannedCommitted);
  const workableDaysRemaining = Math.max(
    0,
    Number(dynamicOutcome?.workableDaysRemaining ?? feasibility?.workableDaysRemaining ?? 0)
  );
  const remainingCapacityBlocks = workableDaysRemaining * Math.max(0, Number(capacityPerDay) || 0);
  const availableRecoverySlack = remainingCapacityBlocks - remainingRequiredBurden;
  const requiredBlocksPerDayAfterRecovery =
    workableDaysRemaining > 0 ? Math.ceil(remainingRequiredBurden / workableDaysRemaining) : Number.POSITIVE_INFINITY;
  const requiredWeeklyThroughputAfterRecovery = Number.isFinite(requiredBlocksPerDayAfterRecovery)
    ? Math.ceil(requiredBlocksPerDayAfterRecovery * 7)
    : null;
  const projectedSlackAfterRecovery = Number.isFinite(availableRecoverySlack) ? availableRecoverySlack : null;
  const overCapacityAmount = Math.max(0, remainingRequiredBurden - remainingCapacityBlocks);

  const averageBlockMinutes = (() => {
    const durations = (Array.isArray(blocks) ? blocks : [])
      .map((block) => resolveBlockDurationMinutes(block))
      .filter((minutes) => Number.isFinite(minutes) && minutes > 0);
    if (!durations.length) {
      return 60;
    }
    return Math.round(durations.reduce((sum, minutes) => sum + minutes, 0) / durations.length);
  })();
  const minutesCapPerDay = resolveMinutesCapPerDay(state, cycle, canonicalContract, blocks, capacityPerDay);
  const requiredMinutesPerDayAfterRecovery = Number.isFinite(requiredBlocksPerDayAfterRecovery)
    ? requiredBlocksPerDayAfterRecovery * averageBlockMinutes
    : Number.POSITIVE_INFINITY;

  const overloadReasonCodes = [];
  if (overCapacityAmount > 0) {
    overloadReasonCodes.push('RECOVERY_OVER_MAX_BLOCKS_PER_DAY');
  }
  if (requiredMinutesPerDayAfterRecovery > minutesCapPerDay) {
    overloadReasonCodes.push('RECOVERY_OVER_MINUTES_PER_DAY');
  }
  if (String(contractFailure?.state || '').toUpperCase() === 'DEADLINE_FAILED_RENEGOTIATION_REQUIRED') {
    overloadReasonCodes.push('RECOVERY_DEADLINE_EXTENSION_REQUIRED');
  }

  const recoverableWithinCurrentContract =
    overloadReasonCodes.length === 0 &&
    Number.isFinite(requiredBlocksPerDayAfterRecovery) &&
    workableDaysRemaining > 0 &&
    requiredBlocksPerDayAfterRecovery <= Math.max(0, Number(capacityPerDay) || 0);
  const overloadDetected = !recoverableWithinCurrentContract && remainingRequiredBurden > 0;

  const recoveryReasons = [];
  if (recoverableWithinCurrentContract) {
    recoveryReasons.push('RECOVERY_WITHIN_CONTRACT');
    if (availableRecoverySlack <= 0) {
      recoveryReasons.push('RECOVERY_CONSUMES_ALL_SLACK');
    }
  } else {
    recoveryReasons.push(...overloadReasonCodes);
    recoveryReasons.push('RECOVERY_CONTRACT_RENEGOTIATION_REQUIRED');
  }

  const renegotiationRequired = overloadDetected || Boolean(contractFailure?.renegotiationRequired);
  const renegotiationOptions = [];
  if (renegotiationRequired) {
    const extraDaysNeeded = Math.max(0, Math.ceil(overCapacityAmount / Math.max(1, Number(capacityPerDay) || 1)));
    if (extraDaysNeeded > 0) {
      renegotiationOptions.push(
        buildRecoveryOption({
          type: 'EXTEND_DEADLINE',
          summary: `Extend deadline by ${extraDaysNeeded} day(s) to restore capacity fit.`,
          delta: extraDaysNeeded,
          unit: 'days',
          reasonCode: 'RECOVERY_DEADLINE_EXTENSION_REQUIRED',
        })
      );
    }
    const capacityWeekly = Math.max(0, Number(dynamicOutcome?.capacityWeekly || (Number(capacityPerDay) || 0) * 7));
    const throughputDelta =
      Number.isFinite(requiredWeeklyThroughputAfterRecovery) && requiredWeeklyThroughputAfterRecovery !== null
        ? Math.max(0, requiredWeeklyThroughputAfterRecovery - capacityWeekly)
        : 0;
    if (throughputDelta > 0) {
      renegotiationOptions.push(
        buildRecoveryOption({
          type: 'INCREASE_THROUGHPUT',
          summary: `Increase allowed throughput by ${throughputDelta} block(s)/week.`,
          delta: throughputDelta,
          unit: 'blocks/week',
          reasonCode: 'RECOVERY_OVER_MAX_BLOCKS_PER_DAY',
        })
      );
    }
    const scopeReduction = Math.max(0, overCapacityAmount);
    if (scopeReduction > 0) {
      renegotiationOptions.push(
        buildRecoveryOption({
          type: 'REDUCE_SCOPE',
          summary: `Reduce required scope by ${scopeReduction} block(s) to restore viability.`,
          delta: scopeReduction,
          unit: 'blocks',
          reasonCode: 'RECOVERY_SCOPE_REDUCTION_REQUIRED',
        })
      );
    }
  }

  return {
    recoveryState: recoverableWithinCurrentContract ? 'RECOVERY_WITHIN_CONTRACT' : 'RECOVERY_RENEGOTIATION_REQUIRED',
    recoveryReasons,
    recoveryMetrics: {
      missedExpiredBurden,
      unscheduledRequiredBurden,
      remainingRequiredBurden,
      availableRecoverySlack,
      recoverableWithinCurrentContract,
      overloadDetected,
      overloadReasonCodes,
      requiredWeeklyThroughputAfterRecovery,
      requiredBlocksPerDayAfterRecovery: Number.isFinite(requiredBlocksPerDayAfterRecovery)
        ? requiredBlocksPerDayAfterRecovery
        : null,
      requiredMinutesPerDayAfterRecovery: Number.isFinite(requiredMinutesPerDayAfterRecovery)
        ? requiredMinutesPerDayAfterRecovery
        : null,
      minutesCapPerDay,
      projectedSlackAfterRecovery,
      overCapacityAmount,
    },
    renegotiationRequired,
    renegotiationOptions,
  };
}

function normalizeReviewScheduleSupportBlock(block, cycleId, goalId) {
  const start = block?.start || block?.startISO || '';
  const durationMinutes = Number(block?.durationMinutes || block?.minutes || 0);
  const startMs = Date.parse(start);
  const end =
    block?.end ||
    block?.endISO ||
    (Number.isFinite(startMs) && Number.isFinite(durationMinutes) && durationMinutes > 0
      ? new Date(startMs + durationMinutes * 60 * 1000).toISOString()
      : '');
  return {
    ...block,
    id: block?.id || block?.blockId,
    cycleId: block?.cycleId || cycleId,
    goalId: block?.goalId || goalId,
    start,
    end,
    status: block?.status || 'planned',
    origin: block?.origin || 'schedule_review',
  };
}

function getDayKeyFromSupportBlock(block, timeZone = APP_TIME_ZONE) {
  return block?.date || block?.dayKey || dayKeyFromISO(block?.start || block?.startISO || '', timeZone);
}

function getWeekdayKeyFromDayKey(dayKey) {
  if (!dayKey) {
    return '';
  }
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getUTCDay()] || '';
}

function getWorkdaySetForSupportHorizon({ state, cycle, canonicalContract }) {
  const contractWorkWindows = canonicalContract?.workWindows || cycle?.goalContract?.workWindows || null;
  if (countRawWorkWindows(contractWorkWindows) > 0) {
    return new Set(getWorkDaysFromWindows(contractWorkWindows));
  }
  const weeklyWindows = state?.constraints?.weeklyWindows || state?.availabilityPolicy?.weeklyWindows || null;
  if (hasAnySchedulerWindows(weeklyWindows)) {
    const dayMap = {
      SUN: 'sun',
      MON: 'mon',
      TUE: 'tue',
      WED: 'wed',
      THU: 'thu',
      FRI: 'fri',
      SAT: 'sat',
    };
    const days = Object.entries(weeklyWindows || {})
      .filter(([, rows]) => Array.isArray(rows) && rows.length > 0)
      .map(
        ([day]) =>
          dayMap[
            String(day || '')
              .trim()
              .toUpperCase()
          ]
      )
      .filter(Boolean);
    return days.length ? new Set(days) : null;
  }
  const policyDays =
    state?.constraints?.workableDayPolicy?.weekdays || cycle?.strategy?.constraints?.workableDayPolicy?.weekdays;
  if (Array.isArray(policyDays) && policyDays.length > 0) {
    const numericDayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const days = policyDays
      .map((day) => {
        if (Number.isFinite(Number(day))) {
          return numericDayMap[Number(day)] || '';
        }
        return String(day || '')
          .trim()
          .slice(0, 3)
          .toLowerCase();
      })
      .filter(Boolean);
    return days.length ? new Set(days) : null;
  }
  return null;
}

function countSupportHorizonWorkableDays({ state, cycle, canonicalContract, startDayKey, deadlineDayKey }) {
  if (!startDayKey || !deadlineDayKey || startDayKey > deadlineDayKey) {
    return 0;
  }
  const workdaySet = getWorkdaySetForSupportHorizon({ state, cycle, canonicalContract });
  let count = 0;
  let cursor = startDayKey;
  while (cursor <= deadlineDayKey) {
    const dow = getWeekdayKeyFromDayKey(cursor);
    if (!workdaySet || workdaySet.has(dow)) {
      count += 1;
    }
    cursor = addDays(cursor, 1, state?.appTime?.timeZone || APP_TIME_ZONE);
  }
  return count;
}

function derivePreExecutionSupportHorizon({
  state,
  cycle,
  canonicalContract,
  supportBlocks,
  feasibility,
  capacityPerDay,
}) {
  const activeDayKey = state?.appTime?.activeDayKey || state?.today?.date || nowDayKey();
  const deadlineDayKey =
    canonicalContract?.endDayKey ||
    canonicalContract?.deadline?.dayKey ||
    cycle?.goalContract?.endDayKey ||
    cycle?.definiteGoal?.deadlineDayKey ||
    null;
  const scopedBlocks = Array.isArray(supportBlocks) ? supportBlocks : [];
  const futureBlocks = scopedBlocks.filter((block) => {
    const dayKey = getDayKeyFromSupportBlock(block, state?.appTime?.timeZone || APP_TIME_ZONE);
    if (!dayKey || dayKey < activeDayKey) {
      return false;
    }
    if (deadlineDayKey && dayKey > deadlineDayKey) {
      return false;
    }
    return true;
  });
  if (futureBlocks.length === 0 && Number(feasibility?.workableDaysRemaining || 0) > 0) {
    return null;
  }
  const workableDaysRemaining = countSupportHorizonWorkableDays({
    state,
    cycle,
    canonicalContract,
    startDayKey: activeDayKey,
    deadlineDayKey,
  });
  const remainingFromFeasibility = Number(feasibility?.remainingBlocksTotal);
  const remainingRequiredWork =
    Number.isFinite(remainingFromFeasibility) && remainingFromFeasibility > 0
      ? remainingFromFeasibility
      : futureBlocks.length;
  const requiredPerDay =
    workableDaysRemaining > 0 ? Math.ceil(remainingRequiredWork / workableDaysRemaining) : Number.POSITIVE_INFINITY;
  const requiredWeeklyThroughput = Number.isFinite(requiredPerDay) ? Math.ceil(requiredPerDay * 7) : null;
  const spanDays =
    activeDayKey && deadlineDayKey && activeDayKey <= deadlineDayKey
      ? Math.max(
          1,
          Math.floor(
            (Date.parse(`${deadlineDayKey}T00:00:00.000Z`) - Date.parse(`${activeDayKey}T00:00:00.000Z`)) / 86400000
          ) + 1
        )
      : Math.max(1, futureBlocks.length);
  const actualAvgPerWeek = futureBlocks.length / Math.max(1, spanDays / 7);
  const capacity = Math.max(0, Number(capacityPerDay) || 0);
  return {
    source: 'applied_review_schedule',
    activeDayKey,
    deadlineDayKey,
    futureBlockCount: futureBlocks.length,
    remainingRequiredWork,
    workableDaysRemaining,
    requiredWeeklyThroughput,
    actualAvgPerWeek,
    projectedSlack: workableDaysRemaining * capacity - remainingRequiredWork,
  };
}

function getPreExecutionSupportBlocksForCycleGoal({ state, cycle, cycleId, goalId, executionBlocks = [] }) {
  if (Array.isArray(executionBlocks) && executionBlocks.length > 0) {
    return executionBlocks;
  }
  const lifecycle = String(cycle?.scheduleLifecycle || state?.scheduleLifecycle || '')
    .trim()
    .toLowerCase();
  if (lifecycle === 'active_schedule') {
    return [];
  }
  const reviewBlocks = Array.isArray(cycle?.scheduleReviewBlocks) ? cycle.scheduleReviewBlocks : [];
  return reviewBlocks
    .filter((block) => {
      if (!block) {
        return false;
      }
      if (cycleId && block?.cycleId && block.cycleId !== cycleId) {
        return false;
      }
      if (goalId && block?.goalId && block.goalId !== goalId) {
        return false;
      }
      return Boolean(block?.start || block?.startISO);
    })
    .map((block) => normalizeReviewScheduleSupportBlock(block, cycleId, goalId))
    .filter((block) => Boolean(block.id && block.start));
}

function applyCycleScoring(state) {
  const cycleId = state?.activeCycleId || null;
  if (!cycleId) {
    return;
  }
  const cycle = state?.cyclesById?.[cycleId];
  if (!cycle) {
    return;
  }
  const canonicalContract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
  const goalId = canonicalContract?.goalId || null;

  const activeDayKey = state?.appTime?.activeDayKey || state?.today?.date || nowDayKey();
  const nowISO = state?.appTime?.nowISO || `${activeDayKey}T12:00:00.000Z`;
  const scopedEvents = getCanonicalExecutionEventsForCycleGoal(state, cycleId, goalId);
  const materialized = materializeBlocksFromEvents(scopedEvents, { todayISO: state.today?.date });
  const blocks = Array.from(materialized?.blocksById?.values?.() || []).filter(Boolean);
  const supportBlocks = getPreExecutionSupportBlocksForCycleGoal({
    state,
    cycle,
    cycleId,
    goalId,
    executionBlocks: blocks,
  });

  const integrity = computeCycleIntegrityScore({
    cycleId,
    nowISO,
    blocks,
  });

  const canonicalFeasibility = deriveCanonicalFeasibilityScore(state, cycle, goalId);
  const feasibilityScore = Number.isFinite(canonicalFeasibility.feasibilityScore)
    ? Number(canonicalFeasibility.feasibilityScore)
    : null;
  const generationSource = String(cycle?.planGenerationSource || '')
    .trim()
    .toUpperCase();
  const planStatus = String(cycle?.planStatus || '')
    .trim()
    .toLowerCase();
  const hasLLMActionGraph = Boolean(cycle?.llmActionGraph);
  const isLlmPath = generationSource === 'LLM' || planStatus === 'generating' || hasLLMActionGraph;
  const maxBlocksPerDay = Number(state?.constraints?.maxBlocksPerDay);
  const strategyMaxBlocksPerDay = Number(cycle?.strategy?.constraints?.maxBlocksPerDay);
  const capacityPerDay =
    Number.isFinite(maxBlocksPerDay) && maxBlocksPerDay > 0
      ? maxBlocksPerDay
      : Number.isFinite(strategyMaxBlocksPerDay) && strategyMaxBlocksPerDay > 0
        ? strategyMaxBlocksPerDay
        : 4;
  const feasibility = goalId ? state?.feasibilityByGoal?.[goalId] || null : null;
  const probability = goalId ? state?.probabilityByGoal?.[goalId] || null : null;
  const supportHorizon = derivePreExecutionSupportHorizon({
    state,
    cycle,
    canonicalContract,
    supportBlocks,
    feasibility,
    capacityPerDay,
  });
  const dynamicOutcome = deriveDynamicOutcomeAggregate({
    blocks: supportBlocks,
    cycleDynamics: state?.cycleDynamicsByCycleId?.[cycleId] || cycle?.cycleDynamics || null,
    feasibility,
    feasibilityScore,
    capacityPerDay,
    supportHorizon,
  });
  const contractFailure = deriveContractFailureRegistration({
    activeDayKey,
    deadlineDayKey: canonicalContract?.endDayKey || null,
    feasibility,
    dynamicOutcome,
  });
  const recovery = deriveRecoveryAnalysis({
    state,
    cycle,
    canonicalContract,
    dynamicOutcome,
    feasibility,
    blocks: supportBlocks,
    capacityPerDay,
    contractFailure,
  });

  const metrics = {
    ...(cycle.metrics || {}),
    integrityScore: integrity.integrityScore,
    integrityMinutesTotal: integrity.minutesTotal,
    integrityMinutesCounted: integrity.minutesCounted,
    feasibilityScore,
    posScore: null,
    posTrustState: null,
    posUnavailableReasonCode: canonicalFeasibility.reasonCode || null,
    dynamicOutcome,
    requiredWeeklyThroughput: dynamicOutcome.requiredWeeklyThroughput,
    workableDaysRemaining: dynamicOutcome.workableDaysRemaining,
    actualAvgPerWeek: dynamicOutcome.actualAvgPerWeek,
    supportHorizon,
    trajectory: dynamicOutcome.trajectory,
    contractFailureState: contractFailure.state,
    contractFailureReasons: contractFailure.reasons,
    contractRenegotiationRequired: contractFailure.renegotiationRequired,
    contractFailureDetails: contractFailure.details,
    recoveryState: recovery.recoveryState,
    recoveryReasons: recovery.recoveryReasons,
    recoveryMetrics: recovery.recoveryMetrics,
    renegotiationRequired: recovery.renegotiationRequired,
    renegotiationOptions: recovery.renegotiationOptions,
    posInputs: {
      goalIdUsed: goalId,
      ...canonicalFeasibility.diagnostics,
      dynamicOutcome,
      supportHorizon,
    },
  };
  const planQualityGate = resolvePlanQualityGateForGoal(state, goalId);
  if (planQualityGate?.status === 'PLAN_QUALITY_WITHHELD') {
    metrics.posUnavailableReasonCode = 'POS_NOT_ADMITTED_PLAN_QUALITY_WITHHELD';
  }

  const feasibilityStatus = goalId ? state?.feasibilityByGoal?.[goalId]?.status || null : null;
  if (feasibilityStatus === 'INFEASIBLE' && Boolean(canonicalFeasibility?.diagnostics?.hasThroughputModel)) {
    metrics.posScore = 0;
    metrics.feasibilityScore = 0;
    metrics.posUnavailableReasonCode = null;
  }

  if (Number.isFinite(feasibilityScore)) {
    const effectiveFeasibility =
      Number.isFinite(dynamicOutcome?.adjustedFeasibilityScore) && dynamicOutcome.adjustedFeasibilityScore !== null
        ? Number(dynamicOutcome.adjustedFeasibilityScore)
        : feasibilityScore;
    const pos = computeCyclePOS({
      cycleId,
      nowISO,
      feasibilityScore: effectiveFeasibility,
      blocks,
    });
    metrics.posScore = pos.pos;
    metrics.feasibilityScore = pos.feasibility;
    metrics.integrityScore = pos.integrity;
  } else if (
    cycle?.planPreview &&
    !isLlmPath &&
    (!state?.lastPlanError?.code || state?.lastPlanError?.code === 'FEASIBILITY_MISSING_FOR_PLAN')
  ) {
    const reasonCodes = [];
    if (canonicalFeasibility.reasonCode) {
      reasonCodes.push(canonicalFeasibility.reasonCode);
    }
    state.lastPlanError = {
      ...(state.lastPlanError || {}),
      code: 'FEASIBILITY_MISSING_FOR_PLAN',
      reason: 'Plan preview exists but feasibility confidence is unavailable.',
      cycleId,
      reasonCodes,
    };
  }

  const probabilityValue = Number(probability?.value);
  metrics.posTrustState = probability?.trustState || null;
  metrics.posQualifier = probability?.qualifier || null;
  const hasNoExecutionEvidence = Number(integrity?.minutesCounted || 0) <= 0;
  if (
    hasNoExecutionEvidence &&
    Number.isFinite(probabilityValue) &&
    probabilityValue > 0 &&
    String(feasibility?.status || '').toUpperCase() !== 'INFEASIBLE'
  ) {
    metrics.posScore = clampUnitScore(probabilityValue);
    if (!Number.isFinite(metrics.feasibilityScore) || Number(metrics.feasibilityScore) <= 0) {
      metrics.feasibilityScore = clampUnitScore(probabilityValue);
    }
    metrics.posUnavailableReasonCode = null;
    metrics.posInputs = {
      ...(metrics.posInputs || {}),
      seededFromInitialForecast: true,
    };
  }

  const outcomeAggNow = aggregateCycleOutcomes({
    cycleId,
    nowISO,
    blocks,
  });

  const previousSnapshot = cycle.metrics?.posSnapshot || null;
  const conflictCodes = new Set();
  if (state?.lastPlanError?.code) {
    conflictCodes.add(String(state.lastPlanError.code).trim().toUpperCase());
  }
  if (Array.isArray(state?.lastPlanError?.reasonCodes)) {
    state.lastPlanError.reasonCodes.forEach((code) => {
      const normalized = String(code || '')
        .trim()
        .toUpperCase();
      if (normalized) {
        conflictCodes.add(normalized);
      }
    });
  }
  if (metrics.posUnavailableReasonCode) {
    conflictCodes.add(String(metrics.posUnavailableReasonCode).trim().toUpperCase());
  }
  const conflictsNow = Array.from(conflictCodes).sort((a, b) => a.localeCompare(b));

  const explanation = buildPosExplanation({
    cycleId,
    nowISO,
    posPrev: previousSnapshot?.posScore ?? null,
    posNow: metrics.posScore,
    feasibilityPrev: previousSnapshot?.feasibilityScore ?? null,
    feasibilityNow: metrics.feasibilityScore,
    integrityPrev: previousSnapshot?.integrityScore ?? null,
    integrityNow: metrics.integrityScore,
    conflictsNow,
    outcomeAggPrev: previousSnapshot?.outcomeAgg || null,
    outcomeAggNow,
  });
  const dynamicReasons = buildDynamicPosReasons(dynamicOutcome);
  metrics.posExplanation = {
    ...explanation,
    reasons: [...(explanation?.reasons || []), ...dynamicReasons].slice(0, 3),
  };

  if (Number.isFinite(metrics.posScore)) {
    metrics.posSnapshotAtISO = nowISO;
    metrics.posSnapshot = {
      feasibilityScore: metrics.feasibilityScore,
      integrityScore: metrics.integrityScore,
      posScore: metrics.posScore,
      outcomeAgg: outcomeAggNow,
      dynamicOutcome: {
        requiredWeeklyThroughput: dynamicOutcome.requiredWeeklyThroughput,
        trajectory: dynamicOutcome.trajectory,
      },
      contractFailure: {
        state: contractFailure.state,
        renegotiationRequired: contractFailure.renegotiationRequired,
      },
      recovery: {
        state: recovery.recoveryState,
        renegotiationRequired: recovery.renegotiationRequired,
      },
    };
  }

  cycle.metrics = metrics;
  cycle.contractFailure = {
    state: contractFailure.state,
    reasons: contractFailure.reasons,
    renegotiationRequired: contractFailure.renegotiationRequired,
    details: contractFailure.details,
    updatedAtISO: nowISO,
  };
  cycle.recoveryContract = {
    state: recovery.recoveryState,
    reasons: recovery.recoveryReasons,
    metrics: recovery.recoveryMetrics,
    renegotiationRequired: recovery.renegotiationRequired,
    options: recovery.renegotiationOptions,
    updatedAtISO: nowISO,
  };
  state.cyclesById[cycleId] = cycle;
}

function applyCycleDynamics(state) {
  const cycleId = state?.activeCycleId || null;
  if (!cycleId) {
    return;
  }
  const cycle = state?.cyclesById?.[cycleId];
  if (!cycle) {
    return;
  }
  const canonicalContract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
  const goalId = canonicalContract?.goalId || null;
  const nowISO =
    state?.appTime?.nowISO || `${state?.appTime?.activeDayKey || state?.today?.date || nowDayKey()}T12:00:00.000Z`;
  const scopedEvents = getCanonicalExecutionEventsForCycleGoal(state, cycleId, goalId);
  const materialized = materializeBlocksFromEvents(scopedEvents, { todayISO: state.today?.date });
  const scopedBlocks = Array.from(materialized?.blocksById?.values?.() || []).filter(Boolean);
  const profile = deriveCycleDynamicsProfile({
    cycleId,
    goalId,
    blocks: scopedBlocks,
    nowISO,
  });
  state.cycleDynamicsByCycleId = state.cycleDynamicsByCycleId || {};
  state.cycleDynamicsByCycleId[cycleId] = profile;
  cycle.cycleDynamics = profile;
  enforceCycleDynamicsTransitions(state, {
    cycleId,
    goalId,
    nowISO,
    blocks: scopedBlocks,
    profile,
  });
  state.cyclesById[cycleId] = cycle;
}

function getCanonicalExecutionEventsForCycleGoal(state, cycleId, goalId) {
  const cycleEvents =
    cycleId && Array.isArray(state?.cyclesById?.[cycleId]?.executionEvents)
      ? state.cyclesById[cycleId].executionEvents
      : [];
  const stateEvents = Array.isArray(state?.executionEvents) ? state.executionEvents : [];
  const events = [];
  const seenEventIds = new Set();
  [...cycleEvents, ...stateEvents].forEach((event) => {
    if (!event) {
      return;
    }
    const eventId = String(event?.id || '').trim();
    const dedupeKey = eventId || `${event?.kind || 'event'}:${event?.blockId || 'no-block'}:${event?.dateISO || ''}`;
    if (seenEventIds.has(dedupeKey)) {
      return;
    }
    seenEventIds.add(dedupeKey);
    events.push(event);
  });
  return events.filter((event) => {
    if (!event) {
      return false;
    }
    const eventCycleId = event?.cycleId || cycleId;
    if (eventCycleId !== cycleId) {
      return false;
    }
    if (!goalId) {
      return true;
    }
    if (event?.goalId && event.goalId !== goalId) {
      return false;
    }
    return true;
  });
}

function getCanonicalExternalEvidenceEventsForCycleGoal(state, cycleId, goalId) {
  const cycleEvents =
    cycleId && Array.isArray(state?.cyclesById?.[cycleId]?.externalEvidenceEvents)
      ? state.cyclesById[cycleId].externalEvidenceEvents
      : [];
  const stateEvents = Array.isArray(state?.externalEvidenceEvents) ? state.externalEvidenceEvents : [];
  const events = [];
  const seenEventIds = new Set();
  [...cycleEvents, ...stateEvents].forEach((event) => {
    if (!event) {
      return;
    }
    const eventId = String(event?.id || '').trim();
    const dedupeKey =
      eventId || `${event?.kind || 'external'}:${event?.evidenceType || 'unknown'}:${event?.goalId || 'no-goal'}:${event?.dateISO || ''}`;
    if (seenEventIds.has(dedupeKey)) {
      return;
    }
    seenEventIds.add(dedupeKey);
    events.push(event);
  });
  return events.filter((event) => {
    if (!event) {
      return false;
    }
    const eventCycleId = event?.cycleId || cycleId;
    if (cycleId && eventCycleId && eventCycleId !== cycleId) {
      return false;
    }
    if (goalId && event?.goalId && event.goalId !== goalId) {
      return false;
    }
    return true;
  });
}

function enforceCycleDynamicsTransitions(state, { cycleId, goalId, nowISO, blocks, profile }) {
  const patch = buildCycleDynamicsTransitionPatch({
    cycleId,
    goalId,
    blocks,
    recommendedTransitions: profile?.recommendedTransitions || [],
  });
  if (!patch.length) {
    return;
  }

  const blockById = new Map((Array.isArray(blocks) ? blocks : []).map((block) => [block?.id, block]));
  const latestEventByBlockId = new Map();
  (state.executionEvents || []).forEach((event) => {
    if (!event?.blockId) {
      return;
    }
    latestEventByBlockId.set(event.blockId, event);
  });
  let didAppend = false;
  patch.forEach((transition) => {
    const block = blockById.get(transition.blockId);
    if (!block) {
      return;
    }
    const toStatus = transition.toStatus;
    const fromStatus = String(block?.status || '')
      .trim()
      .toLowerCase();
    const latestEvent = latestEventByBlockId.get(transition.blockId);
    const latestEventStatus = String(latestEvent?.status || '')
      .trim()
      .toLowerCase();
    if (!toStatus || fromStatus === toStatus) {
      return;
    }
    if (latestEventStatus === toStatus) {
      return;
    }
    if (block?.cycleId && block.cycleId !== cycleId) {
      return;
    }
    if (goalId && block?.goalId && block.goalId && block.goalId !== goalId) {
      return;
    }

    const event = {
      id: nextDeterministicId(state, `evt-dynamics-${transition.blockId}`),
      blockId: transition.blockId,
      minutes: Number.isFinite(Number(block?.durationMinutes)) ? Number(block.durationMinutes) : 0,
      rawLabel: String(block?.label || 'Block'),
      canonicalTitle: String(block?.title || block?.label || 'Block'),
      domain: block?.domain || block?.practice || 'Focus',
      cycleId: cycleId,
      goalId: goalId || block?.goalId || null,
      origin: block?.origin || 'manual',
      completed: false,
      kind: 'update',
      status: toStatus,
      missedAtISO: toStatus === 'missed' ? nowISO : block?.missedAtISO || null,
      reason: transition.reasonCode,
      linkageStatus: block?.deliverableId || block?.criterionId ? 'LINKED' : 'UNLINKED_ACTIVITY',
    };
    if (!canEmitExecutionEvent(state.executionEvents || [], event)) {
      return;
    }
    appendExecutionEvent(state, event);
    latestEventByBlockId.set(transition.blockId, event);
    didAppend = true;
  });

  if (!didAppend) {
    return;
  }
  const rematerialized = materializeBlocksFromEvents(state.executionEvents || [], { todayISO: state.today?.date });
  state.today.blocks = rematerialized.todayBlocks || [];
  state.cycle = rematerialized.days || [];
}

function applyProgressCredit(state) {
  const { days } = materializeBlocksFromEvents(state.executionEvents || [], { todayISO: state.today?.date });
  const allBlocks = (days || []).flatMap((d) => d.blocks || []);
  const progressByGoal = {};
  allBlocks.forEach((block) => {
    if (!block?.goalId) {
      return;
    }
    if (block.status !== 'completed' && block.status !== 'complete') {
      return;
    }
    const goalId = block.goalId;
    const admission = state.goalAdmissionByGoal?.[goalId];
    const isAdmittedGoal = !admission || isAdmittedGoalStatus(admission.status);
    const duration = Number(block.durationMinutes) || estimateBlockMinutes(block);
    if (!progressByGoal[goalId]) {
      progressByGoal[goalId] = {
        creditedUnits: 0,
        activityUnits: 0,
        completedUnitsTotal: 0,
      };
    }
    const entry = progressByGoal[goalId];
    entry.completedUnitsTotal += duration;
    if (isAdmittedGoal && block.deliverableId && block.criterionId) {
      entry.creditedUnits += duration;
    } else {
      entry.activityUnits += duration;
    }
  });
  state.progressCreditByGoal = progressByGoal;
}

function estimateBlockMinutes(block) {
  if (!block?.start || !block?.end) {
    return 0;
  }
  const start = new Date(block.start).getTime();
  const end = new Date(block.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  return Math.max(0, Math.round((end - start) / 60000));
}

function resolveGoalDeadline(goalId, state) {
  if (!state?.activeCycleId || !state?.cyclesById?.[state.activeCycleId]) {
    return null;
  }
  const active = state.cyclesById[state.activeCycleId];
  const canonicalContract = getCanonicalCycleContract(active, state.goalExecutionContract, active?.contract || null);
  const canonicalGoalId = canonicalContract?.goalId || active?.goalGovernanceContract?.goalId || null;
  if (!canonicalGoalId || canonicalGoalId !== goalId) {
    return null;
  }
  return (
    canonicalContract?.endDayKey || active?.goalContract?.endDayKey || active?.definiteGoal?.deadlineDayKey || null
  );
}

function applyGoalDirective(state) {
  const nowISO = nowDayKey();
  const contracts = collectGovernanceContracts(state);
  const goalContexts = buildGoalContexts(state);
  const history = state.suggestionHistory || {
    dayKey: nowISO,
    count: 0,
    lastSuggestedAtISO: null,
    lastSuggestedAtISOByGoal: {},
    dailyCountByGoal: {},
    denials: [],
  };
  const activeBlocksCount = (state.today?.blocks || []).filter((b) => b.status !== 'completed').length;
  const executionEventCount = (state.executionEvents || []).length;
  const eligibilityByGoal = {};
  const candidates = [];

  goalContexts.forEach((ctx) => {
    const resolution = resolveActiveContract(ctx.goalId, contracts, nowISO);
    if (!resolution.contract) {
      eligibilityByGoal[ctx.goalId] = { allowed: false, reasons: [resolution.reasonCode], contractId: null };
      return;
    }
    const directive = computeGoalDirective(ctx.goalText, ctx.deadlineISO, ctx.blocks, [], nowISO);
    if (!directive) {
      eligibilityByGoal[ctx.goalId] = {
        allowed: false,
        reasons: ['no_directive'],
        contractId: resolution.contract.contractId,
      };
      return;
    }
    const lastSuggestedAtISO = history.lastSuggestedAtISOByGoal?.[ctx.goalId] || null;
    const dailyCount = history.dailyCountByGoal?.[ctx.goalId]?.[nowISO] || 0;
    const gate = authorizeSuggestion(resolution.contract, {
      nowISO,
      nowTimestampISO: new Date().toISOString(),
      executionEventCount,
      activeBlocksCount,
      lastSuggestedAtISO,
      suggestionsTodayCount: dailyCount,
      directiveTags: [directive.type],
      directiveDomain: directive.domain,
    });
    eligibilityByGoal[ctx.goalId] = {
      allowed: gate.allowed,
      reasons: gate.reasons,
      contractId: resolution.contract.contractId,
    };
    if (gate.allowed) {
      candidates.push({ goalId: ctx.goalId, directive: { ...directive, goalId: ctx.goalId } });
    }
  });

  state.directiveEligibilityByGoal = eligibilityByGoal;
  if (!candidates.length) {
    state.goalDirective = null;
    return;
  }

  candidates.sort((a, b) => {
    if (a.directive.type !== b.directive.type) {
      return a.directive.type === 'execute' ? -1 : 1;
    }
    const aStart = a.directive.startISO || '';
    const bStart = b.directive.startISO || '';
    if (aStart !== bStart) {
      return aStart.localeCompare(bStart);
    }
    return a.goalId.localeCompare(b.goalId);
  });
  state.goalDirective = candidates[0].directive;
}

function buildGoalContexts(state) {
  const contexts = [];
  const active = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] : null;
  if (!active) {
    return contexts;
  }
  const goalId = active?.goalGovernanceContract?.goalId;
  if (!goalId) {
    return contexts;
  }
  const goalText = active?.definiteGoal?.outcome || '';
  const deadlineISO = active?.definiteGoal?.deadlineDayKey || '';
  contexts.push({
    goalId,
    goalText,
    deadlineISO,
    blocks: state.today?.blocks || [],
  });
  return contexts;
}

function computeBaseSuggestion(state, blocks, vector) {
  // 1) Resume an in-progress block
  const inProgress = blocks.find((b) => b.status === 'in_progress');
  if (inProgress) {
    return {
      type: 'resume',
      blockId: inProgress.id,
      practice: inProgress.practice,
      startISO: inProgress.start,
      endISO: inProgress.end,
      reason: 'You already started this block; finish it before switching.',
    };
  }

  const practiceWeights = (state.today?.practices || []).map((p) => {
    const weight = p.load === 'light' ? 1 : p.load === 'moderate' ? 2 : 3;
    return { name: p.name, weight };
  });
  const underweight = practiceWeights.sort((a, b) => a.weight - b.weight)[0];

  const primaryId = state.today?.primaryObjectiveId;
  let candidate = blocks.find((b) => b.status === 'planned' && primaryId && b.id === primaryId);
  if (!candidate) {
    const planned = blocks.filter((b) => b.status === 'planned');
    if (underweight) {
      candidate = planned.find((b) => b.practice === underweight.name) || planned[0];
    } else {
      candidate = planned[0];
    }
  }
  if (candidate) {
    return {
      type: 'start_planned',
      blockId: candidate.id,
      practice: candidate.practice,
      startISO: candidate.start,
      endISO: candidate.end,
      reason:
        vector?.driftLabel === 'off-track' || vector?.driftLabel === 'elevated'
          ? vector?.driftHint || 'This block helps rebalance your pattern.'
          : 'This is the next scheduled block for today.',
    };
  }

  const practiceName = underweight?.name || 'Creation';
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(Math.floor(start.getMinutes() / 30) * 30, 0, 0);
  const durationMinutes = 30;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return {
    type: 'repair',
    practice: practiceName,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    reason: 'No more scheduled work. This repair block pushes your lowest practice back toward pattern.',
  };
}

function updateBlockStatus(state, id, status) {
  const updateBlocks = (blocks = []) => blocks.map((b) => (b.id === id ? { ...b, status } : b));
  state.today.blocks = updateBlocks(state.today.blocks);
  state.currentWeek.days = state.currentWeek.days.map((d) => ({ ...d, blocks: updateBlocks(d.blocks) }));
  state.cycle = state.cycle.map((d) => ({ ...d, blocks: updateBlocks(d.blocks) }));
  if (state.blockStore?.blocks && Object.prototype.hasOwnProperty.call(state.blockStore.blocks, id)) {
    state.blockStore.blocks[id] = {
      ...state.blockStore.blocks[id],
      status,
    };
  }
}

function rescheduleBlock(state, id, start, end) {
  const existing = findBlockById(state, id);
  if (!existing) {
    return;
  }
  const event = buildExecutionEventFromBlock(existing, {
    kind: 'reschedule',
    completed: false,
    startISO: start,
    endISO: end,
  });
  if (!canEmitExecutionEvent(state.executionEvents || [], event)) {
    return;
  }
  const updateBlocks = (blocks = []) => blocks.map((b) => (b.id === id ? { ...b, start, end } : b));
  state.today.blocks = updateBlocks(state.today.blocks);
  state.currentWeek.days = state.currentWeek.days.map((d) => ({ ...d, blocks: updateBlocks(d.blocks) }));
  state.cycle = state.cycle.map((d) => ({ ...d, blocks: updateBlocks(d.blocks) }));
  if (state.blockStore?.blocks && Object.prototype.hasOwnProperty.call(state.blockStore.blocks, id)) {
    state.blockStore.blocks[id] = {
      ...state.blockStore.blocks[id],
      start,
      end,
    };
  }
  appendExecutionEvent(state, event);
}

function recomputeSummaries(state) {
  buildTodayFromPattern(state);
  const viewDate = state.viewDate || state.today?.date || nowDayKey();
  const cycle = buildMonthCycle(state, viewDate);
  const targetMap = targetMinutesMap(getPatternConfig(state));

  const recomputedCycle = cycle.map((day) => summarizeDay(day, targetMap, state));
  const today = recomputedCycle.find((d) => d.date === viewDate) || recomputedCycle[0];
  const currentWeek = buildWeekFromCycle(recomputedCycle, viewDate);

  state.cycle = recomputedCycle;
  state.today = today;
  state.currentWeek = currentWeek;
  computeWeekSummary(state, targetMap);
  state.today.summaryLine = buildDaySummary(state.today, state.vector, state.lenses);
  state.cycle = state.cycle.map((day) => ({
    ...day,
    summaryLine: buildDaySummary(day, state.vector, state.lenses),
  }));
  return state;
}

function buildWeekFromCycle(cycle, date) {
  const weekStartDate = normalizeWeekStart(date || new Date().toISOString());
  const weekStart = dayKeyFromDate(weekStartDate, 'UTC');
  const cycleMap = new Map((Array.isArray(cycle) ? cycle : []).map((day) => [day?.date, day]));
  const days = Array.from({ length: 7 }, (_, idx) => {
    const dayKey = addDays(weekStart, idx, 'UTC');
    const existing = cycleMap.get(dayKey);
    const day = existing || {
      date: dayKey,
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    };
    return { ...day, label: day.label || day.date || `Day ${idx + 1}` };
  });
  return { weekStart, days };
}

export function buildMonthCycle(state, dateString) {
  const base = dateString ? new Date(`${dateString}T12:00:00.000Z`) : new Date();
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const totalDays = new Date(Date.UTC(year, month + 1, 0)).getDate();
  const existingMap = new Map((Array.isArray(state.cycle) ? state.cycle : []).map((d) => [d.date, d]));
  const days = [];
  for (let i = 1; i <= totalDays; i++) {
    const iso = dayKeyFromParts(year, month, i);
    const existing = existingMap.get(iso);
    if (existing) {
      days.push(existing);
    } else {
      days.push({
        date: iso,
        blocks: [],
        completionRate: 0,
        driftSignal: 'contained',
        loadByPractice: {},
        practices: [],
      });
    }
  }
  return days;
}

function summarizeDay(day, targetMap, state) {
  const blocks = day.blocks || [];
  const completedBlocks = blocks.filter((b) => b.status === 'completed' || b.status === 'complete');

  const loadByPractice = {};
  const completedLoad = {};
  let plannedMinutes = 0;
  let completedMinutes = 0;
  blocks.forEach((b) => {
    const minutes = durationMinutes(b.start, b.end);
    plannedMinutes += minutes;
    loadByPractice[b.practice] = (loadByPractice[b.practice] || 0) + minutes;
    if (completedBlocks.includes(b)) {
      completedLoad[b.practice] = (completedLoad[b.practice] || 0) + minutes;
      completedMinutes += minutes;
    }
  });
  const completionRate = plannedMinutes > 0 ? completedMinutes / plannedMinutes : 0;

  const dominantEntry = Object.entries(completedLoad).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0];
  const dominantPractice = dominantEntry ? dominantEntry[0] : 'balanced';

  const ratios = {};
  const practices = new Set([...Object.keys(targetMap), ...Object.keys(completedLoad)]);
  practices.forEach((p) => {
    const planned = targetMap[p] || state.lenses?.pattern?.defaultMinutes || 0;
    const actual = completedLoad[p] || 0;
    ratios[p] = planned ? actual / planned : 0;
  });
  const driftLabel =
    completionRate < 0.6
      ? 'off-track'
      : Object.values(ratios).some((r) => r > 1.5 || r < 0.5)
        ? 'elevated'
        : 'contained';
  const driftSignal = driftLabel === 'contained' ? 'contained' : 'elevated';

  const totalMinutes = Object.values(loadByPractice).reduce((sum, v) => sum + (v || 0), 0);
  const targetTotal = Object.values(targetMap).reduce((sum, v) => sum + (v || 0), 0);
  const overloadLabel = targetTotal && totalMinutes > targetTotal * 1.3 ? 'overload' : 'normal';
  const streakState = completionRate === 1 ? 'hit' : completionRate === 0 ? 'miss' : 'partial';
  const integrityStatus = completionRate >= 0.7 ? 'acceptable' : completionRate >= 0.4 ? 'degrading' : 'low';

  updateTemplatesFromDay(state, day, completedBlocks);

  return {
    ...day,
    completionRate,
    plannedMinutes,
    completedMinutes,
    integrityStatus,
    loadByPractice,
    driftSignal,
    dominantPractice,
    driftLabel,
    overloadLabel,
    streakState,
  };
}

function recalculateIdentityVector(state) {
  const recent = state.cycle.slice(-7);
  const avgCompletion = recent.reduce((sum, d) => sum + (d.completionRate || 0), 0) / Math.max(1, recent.length);
  const stability = avgCompletion > 0.7 ? 'steady' : 'shifting';
  const targetMap = targetMinutesMap(getPatternConfig(state));
  const ratios = {};
  recent.forEach((day) => {
    const completed = (day.blocks || []).filter((b) => b.status === 'completed' || b.status === 'complete');
    const completedLoad = {};
    completed.forEach((b) => {
      completedLoad[b.practice] = (completedLoad[b.practice] || 0) + durationMinutes(b.start, b.end);
    });
    const practices = new Set([...Object.keys(targetMap), ...Object.keys(completedLoad)]);
    practices.forEach((p) => {
      const planned = targetMap[p] || state.lenses?.pattern?.defaultMinutes || 0;
      const actual = completedLoad[p] || 0;
      const ratio = planned ? actual / planned : 0;
      ratios[p] = ratio;
    });
  });
  const ratioValues = Object.values(ratios);
  const driftLabel =
    avgCompletion < 0.6 ? 'off-track' : ratioValues.some((r) => r > 1.5 || r < 0.5) ? 'elevated' : 'contained';
  const momentum = avgCompletion > 0.85 ? 'building' : avgCompletion > 0.6 ? 'active' : 'quiet';
  const todayDate = state.today?.date || nowDayKey();
  if (state.meta?.lastActiveDate) {
    const gap = daysBetween(state.meta.lastActiveDate, todayDate);
    if (gap > 7) {
      state.meta.momentumNote = `Last active ${gap} days ago.`;
      state.meta.lastActiveDate = todayDate;
      return {
        ...state.vector,
        stability,
        drift: driftLabel,
        driftDetail: { byPractice: ratios },
        driftLabel,
        driftHint: buildDriftHint({ byPractice: ratios }),
        momentum: 'quiet',
      };
    }
  }
  if (state.meta) {
    state.meta.lastActiveDate = todayDate;
  }

  return {
    ...state.vector,
    stability,
    drift: driftLabel,
    driftDetail: { byPractice: ratios },
    driftLabel,
    driftHint: buildDriftHint({ byPractice: ratios }),
    momentum,
  };
}

function durationMinutes(start, end) {
  if (!start || !end) {
    return 0;
  }
  if (start.includes('T') || end.includes('T')) {
    const s = new Date(start);
    const e = new Date(end);
    return Math.max(0, (e.getTime() - s.getTime()) / 60000);
  }
  const [sh, sm] = (start || '00:00').split(':').map(Number);
  const [eh, em] = (end || '00:00').split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function buildTodayFromPattern(state) {
  if (!state.today) {
    state.today = { date: nowDayKey(), blocks: [] };
  }
  const pattern = getPatternConfig(state);
  const targets = pattern.dailyTargets || [];
  const templateKey = state.today?.blocks?.[0]?.linkedAimId || state.today?.objectiveId || 'default';
  state.today.objectiveId = templateKey;
  const template = state.templates?.objectives?.[templateKey];
  const templateTargets = template
    ? Object.entries(template.minutesByPractice || {}).map(([name, minutes]) => ({ name, minutes }))
    : targets;
  const practiceTargets = templateTargets.length ? templateTargets : targets;

  state.today.practices = practiceTargets.map((t) => {
    const load = t.minutes <= 30 ? 'light' : t.minutes <= 90 ? 'moderate' : 'heavy';
    return { name: t.name, load, trend: 'holding' };
  });

  if (!state.today.blocks || state.today.blocks.length === 0) {
    const baseDate = state.today.date || nowDayKey();
    const preferredSlot = template?.preferredSlot || 'morning';
    const slotStart = preferredSlot === 'evening' ? 18 * 60 : preferredSlot === 'afternoon' ? 13 * 60 : 8 * 60;
    let cursorMinutes = slotStart;
    state.today.blocks = practiceTargets.map((t, idx) => {
      const startMin = cursorMinutes;
      const endMin = startMin + Math.max(30, t.minutes || state.lenses?.pattern?.defaultMinutes || 30);
      cursorMinutes = endMin + 20;
      return {
        id: `gen-${idx}`,
        practice: t.name,
        label: `${t.name} block`,
        start: `${baseDate}T${toTimeLabel(startMin)}`,
        end: `${baseDate}T${toTimeLabel(endMin)}`,
        status: 'planned',
        linkedAimId: templateKey,
        objectiveId: templateKey,
      };
    });
  }
  applyRecurringPatterns(state);
}

function computeWeekSummary(state, targetMap = {}) {
  const days = state.currentWeek?.days || [];
  const allBlocks = days.flatMap((d) => d.blocks || []);
  const completed = allBlocks.filter((b) => b.status === 'completed' || b.status === 'complete');
  const completionRate = allBlocks.length ? completed.length / allBlocks.length : 0;
  const loadByPractice = {};
  const completedLoad = {};
  allBlocks.forEach((b) => {
    const minutes = durationMinutes(b.start, b.end);
    loadByPractice[b.practice] = (loadByPractice[b.practice] || 0) + minutes;
    if (b.status === 'completed' || b.status === 'complete') {
      completedLoad[b.practice] = (completedLoad[b.practice] || 0) + minutes;
    }
  });

  const ratios = {};
  const practices = new Set([...Object.keys(targetMap), ...Object.keys(completedLoad)]);
  practices.forEach((p) => {
    const planned = (targetMap[p] || state.lenses?.pattern?.defaultMinutes || 0) * Math.max(1, days.length);
    const actual = completedLoad[p] || 0;
    ratios[p] = planned ? actual / planned : 0;
  });
  const dominantEntry = Object.entries(completedLoad).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0];
  const dominantPractice = dominantEntry ? dominantEntry[0] : 'balanced';
  const driftLabel =
    completionRate < 0.6
      ? 'off-track'
      : Object.values(ratios).some((r) => r > 1.5 || r < 0.5)
        ? 'elevated'
        : 'contained';
  const driftSignal = driftLabel === 'contained' ? 'contained' : 'elevated';

  state.currentWeek.metrics = { completionRate, loadByPractice, driftSignal, dominantPractice, driftLabel };
  state.currentWeek.summaryLine = buildWeekSummary(state.currentWeek);
}

function buildDaySummary(day, vector, lenses) {
  if (!day?.blocks || !day.blocks.length) {
    return 'No work logged yet. Pattern and vector are waiting on action.';
  }
  const dominant = day.dominantPractice || 'balanced';
  const completion = Math.round((day.completionRate || 0) * 100);
  const drift = day.driftLabel || vector?.drift || vector?.driftLabel || 'contained';
  return `${dominant}-heavy, ${completion}% completion, drift ${drift}.`;
}

function buildWeekSummary(week) {
  const completion = Math.round((week.metrics?.completionRate || 0) * 100);
  const dominant = week.metrics?.dominantPractice || 'balanced';
  const drift = week.metrics?.driftLabel || 'contained';
  return `${completion}% completion, ${dominant}-heavy, drift ${drift}.`;
}

function buildDriftHint(driftDetail = {}) {
  const ratios = driftDetail.byPractice || {};
  const entries = Object.entries(ratios);
  if (!entries.length) {
    return '';
  }
  const nearBalanced = entries.every(([, r]) => r > 0.9 && r < 1.1);
  if (nearBalanced) {
    return '';
  }
  const high = entries.filter(([, r]) => r > 1.2);
  const low = entries.filter(([, r]) => r < 0.8);
  if (high.length && low.length) {
    return `Load skewed toward ${high[0][0]}; ${low[0][0]} under target.`;
  }
  if (low.length === entries.length) {
    return 'Completion below pattern across all practices.';
  }
  if (high.length) {
    return `Load concentrated in ${high[0][0]}.`;
  }
  if (low.length) {
    return `${low[0][0]} running light versus pattern.`;
  }
  return '';
}

function findLowPractices(ratios = {}) {
  return Object.entries(ratios)
    .filter(([, r]) => r < 0.8)
    .sort((a, b) => a[1] - b[1])
    .map(([p]) => p);
}

export function getAllBlocks(state) {
  const union = [];
  const divergeWarned = new Set();
  const scheduleStatuses = new Set(['planned', 'in_progress']);
  const executionOutcomeStatuses = new Set(['completed', 'complete', 'missed', 'skipped']);
  const normalizeStatus = (value) =>
    String(value || '')
      .trim()
      .toLowerCase();
  const isScheduleStatus = (value) => scheduleStatuses.has(normalizeStatus(value));
  const isExecutionOutcomeStatus = (value) => executionOutcomeStatuses.has(normalizeStatus(value));
  const mergeBlockStatus = (existing, incoming) => {
    const existingStatus = normalizeStatus(existing?.status);
    const incomingStatus = normalizeStatus(incoming?.status);
    if (!incomingStatus || existingStatus === incomingStatus) {
      return existing;
    }
    if (isScheduleStatus(existingStatus) && isExecutionOutcomeStatus(incomingStatus)) {
      existing.status = incoming.status;
      if ('missedAtISO' in incoming) {
        existing.missedAtISO = incoming.missedAtISO;
      }
      return existing;
    }
    if (isExecutionOutcomeStatus(existingStatus) && isScheduleStatus(incomingStatus)) {
      return existing;
    }
    return null;
  };
  const add = (blocks = [], source = 'unknown') => {
    blocks.forEach((b) => {
      if (!b || !b.id) {
        return;
      }
      const existing = union.find((u) => u.id === b.id);
      if (existing) {
        const merged = mergeBlockStatus(existing, b);
        if (!merged) {
          if (
            !IS_PRODUCTION &&
            !isRuntimeEnvFlagEnabled('JERICHO_DISABLE_GENERATE_TRACE') &&
            existing.status !== b.status &&
            !divergeWarned.has(b.id)
          ) {
            console.warn('Block status divergence detected', b.id, {
              incoming: b.status,
              existing: existing.status,
              source,
            });
            divergeWarned.add(b.id);
          }
        }
        return;
      }
      union.push(b);
    });
  };
  add(state.today?.blocks, 'today');
  (state.currentWeek?.days || []).forEach((d) => add(d.blocks, 'week'));
  (state.cycle || []).forEach((d) => add(d.blocks, 'cycle'));
  add(Object.values(state?.blockStore?.blocks || {}), 'blockStore');
  return union;
}

function normalizeWeekStart(dateString) {
  const base = new Date(dateString || new Date().toISOString());
  const weekStart = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const offset = (weekStart.getUTCDay() + 6) % 7; // Monday start
  weekStart.setUTCDate(weekStart.getUTCDate() - offset);
  return weekStart;
}

function dayKeyUTC(iso) {
  try {
    return dayKeyFromDate(new Date(iso));
  } catch {
    return null;
  }
}

export function getBlockDayKey(block) {
  if (!block) return null;
  const explicit = String(block?.date || block?.dayKey || '').trim();
  if (explicit) {
    return explicit;
  }
  return dayKeyFromISO(block?.start || block?.startISO || '', 'UTC');
}

export function projectWeekDays({ anchorDate, blocks }) {
  const start = normalizeWeekStart(anchorDate || new Date().toISOString());
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = dayKeyFromDate(d);
    days.push({
      date: key,
      label: key,
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: { Body: 0, Resources: 0, Creation: 0, Focus: 0 },
      practices: [],
    });
  }
  const targetMap = {};
  const byDate = new Map(days.map((d) => [d.date, d]));
  (blocks || []).forEach((block) => {
    const key = getBlockDayKey(block);
    const day = key && byDate.get(key);
    if (!day) {
      return;
    }
    day.blocks.push(block);
  });
  days.forEach((day) => {
    let plannedMinutes = 0;
    let completedMinutes = 0;
    const loadByPractice = { Body: 0, Resources: 0, Creation: 0, Focus: 0 };
    (day.blocks || []).forEach((b) => {
      const minutes = durationMinutes(b.start, b.end);
      plannedMinutes += minutes;
      loadByPractice[b.practice] = (loadByPractice[b.practice] || 0) + minutes;
      if (b.status === 'completed' || b.status === 'complete') {
        completedMinutes += minutes;
      }
    });
    day.plannedMinutes = plannedMinutes;
    day.completedMinutes = completedMinutes;
    const rate = plannedMinutes > 0 ? completedMinutes / plannedMinutes : 0;
    day.completionRate = Number.isFinite(rate) ? Math.max(0, Math.min(1, rate)) : 0;
    day.loadByPractice = loadByPractice;
  });
  return days;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toISODateUTC(d) {
  return dayKeyFromParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseDayKey(dayKey) {
  const key = (dayKey || '').slice(0, 10);
  const d = new Date(`${key}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : new Date();
}

function durationMinutesISO(start, end) {
  if (!start || !end) {
    return 0;
  }
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const raw = (e - s) / 60000;
  return Number.isFinite(raw) ? Math.max(0, raw) : 0;
}

function summarizeBlocksMinutes(blocks) {
  let planned = 0;
  let completed = 0;
  for (const b of blocks || []) {
    const mins = durationMinutesISO(b.start, b.end);
    planned += mins;
    if (b.status === 'completed') {
      completed += mins;
    }
  }
  planned = Number.isFinite(planned) ? planned : 0;
  completed = Number.isFinite(completed) ? completed : 0;
  const cr = planned > 0 ? completed / planned : 0;
  return {
    plannedMinutes: planned,
    completedMinutes: completed,
    completionRate: Number.isFinite(cr) ? Math.max(0, Math.min(1, cr)) : 0,
  };
}

export function projectMonthDays({ monthKey, blocks, includePadding = true }) {
  const anchor = parseDayKey(monthKey);
  const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  const monthEnd = new Date(nextMonthStart.getTime() - DAY_MS);

  let gridStart = monthStart;
  let gridEnd = monthEnd;

  if (includePadding) {
    const startDow = monthStart.getUTCDay(); // 0 Sun .. 6 Sat
    gridStart = new Date(monthStart.getTime() - startDow * DAY_MS);

    const endDow = monthEnd.getUTCDay();
    gridEnd = new Date(monthEnd.getTime() + (6 - endDow) * DAY_MS);
  }

  const byDay = new Map();
  for (const b of blocks || []) {
    const key = getBlockDayKey(b);
    if (!key) {
      continue;
    }
    const arr = byDay.get(key) || [];
    arr.push(b);
    byDay.set(key, arr);
  }

  const monthYYYYMM = toISODateUTC(monthStart).slice(0, 7);
  const days = [];
  for (let t = gridStart.getTime(); t <= gridEnd.getTime(); t += DAY_MS) {
    const date = toISODateUTC(new Date(t));
    const dayBlocks = byDay.get(date) || [];
    const summary = summarizeBlocksMinutes(dayBlocks);
    days.push({
      date,
      blocks: dayBlocks,
      ...summary,
      inMonth: date.slice(0, 7) === monthYYYYMM,
    });
  }
  return days;
}

function clamp01(x) {
  return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
}

function bandFromScore(score) {
  if (score >= 0.7) {
    return 'Strong';
  }
  if (score >= 0.4) {
    return 'Moderate';
  }
  return 'Weak';
}

function safeCR(planned, completed) {
  if (!Number.isFinite(planned) || planned <= 0) {
    return 0;
  }
  return clamp01(completed / planned);
}

function sumPracticeMinutes(days) {
  const plannedBy = Object.create(null);
  for (const d of days || []) {
    for (const b of d.blocks || []) {
      const p = b?.practice || 'Unknown';
      const mins = durationMinutesISO(b?.start, b?.end);
      plannedBy[p] = (plannedBy[p] || 0) + mins;
    }
  }
  return { plannedBy };
}

function normalizeMix(plannedBy, practices) {
  const total = practices.reduce((acc, p) => acc + (plannedBy[p] || 0), 0);
  if (!Number.isFinite(total) || total <= 0) {
    const mix = {};
    practices.forEach((p) => (mix[p] = 0));
    return { mix, total: 0 };
  }
  const mix = {};
  practices.forEach((p) => (mix[p] = (plannedBy[p] || 0) / total));
  return { mix, total };
}

function distanceL1(a, b, practices) {
  let s = 0;
  for (const p of practices) {
    s += Math.abs((a[p] || 0) - (b[p] || 0));
  }
  return s;
}

function computeStreakDays(days, threshold = 0.7) {
  const inMonthDays = (days || []).filter((d) => d.inMonth !== false);
  if (!inMonthDays.length) {
    return 0;
  }
  const sorted = [...inMonthDays].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const cr = clamp01(sorted[i].completionRate);
    if (cr >= threshold) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function computeMomentumScore(days) {
  const inMonthDays = (days || []).filter((d) => d.inMonth !== false);
  const sorted = [...inMonthDays].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 6) {
    return 0;
  }
  const last3 = sorted.slice(-3);
  const prev3 = sorted.slice(-6, -3);
  const avg = (arr) => arr.reduce((s, d) => s + clamp01(d.completionRate), 0) / arr.length;
  const delta = avg(last3) - avg(prev3); // [-1,1]
  return clamp01(0.5 + delta * 0.5);
}

export function computeStability({
  monthDays,
  practices = ['Body', 'Resources', 'Creation', 'Focus'],
  targetMix,
  integrityLowThreshold = 0.4,
}) {
  const days = monthDays || [];
  const inMonthDays = days.filter((d) => d.inMonth !== false);

  const plannedTotal = inMonthDays.reduce((s, d) => s + (Number.isFinite(d.plannedMinutes) ? d.plannedMinutes : 0), 0);
  const completedTotal = inMonthDays.reduce(
    (s, d) => s + (Number.isFinite(d.completedMinutes) ? d.completedMinutes : 0),
    0
  );
  const completionRate = safeCR(plannedTotal, completedTotal);

  let integrityStatus = 'acceptable';
  if (completionRate < integrityLowThreshold) {
    integrityStatus = 'low';
  } else if (completionRate < 0.7) {
    integrityStatus = 'degrading';
  }

  // Drift via practice mix vs target
  const { plannedBy } = sumPracticeMinutes(inMonthDays);
  const defaultTarget = {};
  practices.forEach((p) => (defaultTarget[p] = 1 / practices.length));
  const target = targetMix || defaultTarget;
  const { mix: actualMix, total: mixTotal } = normalizeMix(plannedBy, practices);
  const driftDistance = mixTotal > 0 ? distanceL1(actualMix, target, practices) : 2;
  const driftScore = mixTotal > 0 ? clamp01(1 - driftDistance / 2) : 0;

  const streakDays = computeStreakDays(inMonthDays, 0.7);
  const streakScore = clamp01(streakDays / 7);

  const momentumScore = computeMomentumScore(inMonthDays);

  const factorBands = {
    completion: bandFromScore(completionRate),
    drift: bandFromScore(driftScore),
    streak: bandFromScore(streakScore),
    momentum: bandFromScore(momentumScore),
  };

  let overallBand = 'Strong';
  if (integrityStatus === 'low') {
    overallBand = 'Weak';
  } else {
    const scores = [completionRate, driftScore, streakScore, momentumScore];
    const min = Math.min(...scores.map((x) => (Number.isFinite(x) ? x : 0)));
    overallBand = bandFromScore(min);
  }

  const deficits = [];
  if (mixTotal > 0) {
    for (const p of practices) {
      const want = (target[p] || 0) * mixTotal;
      const have = plannedBy[p] || 0;
      const gap = want - have;
      if (gap > 0) {
        deficits.push({ practice: p, gapMinutes: Math.round(gap) });
      }
    }
    deficits.sort((a, b) => b.gapMinutes - a.gapMinutes);
  }

  const recs = [];
  const noPlannedData = plannedTotal <= 0;
  if (integrityStatus === 'low') {
    recs.push({ key: 'protect-one', text: 'Protect one primary block and finish it before adding more.' });
    if (!noPlannedData) {
      recs.push({ key: 'reduce-load', text: 'Reduce planned minutes by ~30% to restore completion integrity.' });
      if (deficits.length) {
        recs.push({ key: 'add-deficit', text: `Add one ${deficits[0].practice} block to rebalance the mix.` });
      }
    }
  } else if (driftScore < 0.4 && deficits.length) {
    recs.push({
      key: 'shift-next',
      text: `Shift the next planned block toward ${deficits[0].practice} to correct drift.`,
    });
  } else if (momentumScore < 0.4) {
    recs.push({ key: 'momentum', text: 'Aim for a completed win early in the day to raise momentum.' });
  }

  return {
    windowLabel: 'This month',
    completionRate,
    integrityStatus,
    driftScore,
    streakDays,
    streakScore,
    momentumScore,
    overallBand,
    factorBands,
    deficits,
    recommendations: recs.slice(0, 3),
  };
}

function buildStabilityHeadline(vector, currentWeek) {
  const dominant = currentWeek?.metrics?.dominantPractice || 'balanced';
  const drift = vector?.driftLabel || vector?.drift || 'contained';
  const lows = findLowPractices(vector?.driftDetail?.byPractice);
  if (drift === 'contained') {
    return 'Pattern contained: drift low, completion steady, no overload signals.';
  }
  if (drift === 'elevated') {
    const lag = lows.length ? `; ${lows.join(' + ')} lag` : '';
    return `Drift elevated: ${dominant} absorbing most time${lag}.`;
  }
  return lows.length
    ? `Off-track: completion low and ${lows.join(' + ')} below target.`
    : 'Off-track: completion low and pattern out of alignment.';
}

function buildStabilityAction(vector) {
  const lows = findLowPractices(vector?.driftDetail?.byPractice);
  if (!lows.length) {
    return 'Rebalance by adding one underweight practice block before 18:00.';
  }
  if (lows.length === 1) {
    return `Rebalance by adding one ${lows[0]} block before 18:00.`;
  }
  return `Rebalance by adding one ${lows[0]} block and one ${lows[1]} block before 18:00.`;
}

function toTimeLabel(totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, '0');
  const m = Math.floor(totalMinutes % 60)
    .toString()
    .padStart(2, '0');
  return `${h}:${m}:00.000Z`;
}

function targetMinutesMap(pattern = {}) {
  return (pattern.dailyTargets || []).reduce((acc, t) => {
    acc[t.name] = t.minutes;
    return acc;
  }, {});
}

function updateTemplatesFromDay(state, day, completedBlocks) {
  if (!completedBlocks.length) {
    return;
  }
  if (!state.templates) {
    state.templates = { objectives: {} };
  }
  if (!state.templates.objectives) {
    state.templates.objectives = {};
  }
  const grouped = {};
  completedBlocks.forEach((block) => {
    const objectiveId = block.linkedAimId || day.objectiveId || 'default';
    if (!grouped[objectiveId]) {
      grouped[objectiveId] = { minutesByPractice: {}, slots: [] };
    }
    const entry = grouped[objectiveId];
    const minutes = durationMinutes(block.start, block.end);
    entry.minutesByPractice[block.practice] = (entry.minutesByPractice[block.practice] || 0) + minutes;
    entry.slots.push(inferSlot(block.start));
  });

  Object.entries(grouped).forEach(([objectiveId, data]) => {
    const slotCounts = data.slots.reduce((acc, slot) => {
      acc[slot] = (acc[slot] || 0) + 1;
      return acc;
    }, {});
    const preferredSlot = Object.entries(slotCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'morning';
    const existing = state.templates.objectives[objectiveId];
    const mergedMinutes = { ...(existing?.minutesByPractice || {}) };
    Object.entries(data.minutesByPractice).forEach(([practice, minutes]) => {
      const prior = mergedMinutes[practice] || 0;
      mergedMinutes[practice] = prior ? (prior + minutes) / 2 : minutes;
    });
    state.templates.objectives[objectiveId] = {
      minutesByPractice: mergedMinutes,
      preferredSlot: preferredSlot || existing?.preferredSlot || 'morning',
    };
  });
}

function adaptPatternTargets(state) {
  if (!state.cycle || !state.cycle.length || !state.lenses?.pattern) {
    return false;
  }
  const history = state.cycle.slice(-14);
  if (history.length < 3) {
    return false;
  }
  const totals = {};
  history.forEach((day) => {
    (day.blocks || []).forEach((block) => {
      if (block.status === 'completed' || block.status === 'complete') {
        const minutes = durationMinutes(block.start, block.end);
        totals[block.practice] = (totals[block.practice] || 0) + minutes;
      }
    });
  });
  const daysCount = Math.max(1, history.length);
  const targets = state.lenses?.pattern?.dailyTargets || [];
  const minMax = {
    Body: [15, 180],
    Resources: [15, 240],
    Creation: [15, 240],
    Focus: [15, 180],
  };
  let changed = false;
  const updatedTargets = targets.map((t) => {
    const actualAvg = (totals[t.name] || 0) / daysCount;
    const targetMinutes = t.minutes || state.lenses?.pattern?.defaultMinutes || 0;
    if ((totals[t.name] || 0) < 60) {
      return t;
    }
    if (!targetMinutes) {
      return t;
    }
    const deviation = targetMinutes ? (actualAvg - targetMinutes) / targetMinutes : 0;
    if (Math.abs(deviation) > 0.3) {
      const nudged = Math.max(15, Math.round(targetMinutes + 0.15 * (actualAvg - targetMinutes)));
      const [min, max] = minMax[t.name] || [15, 240];
      const clamped = Math.min(max, Math.max(min, nudged));
      changed = true;
      return { ...t, minutes: clamped };
    }
    return t;
  });
  const todayDate = (state.today && state.today.date) || nowDayKey();
  if (state.lastAdaptedDate === todayDate) {
    return false;
  }
  if (changed) {
    state.lenses.pattern = { ...state.lenses.pattern, dailyTargets: updatedTargets };
    state.lastAdaptedDate = todayDate;
  }
  return changed;
}

function inferSlot(start) {
  const date = new Date(start || '00:00');
  const hour = date.getHours();
  if (hour >= 18) {
    return 'evening';
  }
  if (hour >= 12) {
    return 'afternoon';
  }
  return 'morning';
}

function rebalanceTodayPlan(state, mode) {
  if (!state.today || !state.today.blocks) {
    return;
  }
  const beforePlanned =
    (state.today.plannedMinutes ?? state.today.blocks.reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0)) ||
    0;
  const beforeCompleted =
    (state.today.completedMinutes ??
      state.today.blocks
        .filter((b) => b.status === 'completed' || b.status === 'complete')
        .reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0)) ||
    0;
  const beforeCR = beforePlanned ? beforeCompleted / beforePlanned : 0;
  const beforeIntegrity = beforeCR >= 0.7 ? 'acceptable' : beforeCR >= 0.4 ? 'degrading' : 'low';

  let objectiveId = state.today.primaryObjectiveId || state.today.objectiveId || state.today.blocks[0]?.linkedAimId;
  if (!objectiveId) {
    const planned = (state.today.blocks || []).map((b) => ({
      id: b.objectiveId || b.linkedAimId || b.id,
      minutes: durationMinutes(b.start, b.end),
    }));
    planned.sort((a, b) => b.minutes - a.minutes);
    objectiveId = planned[0]?.id || null;
  }
  const updatedBlocks = [];
  state.today.blocks.forEach((block) => {
    if (block.status === 'completed' || block.status === 'complete') {
      updatedBlocks.push(block);
      return;
    }
    // preserve only the primary (or chosen) block; drop/defer the rest
    if (objectiveId && (block.linkedAimId === objectiveId || block.id === objectiveId)) {
      updatedBlocks.push(block);
      return;
    }
    // drop/defer this planned block
    return;
  });
  state.today.blocks = updatedBlocks;
  state.currentWeek.days = state.currentWeek.days.map((d) =>
    d.date === state.today.date ? { ...d, blocks: updatedBlocks } : d
  );
  state.cycle = state.cycle.map((d) => (d.date === state.today.date ? { ...d, blocks: updatedBlocks } : d));

  // session recap
  const afterPlanned = state.today.blocks.reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0) || 0;
  const afterCompleted =
    state.today.blocks
      .filter((b) => b.status === 'completed' || b.status === 'complete')
      .reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0) || 0;
  const afterCR = afterPlanned ? afterCompleted / afterPlanned : 0;
  const afterIntegrity = afterCR >= 0.7 ? 'acceptable' : afterCR >= 0.4 ? 'degrading' : 'low';
  state.lastSessionChange = {
    type: mode || 'REBALANCE_TODAY',
    timestamp: new Date().toISOString(),
    beforeSummary: JSON.stringify({
      planned: beforePlanned,
      completed: beforeCompleted,
      cr: beforeCR,
      integrity: beforeIntegrity,
    }),
    afterSummary: JSON.stringify({
      planned: afterPlanned,
      completed: afterCompleted,
      cr: afterCR,
      integrity: afterIntegrity,
    }),
  };
}

function shiftEnd(start, durationMinutesValue) {
  if (!start) {
    return start;
  }
  if (start.includes('T')) {
    const s = new Date(start);
    const e = new Date(s.getTime() + durationMinutesValue * 60000);
    return e.toISOString();
  }
  const [h, m] = start.split(':').map(Number);
  const startMinutes = h * 60 + (m || 0);
  const endMinutes = startMinutes + durationMinutesValue;
  const hh = Math.floor(endMinutes / 60)
    .toString()
    .padStart(2, '0');
  const mm = (endMinutes % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function derivePatternFromGoal(goal = {}) {
  const focusAreas = goal.focusAreas || [];
  const defaultMinutes = 45;
  const base = {
    Body: 30,
    Resources: 45,
    Creation: 90,
    Focus: 45,
  };
  const targets = ['Body', 'Resources', 'Creation', 'Focus'].map((name) => {
    const bump = focusAreas.includes(name) ? 30 : 0;
    return { name, minutes: base[name] + bump || defaultMinutes };
  });
  return { defaultMinutes, dailyTargets: targets };
}

const DOMAIN_ORDER = ['Creation', 'Focus', 'Resources', 'Body'];

function normalizeFocusAreas(input = []) {
  const raw = Array.isArray(input) ? input : [];
  const cleaned = raw.filter((name) => ['Body', 'Resources', 'Creation', 'Focus'].includes(name));
  return cleaned.length ? cleaned : ['Creation'];
}

function parseHorizonDays(horizon) {
  if (typeof horizon === 'number' && Number.isFinite(horizon)) {
    return Math.max(1, Math.round(horizon));
  }
  if (typeof horizon !== 'string') {
    return 90;
  }
  const trimmed = horizon.trim().toLowerCase();
  if (trimmed === 'year') {
    return 365;
  }
  if (trimmed.endsWith('d')) {
    const parsed = parseInt(trimmed.slice(0, -1), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
  }
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
}

function parseMinimumDays(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < 3 || parsed > 7) {
    return null;
  }
  return parsed;
}

function choosePrimaryDomain(domains = []) {
  const set = new Set(domains);
  for (const name of DOMAIN_ORDER) {
    if (set.has(name)) {
      return name;
    }
  }
  return domains[0] || 'Creation';
}

function classifyGoalArchetype(goalText = '', domains = []) {
  const text = goalText.toLowerCase();
  if (/(recover|restore|reset|heal|stabilize)/.test(text)) {
    return 'recover';
  }
  if (/(acquire|revenue|pipeline|sell|sales|money|income)/.test(text)) {
    return 'acquire';
  }
  if (/(perform|execute|focus|precision|practice)/.test(text)) {
    return 'perform';
  }
  if (/(ship|build|launch|create|release|publish)/.test(text)) {
    return 'build';
  }
  if (domains.includes('Creation')) {
    return 'build';
  }
  if (domains.includes('Resources')) {
    return 'acquire';
  }
  if (domains.includes('Body')) {
    return 'recover';
  }
  return 'perform';
}

function computeDomainMix(domains = []) {
  const mix = { Body: 0, Resources: 0, Creation: 0, Focus: 0 };
  if (!domains.length) {
    mix.Creation = 1;
    return mix;
  }
  if (domains.length === 1) {
    mix[domains[0]] = 1;
    return mix;
  }
  const primary = choosePrimaryDomain(domains);
  const primaryWeight = 0.45;
  const remaining = (1 - primaryWeight) / (domains.length - 1);
  domains.forEach((d) => {
    mix[d] = d === primary ? primaryWeight : remaining;
  });
  return mix;
}

function computeBlocksPerWeek(daysPerWeek) {
  const base = Math.max(6, Math.min(14, daysPerWeek * 2));
  return Math.round(base);
}

function buildTemplates(archetype, domains, primaryDomain) {
  const pick = (preferred, fallback) => {
    if (domains.includes(preferred)) {
      return preferred;
    }
    return domains.includes(fallback) ? fallback : primaryDomain;
  };
  const focusDomain = pick('Focus', 'Creation');
  const resourcesDomain = pick('Resources', 'Focus');
  const bodyDomain = pick('Body', 'Focus');
  const creationDomain = pick('Creation', 'Focus');
  const base = {
    build: [
      {
        title: 'Foundation reps',
        domain: creationDomain,
        durationMinutes: 30,
        frequency: 'daily',
        reason: 'build muscle memory',
      },
      {
        title: 'Production sprint',
        domain: creationDomain,
        durationMinutes: 90,
        frequency: '3x/week',
        reason: 'ship tangible output',
      },
      { title: 'Scope review', domain: focusDomain, durationMinutes: 20, frequency: 'weekly', reason: 'tighten scope' },
    ],
    recover: [
      {
        title: 'Recovery base',
        domain: bodyDomain,
        durationMinutes: 30,
        frequency: 'daily',
        reason: 'restore capacity',
      },
      {
        title: 'Stability block',
        domain: resourcesDomain,
        durationMinutes: 45,
        frequency: '3x/week',
        reason: 'stabilize inputs',
      },
      {
        title: 'Reflection review',
        domain: focusDomain,
        durationMinutes: 15,
        frequency: 'weekly',
        reason: 'track recovery signals',
      },
    ],
    acquire: [
      {
        title: 'Pipeline touch',
        domain: resourcesDomain,
        durationMinutes: 30,
        frequency: 'daily',
        reason: 'keep acquisition warm',
      },
      {
        title: 'Acquisition sprint',
        domain: resourcesDomain,
        durationMinutes: 60,
        frequency: '3x/week',
        reason: 'convert opportunities',
      },
      {
        title: 'Revenue review',
        domain: focusDomain,
        durationMinutes: 20,
        frequency: 'weekly',
        reason: 'tighten acquisition loop',
      },
    ],
    perform: [
      {
        title: 'Focus primer',
        domain: focusDomain,
        durationMinutes: 20,
        frequency: 'daily',
        reason: 'prime execution',
      },
      {
        title: 'Execution block',
        domain: primaryDomain,
        durationMinutes: 60,
        frequency: '3x/week',
        reason: 'sustain performance',
      },
      {
        title: 'Performance review',
        domain: focusDomain,
        durationMinutes: 15,
        frequency: 'weekly',
        reason: 'adjust execution',
      },
    ],
  };
  return base[archetype] || base.build;
}

function averageTemplateMinutes(templates = []) {
  if (!templates.length) {
    return 45;
  }
  const total = templates.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
  return Math.round(total / templates.length) || 45;
}

function buildSuggestedBlocks({
  goalId,
  startDayKey,
  blocksPerWeek,
  templates,
  daysPerWeek,
  goalText,
  primaryDomain,
  reservedIds = new Set(),
  timeZone,
}) {
  return generateSuggestions({
    goalId,
    startDayKey,
    blocksPerWeek,
    templates,
    daysPerWeek,
    goalText,
    primaryDomain,
    reservedIds,
    timeZone,
  });
}

function getSortedEndedHistorySignals(state, windowCycles = 5) {
  const allSignals = Object.values(state.historySignalsByCycleId || {}).filter((entry) => entry && entry.endDayKey);
  const sorted = allSignals.sort((a, b) => {
    if (a.endDayKey !== b.endDayKey) {
      return a.endDayKey.localeCompare(b.endDayKey);
    }
    return (a.cycleId || '').localeCompare(b.cycleId || '');
  });
  const count = Number.isFinite(windowCycles) ? Math.max(1, Number(windowCycles)) : 5;
  return sorted.slice(-count);
}

function rebuildHistoryProfile(state, windowCycles = 5) {
  const endedSignals = getSortedEndedHistorySignals(state, windowCycles);
  state.historyProfile = buildHistoryProfile(endedSignals, { windowCycles });
  return state.historyProfile;
}

function buildHistoryProfileForDraft(state, planDraft = null) {
  if (!planDraft || planDraft.enableHistoryPolicySelection !== true) {
    return null;
  }
  const windowCycles = Number.isFinite(planDraft.historyWindowCycles) ? Number(planDraft.historyWindowCycles) : 5;
  const endedSignals = getSortedEndedHistorySignals(state, windowCycles);
  return buildHistoryProfile(endedSignals, { windowCycles });
}

function computePlanPreview({
  suggestedBlocks = [],
  planDraft = null,
  contract = null,
  policyState = null,
  historyProfile = null,
  timeZone = 'UTC',
} = {}) {
  const onlySuggested = (suggestedBlocks || []).filter((s) => s && s.status === 'suggested');
  const totalBlocks = onlySuggested.length;
  const totalMinutes = onlySuggested.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const quality = buildPolicyAndQualityDiagnostics({
    suggestedBlocks,
    planDraft,
    contract,
    policyState,
    historyProfile,
    timeZone,
  });
  return {
    totalBlocks,
    totalMinutes,
    primaryDomain: planDraft?.primaryDomain,
    horizonDays: contract?.horizonDays,
    qualityPolicyIdRequested: quality.qualityPolicyIdRequested,
    qualityPolicyIdUsed: quality.qualityPolicyIdUsed,
    policySelectionDecision: quality.policySelectionDecision,
    policySelectionReasonCodes: quality.policySelectionReasonCodes,
    policySelectionSignalsSnapshot: quality.policySelectionSignalsSnapshot,
    qualityScoreBaseline: quality.qualityScoreBaseline,
    qualityScoreBaselineByComponent: quality.qualityScoreBaselineByComponent,
    qualityScoreOptimized: quality.qualityScoreOptimized,
    qualityScoreOptimizedByComponent: quality.qualityScoreOptimizedByComponent,
    qualityImprovementDelta: quality.qualityImprovementDelta,
    optimizerRejectedCandidatesSummary: quality.optimizerRejectedCandidatesSummary,
    historyProfileSnapshotUsed: quality.historyProfileSnapshotUsed,
    historyReasonCodes: quality.historyReasonCodes,
  };
}

function getCurrentPolicyState(state) {
  const cycle = getActiveCycle(state);
  return cycle?.policyState || null;
}

export function rehydrateSuggestionRejections(suggestions = [], events = []) {
  if (!Array.isArray(suggestions) || !Array.isArray(events) || !suggestions.length || !events.length) {
    return suggestions || [];
  }
  const next = suggestions.map((s) => ({ ...s }));
  events.forEach((event) => {
    if (event?.type !== 'suggestion_rejected') {
      return;
    }
    const suggestionId = event.suggestionId || event.proposalId;
    if (!suggestionId) {
      return;
    }
    const target = next.find((s) => s.id === suggestionId);
    if (!target) {
      return;
    }
    if (target.status === 'rejected' && target.rejectedReason) {
      return;
    }
    if (target.status === 'suggested') {
      target.status = 'rejected';
    }
    if (!target.rejectedReason && event.reason) {
      target.rejectedReason = event.reason;
    }
  });
  return next;
}

function rehydrateSuggestionOverrides(suggestions = [], events = []) {
  if (!Array.isArray(suggestions) || !Array.isArray(events) || !suggestions.length || !events.length) {
    return suggestions || [];
  }
  let next = rehydrateSuggestionRejections(suggestions, events);
  next = next.map((s) => ({ ...s }));
  events.forEach((event) => {
    if (!event?.type) {
      return;
    }
    const suggestionId = event.suggestionId || event.proposalId;
    if (!suggestionId) {
      return;
    }
    const target = next.find((s) => s.id === suggestionId);
    if (!target) {
      return;
    }
    if (event.type === 'suggestion_ignored' && target.status === 'suggested') {
      target.status = 'ignored';
    }
    if (event.type === 'suggestion_dismissed' && target.status === 'suggested') {
      target.status = 'dismissed';
    }
  });
  return next;
}

function applySuggestionEventOverrides(state) {
  const suggestions = state.proposedBlocks || [];
  const events = state.suggestionEvents || [];
  if (!suggestions.length || !events.length) {
    return false;
  }
  const next = rehydrateSuggestionOverrides(suggestions, events);
  const changed = next.some(
    (entry, idx) =>
      entry.status !== suggestions[idx]?.status || entry.rejectedReason !== suggestions[idx]?.rejectedReason
  );
  if (changed) {
    setCycleProposedBlocks(state, state.activeCycleId || null, next);
  }
  return changed;
}

const REJECTION_REASONS = ['TOO_LONG', 'WRONG_TIME', 'LOW_ENERGY', 'NOT_RELEVANT', 'MISSING_PREREQ', 'OVERCOMMITTED'];

function computeCorrectionSignals(state, windowDays = 14) {
  const todayKey = nowDayKey();
  const startKey = addDays(todayKey, -(windowDays - 1));
  const events = (state.suggestionEvents || []).filter((event) => event?.type === 'suggestion_rejected');
  const byReason = REJECTION_REASONS.reduce((acc, reason) => {
    acc[reason] = 0;
    return acc;
  }, {});
  const inWindow = events.filter((event) => {
    const dayKey = event.dayKey || dayKeyFromDate(new Date(event.atISO || ''));
    if (!dayKey) {
      return false;
    }
    return dayKey >= startKey && dayKey <= todayKey;
  });
  inWindow.forEach((event) => {
    const reason = event.reason;
    if (!reason || !(reason in byReason)) {
      return;
    }
    byReason[reason] += 1;
  });
  const total = Object.values(byReason).reduce((sum, val) => sum + val, 0);
  const ratio = (count) => (total > 0 ? count / total : 0);
  return {
    windowDays,
    totalRejections: total,
    byReason,
    signals: {
      capacityPressure: ratio(byReason.OVERCOMMITTED),
      durationMismatch: ratio(byReason.TOO_LONG),
      timingMismatch: ratio(byReason.WRONG_TIME),
      energyMismatch: ratio(byReason.LOW_ENERGY),
      relevanceMismatch: ratio(byReason.NOT_RELEVANT),
      prereqDebt: ratio(byReason.MISSING_PREREQ),
    },
  };
}

function hasValidatedCycleActionGraph(cycle) {
  if (!cycle) {
    return false;
  }
  const actionSource = getCanonicalCycleActions(cycle);
  if (!actionSource.length) {
    return false;
  }
  return actionSource.every((action) => {
    if (!action || !action.id) {
      return false;
    }
    const title = String(action.title || action.label || '').trim();
    return title.length > 0;
  });
}

function ensureCycleDeliverablesWorkspace(state, cycleId) {
  if (!cycleId) {
    return 0;
  }
  state.deliverablesByCycleId = state.deliverablesByCycleId || {};
  const cycle = state.cyclesById?.[cycleId];
  if (!cycle) {
    return 0;
  }
  const existingWorkspace = state.deliverablesByCycleId[cycleId] || {
    cycleId,
    deliverables: [],
    suggestionLinks: {},
    lastUpdatedAtISO: state.appTime?.nowISO || new Date().toISOString(),
  };
  state.deliverablesByCycleId[cycleId] = existingWorkspace;
  return Array.isArray(existingWorkspace.deliverables) ? existingWorkspace.deliverables.length : 0;
}

function enforceOnboardingExecutionGraphGate(state, cycleId, actionType = 'ONBOARDING') {
  if (!cycleId) {
    return;
  }
  const cycle = state.cyclesById?.[cycleId];
  if (!cycle) {
    return;
  }
  const deliverablesCount = ensureCycleDeliverablesWorkspace(state, cycleId);
  const hasGraph = hasValidatedCycleActionGraph(cycle);
  if (deliverablesCount > 0 && hasGraph) {
    cycle.executionGraphReady = true;
    if (state.lastPlanError?.code === 'ACTION_GRAPH_MISSING') {
      state.lastPlanError = null;
    }
    state.cyclesById[cycleId] = cycle;
    return;
  }

  cycle.executionGraphReady = false;
  state.cyclesById[cycleId] = cycle;
  const reasonCodes = [];
  if (deliverablesCount <= 0) {
    reasonCodes.push('NO_DELIVERABLES');
  }
  if (!hasGraph) {
    reasonCodes.push('NO_ACTION_GRAPH');
  }
  state.lastPlanError = {
    code: 'ACTION_GRAPH_MISSING',
    reason: 'Onboarding cannot progress without a validated execution graph.',
    reasonCodes,
    cycleId,
    actionType,
  };
}

function applyOnboardingInputs(state, onboarding = {}) {
  const goalDraftV2 = onboarding?.goalDraftV2 || null;
  const focusAreas = normalizeFocusAreas(onboarding.focusAreas);
  const pattern = derivePatternFromGoal({ ...onboarding, focusAreas });
  const goalText = (
    goalDraftV2?.goalLabel ||
    goalDraftV2?.goalText ||
    goalDraftV2?.terminalOutcome?.text ||
    onboarding.goalText ||
    onboarding.direction ||
    state.vector.direction ||
    ''
  ).trim();
  const narrative = (onboarding.narrative || '').trim();
  const successDefinition = (onboarding.successDefinition || '').trim();
  const horizonDays = parseHorizonDays(onboarding.horizon);
  const timeZone = state.appTime?.timeZone;
  const startDayKey = nowDayKey(timeZone);
  const endDayKey = addDays(startDayKey, horizonDays, timeZone);
  const daysPerWeek = parseMinimumDays(onboarding.minimumDaysPerWeek) || 4;
  const blocksPerWeek = computeBlocksPerWeek(daysPerWeek);
  const primaryDomain = choosePrimaryDomain(focusAreas);
  const archetype = classifyGoalArchetype(goalText, focusAreas);
  const templates = buildTemplates(archetype, focusAreas, primaryDomain);
  const totalMinutesPerWeek = blocksPerWeek * averageTemplateMinutes(templates);
  const goalId = `goal-${startDayKey}-${Object.keys(state.goalWorkById || {}).length + 1}`;
  const weeks = Math.max(1, Math.ceil(horizonDays / 7));
  const requiredBlocks = blocksPerWeek * weeks;
  const deliverables = [{ id: `deliv-${goalId}-1`, title: successDefinition || 'Primary deliverable', requiredBlocks }];
  const deadlineISO = buildLocalStartISO(endDayKey, '23:59', timeZone);
  const strategy = buildDefaultStrategy({
    goalId,
    deadlineISO: deadlineISO?.startISO || `${endDayKey}T23:59:00.000Z`,
    timeZone,
    deliverables,
  });

  state.vector.direction = goalText || state.vector.direction;
  state.lenses.aim = {
    description: goalText || state.lenses.aim.description,
    horizon: onboarding.horizon || state.lenses.aim.horizon || '90d',
    narrative: narrative || state.lenses.aim.narrative,
  };
  state.lenses.pattern = { ...state.lenses.pattern, ...pattern };
  state.meta = { ...(state.meta || {}), onboardingComplete: true, version: '1.0.0' };

  ensureCycleStructures(state);
  const current = state.activeCycleId ? state.cyclesById[state.activeCycleId] : null;
  if (current) {
    endCycle(state, current.id);
    const ended = state.cyclesById[current.id];
    state.history.cycles.push({
      id: ended.id,
      status: ended.status,
      startedAtDayKey: ended.startedAtDayKey,
      endedAtDayKey: ended.endedAtDayKey,
      definiteGoal: ended.definiteGoal,
      pattern: ended.pattern,
      aim: ended.aim,
      flow: ended.flow,
    });
  }

  const goalContract = {
    goalId,
    executionType: goalDraftV2?.executionType || onboarding.executionType || null,
    goalLabel: goalText || null,
    goalText: goalText || null,
    status: 'active',
    activationDateISO: startDayKey,
    deadlineISO: endDayKey,
    success: [
      {
        metricType: 'binary',
        metricName: successDefinition || 'success',
        targetValue: true,
        validationMethod: 'user_attest',
      },
    ],
    requirements: {
      requiredDomains: focusAreas,
      minimumCadencePerDomain: {
        Body: focusAreas.includes('Body') ? 1 : 0,
        Focus: focusAreas.includes('Focus') ? 1 : 0,
        Creation: focusAreas.includes('Creation') ? 1 : 0,
        Resources: focusAreas.includes('Resources') ? 1 : 0,
      },
      expectedDomainMix: computeDomainMix(focusAreas),
      maxAllowedVariance: 0.2,
    },
  };

  const goalGovernanceContract = {
    contractId: `gov-${goalId}`,
    version: 1,
    goalId,
    activeFromISO: startDayKey,
    activeUntilISO: endDayKey,
    scope: {
      domainsAllowed: [],
      timeHorizon: 'week',
      timezone: timeZone || 'UTC',
    },
    governance: {
      suggestionsEnabled: true,
      probabilityEnabled: true,
      minEvidenceEvents: 1,
      cooldowns: { resuggestMinutes: 30, maxSuggestionsPerDay: 6 },
    },
    constraints: {
      forbiddenDirectives: ['repair'],
      maxActiveBlocks: 6,
    },
  };

  state.meta = state.meta || {};
  state.meta.nextCycleSequenceByDayKey = state.meta.nextCycleSequenceByDayKey || {};
  if (!state.meta.nextCycleSequenceByDayKey[startDayKey]) {
    const dayPrefix = `cycle-${startDayKey}-`;
    const existingNums = Object.keys(state.cyclesById || {})
      .filter((id) => id.startsWith(dayPrefix))
      .map((id) => Number.parseInt(id.slice(dayPrefix.length), 10))
      .filter((n) => Number.isFinite(n));
    state.meta.nextCycleSequenceByDayKey[startDayKey] = existingNums.length > 0 ? Math.max(...existingNums) : 0;
  }
  const nextN = state.meta.nextCycleSequenceByDayKey[startDayKey] + 1;
  state.meta.nextCycleSequenceByDayKey[startDayKey] = nextN;
  const newCycleId = `cycle-${startDayKey}-${nextN}`;
  state.cyclesById[newCycleId] = {
    id: newCycleId,
    status: 'active',
    startedAtDayKey: startDayKey,
    definiteGoal: { outcome: goalText || 'Definite goal', deadlineDayKey: endDayKey },
    goalContract,
    goalGovernanceContract,
    contract: null,
    aim: { text: goalText || '' },
    pattern: { dailyTargets: sanitizePatternTargets(pattern.dailyTargets || []) },
    flow: state.lenses.flow,
    strategy,
    coldPlan: null,
    coldPlanHistory: [],
        executionEvents: [],
        externalEvidenceEvents: [],
        planMutationEvents: [],
        suggestionEvents: [],
    suggestedBlocks: [],
    truthEntries: [],
    suggestionHistory: {
      dayKey: startDayKey,
      count: 0,
      lastSuggestedAtISO: null,
      lastSuggestedAtISOByGoal: {},
      dailyCountByGoal: {},
      denials: [],
    },
  };
  ensureAdmissionStores(state);
  state.aspirationsByCycleId[newCycleId] = state.aspirationsByCycleId[newCycleId] || [];
  state.deliverablesByCycleId = state.deliverablesByCycleId || {};
  state.deliverablesByCycleId[newCycleId] = {
    cycleId: newCycleId,
    deliverables,
    suggestionLinks: {},
    lastUpdatedAtISO: state.appTime?.nowISO || new Date().toISOString(),
  };
  state.activeCycleId = newCycleId;
  state.activeGoalId = goalId;
  clearCycleTransientState(state);

  if (!state.goalWorkById) {
    state.goalWorkById = {};
  }
  if (!state.goalWorkById[goalId]) {
    state.goalWorkById[goalId] = focusAreas.map((domain, idx) => ({
      workItemId: `${goalId}-${domain.toLowerCase()}`,
      title: `${domain} baseline`,
      blocksRemaining: Math.max(2, Math.round(blocksPerWeek / (focusAreas.length || 1))),
      category: domain,
      focusMode: domain === 'Creation' || domain === 'Focus' ? 'deep' : 'shallow',
      energyCost: domain === 'Body' ? 'medium' : 'high',
      producesOutput: domain === 'Creation' || domain === 'Resources',
      unblockType: null,
      dependencies: [],
    }));
  }

  state.goalExecutionContract = {
    goalId,
    goalText,
    horizonDays,
    domains: focusAreas,
    narrative,
    startDayKey,
    endDayKey,
    successDefinition,
  };
  state.executionEvents = [];
  state.externalEvidenceEvents = [];
  state.planMutationEvents = [];
  state.suggestionEvents = [];
  state.truthEntries = [];
  state.executionEvents = [];
  state.externalEvidenceEvents = [];
  state.planMutationEvents = [];
  state.suggestionEvents = [];
  state.suggestedBlocks = [];
  state.truthEntries = [];

  state.planDraft = {
    id: `plan-${goalId}`,
    goalId,
    status: parseMinimumDays(onboarding.minimumDaysPerWeek) ? 'calibrated' : 'draft',
    createdAtISO: new Date().toISOString(),
    blocksPerWeek,
    totalMinutesPerWeek,
    primaryDomain,
    archetype,
    templates,
    successDefinition,
    horizonDays,
    daysPerWeek,
    qualityPolicyId: 'BALANCED',
    autoPolicySelection: false,
    minPolicyHoldDays: 7,
    enableQualityOptimizer: false,
    enableMilestonePacing: false,
    pacingCadenceMode: 'adaptive',
    enableHistoryPolicySelection: false,
    historyWindowCycles: 5,
    historyInfluenceStrength: 'standard',
  };

  state.suggestedBlocks = [];
  state.suggestionEvents = [];

  state.planCalibration = {
    confidence: parseMinimumDays(onboarding.minimumDaysPerWeek) ? 0.45 : 0.3,
    daysPerWeek,
    assumptions: [`Assuming ${daysPerWeek} days/week execution.`, `Default capacity ${blocksPerWeek} blocks/week.`],
    missingInfo: parseMinimumDays(onboarding.minimumDaysPerWeek) ? [] : ['daysPerWeek'],
  };
  state.planPreview = computePlanPreview({
    suggestedBlocks: state.proposedBlocks || [],
    planDraft: state.planDraft,
    contract: state.goalExecutionContract,
    policyState: getCurrentPolicyState(state),
    historyProfile: buildHistoryProfileForDraft(state, state.planDraft),
    timeZone: state.appTime?.timeZone || APP_TIME_ZONE,
  });
  state.suggestionHistory = {
    dayKey: startDayKey,
    count: 0,
    lastSuggestedAtISO: null,
    lastSuggestedAtISOByGoal: {},
    dailyCountByGoal: {},
    denials: [],
  };

  state.cyclesById[newCycleId].planDraft = state.planDraft;
  state.cyclesById[newCycleId].calibration = state.planCalibration;
  state.cyclesById[newCycleId].planPreview = state.planPreview;
  state.cyclesById[newCycleId].proposedBlocks = state.proposedBlocks;
  state.cyclesById[newCycleId].suggestedBlocks = state.suggestedBlocks;
  state.cyclesById[newCycleId].suggestionEvents = state.suggestionEvents;
  state.cyclesById[newCycleId].executionEvents = state.executionEvents;
  state.cyclesById[newCycleId].externalEvidenceEvents = state.externalEvidenceEvents;
  state.cyclesById[newCycleId].planMutationEvents = state.planMutationEvents;
  state.cyclesById[newCycleId].contract = state.goalExecutionContract;
  state.cyclesById[newCycleId].suggestionHistory = state.suggestionHistory;

  generateColdPlanForCycle(state, { rebaseMode: 'NONE' });

  recomputeSummaries(state);
  state.vector = recalculateIdentityVector(state);
}

function startNewCycle(state, payload = {}) {
  ensureCycleStructures(state);
  const current = state.activeCycleId ? state.cyclesById[state.activeCycleId] : null;
  const profileDomains = (state.goalExecutionContract && state.goalExecutionContract.domains) || [];
  const focusAreas = normalizeFocusAreas(payload.focusAreas || profileDomains);
  const goalDraftV2 = payload?.goalDraftV2 || null;
  const goalText = (
    goalDraftV2?.goalLabel ||
    goalDraftV2?.goalText ||
    goalDraftV2?.terminalOutcome?.text ||
    payload.goalText ||
    state.goalExecutionContract?.goalText ||
    state.vector?.direction ||
    ''
  ).trim();
  const narrative = (payload.narrative || state.goalExecutionContract?.narrative || '').trim();
  const successDefinition = (payload.successDefinition || state.goalExecutionContract?.successDefinition || '').trim();
  const timeZone = state.appTime?.timeZone;
  const startDayKey = nowDayKey(timeZone);
  const deadlineDayKey =
    payload.deadlineDayKey ||
    payload.endDayKey ||
    state.goalExecutionContract?.endDayKey ||
    addDays(startDayKey, state.goalExecutionContract?.horizonDays || 90, timeZone);
  const horizonDays = Math.max(
    1,
    daysBetween(startDayKey, deadlineDayKey) || state.goalExecutionContract?.horizonDays || 90
  );
  const daysPerWeek =
    parseMinimumDays(payload.minimumDaysPerWeek) ||
    state.planCalibration?.daysPerWeek ||
    state.planDraft?.daysPerWeek ||
    4;
  const blocksPerWeek = computeBlocksPerWeek(daysPerWeek);
  const primaryDomain = choosePrimaryDomain(focusAreas);
  const archetype = classifyGoalArchetype(goalText, focusAreas);
  const templates = buildTemplates(archetype, focusAreas, primaryDomain);
  const totalMinutesPerWeek = blocksPerWeek * averageTemplateMinutes(templates);
  const goalId = `goal-${startDayKey}-${Object.keys(state.goalWorkById || {}).length + 1}`;
  const weeks = Math.max(1, Math.ceil(horizonDays / 7));
  const requiredBlocks = blocksPerWeek * weeks;
  const deliverables = [{ id: `deliv-${goalId}-1`, title: successDefinition || 'Primary deliverable', requiredBlocks }];
  const deadlineISO = buildLocalStartISO(deadlineDayKey, '23:59', timeZone);
  const strategy = buildDefaultStrategy({
    goalId,
    deadlineISO: deadlineISO?.startISO || `${deadlineDayKey}T23:59:00.000Z`,
    timeZone,
    deliverables,
  });

  archivePreviousCycle(state, current?.id || null);

  const goalContract = {
    goalId,
    executionType:
      goalDraftV2?.executionType || payload.executionType || state.goalExecutionContract?.executionType || null,
    goalLabel: goalText || null,
    goalText: goalText || null,
    status: 'active',
    activationDateISO: startDayKey,
    deadlineISO: deadlineDayKey,
    workWindows: normalizeCanonicalWorkWindows(payload.workWindows || state.goalExecutionContract?.workWindows || {}),
    workWindowsSource:
      payload.workWindowsSource ||
      state.goalExecutionContract?.workWindowsSource ||
      (countRawWorkWindows(payload.workWindows || state.goalExecutionContract?.workWindows || {}) > 0
        ? 'user_defined'
        : 'unset'),
    constraintsStatus:
      payload.constraintsStatus ||
      state.goalExecutionContract?.constraintsStatus ||
      (countRawWorkWindows(payload.workWindows || state.goalExecutionContract?.workWindows || {}) > 0
        ? 'approved'
        : 'unsaved'),
    capacityValidation: state.goalExecutionContract?.capacityValidation || null,
    success: [
      {
        metricType: 'binary',
        metricName: successDefinition || 'success',
        targetValue: true,
        validationMethod: 'user_attest',
      },
    ],
    requirements: {
      requiredDomains: focusAreas,
      minimumCadencePerDomain: {
        Body: focusAreas.includes('Body') ? 1 : 0,
        Focus: focusAreas.includes('Focus') ? 1 : 0,
        Creation: focusAreas.includes('Creation') ? 1 : 0,
        Resources: focusAreas.includes('Resources') ? 1 : 0,
      },
      expectedDomainMix: computeDomainMix(focusAreas),
      maxAllowedVariance: 0.2,
    },
  };

  const goalGovernanceContract = {
    contractId: `gov-${goalId}`,
    version: 1,
    goalId,
    activeFromISO: startDayKey,
    activeUntilISO: deadlineDayKey,
    scope: {
      domainsAllowed: [],
      timeHorizon: 'week',
      timezone: timeZone || 'UTC',
    },
    governance: {
      suggestionsEnabled: true,
      probabilityEnabled: true,
      minEvidenceEvents: 1,
      cooldowns: { resuggestMinutes: 30, maxSuggestionsPerDay: 6 },
    },
    constraints: {
      forbiddenDirectives: ['repair'],
      maxActiveBlocks: 6,
    },
  };

  state.meta = state.meta || {};
  state.meta.nextCycleSequenceByDayKey = state.meta.nextCycleSequenceByDayKey || {};
  if (!state.meta.nextCycleSequenceByDayKey[startDayKey]) {
    const dayPrefix = `cycle-${startDayKey}-`;
    const existingNums = Object.keys(state.cyclesById || {})
      .filter((id) => id.startsWith(dayPrefix))
      .map((id) => Number.parseInt(id.slice(dayPrefix.length), 10))
      .filter((n) => Number.isFinite(n));
    state.meta.nextCycleSequenceByDayKey[startDayKey] = existingNums.length > 0 ? Math.max(...existingNums) : 0;
  }
  const nextN = state.meta.nextCycleSequenceByDayKey[startDayKey] + 1;
  state.meta.nextCycleSequenceByDayKey[startDayKey] = nextN;
  const newCycleId = `cycle-${startDayKey}-${nextN}`;
  state.cyclesById[newCycleId] = {
    id: newCycleId,
    status: 'active',
    startedAtDayKey: startDayKey,
    definiteGoal: { outcome: goalText || 'Definite goal', deadlineDayKey },
    goalContract,
    goalGovernanceContract,
    contract: null,
    aim: { text: goalText || '' },
    pattern: current?.pattern || state.lenses?.pattern || { dailyTargets: [] },
    flow: state.lenses?.flow,
    strategy,
    coldPlan: null,
    coldPlanHistory: [],
    executionEvents: [],
    externalEvidenceEvents: [],
    planMutationEvents: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    truthEntries: [],
    suggestionHistory: {
      dayKey: startDayKey,
      count: 0,
      lastSuggestedAtISO: null,
      lastSuggestedAtISOByGoal: {},
      dailyCountByGoal: {},
      denials: [],
    },
  };

  state.activeCycleId = newCycleId;
  state.activeGoalId = goalId;
  state.viewDate = startDayKey;
  if (state.appTime?.isFollowingNow) {
    state.appTime.activeDayKey = startDayKey;
  }
  clearCycleTransientState(state);

  if (!state.goalWorkById) {
    state.goalWorkById = {};
  }
  if (!state.goalWorkById[goalId]) {
    state.goalWorkById[goalId] = focusAreas.map((domain) => ({
      workItemId: `${goalId}-${domain.toLowerCase()}`,
      title: `${domain} baseline`,
      blocksRemaining: Math.max(2, Math.round(blocksPerWeek / (focusAreas.length || 1))),
      category: domain,
      focusMode: domain === 'Creation' || domain === 'Focus' ? 'deep' : 'shallow',
      energyCost: domain === 'Body' ? 'medium' : 'high',
      producesOutput: domain === 'Creation' || domain === 'Resources',
      unblockType: null,
      dependencies: [],
    }));
  }

  state.goalExecutionContract = {
    goalId,
    goalText,
    horizonDays,
    domains: focusAreas,
    narrative,
    startDayKey,
    endDayKey: deadlineDayKey,
    successDefinition,
    workWindows: goalContract.workWindows,
    workWindowsSource: goalContract.workWindowsSource,
    constraintsStatus: goalContract.constraintsStatus,
    capacityValidation: goalContract.capacityValidation,
  };

  state.planDraft = {
    id: `plan-${goalId}`,
    goalId,
    status: 'draft',
    createdAtISO: new Date().toISOString(),
    blocksPerWeek,
    totalMinutesPerWeek,
    primaryDomain,
    archetype,
    templates,
    successDefinition,
    horizonDays,
    daysPerWeek,
    qualityPolicyId: 'BALANCED',
    autoPolicySelection: false,
    minPolicyHoldDays: 7,
    enableQualityOptimizer: false,
    enableMilestonePacing: false,
    pacingCadenceMode: 'adaptive',
    enableHistoryPolicySelection: false,
    historyWindowCycles: 5,
    historyInfluenceStrength: 'standard',
  };

  state.proposedBlocks = [];
  state.suggestedBlocks = [];
  state.suggestionEvents = [];

  state.planCalibration = {
    confidence: 0.3,
    daysPerWeek,
    assumptions: [`Assuming ${daysPerWeek} days/week execution.`, `Default capacity ${blocksPerWeek} blocks/week.`],
    missingInfo: ['daysPerWeek'],
  };
  state.planPreview = computePlanPreview({
    suggestedBlocks: state.proposedBlocks || [],
    planDraft: state.planDraft,
    contract: state.goalExecutionContract,
    policyState: getCurrentPolicyState(state),
    historyProfile: buildHistoryProfileForDraft(state, state.planDraft),
    timeZone: state.appTime?.timeZone || APP_TIME_ZONE,
  });

  state.executionEvents = [];
  state.externalEvidenceEvents = [];
  state.planMutationEvents = [];
  state.truthEntries = [];
  state.suggestionHistory = {
    dayKey: startDayKey,
    count: 0,
    lastSuggestedAtISO: null,
    lastSuggestedAtISOByGoal: {},
    dailyCountByGoal: {},
    denials: [],
  };
  state.cycle = [];
  state.today = { ...(state.today || {}), date: startDayKey, blocks: [] };
  state.currentWeek = { weekStart: startDayKey, days: [] };

  state.cyclesById[newCycleId].planDraft = state.planDraft;
  state.cyclesById[newCycleId].calibration = state.planCalibration;
  state.cyclesById[newCycleId].planPreview = state.planPreview;
  state.cyclesById[newCycleId].proposedBlocks = state.proposedBlocks;
  state.cyclesById[newCycleId].suggestedBlocks = state.suggestedBlocks;
  state.cyclesById[newCycleId].suggestionEvents = state.suggestionEvents;
  state.cyclesById[newCycleId].executionEvents = state.executionEvents;
  state.cyclesById[newCycleId].externalEvidenceEvents = state.externalEvidenceEvents;
  state.cyclesById[newCycleId].planMutationEvents = state.planMutationEvents;
  state.cyclesById[newCycleId].contract = state.goalExecutionContract;
  state.cyclesById[newCycleId].suggestionHistory = state.suggestionHistory;

  generateColdPlanForCycle(state, { rebaseMode: 'NONE' });
  assertActiveCycleInvariant(state);
}

function addTruthEntry(state, payload = {}) {
  const entry = payload && typeof payload === 'object' ? payload : null;
  if (!entry || !entry.id) {
    return;
  }
  state.truthEntries = state.truthEntries || [];
  state.truthEntries = [entry, ...state.truthEntries];
}

function setActiveCycle(state, cycleId) {
  ensureCycleStructures(state);
  if (!cycleId || !state.cyclesById?.[cycleId]) {
    return;
  }
  const cycle = state.cyclesById[cycleId];
  if (cycle.status === 'deleted') {
    return;
  }
  state.activeCycleId = cycleId;
  if (cycle.startedAtDayKey) {
    state.viewDate = cycle.startedAtDayKey;
    if (state.appTime) {
      state.appTime.activeDayKey = cycle.startedAtDayKey;
      state.appTime.isFollowingNow = false;
    }
  }
  hydrateActiveCycleState(state);
}

function collectCycleHistorySignals(state, cycle) {
  if (!cycle?.id) {
    return null;
  }
  const cycleEvents = (cycle.executionEvents || []).filter((event) => (event?.cycleId || cycle.id) === cycle.id);
  const materialized = materializeBlocksFromEvents(cycleEvents, { todayISO: cycle.endedAtDayKey || state.today?.date });
  const materializedBlocks = (materialized.days || []).flatMap((day) => day.blocks || []);
  return deriveCycleHistorySignals(cycle, materializedBlocks, cycleEvents, {
    depTightCount: cycle?.planPreview?.policySelectionSignalsSnapshot?.depTightCount,
    milestoneAtRiskCount: cycle?.planPreview?.policySelectionSignalsSnapshot?.milestoneAtRiskCount,
    placementAnchoringMissCount: cycle?.planPreview?.pacingAnchoringMissCount,
    outsideExecutionHorizonMinutes:
      cycle?.planPreview?.policySelectionSignalsSnapshot?.outsideExecutionHorizonEstimateMinTotal,
    unplacedEstimateMinTotal: cycle?.planPreview?.policySelectionSignalsSnapshot?.unplacedEstimateMinTotal,
  });
}

function deleteCycle(state, cycleId) {
  ensureCycleStructures(state);
  if (!cycleId || !state.cyclesById?.[cycleId]) {
    return;
  }
  const deletingActiveCycle = state.activeCycleId === cycleId;
  const cycle = state.cyclesById[cycleId];
  const goalId =
    cycle?.goalContract?.goalId ||
    cycle?.goalGovernanceContract?.goalId ||
    cycle?.contract?.goalId ||
    cycle?.goalPlan?.goalId ||
    null;
  state.executionEvents = Array.isArray(state.executionEvents)
    ? state.executionEvents.filter((event) => (event?.cycleId || null) !== cycleId)
    : [];
  state.externalEvidenceEvents = Array.isArray(state.externalEvidenceEvents)
    ? state.externalEvidenceEvents.filter((event) => (event?.cycleId || null) !== cycleId)
    : [];
  state.planMutationEvents = Array.isArray(state.planMutationEvents)
    ? state.planMutationEvents.filter((event) => (event?.cycleId || null) !== cycleId)
    : [];
  state.suggestionEvents = Array.isArray(state.suggestionEvents)
    ? state.suggestionEvents.filter((event) => (event?.cycleId || null) !== cycleId)
    : [];
  state.proposedBlocks = Array.isArray(state.proposedBlocks)
    ? state.proposedBlocks.filter((block) => (block?.cycleId || null) !== cycleId)
    : [];
  state.suggestedBlocks = Array.isArray(state.suggestedBlocks)
    ? state.suggestedBlocks.filter((block) => (block?.cycleId || null) !== cycleId)
    : [];
  if (state.proposedBlocksByCycleId && typeof state.proposedBlocksByCycleId === 'object') {
    delete state.proposedBlocksByCycleId[cycleId];
  }
  if (state.blockStore?.blocks && typeof state.blockStore.blocks === 'object') {
    Object.keys(state.blockStore.blocks).forEach((blockId) => {
      const block = state.blockStore.blocks[blockId];
      if (!block) {
        return;
      }
      const blockCycleId = block?.cycleId || null;
      const blockGoalId = block?.goalId || null;
      if (blockCycleId === cycleId || (goalId && blockGoalId === goalId)) {
        delete state.blockStore.blocks[blockId];
      }
    });
  }
  delete state.cyclesById[cycleId];
  if (state.deliverablesByCycleId?.[cycleId]) {
    delete state.deliverablesByCycleId[cycleId];
  }
  if (state.aspirationsByCycleId?.[cycleId]) {
    delete state.aspirationsByCycleId[cycleId];
  }
  if (goalId && state.goalAdmissionByGoal?.[goalId]) {
    delete state.goalAdmissionByGoal[goalId];
  }
  if (state.history?.cycles) {
    state.history.cycles = state.history.cycles.filter((entry) => entry.id !== cycleId);
  }
  if (state.historySignalsByCycleId?.[cycleId]) {
    delete state.historySignalsByCycleId[cycleId];
    rebuildHistoryProfile(state);
  }
  unlinkGoalCycleReference(state, goalId, cycleId);
  if (deletingActiveCycle) {
    // Preserve blocks from other cycles that survived the per-cycle filter above.
    // clearActiveCycleSessionState resets blockStore entirely; we restore survivors after.
    const survivingBlocks = {};
    if (state.blockStore?.blocks) {
      Object.entries(state.blockStore.blocks).forEach(([id, block]) => {
        if (block) survivingBlocks[id] = block;
      });
    }
    clearActiveCycleSessionState(state);
    state.blockStore = { blocks: survivingBlocks };
    // In a master-plan context the master plan manages cycle creation; leave activeCycleId null.
    // In standalone context, create a blank goal-entry-ready cycle so the app is never stranded.
    const hasMasterPlan = Boolean(getActiveMasterPlanRecord(state, null));
    if (!hasMasterPlan) {
      startNewCycle(state, { goalText: ' ', narrative: '', successDefinition: '', minimumDaysPerWeek: 4 });
      resetCycleToGoalEntryReady(state, state.activeCycleId);
    } else {
      state.scheduleLifecycleState = 'inter_cycle';
    }
    state.meta = {
      ...(state.meta || {}),
      goalEntryRequestedAtISO: state.appTime?.nowISO || null,
    };
  }
}

function startNewCycleWithDecision(state, payload = {}) {
  ensureCycleStructures(state);
  const mode = payload?.mode === 'delete' ? 'delete' : 'archive';
  const previousActiveCycleId = state.activeCycleId || null;
  const activeMasterPlan = getActiveMasterPlanRecord(state, payload?.masterPlanId || null);
  const baseCyclePayload = {
    goalText: ' ',
    narrative: '',
    successDefinition: '',
    minimumDaysPerWeek: 4,
  };
  if (activeMasterPlan) {
    if (previousActiveCycleId && state.cyclesById?.[previousActiveCycleId]) {
      if (mode === 'delete') {
        deleteCycle(state, previousActiveCycleId);
      } else {
        endCycle(state, previousActiveCycleId);
      }
    }
    const descriptors = ensureMasterPlanOperationalCycle(state, activeMasterPlan);
    if (descriptors?.cycle?.id) {
      resetActiveCycleExecutionState(state, descriptors.cycle.id);
      state.goalExecutionContract = descriptors.goalContract || state.goalExecutionContract;
      state.activeGoalId = descriptors.goalContract?.goalId || state.activeGoalId || null;
      if (state.activeProfileId && state?.profilesById?.[state.activeProfileId]) {
        state.profilesById[state.activeProfileId].activeGoalId = state.activeGoalId || null;
      }
      state.meta = {
        ...(state.meta || {}),
        goalEntryRequestedAtISO: state.appTime?.nowISO || null,
      };
      assertActiveCycleInvariant(state);
    }
    return;
  }
  if (!previousActiveCycleId || !state.cyclesById?.[previousActiveCycleId]) {
    startNewCycle(state, baseCyclePayload);
    resetCycleToGoalEntryReady(state, state.activeCycleId);
    state.meta = {
      ...(state.meta || {}),
      goalEntryRequestedAtISO: state.appTime?.nowISO || null,
    };
    assertActiveCycleInvariant(state);
    return;
  }

  if (mode === 'delete') {
    deleteCycle(state, previousActiveCycleId);
    startNewCycle(state, baseCyclePayload);
    resetCycleToGoalEntryReady(state, state.activeCycleId);
  } else {
    startNewCycle(state, baseCyclePayload);
    resetCycleToGoalEntryReady(state, state.activeCycleId);
  }

  const activeCycle = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] : null;
  const startDayKey = activeCycle?.startedAtDayKey || state.appTime?.activeDayKey || nowDayKey(state.appTime?.timeZone);
  state.viewDate = startDayKey;
  if (state.appTime) {
    state.appTime.activeDayKey = startDayKey;
  }
  state.meta = {
    ...(state.meta || {}),
    goalEntryRequestedAtISO: state.appTime?.nowISO || null,
  };
  assertActiveCycleInvariant(state);
}

function hardDeleteCycle(state, cycleId) {
  ensureCycleStructures(state);
  if (!cycleId || !state.cyclesById?.[cycleId]) {
    return;
  }
  if (state.activeCycleId === cycleId) {
    clearGoalSessionStateToBlank(state);
  }
  const cycle = state.cyclesById[cycleId];
  const goalId =
    cycle?.goalContract?.goalId ||
    cycle?.goalGovernanceContract?.goalId ||
    cycle?.contract?.goalId ||
    cycle?.goalPlan?.goalId ||
    null;
  state.executionEvents = Array.isArray(state.executionEvents)
    ? state.executionEvents.filter((event) => (event?.cycleId || null) !== cycleId)
    : [];
  state.suggestionEvents = Array.isArray(state.suggestionEvents)
    ? state.suggestionEvents.filter((event) => (event?.cycleId || null) !== cycleId)
    : [];
  state.proposedBlocks = Array.isArray(state.proposedBlocks)
    ? state.proposedBlocks.filter((block) => (block?.cycleId || null) !== cycleId)
    : [];
  state.suggestedBlocks = Array.isArray(state.suggestedBlocks)
    ? state.suggestedBlocks.filter((block) => (block?.cycleId || null) !== cycleId)
    : [];
  if (state.proposedBlocksByCycleId && typeof state.proposedBlocksByCycleId === 'object') {
    delete state.proposedBlocksByCycleId[cycleId];
  }
  if (state.blockStore?.blocks && typeof state.blockStore.blocks === 'object') {
    Object.keys(state.blockStore.blocks).forEach((blockId) => {
      const block = state.blockStore.blocks[blockId];
      if (!block) {
        return;
      }
      const blockCycleId = block?.cycleId || null;
      const blockGoalId = block?.goalId || null;
      if (blockCycleId === cycleId || (goalId && blockGoalId === goalId)) {
        delete state.blockStore.blocks[blockId];
      }
    });
  }
  delete state.cyclesById[cycleId];
  if (state.deliverablesByCycleId?.[cycleId]) {
    delete state.deliverablesByCycleId[cycleId];
  }
  if (state.aspirationsByCycleId?.[cycleId]) {
    delete state.aspirationsByCycleId[cycleId];
  }
  if (goalId && state.goalAdmissionByGoal?.[goalId]) {
    delete state.goalAdmissionByGoal[goalId];
  }
  if (state.history?.cycles) {
    state.history.cycles = state.history.cycles.filter((c) => c.id !== cycleId);
  }
  if (state.historySignalsByCycleId?.[cycleId]) {
    delete state.historySignalsByCycleId[cycleId];
    rebuildHistoryProfile(state);
  }
  if (state.activeCycleId === null) {
    state.meta = {
      ...(state.meta || {}),
      goalEntryRequestedAtISO: state.appTime?.nowISO || null,
    };
    if (getActiveMasterPlanRecord(state, null)) {
      state.scheduleLifecycleState = 'inter_cycle';
    }
  }
}

function endCycle(state, cycleId) {
  ensureCycleStructures(state);
  const id = cycleId || state.activeCycleId;
  if (!id || !state.cyclesById?.[id]) {
    return;
  }
  const cycle = state.cyclesById[id];
  if (cycle.status === 'ended') {
    return;
  }
  const todayKey = state.appTime?.activeDayKey || state.today?.date || nowDayKey();
  cycle.status = 'ended';
  cycle.endedAtDayKey = todayKey;

  // MVP 3.0: Compute terminal convergence
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const timezone = state.appTime?.timeZone || 'UTC';
  const rawEntry = state.deliverablesByCycleId?.[cycle.id];
  const deliverables =
    (Array.isArray(rawEntry) ? rawEntry : Array.isArray(rawEntry?.deliverables) ? rawEntry.deliverables : []) || [];
  const convergenceReport = computeTerminalConvergence({
    cycle,
    planProof: cycle?.goalPlan?.planProof || null,
    events: cycle?.executionEvents || state.executionEvents || [],
    nowISO,
    timezone,
    deliverables,
  });
  logGenerateDiagnostics({
    state,
    traceId: `trace-${cycle.id}-convergence`,
    cycleId: cycle.id,
    goalId: cycle?.goalContract?.goalId || cycle?.goalGovernanceContract?.goalId || cycle?.contract?.goalId || null,
    moduleName: 'endCycle',
    stepName: 'computeTerminalConvergence',
    status: 'ok',
    inputSummary: {
      cycleStatus: cycle.status || null,
      deliverablesCount: Array.isArray(deliverables) ? deliverables.length : 0,
      executionEventsCount: Array.isArray(cycle?.executionEvents || state.executionEvents)
        ? (cycle?.executionEvents || state.executionEvents || []).length
        : 0,
      deadlineDayKey: cycle?.definiteGoal?.deadlineDayKey || null,
    },
    outputSummary: {
      verdict: convergenceReport?.verdict || null,
      reasons: convergenceReport?.reasons || [],
      pEndIds: (convergenceReport?.P_end?.deliverables || []).map((d) => d.deliverableId),
      eEndIds: (convergenceReport?.E_end?.deliverables || []).map((d) => d.deliverableId),
      eEndCounts: (convergenceReport?.E_end?.deliverables || []).map((d) => d.completedBlocks),
      completedUnits: convergenceReport?.E_end?.completedUnits ?? 0,
      unlinkedActivityBlocks: convergenceReport?.E_end?.unlinkedActivityBlocks ?? 0,
    },
    reasonCodes: [],
  });
  cycle.convergenceReport = convergenceReport;

  cycle.summary = summarizeCycle(cycle);
  const historySignals = collectCycleHistorySignals(state, cycle);
  if (historySignals) {
    state.historySignalsByCycleId[cycle.id] = historySignals;
    rebuildHistoryProfile(state);
  }
  state.cyclesById[id] = cycle;
  // Archive behavior: remove from active execution and clear active UI projections
  if (state.activeCycleId === id) {
    state.activeCycleId = null;
    state.activeGoalId = null;
    if (state.activeProfileId && state?.profilesById?.[state.activeProfileId]) {
      state.profilesById[state.activeProfileId].activeGoalId = null;
    }
    state.goalExecutionContract = null;
    state.today = { ...(state.today || {}), blocks: [] };
    state.currentWeek = { ...(state.currentWeek || {}), days: [] };
    state.cycle = [];
    state.proposedBlocks = [];
    state.suggestedBlocks = [];
    state.suggestionEvents = [];
    state.executionEvents = [];
    state.externalEvidenceEvents = [];
    state.planMutationEvents = [];
    state.truthEntries = [];
    state.scheduleLifecycle = 'no_schedule';
    state.scheduleApplied = false;
    state.scheduleReviewBlocks = [];
    state.draftScheduleAppliedAtISO = null;
    state.pendingPlanConfirmation = false;
  }
  unlinkGoalCycleReference(state, cycle.goalId || cycle.goalContract?.goalId || cycle.goalGovernanceContract?.goalId || null, id);
}

/**
 * Archive the active cycle and create a new editable draft from its contract.
 * Used when plan generation fails (e.g., DEADLINE_INVALID) to allow fixing the goal.
 */
function archiveAndCloneCycle(state, cycleId, overrides = {}) {
  ensureCycleStructures(state);
  const id = cycleId || state.activeCycleId;
  if (!id || !state.cyclesById?.[id]) {
    return;
  }

  const cycle = state.cyclesById[id];
  const contractToClone = cycle.goalContract;

  if (!contractToClone) {
    state.lastPlanError = {
      code: 'CLONE_FAILED',
      reasons: ['No goal contract found to clone'],
      timestamp: state.appTime?.nowISO || new Date().toISOString(),
    };
    return;
  }

  // STEP 1: Archive current cycle (mark ended but preserve history)
  endCycle(state, id);

  // STEP 2: Create new draft with fresh contract (clearing inscription hash for editing)
  const newContractDraft = {
    ...(structuredClone ? structuredClone(contractToClone) : JSON.parse(JSON.stringify(contractToClone))),
    admissionStatus: 'PENDING', // Reset to draft status
    admissionAttemptCount: 0,
    rejectionCodes: [],
    ...overrides,
  };

  // Clear inscription to allow editing
  if (newContractDraft.inscription) {
    newContractDraft.inscription.contractHash = null;
    newContractDraft.inscription.inscribedAt = null;
  }

  // STEP 3: Store as editable draft (not auto-admitted)
  if (!state.aspirations) {
    state.aspirations = [];
  }
  const draftId = nextDeterministicId(state, 'asp-draft');
  const draftEntry = {
    id: draftId,
    createdAtISO: state.appTime?.nowISO || new Date().toISOString(),
    contractDraft: newContractDraft,
    source: 'archive-clone',
    sourceGoalId: contractToClone.goalId,
    sourceReason: 'User correcting goal after admission',
  };

  state.aspirations.push(draftEntry);

  // Optional: Mark this as the active draft for display
  state.activeAspirationId = draftId;

  // Clear the plan error since user is taking action
  state.lastPlanError = null;
}

function generatePlan(state, payload = {}) {
  const debugPerfActions = isRuntimeEnvFlagEnabled('JERICHO_DEBUG_PERF_ACTIONS');
  const perfGenerateStart = debugPerfActions ? Date.now() : 0;
  const explicitCycleId = payload?.cycleId || null;
  const targetCycleId = explicitCycleId || state.activeCycleId || null;
  const cycle = explicitCycleId ? state?.cyclesById?.[explicitCycleId] || null : getTargetCycle(state, targetCycleId);
  const activeMasterPlan = getActiveMasterPlanRecord(state, payload?.masterPlanId || null);
  const shouldUseMasterPlanBridge = Boolean(
    activeMasterPlan &&
      ((!cycle && !targetCycleId) ||
        cycle?.source === 'master_plan' ||
        cycle?.masterPlanId === activeMasterPlan.id ||
        payload?.source === 'MASTER_PLAN_FIRST_CYCLE')
  );
  if (shouldUseMasterPlanBridge) {
    generateMasterPlanFirstCycle(state, payload);
    return;
  }
  const cycleIdForLog = cycle?.id || targetCycleId || null;
  const deliverableCount = Number(state?.deliverablesByCycleId?.[cycleIdForLog]?.deliverables?.length || 0);
  const llmActionCount = Number(cycle?.llmActionGraph?.actions?.length || 0);
  const cycleActionCount = Number(cycle?.actions?.length || 0);
  const actionCount = Math.max(llmActionCount, cycleActionCount);
  const contract = recoverCanonicalContractForCycle(
    state,
    cycle,
    getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null)
  );
  if (!cycle) {
    state.lastPlanError = {
      code: 'CYCLE_TARGET_INVALID',
      reason: 'Target cycle is missing or unavailable.',
      cycleId: targetCycleId || null,
    };
    setGenerateHeartbeat(state, targetCycleId, 0, 'CYCLE_TARGET_INVALID');
    logGenerateDiagnostics({
      state,
      cycleId: cycleIdForLog,
      deliverableCount,
      actionCount,
      rawWorkWindowsCount: 0,
      normalizedCandidateWindowCount: 0,
      proposedBlocks: state.proposedBlocks || [],
      lastPlanErrorCode: 'CYCLE_TARGET_INVALID',
    });
    return;
  }
  if (String(cycle?.reassessmentStatus || '').trim().toLowerCase() === 'required') {
    state.lastPlanError = {
      code: 'CURRENT_STATE_REASSESSMENT_REQUIRED',
      reason: 'Complete current-state reassessment before generating a schedule for this execution cycle.',
      cycleId: cycle.id || targetCycleId,
    };
    setGenerateHeartbeat(state, cycle.id || targetCycleId, 0, 'CURRENT_STATE_REASSESSMENT_REQUIRED');
    return;
  }
  const currentScheduleLifecycle = getCycleScheduleLifecycle(cycle, state);
  if (isCycleReadOnly(cycle)) {
    state.lastPlanError = {
      code: 'CYCLE_READ_ONLY',
      reason: 'Cannot generate schedule for an ended or archived cycle.',
      cycleId: cycle.id || targetCycleId,
      details: {
        status: cycle.status || cycle.state || null,
      },
    };
    setGenerateHeartbeat(state, cycle.id || targetCycleId, 0, 'CYCLE_READ_ONLY');
    logGenerateDiagnostics({
      state,
      cycleId: cycle.id || targetCycleId,
      deliverableCount,
      actionCount,
      rawWorkWindowsCount: 0,
      normalizedCandidateWindowCount: 0,
      proposedBlocks: state.proposedBlocks || [],
      lastPlanErrorCode: 'CYCLE_READ_ONLY',
    });
    return;
  }
  if (currentScheduleLifecycle === 'active_schedule') {
    const canonicalCycleBlocks = getAllBlocks(state).filter((block) => block?.cycleId === cycle.id);
    if (canonicalCycleBlocks.length === 0) {
      cycle.scheduleLifecycle = 'stale_draft_invalidated';
      state.scheduleLifecycle = 'stale_draft_invalidated';
    } else {
      state.lastPlanError = {
        code: 'REGENERATE_BLOCKED_ACTIVE_SCHEDULE',
        reason: 'Active schedules must be rescheduled or rebuilt explicitly.',
        cycleId: cycle.id || targetCycleId,
        goalId: contract?.goalId || null,
      };
      setGenerateHeartbeat(state, cycle.id || targetCycleId, 0, 'REGENERATE_BLOCKED_ACTIVE_SCHEDULE');
      logGenerateDiagnostics({
        state,
        cycleId: cycle.id || targetCycleId,
        deliverableCount,
        actionCount,
        rawWorkWindowsCount: 0,
        normalizedCandidateWindowCount: 0,
        proposedBlocks: state.proposedBlocks || [],
        lastPlanErrorCode: 'REGENERATE_BLOCKED_ACTIVE_SCHEDULE',
        reasonCodes: ['REGENERATE_BLOCKED_ACTIVE_SCHEDULE'],
      });
      return;
    }
  }
  state.draftScheduleAppliedAtISO = null;
  state.scheduleApplied = false;
  state.pendingPlanConfirmation = false;
  if (
    currentScheduleLifecycle === 'applied_review' &&
    Array.isArray(cycle.scheduleReviewBlocks) &&
    cycle.scheduleReviewBlocks.length
  ) {
    cycle.scheduleReviewBlocks = [];
    cycle.scheduleAppliedAtISO = null;
    cycle.scheduleLifecycle = 'stale_draft_invalidated';
    state.scheduleLifecycle = 'stale_draft_invalidated';
  }
  const contractWorkWindows = contract?.workWindows || cycle?.goalContract?.workWindows || null;
  const stateWeeklyWindows = state?.constraints?.weeklyWindows || state?.availabilityPolicy?.weeklyWindows || {};
  const contractWeeklyWindows = toSchedulerWeeklyWindows(contractWorkWindows);
  const hasContractWeeklyWindows = hasAnySchedulerWindows(contractWeeklyWindows);
  const stateHasExplicitWeeklyWindows = hasAnySchedulerWindows(stateWeeklyWindows);
  const weeklyWindows = hasContractWeeklyWindows ? contractWeeklyWindows : stateWeeklyWindows;
  const hasExplicitWeeklyWindows = hasAnySchedulerWindows(weeklyWindows);
  const windowsMode = hasContractWeeklyWindows
    ? 'contract_work_windows'
    : stateHasExplicitWeeklyWindows
      ? 'explicit_windows'
      : 'legacy_days_allowed';
  const dayEndAtHHMM = state?.constraints?.dayEndAtHHMM || state?.availabilityPolicy?.dayEndAtHHMM || '23:59';
  const weeklyCapMinutes = computeWeeklyCapacityFromWorkWindows(contractWorkWindows);
  const rawWorkWindowsCount = countRawWorkWindows(contractWorkWindows);
  const normalizedCandidateWindowCount = countNormalizedSchedulerWindows(weeklyWindows);
  const baseErrorMeta = {
    cycleId: cycle.id || targetCycleId,
    startISO: contract?.startDateISO || (contract?.startDayKey ? `${contract.startDayKey}T00:00:00.000Z` : null),
    endISO: contract?.endDateISO || (contract?.endDayKey ? `${contract.endDayKey}T23:59:59.000Z` : null),
    windowsMode,
    dayEndAtHHMM,
    weeklyCapMinutes,
  };
  if (!contract) {
    setCycleProposedBlocks(state, cycle.id || targetCycleId, []);
    state.lastPlanError = {
      code: 'NO_ACTION_GRAPH',
      reason: 'No admitted goal contract is available for schedule generation.',
      cycleId: cycle.id || targetCycleId,
      reasonCodes: ['NO_ACTION_GRAPH'],
      conflicts: [],
      meta: baseErrorMeta,
    };
    setGenerateHeartbeat(state, cycle.id || targetCycleId, 0, 'NO_ACTION_GRAPH');
    logGenerateDiagnostics({
      state,
      cycleId: cycle?.id || targetCycleId,
      deliverableCount,
      actionCount,
      rawWorkWindowsCount,
      normalizedCandidateWindowCount,
      proposedBlocks: state.proposedBlocks || [],
      lastPlanErrorCode: state.lastPlanError?.code || 'NO_ACTION_GRAPH',
    });
    return;
  }
  if (!contract.goalId) {
    const recoverySnapshot = {
      cycleId: cycle.id || targetCycleId,
      activeGoalId: state?.activeGoalId || null,
      goalExecutionContractGoalId: state?.goalExecutionContract?.goalId || null,
      planDraftGoalId: state?.planDraft?.goalId || null,
      cycleGoalContractGoalId: cycle?.goalContract?.goalId || null,
      cycleGovernanceGoalId: cycle?.goalGovernanceContract?.goalId || null,
      cycleLegacyContractGoalId: cycle?.contract?.goalId || null,
      singleGoalWorkId: Object.keys(state?.goalWorkById || {}).filter(Boolean),
      admissionGoalIds: Object.keys(state?.goalAdmissionByGoal || {}).filter(Boolean),
      deliverableWorkspaceCycleIds: Object.keys(state?.deliverablesByCycleId || {}).filter(Boolean),
      definiteGoalOutcome: cycle?.definiteGoal?.outcome || null,
      definiteGoalDeadlineDayKey: cycle?.definiteGoal?.deadlineDayKey || null,
      startedAtDayKey: cycle?.startedAtDayKey || null,
    };
    setCycleProposedBlocks(state, cycle.id || targetCycleId, []);
    state.lastPlanError = {
      code: 'GOAL_ID_MISSING',
      reason: 'Active cycle goal contract is missing goalId; generation cannot bind canonical proposals.',
      cycleId: cycle.id || targetCycleId,
      reasonCodes: ['GOAL_ID_MISSING'],
      conflicts: [],
      meta: {
        ...baseErrorMeta,
        recoverySnapshot,
      },
    };
    setGenerateHeartbeat(state, cycle.id || targetCycleId, 0, 'GOAL_ID_MISSING');
    logGenerateDiagnostics({
      state,
      cycleId: cycle.id || targetCycleId,
      deliverableCount,
      actionCount,
      rawWorkWindowsCount,
      normalizedCandidateWindowCount,
      proposedBlocks: state.proposedBlocks || [],
      lastPlanErrorCode: 'GOAL_ID_MISSING',
      inputSummary: recoverySnapshot,
    });
    return;
  }
  const admission = state.goalAdmissionByGoal?.[contract.goalId] || cycle.goalAdmission;
  if (admission && !isAdmittedGoalStatus(admission.status)) {
    state.lastPlanError = {
      code: 'GOAL_NOT_ADMITTED',
      reason: (admission.reasonCodes || []).join(', ') || 'Goal not admitted',
      cycleId: cycle.id,
      goalId: contract.goalId,
    };
    setGenerateHeartbeat(state, cycle.id, 0, 'GOAL_NOT_ADMITTED');
    logGenerateDiagnostics({
      state,
      cycleId: cycle.id,
      deliverableCount,
      actionCount,
      rawWorkWindowsCount,
      normalizedCandidateWindowCount,
      proposedBlocks: state.proposedBlocks || [],
      lastPlanErrorCode: 'GOAL_NOT_ADMITTED',
    });
    return;
  }
  const timeZone = state.appTime?.timeZone || 'UTC';
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const nowDayKeyFromClock = dayKeyFromISO(nowISO, timeZone) || null;
  const requestedAnchorDayKey = coerceDayKey(payload?.anchorDayKey, timeZone) || null;
  const activeDayKey = state.appTime?.activeDayKey || null;
  const effectiveViewAnchorDayKey =
    maxDayKey(requestedAnchorDayKey, activeDayKey) || requestedAnchorDayKey || activeDayKey || nowDayKeyFromClock;
  const contractStartDayKey =
    coerceDayKey(contract.startDayKey, timeZone) ||
    coerceDayKey(contract.startDateISO, timeZone) ||
    coerceDayKey(contract.startDate, timeZone) ||
    coerceDayKey(contract.temporalBinding?.startDayKey, timeZone) ||
    null;
  const contractEndDayKey =
    coerceDayKey(contract.endDayKey, timeZone) ||
    coerceDayKey(contract.deadline?.dayKey, timeZone) ||
    coerceDayKey(contract.endDateISO, timeZone) ||
    coerceDayKey(contract.deadlineISO, timeZone) ||
    coerceDayKey(contract.deadline, timeZone) ||
    coerceDayKey(cycle?.goalGovernanceContract?.activeUntilISO, timeZone) ||
    coerceDayKey(cycle?.definiteGoal?.deadlineDayKey, timeZone) ||
    coerceDayKey(state?.goalExecutionContract?.endDayKey, timeZone) ||
    coerceDayKey(state?.goalExecutionContract?.deadline?.dayKey, timeZone) ||
    coerceDayKey(state?.goalExecutionContract?.deadlineISO, timeZone) ||
    null;
  const intakeContract =
    contract?.goalIntakeContract ||
    buildGoalIntakeContract({
      goalId: contract?.goalId || cycle?.goalContract?.goalId || null,
      rawGoalText:
        contract?.goalText ||
        contract?.goalLabel ||
        contract?.terminalOutcome?.text ||
        contract?.terminalOutcome?.verificationCriteria ||
        cycle?.goalDraftV2?.goalText ||
        cycle?.goalDraftV2?.goalLabel ||
        '',
      verificationCriteria: contract?.terminalOutcome?.verificationCriteria || '',
      executionType: contract?.executionType || cycle?.goalDraftV2?.executionType || null,
      deadline: contractEndDayKey || contract?.deadline?.dayKey || contract?.deadlineISO || null,
      goalDraftV2: cycle?.goalDraftV2 || contract?.goalDraftV2 || null,
      contract,
      answeredContext:
        cycle?.goalDraftV2?.answeredContext ||
        contract?.goalDraftV2?.answeredContext ||
        state?.pendingOnboardingInputs?.answeredContext ||
        undefined,
    });
  if (!intakeContract.readiness.isReadyForPlanning) {
    cycle.autoAsanaPlan = null;
    cycle.planStatus = 'error';
    cycle.planGenerationSource = cycle.planGenerationSource || 'SYSTEM';
    setCycleProposedBlocks(state, cycle.id, []);
    const intakeCode = getIntakeGateCode(intakeContract);
    state.lastPlanError = {
      code: intakeCode,
      reason: intakeContract.requiredContextQuestions[0]?.prompt || 'Goal intake is not ready for planning.',
      cycleId: cycle.id,
      goalId: contract.goalId,
      reasonCodes: [intakeContract.requiredContextQuestions[0]?.reasonCode || intakeCode],
      conflicts: [],
      meta: baseErrorMeta,
    };
    state.planRecovery = {
      required: 'INTAKE_SCOPE_RESOLUTION',
      route: 'STRUCTURE_INTAKE',
      prefill: {
        goalContract: {
          ...contract,
          goalIntakeContract: intakeContract,
        },
        goalDraftV2: cycle?.goalDraftV2 || contract?.goalDraftV2 || null,
      },
      sourceErrorCode: intakeCode,
      createdAtISO: nowISO,
    };
    setGenerateHeartbeat(state, cycle.id, 0, intakeCode);
    logGenerateDiagnostics({
      state,
      cycleId: cycle.id,
      deliverableCount,
      actionCount,
      rawWorkWindowsCount,
      normalizedCandidateWindowCount,
      proposedBlocks: state.proposedBlocks || [],
      lastPlanErrorCode: state.lastPlanError?.code || intakeCode,
    });
    state.cyclesById[cycle.id] = cycle;
    return;
  }
  const schedulerStartDayKey =
    maxDayKey(nowDayKeyFromClock, contractStartDayKey) ||
    contractStartDayKey ||
    nowDayKeyFromClock ||
    effectiveViewAnchorDayKey ||
    nowDayKey(timeZone);
  const anchorNowISO = `${schedulerStartDayKey}T12:00:00.000Z`;
  const fallbackSessionCount = Number(Array.isArray(cycle?.llmSessionPlan) ? cycle.llmSessionPlan.length : 0);
  const fallbackActionCount = Number(getCanonicalCycleActions(cycle).length || 0);
  const minimumFallbackHorizonDays = Math.max(90, fallbackSessionCount, fallbackActionCount);
  const fullHorizonDays = contractEndDayKey
    ? Math.max(1, daysBetween(schedulerStartDayKey, contractEndDayKey) + 1)
    : Math.max(14, minimumFallbackHorizonDays);
  const horizonDays = Math.max(1, fullHorizonDays);
  const plan = state.planDraft || cycle.planDraft;
  const planProof =
    cycle.planProof ||
    (cycle.goalEquation ? derivePlanProof(cycle.goalEquation, { nowDayKey: schedulerStartDayKey, timeZone }) : null);
  if (!planProof) {
    cycle.autoAsanaPlan = null;
    setCycleProposedBlocks(state, cycle.id, []);
    state.lastPlanError = {
      code: 'NO_ACTION_GRAPH',
      reason: 'Action graph was not available for scheduling.',
      cycleId: cycle.id,
      goalId: contract.goalId,
      reasonCodes: ['NO_ACTION_GRAPH'],
      conflicts: [],
      meta: baseErrorMeta,
    };
    setGenerateHeartbeat(state, cycle.id, 0, 'NO_ACTION_GRAPH');
    logGenerateDiagnostics({
      state,
      cycleId: cycle.id,
      deliverableCount,
      actionCount,
      rawWorkWindowsCount,
      normalizedCandidateWindowCount,
      proposedBlocks: state.proposedBlocks || [],
      lastPlanErrorCode: state.lastPlanError?.code || 'NO_ACTION_GRAPH',
    });
    state.cyclesById[cycle.id] = cycle;
    return;
  }

  cycle.planProof = planProof;
  const scopedConstraints = resolveCycleScopedConstraints(state, cycle, timeZone);
  const planningIntake =
    cycle?.goalContract?.planningIntake || cycle?.goalContract?.goalIntakeContract?.planningIntake || {};
  const weeklyHoursAvailableRaw = Number(planningIntake?.weeklyHoursAvailable);
  const weeklyHoursAvailable =
    Number.isFinite(weeklyHoursAvailableRaw) && weeklyHoursAvailableRaw > 0 ? weeklyHoursAvailableRaw : 7;
  const executionContext = String(planningIntake?.executionContext || 'part_time').trim().toLowerCase() || 'part_time';
  const maxDailySessionCap = 3;
  let derivedSessionsPerWeek = 0;
  const pacingNotes = [];
  if (weeklyHoursAvailable < 5) {
    derivedSessionsPerWeek = Math.max(1, Math.floor(weeklyHoursAvailable));
    pacingNotes.push(
      `At ${weeklyHoursAvailable} hours per week, this plan will take longer; schedule density reflects that pace.`
    );
  } else if (weeklyHoursAvailable < 15) {
    derivedSessionsPerWeek = Math.max(1, Math.floor(weeklyHoursAvailable));
  } else {
    derivedSessionsPerWeek = Math.min(Math.floor(weeklyHoursAvailable), maxDailySessionCap * 5);
    pacingNotes.push('High availability detected. Sessions are capped at 3 per day to maintain sustainable pace.');
  }
  if (executionContext === 'part_time') {
    derivedSessionsPerWeek = Math.max(1, Math.floor(derivedSessionsPerWeek * 0.8));
  }
  const blackoutDates = new Set([...(Array.isArray(scopedConstraints?.blackoutDates) ? scopedConstraints.blackoutDates : [])]);
  const planningBlackouts = Array.isArray(planningIntake?.blackoutPeriods) ? planningIntake.blackoutPeriods : [];
  planningBlackouts.forEach((period) => {
    let cursor = String(period?.start || '').trim();
    const endDayKey = String(period?.end || '').trim();
    let guard = 0;
    while (/^\d{4}-\d{2}-\d{2}$/.test(cursor) && /^\d{4}-\d{2}-\d{2}$/.test(endDayKey) && cursor <= endDayKey && guard < 5000) {
      blackoutDates.add(cursor);
      const next = addDays(cursor, 1, timeZone);
      if (!next || next === cursor) {
        break;
      }
      cursor = next;
      guard += 1;
    }
  });
  const constraints = {
    ...scopedConstraints,
    timezone: timeZone,
    weeklyWindows,
    dayEndAtHHMM: scopedConstraints?.dayEndAtHHMM || state?.availabilityPolicy?.dayEndAtHHMM,
    cycleStartDayKey: contractStartDayKey,
    cycleEndDayKey: contractEndDayKey,
    blackoutDates: Array.from(blackoutDates).sort(),
  };
  const recurringText = `${contract?.goalText || ''} ${contract?.goalLabel || ''} ${
    contract?.terminalOutcome?.text || ''
  } ${contract?.terminalOutcome?.verificationCriteria || ''}`.toLowerCase();
  const isRecurringLongHorizon =
    contract?.executionType === 'recurring' ||
    contract?.cadence?.type === 'recurring' ||
    contract?.recurrence?.type === 'recurring' ||
    /\b(daily|weekly|monthly|every\s+(day|week|month)|per\s+(day|week|month)|cadence|recurring|ongoing)\b/.test(
      recurringText
    );
  constraints.longHorizonNonRecurring = horizonDays >= 180 && !isRecurringLongHorizon;
  constraints.earlyCompletionJustification = contract?.earlyCompletionJustification || null;
  const horizonEnd = addDays(schedulerStartDayKey, Math.max(0, horizonDays - 1), timeZone);
  const { days } = materializeBlocksFromEvents(state.executionEvents || [], { todayISO: state.today?.date });
  const acceptedBlocks = (days || []).flatMap((d) =>
    (d.blocks || []).filter((b) => {
      if (!b || b?.cycleId !== cycle.id) {
        return false;
      }
      if (d?.date && contractEndDayKey && d.date > contractEndDayKey) {
        return false;
      }
      return true;
    })
  );
  const actionSequence = getCanonicalCycleActions(cycle);
  const actionDeliverables = getCanonicalCycleDeliverables(
    state?.deliverablesByCycleId || {},
    cycle?.id || null,
    cycle
  );
  const actionSequenceWithDeliverableIds = annotateActionsWithDeliverableIds(cycle, actionSequence, actionDeliverables);
  const explicitMaxPerWeek = Number(scopedConstraints?.maxBlocksPerWeek);
  const strategyMaxPerWeek = Number(cycle?.strategy?.constraints?.maxBlocksPerWeek);
  const horizonWeeks = Math.max(1, Math.ceil(horizonDays / 7));
  const sessionPlanCount = Number(Array.isArray(cycle?.llmSessionPlan) ? cycle.llmSessionPlan.length : 0);
  const schedulingDemandCount = Math.max(1, actionSequence.length, sessionPlanCount);
  const derivedMaxPerWeek = Math.max(1, Math.ceil(schedulingDemandCount / horizonWeeks));
  const resolvedMaxPerWeek =
    Number.isFinite(explicitMaxPerWeek) && explicitMaxPerWeek > 0
      ? explicitMaxPerWeek
      : Number.isFinite(strategyMaxPerWeek) && strategyMaxPerWeek > 0
        ? strategyMaxPerWeek
        : Math.max(1, derivedSessionsPerWeek || derivedMaxPerWeek);
  const explicitMaxPerDay = Number(scopedConstraints?.maxBlocksPerDay);
  const strategyMaxPerDay = Number(cycle?.strategy?.constraints?.maxBlocksPerDay);
  const resolvedMaxPerDay =
    Number.isFinite(explicitMaxPerDay) && explicitMaxPerDay > 0
      ? explicitMaxPerDay
      : Number.isFinite(strategyMaxPerDay) && strategyMaxPerDay > 0
        ? strategyMaxPerDay
        : Math.max(1, Math.min(maxDailySessionCap, Math.ceil(resolvedMaxPerWeek / 5)));
  constraints.maxBlocksPerWeek = resolvedMaxPerWeek;
  constraints.maxBlocksPerDay = resolvedMaxPerDay;
  const perfCompileStart = debugPerfActions ? Date.now() : 0;
  const compiledPlan = compileAutoAsanaPlan({
    goalId: contract.goalId,
    cycleId: cycle.id,
    planProof,
    constraints,
    nowISO: anchorNowISO,
    horizonDays,
    acceptedBlocks,
    actionSequence: actionSequenceWithDeliverableIds,
    sessionPlan: Array.isArray(cycle?.llmSessionPlan) ? cycle.llmSessionPlan : [],
  });
  if (compiledPlan?.summary) {
    compiledPlan.summary.pacingNotes = pacingNotes;
    if (cycle?.goalContract?.feasibilityAssessment) {
      compiledPlan.summary.feasibilityAssessment = cycle.goalContract.feasibilityAssessment;
    }
  }
  const perfCompileMs = debugPerfActions ? Date.now() - perfCompileStart : 0;
  logGenerateDiagnostics({
    state,
    traceId: `trace-${cycle.id}-propose`,
    cycleId: cycle.id,
    goalId: contract?.goalId || null,
    moduleName: 'compileAutoAsanaPlan',
    stepName: 'complete',
    status: compiledPlan?.horizonBlocks?.length > 0 ? 'ok' : 'fail',
    inputSummary: {
      actionSequenceCount: actionSequenceWithDeliverableIds?.length || 0,
      sessionPlanCount,
      acceptedBlocksCount: acceptedBlocks.length,
      horizonDays,
      resolvedMaxPerWeek,
      resolvedMaxPerDay,
    },
    outputSummary: {
      horizonBlocksCount: compiledPlan?.horizonBlocks?.length || 0,
      placedDayKeys: (compiledPlan?.horizonBlocks || []).map((b) => b?.dayKey).filter(Boolean),
      conflictCodes: (compiledPlan?.conflicts || [])
        .map((conflict) => String(conflict?.code || conflict?.kind || '').trim())
        .filter(Boolean)
        .join(', '),
    },
    lastPlanErrorCode: compiledPlan?.horizonBlocks?.length > 0 ? null : 'NO_PROPOSED_BLOCKS',
    reasonCodes: [],
  });
  cycle.autoAsanaPlan = compiledPlan;
  const candidateResolutionKinds = Array.isArray(compiledPlan?.summary?.candidateResolutionKinds)
    ? compiledPlan.summary.candidateResolutionKinds
    : [];
  if (cycle.selectedPlanResolutionKind && !candidateResolutionKinds.includes(cycle.selectedPlanResolutionKind)) {
    cycle.selectedPlanResolutionKind = null;
  }
  const suggestions = (cycle.autoAsanaPlan?.horizonBlocks || []).map((block, index) => ({
    id: block.identityKey || block.id || `suggested:auto:${cycle.id}:${index}`,
    goalId: contract.goalId,
    cycleId: cycle.id,
    status: 'suggested',
    title: block.title || 'Scheduled action',
    domain: plan?.primaryDomain || 'FOCUS',
    durationMinutes: Number(block.durationMinutes) || 30,
    createdAtISO: nowISO,
    startISO: block.startISO,
    endISO: block.endISO || null,
    dayKey: block.dayKey,
    identityKey: block.identityKey || null,
    deliverableId: block.deliverableId || null,
    actionId: block.actionId || null,
    directDependencyIds: Array.isArray(block.directDependencyIds) ? [...block.directDependencyIds] : [],
    directDependencyDetails: Array.isArray(block.directDependencyDetails) ? [...block.directDependencyDetails] : [],
    transitiveDependencyIds: Array.isArray(block.transitiveDependencyIds) ? [...block.transitiveDependencyIds] : [],
    transitiveDependencyDetails: Array.isArray(block.transitiveDependencyDetails)
      ? [...block.transitiveDependencyDetails]
      : [],
    commerceReadinessLevel: block.commerceReadinessLevel || null,
    placementBasis: block.placementBasis || 'confirmed',
    assumedDependencies: Array.isArray(block.assumedDependencies) ? [...block.assumedDependencies] : [],
    blockType: block.blockType || 'execution',
    owner: block.owner,
    producesArtifact: block.producesArtifact,
    consumedBy: Array.isArray(block.consumedBy) ? [...block.consumedBy] : block.consumedBy,
    passEvidence: block.passEvidence,
    consumedByRef: block.consumedByRef ? { ...block.consumedByRef } : block.consumedByRef,
    waitType: block.waitType || null,
    minimumDurationBusinessDays: block.minimumDurationBusinessDays || null,
    parallelWorkSuggestions: Array.isArray(block.parallelWorkSuggestions) ? [...block.parallelWorkSuggestions] : [],
    requiredWorkFamily: block.requiredWorkFamily || null,
    capitalGateId: block.capitalGateId || null,
    pathwayTag: block.pathwayTag || null,
    sessionIndex: Number.isFinite(block.sessionIndex) ? Number(block.sessionIndex) : index,
    source: 'action_graph',
  }));
  setCycleProposedBlocks(state, cycle.id, suggestions);
  suggestions.forEach((suggestion) => {
    appendTransitionTrace(state, {
      transition: 'generate',
      blockId: suggestion.id || null,
      label: suggestion.title || '',
    });
  });
  state.suggestionEvents = state.suggestionEvents || [];
  state.suggestionEvents.push({
    id: nextDeterministicId(state, `sev-suggestions-${contract.goalId}`),
    type: 'suggestions_generated',
    proposalIds: suggestions.map((s) => s.id),
    goalId: contract.goalId,
    atISO: nowISO,
  });
  const perfPreviewStart = debugPerfActions ? Date.now() : 0;
  state.planPreview = computePlanPreview({
    suggestedBlocks: state.proposedBlocks || [],
    planDraft: state.planDraft,
    contract,
    policyState: getCurrentPolicyState(state),
    historyProfile: buildHistoryProfileForDraft(state, state.planDraft),
    timeZone: state.appTime?.timeZone || APP_TIME_ZONE,
  });
  const perfPreviewMs = debugPerfActions ? Date.now() - perfPreviewStart : 0;
  const suggestedCount = (state.proposedBlocks || []).filter((item) => item?.status === 'suggested').length;
  if (suggestedCount === 0) {
    const conflictCodes = Array.from(
      new Set(
        (cycle.autoAsanaPlan?.conflicts || [])
          .map((conflict) => String(conflict?.code || conflict?.kind || '').trim())
          .filter(Boolean)
      )
    );
    const normalizedConflicts = conflictCodes
      .map((code) => code.toUpperCase())
      .filter(Boolean)
      .sort()
      .slice(0, 5);
    const reasonCodes = [];
    const hasWindowsConfigured = hasExplicitWeeklyWindows;
    const hasAnyWindowRange = Object.values(weeklyWindows || {}).some(
      (rows) => Array.isArray(rows) && rows.some((row) => row?.startHHMM && row?.endHHMM && row.startHHMM < row.endHHMM)
    );
    if (normalizedConflicts.includes('NO_ALLOWED_WINDOWS') || (hasWindowsConfigured && !hasAnyWindowRange)) {
      reasonCodes.push('NO_ALLOWED_WINDOWS');
    }
    if (normalizedConflicts.includes('OUT_OF_CYCLE_RANGE') || normalizedConflicts.includes('FILTERED_OUT_OF_RANGE')) {
      reasonCodes.push('OUT_OF_CYCLE_RANGE');
    }
    if (normalizedConflicts.includes('OVERLAP_ALL_SLOTS')) {
      reasonCodes.push('OVERLAP_ALL_SLOTS');
    }
    if (normalizedConflicts.includes('CLAMP_FILTERED_ALL')) {
      reasonCodes.push('CLAMP_FILTERED_ALL');
    }
    if (!reasonCodes.length || normalizedConflicts.includes('UNSCHEDULABLE')) {
      reasonCodes.push('UNSCHEDULABLE');
    }
    const stableReasonOrder = [
      'NO_ALLOWED_WINDOWS',
      'OUT_OF_CYCLE_RANGE',
      'OVERLAP_ALL_SLOTS',
      'CLAMP_FILTERED_ALL',
      'UNSCHEDULABLE',
    ];
    const orderedReasonCodes = stableReasonOrder.filter((code) => reasonCodes.includes(code));
    const alreadyFullyScheduled = normalizedConflicts.length === 0 && sessionPlanCount > 0 && acceptedBlocks.length > 0;
    const planSummary = cycle?.autoAsanaPlan?.summary || null;
    const isHorizonInsufficient = String(planSummary?.planStatus || '').toUpperCase() === 'VALID_BUT_HORIZON_INSUFFICIENT';
    if (alreadyFullyScheduled) {
      state.lastPlanError = null;
      setGenerateHeartbeat(state, cycle.id, 0, null);
    } else {
      state.lastPlanError = {
        code: isHorizonInsufficient ? 'HORIZON_INSUFFICIENT' : 'NO_PROPOSED_BLOCKS',
        reason: isHorizonInsufficient
          ? `Only ${Number(planSummary?.scheduledBlockCount || 0)} of ${Number(planSummary?.requiredBlockCount || 0)} required blocks fit in the current horizon.`
          : 'No proposed blocks could be scheduled under current constraints.',
        reasonCodes: orderedReasonCodes,
        conflicts: normalizedConflicts,
        meta: {
          ...baseErrorMeta,
          anchorDow: dayKeyToDow(schedulerStartDayKey),
          anchorStartHHMM: getFirstWindowStartForDow(dayKeyToDow(schedulerStartDayKey), contractWorkWindows),
          planStatus: planSummary?.planStatus || null,
          requiredBlockCount: Number(planSummary?.requiredBlockCount || 0),
          scheduledBlockCount: Number(planSummary?.scheduledBlockCount || 0),
          unscheduledBlockCount: Number(planSummary?.unscheduledBlockCount || 0),
          candidateResolutionKinds: Array.isArray(planSummary?.candidateResolutionKinds)
            ? [...planSummary.candidateResolutionKinds]
            : [],
          recommendations: Array.isArray(planSummary?.recommendations)
            ? planSummary.recommendations.map((recommendation) => ({ ...recommendation }))
            : [],
        },
      };
      setGenerateHeartbeat(state, cycle.id, 0, state.lastPlanError.code);
    }
  } else if (!state.lastPlanError || state.lastPlanError.code === 'NO_PROPOSED_BLOCKS') {
    if (suggestedCount > 0) {
      cycle.scheduleLifecycle = 'draft_schedule_ready';
      cycle.scheduleReviewBlocks = [];
      cycle.scheduleAppliedAtISO = null;
      cycle.scheduleActivatedAtISO = null;
      state.scheduleLifecycle = 'draft_schedule_ready';
      state.scheduleReviewBlocks = [];
      state.scheduleApplied = false;
      state.pendingPlanConfirmation = true;
    }
    state.lastPlanError = null;
    setGenerateHeartbeat(state, cycle.id, suggestedCount, null);
  } else {
    setGenerateHeartbeat(state, cycle.id, suggestedCount, state.lastPlanError?.code || null);
  }
  logGenerateDiagnostics({
    state,
    traceId: `trace-${cycle.id}-generate`,
    cycleId: cycle.id,
    goalId: contract?.goalId || null,
    moduleName: 'generatePlan',
    stepName: 'complete',
    status: state.lastPlanError?.code ? 'fail' : 'ok',
    deliverableCount,
    actionCount,
    rawWorkWindowsCount,
    normalizedCandidateWindowCount,
    horizonDays,
    materializedWorkableDays: cycle?.autoAsanaPlan?.horizon?.daysCount || null,
    proposedBlocks: state.proposedBlocks || [],
    lastPlanErrorCode: state.lastPlanError?.code || null,
    inputSummary: {
      deliverableCount,
      actionCount,
      sessionPlanCount,
      acceptedBlocksCount: acceptedBlocks.length,
      horizonDays,
      rawWorkWindowsCount,
      normalizedCandidateWindowCount,
      resolvedMaxPerWeek,
      resolvedMaxPerDay,
    },
    outputSummary: {
      proposedBlocksCount: Array.isArray(state.proposedBlocks) ? state.proposedBlocks.length : 0,
      materializedWorkableDays: cycle?.autoAsanaPlan?.horizon?.daysCount || null,
      conflictCodes: (cycle?.autoAsanaPlan?.conflicts || [])
        .map((conflict) => String(conflict?.code || conflict?.kind || '').trim())
        .filter(Boolean)
        .join(', '),
      firstThreeProposedBlocks: (state.proposedBlocks || []).slice(0, 3).map((block) => ({
        id: block?.id || null,
        dayKey: block?.dayKey || null,
        startISO: block?.startISO || null,
        status: block?.status || null,
      })),
    },
    reasonCodes: state.lastPlanError?.reasonCodes || [],
  });
  const autoApplyAuthorized = payload?.authorizeAutoApply === true;
  if (suggestedCount > 0) {
    state.pendingPlanConfirmation = !autoApplyAuthorized;
  }
  if (suggestedCount > 0 && autoApplyAuthorized && !state.scheduleApplied) {
    applyDraftSchedule(state, {
      cycleId: cycle.id,
      goalId: contract.goalId,
      source: payload?.source || 'AUTHORIZED_AUTO_APPLY',
    });
    state.scheduleApplied = true;
    state.pendingPlanConfirmation = false;
    logGenerateDiagnostics({
      state,
      traceId: `trace-${cycle.id}-commit`,
      cycleId: cycle.id,
      goalId: contract?.goalId || null,
      moduleName: 'commitBlocks',
      stepName: 'complete',
      status: state.lastPlanError?.code ? 'fail' : 'ok',
      inputSummary: {
        acceptedBlocksCount: (state.proposedBlocks || []).filter((b) => b?.status === 'accepted').length,
        targetCycleId: cycle.id,
      },
      outputSummary: {
        executionEventCount: (state.executionEvents || []).length,
        todayBlocksCount: (state.today?.blocks || []).length,
        cycleBlocksCount: (state.cycle || []).flatMap((d) => d.blocks || []).length,
        draftScheduleAppliedAtISO: state.draftScheduleAppliedAtISO || null,
      },
      lastPlanErrorCode: state.lastPlanError?.code || null,
      reasonCodes: state.lastPlanError?.reasonCodes || [],
    });
  }
  if (debugPerfActions) {
    state.debug = state.debug || {};
    state.debug.generatePlanPhases = {
      totalMs: Date.now() - perfGenerateStart,
      compileAutoAsanaPlanMs: perfCompileMs,
      computePlanPreviewMs: perfPreviewMs,
      suggestedCount,
      acceptedBlocksCount: acceptedBlocks.length,
      actionSequenceCount: actionSequenceWithDeliverableIds.length,
    };
  }
  state.cyclesById[cycle.id] = cycle;
}

function applyGeneratedPlan(state, payload = {}) {
  const targetCycleId = payload?.cycleId || state.activeCycleId || null;
  const cycle = targetCycleId ? getTargetCycle(state, targetCycleId) : getActiveCycle(state);
  const contract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
  if (!cycle || !contract || !cycle.autoAsanaPlan) {
    return;
  }
  const admission = state.goalAdmissionByGoal?.[contract.goalId] || cycle.goalAdmission;
  if (admission && !isAdmittedGoalStatus(admission.status)) {
    state.lastPlanError = {
      code: 'GOAL_NOT_ADMITTED',
      reason: (admission.reasonCodes || []).join(', ') || 'Goal not admitted',
      cycleId: cycle.id,
      goalId: contract.goalId,
    };
    return;
  }
  if ((cycle.autoAsanaPlan.conflicts || []).length) {
    state.lastPlanError = {
      code: 'PLAN_UNSCHEDULABLE',
      reason: 'Resolve conflicts before applying the plan.',
      cycleId: cycle.id,
      goalId: contract.goalId,
    };
    return;
  }
  const plan = cycle.autoAsanaPlan;
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const timeZone = state.appTime?.timeZone || 'UTC';
  const existingCreates = new Set((state.executionEvents || []).map((e) => e?.blockId).filter(Boolean));
  const domain = state.planDraft?.primaryDomain || 'FOCUS';
  (plan.horizonBlocks || []).forEach((block) => {
    if (!block?.id || existingCreates.has(block.id)) {
      return;
    }
    createBlock(state, {
      id: block.id,
      cycleId: cycle.id,
      goalId: contract.goalId,
      origin: 'auto_asana',
      startISO: block.startISO,
      durationMinutes: block.durationMinutes,
      domain,
      title: block.title,
      surface: 'today',
      timeZone,
    });
    appendTransitionTrace(state, {
      transition: 'apply',
      blockId: block.id || null,
      label: block.title || '',
    });
  });
  state.planEvents = state.planEvents || [];
  state.planEvents.push({
    id: nextDeterministicId(state, `plan-applied-${cycle.id}`),
    type: 'PLAN_APPLIED',
    cycleId: cycle.id,
    goalId: contract.goalId,
    atISO: nowISO,
    policyVersion: plan.audit?.policyVersion || 'auto_asana_v1',
  });
  cycle.lastPlanAppliedAtISO = nowISO;
  state.pendingPlanConfirmation = false;
  state.scheduleApplied = true;
  state.lastPlanError = null;
  state.cyclesById[cycle.id] = cycle;
}

function inferPlanCycleNumber(value) {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }
  const namespacedMatch = text.match(/brand:\d{2}:(\d+):/i);
  if (namespacedMatch) {
    return Number(namespacedMatch[1]);
  }
  const cycleMatch = text.match(/\bcycle\s+(\d+)\b/i);
  if (cycleMatch) {
    return Number(cycleMatch[1]);
  }
  return null;
}

function setPlanResolutionKind(state, payload = {}) {
  const cycleId = payload?.cycleId || state.activeCycleId || null;
  const cycle = getTargetCycle(state, cycleId);
  if (!cycle) {
    return;
  }
  const kind = String(payload?.kind || payload?.resolutionKind || '')
    .trim()
    .toUpperCase();
  cycle.selectedPlanResolutionKind = kind || null;
  if (!kind) {
    cycle.selectedPlanResolutionAtISO = null;
  }
  state.cyclesById[cycle.id] = cycle;
}

function getPlanRecommendation(planSummary, kind) {
  if (!planSummary || !Array.isArray(planSummary.recommendations)) {
    return null;
  }
  const normalizedKind = String(kind || '')
    .trim()
    .toUpperCase();
  return (
    planSummary.recommendations.find(
      (recommendation) =>
        String(recommendation?.kind || '')
          .trim()
          .toUpperCase() === normalizedKind
    ) || null
  );
}

function updateCycleContractEndDayKey(cycle, nextEndDayKey) {
  if (!cycle || !nextEndDayKey) {
    return;
  }
  cycle.goalContract = cycle.goalContract || {};
  cycle.goalContract.endDayKey = nextEndDayKey;
  cycle.goalContract.deadlineISO = `${nextEndDayKey}T23:59:59.000Z`;
  cycle.goalContract.endDateISO = `${nextEndDayKey}T23:59:59.000Z`;
  if (Number.isFinite(Number(cycle.goalContract?.horizonDays))) {
    cycle.goalContract.horizonDays = Math.max(1, Number(cycle.goalContract.horizonDays));
  }
  if (cycle.goalContract.deadline && typeof cycle.goalContract.deadline === 'object') {
    cycle.goalContract.deadline = {
      ...cycle.goalContract.deadline,
      dayKey: nextEndDayKey,
    };
  }
  if (cycle.goalGovernanceContract) {
    cycle.goalGovernanceContract = {
      ...cycle.goalGovernanceContract,
      activeUntilISO: nextEndDayKey,
    };
  }
  if (cycle.contract && typeof cycle.contract === 'object') {
    cycle.contract = {
      ...cycle.contract,
      endDayKey: nextEndDayKey,
      deadlineISO: `${nextEndDayKey}T23:59:59.000Z`,
      endDateISO: `${nextEndDayKey}T23:59:59.000Z`,
    };
  }
}

function recordDraftPolicyParity(state, appliedPreview) {
  const isNumericParity = (left, right) => {
    if (Number.isFinite(left) && Number.isFinite(right)) {
      return Number(left) === Number(right);
    }
    return !Number.isFinite(left) && !Number.isFinite(right);
  };
  const appliedPolicyId = appliedPreview?.qualityPolicyIdUsed || 'BALANCED';
  state.qualityPolicyIdApplied = appliedPolicyId;
  state.qualityScoreApplied = appliedPreview?.qualityScoreBaseline;
  state.qualityScoreAppliedByComponent = appliedPreview?.qualityScoreBaselineByComponent || null;
  state.policySelectionDecisionApplied = appliedPreview?.policySelectionDecision || null;
  state.policySelectionReasonCodesApplied = [...(appliedPreview?.policySelectionReasonCodes || [])];
  state.historyProfileSnapshotUsedApplied = appliedPreview?.historyProfileSnapshotUsed || null;
  state.historyReasonCodesApplied = [...(appliedPreview?.historyReasonCodes || [])];
  state.pacingInjectedCheckpointCountApplied = appliedPreview?.pacingInjectedCheckpointCount || 0;
  state.pacingInjectedByMilestoneApplied = appliedPreview?.pacingInjectedByMilestone || {};
  const previewPolicyId = state.planPreview?.qualityPolicyIdUsed || null;
  const previewReasonCodes = JSON.stringify(state.planPreview?.policySelectionReasonCodes || []);
  const appliedReasonCodes = JSON.stringify(appliedPreview?.policySelectionReasonCodes || []);
  state.policySelectionParity = Boolean(
    previewPolicyId && previewPolicyId === appliedPolicyId && previewReasonCodes === appliedReasonCodes
  );
  state.scoreParity = Boolean(
    isNumericParity(state.planPreview?.qualityScoreBaseline, appliedPreview?.qualityScoreBaseline) &&
    JSON.stringify(state.planPreview?.qualityScoreBaselineByComponent || {}) ===
      JSON.stringify(appliedPreview?.qualityScoreBaselineByComponent || {})
  );
  state.pacingParity = Boolean(
    Number(state.planPreview?.pacingInjectedCheckpointCount || 0) ===
      Number(appliedPreview?.pacingInjectedCheckpointCount || 0) &&
    JSON.stringify(state.planPreview?.pacingInjectedByMilestone || {}) ===
      JSON.stringify(appliedPreview?.pacingInjectedByMilestone || {})
  );
  return appliedPolicyId;
}

function clearAppliedScheduleForCycle(state, cycleId) {
  if (!cycleId) {
    return;
  }
  const removableOrigins = new Set(['suggested_apply', 'auto_asana']);
  const activeBlocks = getAllBlocks(state).filter((block) => {
    if (!block || block.cycleId !== cycleId) {
      return false;
    }
    if (!removableOrigins.has(String(block.origin || '').trim())) {
      return false;
    }
    const status = String(block.status || 'planned')
      .trim()
      .toLowerCase();
    return status === 'planned' || status === 'in_progress';
  });
  activeBlocks.forEach((block) => {
    deleteBlock(state, block.id);
  });
}

function applyDraftSchedule(state, payload = {}) {
  const debugPerfActions = isRuntimeEnvFlagEnabled('JERICHO_DEBUG_PERF_ACTIONS');
  const perfStart = debugPerfActions ? Date.now() : 0;
  const targetCycleId = payload?.cycleId || state.activeCycleId || null;
  const cycle = getTargetCycle(state, targetCycleId);
  const contract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
  if (!cycle || !contract) {
    return;
  }
  if (isCycleReadOnly(cycle)) {
    state.lastPlanError = {
      code: 'CYCLE_READ_ONLY',
      reason: 'Cannot apply schedule for an ended or archived cycle.',
      cycleId: cycle.id || targetCycleId,
    };
    return;
  }
  const nowDay =
    state.appTime?.activeDayKey || state.today?.date || nowDayKey(state.appTime?.timeZone || APP_TIME_ZONE);
  const previewDecisionBeforeApply = state.planPreview?.policySelectionDecision || null;
  const sourceBlocks = state.proposedBlocks || [];
  const suggestedBlocks = sourceBlocks.filter((block) => !block?.cycleId || block?.cycleId === cycle.id);
  const timeZone = state.appTime?.timeZone || 'UTC';
  const planSummary = cycle?.autoAsanaPlan?.summary || null;
  const normalizedPlanStatus = String(planSummary?.planStatus || '').trim().toUpperCase();
  const resolutionKind = String(payload?.resolutionKind || payload?.horizonResolutionKind || '').trim().toUpperCase();
  const resolutionAlreadyApplied = payload?._resolutionApplied === true;
  if (normalizedPlanStatus === 'VALID_BUT_HORIZON_INSUFFICIENT' && resolutionKind !== 'ACCEPT_PARTIAL_PLAN') {
    if (resolutionKind === 'EXTEND_HORIZON' && !resolutionAlreadyApplied) {
      const recommendation = getPlanRecommendation(planSummary, 'EXTEND_HORIZON');
      const nextEndDayKey =
        recommendation?.earliestFeasibleCompletionDate ||
        (cycle?.goalContract?.endDayKey ? addDays(cycle.goalContract.endDayKey, Number(recommendation?.extensionDays || 0), timeZone) : null);
      if (!nextEndDayKey) {
        state.lastPlanError = {
          code: 'HORIZON_EXTENSION_UNAVAILABLE',
          reason: 'Extend horizon recommendation is missing a feasible completion date.',
          cycleId: cycle.id,
          goalId: contract.goalId,
        };
        return;
      }
      updateCycleContractEndDayKey(cycle, nextEndDayKey);
      state.cyclesById[cycle.id] = cycle;
      if (state.activeCycleId === cycle.id && cycle.goalContract) {
        state.goalExecutionContract = {
          ...(state.goalExecutionContract || {}),
          ...cycle.goalContract,
        };
      }
      generatePlan(state, { cycleId: cycle.id, source: 'HORIZON_EXTENSION_APPLY' });
      const regeneratedCycle = getTargetCycle(state, cycle.id);
      const regeneratedSummary = regeneratedCycle?.autoAsanaPlan?.summary || null;
      const regeneratedStatus = String(regeneratedSummary?.planStatus || '').trim().toUpperCase();
      if (regeneratedStatus === 'VALID_BUT_HORIZON_INSUFFICIENT') {
        state.lastPlanError = {
          code: 'HORIZON_EXTENSION_INSUFFICIENT',
          reason: 'Extending the horizon did not produce a fully schedulable plan.',
          cycleId: cycle.id,
          goalId: contract.goalId,
          meta: {
            planStatus: regeneratedSummary?.planStatus || null,
            requiredBlockCount: Number(regeneratedSummary?.requiredBlockCount || 0),
            scheduledBlockCount: Number(regeneratedSummary?.scheduledBlockCount || 0),
            unscheduledBlockCount: Number(regeneratedSummary?.unscheduledBlockCount || 0),
          },
        };
        return;
      }
      applyDraftSchedule(state, { ...payload, cycleId: cycle.id, resolutionKind, _resolutionApplied: true });
      return;
    }
    if (resolutionKind === 'REDUCE_CYCLE_COUNT') {
      // Reduction is handled below by filtering the suggested set before review blocks are built.
    } else if (resolutionKind) {
      state.lastPlanError = {
        code: 'HORIZON_RESOLUTION_REQUIRED',
        reason: 'Select a supported horizon resolution before applying a partial plan.',
        cycleId: cycle.id,
        goalId: contract.goalId,
      };
      return;
    }
  }
  if (normalizedPlanStatus === 'VALID_BUT_HORIZON_INSUFFICIENT' && resolutionKind !== 'ACCEPT_PARTIAL_PLAN' && resolutionKind !== 'REDUCE_CYCLE_COUNT') {
    state.lastPlanError = {
      code: 'HORIZON_RESOLUTION_REQUIRED',
      reason: 'Select a horizon resolution before applying a partial plan.',
      cycleId: cycle.id,
      goalId: contract.goalId,
      meta: {
        planStatus: planSummary?.planStatus || null,
        requiredBlockCount: Number(planSummary?.requiredBlockCount || 0),
        scheduledBlockCount: Number(planSummary?.scheduledBlockCount || 0),
        unscheduledBlockCount: Number(planSummary?.unscheduledBlockCount || 0),
        candidateResolutionKinds: Array.isArray(planSummary?.candidateResolutionKinds)
          ? [...planSummary.candidateResolutionKinds]
          : [],
        recommendations: Array.isArray(planSummary?.recommendations)
          ? planSummary.recommendations.map((recommendation) => ({ ...recommendation }))
          : [],
      },
    };
    return;
  }
  const appliedPreview =
    state.planPreview ||
    computePlanPreview({
      suggestedBlocks,
      planDraft: state.planDraft,
      contract,
      policyState: cycle.policyState || null,
      historyProfile: buildHistoryProfileForDraft(state, state.planDraft),
      timeZone,
    });
  let proposedItems = (suggestedBlocks || []).filter((item) => item?.status === 'suggested');
  if (normalizedPlanStatus === 'VALID_BUT_HORIZON_INSUFFICIENT' && resolutionKind === 'REDUCE_CYCLE_COUNT') {
    const recommendation = getPlanRecommendation(planSummary, 'REDUCE_CYCLE_COUNT');
    const recommendedCycleCount = Number(recommendation?.recommendedCycleCount || 0);
    proposedItems = proposedItems.filter((item) => {
      const cycleNumber = inferPlanCycleNumber(item?.actionId || item?.title || item?.displayTitle);
      return !Number.isFinite(cycleNumber) || cycleNumber <= recommendedCycleCount;
    });
  }
  const appliedPolicyId = recordDraftPolicyParity(state, appliedPreview);
  if (getCycleScheduleLifecycle(cycle, state) === 'active_schedule') {
    state.lastPlanError = {
      code: 'REGENERATE_BLOCKED_ACTIVE_SCHEDULE',
      reason: 'Activate / Commit is already in effect for this cycle. Reschedule specific blocks instead.',
      cycleId: cycle.id,
      goalId: contract.goalId,
    };
    state.pendingPlanConfirmation = false;
    state.scheduleApplied = true;
    state.scheduleLifecycle = 'active_schedule';
    cycle.scheduleLifecycle = 'active_schedule';
    cycle.scheduleReviewBlocks = Array.isArray(cycle.scheduleReviewBlocks) ? cycle.scheduleReviewBlocks : [];
    state.cyclesById[cycle.id] = cycle;
    logGenerateDiagnostics({
      state,
      traceId: `trace-${cycle.id}-apply`,
      cycleId: cycle.id,
      goalId: contract?.goalId || null,
      moduleName: 'applyDraftSchedule',
      stepName: 'complete',
      status: 'fail',
      inputSummary: {
        proposedBlocksCount: (state.proposedBlocks || []).length,
        suggestedCount: proposedItems.length,
        cycleId: cycle.id,
      },
      outputSummary: {
        committedBlocksCount: (state.today?.blocks || []).length,
        cycleBlocksCount: (state.cycle || []).flatMap((d) => d.blocks || []).length,
        scheduleApplied: Boolean(state.scheduleApplied),
      },
      lastPlanErrorCode: 'REGENERATE_BLOCKED_ACTIVE_SCHEDULE',
      reasonCodes: ['REGENERATE_BLOCKED_ACTIVE_SCHEDULE'],
    });
    return;
  }
  if (!proposedItems.length) {
    // No-op apply: preserve deterministic preview/apply parity flags for diagnostics.
    state.scoreParity = true;
    state.lastPlanError = {
      code: 'NO_PROPOSED_BLOCKS',
      reason: 'No preview items to apply.',
      cycleId: cycle.id,
    };
    logGenerateDiagnostics({
      state,
      traceId: `trace-${cycle.id}-apply`,
      cycleId: cycle.id,
      goalId: contract?.goalId || null,
      moduleName: 'applyDraftSchedule',
      stepName: 'complete',
      status: 'fail',
      inputSummary: {
        proposedBlocksCount: (state.proposedBlocks || []).length,
        suggestedCount: (state.proposedBlocks || []).filter((b) => b?.status === 'suggested').length,
        cycleId: cycle.id,
      },
      outputSummary: {
        committedBlocksCount: (state.today?.blocks || []).length,
        cycleBlocksCount: (state.cycle || []).flatMap((d) => d.blocks || []).length,
        scheduleApplied: Boolean(state.scheduleApplied),
      },
      lastPlanErrorCode: 'NO_PROPOSED_BLOCKS',
      reasonCodes: [],
    });
    return;
  }
  const perfCreateStart = debugPerfActions ? Date.now() : 0;
  const reviewBlocks = proposedItems
    .map((item) =>
      buildScheduleReviewBlock(state, item, {
        cycleId: cycle.id,
        goalId: contract.goalId,
        timeZone,
        defaultDomain: state.planDraft?.primaryDomain || 'FOCUS',
      })
    )
    .filter(Boolean);
  annotateRepeatedSessionTitles(reviewBlocks);
  const temporalAudit = buildScheduleTemporalAudit(state, cycle, proposedItems, { timeZone });
  cycle.scheduleReviewBlocks = reviewBlocks;
  cycle.scheduleDraftHash = buildScheduleDraftHash(proposedItems);
  cycle.scheduleAppliedAtISO = state.appTime?.nowISO || new Date().toISOString();
  cycle.scheduleGeneratedAtISO = temporalAudit.generatedAtISO;
  cycle.generatedForStartDayKey = temporalAudit.generatedForStartDayKey;
  cycle.validUntilDayKey = temporalAudit.validUntilDayKey;
  cycle.activationRequestedAtISO = temporalAudit.activationRequestedAtISO;
  cycle.executionStartDayKey = temporalAudit.executionStartDayKey;
  cycle.temporalStatus = temporalAudit.temporalStatus;
  cycle.rebaseRequired = temporalAudit.rebaseRequired;
  cycle.pastDatedBlockCount = temporalAudit.pastDatedBlockCount;
  cycle.scheduleDebtMinutes = temporalAudit.scheduleDebtMinutes;
  cycle.compressionDelta = temporalAudit.compressionDelta;
  cycle.temporalReasonCodes = temporalAudit.temporalReasonCodes;
  cycle.scheduleLifecycle = reviewBlocks.length > 0 ? 'applied_review' : 'no_schedule';
  cycle.selectedPlanResolutionKind = resolutionKind || cycle.selectedPlanResolutionKind || null;
  cycle.selectedPlanResolutionAtISO = state.appTime?.nowISO || new Date().toISOString();
  cycle.deferredScheduleBlocks =
    resolutionKind === 'ACCEPT_PARTIAL_PLAN'
      ? (cycle.autoAsanaPlan?.unscheduledDrafts || []).map((draft) => ({
          id: draft?.id || null,
          title: draft?.title || 'Deferred block',
          actionId: draft?.actionId || null,
          targetDayKey: draft?.targetDayKey || null,
          hardGateFloorISO: draft?.hardGateFloorISO || null,
          deferredReason: 'horizon_insufficient',
        }))
      : [];
  if (resolutionKind === 'ACCEPT_PARTIAL_PLAN') {
    cycle.lastResolvedPlanSummary = {
      ...(planSummary || {}),
      planStatus: 'VALID_PARTIAL_BY_USER_CHOICE',
      candidateResolutionKinds: [],
      recommendations: [],
    };
  } else if (resolutionKind === 'REDUCE_CYCLE_COUNT') {
    cycle.lastResolvedPlanSummary = {
      ...(planSummary || {}),
      planStatus: 'VALID_AND_FULLY_SCHEDULED',
      requiredBlockCount: reviewBlocks.length,
      scheduledBlockCount: reviewBlocks.length,
      unscheduledBlockCount: 0,
      candidateResolutionKinds: [],
      recommendations: [],
    };
  } else if (planSummary) {
    cycle.lastResolvedPlanSummary = {
      ...planSummary,
      planStatus: 'VALID_AND_FULLY_SCHEDULED',
      candidateResolutionKinds: [],
      recommendations: [],
    };
  }
  state.scheduleLifecycle = cycle.scheduleLifecycle;
  state.scheduleReviewBlocks = reviewBlocks;
  mergeScheduleReviewBlocksIntoCycleProjection(state, cycle);
  const perfCreateMs = debugPerfActions ? Date.now() - perfCreateStart : 0;
  const perfAcceptStart = debugPerfActions ? Date.now() : 0;
  const acceptedSuggestionIds = new Set(proposedItems.map((item) => item.id));
  const nextSuggestions = sourceBlocks.map((item) => {
    if (!acceptedSuggestionIds.has(item?.id)) {
      return item;
    }
    return {
      ...item,
      status: 'accepted',
      acceptedAtISO: state.appTime?.nowISO || new Date().toISOString(),
    };
  });
  setCycleProposedBlocks(state, cycle.id, nextSuggestions);
  state.suggestionEvents = state.suggestionEvents || [];
  proposedItems.forEach((item) => {
    state.suggestionEvents.push({
      id: nextDeterministicId(state, `sev-accept-${item.id}`),
      type: 'accepted',
      proposalId: item.id,
      cycleId: cycle.id,
      goalId: contract.goalId,
      atISO: state.appTime?.nowISO || new Date().toISOString(),
    });
    appendTransitionTrace(state, {
      transition: 'apply',
      blockId: item.id || null,
      label: item.title || '',
    });
  });
  const perfAcceptMs = debugPerfActions ? Date.now() - perfAcceptStart : 0;
  const priorState = cycle.policyState || null;
  const changedPolicy = priorState?.currentPolicyId !== appliedPolicyId;
  const policySetAtDayKey = changedPolicy ? nowDay : priorState?.policySetAtDayKey || nowDay;
  const policyAgeDays = Math.max(0, daysBetween(policySetAtDayKey, nowDay));
  cycle.policyState = {
    currentPolicyId: appliedPolicyId,
    policySetAtDayKey,
    policyAgeDays,
    priorSignalsSnapshot: appliedPreview.policySelectionSignalsSnapshot || priorState?.priorSignalsSnapshot || null,
  };
  const previewPolicyId = state.planPreview?.qualityPolicyIdUsed || null;
  state.planEvents = state.planEvents || [];
  state.planEvents.push({
    id: nextDeterministicId(state, `draft-policy-applied-${cycle.id}`),
    type: 'DRAFT_POLICY_APPLIED',
    cycleId: cycle.id,
    goalId: contract.goalId,
    dayKey: nowDay,
    qualityPolicyIdApplied: appliedPolicyId,
    qualityScoreApplied: appliedPreview.qualityScoreBaseline,
    previewPolicyIdUsed: previewPolicyId,
    policySelectionParity: state.policySelectionParity,
    scoreParity: state.scoreParity,
    pacingParity: state.pacingParity,
    historyProfileSnapshotUsed: appliedPreview.historyProfileSnapshotUsed || null,
    reasonCodes: appliedPreview.policySelectionReasonCodes || [],
    atISO: state.appTime?.nowISO || new Date().toISOString(),
  });
  state.draftScheduleAppliedAtISO = state.appTime?.nowISO || new Date().toISOString();
  state.pendingPlanConfirmation = false;
  state.scheduleApplied = true;
  state.lastPlanError = null;
  state.planDraft = null;
  state.planPreview = null;
  cycle.planDraft = null;
  cycle.planPreview = null;
  cycle.autoAsanaPlan = null;
  cycle.coldPlan = { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } };
  cycle.lastPolicySelectionDecision = previewDecisionBeforeApply || appliedPreview.policySelectionDecision || null;
  cycle.lastPlanAppliedAtISO = state.draftScheduleAppliedAtISO;
  state.cyclesById[cycle.id] = cycle;
  if (debugPerfActions) {
    state.debug = state.debug || {};
    state.debug.applyDraftSchedulePhases = {
      totalMs: Date.now() - perfStart,
      createBlocksMs: perfCreateMs,
      acceptSuggestionsMs: perfAcceptMs,
      proposedCount: proposedItems.length,
      reviewCount: reviewBlocks.length,
    };
  }
  logGenerateDiagnostics({
    state,
    traceId: `trace-${cycle.id}-apply`,
    cycleId: cycle.id,
    goalId: contract?.goalId || null,
    moduleName: 'applyDraftSchedule',
    stepName: 'complete',
    status: 'ok',
    inputSummary: {
      proposedBlocksCount: (state.proposedBlocks || []).length,
      suggestedCount: (state.proposedBlocks || []).filter((b) => b?.status === 'suggested').length,
      cycleId: cycle.id,
    },
    outputSummary: {
      appliedReviewBlocksCount: reviewBlocks.length,
      committedBlocksCount: (state.today?.blocks || []).length,
      cycleBlocksCount: (state.cycle || []).flatMap((d) => d.blocks || []).length,
      scheduleApplied: Boolean(state.scheduleApplied),
      draftScheduleAppliedAtISO: state.draftScheduleAppliedAtISO || null,
    },
    reasonCodes: [],
  });
}

function sortBlocksForTemporalRebase(blocks = [], timeZone = 'UTC') {
  return [...(Array.isArray(blocks) ? blocks : [])].sort((left, right) => {
    const leftDayKey = getTemporalBlockDayKey(left, timeZone) || '9999-12-31';
    const rightDayKey = getTemporalBlockDayKey(right, timeZone) || '9999-12-31';
    if (leftDayKey !== rightDayKey) {
      return leftDayKey.localeCompare(rightDayKey);
    }
    const leftStart = String(left?.startISO || left?.start || '').trim();
    const rightStart = String(right?.startISO || right?.start || '').trim();
    if (leftStart !== rightStart) {
      return leftStart.localeCompare(rightStart);
    }
    return String(left?.id || '').localeCompare(String(right?.id || ''));
  });
}

function collectRebaseDayKeys(executionStartDayKey, endDayKey, timeZone = 'UTC') {
  const keys = [];
  let cursor = executionStartDayKey;
  let guard = 0;
  while (cursor && endDayKey && cursor <= endDayKey && guard < 5000) {
    keys.push(cursor);
    const next = addDays(cursor, 1, timeZone);
    if (!next || next === cursor) {
      break;
    }
    cursor = next;
    guard += 1;
  }
  return keys;
}

function buildRebaseWindowsByDayKey(dayKeys = [], workWindows = {}, timeZone = 'UTC') {
  return dayKeys.reduce((acc, dayKey) => {
    const dow = dayKeyToDow(dayKey);
    const windows = Array.isArray(workWindows?.[dow]) ? workWindows[dow] : [];
    acc[dayKey] = windows
      .map((window) => ({
        startMin: parseHHMMToMinutes(window?.start),
        endMin: parseHHMMToMinutes(window?.end),
      }))
      .filter((window) => window.endMin > window.startMin);
    return acc;
  }, {});
}

function weekKeyForDay(dayKey) {
  const [year, month, day] = String(dayKey || '')
    .split('-')
    .map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const oneJan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}

function minutesToHHMM(totalMinutes = 0) {
  const normalized = Math.max(0, Number(totalMinutes) || 0);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function findRebaseSlot({
  block,
  candidateDayKeys,
  windowsByDayKey,
  occupiedByDayKey,
  dailyCounts,
  weeklyCounts,
  maxBlocksPerDay,
  maxBlocksPerWeek,
}) {
  const durationMinutes = Math.max(1, Number(block?.durationMinutes || 30));
  for (const dayKey of candidateDayKeys) {
    const windows = windowsByDayKey[dayKey] || [];
    if (!windows.length) {
      continue;
    }
    if ((dailyCounts.get(dayKey) || 0) >= maxBlocksPerDay) {
      continue;
    }
    const weekKey = weekKeyForDay(dayKey);
    if ((weeklyCounts.get(weekKey) || 0) >= maxBlocksPerWeek) {
      continue;
    }
    const occupied = occupiedByDayKey.get(dayKey) || [];
    for (const window of windows) {
      let cursor = window.startMin;
      while (cursor + durationMinutes <= window.endMin) {
        const overlaps = occupied.some(
          (slot) => !(cursor + durationMinutes <= slot.startMin || cursor >= slot.endMin)
        );
        if (!overlaps) {
          return { dayKey, startMin: cursor };
        }
        cursor += 15;
      }
    }
  }
  return null;
}

function rebaseSchedule(state, payload = {}) {
  const cycleId = payload?.cycleId || state.activeCycleId || null;
  const cycle = getTargetCycle(state, cycleId);
  const contract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
  if (!cycle || !contract) {
    return;
  }
  const timeZone = state.appTime?.timeZone || 'UTC';
  const executionStartDayKey =
    coerceDayKey(payload?.executionStartDayKey, timeZone) ||
    coerceDayKey(state.appTime?.activeDayKey, timeZone) ||
    coerceDayKey(state.today?.date, timeZone) ||
    nowDayKey(timeZone);
  const reviewBlocks = sortBlocksForTemporalRebase(cycle.scheduleReviewBlocks || [], timeZone);
  if (!reviewBlocks.length) {
    state.lastPlanError = {
      code: 'NO_APPLIED_REVIEW_BLOCKS',
      reason: 'No applied review blocks available to rebase.',
      cycleId: cycle.id,
      goalId: contract.goalId,
    };
    return;
  }
  if (payload?.activationDelayResolution === 'rebase' || payload?.workHappenedDuringDelay === 'none') {
    const preAudit = buildScheduleTemporalAudit(state, cycle, reviewBlocks, {
      referenceDayKey: executionStartDayKey,
      timeZone,
    });
    const delayAssessment = buildActivationDelayAssessment(state, cycle, reviewBlocks, preAudit, { timeZone });
    cycle.activationDelayAssessment = {
      ...delayAssessment,
      status: 'ready_to_rebase',
      workHappenedDuringDelay: 'none',
      selectedResolution: 'rebase',
      reasonCodes: Array.from(new Set([...(delayAssessment.reasonCodes || []), 'DELAY_WINDOW_REBASE_SELECTED'])),
    };
  }
  const endDayKey =
    coerceDayKey(contract?.endDayKey, timeZone) ||
    coerceDayKey(contract?.deadline?.dayKey, timeZone) ||
    coerceDayKey(contract?.deadlineISO, timeZone) ||
    reviewBlocks.map((block) => getTemporalBlockDayKey(block, timeZone)).filter(Boolean).sort().pop() ||
    executionStartDayKey;
  const candidateDayKeys = collectRebaseDayKeys(executionStartDayKey, endDayKey, timeZone);
  const workWindows = normalizeCanonicalWorkWindows(contract?.workWindows || cycle?.goalContract?.workWindows || {});
  const windowsByDayKey = buildRebaseWindowsByDayKey(candidateDayKeys, workWindows, timeZone);
  const maxBlocksPerDay = Math.max(
    1,
    Number(cycle?.strategy?.constraints?.maxBlocksPerDay || state?.constraints?.maxBlocksPerDay || Number.POSITIVE_INFINITY)
  );
  const maxBlocksPerWeek = Math.max(
    1,
    Number(cycle?.strategy?.constraints?.maxBlocksPerWeek || state?.constraints?.maxBlocksPerWeek || Number.POSITIVE_INFINITY)
  );
  const occupiedByDayKey = new Map();
  const dailyCounts = new Map();
  const weeklyCounts = new Map();
  const preservedBlocks = [];
  const portableBlocks = [];

  reviewBlocks.forEach((block) => {
    if (hasCanonicalExecutionOutcome(state, block?.id)) {
      preservedBlocks.push({ ...block });
      const dayKey = getTemporalBlockDayKey(block, timeZone);
      if (dayKey && dayKey >= executionStartDayKey) {
        const startMin = parseHHMMToMinutes(String((block?.startISO || block?.start || '').slice(11, 16) || '09:00'));
        const durationMinutes = Math.max(1, Number(block?.durationMinutes || 30));
        if (!occupiedByDayKey.has(dayKey)) occupiedByDayKey.set(dayKey, []);
        occupiedByDayKey.get(dayKey).push({ startMin, endMin: startMin + durationMinutes });
        dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);
        const weekKey = weekKeyForDay(dayKey);
        weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) || 0) + 1);
      }
      return;
    }
    portableBlocks.push({ ...block });
  });

  const rebasedBlocks = [];
  for (const block of portableBlocks) {
    const originalDayKey = getTemporalBlockDayKey(block, timeZone) || executionStartDayKey;
    const earliestDayKey = originalDayKey >= executionStartDayKey ? originalDayKey : executionStartDayKey;
    const eligibleDayKeys = candidateDayKeys.filter((dayKey) => dayKey >= earliestDayKey);
    const slot = findRebaseSlot({
      block,
      candidateDayKeys: eligibleDayKeys,
      windowsByDayKey,
      occupiedByDayKey,
      dailyCounts,
      weeklyCounts,
      maxBlocksPerDay,
      maxBlocksPerWeek,
    });
    if (!slot) {
      const failedAudit = buildScheduleTemporalAudit(state, cycle, reviewBlocks, {
        referenceDayKey: executionStartDayKey,
        timeZone,
      });
      cycle.temporalStatus = 'rebase_required';
      cycle.rebaseRequired = true;
      cycle.lastTemporalAudit = failedAudit;
      state.cyclesById[cycle.id] = cycle;
      state.lastPlanError = {
        code: 'INSUFFICIENT_CAPACITY_FOR_TEMPORAL_REBASE',
        reason: 'Displaced work cannot fit the remaining future work windows before required anchors.',
        cycleId: cycle.id,
        goalId: contract.goalId,
        reasonCodes: Array.from(
          new Set(['REQUIRES_RECALIBRATION', 'INSUFFICIENT_CAPACITY_FOR_TEMPORAL_REBASE', ...(failedAudit.temporalReasonCodes || [])])
        ),
        meta: {
          executionStartDayKey,
          pastDatedBlockCount: failedAudit.pastDatedBlockCount,
          scheduleDebtMinutes: failedAudit.scheduleDebtMinutes,
          compressionDelta: failedAudit.compressionDelta,
        },
      };
      return;
    }
    const startISO = buildLocalStartISO(slot.dayKey, minutesToHHMM(slot.startMin), timeZone).startISO;
    const endISO = new Date(Date.parse(startISO) + Math.max(1, Number(block?.durationMinutes || 30)) * 60000).toISOString();
    const rebased = {
      ...block,
      start: startISO,
      end: endISO,
      startISO,
      endISO,
      dayKey: slot.dayKey,
      status: String(block?.status || '').trim().toLowerCase() === 'completed' ? 'completed' : 'planned',
    };
    rebasedBlocks.push(rebased);
    if (!occupiedByDayKey.has(slot.dayKey)) occupiedByDayKey.set(slot.dayKey, []);
    occupiedByDayKey.get(slot.dayKey).push({
      startMin: slot.startMin,
      endMin: slot.startMin + Math.max(1, Number(block?.durationMinutes || 30)),
    });
    dailyCounts.set(slot.dayKey, (dailyCounts.get(slot.dayKey) || 0) + 1);
    const weekKey = weekKeyForDay(slot.dayKey);
    weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) || 0) + 1);
  }

  const nextReviewBlocks = sortBlocksForTemporalRebase([...preservedBlocks, ...rebasedBlocks], timeZone);
  const priorAudit = buildScheduleTemporalAudit(state, cycle, reviewBlocks, {
    referenceDayKey: executionStartDayKey,
    timeZone,
  });
  const postAudit = buildScheduleTemporalAudit(state, cycle, nextReviewBlocks, {
    referenceDayKey: executionStartDayKey,
    timeZone,
  });
  cycle.scheduleReviewBlocks = nextReviewBlocks;
  cycle.scheduleLifecycle = 'applied_review';
  cycle.executionStartDayKey = executionStartDayKey;
  cycle.activationRequestedAtISO = state.appTime?.nowISO || new Date().toISOString();
  cycle.temporalStatus = 'rebased';
  cycle.rebaseRequired = false;
  cycle.pastDatedBlockCount = postAudit.pastDatedBlockCount;
  cycle.scheduleDebtMinutes = postAudit.scheduleDebtMinutes;
  cycle.compressionDelta = postAudit.compressionDelta;
  cycle.temporalReasonCodes = Array.from(
    new Set(['SCHEDULE_REBASED_FROM_TEMPORAL_DRIFT', ...(postAudit.compressionDelta > 0 ? ['HARD_ANCHOR_COMPRESSION_CHANGED'] : [])])
  );
  if (cycle.activationDelayAssessment?.selectedResolution === 'rebase') {
    cycle.temporalReasonCodes = Array.from(new Set([...cycle.temporalReasonCodes, 'DELAY_WINDOW_REBASE_SELECTED']));
  }
  cycle.lastTemporalAudit = priorAudit;
  state.scheduleReviewBlocks = nextReviewBlocks;
  state.scheduleLifecycle = 'applied_review';
  state.scheduleApplied = true;
  state.pendingPlanConfirmation = false;
  state.lastPlanError = null;
  state.cyclesById[cycle.id] = cycle;
  mergeScheduleReviewBlocksIntoCycleProjection(state, cycle);
}

function activateSchedule(state, payload = {}) {
  const targetCycleId = payload?.cycleId || state.activeCycleId || null;
  const cycle = getTargetCycle(state, targetCycleId);
  const contract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
  if (!cycle || !contract) {
    return;
  }
  if (isCycleReadOnly(cycle)) {
    state.lastPlanError = {
      code: 'CYCLE_READ_ONLY',
      reason: 'Cannot activate schedule for an ended or archived cycle.',
      cycleId: cycle.id || targetCycleId,
    };
    return;
  }
  if (getCycleScheduleLifecycle(cycle, state) === 'active_schedule') {
    state.lastPlanError = {
      code: 'SCHEDULE_ALREADY_ACTIVE',
      reason: 'Schedule is already active.',
      cycleId: cycle.id,
      goalId: contract.goalId,
    };
    return;
  }
  const reviewBlocks = Array.isArray(cycle.scheduleReviewBlocks) ? cycle.scheduleReviewBlocks : [];
  if (!reviewBlocks.length) {
    state.lastPlanError = {
      code: 'NO_APPLIED_REVIEW_BLOCKS',
      reason: 'No applied review blocks available to activate.',
      cycleId: cycle.id,
      goalId: contract.goalId,
    };
    return;
  }
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const timeZone = state.appTime?.timeZone || 'UTC';
  const temporalAudit = buildScheduleTemporalAudit(state, cycle, reviewBlocks, {
    referenceDayKey: state.appTime?.activeDayKey || state.today?.date || null,
    timeZone,
  });
  const activationDelayAssessment = buildActivationDelayAssessment(state, cycle, reviewBlocks, temporalAudit, {
    timeZone,
  });
  // When the user has already confirmed "None happened" and rebased, suppress the stale
  // gate so the second activation attempt (after rebase) is not blocked again.
  const wasRebasedFromDelayResolution =
    temporalAudit.rebaseRequired === false &&
    (String(cycle?.activationDelayAssessment?.selectedResolution || '') === 'rebase' ||
      String(cycle?.temporalStatus || '') === 'rebased');
  if (wasRebasedFromDelayResolution) {
    temporalAudit.temporalReasonCodes = (temporalAudit.temporalReasonCodes || []).filter(
      (c) => c !== 'GENERATED_SCHEDULE_STALE' && c !== 'REASSESSMENT_TEMPORAL_DRIFT_DETECTED'
    );
  }
  cycle.activationRequestedAtISO = temporalAudit.activationRequestedAtISO;
  cycle.executionStartDayKey = temporalAudit.executionStartDayKey;
  cycle.temporalStatus = temporalAudit.temporalStatus;
  cycle.rebaseRequired = temporalAudit.rebaseRequired;
  cycle.pastDatedBlockCount = temporalAudit.pastDatedBlockCount;
  cycle.scheduleDebtMinutes = temporalAudit.scheduleDebtMinutes;
  cycle.compressionDelta = temporalAudit.compressionDelta;
  cycle.temporalReasonCodes = temporalAudit.temporalReasonCodes;
  cycle.activationDelayAssessment = activationDelayAssessment;
  if (activationDelayAssessment.status === 'requires_user_investigation') {
    const reasonCodes = Array.from(new Set(activationDelayAssessment.reasonCodes || []));
    cycle.reassessmentStatus = 'required';
    cycle.reassessmentRequiredAtISO = nowISO;
    state.cyclesById[cycle.id] = cycle;
    state.lastPlanError = {
      code: 'ACTIVATION_DELAY_REASSESSMENT_REQUIRED',
      reason:
        'This schedule was applied for an earlier start date. Confirm what happened during the delay window before activation or rebase.',
      cycleId: cycle.id,
      goalId: contract.goalId,
      reasonCodes,
      meta: {
        appliedAtISO: activationDelayAssessment.appliedAtISO,
        activationRequestedAtISO: activationDelayAssessment.activationRequestedAtISO,
        appliedStartDayKey: activationDelayAssessment.appliedStartDayKey,
        requestedExecutionStartDayKey: activationDelayAssessment.requestedExecutionStartDayKey,
        executionStartDayKey: activationDelayAssessment.requestedExecutionStartDayKey,
        delayDays: activationDelayAssessment.delayDays,
        pastDatedBlockCount: activationDelayAssessment.pastDatedBlockCount,
        scheduleDebtMinutes: activationDelayAssessment.scheduleDebtMinutes,
      },
    };
    return;
  }
  if (temporalAudit.temporalReasonCodes.length > 0) {
    cycle.reassessmentStatus = 'required';
    cycle.reassessmentRequiredAtISO = nowISO;
    state.cyclesById[cycle.id] = cycle;
    state.lastPlanError = {
      code: temporalAudit.rebaseRequired ? 'SCHEDULE_REBASE_REQUIRED' : 'GENERATED_SCHEDULE_STALE',
      reason: temporalAudit.rebaseRequired
        ? 'This schedule contains unexecuted blocks dated before activation. Rebase or regenerate before execution can begin.'
        : 'This generated schedule has gone stale and must be regenerated or rebased before activation.',
      cycleId: cycle.id,
      goalId: contract.goalId,
      reasonCodes: temporalAudit.temporalReasonCodes,
      meta: {
        generatedAtISO: temporalAudit.generatedAtISO,
        generatedForStartDayKey: temporalAudit.generatedForStartDayKey,
        validUntilDayKey: temporalAudit.validUntilDayKey,
        activationRequestedAtISO: temporalAudit.activationRequestedAtISO,
        executionStartDayKey: temporalAudit.executionStartDayKey,
        temporalStatus: temporalAudit.temporalStatus,
        rebaseRequired: temporalAudit.rebaseRequired,
        pastDatedBlockCount: temporalAudit.pastDatedBlockCount,
        scheduleDebtMinutes: temporalAudit.scheduleDebtMinutes,
        compressionDelta: temporalAudit.compressionDelta,
        daysSinceGenerated: temporalAudit.daysSinceGenerated,
      },
    };
    return;
  }
  let activatedCount = 0;
  reviewBlocks.forEach((block) => {
    if (!block?.id) {
      return;
    }
    const activatedBlock = {
      id: block.id,
      cycleId: cycle.id,
      goalId: contract.goalId,
      origin: 'schedule_active',
      suggestionId: block.suggestionId || block.id || null,
      deliverableId: block.deliverableId ?? null,
      actionId: block.actionId ?? null,
      sessionIndex: Number.isFinite(block.sessionIndex) ? Number(block.sessionIndex) : null,
      identityKey: block.identityKey || null,
      criterionId: block.criterionId ?? null,
      lockedUntilDayKey: block.lockedUntilDayKey ?? null,
      requiredSystemBlock: true,
      practice: block.practice || block.domain || 'Focus',
      domain: block.domain || block.practice || 'Focus',
      title: block.title || block.label || null,
      label: block.title || block.label || null,
      start: block.startISO || block.start || null,
      end: block.endISO || block.end || null,
      status: block.status || 'planned',
      missedAtISO: null,
    };
    const event = buildExecutionEventFromBlock(block, {
      kind: 'create',
      completed: false,
      cycleId: cycle.id,
      goalId: contract.goalId,
      origin: 'schedule_active',
      requiredSystemBlock: true,
      suggestionId: block.suggestionId || block.id || null,
      deliverableId: block.deliverableId ?? null,
      actionId: block.actionId ?? null,
      sessionIndex: Number.isFinite(block.sessionIndex) ? Number(block.sessionIndex) : null,
      identityKey: block.identityKey || null,
      criterionId: block.criterionId ?? null,
      lockedUntilDayKey: block.lockedUntilDayKey ?? null,
      status: block.status || 'planned',
      canonicalTitle: block.title || block.label || null,
      rawLabel: block.title || block.label || null,
    });
    if (!canEmitExecutionEvent(state.executionEvents || [], event)) {
      return;
    }
    appendExecutionEvent(state, event);
    upsertCanonicalBlock(state, activatedBlock);
    appendTransitionTrace(state, {
      transition: 'activate',
      blockId: block.id || null,
      label: block.title || '',
    });
    activatedCount += 1;
  });
  if (activatedCount === 0) {
    state.lastPlanError = {
      code: 'SCHEDULE_DUPLICATE_ACTIVATION_BLOCKED',
      reason: 'No review blocks could be activated.',
      cycleId: cycle.id,
      goalId: contract.goalId,
    };
    return;
  }
  cycle.scheduleReviewBlocks = [];
  cycle.scheduleLifecycle = 'active_schedule';
  cycle.scheduleActivatedAtISO = nowISO;
  cycle.scheduleActiveHash = cycle.scheduleDraftHash || buildScheduleDraftHash(reviewBlocks);
  mergeScheduleReviewBlocksIntoCycleProjection(state, cycle);
  state.scheduleLifecycle = 'active_schedule';
  state.scheduleReviewBlocks = [];
  state.scheduleApplied = true;
  state.pendingPlanConfirmation = false;
  state.draftScheduleAppliedAtISO = state.draftScheduleAppliedAtISO || nowISO;
  state.lastPlanError = null;
  state.cyclesById[cycle.id] = cycle;
  state.planEvents = state.planEvents || [];
  state.planEvents.push({
    id: nextDeterministicId(state, `schedule-activated-${cycle.id}`),
    type: 'SCHEDULE_ACTIVATED',
    cycleId: cycle.id,
    goalId: contract.goalId,
    atISO: nowISO,
    reviewCount: reviewBlocks.length,
    timeZone,
  });
}

function resolveRenegotiationOption(cycle, payload = {}) {
  const optionPool = Array.isArray(cycle?.metrics?.renegotiationOptions)
    ? cycle.metrics.renegotiationOptions
    : Array.isArray(cycle?.recoveryContract?.options)
      ? cycle.recoveryContract.options
      : [];
  if (!optionPool.length) {
    return null;
  }
  if (payload?.option && typeof payload.option === 'object') {
    const exact = optionPool.find(
      (option) =>
        option?.type === payload.option.type &&
        Number(option?.delta ?? null) === Number(payload.option.delta ?? null) &&
        String(option?.summary || '') === String(payload.option.summary || '')
    );
    if (exact) {
      return exact;
    }
  }
  if (Number.isInteger(payload?.optionIndex) && payload.optionIndex >= 0 && payload.optionIndex < optionPool.length) {
    return optionPool[payload.optionIndex];
  }
  if (payload?.optionType) {
    const normalizedType = String(payload.optionType || '')
      .trim()
      .toUpperCase();
    const preferredDelta = Number(payload?.delta);
    const typed = optionPool.filter(
      (option) =>
        String(option?.type || '')
          .trim()
          .toUpperCase() === normalizedType
    );
    if (typed.length === 0) {
      return null;
    }
    if (Number.isFinite(preferredDelta)) {
      const exact = typed.find((option) => Number(option?.delta) === preferredDelta);
      if (exact) {
        return exact;
      }
    }
    return typed[0];
  }
  return optionPool[0] || null;
}

function applyRenegotiationOption(state, payload = {}) {
  const activeCycleId = state?.activeCycleId || null;
  if (!activeCycleId) {
    return;
  }
  const requestedCycleId = payload?.cycleId || activeCycleId;
  if (requestedCycleId !== activeCycleId) {
    state.lastPlanError = {
      code: 'RENEGOTIATION_ACTIVE_CYCLE_MISMATCH',
      reason: 'Renegotiation may only be applied to the canonical active cycle.',
      cycleId: requestedCycleId,
      activeCycleId,
    };
    return;
  }
  const cycle = state?.cyclesById?.[activeCycleId];
  if (!cycle) {
    return;
  }
  const canonicalContract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
  const goalId = canonicalContract?.goalId || null;
  if (payload?.goalId && goalId && payload.goalId !== goalId) {
    state.lastPlanError = {
      code: 'RENEGOTIATION_GOAL_MISMATCH',
      reason: 'Renegotiation payload goal does not match canonical active goal.',
      cycleId: activeCycleId,
      goalId,
    };
    return;
  }
  const selectedOption = resolveRenegotiationOption(cycle, payload);
  if (!selectedOption) {
    state.lastPlanError = {
      code: 'RENEGOTIATION_OPTION_MISSING',
      reason: 'No deterministic renegotiation option is available to apply.',
      cycleId: activeCycleId,
      goalId,
    };
    return;
  }

  const optionType = String(selectedOption?.type || '')
    .trim()
    .toUpperCase();
  const nowISO = state?.appTime?.nowISO || new Date().toISOString();
  const timeZone = state?.appTime?.timeZone || APP_TIME_ZONE;
  const priorContract = {
    endDayKey: canonicalContract?.endDayKey || null,
    maxBlocksPerDay: Number(cycle?.strategy?.constraints?.maxBlocksPerDay) || null,
    maxBlocksPerWeek: Number(cycle?.strategy?.constraints?.maxBlocksPerWeek) || null,
    maxMinutesPerDay: Number(cycle?.strategy?.constraints?.maxMinutesPerDay) || null,
  };

  let applied = false;
  let unsupportedReason = null;
  let changeSet = {};

  if (optionType === 'EXTEND_DEADLINE') {
    const deltaDaysRaw = Number(selectedOption?.delta);
    const deltaDays = Number.isFinite(deltaDaysRaw) && deltaDaysRaw > 0 ? Math.max(1, Math.round(deltaDaysRaw)) : 0;
    const currentEndDayKey =
      canonicalContract?.endDayKey || canonicalContract?.deadline?.dayKey || cycle?.goalContract?.endDayKey || null;
    if (!(deltaDays > 0) || !currentEndDayKey) {
      unsupportedReason = 'RENEGOTIATION_EXTENSION_INPUT_INVALID';
    } else {
      const nextEndDayKey = addDays(currentEndDayKey, deltaDays, timeZone);
      cycle.goalContract = cycle.goalContract || {};
      cycle.goalContract.endDayKey = nextEndDayKey;
      cycle.goalContract.deadlineISO = `${nextEndDayKey}T23:59:59.000Z`;
      cycle.goalContract.endDateISO = `${nextEndDayKey}T23:59:59.000Z`;
      if (cycle.goalContract.deadline && typeof cycle.goalContract.deadline === 'object') {
        cycle.goalContract.deadline = {
          ...cycle.goalContract.deadline,
          dayKey: nextEndDayKey,
        };
      }
      if (cycle.goalGovernanceContract) {
        cycle.goalGovernanceContract = {
          ...cycle.goalGovernanceContract,
          activeUntilISO: nextEndDayKey,
        };
      }
      if (cycle.definiteGoal?.deadlineDayKey) {
        cycle.definiteGoal = { ...cycle.definiteGoal, deadlineDayKey: nextEndDayKey };
      }
      if (cycle.contract && typeof cycle.contract === 'object') {
        cycle.contract = {
          ...cycle.contract,
          endDayKey: nextEndDayKey,
          deadlineISO: `${nextEndDayKey}T23:59:59.000Z`,
          endDateISO: `${nextEndDayKey}T23:59:59.000Z`,
        };
      }
      changeSet = {
        deadlineExtendedDays: deltaDays,
        endDayKey: nextEndDayKey,
      };
      applied = true;
    }
  } else if (optionType === 'INCREASE_THROUGHPUT') {
    const deltaPerWeekRaw = Number(selectedOption?.delta);
    const deltaPerWeek =
      Number.isFinite(deltaPerWeekRaw) && deltaPerWeekRaw > 0 ? Math.max(1, Math.round(deltaPerWeekRaw)) : 0;
    if (!(deltaPerWeek > 0)) {
      unsupportedReason = 'RENEGOTIATION_THROUGHPUT_INPUT_INVALID';
    } else {
      const strategy = cycle.strategy || {};
      const strategyConstraints = strategy.constraints || {};
      const workWindows = canonicalContract?.workWindows || cycle?.goalContract?.workWindows || null;
      const workDays =
        countRawWorkWindows(workWindows) > 0
          ? getWorkDaysFromWindows(workWindows)
          : strategyConstraints?.workableDayPolicy?.weekdays ||
            state?.constraints?.workableDayPolicy?.weekdays || ['mon', 'tue', 'wed', 'thu', 'fri'];
      const workDaysCount = Math.max(1, Array.isArray(workDays) ? workDays.length : 5);
      const priorWeek =
        Number.isFinite(Number(strategyConstraints.maxBlocksPerWeek)) &&
        Number(strategyConstraints.maxBlocksPerWeek) > 0
          ? Number(strategyConstraints.maxBlocksPerWeek)
          : resolveCycleCapacityPerDay(state, cycle) * 7;
      const priorDay =
        Number.isFinite(Number(strategyConstraints.maxBlocksPerDay)) && Number(strategyConstraints.maxBlocksPerDay) > 0
          ? Number(strategyConstraints.maxBlocksPerDay)
          : Math.max(1, Math.ceil(priorWeek / workDaysCount));
      const nextWeek = Math.max(priorWeek, priorWeek + deltaPerWeek);
      const nextDay = Math.max(priorDay, Math.ceil(nextWeek / workDaysCount));
      cycle.strategy = {
        ...strategy,
        constraints: {
          ...strategyConstraints,
          maxBlocksPerWeek: nextWeek,
          maxBlocksPerDay: nextDay,
        },
      };
      changeSet = {
        maxBlocksPerWeek: nextWeek,
        maxBlocksPerDay: nextDay,
        throughputIncreasePerWeek: deltaPerWeek,
      };
      applied = true;
    }
  } else {
    unsupportedReason = `RENEGOTIATION_OPTION_UNSUPPORTED_${optionType || 'UNKNOWN'}`;
  }

  const record = {
    id: nextDeterministicId(state, 'reneg'),
    atISO: nowISO,
    cycleId: activeCycleId,
    goalId,
    optionType,
    optionSummary: selectedOption?.summary || optionType,
    optionDelta: Number.isFinite(Number(selectedOption?.delta)) ? Number(selectedOption.delta) : null,
    optionUnit: selectedOption?.unit || null,
    status: applied ? 'APPLIED' : 'UNSUPPORTED',
    priorContract,
    appliedContractChanges: changeSet,
    unsupportedReason: unsupportedReason || null,
  };
  cycle.renegotiationHistory = Array.isArray(cycle.renegotiationHistory) ? cycle.renegotiationHistory : [];
  cycle.renegotiationHistory.push(record);
  cycle.lastRenegotiationApplied = record;
  cycle.metrics = {
    ...(cycle.metrics || {}),
    renegotiationApplyResult: {
      status: record.status,
      optionType,
      atISO: nowISO,
      reason: unsupportedReason || null,
    },
  };

  if (applied) {
    state.lastPlanError = null;
    if (state.activeCycleId === cycle.id && cycle.goalContract) {
      state.goalExecutionContract = {
        ...(state.goalExecutionContract || {}),
        ...cycle.goalContract,
        goalId: cycle.goalContract.goalId || goalId || state.goalExecutionContract?.goalId || null,
      };
    }
    setCycleProposedBlocks(state, cycle.id, []);
    generatePlan(state, { cycleId: cycle.id, source: 'RENEGOTIATION_APPLY' });
  } else {
    state.lastPlanError = {
      code: 'RENEGOTIATION_OPTION_UNSUPPORTED',
      reason: unsupportedReason || 'Renegotiation option is analysis-only in this build.',
      cycleId: activeCycleId,
      goalId,
      optionType,
    };
  }
  state.cyclesById[activeCycleId] = cycle;
}

function setDefiniteGoal(state, payload = {}) {
  ensureCycleStructures(state);
  const cycle = getActiveCycle(state);
  if (!cycle) {
    return;
  }
  const outcome = (payload.outcome || '').trim();
  const deadlineDayKey = payload.deadlineDayKey || cycle.definiteGoal?.deadlineDayKey || '';
  if (!deadlineDayKey) {
    return;
  }
  cycle.definiteGoal = { outcome: outcome || cycle.definiteGoal?.outcome || 'Definite goal', deadlineDayKey };
  state.cyclesById[cycle.id] = cycle;
  if (state.goalExecutionContract) {
    state.goalExecutionContract = {
      ...state.goalExecutionContract,
      goalText: outcome || state.goalExecutionContract.goalText,
      endDayKey: deadlineDayKey,
    };
  }
}

function compileGoalEquation(state, payload = {}) {
  ensureCycleStructures(state);
  ensureAdmissionStores(state);
  const cycle = getActiveCycle(state);
  if (!cycle) {
    return;
  }
  const equation = payload?.equation;
  if (!equation) {
    return;
  }
  const timeZone = state.appTime?.timeZone || 'UTC';
  const nowKey = state.appTime?.activeDayKey || state.today?.date || nowDayKey(timeZone);
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const admission = admitGoal(equation, {
    nowISO,
    timeZone,
    cycleId: cycle.id,
    constraints: state.constraints,
    acceptedBlocks: [],
  });
  cycle.goalAdmission = {
    status: admission.status,
    reasonCodes: admission.reasonCodes,
    admittedAtISO: admission.status === 'ADMITTED' ? nowISO : undefined,
  };
  const goalIdForAdmission =
    state.goalExecutionContract?.goalId || cycle.goalContract?.goalId || cycle.contract?.goalId || null;
  if (goalIdForAdmission) {
    state.goalAdmissionByGoal[goalIdForAdmission] = cycle.goalAdmission;
  }
  if (!isAdmitted(admission)) {
    const aspiration = {
      aspirationId: nextDeterministicId(state, `asp-${cycle.id}`),
      cycleId: cycle.id,
      createdAtISO: nowISO,
      draft: equation,
      admissionStatus: admission.status,
      reasonCodes: admission.reasonCodes,
    };
    const existing = state.aspirationsByCycleId[cycle.id] || [];
    state.aspirationsByCycleId[cycle.id] = [...existing, aspiration];
    state.lastPlanError = {
      code: admission.status,
      reason: admission.reasonCodes.join(', '),
      cycleId: cycle.id,
      goalId: goalIdForAdmission || undefined,
    };
    state.cyclesById[cycle.id] = cycle;
    return;
  }
  state.lastPlanError = null;
  cycle.goalEquation = equation;
  const label = equation.label || `${equation.objectiveValue} ${equation.objective.replace(/_/g, ' ')}`;
  cycle.definiteGoal = {
    outcome: label,
    deadlineDayKey: equation.deadlineDayKey,
  };

  // AUTO-SEED DELIVERABLES AT ADMISSION TIME
  // This ensures generateColdPlanForCycle can find them in the workspace
  const workspace = getDeliverableWorkspace(state, cycle.id);
  if (workspace && (!workspace.deliverables || workspace.deliverables.length === 0)) {
    let autoDeliverables = [];
    let autoStrategy = null;

    // Try mechanism-class first
    try {
      autoDeliverables = generateAutoDeliverables(equation) || [];
      autoStrategy = { method: 'mechanism-class', detectedType: 'derived from goal keywords' };
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[ADMISSION] mechanism-class auto-seed failed, trying Phase 1 fallback', err?.message);
      }
    }

    // FALLBACK: Use Phase 1 approach if mechanism-class didn't work
    if (!autoDeliverables || autoDeliverables.length === 0) {
      const autoResult = buildAutoDeliverablesFromGoalContract(equation, nowKey, timeZone);
      autoDeliverables = autoResult.deliverables || [];
      autoStrategy = { method: 'phase1-autostrategy', ...autoResult };
    }

    // Persist to workspace AND cycle.strategy
    if (autoDeliverables && autoDeliverables.length > 0) {
      workspace.deliverables = autoDeliverables;
      workspace.autoGenerated = true;
      workspace.autoGeneratedAt = nowISO;
      workspace.autoStrategy = autoStrategy;
      state.deliverablesByCycleId[cycle.id] = workspace;

      // Also update cycle.strategy so they're visible immediately
      if (!cycle.strategy) {
        cycle.strategy = buildDefaultStrategy({
          goalId: cycle.goalContract?.goalId || 'goal',
          deadlineISO: equation.deadlineDayKey ? `${equation.deadlineDayKey}T23:59:59Z` : '',
          timeZone,
          deliverables: autoDeliverables,
        });
      } else {
        cycle.strategy.deliverables = autoDeliverables;
        cycle.strategy.assumptionsHash = buildAssumptionsHash(cycle.strategy);
      }
    }
  }
  if (state.goalExecutionContract) {
    state.goalExecutionContract = {
      ...state.goalExecutionContract,
      goalText: label,
      endDayKey: equation.deadlineDayKey,
    };
  }
  const { planProof, scheduleBlocks } = compileGoalEquationPlan({
    equation,
    nowDayKey: nowKey,
    timeZone,
    cycleId: cycle.id,
  });
  cycle.planProof = derivePlanProof(equation, { nowDayKey: nowKey, timeZone });
  cycle.goalPlan = {
    planProof,
    scheduleBlocks,
    generatedAtISO: state.appTime?.nowISO || new Date().toISOString(),
  };
  state.cyclesById[cycle.id] = cycle;
  if (planProof.status === 'SUBMITTED' && planProof.verdict !== 'INFEASIBLE') {
    const { days } = materializeBlocksFromEvents(state.executionEvents || [], { todayISO: state.today?.date });
    const allBlocks = (days || []).flatMap((d) => d.blocks || []);
    const coldBlocks = allBlocks.filter((b) => b.origin === 'cold_plan' && b.cycleId === cycle.id);
    coldBlocks.forEach((b) => {
      deleteBlock(state, b.id);
    });
    const lockUntilDayKey = addDays(nowKey, 6, timeZone);
    const domainMap = {
      BODY: 'BODY',
      SKILL: 'FOCUS',
      OUTPUT: 'CREATION',
    };
    const domain = domainMap[equation.family] || 'FOCUS';
    scheduleBlocks.forEach((block) => {
      createBlock(state, {
        id: block.id,
        cycleId: cycle.id,
        goalId: state.goalExecutionContract?.goalId || cycle.goalContract?.goalId || null,
        origin: 'cold_plan',
        startISO: block.startISO,
        durationMinutes: block.durationMinutes,
        domain,
        title: block.title,
        surface: 'today',
        timeZone,
        lockedUntilDayKey: block.locked ? lockUntilDayKey : null,
      });
    });
  }
}

function acceptSuggestedBlock(state, proposalId) {
  if (!proposalId) {
    return;
  }
  const suggestions = (state.proposedBlocks || []).map((entry) => ({ ...entry }));
  const target = suggestions.find((s) => s.id === proposalId);
  const existingCreate = (state.executionEvents || []).find(
    (event) =>
      event?.kind === 'create' && (event?.suggestionId === proposalId || event?.blockId === `blk-${proposalId}`)
  );
  if (!target || target.status !== 'suggested') {
    return;
  }
  if (existingCreate) {
    return;
  }
  const link = getSuggestionLink(state, state.activeCycleId, proposalId);
  const blockId = `blk-${proposalId}`;
  createBlock(state, {
    id: blockId,
    suggestionId: proposalId,
    origin: 'suggestion',
    goalId: target.goalId,
    domain: target.domain,
    title: target.title,
    start: target.startISO,
    end: target.endISO,
    durationMinutes: target.durationMinutes,
    deliverableId: link?.deliverableId ?? target.deliverableId ?? null,
    criterionId: link?.criterionId ?? target.criterionId ?? null,
    status: 'planned',
    surface: 'week',
  });
  const nowISO = new Date().toISOString();
  target.status = 'accepted';
  target.acceptedAtISO = nowISO;
  state.suggestionEvents = state.suggestionEvents || [];
  state.suggestionEvents.push({
    id: `sev-${proposalId}-accepted`,
    type: 'suggested_block_accepted',
    proposalId,
    goalId: target.goalId,
    atISO: nowISO,
  });
  state.planPreview = computePlanPreview({
    suggestedBlocks: suggestions,
    planDraft: state.planDraft,
    contract: state.goalExecutionContract,
    policyState: getCurrentPolicyState(state),
    historyProfile: buildHistoryProfileForDraft(state, state.planDraft),
    timeZone: state.appTime?.timeZone || APP_TIME_ZONE,
  });
  setCycleProposedBlocks(state, state.activeCycleId || null, suggestions);
}

function applyCalibrationDays(state, daysPerWeek, uncertain = false) {
  const parsed = Number.parseInt(daysPerWeek, 10);
  if (!Number.isFinite(parsed) || parsed < 3 || parsed > 7) {
    return;
  }
  const plan = state.planDraft;
  const contract = state.goalExecutionContract;
  if (!plan || !contract) {
    return;
  }
  if (plan.status === 'calibrated' && plan.daysPerWeek === parsed) {
    return;
  }
  const prevSuggestionIds = (state.proposedBlocks || []).filter((s) => s && s.status === 'suggested').map((s) => s.id);

  const blocksPerWeek = Math.max(6, Math.min(14, parsed * 2));
  const templates = plan.templates || [];
  const totalMinutesPerWeek = blocksPerWeek * averageTemplateMinutes(templates);
  plan.daysPerWeek = parsed;
  plan.blocksPerWeek = blocksPerWeek;
  plan.totalMinutesPerWeek = totalMinutesPerWeek;
  plan.status = 'calibrated';

  const calibration = state.planCalibration || { confidence: 0.3, assumptions: [], missingInfo: [] };
  const bump = uncertain ? 0.05 : 0.15;
  const cap = uncertain ? 0.7 : 0.9;
  calibration.confidence = Math.min(cap, (calibration.confidence || 0) + bump);
  calibration.daysPerWeek = parsed;
  calibration.assumptions = [
    `Assuming ${parsed} days/week execution.`,
    `Default capacity ${blocksPerWeek} blocks/week.`,
  ];
  calibration.missingInfo = (calibration.missingInfo || []).filter((entry) => entry !== 'daysPerWeek');
  state.planCalibration = calibration;
  if (state.activeCycleId && state.cyclesById?.[state.activeCycleId]) {
    state.cyclesById[state.activeCycleId].planDraft = plan;
    state.cyclesById[state.activeCycleId].calibration = calibration;
  }

  const preserved = (state.proposedBlocks || []).filter((s) => s && s.status !== 'suggested');
  const reservedIds = new Set(preserved.map((s) => s.id));
  const suggestedTarget = Math.max(0, blocksPerWeek - reservedIds.size);
  const nextSuggested = buildSuggestedBlocks({
    goalId: contract.goalId,
    startDayKey: contract.startDayKey,
    blocksPerWeek: suggestedTarget,
    templates,
    daysPerWeek: parsed,
    goalText: contract.goalText,
    primaryDomain: plan.primaryDomain,
    reservedIds,
    timeZone: state.appTime?.timeZone,
  });

  if (!IS_PRODUCTION) {
    console.group('JERICHO_SUGGESTION_TRACE');
    console.log({
      traceId: `trace-calibration-handoff-${contract.goalId}`,
      cycleId: state.activeCycleId || null,
      goalId: contract.goalId || null,
      moduleName: 'applyCalibrationDays',
      stepName: 'handoff',
      status: nextSuggested.length > 0 ? 'ok' : 'fail',
      timestamp: new Date().toISOString(),
      inputSummary: {
        contractStartDayKey: contract.startDayKey || null,
        contractHorizonDays: contract.horizonDays || null,
        suggestedTarget,
        preservedCount: preserved.length,
        timeZone: state.appTime?.timeZone || null,
      },
      outputSummary: {
        nextSuggestedCount: nextSuggested.length,
        totalProposedCount: preserved.length + nextSuggested.length,
      },
      errorCode: nextSuggested.length > 0 ? null : 'CALIBRATION_SUGGESTION_EMPTY',
      reasonCodes: nextSuggested.length === 0 ? ['check_startDayKey_and_timeZone'] : [],
    });
    console.groupEnd();
  }

  setCycleProposedBlocks(state, state.activeCycleId || null, [...preserved, ...nextSuggested]);

  const nowISO = new Date().toISOString();
  state.suggestionEvents = state.suggestionEvents || [];
  state.suggestionEvents.push({
    id: nextDeterministicId(state, `sev-recompute-${contract.goalId}`),
    type: 'suggestions_recomputed',
    reason: 'capacity_calibration',
    prevSuggestionIds,
    nextSuggestionIds: nextSuggested.map((s) => s.id),
    atISO: nowISO,
  });

  state.planPreview = computePlanPreview({
    suggestedBlocks: state.proposedBlocks || [],
    planDraft: state.planDraft,
    contract: state.goalExecutionContract,
    policyState: getCurrentPolicyState(state),
    historyProfile: buildHistoryProfileForDraft(state, state.planDraft),
    timeZone: state.appTime?.timeZone || APP_TIME_ZONE,
  });

  state.calibrationEvents = state.calibrationEvents || [];
  state.calibrationEvents.push({
    id: nextDeterministicId(state, `cal-${contract.goalId}`),
    type: 'calibration_days_per_week_set',
    daysPerWeek: parsed,
    dayKey: nowDayKey(state.appTime?.timeZone),
    contractId: state.activeCycleId
      ? state.cyclesById?.[state.activeCycleId]?.goalGovernanceContract?.contractId
      : undefined,
    planId: plan.id,
    atISO: nowISO,
  });
}

function rejectSuggestedBlock(state, proposalId, reason) {
  if (!proposalId) {
    return;
  }
  const suggestions = (state.proposedBlocks || []).map((entry) => ({ ...entry }));
  const target = suggestions.find((s) => s.id === proposalId);
  if (!target) {
    return;
  }
  if (target.status === 'rejected') {
    return;
  }
  if (target.status !== 'suggested') {
    return;
  }
  const nowISO = new Date().toISOString();
  target.status = 'rejected';
  target.rejectedReason = reason || 'declined';
  state.suggestionEvents = state.suggestionEvents || [];
  state.suggestionEvents.push({
    id: `sev-${proposalId}-rejected`,
    type: 'suggestion_rejected',
    suggestionId: proposalId,
    goalId: target.goalId,
    reason: target.rejectedReason,
    dayKey: nowDayKey(),
    contractId: state.activeCycleId
      ? state.cyclesById?.[state.activeCycleId]?.goalGovernanceContract?.contractId
      : undefined,
    planId: state.planDraft?.id,
    atISO: nowISO,
  });
  state.planPreview = computePlanPreview({
    suggestedBlocks: suggestions,
    planDraft: state.planDraft,
    contract: state.goalExecutionContract,
    policyState: getCurrentPolicyState(state),
    historyProfile: buildHistoryProfileForDraft(state, state.planDraft),
    timeZone: state.appTime?.timeZone || APP_TIME_ZONE,
  });
  setCycleProposedBlocks(state, state.activeCycleId || null, suggestions);
}

function ignoreSuggestedBlock(state, proposalId) {
  if (!proposalId) {
    return;
  }
  const suggestions = (state.proposedBlocks || []).map((entry) => ({ ...entry }));
  const target = suggestions.find((s) => s.id === proposalId);
  if (!target || target.status !== 'suggested') {
    return;
  }
  const nowISO = new Date().toISOString();
  target.status = 'ignored';
  target.ignoredAtISO = nowISO;
  state.suggestionEvents = state.suggestionEvents || [];
  state.suggestionEvents.push({
    id: `sev-${proposalId}-ignored`,
    type: 'suggestion_ignored',
    suggestionId: proposalId,
    goalId: target.goalId,
    atISO: nowISO,
  });
  state.planPreview = computePlanPreview({
    suggestedBlocks: suggestions,
    planDraft: state.planDraft,
    contract: state.goalExecutionContract,
    policyState: getCurrentPolicyState(state),
    historyProfile: buildHistoryProfileForDraft(state, state.planDraft),
    timeZone: state.appTime?.timeZone || APP_TIME_ZONE,
  });
  setCycleProposedBlocks(state, state.activeCycleId || null, suggestions);
}

function dismissSuggestedBlock(state, proposalId) {
  if (!proposalId) {
    return;
  }
  const suggestions = (state.proposedBlocks || []).map((entry) => ({ ...entry }));
  const target = suggestions.find((s) => s.id === proposalId);
  if (!target || target.status !== 'suggested') {
    return;
  }
  const nowISO = new Date().toISOString();
  target.status = 'dismissed';
  target.dismissedAtISO = nowISO;
  state.suggestionEvents = state.suggestionEvents || [];
  state.suggestionEvents.push({
    id: `sev-${proposalId}-dismissed`,
    type: 'suggestion_dismissed',
    suggestionId: proposalId,
    goalId: target.goalId,
    atISO: nowISO,
  });
  state.planPreview = computePlanPreview({
    suggestedBlocks: suggestions,
    planDraft: state.planDraft,
    contract: state.goalExecutionContract,
    policyState: getCurrentPolicyState(state),
    historyProfile: buildHistoryProfileForDraft(state, state.planDraft),
    timeZone: state.appTime?.timeZone || APP_TIME_ZONE,
  });
  setCycleProposedBlocks(state, state.activeCycleId || null, suggestions);
}

function createDeliverable(state, payload = {}) {
  const cycleId = payload.cycleId || state.activeCycleId;
  if (!cycleId) {
    return;
  }
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) {
    return;
  }
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const domain = (payload.domain || 'CREATION').toString().toUpperCase();
  const deliverable = {
    id: `deliv-${cycleId}-${(workspace.deliverables || []).length + 1}`,
    cycleId,
    domain,
    title: (payload.title || 'Deliverable').toString(),
    requiredBlocks: Number.isFinite(payload.requiredBlocks) ? Number(payload.requiredBlocks) : 0,
    weight: Number.isFinite(payload.weight) ? Number(payload.weight) : 1,
    dueDayKey: payload.dueDayKey || null,
    criteria: [],
    createdAtISO: nowISO,
    updatedAtISO: nowISO,
  };
  workspace.deliverables = [...(workspace.deliverables || []), deliverable];
  workspace.lastUpdatedAtISO = nowISO;
  syncDeliverableWorkspaceIndexes(workspace);
  state.deliverablesByCycleId[cycleId] = workspace;
}

function updateDeliverable(state, payload = {}) {
  const cycleId = payload.cycleId || state.activeCycleId;
  const deliverableId = payload.deliverableId;
  if (!cycleId || !deliverableId) {
    return;
  }
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) {
    return;
  }
  const patch = payload.patch || {};
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  workspace.deliverables = (workspace.deliverables || []).map((d) =>
    d.id === deliverableId
      ? {
          ...d,
          ...patch,
          requiredBlocks: patch.requiredBlocks !== undefined ? Number(patch.requiredBlocks) || 0 : d.requiredBlocks,
          domain: patch.domain ? patch.domain.toString().toUpperCase() : d.domain,
          updatedAtISO: nowISO,
        }
      : d
  );
  workspace.lastUpdatedAtISO = nowISO;
  syncDeliverableWorkspaceIndexes(workspace);
  state.deliverablesByCycleId[cycleId] = workspace;
}

function deleteDeliverable(state, payload = {}) {
  const cycleId = payload.cycleId || state.activeCycleId;
  const deliverableId = payload.deliverableId;
  if (!cycleId || !deliverableId) {
    return;
  }
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) {
    return;
  }
  workspace.deliverables = (workspace.deliverables || []).filter((d) => d.id !== deliverableId);
  if (workspace.suggestionLinks) {
    Object.keys(workspace.suggestionLinks).forEach((key) => {
      if (workspace.suggestionLinks[key]?.deliverableId === deliverableId) {
        delete workspace.suggestionLinks[key];
      }
    });
  }
  syncDeliverableWorkspaceIndexes(workspace);
  state.deliverablesByCycleId[cycleId] = workspace;
}

function createCriterion(state, payload = {}) {
  const cycleId = payload.cycleId || state.activeCycleId;
  const deliverableId = payload.deliverableId;
  const text = (payload.text || '').toString().trim();
  if (!cycleId || !deliverableId || !text) {
    return;
  }
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) {
    return;
  }
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  workspace.deliverables = (workspace.deliverables || []).map((d) => {
    if (d.id !== deliverableId) {
      return d;
    }
    const nextCriteria = [
      ...(d.criteria || []),
      {
        id: `crit-${deliverableId}-${(d.criteria || []).length + 1}`,
        deliverableId,
        text,
        isDone: false,
      },
    ];
    return { ...d, criteria: nextCriteria, updatedAtISO: nowISO };
  });
  workspace.lastUpdatedAtISO = nowISO;
  syncDeliverableWorkspaceIndexes(workspace);
  state.deliverablesByCycleId[cycleId] = workspace;
}

function toggleCriterionDone(state, payload = {}) {
  const cycleId = payload.cycleId || state.activeCycleId;
  const deliverableId = payload.deliverableId;
  const criterionId = payload.criterionId;
  if (!cycleId || !deliverableId || !criterionId) {
    return;
  }
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) {
    return;
  }
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const dayKey = state.appTime?.activeDayKey || nowDayKey();
  workspace.deliverables = (workspace.deliverables || []).map((d) => {
    if (d.id !== deliverableId) {
      return d;
    }
    const nextCriteria = (d.criteria || []).map((c) => {
      if (c.id !== criterionId) {
        return c;
      }
      const isDone = Boolean(payload.isDone);
      return {
        ...c,
        isDone,
        doneAtISO: isDone ? nowISO : null,
        doneAtDayKey: isDone ? dayKey : null,
      };
    });
    return { ...d, criteria: nextCriteria, updatedAtISO: nowISO };
  });
  workspace.lastUpdatedAtISO = nowISO;
  syncDeliverableWorkspaceIndexes(workspace);
  state.deliverablesByCycleId[cycleId] = workspace;
}

function deleteCriterion(state, payload = {}) {
  const cycleId = payload.cycleId || state.activeCycleId;
  const deliverableId = payload.deliverableId;
  const criterionId = payload.criterionId;
  if (!cycleId || !deliverableId || !criterionId) {
    return;
  }
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) {
    return;
  }
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  workspace.deliverables = (workspace.deliverables || []).map((d) => {
    if (d.id !== deliverableId) {
      return d;
    }
    return { ...d, criteria: (d.criteria || []).filter((c) => c.id !== criterionId), updatedAtISO: nowISO };
  });
  workspace.lastUpdatedAtISO = nowISO;
  syncDeliverableWorkspaceIndexes(workspace);
  state.deliverablesByCycleId[cycleId] = workspace;
}

function linkBlockToDeliverable(state, payload = {}) {
  const id = payload.blockId || payload.id;
  if (!id) {
    return;
  }
  updateBlock(state, {
    id,
    deliverableId: payload.deliverableId ?? null,
    criterionId: payload.criterionId ?? null,
  });
}

function assignSuggestionLink(state, payload = {}) {
  const cycleId = payload.cycleId || state.activeCycleId;
  const suggestionId = payload.suggestionId;
  if (!cycleId || !suggestionId) {
    return;
  }
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) {
    return;
  }
  workspace.suggestionLinks = workspace.suggestionLinks || {};
  if (!payload.deliverableId && !payload.criterionId) {
    delete workspace.suggestionLinks[suggestionId];
  } else {
    workspace.suggestionLinks[suggestionId] = {
      deliverableId: payload.deliverableId ?? null,
      criterionId: payload.criterionId ?? null,
    };
  }
  state.deliverablesByCycleId[cycleId] = workspace;
}

function daysBetween(start, end) {
  if (!start || !end) {
    return 0;
  }
  const s = new Date(start);
  const e = new Date(end);
  const diff = e.getTime() - s.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function setPrimaryObjective(state, objectiveId) {
  state.today.primaryObjectiveId = objectiveId || null;
}

function normalizeStatus(rawStatus, surface = 'today') {
  const normalized =
    rawStatus === 'completed'
      ? 'completed'
      : rawStatus === 'in_progress'
        ? 'in_progress'
        : rawStatus === 'pending' || rawStatus === 'planned'
          ? 'planned'
          : 'planned';
  // Only Today may transition to in_progress/completed; planning surfaces remain planned.
  if (surface !== 'today' && normalized !== 'planned') {
    return 'planned';
  }
  return normalized;
}

function normalizeDomainValue(rawDomain) {
  const upper = typeof rawDomain === 'string' ? rawDomain.trim().toUpperCase() : rawDomain;
  const domain = normalizeDomain(upper);
  const practiceLabel =
    domain === 'BODY' ? 'Body' : domain === 'CREATION' ? 'Creation' : domain === 'RESOURCES' ? 'Resources' : 'Focus';
  return { domain, practice: practiceLabel };
}

function ensureDraftEvents(state) {
  if (!state.draftEvents) {
    state.draftEvents = [];
  }
  return state.draftEvents;
}

function recordDraftEvent(state, event) {
  if (!event) {
    return;
  }
  ensureDraftEvents(state).push(event);
}

function generateDraftBlockId(state, action = {}) {
  const cycleId = action.cycleId || state.activeCycleId || 'draft';
  const key = `${cycleId}:${action.blockId || action.startISO || action.endISO || 'new'}`;
  state._draftIdSequence = state._draftIdSequence || {};
  const seq = (state._draftIdSequence[key] || 0) + 1;
  state._draftIdSequence[key] = seq;
  return action.blockId || `draft:${cycleId}:${seq}`;
}

function handleDraftScheduleClear(state, action = {}) {
  const cycleId = action.cycleId || state.activeCycleId || 'draft';
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  (state.today?.blocks || []).forEach((block) => {
    const event = buildExecutionEventFromBlock(block, {
      kind: 'create',
      cycleId,
      completed: false,
      origin: 'draft',
      status: block?.status || 'in_progress',
    });
    if (canEmitExecutionEvent(state.executionEvents || [], event)) {
      appendExecutionEvent(state, event);
    }
  });
  recordDraftEvent(state, {
    id: `draft-schedule-clear:${cycleId}:${nowISO}`,
    type: 'DRAFT_SCHEDULE_CLEAR',
    cycleId,
    atISO: nowISO,
  });
  state._draftIdSequence = state._draftIdSequence || {};
  state._draftIdSequence[cycleId] = 0;
}

function handleDraftBlockCreate(state, action = {}) {
  const startISO = action.startISO || action.start;
  const endISO = action.endISO || action.end;
  if (!startISO || !endISO || !isValidISO(startISO) || !isValidISO(endISO)) {
    return;
  }
  const startDate = new Date(startISO);
  const endDate = new Date(endISO);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return;
  }
  const minutes = clampDurationMinutes((endDate.getTime() - startDate.getTime()) / 60000);
  const cycleId = action.cycleId || state.activeCycleId || null;
  const blockId = generateDraftBlockId(state, { ...action, cycleId });
  const { domain } = normalizeDomainValue(action.domain || action.practice);
  const rawLabel = action.title || action.label || 'Untitled task';
  const status = action.status || 'in_progress';
  const dateISO = dayKeyFromISO(startISO, state.appTime?.timeZone) || dayKeyFromDate(startDate);
  const event = {
    id: nextDeterministicId(state, `draft-create-${blockId}`),
    blockId,
    dateISO,
    minutes,
    rawLabel,
    canonicalTitle: action.title || action.label || null,
    domain,
    cycleId,
    goalId: action.goalId || null,
    origin: 'draft',
    deliverableId: action.deliverableId ?? null,
    criterionId: action.criterionId ?? null,
    lockedUntilDayKey: action.lockedUntilDayKey ?? null,
    completed: false,
    kind: 'create',
    startISO,
    endISO,
    status,
  };
  if (canEmitExecutionEvent(state.executionEvents || [], event)) {
    appendExecutionEvent(state, event);
  }
  recordDraftEvent(state, {
    id: nextDeterministicId(state, `draft-block-${blockId}`),
    type: 'DRAFT_BLOCK_CREATE',
    blockId,
    cycleId,
    startISO,
    endISO,
    status,
    createdAtISO: state.appTime?.nowISO || new Date().toISOString(),
  });
}

function clampDurationMinutes(rawMinutes) {
  const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 30;
  const safe = Math.max(1, Math.min(minutes, 24 * 60));
  return safe;
}

function deriveDateFromStart(startDate) {
  return dayKeyFromDate(startDate);
}

function findBlockById(state, id) {
  if (!id) {
    return null;
  }
  const blocks = getAllBlocks(state);
  return blocks.find((b) => b.id === id) || null;
}

function ensureBlockStore(state) {
  if (!state.blockStore || typeof state.blockStore !== 'object') {
    state.blockStore = { blocks: {} };
  }
  if (!state.blockStore.blocks || typeof state.blockStore.blocks !== 'object') {
    state.blockStore.blocks = {};
  }
}

function upsertCanonicalBlock(state, block) {
  if (!block || !block.id) {
    return;
  }
  ensureBlockStore(state);
  state.blockStore.blocks[block.id] = block;
}

export function getCanonicalBlocks(state) {
  if (!state.blockStore?.blocks) {
    return [];
  }
  return Object.values(state.blockStore.blocks);
}

function createBlock(state, payload = {}) {
  const surface = (payload.surface || '').toString().toLowerCase() || 'today';
  const timeZone = payload.timeZone || state.appTime?.timeZone;
  const startISO = payload.startISO || payload.start || '';
  if (!isValidISO(startISO)) {
    assertValidISO('createBlock.startISO', startISO, { payload });
    return;
  }
  const startDate = new Date(startISO);
  if (!Number.isFinite(startDate.getTime())) {
    assertValidISO('createBlock.startDate', startISO, { payload });
    return;
  }
  const durationMinutes =
    payload.durationMinutes ||
    (payload.durationMs ? payload.durationMs / 60000 : null) ||
    (payload.duration ? payload.duration / 60000 : null);
  const minutes = clampDurationMinutes(durationMinutes);
  const endDate = new Date(startDate.getTime() + minutes * 60 * 1000);
  const { domain, practice } = normalizeDomainValue(payload.domain || payload.practice);
  const status = normalizeStatus(payload.status, surface);
  const date = dayKeyFromISO(startISO, timeZone) || deriveDateFromStart(startDate);
  const linkToGoal = payload.linkToGoal !== false;
  const goalId = payload.goalId || (linkToGoal ? state.activeGoalId : null);
  const cycleId = payload.cycleId || state.activeCycleId || null;
  const origin = payload.origin || (payload.suggestionId ? 'suggestion' : 'manual');
  const deliverableId = payload.deliverableId ?? null;
  const criterionId = payload.criterionId ?? null;
  const lockedUntilDayKey = payload.lockedUntilDayKey ?? null;

  const newBlock = {
    id: payload.id || nextDeterministicId(state, 'blk'),
    cycleId,
    goalId,
    origin,
    suggestionId: payload.suggestionId || null,
    deliverableId,
    criterionId,
    lockedUntilDayKey,
    practice,
    domain,
    title: payload.title || payload.label || 'Untitled task',
    label: payload.title || payload.label || 'Untitled task',
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    status,
    optional: payload.optional || false,
    objectiveId: payload.objectiveId || state.today?.primaryObjectiveId || null,
  };

  const event = buildExecutionEventFromBlock(newBlock, {
    dateISO: date,
    kind: 'create',
    completed: false,
    cycleId,
    goalId,
    origin,
    suggestionId: payload.suggestionId || null,
    deliverableId,
    criterionId,
    lockedUntilDayKey,
  });
  if (!canEmitExecutionEvent(state.executionEvents || [], event)) {
    return;
  }
  appendExecutionEvent(state, event);
  const skipProjectionWrites = payload.skipProjectionWrites === true;
  if (skipProjectionWrites) {
    upsertCanonicalBlock(state, newBlock);
    return newBlock;
  }
  const ensureDay = (arr = []) => {
    const existing = arr.find((d) => d.date === date);
    if (existing) {
      return arr.map((d) => (d.date === date ? { ...d, blocks: [...(d.blocks || []), newBlock] } : d));
    }
    return [
      ...arr,
      { date, blocks: [newBlock], completionRate: 0, driftSignal: 'forming', loadByPractice: {}, practices: [] },
    ];
  };

  state.today.blocks = [...(state.today.blocks || []), newBlock];
  state.cycle = ensureDay(state.cycle || []);
  state.currentWeek.days = ensureDay(state.currentWeek?.days || []);
  state.lastSessionChange = {
    type: 'CREATE_BLOCK',
    timestamp: new Date().toISOString(),
    beforeSummary: '',
    afterSummary: state.today?.summaryLine || '',
  };
  upsertCanonicalBlock(state, newBlock);
  return newBlock;
}

function appendSuggestedApplyBlocks(
  state,
  items = [],
  { cycleId = null, goalId = null, timeZone = 'UTC', defaultDomain = 'FOCUS' } = {}
) {
  if (!items.length) {
    return 0;
  }
  const existingBlockIds = new Set((state.executionEvents || []).map((event) => event?.blockId).filter(Boolean));
  let created = 0;
  items.forEach((item) => {
    if (!item?.startISO) {
      return;
    }
    const startDate = new Date(item.startISO);
    if (!Number.isFinite(startDate.getTime())) {
      return;
    }
    const duration = Number.isFinite(item.durationMinutes) ? Number(item.durationMinutes) : 30;
    const minutes = clampDurationMinutes(duration);
    const endDate = item.endISO ? new Date(item.endISO) : new Date(startDate.getTime() + minutes * 60000);
    if (!Number.isFinite(endDate.getTime())) {
      return;
    }
    const { domain, practice } = normalizeDomainValue(item.domain || item.domainKey || defaultDomain || 'FOCUS');
    const blockId = nextDeterministicId(state, 'blk');
    if (existingBlockIds.has(blockId)) {
      return;
    }
    existingBlockIds.add(blockId);
    const newBlock = {
      id: blockId,
      cycleId,
      goalId,
      origin: 'suggested_apply',
      suggestionId: item.id || null,
      identityKey: item.identityKey || null,
      deliverableId: item.payload?.deliverableId ?? null,
      actionId: item.actionId ?? null,
      sessionIndex: Number.isFinite(item.sessionIndex) ? Number(item.sessionIndex) : null,
      criterionId: item.payload?.criterionId ?? null,
      lockedUntilDayKey: item.payload?.lockedUntilDayKey ?? null,
      practice,
      domain,
      title: item.title || 'Scheduled action',
      label: item.title || 'Scheduled action',
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      status: normalizeStatus(item.status, 'today'),
      optional: Boolean(item.optional),
      objectiveId: state.today?.primaryObjectiveId || null,
    };
    const dateISO = dayKeyFromISO(newBlock.start, timeZone) || deriveDateFromStart(startDate);
    appendExecutionEvent(
      state,
      buildExecutionEventFromBlock(newBlock, {
        dateISO,
        kind: 'create',
        completed: false,
        cycleId,
        goalId,
        origin: 'suggested_apply',
        suggestionId: item.id || null,
        deliverableId: item.payload?.deliverableId ?? null,
        actionId: item.actionId ?? null,
        sessionIndex: Number.isFinite(item.sessionIndex) ? Number(item.sessionIndex) : null,
        identityKey: item.identityKey || null,
        criterionId: item.payload?.criterionId ?? null,
        lockedUntilDayKey: item.payload?.lockedUntilDayKey ?? null,
      })
    );
    upsertCanonicalBlock(state, newBlock);
    created += 1;
  });
  return created;
}

function updateBlock(state, payload = {}) {
  const surface = (payload.surface || '').toString().toLowerCase() || 'today';
  if (!payload.id) {
    return;
  }
  if (surface === 'year') {
    return;
  } // Year is add/delete only per contract.

  const targetId = payload.id;
  const existing = findBlockById(state, targetId);
  if (!existing) {
    return;
  }
  const applyUpdate = (block) => {
    if (block.id !== targetId) {
      return block;
    }
    const startDate = payload.start ? new Date(payload.start) : new Date(block.start);
    const durationMinutes =
      payload.durationMinutes ||
      (payload.durationMs ? payload.durationMs / 60000 : null) ||
      (payload.duration ? payload.duration / 60000 : null) ||
      (new Date(block.end).getTime() - new Date(block.start).getTime()) / 60000;
    const minutes = clampDurationMinutes(durationMinutes);
    const endDate = new Date(startDate.getTime() + minutes * 60 * 1000);
    const { domain, practice } = normalizeDomainValue(
      payload.domain || payload.practice || block.domain || block.practice
    );
    const status = normalizeStatus(payload.status || block.status, surface);
    return {
      ...block,
      practice,
      domain,
      title: payload.title || payload.label || block.title || block.label,
      label: payload.label || payload.title || block.label,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      status,
      deliverableId: Object.prototype.hasOwnProperty.call(payload, 'deliverableId')
        ? payload.deliverableId
        : block.deliverableId,
      criterionId: Object.prototype.hasOwnProperty.call(payload, 'criterionId')
        ? payload.criterionId
        : block.criterionId,
    };
  };

  const updateBlocks = (blocks = []) => blocks.map(applyUpdate);
  state.today.blocks = updateBlocks(state.today.blocks);
  state.currentWeek.days = (state.currentWeek?.days || []).map((d) => ({
    ...d,
    blocks: updateBlocks(d.blocks),
  }));
  state.cycle = (state.cycle || []).map((d) => ({
    ...d,
    blocks: updateBlocks(d.blocks),
  }));

  const updated = applyUpdate(existing);
  if (state.blockStore?.blocks && Object.prototype.hasOwnProperty.call(state.blockStore.blocks, targetId)) {
    state.blockStore.blocks[targetId] = updated;
  }
  const event = buildExecutionEventFromBlock(updated, {
    kind: 'update',
    completed: false,
    dateISO: null,
    startISO: null,
    endISO: null,
  });
  delete event.dateISO;
  delete event.startISO;
  delete event.endISO;
  if (!canEmitExecutionEvent(state.executionEvents || [], event)) {
    return;
  }
  appendExecutionEvent(state, event);
}

function deleteBlock(state, id, meta = {}) {
  if (!id) {
    return;
  }
  const existing = findBlockById(state, id);
  if (!existing) {
    return;
  }
  const targetCycle = existing.cycleId ? getTargetCycle(state, existing.cycleId) : getActiveCycle(state);
  const targetLifecycle = getCycleScheduleLifecycle(targetCycle, state);
  const isActiveSystemBlock =
    targetLifecycle === 'active_schedule' &&
    Boolean(existing.requiredSystemBlock || String(existing.origin || '').trim() === 'schedule_active');
  if (isActiveSystemBlock) {
    state.lastPlanError = {
      code: 'REQUIRED_BLOCK_DELETE_DISALLOWED',
      reason: 'Required active schedule blocks must be rescheduled, not deleted.',
      cycleId: targetCycle?.id || existing.cycleId || null,
      goalId: existing.goalId || targetCycle?.goalContract?.goalId || null,
      reasonCodes: ['REQUIRED_BLOCK_DELETE_DISALLOWED', 'RESCHEDULE_REQUIRED_FOR_ACTIVE_BLOCK'],
    };
    return;
  }
  const event = buildExecutionEventFromBlock(existing, {
    kind: 'delete',
    completed: false,
    minutes: 0,
  });
  if (!canEmitExecutionEvent(state.executionEvents || [], event)) {
    return;
  }
  const remove = (blocks = []) => blocks.filter((b) => b.id !== id);
  state.today.blocks = remove(state.today.blocks);
  state.currentWeek.days = (state.currentWeek?.days || []).map((d) => ({ ...d, blocks: remove(d.blocks) }));
  state.cycle = (state.cycle || []).map((d) => ({ ...d, blocks: remove(d.blocks) }));
  if (targetCycle) {
    if (Array.isArray(targetCycle.scheduleReviewBlocks)) {
      targetCycle.scheduleReviewBlocks = remove(targetCycle.scheduleReviewBlocks);
    }
    if (Array.isArray(targetCycle.proposedBlocks)) {
      targetCycle.proposedBlocks = remove(targetCycle.proposedBlocks);
    }
    if (Array.isArray(targetCycle.suggestedBlocks)) {
      targetCycle.suggestedBlocks = remove(targetCycle.suggestedBlocks);
    }
    if (Array.isArray(targetCycle.blocks)) {
      targetCycle.blocks = remove(targetCycle.blocks);
    }
  }
  if (Array.isArray(state.scheduleReviewBlocks)) {
    state.scheduleReviewBlocks = remove(state.scheduleReviewBlocks);
  }
  if (Array.isArray(state.proposedBlocks)) {
    state.proposedBlocks = remove(state.proposedBlocks);
  }
  if (Array.isArray(state.suggestedBlocks)) {
    state.suggestedBlocks = remove(state.suggestedBlocks);
  }
  if (state.blockStore?.blocks && Object.prototype.hasOwnProperty.call(state.blockStore.blocks, id)) {
    delete state.blockStore.blocks[id];
  }
  appendExecutionEvent(state, event);
  const removedAtISO = state.appTime?.nowISO || new Date().toISOString();
  appendPlanMutationEvent(
    state,
    buildPlanMutationEventFromBlock(existing, {
      blockId: id,
      removedAtISO,
      source: meta.source || 'user_action',
      reasonCode: meta.reasonCode || 'user_removed',
      note: meta.note || null,
    })
  );
}

function addRecurringPattern(state, pattern) {
  state.recurringPatterns = [...(state.recurringPatterns || []), pattern];
}

function applyRecurringPatterns(state) {
  const patterns = state.recurringPatterns || [];
  if (!patterns.length || !state.today?.date) {
    return;
  }
  const date = new Date(state.today.date);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  patterns.forEach((p) => {
    if (!p.weekdays || !p.weekdays.includes(weekday)) {
      return;
    }
    const startDate = new Date(date.getTime());
    startDate.setUTCHours(0, 0, 0, 0);
    const startMs = startDate.getTime() + (p.startMs || 0);
    const endMs = startMs + (p.durationMs || 30 * 60 * 1000);
    const exists = (state.today.blocks || []).some(
      (b) => b.practice === p.practice && b.start === new Date(startMs).toISOString()
    );
    if (exists) {
      return;
    }
    state.today.blocks = [
      ...(state.today.blocks || []),
      {
        id: `rec-${p.id}-${state.today.date}`,
        practice: p.practice,
        label: `${p.practice} (recurring)`,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        status: 'planned',
        objectiveId: state.today.primaryObjectiveId || null,
      },
    ];
  });
}

function applyNextSuggestion(state) {
  const suggestion = state.nextSuggestion;
  if (!suggestion) {
    return;
  }
  if (suggestion.type === 'resume' || suggestion.type === 'start_planned') {
    if (suggestion.blockId) {
      updateBlockStatus(state, suggestion.blockId, 'in_progress');
    }
    return;
  }
  if (suggestion.type === 'repair') {
    const duration = new Date(suggestion.endISO).getTime() - new Date(suggestion.startISO).getTime();
    const payload = {
      date: suggestion.startISO.slice(0, 10),
      practice: suggestion.practice,
      start: suggestion.startISO,
      duration,
      status: 'in_progress',
    };
    createBlock(state, payload);
  }
}
