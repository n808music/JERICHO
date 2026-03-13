import structuredClone from '@ungap/structured-clone';
import { PRACTICE_KEYS } from './metricsPolicy.js';
import { normalizeDomain } from './domain.js';
import { normalizeBlocksDomain } from './normalizeBlock.js';
import { addDays, dayKeyFromDate, dayKeyFromISO, dayKeyFromParts, nowDayKey, buildLocalStartISO, assertValidISO, isValidISO, APP_TIME_ZONE } from './time/time.ts';
import { buildDefaultStrategy, generateColdPlan, generateDailyProjection } from './coldPlan.ts';
import { compileGoalEquationPlan } from './goalEquation.ts';
import { admitGoal, isAdmitted } from './goalAdmission.ts';
import { compileAutoAsanaPlan } from './engine/autoAsanaPlan.ts';
import { buildAssumptionsHash, normalizeDeliverables, normalizeRouteOption } from './strategy.ts';
import { buildAutoDeliverablesFromGoalContract } from '../domain/autoStrategy.ts';
import { generateAutoDeliverables, debugAutoDeliverablesGeneration } from '../core/autoDeliverables.ts';
import { getDeadlineDayKey } from '../core/deadline.ts';
import { generateDeterministicPlan } from '../core/deterministicPlanGenerator.ts';
import { canEmitExecutionEvent } from './engine/executionContract.ts';
import { appendExecutionEvent, buildExecutionEventFromBlock, materializeBlocksFromEvents } from './engine/todayAuthority.ts';
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
import {
  getCanonicalCycleActions,
  getCanonicalCycleContract,
  getCanonicalCycleDeliverables,
  getCanonicalProposedBlocks
} from './cycleSelectors.js';
import { buildHistoryProfile, deriveCycleHistorySignals } from '../planner/scoring/historySignals.ts';
import { computeCycleIntegrityScore, computeCyclePOS } from '../domain/scoring/cycleScoring.ts';
import { aggregateCycleOutcomes, buildPosExplanation } from '../domain/scoring/posExplanation.ts';
import { buildCycleDynamicsTransitionPatch, deriveCycleDynamicsProfile } from './engine/cycleDynamics.ts';
import { compileGoalToDeliverables, toLegacyWorkspaceDeliverables } from './engine/goalToDeliverables.ts';

/**
 * @typedef {import('./identityTypes.js').IdentityState} IdentityState
 */
/**
 * @typedef {import('./identityTypes.js').LensesConfig} LensesConfig
 */

/**
 * @typedef {{ type: 'BEGIN_BLOCK'; id: string } | { type: 'COMPLETE_BLOCK'; id: string } | { type: 'RESCHEDULE_BLOCK'; id: string; start: string; end: string } | { type: 'APPLY_LENSES'; lenses: Partial<LensesConfig> } | { type: 'SET_VIEW_DATE'; date: string } | { type: 'REBALANCE_TODAY'; mode?: 'CLEAR_AFTERNOON' } | { type: 'COMPLETE_ONBOARDING'; onboarding: any } | { type: 'START_NEW_CYCLE'; payload: any } | { type: 'START_NEW_CYCLE_WITH_DECISION'; payload: { mode: 'archive' | 'delete' } } | { type: 'END_CYCLE'; cycleId: string } | { type: 'ARCHIVE_AND_CLONE_CYCLE'; cycleId: string; overrides?: any } | { type: 'SET_ACTIVE_CYCLE'; cycleId: string } | { type: 'DELETE_CYCLE'; cycleId: string } | { type: 'HARD_DELETE_CYCLE'; cycleId: string } | { type: 'ADD_TRUTH_ENTRY'; payload: any } | { type: 'CREATE_BLOCK'; payload: any } | { type: 'UPDATE_BLOCK'; payload: any } | { type: 'DELETE_BLOCK'; id: string } | { type: 'ADD_RECURRING_PATTERN'; pattern: any } | { type: 'SET_PRIMARY_OBJECTIVE'; objectiveId: string | null } | { type: 'SET_CALIBRATION_DAYS'; daysPerWeek: number; uncertain?: boolean } | { type: 'GENERATE_PLAN' } | { type: 'APPLY_PLAN' } | { type: 'ACCEPT_SUGGESTED_BLOCK'; proposalId: string } | { type: 'REJECT_SUGGESTED_BLOCK'; proposalId: string; reason: string } | { type: 'IGNORE_SUGGESTED_BLOCK'; proposalId: string } | { type: 'DISMISS_SUGGESTED_BLOCK'; proposalId: string } | { type: 'CREATE_DELIVERABLE'; payload: any } | { type: 'UPDATE_DELIVERABLE'; payload: any } | { type: 'DELETE_DELIVERABLE'; payload: any } | { type: 'CREATE_CRITERION'; payload: any } | { type: 'TOGGLE_CRITERION_DONE'; payload: any } | { type: 'DELETE_CRITERION'; payload: any } | { type: 'LINK_BLOCK_TO_DELIVERABLE'; payload: any } | { type: 'ASSIGN_SUGGESTION_LINK'; payload: any } | { type: 'SET_STRATEGY'; payload: any } | { type: 'GENERATE_COLD_PLAN'; payload?: any } | { type: 'REBASE_COLD_PLAN'; payload?: any } | { type: 'SET_DEFINITE_GOAL'; outcome: string; deadlineDayKey: string } | { type: 'COMPILE_GOAL_EQUATION'; payload: any } | { type: 'APPLY_RENEGOTIATION_OPTION'; payload?: any }} Action
 */

export function computeDerivedState(state, action) {
  /** @type {IdentityState} */
  let next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  if (!next.templates) next.templates = { objectives: {} };
  if (!next.templates.objectives) next.templates.objectives = {};
  if (!next.lastAdaptedDate) next.lastAdaptedDate = null;
  if (!next.stability) next.stability = {};
  if (!next.meta) next.meta = { version: '1.0.0', onboardingComplete: false };
  if (!next.recurringPatterns) next.recurringPatterns = [];
  if (!next.ledger) next.ledger = [];
  ensureCycleStructures(next);
  ensureAdmissionStores(next);
  ensureDeliverablesStore(next);
  hydrateActiveCycleState(next);
  const hadCycleRecords = Boolean(next.cyclesById && Object.keys(next.cyclesById).length);
  if (!next.executionEvents) next.executionEvents = [];
  refreshColdPlanDailyProjection(next);
  const previousTodayBlocks = next.today?.blocks ? [...next.today.blocks] : [];

  const prevSuggestion = next.nextSuggestion;

  switch (action.type) {
    case 'BEGIN_BLOCK':
      updateBlockStatus(next, action.id, 'in_progress');
      break;
    case 'COMPLETE_BLOCK':
      // handled in reducer for ledger; keep no-op here
      break;
    case 'RESCHEDULE_BLOCK':
      rescheduleBlock(next, action.id, action.start, action.end);
      break;
    case 'APPLY_LENSES': {
      const withoutPractice = { ...(action.lenses || {}) };
      if (withoutPractice.practice) delete withoutPractice.practice;
      next.lenses = { ...next.lenses, ...withoutPractice };
      ensureCycleStructures(next);
      const patternTargets = sanitizePatternTargets(
        (next.lenses.pattern && next.lenses.pattern.dailyTargets) || []
      );
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
        afterSummary: next.today?.summaryLine || ''
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
        scenarioLabel: onboardingPayload?.scenarioLabel || next.meta?.scenarioLabel || ''
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
        scenarioLabel: String(scenarioLabel || '').slice(0, 120)
      };
      next.pendingOnboardingInputs = onboardingPayload || null;
      break;
    }
    case 'START_NEW_CYCLE':
      startNewCycle(next, action.payload);
      break;
    case 'START_NEW_CYCLE_WITH_DECISION':
      startNewCycleWithDecision(next, action.payload || {});
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
        if (!block?.id) return;
        const existingCreate = (next.executionEvents || []).some((event) => event.blockId === block.id && event.kind === 'create');
        if (existingCreate) return;
        const event = buildExecutionEventFromBlock(block, {
          id: `base-create-${block.id}`,
          kind: 'create',
          completed: false,
          dateISO: dayKeyFromISO(block.start || block.date, timezone) || currentDayKey,
          startISO: block.start,
          endISO: block.end,
          status: block.status || 'in_progress'
        });
        if (canEmitExecutionEvent(next.executionEvents || [], event)) {
          appendExecutionEvent(next, event);
        }
      });

      if (shouldRollover({ state: next, nowISO, timezone })) {
        const { eventsEmitted, lastRolloverDayISO } = rolloverAtMidnight({
          state: next,
          nowISO,
          timezone
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
        activeDayKey: currentDayKey || next.appTime?.activeDayKey
      };
      if (!next.today) next.today = {};
      next.today.date = currentDayKey;
      break;
    }
    case 'UPDATE_BLOCK':
      updateBlock(next, action.payload);
      break;
    case 'DELETE_BLOCK':
      deleteBlock(next, action.id);
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
      if (!cycle) break;
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
          cycleId
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
          cycleId
        };
        setGenerateHeartbeat(next, cycleId, 0, 'EMPTY_LLM_ACTIONS');
        break;
      }
      cycle.llmActionGraph = {
        actions,
        templates: Array.isArray(payload.templates) ? payload.templates : [],
        diagnostics: payload.diagnostics || {}
      };
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
        cycleId
      };
      if (String(error.code || '').trim().toUpperCase() === 'MISSING_GOAL_DRAFT') {
        const recovery = action.payload?.recovery || {};
        const prefill = recovery?.prefill && typeof recovery.prefill === 'object' ? recovery.prefill : null;
        next.planRecovery = {
          required: recovery?.required || 'GOAL_DRAFT_CONTEXT',
          route: recovery?.route || 'STRUCTURE_GATE_2',
          prefill,
          sourceErrorCode: error.code || 'MISSING_GOAL_DRAFT',
          createdAtISO: next.appTime?.nowISO || new Date().toISOString()
        };
        if (prefill) {
          next.pendingOnboardingInputs = {
            ...(next.pendingOnboardingInputs || {}),
            ...prefill,
            goalDraftV2: {
              ...((next.pendingOnboardingInputs || {}).goalDraftV2 || {}),
              ...(prefill.goalDraftV2 || {})
            }
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
    case 'GENERATE_PLAN':
      generatePlan(next, action.payload || {});
      break;
    case 'REBUILD_SCHEDULE':
      generatePlan(next, action.payload || {});
      break;
    case 'APPLY_PLAN':
      applyGeneratedPlan(next);
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
        ...nextConstraints
      };
      if (payload.availabilityPolicy) {
        next.availabilityPolicy = {
          ...(next.availabilityPolicy || {}),
          ...payload.availabilityPolicy
        };
      }
      break;
    }
    case 'UPDATE_WORK_WINDOWS': {
      const payload = action.payload || {};
      const cycleId = payload.cycleId || next.activeCycleId;
      const cycle = cycleId ? next.cyclesById?.[cycleId] : null;
      if (!cycle) break;
      if (!cycle.goalContract) cycle.goalContract = {};
      const normalizedWorkWindows = normalizeCanonicalWorkWindows(payload.workWindows || {});
      cycle.goalContract.workWindows = normalizedWorkWindows;
      if (next.activeCycleId === cycleId) {
        next.goalExecutionContract = {
          ...(next.goalExecutionContract || {}),
          workWindows: normalizedWorkWindows
        };
      }
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
          reason: 'Active cycle missing for commit.'
        };
        break;
      }
      if (items.length === 0) {
        next.lastPlanError = {
          code: 'NO_PROPOSED_BLOCKS',
          reason: 'No preview items to commit.'
        };
        break;
      }
      const goalId = cycle.goalContract?.goalId || next.goalExecutionContract?.goalId;
      items.forEach((item, index) => {
        const startISO = item.startISO || (item.dayKey ? `${item.dayKey}T09:00:00.000Z` : null);
        const minutes = Number.isFinite(item.minutes) ? item.minutes : Number.isFinite(item.durationMin) ? item.durationMin : 30;
        const title = item.title?.trim() ? item.title.trim() : `Planned work ${index + 1}`;
        if (!startISO || !title) {
          next.lastPlanError = {
            code: 'INVALID_PREVIEW_ITEM',
            reason: `Preview item ${index + 1} missing required metadata.`
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
          surface: 'today'
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
    case 'NO_OP':
      break;
    default:
      break;
  }

  applyExecutionEvents(next);
  mergePriorTodayBlocks(next, previousTodayBlocks);
  recomputeSummaries(next);
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
    actionLine: buildStabilityAction(next.vector)
  };
  const governed = computeNextSuggestion(next);
  next.nextSuggestion = governed.suggestion;
  applySuggestionGovernance(next, prevSuggestion, governed);
  normalizeActiveCycleExecutionGraph(next);
  applyGoalDirective(next);
  applyProbabilityEligibility(next);
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
  next.correctionSignals = computeCorrectionSignals(next, 14);
  mergePriorTodayBlocks(next, previousTodayBlocks);
  syncPlacementStateFromEvents(next);
  enforceSafeDefaults(next);
  syncSuggestedBlocksMirror(next);
  flagDraftBlocks(next);
  persistActiveCycleState(next);
  enforceActiveCycleTodayBlocks(next, hadCycleRecords);
  return next;
}

export function hydrateActiveCycleState(state) {
  ensureCycleStructures(state);
  const cycle = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] : null;
  if (!cycle) return state;
  state.executionEvents = cycle.executionEvents || [];
  state.suggestionEvents = cycle.suggestionEvents || [];
  state.proposedBlocks = cycle.proposedBlocks || cycle.suggestedBlocks || [];
  if (!state.proposedBlocksByCycleId || typeof state.proposedBlocksByCycleId !== 'object') {
    state.proposedBlocksByCycleId = {};
  }
  state.proposedBlocksByCycleId[cycle.id] = state.proposedBlocks;
  state.suggestedBlocks = state.proposedBlocks;
  state.planDraft = cycle.planDraft || null;
  state.planCalibration = cycle.calibration || state.planCalibration || { confidence: 0, assumptions: [], missingInfo: [] };
  state.planPreview = cycle.planPreview || null;
  state.correctionSignals = cycle.correctionSignals || null;
  state.goalExecutionContract = cycle.goalContract || cycle.contract || state.goalExecutionContract || null;
  state.activeGoalId = cycle.goalGovernanceContract?.goalId || state.activeGoalId || null;
  state.truthEntries = cycle.truthEntries || state.truthEntries || [];
  state.suggestionHistory = cycle.suggestionHistory || state.suggestionHistory || null;
  state.lastPlanError = null;
  return state;
}

export function persistActiveCycleState(state) {
  ensureCycleStructures(state);
  const cycle = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] : null;
  if (!cycle) return state;
  cycle.executionEvents = state.executionEvents || [];
  cycle.suggestionEvents = state.suggestionEvents || [];
  cycle.proposedBlocks = state.proposedBlocks || [];
  cycle.suggestedBlocks = cycle.proposedBlocks;
  cycle.planDraft = state.planDraft || null;
  cycle.calibration = state.planCalibration || null;
  cycle.planPreview = state.planPreview || null;
  cycle.correctionSignals = state.correctionSignals || null;
  cycle.contract = cycle.goalContract || cycle.contract || state.goalExecutionContract || null;
  state.goalExecutionContract = cycle.goalContract || cycle.contract || state.goalExecutionContract || null;
  cycle.truthEntries = state.truthEntries || cycle.truthEntries || [];
  cycle.suggestionHistory = state.suggestionHistory || cycle.suggestionHistory || null;
  state.cyclesById[state.activeCycleId] = cycle;
  return state;
}

function getActiveCycleId(state) {
  return (
    state.activeCycleId ||
    state.cycles?.activeId ||
    state.cycle?.id ||
    state.activeCycle?.id ||
    null
  );
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
  if (!state?.activeCycleId) return [];
  const cycle = state?.cyclesById?.[state.activeCycleId] || null;
  if (!cycle) return [];
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
  if (!canonicalGoalId) return [];
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
        timezone
      },
      governance: {
        suggestionsEnabled: true,
        probabilityEnabled: true,
        minEvidenceEvents: 1
      },
      constraints: {
        forbiddenDirectives: ['repair'],
        maxActiveBlocks: 6
      }
    }
  ];
}

function sameSuggestion(a, b) {
  if (!a || !b) return false;
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
    denials: []
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
    dailyCountByGoal: perGoalDaily
  };
  if (governed.denials?.length) {
    const denials = [...(history.denials || [])];
    governed.denials.forEach((d) => denials.push(d));
    if (denials.length > 50) denials.splice(0, denials.length - 50);
    state.suggestionHistory.denials = denials;
  }
}

function applyExecutionEvents(state) {
  const events = state.executionEvents || [];
  if (!events.length) return;
  const { days, todayBlocks } = materializeBlocksFromEvents(events, { todayISO: state.today?.date });
  state.today.blocks = todayBlocks || [];
  state.cycle = days || [];
}

function ensureCycleStructures(state) {
  if (!state.history) state.history = { cycles: [] };
  if (!state.cyclesById) state.cyclesById = {};
  if (!state.historySignalsByCycleId) state.historySignalsByCycleId = {};
  if (!state.historyProfile) state.historyProfile = null;
  if (typeof state.activeCycleId === 'undefined') state.activeCycleId = null;
}

function nextDeterministicId(state, prefix = 'id') {
  if (!Number.isFinite(state._deterministicIdSeq)) state._deterministicIdSeq = 0;
  state._deterministicIdSeq += 1;
  return `${prefix}-${String(state._deterministicIdSeq).padStart(8, '0')}`;
}

function ensureAdmissionStores(state) {
  if (!state.goalAdmissionByGoal) state.goalAdmissionByGoal = {};
  if (!state.aspirationsByCycleId) state.aspirationsByCycleId = {};
  if (!('lastPlanError' in state)) state.lastPlanError = null;
  if (!state.debug || typeof state.debug !== 'object') state.debug = {};
  if (!state.debug.lastGenerateClickAtISO) state.debug.lastGenerateClickAtISO = null;
  if (!state.debug.lastGenerateClickCycleId) state.debug.lastGenerateClickCycleId = null;
  if (!state.debug.lastGenerateResult || typeof state.debug.lastGenerateResult !== 'object') {
    state.debug.lastGenerateResult = { proposedBlocksCount: 0, lastPlanErrorCode: null };
  }
}

function ensureDeliverablesStore(state) {
  if (!state.deliverablesByCycleId) state.deliverablesByCycleId = {};
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
      dependsOn: [],
      estimateMin: Math.max(30, Number(deliverable.estimateMin || 60)),
      deliverableId: deliverable.id
    }));
}

function normalizeActiveCycleExecutionGraph(state) {
  ensureDeliverablesStore(state);
  const cycleId = state.activeCycleId || null;
  if (!cycleId) return;
  const cycle = state.cyclesById?.[cycleId];
  if (!cycle) return;

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
        cycleId
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
  if (cycleId && state?.cyclesById?.[cycleId]) return state.cyclesById[cycleId];
  return getActiveCycle(state);
}

function isCycleReadOnly(cycle) {
  if (!cycle) return true;
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
    lastPlanErrorCode: lastPlanErrorCode || null
  };
}

function countRawWorkWindows(workWindows) {
  if (!workWindows || typeof workWindows !== 'object') return 0;
  return Object.values(workWindows).reduce((sum, rows) => {
    if (!Array.isArray(rows)) return sum;
    return sum + rows.length;
  }, 0);
}

function countNormalizedSchedulerWindows(weeklyWindows) {
  if (!weeklyWindows || typeof weeklyWindows !== 'object') return 0;
  return Object.values(weeklyWindows).reduce((sum, rows) => {
    if (!Array.isArray(rows)) return sum;
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
  if (process.env.NODE_ENV === 'production') return;
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
}

function isActiveCycleStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();
  return normalized === 'ACTIVE';
}

export function assertActiveCycleInvariant(state) {
  const active = getActiveCycle(state);
  if (!active || !isActiveCycleStatus(active.status || active.state)) {
    throw new Error('ACTIVE_CYCLE_INVALID');
  }
}

function archivePreviousCycle(state, previousCycleId) {
  if (!previousCycleId || !state.cyclesById?.[previousCycleId]) return;
  const previous = state.cyclesById[previousCycleId];
  if (!isActiveCycleStatus(previous.status)) return;
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
    flow: ended.flow
  });
}

function maxDayKey(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return a >= b ? a : b;
}

function coerceDayKey(value, timeZone) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const isoDay = dayKeyFromISO(raw, timeZone);
  if (isoDay) return isoDay;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
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

function annotateActionsWithDeliverableIds(cycle, actions = []) {
  const list = Array.isArray(actions) ? actions : [];
  if (!list.length) return [];
  const byActionId = new Map();
  const canonicalDeliverables = Array.isArray(cycle?.canonicalDeliverables) ? cycle.canonicalDeliverables : [];
  canonicalDeliverables.forEach((deliverable) => {
    const deliverableId = String(deliverable?.id || '').trim();
    if (!deliverableId) return;
    const actionIds = Array.isArray(deliverable?.actionIds) ? deliverable.actionIds : [];
    actionIds.forEach((actionId) => {
      const key = String(actionId || '').trim();
      if (!key) return;
      byActionId.set(key, deliverableId);
    });
  });
  return list.map((action, index) => {
    const actionId = String(action?.id || '').trim();
    const deliverableId = byActionId.get(actionId) || `deliv-synthetic-${index + 1}`;
    return {
      ...action,
      deliverableId
    };
  });
}

function dayKeyToDow(dayKey) {
  if (!dayKey) return null;
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return days[date.getUTCDay()] || null;
}

function parseHHMMToMinutes(hhmm) {
  const text = String(hhmm || '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.min(24 * 60, hours * 60 + minutes));
}

const WORK_WINDOW_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function normalizeCanonicalWorkWindows(workWindows) {
  return WORK_WINDOW_DAYS.reduce((acc, day) => {
    const rows = Array.isArray(workWindows?.[day]) ? workWindows[day] : [];
    acc[day] = rows
      .map((row) => ({
        start: String(row?.start || '').trim(),
        end: String(row?.end || '').trim()
      }))
      .filter((row) => row.start && row.end && row.start < row.end);
    return acc;
  }, {});
}

function getWorkDaysFromWindows(workWindows) {
  if (!workWindows || typeof workWindows !== 'object') return ['mon', 'tue', 'wed', 'thu', 'fri'];
  const workDays = Object.entries(workWindows)
    .filter(([, windows]) => Array.isArray(windows) && windows.length > 0)
    .map(([day]) => String(day || '').trim().toLowerCase());
  return workDays.length ? workDays : ['mon', 'tue', 'wed', 'thu', 'fri'];
}

function getAvailableMinutesForDow(dow, workWindows) {
  if (!workWindows || typeof workWindows !== 'object') return 60;
  const windows = Array.isArray(workWindows?.[dow]) ? workWindows[dow] : [];
  return windows.reduce((total, window) => {
    const start = parseHHMMToMinutes(window?.start);
    const end = parseHHMMToMinutes(window?.end);
    return total + Math.max(0, end - start);
  }, 0);
}

function getFirstWindowStartForDow(dow, workWindows) {
  if (!workWindows || typeof workWindows !== 'object') return '09:00';
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
  if (!workWindows || typeof workWindows !== 'object') return {};
  return Object.entries(workWindows).reduce((acc, [day, windows]) => {
    const schedulerDay = dayMap[String(day || '').toLowerCase()];
    if (!schedulerDay || !Array.isArray(windows) || windows.length === 0) return acc;
    const mapped = windows
      .map((window) => ({
        startHHMM: window?.start || '',
        endHHMM: window?.end || '',
      }))
      .filter((window) => window.startHHMM && window.endHHMM && window.startHHMM < window.endHHMM);
    if (mapped.length) acc[schedulerDay] = mapped;
    return acc;
  }, {});
}

function hasAnySchedulerWindows(weeklyWindows) {
  if (!weeklyWindows || typeof weeklyWindows !== 'object') return false;
  return Object.values(weeklyWindows).some((rows) => Array.isArray(rows) && rows.length > 0);
}

function computeWeeklyCapacityFromWorkWindows(workWindows) {
  const workDays = getWorkDaysFromWindows(workWindows);
  return workDays.reduce((total, dow) => total + getAvailableMinutesForDow(dow, workWindows), 0);
}

function clearCycleTransientState(state) {
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
  state.overdueBlockIds = [];
  state.blockLifecycleById = {};
  state.executionEvents = [];
  state.truthEntries = [];
  state.planPreview = null;
  state.planDraft = null;
  state.planCalibration = null;
  state.correctionSignals = null;
  const cycle = getActiveCycle(state);
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

export function resetCycleToGoalEntryReady(state, cycleId) {
  const targetCycleId = cycleId || state.activeCycleId || null;
  if (!targetCycleId || !state.cyclesById?.[targetCycleId]) return;

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
  state.blockLifecycleById = {};
  state.overdueBlockIds = [];
  state.cycle = [];
  state.today = { ...(state.today || {}), blocks: [] };
  state.currentWeek = { ...(state.currentWeek || {}), days: [] };
  state.draftScheduleAppliedAtISO = null;
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
    if (actionId && actionTitle) actionTitleById.set(actionId, actionTitle);
  });
  const normalized = [];
  const seen = new Set();
  (Array.isArray(proposals) ? proposals : []).forEach((proposal, index) => {
    if (!proposal || typeof proposal !== 'object') return;
    const actionId = String(proposal?.actionId || '').trim();
    const canonicalActionTitle = actionTitleById.get(actionId) || '';
    const resolvedTitle =
      canonicalActionTitle ||
      String(proposal?.title || '').trim() ||
      String(proposal?.label || '').trim() ||
      '';
    const identity = String(
      proposal.identityKey ||
        proposal.id ||
        `${cycleId || 'cycle'}::${proposal.deliverableId || 'deliv-synthetic'}::${proposal.actionId || `synthetic-action-${index + 1}`}::${proposal.sessionIndex || 0}`
    ).trim();
    if (!identity || seen.has(identity)) return;
    seen.add(identity);
    normalized.push({
      ...proposal,
      title: resolvedTitle || proposal.title,
      label: resolvedTitle || proposal.label,
      id: proposal.id || identity,
      identityKey: proposal.identityKey || identity
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
  if (!activeCycleId) return;
  state.proposedBlocksByCycleId[activeCycleId] = Array.isArray(state.proposedBlocks)
    ? state.proposedBlocks
    : [];
}

function getDeliverableWorkspace(state, cycleId) {
  ensureDeliverablesStore(state);
  if (!cycleId) return null;
  if (!state.deliverablesByCycleId[cycleId]) {
    const nowISO = state.appTime?.nowISO || new Date().toISOString();
    state.deliverablesByCycleId[cycleId] = {
      cycleId,
      deliverables: [],
      suggestionLinks: {},
      lastUpdatedAtISO: nowISO
    };
  }
  const workspace = state.deliverablesByCycleId[cycleId];
  syncDeliverableWorkspaceIndexes(workspace);
  return workspace;
}

function touchDeliverableWorkspace(state, cycleId) {
  const workspace = getDeliverableWorkspace(state, cycleId);
  if (!workspace) return null;
  workspace.lastUpdatedAtISO = state.appTime?.nowISO || new Date().toISOString();
  syncDeliverableWorkspaceIndexes(workspace);
  state.deliverablesByCycleId[cycleId] = workspace;
  return workspace;
}

function syncDeliverableWorkspaceIndexes(workspace) {
  if (!workspace || !Array.isArray(workspace.deliverables)) return;
  workspace.deliverables.forEach((deliverable, idx) => {
    workspace[idx] = deliverable;
  });
  workspace.length = workspace.deliverables.length;
}

function getSuggestionLink(state, cycleId, suggestionId) {
  if (!cycleId || !suggestionId) return null;
  const workspace = getDeliverableWorkspace(state, cycleId);
  if (!workspace?.suggestionLinks) return null;
  return workspace.suggestionLinks[suggestionId] || null;
}

function flagDraftBlocks(state) {
  if (!state.today?.blocks?.length) return;
  state.today.blocks = state.today.blocks.map((block) => ({
    ...block,
    isDraft: block.origin === 'draft' ? true : block.isDraft || false
  }));
}

function mergePriorTodayBlocks(state, previousBlocks = []) {
  if (!previousBlocks.length) return;
  const existingIds = new Set((state.today?.blocks || []).map((block) => block?.id));
  const missing = previousBlocks
    .filter((block) => block?.id && !existingIds.has(block.id))
    .map((block) => ({
      ...block,
      placementState: block.placementState === 'COMMITTED' ? 'in_progress' : block.placementState || 'in_progress'
    }));
  if (!missing.length) return;
  state.today.blocks = [...missing, ...(state.today?.blocks || [])];
}

function syncPlacementStateFromEvents(state) {
  if (!state.today?.blocks?.length) return;
  const placementStateByBlock = new Map();
  (state.executionEvents || []).forEach((event) => {
    if (event?.blockId && event.placementState) {
      placementStateByBlock.set(event.blockId, event.placementState);
    }
  });
  state.today.blocks = state.today.blocks.map((block) => ({
    ...block,
    placementState: placementStateByBlock.get(block.id) || block.placementState || 'in_progress'
  }));
}

function countCompletedBlocks(events = [], todayISO) {
  if (!events.length) return 0;
  const { days } = materializeBlocksFromEvents(events, { todayISO });
  const all = (days || []).flatMap((d) => d.blocks || []);
  return all.filter((b) => b?.status === 'completed' || b?.status === 'complete').length;
}

function setStrategy(state, payload = {}) {
  const cycle = getActiveCycle(state);
  if (!cycle) return;
  const timeZone = state.appTime?.timeZone || payload?.constraints?.tz;
  const goalId = cycle.goalContract?.goalId || cycle.contract?.goalId || state.activeGoalId || 'goal';
  const deadlineISO = payload.deadlineISO || cycle.goalContract?.deadlineISO || cycle.definiteGoal?.deadlineDayKey || '';
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
      tz: timeZone || base.constraints?.tz
    },
    milestoneProfile: payload.milestoneProfile || base.milestoneProfile || null
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
        availableCapacityPerWeek: 0
      }
    };
  }

  // Group proposedBlocks by dayKey to build forecastByDayKey
  const forecastByDayKey = {};
  result.proposedBlocks.forEach((block) => {
    if (!forecastByDayKey[block.dayKey]) {
      forecastByDayKey[block.dayKey] = {
        totalBlocks: 0,
        byDeliverable: {}
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
    infeasible: undefined
  };
}

function generateColdPlanForCycle(state, { rebaseMode = 'NONE' } = {}) {
  const cycle = getActiveCycle(state);
  if (!cycle) {
    state.lastPlanError = {
      code: 'NO_ACTIVE_CYCLE',
      reasons: ['No active cycle found'],
      timestamp: state.appTime?.nowISO || new Date().toISOString()
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
    cycle.strategy = buildDefaultStrategy({ goalId, deadlineISO: deadlineDayKey ? `${deadlineDayKey}T00:00:00Z` : '', timeZone, deliverables });
  }
  
  // Extract deadline consistently from goalContract using canonical helper
  const deadlineKey = getDeadlineDayKey(cycle.goalContract, timeZone) || 
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
    diagnosticReasons.push('NO_DELIVERABLES: Could not generate deliverables; deadline or execution constraints may be infeasible');
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
        timeZone
      },
      timestamp: nowISO || new Date().toISOString()
    };
    return;
  }
  
  const startISO = buildLocalStartISO(startDayKey, '00:00', timeZone);
  const deadlineISO = cycle.strategy?.deadlineISO || (deadlineKey ? buildLocalStartISO(deadlineKey, '23:59', timeZone).startISO : '');
  const strategy = {
    ...cycle.strategy,
    deadlineISO,
    constraints: {
      ...(cycle.strategy.constraints || {}),
      tz: timeZone || cycle.strategy.constraints?.tz
    }
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
        timezone: timeZone
      },
      mode: execMode
    });
    
    nextPlan = adaptDeterministicResultToColdPlan(deterministicResult, strategy, nowISO);
  } else {
    // Fall back to v1 generator for non-GENERIC_DETERMINISTIC (placeholder for future)
    nextPlan = generateColdPlan({
      cycleStartISO: startISO?.startISO || `${startDayKey}T00:00:00.000Z`,
      nowISO,
      strategy,
      completedCountToDate,
      rebaseMode
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
      createdAtISO: nextPlan.createdAtISO
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
        infeasibleDetails: nextPlan.infeasible
      },
      timestamp: nowISO || new Date().toISOString()
    };
  } else {
    // Clear error if plan succeeded
    state.lastPlanError = null;
  }

  refreshColdPlanDailyProjection(state);
}

function refreshColdPlanDailyProjection(state) {
  const cycle = getActiveCycle(state);
  if (!cycle || !cycle.strategy || !cycle.coldPlan) return;
  const timeZone = state.appTime?.timeZone || cycle.strategy.constraints?.tz;
  const nowISO = state.appTime?.nowISO;
  if (!timeZone || !nowISO) return;
  const asOfDayKey = dayKeyFromISO(nowISO, timeZone);
  const existing = cycle.coldPlan.dailyProjection;
  if (existing?.asOfDayKey === asOfDayKey && existing?.derivedFrom?.assumptionsHash === cycle.strategy.assumptionsHash) {
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
        coldPlanVersion: cycle.coldPlan.version
      },
      forecastByDayKey: {},
      infeasible: {
        reason: 'assumptions_changed',
        requiredCapacityPerWeek: 0,
        availableCapacityPerWeek: 0
      }
    };
    return;
  }
  const completedCountToDate = countCompletedBlocks(cycle.executionEvents || [], state.today?.date);
  cycle.coldPlan.dailyProjection = generateDailyProjection({
    nowISO,
    strategy: cycle.strategy,
    completedCountToDate,
    coldPlanVersion: cycle.coldPlan.version
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
    Focus: 0
  };
  targets.forEach((t) => {
    if (!t?.name) return;
    if (!(t.name in map)) return;
    const val = Number(t.minutes);
    map[t.name] = Number.isFinite(val) && val >= 0 ? val : 0;
  });
  return Object.entries(map).map(([name, minutes]) => ({ name, minutes }));
}

function enforceSafeDefaults(state) {
  state.today = state.today || {};
  state.today.blocks = Array.isArray(state.today.blocks) ? state.today.blocks : [];
  if (!state.nextSuggestion) state.nextSuggestion = null;
  ensureCycleStructures(state);
  if (!('goalExecutionContract' in state)) state.goalExecutionContract = null;
  if (!('planDraft' in state)) state.planDraft = null;
  if (state.planDraft) {
    if (!state.planDraft.qualityPolicyId) state.planDraft.qualityPolicyId = 'BALANCED';
    if (typeof state.planDraft.autoPolicySelection !== 'boolean') state.planDraft.autoPolicySelection = false;
    if (!Number.isFinite(state.planDraft.minPolicyHoldDays)) state.planDraft.minPolicyHoldDays = 7;
    if (typeof state.planDraft.enableQualityOptimizer !== 'boolean') state.planDraft.enableQualityOptimizer = false;
    if (typeof state.planDraft.enableMilestonePacing !== 'boolean') state.planDraft.enableMilestonePacing = false;
    if (!state.planDraft.pacingCadenceMode) state.planDraft.pacingCadenceMode = 'adaptive';
    if (typeof state.planDraft.enableHistoryPolicySelection !== 'boolean') state.planDraft.enableHistoryPolicySelection = false;
    if (!Number.isFinite(state.planDraft.historyWindowCycles)) state.planDraft.historyWindowCycles = 5;
    if (!state.planDraft.historyInfluenceStrength) state.planDraft.historyInfluenceStrength = 'standard';
  }
  if (!state.planCalibration) state.planCalibration = { confidence: 0, assumptions: [], missingInfo: [] };
  if (!('planPreview' in state)) state.planPreview = null;
  if (!('correctionSignals' in state)) state.correctionSignals = null;
  if (!state.proposedBlocks) state.proposedBlocks = [];
  if (!state.proposedBlocksByCycleId || typeof state.proposedBlocksByCycleId !== 'object') {
    state.proposedBlocksByCycleId = {};
  }
  if (!state.cycleDynamicsByCycleId || typeof state.cycleDynamicsByCycleId !== 'object') {
    state.cycleDynamicsByCycleId = {};
  }
  if (!state.suggestedBlocks) state.suggestedBlocks = [];
  if (!state.suggestionEvents) state.suggestionEvents = [];
  if (!state.deliverablesByCycleId) state.deliverablesByCycleId = {};
  if (!state.executionEvents) state.executionEvents = [];
  if (!state.truthEntries) state.truthEntries = [];
  if (!state.calibrationEvents) state.calibrationEvents = [];
  state.cycle = Array.isArray(state.cycle) ? state.cycle : [];
  state.cycle = state.cycle.map((day) => ({
    ...day,
    completionRate: Number.isFinite(day.completionRate) ? day.completionRate : 0
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
  state.stability.headline =
    state.stability.headline || 'Stability read based on current cycle.';
  state.stability.actionLine =
    state.stability.actionLine || 'Rebalance by adding one underweight practice block before 18:00.';
  if (!state.currentWeek.metrics) state.currentWeek.metrics = {};
  state.currentWeek.metrics.driftLabel = state.currentWeek.metrics.driftLabel || state.vector?.driftLabel || 'contained';
  state.currentWeek.metrics.completionRate = Number.isFinite(state.currentWeek.metrics.completionRate)
    ? state.currentWeek.metrics.completionRate
    : 0;
  if (!state.ledger) state.ledger = [];
  if (!state.suggestionHistory) {
    state.suggestionHistory = {
      dayKey: state.today?.date || nowDayKey(),
      count: 0,
      lastSuggestedAtISO: null,
      lastSuggestedAtISOByGoal: {},
      dailyCountByGoal: {},
      denials: []
    };
  }
  if (!state.suggestionEligibility) state.suggestionEligibility = {};
  if (!state.probabilityStatusByGoal) state.probabilityStatusByGoal = {};
  if (!state.directiveEligibilityByGoal) state.directiveEligibilityByGoal = {};
  if (!('goalDirective' in state)) state.goalDirective = null;
}

function computeNextSuggestion(state) {
  const { today, vector } = state;
  const blocks = today?.blocks || [];
  const contracts = collectGovernanceContracts(state);
  const goals = new Map();
  contracts.forEach((contract) => {
    if (!contract?.goalId) return;
    const list = goals.get(contract.goalId) || [];
    list.push(contract);
    goals.set(contract.goalId, list);
  });
  if (!goals.size) return { suggestion: null, eligibilityByGoal: {}, selectedGoalId: null, denials: [] };

  const nowISO = nowDayKey();
  const nowTimestampISO = new Date().toISOString();
  const history = state.suggestionHistory || {
    dayKey: nowISO,
    count: 0,
    lastSuggestedAtISO: null,
    lastSuggestedAtISOByGoal: {},
    dailyCountByGoal: {},
    denials: []
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
      directiveDomain
    });
    eligibilityByGoal[goalId] = {
      allowed: gate.allowed,
      reasons: gate.reasons,
      contractId: resolution.contract.contractId
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
    if (aStart !== bStart) return aStart.localeCompare(bStart);
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
    if (admission && admission.status !== 'ADMITTED') {
      return;
    }
    statuses[goalId] = deriveProbabilityStatus({
      goalId,
      nowISO,
      executionEventCount: (state.executionEvents || []).length,
      executionEvents: state.executionEvents || [],
      contracts
    });
  });
  state.probabilityStatusByGoal = statuses;
}

function applyProbabilityScoring(state) {
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const contracts = collectGovernanceContracts(state);
  const goalIds = Array.from(new Set(contracts.map((c) => c.goalId)));
  const probabilityByGoal = {};
  goalIds.forEach((goalId) => {
    const admission = state.goalAdmissionByGoal?.[goalId];
    if (admission && admission.status !== 'ADMITTED') {
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
    feasibilityByGoal[goalId] = computeFeasibility({ goalId, deadlineISO }, state, constraints, nowISO);
  });
  state.feasibilityByGoal = feasibilityByGoal;
}

function seedCanonicalWorkModelIfMissing(state, goalId) {
  if (!goalId) return;
  state.goalWorkById = state.goalWorkById || {};
  const existing = Array.isArray(state.goalWorkById[goalId]) ? state.goalWorkById[goalId] : [];
  if (existing.length > 0) return;
  const cycle = resolveCycleForGoal(state, goalId);
  if (!cycle) return;

  const canonicalActions = getCanonicalCycleActions(cycle);
  const canonicalDeliverables = getCanonicalCycleDeliverables(state?.deliverablesByCycleId || {}, cycle?.id || null, cycle);
  const canonicalProposed = getCanonicalProposedBlocks(cycle?.proposedBlocks, cycle?.suggestedBlocks);
  const canonicalCommitted = getAllBlocks(state).filter((block) => {
    if (!block) return false;
    if (block?.goalId && block.goalId !== goalId) return false;
    if (block?.cycleId && cycle?.id && block.cycleId !== cycle.id) return false;
    const status = String(block?.status || '').toLowerCase();
    return status !== 'completed' && status !== 'complete' && status !== 'cancelled' && status !== 'canceled';
  });

  let derived = canonicalActions
    .filter((action) => action?.id || action?.title)
    .map((action, index) => ({
      workItemId: `derived-action-${goalId}-${index + 1}`,
      title: String(action?.title || `Action ${index + 1}`),
      blocksRemaining: Math.max(1, Math.ceil((Number(action?.estimateMin) || 60) / 60))
    }));

  if (derived.length === 0) {
    derived = canonicalProposed
      .filter(Boolean)
      .map((block, index) => ({
        workItemId: `derived-proposed-${goalId}-${index + 1}`,
        title: String(block?.title || `Planned block ${index + 1}`),
        blocksRemaining: 1
      }));
  }
  if (derived.length === 0) {
    derived = canonicalCommitted
      .filter(Boolean)
      .map((block, index) => ({
        workItemId: `derived-committed-${goalId}-${index + 1}`,
        title: String(block?.title || `Committed block ${index + 1}`),
        blocksRemaining: 1
      }));
  }
  if (derived.length === 0) {
    derived = canonicalDeliverables
      .filter(Boolean)
      .map((deliverable, index) => ({
        workItemId: `derived-deliverable-${goalId}-${index + 1}`,
        title: String(deliverable?.title || `Deliverable ${index + 1}`),
        blocksRemaining: Math.max(1, Math.ceil((Number(deliverable?.estimateMin) || 60) / 60))
      }));
  }
  if (derived.length === 0) return;
  state.goalWorkById[goalId] = derived;
}

function resolveCycleForGoal(state, goalId) {
  if (!goalId) return null;
  const activeCycleId = state?.activeCycleId || null;
  const activeCycle = activeCycleId ? state?.cyclesById?.[activeCycleId] : null;
  if (activeCycle) {
    const activeGoalId =
      activeCycle?.goalContract?.goalId ||
      activeCycle?.goalGovernanceContract?.goalId ||
      activeCycle?.contract?.goalId ||
      null;
    if (activeGoalId === goalId) return activeCycle;
  }
  const cycles = Object.values(state?.cyclesById || {});
  return (
    cycles.find((cycle) => cycle?.goalContract?.goalId === goalId) ||
    cycles.find((cycle) => cycle?.goalGovernanceContract?.goalId === goalId) ||
    cycles.find((cycle) => cycle?.contract?.goalId === goalId) ||
    null
  );
}

function clampUnitScore(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, Number(value)));
}

function deriveCanonicalFeasibilityScore(state, cycle, goalId) {
  const feasibility = goalId ? state?.feasibilityByGoal?.[goalId] || null : null;
  const probability = goalId ? state?.probabilityByGoal?.[goalId] || null : null;
  const canonicalActions = getCanonicalCycleActions(cycle);
  const canonicalDeliverables = getCanonicalCycleDeliverables(state?.deliverablesByCycleId || {}, cycle?.id || null, cycle);
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
  const normalized = String(trajectory || '').trim().toUpperCase();
  if (normalized === 'ON_TRACK') return 'POS_TRAJECTORY_ON_TRACK';
  if (normalized === 'RECOVERABLE_DRIFT') return 'POS_TRAJECTORY_RECOVERABLE_DRIFT';
  if (normalized === 'AT_RISK') return 'POS_TRAJECTORY_AT_RISK';
  return 'POS_TRAJECTORY_INFEASIBLE';
}

function deriveDynamicOutcomeAggregate({
  blocks = [],
  cycleDynamics = null,
  feasibility = null,
  feasibilityScore = null,
  capacityPerDay = 4
}) {
  const normalizedBlocks = Array.isArray(blocks) ? blocks : [];
  let completedBlocks = 0;
  let missedBlocks = 0;
  let expiredBlocks = 0;
  let plannedBlocks = 0;
  let inProgressBlocks = 0;
  normalizedBlocks.forEach((block) => {
    const status = String(block?.status || '').trim().toLowerCase();
    if (status === 'completed' || status === 'complete') completedBlocks += 1;
    else if (status === 'missed') missedBlocks += 1;
    else if (status === 'expired') expiredBlocks += 1;
    else if (status === 'in_progress') inProgressBlocks += 1;
    else if (status === 'planned') plannedBlocks += 1;
  });

  const overdueUnfinished =
    Number(cycleDynamics?.totals?.overdueUnfinished || 0) > 0 ? Number(cycleDynamics.totals.overdueUnfinished) : 0;
  const missedRecoverable = Math.max(0, missedBlocks - expiredBlocks);
  const overdueRecoverableBurden = overdueUnfinished + missedRecoverable;
  const baseRemaining = Number(feasibility?.remainingBlocksTotal || 0);
  const remainingRequiredWork = Math.max(baseRemaining, overdueRecoverableBurden + expiredBlocks);
  const workableDaysRemaining = Number(feasibility?.workableDaysRemaining || 0);
  const requiredPerDay =
    workableDaysRemaining > 0 ? Math.ceil(remainingRequiredWork / workableDaysRemaining) : Number.POSITIVE_INFINITY;
  const requiredWeeklyThroughput = Number.isFinite(requiredPerDay) ? Math.ceil(requiredPerDay * 7) : null;
  const baseRequiredWeeklyThroughput = Number.isFinite(Number(feasibility?.requiredBlocksPerDay))
    ? Math.ceil(Number(feasibility.requiredBlocksPerDay) * 7)
    : null;
  const safeCapacityPerDay = Number.isFinite(capacityPerDay) && capacityPerDay > 0 ? capacityPerDay : 4;
  const capacityWeekly = safeCapacityPerDay * 7;
  const throughputPressure = Number.isFinite(requiredPerDay) ? requiredPerDay / safeCapacityPerDay : Number.POSITIVE_INFINITY;

  let trajectory = 'ON_TRACK';
  if (
    String(feasibility?.status || '').toUpperCase() === 'INFEASIBLE' ||
    (workableDaysRemaining <= 0 && remainingRequiredWork > 0)
  ) {
    trajectory = 'INFEASIBLE_TRAJECTORY';
  } else if (expiredBlocks > 0 || throughputPressure >= 1 || overdueRecoverableBurden >= Math.max(3, Math.ceil(remainingRequiredWork * 0.4))) {
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
  if (expiredBlocks > 0) reasonCodes.push('POS_TERMINAL_DRIFT_EXPIRED');
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
    capacityWeekly,
    throughputPressure: Number.isFinite(throughputPressure) ? Number(throughputPressure.toFixed(3)) : null,
    trajectory,
    reasonCodes,
    feasibilityAdjustment,
    adjustedFeasibilityScore
  };
}

function buildDynamicPosReasons(dynamicOutcome) {
  if (!dynamicOutcome || !Array.isArray(dynamicOutcome.reasonCodes)) return [];
  const directionByCode = {
    POS_TRAJECTORY_ON_TRACK: 'UP',
    POS_TRAJECTORY_RECOVERABLE_DRIFT: 'DOWN',
    POS_TRAJECTORY_AT_RISK: 'DOWN',
    POS_TRAJECTORY_INFEASIBLE: 'DOWN',
    POS_REQUIRED_WEEKLY_THROUGHPUT_UP: 'DOWN',
    POS_TERMINAL_DRIFT_EXPIRED: 'DOWN'
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
          : `trajectory ${String(dynamicOutcome.trajectory || '').toLowerCase()}`
  }));
}

function deriveContractFailureRegistration({
  activeDayKey,
  deadlineDayKey,
  feasibility,
  dynamicOutcome
}) {
  const remainingRequiredWork = Number(dynamicOutcome?.remainingRequiredWork || 0);
  const requiredWeeklyThroughput = Number(dynamicOutcome?.requiredWeeklyThroughput || 0);
  const capacityWeekly = Number(dynamicOutcome?.capacityWeekly || 0);
  const trajectory = String(dynamicOutcome?.trajectory || '').trim().toUpperCase();
  const feasibilityStatus = String(feasibility?.status || '').trim().toUpperCase();
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
        capacityWeekly: Number.isFinite(capacityWeekly) ? capacityWeekly : null
      }
    };
  }

  if (feasibilityStatus === 'INFEASIBLE' || trajectory === 'INFEASIBLE_TRAJECTORY') {
    reasons.push(
      ...(Array.isArray(feasibility?.reasons) ? feasibility.reasons.map((r) => `FEASIBILITY_${String(r || '').toUpperCase()}`) : [])
    );
    if (!reasons.length) reasons.push('INFEASIBLE_UNDER_CURRENT_CONTRACT');
    return {
      state: 'INFEASIBLE_CURRENT_CONTRACT',
      reasons,
      renegotiationRequired: true,
      details: {
        deadlineDayKey: deadlineDayKey || null,
        deadlinePassed,
        remainingRequiredWork,
        requiredWeeklyThroughput: Number.isFinite(requiredWeeklyThroughput) ? requiredWeeklyThroughput : null,
        capacityWeekly: Number.isFinite(capacityWeekly) ? capacityWeekly : null
      }
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
        capacityWeekly
      }
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
        capacityWeekly: Number.isFinite(capacityWeekly) ? capacityWeekly : null
      }
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
      capacityWeekly: Number.isFinite(capacityWeekly) ? capacityWeekly : null
    }
  };
}

function resolveBlockDurationMinutes(block) {
  const direct = Number(block?.durationMinutes);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const startMs = Date.parse(String(block?.start || block?.startISO || ''));
  const endMs = Date.parse(String(block?.end || block?.endISO || ''));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 60;
  return Math.max(1, Math.round((endMs - startMs) / 60000));
}

function resolveMinutesCapPerDay(state, cycle, canonicalContract, blocks, capacityPerDay) {
  const explicitMaxMinutes = Number(state?.constraints?.maxMinutesPerDay);
  if (Number.isFinite(explicitMaxMinutes) && explicitMaxMinutes > 0) return explicitMaxMinutes;
  const strategyMaxMinutes = Number(cycle?.strategy?.constraints?.maxMinutesPerDay);
  if (Number.isFinite(strategyMaxMinutes) && strategyMaxMinutes > 0) return strategyMaxMinutes;
  const draftMinutes = Number(state?.planDraft?.minutesPerDay);
  if (Number.isFinite(draftMinutes) && draftMinutes > 0) return draftMinutes;

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

function buildRecoveryOption({
  type,
  summary,
  delta = null,
  unit = null,
  reasonCode
}) {
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
  contractFailure
}) {
  const missedExpiredBurden =
    Math.max(0, Number(dynamicOutcome?.missedBlocks || 0)) + Math.max(0, Number(dynamicOutcome?.expiredBlocks || 0));
  const plannedCommitted =
    Math.max(0, Number(dynamicOutcome?.plannedBlocks || 0)) + Math.max(0, Number(dynamicOutcome?.inProgressBlocks || 0));
  const remainingRequiredBurden = Math.max(0, Number(dynamicOutcome?.remainingRequiredWork || feasibility?.remainingBlocksTotal || 0));
  const unscheduledRequiredBurden = Math.max(0, remainingRequiredBurden - plannedCommitted);
  const workableDaysRemaining = Math.max(0, Number(dynamicOutcome?.workableDaysRemaining ?? feasibility?.workableDaysRemaining ?? 0));
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
    if (!durations.length) return 60;
    return Math.round(durations.reduce((sum, minutes) => sum + minutes, 0) / durations.length);
  })();
  const minutesCapPerDay = resolveMinutesCapPerDay(state, cycle, canonicalContract, blocks, capacityPerDay);
  const requiredMinutesPerDayAfterRecovery = Number.isFinite(requiredBlocksPerDayAfterRecovery)
    ? requiredBlocksPerDayAfterRecovery * averageBlockMinutes
    : Number.POSITIVE_INFINITY;

  const overloadReasonCodes = [];
  if (overCapacityAmount > 0) overloadReasonCodes.push('RECOVERY_OVER_MAX_BLOCKS_PER_DAY');
  if (requiredMinutesPerDayAfterRecovery > minutesCapPerDay) overloadReasonCodes.push('RECOVERY_OVER_MINUTES_PER_DAY');
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
    if (availableRecoverySlack <= 0) recoveryReasons.push('RECOVERY_CONSUMES_ALL_SLACK');
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
          reasonCode: 'RECOVERY_DEADLINE_EXTENSION_REQUIRED'
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
          reasonCode: 'RECOVERY_OVER_MAX_BLOCKS_PER_DAY'
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
          reasonCode: 'RECOVERY_SCOPE_REDUCTION_REQUIRED'
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
      overCapacityAmount
    },
    renegotiationRequired,
    renegotiationOptions
  };
}

function applyCycleScoring(state) {
  const cycleId = state?.activeCycleId || null;
  if (!cycleId) return;
  const cycle = state?.cyclesById?.[cycleId];
  if (!cycle) return;
  const canonicalContract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
  const goalId = canonicalContract?.goalId || null;

  const activeDayKey = state?.appTime?.activeDayKey || state?.today?.date || nowDayKey();
  const nowISO = state?.appTime?.nowISO || `${activeDayKey}T12:00:00.000Z`;
  const scopedEvents = getCanonicalExecutionEventsForCycleGoal(state, cycleId, goalId);
  const materialized = materializeBlocksFromEvents(scopedEvents, { todayISO: state.today?.date });
  const blocks = Array.from(materialized?.blocksById?.values?.() || []).filter(Boolean);

  const integrity = computeCycleIntegrityScore({
    cycleId,
    nowISO,
    blocks,
  });

  const canonicalFeasibility = deriveCanonicalFeasibilityScore(state, cycle, goalId);
  const feasibilityScore = Number.isFinite(canonicalFeasibility.feasibilityScore)
    ? Number(canonicalFeasibility.feasibilityScore)
    : null;
  const generationSource = String(cycle?.planGenerationSource || '').trim().toUpperCase();
  const planStatus = String(cycle?.planStatus || '').trim().toLowerCase();
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
  const dynamicOutcome = deriveDynamicOutcomeAggregate({
    blocks,
    cycleDynamics: state?.cycleDynamicsByCycleId?.[cycleId] || cycle?.cycleDynamics || null,
    feasibility,
    feasibilityScore,
    capacityPerDay
  });
  const contractFailure = deriveContractFailureRegistration({
    activeDayKey,
    deadlineDayKey: canonicalContract?.endDayKey || null,
    feasibility,
    dynamicOutcome
  });
  const recovery = deriveRecoveryAnalysis({
    state,
    cycle,
    canonicalContract,
    dynamicOutcome,
    feasibility,
    blocks,
    capacityPerDay,
    contractFailure
  });

  const metrics = {
    ...(cycle.metrics || {}),
    integrityScore: integrity.integrityScore,
    integrityMinutesTotal: integrity.minutesTotal,
    integrityMinutesCounted: integrity.minutesCounted,
    feasibilityScore,
    posScore: null,
    posUnavailableReasonCode: canonicalFeasibility.reasonCode || null,
    dynamicOutcome,
    requiredWeeklyThroughput: dynamicOutcome.requiredWeeklyThroughput,
    workableDaysRemaining: dynamicOutcome.workableDaysRemaining,
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
      dynamicOutcome
    }
  };

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
      reasonCodes
    };
  }

  const probabilityValue = Number(probability?.value);
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
      seededFromInitialForecast: true
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
      const normalized = String(code || '').trim().toUpperCase();
      if (normalized) conflictCodes.add(normalized);
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
    reasons: [...(explanation?.reasons || []), ...dynamicReasons].slice(0, 3)
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
        trajectory: dynamicOutcome.trajectory
      },
      contractFailure: {
        state: contractFailure.state,
        renegotiationRequired: contractFailure.renegotiationRequired
      },
      recovery: {
        state: recovery.recoveryState,
        renegotiationRequired: recovery.renegotiationRequired
      }
    };
  }

  cycle.metrics = metrics;
  cycle.contractFailure = {
    state: contractFailure.state,
    reasons: contractFailure.reasons,
    renegotiationRequired: contractFailure.renegotiationRequired,
    details: contractFailure.details,
    updatedAtISO: nowISO
  };
  cycle.recoveryContract = {
    state: recovery.recoveryState,
    reasons: recovery.recoveryReasons,
    metrics: recovery.recoveryMetrics,
    renegotiationRequired: recovery.renegotiationRequired,
    options: recovery.renegotiationOptions,
    updatedAtISO: nowISO
  };
  state.cyclesById[cycleId] = cycle;
}

function applyCycleDynamics(state) {
  const cycleId = state?.activeCycleId || null;
  if (!cycleId) return;
  const cycle = state?.cyclesById?.[cycleId];
  if (!cycle) return;
  const canonicalContract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
  const goalId = canonicalContract?.goalId || null;
  const nowISO =
    state?.appTime?.nowISO ||
    `${state?.appTime?.activeDayKey || state?.today?.date || nowDayKey()}T12:00:00.000Z`;
  const scopedEvents = getCanonicalExecutionEventsForCycleGoal(state, cycleId, goalId);
  const materialized = materializeBlocksFromEvents(scopedEvents, { todayISO: state.today?.date });
  const scopedBlocks = Array.from(materialized?.blocksById?.values?.() || []).filter(Boolean);
  const profile = deriveCycleDynamicsProfile({
    cycleId,
    goalId,
    blocks: scopedBlocks,
    nowISO
  });
  state.cycleDynamicsByCycleId = state.cycleDynamicsByCycleId || {};
  state.cycleDynamicsByCycleId[cycleId] = profile;
  cycle.cycleDynamics = profile;
  enforceCycleDynamicsTransitions(state, {
    cycleId,
    goalId,
    nowISO,
    blocks: scopedBlocks,
    profile
  });
  state.cyclesById[cycleId] = cycle;
}

function getCanonicalExecutionEventsForCycleGoal(state, cycleId, goalId) {
  const events = Array.isArray(state?.executionEvents) ? state.executionEvents : [];
  return events.filter((event) => {
    if (!event) return false;
    const eventCycleId = event?.cycleId || cycleId;
    if (eventCycleId !== cycleId) return false;
    if (!goalId) return true;
    if (event?.goalId && event.goalId !== goalId) return false;
    return true;
  });
}

function enforceCycleDynamicsTransitions(state, { cycleId, goalId, nowISO, blocks, profile }) {
  const patch = buildCycleDynamicsTransitionPatch({
    cycleId,
    goalId,
    blocks,
    recommendedTransitions: profile?.recommendedTransitions || []
  });
  if (!patch.length) return;

  const blockById = new Map((Array.isArray(blocks) ? blocks : []).map((block) => [block?.id, block]));
  let didAppend = false;
  patch.forEach((transition) => {
    const block = blockById.get(transition.blockId);
    if (!block) return;
    const toStatus = transition.toStatus;
    const fromStatus = String(block?.status || '').trim().toLowerCase();
    if (!toStatus || fromStatus === toStatus) return;
    if (block?.cycleId && block.cycleId !== cycleId) return;
    if (goalId && block?.goalId && block.goalId && block.goalId !== goalId) return;

    const event = {
      id: nextDeterministicId(state, `evt-dynamics-${transition.blockId}`),
      blockId: transition.blockId,
      minutes: Number.isFinite(Number(block?.durationMinutes)) ? Number(block.durationMinutes) : 0,
      rawLabel: String(block?.label || 'Block'),
      domain: block?.domain || block?.practice || 'Focus',
      cycleId: cycleId,
      goalId: goalId || block?.goalId || null,
      origin: block?.origin || 'manual',
      completed: false,
      kind: 'update',
      status: toStatus,
      missedAtISO: toStatus === 'missed' ? nowISO : block?.missedAtISO || null,
      reason: transition.reasonCode,
      linkageStatus: block?.deliverableId || block?.criterionId ? 'LINKED' : 'UNLINKED_ACTIVITY'
    };
    if (!canEmitExecutionEvent(state.executionEvents || [], event)) return;
    appendExecutionEvent(state, event);
    didAppend = true;
  });

  if (!didAppend) return;
  const rematerialized = materializeBlocksFromEvents(state.executionEvents || [], { todayISO: state.today?.date });
  state.today.blocks = rematerialized.todayBlocks || [];
  state.cycle = rematerialized.days || [];
}

function applyProgressCredit(state) {
  const { days } = materializeBlocksFromEvents(state.executionEvents || [], { todayISO: state.today?.date });
  const allBlocks = (days || []).flatMap((d) => d.blocks || []);
  const progressByGoal = {};
  allBlocks.forEach((block) => {
    if (!block?.goalId) return;
    if (block.status !== 'completed' && block.status !== 'complete') return;
    const goalId = block.goalId;
    const admission = state.goalAdmissionByGoal?.[goalId];
    const isAdmittedGoal = !admission || admission.status === 'ADMITTED';
    const duration = Number(block.durationMinutes) || estimateBlockMinutes(block);
    if (!progressByGoal[goalId]) {
      progressByGoal[goalId] = {
        creditedUnits: 0,
        activityUnits: 0,
        completedUnitsTotal: 0
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
  if (!block?.start || !block?.end) return 0;
  const start = new Date(block.start).getTime();
  const end = new Date(block.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 60000));
}

function resolveGoalDeadline(goalId, state) {
  if (!state?.activeCycleId || !state?.cyclesById?.[state.activeCycleId]) return null;
  const active = state.cyclesById[state.activeCycleId];
  const canonicalContract = getCanonicalCycleContract(active, state.goalExecutionContract, active?.contract || null);
  const canonicalGoalId = canonicalContract?.goalId || active?.goalGovernanceContract?.goalId || null;
  if (!canonicalGoalId || canonicalGoalId !== goalId) return null;
  return canonicalContract?.endDayKey || active?.goalContract?.endDayKey || active?.definiteGoal?.deadlineDayKey || null;
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
    denials: []
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
      eligibilityByGoal[ctx.goalId] = { allowed: false, reasons: ['no_directive'], contractId: resolution.contract.contractId };
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
      directiveDomain: directive.domain
    });
    eligibilityByGoal[ctx.goalId] = {
      allowed: gate.allowed,
      reasons: gate.reasons,
      contractId: resolution.contract.contractId
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
    if (aStart !== bStart) return aStart.localeCompare(bStart);
    return a.goalId.localeCompare(b.goalId);
  });
  state.goalDirective = candidates[0].directive;
}

function buildGoalContexts(state) {
  const contexts = [];
  const active = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] : null;
  if (!active) return contexts;
  const goalId = active?.goalGovernanceContract?.goalId;
  if (!goalId) return contexts;
  const goalText = active?.definiteGoal?.outcome || '';
  const deadlineISO = active?.definiteGoal?.deadlineDayKey || '';
  contexts.push({
    goalId,
    goalText,
    deadlineISO,
    blocks: state.today?.blocks || []
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
      reason: 'You already started this block; finish it before switching.'
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
          : 'This is the next scheduled block for today.'
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
    reason: 'No more scheduled work. This repair block pushes your lowest practice back toward pattern.'
  };
}

function updateBlockStatus(state, id, status) {
  const updateBlocks = (blocks = []) => blocks.map((b) => (b.id === id ? { ...b, status } : b));
  state.today.blocks = updateBlocks(state.today.blocks);
  state.currentWeek.days = state.currentWeek.days.map((d) => ({ ...d, blocks: updateBlocks(d.blocks) }));
  state.cycle = state.cycle.map((d) => ({ ...d, blocks: updateBlocks(d.blocks) }));
}

function rescheduleBlock(state, id, start, end) {
  const existing = findBlockById(state, id);
  if (!existing) return;
  const event = buildExecutionEventFromBlock(existing, {
    kind: 'reschedule',
    completed: false,
    startISO: start,
    endISO: end
  });
  if (!canEmitExecutionEvent(state.executionEvents || [], event)) return;
  const updateBlocks = (blocks = []) =>
    blocks.map((b) => (b.id === id ? { ...b, start, end } : b));
  state.today.blocks = updateBlocks(state.today.blocks);
  state.currentWeek.days = state.currentWeek.days.map((d) => ({ ...d, blocks: updateBlocks(d.blocks) }));
  state.cycle = state.cycle.map((d) => ({ ...d, blocks: updateBlocks(d.blocks) }));
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
    summaryLine: buildDaySummary(day, state.vector, state.lenses)
  }));
  return state;
}

function buildWeekFromCycle(cycle, date) {
  const days = cycle.slice(0, 7).map((day, idx) => ({
    ...day,
    label: day.label || day.date || `Day ${idx + 1}`
  }));
  return { weekStart: date || days[0]?.date, days };
}

function buildMonthCycle(state, dateString) {
  const base = dateString ? new Date(dateString) : new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const existingMap = new Map(
    (Array.isArray(state.cycle) ? state.cycle : []).map((d) => [d.date, d])
  );
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
        practices: []
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
  const integrityStatus =
    completionRate >= 0.7 ? 'acceptable' : completionRate >= 0.4 ? 'degrading' : 'low';

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
    streakState
  };
}

function recalculateIdentityVector(state) {
  const recent = state.cycle.slice(-7);
  const avgCompletion =
    recent.reduce((sum, d) => sum + (d.completionRate || 0), 0) / Math.max(1, recent.length);
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
    avgCompletion < 0.6
      ? 'off-track'
      : ratioValues.some((r) => r > 1.5 || r < 0.5)
      ? 'elevated'
      : 'contained';
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
        momentum: 'quiet'
      };
    }
  }
  if (state.meta) state.meta.lastActiveDate = todayDate;

  return {
    ...state.vector,
    stability,
    drift: driftLabel,
    driftDetail: { byPractice: ratios },
    driftLabel,
    driftHint: buildDriftHint({ byPractice: ratios }),
    momentum
  };
}

function durationMinutes(start, end) {
  if (!start || !end) return 0;
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
        objectiveId: templateKey
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
  if (!entries.length) return '';
  const nearBalanced = entries.every(([, r]) => r > 0.9 && r < 1.1);
  if (nearBalanced) return '';
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
  const seen = new Set();
  const union = [];
  const divergeWarned = new Set();
  const add = (blocks = [], source = 'unknown') => {
    blocks.forEach((b) => {
      if (!b || !b.id) return;
      const existing = union.find((u) => u.id === b.id);
      if (existing) {
        if (process.env.NODE_ENV !== 'production' && existing.status !== b.status && !divergeWarned.has(b.id)) {
          console.warn('Block status divergence detected', b.id, { incoming: b.status, existing: existing.status, source });
          divergeWarned.add(b.id);
        }
        return;
      }
      seen.add(b.id);
      union.push(b);
    });
  };
  add(state.today?.blocks, 'today');
  (state.currentWeek?.days || []).forEach((d) => add(d.blocks, 'week'));
  (state.cycle || []).forEach((d) => add(d.blocks, 'cycle'));
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
      practices: []
    });
  }
  const targetMap = {};
  const byDate = new Map(days.map((d) => [d.date, d]));
  (blocks || []).forEach((block) => {
    const key = dayKeyUTC(block.start);
    const day = key && byDate.get(key);
    if (!day) return;
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
  if (!start || !end) return 0;
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
    if (b.status === 'completed') completed += mins;
  }
  planned = Number.isFinite(planned) ? planned : 0;
  completed = Number.isFinite(completed) ? completed : 0;
  const cr = planned > 0 ? completed / planned : 0;
  return {
    plannedMinutes: planned,
    completedMinutes: completed,
    completionRate: Number.isFinite(cr) ? Math.max(0, Math.min(1, cr)) : 0
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
    const key = (b?.start || '').slice(0, 10);
    if (!key) continue;
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
      inMonth: date.slice(0, 7) === monthYYYYMM
    });
  }
  return days;
}

function clamp01(x) {
  return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
}

function bandFromScore(score) {
  if (score >= 0.7) return 'Strong';
  if (score >= 0.4) return 'Moderate';
  return 'Weak';
}

function safeCR(planned, completed) {
  if (!Number.isFinite(planned) || planned <= 0) return 0;
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
  for (const p of practices) s += Math.abs((a[p] || 0) - (b[p] || 0));
  return s;
}

function computeStreakDays(days, threshold = 0.7) {
  const inMonthDays = (days || []).filter((d) => d.inMonth !== false);
  if (!inMonthDays.length) return 0;
  const sorted = [...inMonthDays].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const cr = clamp01(sorted[i].completionRate);
    if (cr >= threshold) streak += 1;
    else break;
  }
  return streak;
}

function computeMomentumScore(days) {
  const inMonthDays = (days || []).filter((d) => d.inMonth !== false);
  const sorted = [...inMonthDays].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 6) return 0;
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
  integrityLowThreshold = 0.4
}) {
  const days = monthDays || [];
  const inMonthDays = days.filter((d) => d.inMonth !== false);

  const plannedTotal = inMonthDays.reduce((s, d) => s + (Number.isFinite(d.plannedMinutes) ? d.plannedMinutes : 0), 0);
  const completedTotal = inMonthDays.reduce((s, d) => s + (Number.isFinite(d.completedMinutes) ? d.completedMinutes : 0), 0);
  const completionRate = safeCR(plannedTotal, completedTotal);

  let integrityStatus = 'acceptable';
  if (completionRate < integrityLowThreshold) integrityStatus = 'low';
  else if (completionRate < 0.7) integrityStatus = 'degrading';

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
    momentum: bandFromScore(momentumScore)
  };

  let overallBand = 'Strong';
  if (integrityStatus === 'low') overallBand = 'Weak';
  else {
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
      if (gap > 0) deficits.push({ practice: p, gapMinutes: Math.round(gap) });
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
    recs.push({ key: 'shift-next', text: `Shift the next planned block toward ${deficits[0].practice} to correct drift.` });
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
    recommendations: recs.slice(0, 3)
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
  if (!lows.length) return 'Rebalance by adding one underweight practice block before 18:00.';
  if (lows.length === 1) return `Rebalance by adding one ${lows[0]} block before 18:00.`;
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
  if (!completedBlocks.length) return;
  if (!state.templates) state.templates = { objectives: {} };
  if (!state.templates.objectives) state.templates.objectives = {};
  const grouped = {};
  completedBlocks.forEach((block) => {
    const objectiveId = block.linkedAimId || day.objectiveId || 'default';
    if (!grouped[objectiveId]) grouped[objectiveId] = { minutesByPractice: {}, slots: [] };
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
      preferredSlot: preferredSlot || existing?.preferredSlot || 'morning'
    };
  });
}

function adaptPatternTargets(state) {
  if (!state.cycle || !state.cycle.length || !state.lenses?.pattern) return false;
  const history = state.cycle.slice(-14);
  if (history.length < 3) return false;
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
    Focus: [15, 180]
  };
  let changed = false;
  const updatedTargets = targets.map((t) => {
    const actualAvg = (totals[t.name] || 0) / daysCount;
    const targetMinutes = t.minutes || state.lenses?.pattern?.defaultMinutes || 0;
    if ((totals[t.name] || 0) < 60) return t;
    if (!targetMinutes) return t;
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
  if (state.lastAdaptedDate === todayDate) return false;
  if (changed) {
    state.lenses.pattern = { ...state.lenses.pattern, dailyTargets: updatedTargets };
    state.lastAdaptedDate = todayDate;
  }
  return changed;
}

function inferSlot(start) {
  const date = new Date(start || '00:00');
  const hour = date.getHours();
  if (hour >= 18) return 'evening';
  if (hour >= 12) return 'afternoon';
  return 'morning';
}

function rebalanceTodayPlan(state, mode) {
  if (!state.today || !state.today.blocks) return;
  const beforePlanned =
    (state.today.plannedMinutes ?? state.today.blocks.reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0)) || 0;
  const beforeCompleted =
    (state.today.completedMinutes ??
      state.today.blocks
        .filter((b) => b.status === 'completed' || b.status === 'complete')
        .reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0)) || 0;
  const beforeCR = beforePlanned ? beforeCompleted / beforePlanned : 0;
  const beforeIntegrity = beforeCR >= 0.7 ? 'acceptable' : beforeCR >= 0.4 ? 'degrading' : 'low';

  let objectiveId = state.today.primaryObjectiveId || state.today.objectiveId || state.today.blocks[0]?.linkedAimId;
  if (!objectiveId) {
    const planned = (state.today.blocks || []).map((b) => ({
      id: b.objectiveId || b.linkedAimId || b.id,
      minutes: durationMinutes(b.start, b.end)
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
  state.cycle = state.cycle.map((d) =>
    d.date === state.today.date ? { ...d, blocks: updatedBlocks } : d
  );

  // session recap
  const afterPlanned =
    state.today.blocks.reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0) || 0;
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
      integrity: beforeIntegrity
    }),
    afterSummary: JSON.stringify({
      planned: afterPlanned,
      completed: afterCompleted,
      cr: afterCR,
      integrity: afterIntegrity
    })
  };
}

function shiftEnd(start, durationMinutesValue) {
  if (!start) return start;
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
    Focus: 45
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
  if (typeof horizon === 'number' && Number.isFinite(horizon)) return Math.max(1, Math.round(horizon));
  if (typeof horizon !== 'string') return 90;
  const trimmed = horizon.trim().toLowerCase();
  if (trimmed === 'year') return 365;
  if (trimmed.endsWith('d')) {
    const parsed = parseInt(trimmed.slice(0, -1), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
  }
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
}

function parseMinimumDays(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 3 || parsed > 7) return null;
  return parsed;
}

function choosePrimaryDomain(domains = []) {
  const set = new Set(domains);
  for (const name of DOMAIN_ORDER) {
    if (set.has(name)) return name;
  }
  return domains[0] || 'Creation';
}

function classifyGoalArchetype(goalText = '', domains = []) {
  const text = goalText.toLowerCase();
  if (/(recover|restore|reset|heal|stabilize)/.test(text)) return 'recover';
  if (/(acquire|revenue|pipeline|sell|sales|money|income)/.test(text)) return 'acquire';
  if (/(perform|execute|focus|precision|practice)/.test(text)) return 'perform';
  if (/(ship|build|launch|create|release|publish)/.test(text)) return 'build';
  if (domains.includes('Creation')) return 'build';
  if (domains.includes('Resources')) return 'acquire';
  if (domains.includes('Body')) return 'recover';
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
    if (domains.includes(preferred)) return preferred;
    return domains.includes(fallback) ? fallback : primaryDomain;
  };
  const focusDomain = pick('Focus', 'Creation');
  const resourcesDomain = pick('Resources', 'Focus');
  const bodyDomain = pick('Body', 'Focus');
  const creationDomain = pick('Creation', 'Focus');
  const base = {
    build: [
      { title: 'Foundation reps', domain: creationDomain, durationMinutes: 30, frequency: 'daily', reason: 'build muscle memory' },
      { title: 'Production sprint', domain: creationDomain, durationMinutes: 90, frequency: '3x/week', reason: 'ship tangible output' },
      { title: 'Scope review', domain: focusDomain, durationMinutes: 20, frequency: 'weekly', reason: 'tighten scope' }
    ],
    recover: [
      { title: 'Recovery base', domain: bodyDomain, durationMinutes: 30, frequency: 'daily', reason: 'restore capacity' },
      { title: 'Stability block', domain: resourcesDomain, durationMinutes: 45, frequency: '3x/week', reason: 'stabilize inputs' },
      { title: 'Reflection review', domain: focusDomain, durationMinutes: 15, frequency: 'weekly', reason: 'track recovery signals' }
    ],
    acquire: [
      { title: 'Pipeline touch', domain: resourcesDomain, durationMinutes: 30, frequency: 'daily', reason: 'keep acquisition warm' },
      { title: 'Acquisition sprint', domain: resourcesDomain, durationMinutes: 60, frequency: '3x/week', reason: 'convert opportunities' },
      { title: 'Revenue review', domain: focusDomain, durationMinutes: 20, frequency: 'weekly', reason: 'tighten acquisition loop' }
    ],
    perform: [
      { title: 'Focus primer', domain: focusDomain, durationMinutes: 20, frequency: 'daily', reason: 'prime execution' },
      { title: 'Execution block', domain: primaryDomain, durationMinutes: 60, frequency: '3x/week', reason: 'sustain performance' },
      { title: 'Performance review', domain: focusDomain, durationMinutes: 15, frequency: 'weekly', reason: 'adjust execution' }
    ]
  };
  return base[archetype] || base.build;
}

function averageTemplateMinutes(templates = []) {
  if (!templates.length) return 45;
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
  timeZone
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
    timeZone
  });
}

function getSortedEndedHistorySignals(state, windowCycles = 5) {
  const allSignals = Object.values(state.historySignalsByCycleId || {}).filter((entry) => entry && entry.endDayKey);
  const sorted = allSignals.sort((a, b) => {
    if (a.endDayKey !== b.endDayKey) return a.endDayKey.localeCompare(b.endDayKey);
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
  if (!planDraft || planDraft.enableHistoryPolicySelection !== true) return null;
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
  timeZone = 'UTC'
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
    if (event?.type !== 'suggestion_rejected') return;
    const suggestionId = event.suggestionId || event.proposalId;
    if (!suggestionId) return;
    const target = next.find((s) => s.id === suggestionId);
    if (!target) return;
    if (target.status === 'rejected' && target.rejectedReason) return;
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
    if (!event?.type) return;
    const suggestionId = event.suggestionId || event.proposalId;
    if (!suggestionId) return;
    const target = next.find((s) => s.id === suggestionId);
    if (!target) return;
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
  if (!suggestions.length || !events.length) return false;
  const next = rehydrateSuggestionOverrides(suggestions, events);
  const changed = next.some((entry, idx) => entry.status !== suggestions[idx]?.status || entry.rejectedReason !== suggestions[idx]?.rejectedReason);
  if (changed) setCycleProposedBlocks(state, state.activeCycleId || null, next);
  return changed;
}

const REJECTION_REASONS = [
  'TOO_LONG',
  'WRONG_TIME',
  'LOW_ENERGY',
  'NOT_RELEVANT',
  'MISSING_PREREQ',
  'OVERCOMMITTED'
];

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
    if (!dayKey) return false;
    return dayKey >= startKey && dayKey <= todayKey;
  });
  inWindow.forEach((event) => {
    const reason = event.reason;
    if (!reason || !(reason in byReason)) return;
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
      prereqDebt: ratio(byReason.MISSING_PREREQ)
    }
  };
}

function hasValidatedCycleActionGraph(cycle) {
  if (!cycle) return false;
  const actionSource = getCanonicalCycleActions(cycle);
  if (!actionSource.length) return false;
  return actionSource.every((action) => {
    if (!action || !action.id) return false;
    const title = String(action.title || action.label || '').trim();
    return title.length > 0;
  });
}

function ensureCycleDeliverablesWorkspace(state, cycleId) {
  if (!cycleId) return 0;
  state.deliverablesByCycleId = state.deliverablesByCycleId || {};
  const cycle = state.cyclesById?.[cycleId];
  if (!cycle) return 0;
  const strategyDeliverables = Array.isArray(cycle.strategy?.deliverables) ? cycle.strategy.deliverables : [];
  const existingWorkspace = state.deliverablesByCycleId[cycleId] || {
    cycleId,
    deliverables: [],
    suggestionLinks: {},
    lastUpdatedAtISO: state.appTime?.nowISO || new Date().toISOString()
  };
  if ((!existingWorkspace.deliverables || existingWorkspace.deliverables.length === 0) && strategyDeliverables.length > 0) {
    existingWorkspace.deliverables = strategyDeliverables.map((deliverable) => ({ ...deliverable }));
    existingWorkspace.lastUpdatedAtISO = state.appTime?.nowISO || new Date().toISOString();
  }
  state.deliverablesByCycleId[cycleId] = existingWorkspace;
  return Array.isArray(existingWorkspace.deliverables) ? existingWorkspace.deliverables.length : 0;
}

function enforceOnboardingExecutionGraphGate(state, cycleId, actionType = 'ONBOARDING') {
  if (!cycleId) return;
  const cycle = state.cyclesById?.[cycleId];
  if (!cycle) return;
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
    actionType
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
    deliverables
  });

  state.vector.direction = goalText || state.vector.direction;
  state.lenses.aim = {
    description: goalText || state.lenses.aim.description,
    horizon: onboarding.horizon || state.lenses.aim.horizon || '90d',
    narrative: narrative || state.lenses.aim.narrative
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
      flow: ended.flow
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
        validationMethod: 'user_attest'
      }
    ],
    requirements: {
      requiredDomains: focusAreas,
      minimumCadencePerDomain: {
        Body: focusAreas.includes('Body') ? 1 : 0,
        Focus: focusAreas.includes('Focus') ? 1 : 0,
        Creation: focusAreas.includes('Creation') ? 1 : 0,
        Resources: focusAreas.includes('Resources') ? 1 : 0
      },
      expectedDomainMix: computeDomainMix(focusAreas),
      maxAllowedVariance: 0.2
    }
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
      timezone: timeZone || 'UTC'
    },
    governance: {
      suggestionsEnabled: true,
      probabilityEnabled: true,
      minEvidenceEvents: 1,
      cooldowns: { resuggestMinutes: 30, maxSuggestionsPerDay: 6 }
    },
    constraints: {
      forbiddenDirectives: ['repair'],
      maxActiveBlocks: 6
    }
  };

  const newCycleId = `cycle-${startDayKey}-${Object.keys(state.cyclesById).length + 1}`;
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
    suggestionEvents: [],
    suggestedBlocks: [],
    truthEntries: [],
    suggestionHistory: {
      dayKey: startDayKey,
      count: 0,
      lastSuggestedAtISO: null,
      lastSuggestedAtISOByGoal: {},
      dailyCountByGoal: {},
      denials: []
    }
  };
  ensureAdmissionStores(state);
  state.aspirationsByCycleId[newCycleId] = state.aspirationsByCycleId[newCycleId] || [];
  state.deliverablesByCycleId = state.deliverablesByCycleId || {};
  state.deliverablesByCycleId[newCycleId] = {
    cycleId: newCycleId,
    deliverables: [],
    suggestionLinks: {},
    lastUpdatedAtISO: state.appTime?.nowISO || new Date().toISOString()
  };
  state.deliverablesByCycleId = state.deliverablesByCycleId || {};
  state.deliverablesByCycleId[newCycleId] = {
    cycleId: newCycleId,
    deliverables: [],
    suggestionLinks: {},
    lastUpdatedAtISO: state.appTime?.nowISO || new Date().toISOString()
  };
  state.activeCycleId = newCycleId;
  state.activeGoalId = goalId;
  clearCycleTransientState(state);

  if (!state.goalWorkById) state.goalWorkById = {};
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
      dependencies: []
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
    successDefinition
  };
  state.executionEvents = [];
  state.suggestionEvents = [];
  state.truthEntries = [];
  state.executionEvents = [];
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
    missingInfo: parseMinimumDays(onboarding.minimumDaysPerWeek) ? [] : ['daysPerWeek']
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
    denials: []
  };

  state.cyclesById[newCycleId].planDraft = state.planDraft;
  state.cyclesById[newCycleId].calibration = state.planCalibration;
  state.cyclesById[newCycleId].planPreview = state.planPreview;
  state.cyclesById[newCycleId].proposedBlocks = state.proposedBlocks;
  state.cyclesById[newCycleId].suggestedBlocks = state.suggestedBlocks;
  state.cyclesById[newCycleId].suggestionEvents = state.suggestionEvents;
  state.cyclesById[newCycleId].executionEvents = state.executionEvents;
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
  const horizonDays = Math.max(1, daysBetween(startDayKey, deadlineDayKey) || state.goalExecutionContract?.horizonDays || 90);
  const daysPerWeek = parseMinimumDays(payload.minimumDaysPerWeek) || state.planCalibration?.daysPerWeek || state.planDraft?.daysPerWeek || 4;
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
    deliverables
  });

  archivePreviousCycle(state, current?.id || null);

  const goalContract = {
    goalId,
    executionType: goalDraftV2?.executionType || payload.executionType || state.goalExecutionContract?.executionType || null,
    goalLabel: goalText || null,
    goalText: goalText || null,
    status: 'active',
    activationDateISO: startDayKey,
    deadlineISO: deadlineDayKey,
    success: [
      {
        metricType: 'binary',
        metricName: successDefinition || 'success',
        targetValue: true,
        validationMethod: 'user_attest'
      }
    ],
    requirements: {
      requiredDomains: focusAreas,
      minimumCadencePerDomain: {
        Body: focusAreas.includes('Body') ? 1 : 0,
        Focus: focusAreas.includes('Focus') ? 1 : 0,
        Creation: focusAreas.includes('Creation') ? 1 : 0,
        Resources: focusAreas.includes('Resources') ? 1 : 0
      },
      expectedDomainMix: computeDomainMix(focusAreas),
      maxAllowedVariance: 0.2
    }
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
      timezone: timeZone || 'UTC'
    },
    governance: {
      suggestionsEnabled: true,
      probabilityEnabled: true,
      minEvidenceEvents: 1,
      cooldowns: { resuggestMinutes: 30, maxSuggestionsPerDay: 6 }
    },
    constraints: {
      forbiddenDirectives: ['repair'],
      maxActiveBlocks: 6
    }
  };

  const newCycleId = `cycle-${startDayKey}-${Object.keys(state.cyclesById).length + 1}`;
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
    suggestionEvents: [],
    suggestedBlocks: [],
    truthEntries: [],
    suggestionHistory: {
      dayKey: startDayKey,
      count: 0,
      lastSuggestedAtISO: null,
      lastSuggestedAtISOByGoal: {},
      dailyCountByGoal: {},
      denials: []
    }
  };

  state.activeCycleId = newCycleId;
  state.activeGoalId = goalId;
  state.viewDate = startDayKey;
  if (state.appTime?.isFollowingNow) {
    state.appTime.activeDayKey = startDayKey;
  }
  clearCycleTransientState(state);

  if (!state.goalWorkById) state.goalWorkById = {};
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
      dependencies: []
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
    successDefinition
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
    missingInfo: ['daysPerWeek']
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
  state.truthEntries = [];
  state.suggestionHistory = {
    dayKey: startDayKey,
    count: 0,
    lastSuggestedAtISO: null,
    lastSuggestedAtISOByGoal: {},
    dailyCountByGoal: {},
    denials: []
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
  state.cyclesById[newCycleId].contract = state.goalExecutionContract;
  state.cyclesById[newCycleId].suggestionHistory = state.suggestionHistory;

  generateColdPlanForCycle(state, { rebaseMode: 'NONE' });
  assertActiveCycleInvariant(state);
}

function addTruthEntry(state, payload = {}) {
  const entry = payload && typeof payload === 'object' ? payload : null;
  if (!entry || !entry.id) return;
  state.truthEntries = state.truthEntries || [];
  state.truthEntries = [entry, ...state.truthEntries];
}

function setActiveCycle(state, cycleId) {
  ensureCycleStructures(state);
  if (!cycleId || !state.cyclesById?.[cycleId]) return;
  const cycle = state.cyclesById[cycleId];
  if (cycle.status === 'deleted') return;
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
  if (!cycle?.id) return null;
  const cycleEvents = (cycle.executionEvents || []).filter((event) => (event?.cycleId || cycle.id) === cycle.id);
  const materialized = materializeBlocksFromEvents(cycleEvents, { todayISO: cycle.endedAtDayKey || state.today?.date });
  const materializedBlocks = (materialized.days || []).flatMap((day) => day.blocks || []);
  return deriveCycleHistorySignals(cycle, materializedBlocks, cycleEvents, {
    depTightCount: cycle?.planPreview?.policySelectionSignalsSnapshot?.depTightCount,
    milestoneAtRiskCount: cycle?.planPreview?.policySelectionSignalsSnapshot?.milestoneAtRiskCount,
    placementAnchoringMissCount: cycle?.planPreview?.pacingAnchoringMissCount,
    outsideExecutionHorizonMinutes: cycle?.planPreview?.policySelectionSignalsSnapshot?.outsideExecutionHorizonEstimateMinTotal,
    unplacedEstimateMinTotal: cycle?.planPreview?.policySelectionSignalsSnapshot?.unplacedEstimateMinTotal,
  });
}

function deleteCycle(state, cycleId) {
  ensureCycleStructures(state);
  if (!cycleId || !state.cyclesById?.[cycleId]) return;
  const deletingActiveCycle = state.activeCycleId === cycleId;
  // Allow deleting active cycle: clear active UI state and unset activeCycleId
  if (deletingActiveCycle) {
    state.activeCycleId = null;
    // Clear active projections shown in UI
    state.today = { ...(state.today || {}), blocks: [] };
    state.currentWeek = { ...(state.currentWeek || {}), days: [] };
    state.cycle = [];
    state.proposedBlocks = [];
    state.suggestedBlocks = [];
    state.suggestionEvents = [];
    state.executionEvents = [];
    state.suggestionHistory = { dayKey: state.appTime?.activeDayKey || nowDayKey(), count: 0, lastSuggestedAtISO: null, lastSuggestedAtISOByGoal: {}, dailyCountByGoal: {}, denials: [] };
    state.goalExecutionContract = null;
    state.planDraft = null;
    state.planPreview = null;
    state.planCalibration = null;
    state.activeGoalId = null;
  }
  const cycle = state.cyclesById[cycleId];
  const goalId =
    cycle?.goalContract?.goalId ||
    cycle?.goalGovernanceContract?.goalId ||
    cycle?.contract?.goalId ||
    cycle?.goalPlan?.goalId ||
    null;
  delete state.cyclesById[cycleId];
  if (state.deliverablesByCycleId?.[cycleId]) delete state.deliverablesByCycleId[cycleId];
  if (state.aspirationsByCycleId?.[cycleId]) delete state.aspirationsByCycleId[cycleId];
  if (goalId && state.goalAdmissionByGoal?.[goalId]) delete state.goalAdmissionByGoal[goalId];
  if (state.history?.cycles) {
    state.history.cycles = state.history.cycles.filter((entry) => entry.id !== cycleId);
  }
  if (state.historySignalsByCycleId?.[cycleId]) {
    delete state.historySignalsByCycleId[cycleId];
    rebuildHistoryProfile(state);
  }
  if (deletingActiveCycle) {
    startNewCycle(state, {
      goalText: ' ',
      narrative: '',
      successDefinition: '',
      minimumDaysPerWeek: 4
    });
    resetCycleToGoalEntryReady(state, state.activeCycleId);
    state.meta = {
      ...(state.meta || {}),
      goalEntryRequestedAtISO: state.appTime?.nowISO || null
    };
    assertActiveCycleInvariant(state);
  }
}

function startNewCycleWithDecision(state, payload = {}) {
  ensureCycleStructures(state);
  const mode = payload?.mode === 'delete' ? 'delete' : 'archive';
  const previousActiveCycleId = state.activeCycleId || null;
  if (!previousActiveCycleId || !state.cyclesById?.[previousActiveCycleId]) {
    startNewCycle(state, {
      goalText: ' ',
      narrative: '',
      successDefinition: '',
      minimumDaysPerWeek: 4
    });
    resetCycleToGoalEntryReady(state, state.activeCycleId);
    state.meta = {
      ...(state.meta || {}),
      goalEntryRequestedAtISO: state.appTime?.nowISO || null
    };
    assertActiveCycleInvariant(state);
    return;
  }

  if (mode === 'delete') {
    deleteCycle(state, previousActiveCycleId);
    resetCycleToGoalEntryReady(state, state.activeCycleId);
  } else {
    startNewCycle(state, {
      goalText: ' ',
      narrative: '',
      successDefinition: '',
      minimumDaysPerWeek: 4
    });
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
    goalEntryRequestedAtISO: state.appTime?.nowISO || null
  };
  assertActiveCycleInvariant(state);
}

function hardDeleteCycle(state, cycleId) {
  ensureCycleStructures(state);
  if (!cycleId || !state.cyclesById?.[cycleId]) return;
  if (state.activeCycleId === cycleId) {
    // clear active UI and unset
    state.activeCycleId = null;
    state.today = { ...(state.today || {}), blocks: [] };
    state.currentWeek = { ...(state.currentWeek || {}), days: [] };
    state.cycle = [];
    state.proposedBlocks = [];
    state.suggestedBlocks = [];
    state.suggestionEvents = [];
    state.executionEvents = [];
    state.suggestionHistory = { dayKey: state.appTime?.activeDayKey || nowDayKey(), count: 0, lastSuggestedAtISO: null, lastSuggestedAtISOByGoal: {}, dailyCountByGoal: {}, denials: [] };
    state.goalExecutionContract = null;
    state.planDraft = null;
    state.planPreview = null;
    state.planCalibration = null;
    state.activeGoalId = null;
  }
  const cycle = state.cyclesById[cycleId];
  const goalId =
    cycle?.goalContract?.goalId ||
    cycle?.goalGovernanceContract?.goalId ||
    cycle?.contract?.goalId ||
    cycle?.goalPlan?.goalId ||
    null;
  delete state.cyclesById[cycleId];
  if (state.deliverablesByCycleId?.[cycleId]) delete state.deliverablesByCycleId[cycleId];
  if (state.aspirationsByCycleId?.[cycleId]) delete state.aspirationsByCycleId[cycleId];
  if (goalId && state.goalAdmissionByGoal?.[goalId]) delete state.goalAdmissionByGoal[goalId];
  if (state.history?.cycles) {
    state.history.cycles = state.history.cycles.filter((c) => c.id !== cycleId);
  }
  if (state.historySignalsByCycleId?.[cycleId]) {
    delete state.historySignalsByCycleId[cycleId];
    rebuildHistoryProfile(state);
  }
}

function endCycle(state, cycleId) {
  ensureCycleStructures(state);
  const id = cycleId || state.activeCycleId;
  if (!id || !state.cyclesById?.[id]) return;
  const cycle = state.cyclesById[id];
  if (cycle.status === 'ended') return;
  const todayKey = state.appTime?.activeDayKey || state.today?.date || nowDayKey();
  cycle.status = 'ended';
  cycle.endedAtDayKey = todayKey;
  
  // MVP 3.0: Compute terminal convergence
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const timezone = state.appTime?.timeZone || 'UTC';
  const deliverables =
    state.deliverablesByCycleId?.[cycle.id]?.deliverables ||
    cycle?.deliverables ||
    cycle?.strategy?.deliverables ||
    [];
  const convergenceReport = computeTerminalConvergence({
    cycle,
    planProof: cycle?.goalPlan?.planProof || null,
    events: cycle?.executionEvents || state.executionEvents || [],
    nowISO,
    timezone,
    deliverables
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
    state.today = { ...(state.today || {}), blocks: [] };
    state.currentWeek = { ...(state.currentWeek || {}), days: [] };
    state.cycle = [];
    state.proposedBlocks = [];
    state.suggestedBlocks = [];
    state.suggestionEvents = [];
    state.executionEvents = [];
  }
}

/**
 * Archive the active cycle and create a new editable draft from its contract.
 * Used when plan generation fails (e.g., DEADLINE_INVALID) to allow fixing the goal.
 */
function archiveAndCloneCycle(state, cycleId, overrides = {}) {
  ensureCycleStructures(state);
  const id = cycleId || state.activeCycleId;
  if (!id || !state.cyclesById?.[id]) return;

  const cycle = state.cyclesById[id];
  const contractToClone = cycle.goalContract;

  if (!contractToClone) {
    state.lastPlanError = {
      code: 'CLONE_FAILED',
      reasons: ['No goal contract found to clone'],
      timestamp: state.appTime?.nowISO || new Date().toISOString()
    };
    return;
  }

  // STEP 1: Archive current cycle (mark ended but preserve history)
  endCycle(state, id);

  // STEP 2: Create new draft with fresh contract (clearing inscription hash for editing)
  const newContractDraft = {
    ...structuredClone ? structuredClone(contractToClone) : JSON.parse(JSON.stringify(contractToClone)),
    admissionStatus: 'PENDING', // Reset to draft status
    admissionAttemptCount: 0,
    rejectionCodes: [],
    ...overrides
  };

  // Clear inscription to allow editing
  if (newContractDraft.inscription) {
    newContractDraft.inscription.contractHash = null;
    newContractDraft.inscription.inscribedAt = null;
  }

  // STEP 3: Store as editable draft (not auto-admitted)
  if (!state.aspirations) state.aspirations = [];
  const draftId = nextDeterministicId(state, 'asp-draft');
  const draftEntry = {
    id: draftId,
    createdAtISO: state.appTime?.nowISO || new Date().toISOString(),
    contractDraft: newContractDraft,
    source: 'archive-clone',
    sourceGoalId: contractToClone.goalId,
    sourceReason: 'User correcting goal after admission'
  };

  state.aspirations.push(draftEntry);

  // Optional: Mark this as the active draft for display
  state.activeAspirationId = draftId;

  // Clear the plan error since user is taking action
  state.lastPlanError = null;
}

function generatePlan(state, payload = {}) {
  const explicitCycleId = payload?.cycleId || null;
  const targetCycleId = explicitCycleId || state.activeCycleId || null;
  const cycle = explicitCycleId ? state?.cyclesById?.[explicitCycleId] || null : getTargetCycle(state, targetCycleId);
  const cycleIdForLog = cycle?.id || targetCycleId || null;
  const deliverableCount = Number(state?.deliverablesByCycleId?.[cycleIdForLog]?.deliverables?.length || 0);
  const llmActionCount = Number(cycle?.llmActionGraph?.actions?.length || 0);
  const cycleActionCount = Number(cycle?.actions?.length || 0);
  const actionCount = Math.max(llmActionCount, cycleActionCount);
  const contract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
  state.draftScheduleAppliedAtISO = null;
  state.scheduleApplied = false;
  if (!cycle) {
    state.lastPlanError = {
      code: 'CYCLE_TARGET_INVALID',
      reason: 'Target cycle is missing or unavailable.',
      cycleId: targetCycleId || null
    };
    setGenerateHeartbeat(state, targetCycleId, 0, 'CYCLE_TARGET_INVALID');
    logGenerateDiagnostics({
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
  if (isCycleReadOnly(cycle)) {
    state.lastPlanError = {
      code: 'CYCLE_READ_ONLY',
      reason: 'Cannot generate schedule for an ended or archived cycle.',
      cycleId: cycle.id || targetCycleId,
      details: {
        status: cycle.status || cycle.state || null
      }
    };
    setGenerateHeartbeat(state, cycle.id || targetCycleId, 0, 'CYCLE_READ_ONLY');
    logGenerateDiagnostics({
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
    weeklyCapMinutes
  };
  if (!contract) {
    setCycleProposedBlocks(state, cycle.id || targetCycleId, []);
    state.lastPlanError = {
      code: 'NO_ACTION_GRAPH',
      reason: 'No admitted goal contract is available for schedule generation.',
      cycleId: cycle.id || targetCycleId,
      reasonCodes: ['NO_ACTION_GRAPH'],
      conflicts: [],
      meta: baseErrorMeta
    };
    setGenerateHeartbeat(state, cycle.id || targetCycleId, 0, 'NO_ACTION_GRAPH');
    logGenerateDiagnostics({
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
    setCycleProposedBlocks(state, cycle.id || targetCycleId, []);
    state.lastPlanError = {
      code: 'GOAL_ID_MISSING',
      reason: 'Active cycle goal contract is missing goalId; generation cannot bind canonical proposals.',
      cycleId: cycle.id || targetCycleId,
      reasonCodes: ['GOAL_ID_MISSING'],
      conflicts: [],
      meta: baseErrorMeta
    };
    setGenerateHeartbeat(state, cycle.id || targetCycleId, 0, 'GOAL_ID_MISSING');
    logGenerateDiagnostics({
      cycleId: cycle.id || targetCycleId,
      deliverableCount,
      actionCount,
      rawWorkWindowsCount,
      normalizedCandidateWindowCount,
      proposedBlocks: state.proposedBlocks || [],
      lastPlanErrorCode: 'GOAL_ID_MISSING',
    });
    return;
  }
  const admission = state.goalAdmissionByGoal?.[contract.goalId] || cycle.goalAdmission;
  if (admission && admission.status !== 'ADMITTED') {
    state.lastPlanError = {
      code: 'GOAL_NOT_ADMITTED',
      reason: (admission.reasonCodes || []).join(', ') || 'Goal not admitted',
      cycleId: cycle.id,
      goalId: contract.goalId
    };
    setGenerateHeartbeat(state, cycle.id, 0, 'GOAL_NOT_ADMITTED');
    logGenerateDiagnostics({
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
  const activeDayKey = state.appTime?.activeDayKey || null;
  const todayDayKey = maxDayKey(activeDayKey, nowDayKeyFromClock) || nowDayKey(timeZone);
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
  const anchorDayKey = maxDayKey(todayDayKey, contractStartDayKey) || todayDayKey;
  const anchorNowISO = `${anchorDayKey}T12:00:00.000Z`;
  const fallbackSessionCount = Number(Array.isArray(cycle?.llmSessionPlan) ? cycle.llmSessionPlan.length : 0);
  const fallbackActionCount = Number(getCanonicalCycleActions(cycle).length || 0);
  const minimumFallbackHorizonDays = Math.max(90, fallbackSessionCount, fallbackActionCount);
  const fullHorizonDays = contractEndDayKey
    ? Math.max(1, daysBetween(anchorDayKey, contractEndDayKey) + 1)
    : Math.max(14, minimumFallbackHorizonDays);
  const horizonDays = Math.max(1, fullHorizonDays);
  const plan = state.planDraft || cycle.planDraft;
  const planProof =
    cycle.planProof ||
    (cycle.goalEquation ? derivePlanProof(cycle.goalEquation, { nowDayKey: anchorDayKey, timeZone }) : null);
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
      meta: baseErrorMeta
    };
    setGenerateHeartbeat(state, cycle.id, 0, 'NO_ACTION_GRAPH');
    logGenerateDiagnostics({
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
  const constraints = {
    ...scopedConstraints,
    timezone: timeZone,
    weeklyWindows,
    dayEndAtHHMM: scopedConstraints?.dayEndAtHHMM || state?.availabilityPolicy?.dayEndAtHHMM,
    cycleStartDayKey: contractStartDayKey,
    cycleEndDayKey: contractEndDayKey,
  };
  const horizonEnd = addDays(anchorDayKey, Math.max(0, horizonDays - 1), timeZone);
  const { days } = materializeBlocksFromEvents(state.executionEvents || [], { todayISO: state.today?.date });
  const acceptedBlocks = (days || [])
    .filter((d) => d?.date && d.date >= anchorDayKey && d.date <= horizonEnd)
    .flatMap((d) => (d.blocks || []).filter((b) => b?.cycleId === cycle.id));
  const actionSequence = getCanonicalCycleActions(cycle);
  const actionSequenceWithDeliverableIds = annotateActionsWithDeliverableIds(cycle, actionSequence);
  const explicitMaxPerWeek = Number(scopedConstraints?.maxBlocksPerWeek);
  const strategyMaxPerWeek = Number(cycle?.strategy?.constraints?.maxBlocksPerWeek);
  const horizonWeeks = Math.max(1, Math.ceil(horizonDays / 7));
  const derivedMaxPerWeek = Math.max(1, Math.ceil(Math.max(1, actionSequence.length) / horizonWeeks));
  const resolvedMaxPerWeek =
    Number.isFinite(explicitMaxPerWeek) && explicitMaxPerWeek > 0
      ? explicitMaxPerWeek
      : Number.isFinite(strategyMaxPerWeek) && strategyMaxPerWeek > 0
        ? strategyMaxPerWeek
        : derivedMaxPerWeek;
  const explicitMaxPerDay = Number(scopedConstraints?.maxBlocksPerDay);
  const strategyMaxPerDay = Number(cycle?.strategy?.constraints?.maxBlocksPerDay);
  const resolvedMaxPerDay =
    Number.isFinite(explicitMaxPerDay) && explicitMaxPerDay > 0
      ? explicitMaxPerDay
      : Number.isFinite(strategyMaxPerDay) && strategyMaxPerDay > 0
        ? strategyMaxPerDay
        : Math.max(1, Math.min(2, resolvedMaxPerWeek));
  constraints.maxBlocksPerWeek = resolvedMaxPerWeek;
  constraints.maxBlocksPerDay = resolvedMaxPerDay;
  cycle.autoAsanaPlan = compileAutoAsanaPlan({
    goalId: contract.goalId,
    cycleId: cycle.id,
    planProof,
    constraints,
    nowISO: anchorNowISO,
    horizonDays,
    acceptedBlocks,
    actionSequence: actionSequenceWithDeliverableIds,
    sessionPlan: Array.isArray(cycle?.llmSessionPlan) ? cycle.llmSessionPlan : []
  });
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
    dayKey: block.dayKey,
    identityKey: block.identityKey || null,
    deliverableId: block.deliverableId || null,
    actionId: block.actionId || null,
    sessionIndex: Number.isFinite(block.sessionIndex) ? Number(block.sessionIndex) : index,
    source: 'action_graph'
  }));
  setCycleProposedBlocks(state, cycle.id, suggestions);
  state.suggestionEvents = state.suggestionEvents || [];
  state.suggestionEvents.push({
    id: nextDeterministicId(state, `sev-suggestions-${contract.goalId}`),
    type: 'suggestions_generated',
    proposalIds: suggestions.map((s) => s.id),
    goalId: contract.goalId,
    atISO: nowISO
  });
  state.planPreview = computePlanPreview({
    suggestedBlocks: state.proposedBlocks || [],
    planDraft: state.planDraft,
    contract,
    policyState: getCurrentPolicyState(state),
    historyProfile: buildHistoryProfileForDraft(state, state.planDraft),
    timeZone: state.appTime?.timeZone || APP_TIME_ZONE,
  });
  const suggestedCount = (state.proposedBlocks || []).filter((item) => item?.status === 'suggested').length;
  if (suggestedCount === 0) {
    const conflictCodes = Array.from(new Set(
      (cycle.autoAsanaPlan?.conflicts || []).map((conflict) => String(conflict?.code || conflict?.kind || '').trim()).filter(Boolean)
    ));
    const normalizedConflicts = conflictCodes
      .map((code) => code.toUpperCase())
      .filter(Boolean)
      .sort()
      .slice(0, 5);
    const reasonCodes = [];
    const hasWindowsConfigured = hasExplicitWeeklyWindows;
    const hasAnyWindowRange = Object.values(weeklyWindows || {}).some((rows) =>
      Array.isArray(rows) && rows.some((row) => row?.startHHMM && row?.endHHMM && row.startHHMM < row.endHHMM)
    );
    if (normalizedConflicts.includes('NO_ALLOWED_WINDOWS') || (hasWindowsConfigured && !hasAnyWindowRange)) {
      reasonCodes.push('NO_ALLOWED_WINDOWS');
    }
    if (
      normalizedConflicts.includes('OUT_OF_CYCLE_RANGE') ||
      normalizedConflicts.includes('FILTERED_OUT_OF_RANGE')
    ) {
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
    const stableReasonOrder = ['NO_ALLOWED_WINDOWS', 'OUT_OF_CYCLE_RANGE', 'OVERLAP_ALL_SLOTS', 'CLAMP_FILTERED_ALL', 'UNSCHEDULABLE'];
    const orderedReasonCodes = stableReasonOrder.filter((code) => reasonCodes.includes(code));
    state.lastPlanError = {
      code: 'NO_PROPOSED_BLOCKS',
      reason: 'No proposed blocks could be scheduled under current constraints.',
      reasonCodes: orderedReasonCodes,
      conflicts: normalizedConflicts,
      meta: {
        ...baseErrorMeta,
        anchorDow: dayKeyToDow(anchorDayKey),
        anchorStartHHMM: getFirstWindowStartForDow(dayKeyToDow(anchorDayKey), contractWorkWindows),
      }
    };
    setGenerateHeartbeat(state, cycle.id, 0, 'NO_PROPOSED_BLOCKS');
  } else if (!state.lastPlanError || state.lastPlanError.code === 'NO_PROPOSED_BLOCKS') {
    state.lastPlanError = null;
    setGenerateHeartbeat(state, cycle.id, suggestedCount, null);
  } else {
    setGenerateHeartbeat(state, cycle.id, suggestedCount, state.lastPlanError?.code || null);
  }
  if (suggestedCount > 0 && !state.scheduleApplied) {
    applyDraftSchedule(state, { cycleId: cycle.id, goalId: contract.goalId });
    state.scheduleApplied = true;
    logGenerateDiagnostics({
      traceId: `trace-${cycle.id}-apply`,
      cycleId: cycle.id,
      goalId: contract?.goalId || null,
      moduleName: 'applyDraftSchedule',
      stepName: 'complete',
      status: 'ok',
      outputSummary: {
        committedBlocksCount: (state.today?.blocks || []).length,
        cycleBlocksCount: (state.cycle || []).flatMap((d) => d.blocks || []).length,
        scheduleApplied: state.scheduleApplied,
      },
      reasonCodes: [],
    });
  }
  logGenerateDiagnostics({
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
    reasonCodes: state.lastPlanError?.reasonCodes || [],
  });
  state.cyclesById[cycle.id] = cycle;
}

function applyGeneratedPlan(state) {
  const cycle = getActiveCycle(state);
  const contract = state.goalExecutionContract;
  if (!cycle || !contract || !cycle.autoAsanaPlan) return;
  const admission = state.goalAdmissionByGoal?.[contract.goalId] || cycle.goalAdmission;
  if (admission && admission.status !== 'ADMITTED') {
    state.lastPlanError = {
      code: 'GOAL_NOT_ADMITTED',
      reason: (admission.reasonCodes || []).join(', ') || 'Goal not admitted',
      cycleId: cycle.id,
      goalId: contract.goalId
    };
    return;
  }
  if ((cycle.autoAsanaPlan.conflicts || []).length) {
    state.lastPlanError = {
      code: 'PLAN_UNSCHEDULABLE',
      reason: 'Resolve conflicts before applying the plan.',
      cycleId: cycle.id,
      goalId: contract.goalId
    };
    return;
  }
  const plan = cycle.autoAsanaPlan;
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const timeZone = state.appTime?.timeZone || 'UTC';
  const existingCreates = new Set((state.executionEvents || []).map((e) => e?.blockId).filter(Boolean));
  const domain = state.planDraft?.primaryDomain || 'FOCUS';
  (plan.horizonBlocks || []).forEach((block) => {
    if (!block?.id || existingCreates.has(block.id)) return;
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
      timeZone
    });
  });
  state.planEvents = state.planEvents || [];
  state.planEvents.push({
    id: nextDeterministicId(state, `plan-applied-${cycle.id}`),
    type: 'PLAN_APPLIED',
    cycleId: cycle.id,
    goalId: contract.goalId,
    atISO: nowISO,
    policyVersion: plan.audit?.policyVersion || 'auto_asana_v1'
  });
  cycle.lastPlanAppliedAtISO = nowISO;
  state.cyclesById[cycle.id] = cycle;
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
  state.policySelectionParity = Boolean(previewPolicyId && previewPolicyId === appliedPolicyId && previewReasonCodes === appliedReasonCodes);
  state.scoreParity = Boolean(
    isNumericParity(state.planPreview?.qualityScoreBaseline, appliedPreview?.qualityScoreBaseline) &&
      JSON.stringify(state.planPreview?.qualityScoreBaselineByComponent || {}) ===
        JSON.stringify(appliedPreview?.qualityScoreBaselineByComponent || {})
  );
  state.pacingParity = Boolean(
    Number(state.planPreview?.pacingInjectedCheckpointCount || 0) === Number(appliedPreview?.pacingInjectedCheckpointCount || 0) &&
      JSON.stringify(state.planPreview?.pacingInjectedByMilestone || {}) ===
        JSON.stringify(appliedPreview?.pacingInjectedByMilestone || {})
  );
  return appliedPolicyId;
}

function applyDraftSchedule(state, payload = {}) {
  const targetCycleId = payload?.cycleId || state.activeCycleId || null;
  const cycle = getTargetCycle(state, targetCycleId);
  const contract = getCanonicalCycleContract(cycle, state.goalExecutionContract, cycle?.contract || null);
  if (!cycle || !contract) return;
  if (isCycleReadOnly(cycle)) {
    state.lastPlanError = {
      code: 'CYCLE_READ_ONLY',
      reason: 'Cannot apply schedule for an ended or archived cycle.',
      cycleId: cycle.id || targetCycleId
    };
    return;
  }
  const nowDay = state.appTime?.activeDayKey || state.today?.date || nowDayKey(state.appTime?.timeZone || APP_TIME_ZONE);
  const previewDecisionBeforeApply = state.planPreview?.policySelectionDecision || null;
  const sourceBlocks = state.proposedBlocks || [];
  const suggestedBlocks = sourceBlocks.filter((block) => !block?.cycleId || block?.cycleId === cycle.id);
  const timeZone = state.appTime?.timeZone || 'UTC';
  const appliedPreview = computePlanPreview({
    suggestedBlocks,
    planDraft: state.planDraft,
    contract,
    policyState: cycle.policyState || null,
    historyProfile: buildHistoryProfileForDraft(state, state.planDraft),
    timeZone,
  });
  let proposedItems = (suggestedBlocks || []).filter((item) => item?.status === 'suggested');
  if (!proposedItems.length) {
    proposedItems = (suggestedBlocks || []).filter(Boolean);
  }
  const appliedPolicyId = recordDraftPolicyParity(state, appliedPreview);
  if (!proposedItems.length) {
    // No-op apply: preserve deterministic preview/apply parity flags for diagnostics.
    state.scoreParity = true;
    state.lastPlanError = {
      code: 'NO_PROPOSED_BLOCKS',
      reason: 'No preview items to apply.',
      cycleId: cycle.id
    };
    return;
  }
  proposedItems.forEach((item) => {
    if (!item?.startISO) return;
    const duration = Number.isFinite(item.durationMinutes) ? Number(item.durationMinutes) : 30;
    const startDate = new Date(item.startISO);
    if (!Number.isFinite(startDate.getTime())) return;
    createBlock(state, {
      cycleId: cycle.id,
      goalId: contract.goalId,
      startISO: item.startISO,
      durationMinutes: duration,
      domain: item.domain || item.domainKey || state.planDraft?.primaryDomain || 'FOCUS',
      title: item.title || 'Scheduled action',
      origin: 'suggested_apply',
      surface: 'today',
      suggestionId: item.id,
      deliverableId: item.payload?.deliverableId ?? null,
      criterionId: item.payload?.criterionId ?? null,
      timeZone,
    });
  });
  const acceptedSuggestionIds = new Set(proposedItems.map((item) => item.id));
  const nextSuggestions = sourceBlocks.map((item) => {
    if (!acceptedSuggestionIds.has(item?.id)) return item;
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
  });
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
  state.planDraft = null;
  state.planPreview = null;
  cycle.autoAsanaPlan = null;
  cycle.coldPlan = { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } };
  cycle.lastPolicySelectionDecision = previewDecisionBeforeApply || appliedPreview.policySelectionDecision || null;
  state.cyclesById[cycle.id] = cycle;
  logGenerateDiagnostics({
    traceId: `trace-${cycle.id}-commit`,
    cycleId: cycle.id,
    goalId: contract?.goalId || null,
    moduleName: 'commitBlocks',
    stepName: 'complete',
    status: state.lastPlanError?.code ? 'fail' : 'ok',
    outputSummary: {
      createdBlockCount: proposedItems.length,
      acceptedSuggestionCount: acceptedSuggestionIds.size,
      executionEventCount: (state.executionEvents || []).length,
      todayBlocksCount: (state.today?.blocks || []).length,
      cycleBlocksCount: (state.cycle || []).flatMap((d) => d.blocks || []).length,
    },
    lastPlanErrorCode: state.lastPlanError?.code || null,
    reasonCodes: state.lastPlanError?.reasonCodes || [],
  });
}

function resolveRenegotiationOption(cycle, payload = {}) {
  const optionPool = Array.isArray(cycle?.metrics?.renegotiationOptions)
    ? cycle.metrics.renegotiationOptions
    : Array.isArray(cycle?.recoveryContract?.options)
      ? cycle.recoveryContract.options
      : [];
  if (!optionPool.length) return null;
  if (payload?.option && typeof payload.option === 'object') {
    const exact = optionPool.find(
      (option) =>
        option?.type === payload.option.type &&
        Number(option?.delta ?? null) === Number(payload.option.delta ?? null) &&
        String(option?.summary || '') === String(payload.option.summary || '')
    );
    if (exact) return exact;
  }
  if (Number.isInteger(payload?.optionIndex) && payload.optionIndex >= 0 && payload.optionIndex < optionPool.length) {
    return optionPool[payload.optionIndex];
  }
  if (payload?.optionType) {
    const normalizedType = String(payload.optionType || '').trim().toUpperCase();
    const preferredDelta = Number(payload?.delta);
    const typed = optionPool.filter((option) => String(option?.type || '').trim().toUpperCase() === normalizedType);
    if (typed.length === 0) return null;
    if (Number.isFinite(preferredDelta)) {
      const exact = typed.find((option) => Number(option?.delta) === preferredDelta);
      if (exact) return exact;
    }
    return typed[0];
  }
  return optionPool[0] || null;
}

function applyRenegotiationOption(state, payload = {}) {
  const activeCycleId = state?.activeCycleId || null;
  if (!activeCycleId) return;
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
  if (!cycle) return;
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

  const optionType = String(selectedOption?.type || '').trim().toUpperCase();
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
    const deltaPerWeek = Number.isFinite(deltaPerWeekRaw) && deltaPerWeekRaw > 0 ? Math.max(1, Math.round(deltaPerWeekRaw)) : 0;
    if (!(deltaPerWeek > 0)) {
      unsupportedReason = 'RENEGOTIATION_THROUGHPUT_INPUT_INVALID';
    } else {
      const strategy = cycle.strategy || {};
      const strategyConstraints = strategy.constraints || {};
      const workWindows = canonicalContract?.workWindows || cycle?.goalContract?.workWindows || null;
      const workDays = countRawWorkWindows(workWindows) > 0
        ? getWorkDaysFromWindows(workWindows)
        : strategyConstraints?.workableDayPolicy?.weekdays || state?.constraints?.workableDayPolicy?.weekdays || ['mon', 'tue', 'wed', 'thu', 'fri'];
      const workDaysCount = Math.max(1, Array.isArray(workDays) ? workDays.length : 5);
      const priorWeek =
        (Number.isFinite(Number(strategyConstraints.maxBlocksPerWeek)) && Number(strategyConstraints.maxBlocksPerWeek) > 0)
          ? Number(strategyConstraints.maxBlocksPerWeek)
          : resolveCycleCapacityPerDay(state, cycle) * 7;
      const priorDay =
        (Number.isFinite(Number(strategyConstraints.maxBlocksPerDay)) && Number(strategyConstraints.maxBlocksPerDay) > 0)
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
  if (!cycle) return;
  const outcome = (payload.outcome || '').trim();
  const deadlineDayKey = payload.deadlineDayKey || cycle.definiteGoal?.deadlineDayKey || '';
  if (!deadlineDayKey) return;
  cycle.definiteGoal = { outcome: outcome || cycle.definiteGoal?.outcome || 'Definite goal', deadlineDayKey };
  state.cyclesById[cycle.id] = cycle;
  if (state.goalExecutionContract) {
    state.goalExecutionContract = {
      ...state.goalExecutionContract,
      goalText: outcome || state.goalExecutionContract.goalText,
      endDayKey: deadlineDayKey
    };
  }
}

function compileGoalEquation(state, payload = {}) {
  ensureCycleStructures(state);
  ensureAdmissionStores(state);
  const cycle = getActiveCycle(state);
  if (!cycle) return;
  const equation = payload?.equation;
  if (!equation) return;
  const timeZone = state.appTime?.timeZone || 'UTC';
  const nowKey = state.appTime?.activeDayKey || state.today?.date || nowDayKey(timeZone);
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const admission = admitGoal(equation, {
    nowISO,
    timeZone,
    cycleId: cycle.id,
    constraints: state.constraints,
    acceptedBlocks: []
  });
  cycle.goalAdmission = {
    status: admission.status,
    reasonCodes: admission.reasonCodes,
    admittedAtISO: admission.status === 'ADMITTED' ? nowISO : undefined
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
      reasonCodes: admission.reasonCodes
    };
    const existing = state.aspirationsByCycleId[cycle.id] || [];
    state.aspirationsByCycleId[cycle.id] = [...existing, aspiration];
    state.lastPlanError = {
      code: admission.status,
      reason: admission.reasonCodes.join(', '),
      cycleId: cycle.id,
      goalId: goalIdForAdmission || undefined
    };
    state.cyclesById[cycle.id] = cycle;
    return;
  }
  state.lastPlanError = null;
  cycle.goalEquation = equation;
  const label = equation.label || `${equation.objectiveValue} ${equation.objective.replace(/_/g, ' ')}`;
  cycle.definiteGoal = {
    outcome: label,
    deadlineDayKey: equation.deadlineDayKey
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
          deliverables: autoDeliverables
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
      endDayKey: equation.deadlineDayKey
    };
  }
  const { planProof, scheduleBlocks } = compileGoalEquationPlan({
    equation,
    nowDayKey: nowKey,
    timeZone,
    cycleId: cycle.id
  });
  cycle.planProof = derivePlanProof(equation, { nowDayKey: nowKey, timeZone });
  cycle.goalPlan = {
    planProof,
    scheduleBlocks,
    generatedAtISO: state.appTime?.nowISO || new Date().toISOString()
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
      OUTPUT: 'CREATION'
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
        lockedUntilDayKey: block.locked ? lockUntilDayKey : null
      });
    });
  }
}

function acceptSuggestedBlock(state, proposalId) {
  if (!proposalId) return;
  const suggestions = (state.proposedBlocks || []).map((entry) => ({ ...entry }));
  const target = suggestions.find((s) => s.id === proposalId);
  if (!target || target.status !== 'suggested') return;
  const existingCreate = (state.executionEvents || []).find(
    (event) => event?.kind === 'create' && (event?.suggestionId === proposalId || event?.blockId === `blk-${proposalId}`)
  );
  if (existingCreate) return;
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
    surface: 'week'
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
    atISO: nowISO
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
  if (!Number.isFinite(parsed) || parsed < 3 || parsed > 7) return;
  const plan = state.planDraft;
  const contract = state.goalExecutionContract;
  if (!plan || !contract) return;
  if (plan.status === 'calibrated' && plan.daysPerWeek === parsed) return;
  const prevSuggestionIds = (state.proposedBlocks || [])
    .filter((s) => s && s.status === 'suggested')
    .map((s) => s.id);

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
    `Default capacity ${blocksPerWeek} blocks/week.`
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
    timeZone: state.appTime?.timeZone
  });
  setCycleProposedBlocks(state, state.activeCycleId || null, [...preserved, ...nextSuggested]);

  const nowISO = new Date().toISOString();
  state.suggestionEvents = state.suggestionEvents || [];
  state.suggestionEvents.push({
    id: nextDeterministicId(state, `sev-recompute-${contract.goalId}`),
    type: 'suggestions_recomputed',
    reason: 'capacity_calibration',
    prevSuggestionIds,
    nextSuggestionIds: nextSuggested.map((s) => s.id),
    atISO: nowISO
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
    contractId: state.activeCycleId ? state.cyclesById?.[state.activeCycleId]?.goalGovernanceContract?.contractId : undefined,
    planId: plan.id,
    atISO: nowISO
  });
}

function rejectSuggestedBlock(state, proposalId, reason) {
  if (!proposalId) return;
  const suggestions = (state.proposedBlocks || []).map((entry) => ({ ...entry }));
  const target = suggestions.find((s) => s.id === proposalId);
  if (!target) return;
  if (target.status === 'rejected') return;
  if (target.status !== 'suggested') return;
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
    contractId: state.activeCycleId ? state.cyclesById?.[state.activeCycleId]?.goalGovernanceContract?.contractId : undefined,
    planId: state.planDraft?.id,
    atISO: nowISO
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
  if (!proposalId) return;
  const suggestions = (state.proposedBlocks || []).map((entry) => ({ ...entry }));
  const target = suggestions.find((s) => s.id === proposalId);
  if (!target || target.status !== 'suggested') return;
  const nowISO = new Date().toISOString();
  target.status = 'ignored';
  target.ignoredAtISO = nowISO;
  state.suggestionEvents = state.suggestionEvents || [];
  state.suggestionEvents.push({
    id: `sev-${proposalId}-ignored`,
    type: 'suggestion_ignored',
    suggestionId: proposalId,
    goalId: target.goalId,
    atISO: nowISO
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
  if (!proposalId) return;
  const suggestions = (state.proposedBlocks || []).map((entry) => ({ ...entry }));
  const target = suggestions.find((s) => s.id === proposalId);
  if (!target || target.status !== 'suggested') return;
  const nowISO = new Date().toISOString();
  target.status = 'dismissed';
  target.dismissedAtISO = nowISO;
  state.suggestionEvents = state.suggestionEvents || [];
  state.suggestionEvents.push({
    id: `sev-${proposalId}-dismissed`,
    type: 'suggestion_dismissed',
    suggestionId: proposalId,
    goalId: target.goalId,
    atISO: nowISO
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
  if (!cycleId) return;
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) return;
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
    updatedAtISO: nowISO
  };
  workspace.deliverables = [...(workspace.deliverables || []), deliverable];
  workspace.lastUpdatedAtISO = nowISO;
  syncDeliverableWorkspaceIndexes(workspace);
  state.deliverablesByCycleId[cycleId] = workspace;
}

function updateDeliverable(state, payload = {}) {
  const cycleId = payload.cycleId || state.activeCycleId;
  const deliverableId = payload.deliverableId;
  if (!cycleId || !deliverableId) return;
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) return;
  const patch = payload.patch || {};
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  workspace.deliverables = (workspace.deliverables || []).map((d) =>
    d.id === deliverableId
      ? {
          ...d,
          ...patch,
          requiredBlocks:
            patch.requiredBlocks !== undefined ? Number(patch.requiredBlocks) || 0 : d.requiredBlocks,
          domain: patch.domain ? patch.domain.toString().toUpperCase() : d.domain,
          updatedAtISO: nowISO
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
  if (!cycleId || !deliverableId) return;
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) return;
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
  if (!cycleId || !deliverableId || !text) return;
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) return;
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  workspace.deliverables = (workspace.deliverables || []).map((d) => {
    if (d.id !== deliverableId) return d;
    const nextCriteria = [
      ...(d.criteria || []),
      {
        id: `crit-${deliverableId}-${(d.criteria || []).length + 1}`,
        deliverableId,
        text,
        isDone: false
      }
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
  if (!cycleId || !deliverableId || !criterionId) return;
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) return;
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const dayKey = state.appTime?.activeDayKey || nowDayKey();
  workspace.deliverables = (workspace.deliverables || []).map((d) => {
    if (d.id !== deliverableId) return d;
    const nextCriteria = (d.criteria || []).map((c) => {
      if (c.id !== criterionId) return c;
      const isDone = Boolean(payload.isDone);
      return {
        ...c,
        isDone,
        doneAtISO: isDone ? nowISO : null,
        doneAtDayKey: isDone ? dayKey : null
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
  if (!cycleId || !deliverableId || !criterionId) return;
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) return;
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  workspace.deliverables = (workspace.deliverables || []).map((d) => {
    if (d.id !== deliverableId) return d;
    return { ...d, criteria: (d.criteria || []).filter((c) => c.id !== criterionId), updatedAtISO: nowISO };
  });
  workspace.lastUpdatedAtISO = nowISO;
  syncDeliverableWorkspaceIndexes(workspace);
  state.deliverablesByCycleId[cycleId] = workspace;
}

function linkBlockToDeliverable(state, payload = {}) {
  const id = payload.blockId || payload.id;
  if (!id) return;
  updateBlock(state, {
    id,
    deliverableId: payload.deliverableId ?? null,
    criterionId: payload.criterionId ?? null
  });
}

function assignSuggestionLink(state, payload = {}) {
  const cycleId = payload.cycleId || state.activeCycleId;
  const suggestionId = payload.suggestionId;
  if (!cycleId || !suggestionId) return;
  const workspace = touchDeliverableWorkspace(state, cycleId);
  if (!workspace) return;
  workspace.suggestionLinks = workspace.suggestionLinks || {};
  if (!payload.deliverableId && !payload.criterionId) {
    delete workspace.suggestionLinks[suggestionId];
  } else {
    workspace.suggestionLinks[suggestionId] = {
      deliverableId: payload.deliverableId ?? null,
      criterionId: payload.criterionId ?? null
    };
  }
  state.deliverablesByCycleId[cycleId] = workspace;
}

function daysBetween(start, end) {
  if (!start || !end) return 0;
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
  if (surface !== 'today' && normalized !== 'planned') return 'planned';
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
  if (!state.draftEvents) state.draftEvents = [];
  return state.draftEvents;
}

function recordDraftEvent(state, event) {
  if (!event) return;
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
      status: block?.status || 'in_progress'
    });
    if (canEmitExecutionEvent(state.executionEvents || [], event)) {
      appendExecutionEvent(state, event);
    }
  });
  recordDraftEvent(state, {
    id: `draft-schedule-clear:${cycleId}:${nowISO}`,
    type: 'DRAFT_SCHEDULE_CLEAR',
    cycleId,
    atISO: nowISO
  });
  state._draftIdSequence = state._draftIdSequence || {};
  state._draftIdSequence[cycleId] = 0;
}

function handleDraftBlockCreate(state, action = {}) {
  const startISO = action.startISO || action.start;
  const endISO = action.endISO || action.end;
  if (!startISO || !endISO || !isValidISO(startISO) || !isValidISO(endISO)) return;
  const startDate = new Date(startISO);
  const endDate = new Date(endISO);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return;
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
    status
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
    createdAtISO: state.appTime?.nowISO || new Date().toISOString()
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
  if (!id) return null;
  const blocks = getAllBlocks(state);
  return blocks.find((b) => b.id === id) || null;
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
    objectiveId: payload.objectiveId || state.today?.primaryObjectiveId || null
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
    lockedUntilDayKey
  });
  if (!canEmitExecutionEvent(state.executionEvents || [], event)) return;
  appendExecutionEvent(state, event);
  const ensureDay = (arr = []) => {
    const existing = arr.find((d) => d.date === date);
    if (existing) return arr.map((d) => (d.date === date ? { ...d, blocks: [...(d.blocks || []), newBlock] } : d));
    return [...arr, { date, blocks: [newBlock], completionRate: 0, driftSignal: 'forming', loadByPractice: {}, practices: [] }];
  };

  state.today.blocks = [...(state.today.blocks || []), newBlock];
  state.cycle = ensureDay(state.cycle || []);
  state.currentWeek.days = ensureDay(state.currentWeek?.days || []);
  state.lastSessionChange = {
    type: 'CREATE_BLOCK',
    timestamp: new Date().toISOString(),
    beforeSummary: '',
    afterSummary: state.today?.summaryLine || ''
  };
}

function updateBlock(state, payload = {}) {
  const surface = (payload.surface || '').toString().toLowerCase() || 'today';
  if (!payload.id) return;
  if (surface === 'year') return; // Year is add/delete only per contract.

  const targetId = payload.id;
  const existing = findBlockById(state, targetId);
  if (!existing) return;
  const applyUpdate = (block) => {
    if (block.id !== targetId) return block;
    const startDate = payload.start ? new Date(payload.start) : new Date(block.start);
    const durationMinutes =
      payload.durationMinutes ||
      (payload.durationMs ? payload.durationMs / 60000 : null) ||
      (payload.duration ? payload.duration / 60000 : null) ||
      ((new Date(block.end).getTime() - new Date(block.start).getTime()) / 60000);
    const minutes = clampDurationMinutes(durationMinutes);
    const endDate = new Date(startDate.getTime() + minutes * 60 * 1000);
    const { domain, practice } = normalizeDomainValue(payload.domain || payload.practice || block.domain || block.practice);
    const status = normalizeStatus(payload.status || block.status, surface);
    return {
      ...block,
      practice,
      domain,
      label: payload.label || payload.title || block.label,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      status,
      deliverableId: Object.prototype.hasOwnProperty.call(payload, 'deliverableId') ? payload.deliverableId : block.deliverableId,
      criterionId: Object.prototype.hasOwnProperty.call(payload, 'criterionId') ? payload.criterionId : block.criterionId
    };
  };

  const updateBlocks = (blocks = []) => blocks.map(applyUpdate);
  state.today.blocks = updateBlocks(state.today.blocks);
  state.currentWeek.days = (state.currentWeek?.days || []).map((d) => ({
    ...d,
    blocks: updateBlocks(d.blocks)
  }));
  state.cycle = (state.cycle || []).map((d) => ({
    ...d,
    blocks: updateBlocks(d.blocks)
  }));

  const updated = applyUpdate(existing);
  const event = buildExecutionEventFromBlock(updated, {
    kind: 'update',
    completed: false,
    dateISO: null,
    startISO: null,
    endISO: null
  });
  if (!canEmitExecutionEvent(state.executionEvents || [], event)) return;
  appendExecutionEvent(state, event);
}

function deleteBlock(state, id) {
  if (!id) return;
  const existing = findBlockById(state, id);
  if (!existing) return;
  const event = buildExecutionEventFromBlock(existing, {
    kind: 'delete',
    completed: false,
    minutes: 0
  });
  if (!canEmitExecutionEvent(state.executionEvents || [], event)) return;
  const remove = (blocks = []) => blocks.filter((b) => b.id !== id);
  state.today.blocks = remove(state.today.blocks);
  state.currentWeek.days = (state.currentWeek?.days || []).map((d) => ({ ...d, blocks: remove(d.blocks) }));
  state.cycle = (state.cycle || []).map((d) => ({ ...d, blocks: remove(d.blocks) }));
  appendExecutionEvent(state, event);
}

function addRecurringPattern(state, pattern) {
  state.recurringPatterns = [...(state.recurringPatterns || []), pattern];
}

function applyRecurringPatterns(state) {
  const patterns = state.recurringPatterns || [];
  if (!patterns.length || !state.today?.date) return;
  const date = new Date(state.today.date);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  patterns.forEach((p) => {
    if (!p.weekdays || !p.weekdays.includes(weekday)) return;
    const startDate = new Date(date.getTime());
    startDate.setUTCHours(0, 0, 0, 0);
    const startMs = startDate.getTime() + (p.startMs || 0);
    const endMs = startMs + (p.durationMs || 30 * 60 * 1000);
    const exists = (state.today.blocks || []).some((b) => b.practice === p.practice && b.start === new Date(startMs).toISOString());
    if (exists) return;
    state.today.blocks = [
      ...(state.today.blocks || []),
      {
        id: `rec-${p.id}-${state.today.date}`,
        practice: p.practice,
        label: `${p.practice} (recurring)`,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        status: 'planned',
        objectiveId: state.today.primaryObjectiveId || null
      }
    ];
  });
}

function applyNextSuggestion(state) {
  const suggestion = state.nextSuggestion;
  if (!suggestion) return;
  if (suggestion.type === 'resume' || suggestion.type === 'start_planned') {
    if (suggestion.blockId) {
      updateBlockStatus(state, suggestion.blockId, 'in_progress');
    }
    return;
  }
  if (suggestion.type === 'repair') {
    const duration =
      new Date(suggestion.endISO).getTime() - new Date(suggestion.startISO).getTime();
    const payload = {
      date: suggestion.startISO.slice(0, 10),
      practice: suggestion.practice,
      start: suggestion.startISO,
      duration,
      status: 'in_progress'
    };
    createBlock(state, payload);
  }
}
