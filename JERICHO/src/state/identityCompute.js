import structuredClone from '@ungap/structured-clone';
import { PRACTICE_KEYS } from './metricsPolicy.js';
import { normalizeDomain } from './domain.js';
import { normalizeBlocksDomain } from './normalizeBlock.js';
import { addDays, dayKeyFromDate, dayKeyFromISO, dayKeyFromParts, nowDayKey, buildLocalStartISO, assertValidISO, isValidISO } from './time/time.ts';
import { buildDefaultStrategy, generateColdPlan, generateDailyProjection } from './coldPlan.ts';
import { compileGoalEquationPlan } from './goalEquation.ts';
import { admitGoal, isAdmitted } from './goalAdmission.ts';
import { compileAutoAsanaPlan } from './engine/autoAsanaPlan.ts';
import { buildAssumptionsHash, normalizeDeliverables, normalizeRouteOption } from './strategy.ts';
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

/**
 * @typedef {import('./identityTypes.js').IdentityState} IdentityState
 */
/**
 * @typedef {import('./identityTypes.js').LensesConfig} LensesConfig
 */

/**
 * @typedef {{ type: 'BEGIN_BLOCK'; id: string } | { type: 'COMPLETE_BLOCK'; id: string } | { type: 'RESCHEDULE_BLOCK'; id: string; start: string; end: string } | { type: 'APPLY_LENSES'; lenses: Partial<LensesConfig> } | { type: 'SET_VIEW_DATE'; date: string } | { type: 'REBALANCE_TODAY'; mode?: 'CLEAR_AFTERNOON' } | { type: 'COMPLETE_ONBOARDING'; onboarding: any } | { type: 'START_NEW_CYCLE'; payload: any } | { type: 'END_CYCLE'; cycleId: string } | { type: 'SET_ACTIVE_CYCLE'; cycleId: string } | { type: 'DELETE_CYCLE'; cycleId: string } | { type: 'HARD_DELETE_CYCLE'; cycleId: string } | { type: 'ADD_TRUTH_ENTRY'; payload: any } | { type: 'CREATE_BLOCK'; payload: any } | { type: 'UPDATE_BLOCK'; payload: any } | { type: 'DELETE_BLOCK'; id: string } | { type: 'ADD_RECURRING_PATTERN'; pattern: any } | { type: 'SET_PRIMARY_OBJECTIVE'; objectiveId: string | null } | { type: 'SET_CALIBRATION_DAYS'; daysPerWeek: number; uncertain?: boolean } | { type: 'GENERATE_PLAN' } | { type: 'APPLY_PLAN' } | { type: 'ACCEPT_SUGGESTED_BLOCK'; proposalId: string } | { type: 'REJECT_SUGGESTED_BLOCK'; proposalId: string; reason: string } | { type: 'IGNORE_SUGGESTED_BLOCK'; proposalId: string } | { type: 'DISMISS_SUGGESTED_BLOCK'; proposalId: string } | { type: 'CREATE_DELIVERABLE'; payload: any } | { type: 'UPDATE_DELIVERABLE'; payload: any } | { type: 'DELETE_DELIVERABLE'; payload: any } | { type: 'CREATE_CRITERION'; payload: any } | { type: 'TOGGLE_CRITERION_DONE'; payload: any } | { type: 'DELETE_CRITERION'; payload: any } | { type: 'LINK_BLOCK_TO_DELIVERABLE'; payload: any } | { type: 'ASSIGN_SUGGESTION_LINK'; payload: any } | { type: 'SET_STRATEGY'; payload: any } | { type: 'GENERATE_COLD_PLAN'; payload?: any } | { type: 'REBASE_COLD_PLAN'; payload?: any } | { type: 'SET_DEFINITE_GOAL'; outcome: string; deadlineDayKey: string } | { type: 'COMPILE_GOAL_EQUATION'; payload: any }} Action
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
  if (!next.executionEvents) next.executionEvents = [];
  refreshColdPlanDailyProjection(next);

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
    case 'COMPLETE_ONBOARDING':
      applyOnboardingInputs(next, action.onboarding);
      next.meta = { ...(next.meta || {}), onboardingComplete: true, scenarioLabel: action.onboarding?.scenarioLabel || next.meta?.scenarioLabel || '' };
      break;
    case 'START_NEW_CYCLE':
      startNewCycle(next, action.payload);
      break;
    case 'END_CYCLE':
      endCycle(next, action.cycleId);
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
    case 'APPLY_ONBOARDING_INPUTS':
      applyOnboardingInputs(next, action.onboarding);
      break;
    case 'CREATE_BLOCK':
      createBlock(next, action.payload);
      break;
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
    case 'GENERATE_PLAN':
      generatePlan(next);
      break;
    case 'APPLY_PLAN':
      applyGeneratedPlan(next);
      break;
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
  applyGoalDirective(next);
  applyProbabilityEligibility(next);
  applyProbabilityScoring(next);
  applyFeasibility(next);
  applyProgressCredit(next);
  next.profileLearning = computeProfileLearning(next.cyclesById);
  if (applySuggestionEventOverrides(next)) {
    next.planPreview = computePlanPreview({
      suggestedBlocks: next.suggestedBlocks,
      planDraft: next.planDraft,
      contract: next.goalExecutionContract
    });
  }
  next.correctionSignals = computeCorrectionSignals(next, 14);
  enforceSafeDefaults(next);
  persistActiveCycleState(next);
  return next;
}

export function hydrateActiveCycleState(state) {
  ensureCycleStructures(state);
  const cycle = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] : null;
  if (!cycle) return state;
  state.executionEvents = cycle.executionEvents || [];
  state.suggestionEvents = cycle.suggestionEvents || [];
  state.suggestedBlocks = cycle.suggestedBlocks || [];
  state.planDraft = cycle.planDraft || null;
  state.planCalibration = cycle.calibration || state.planCalibration || { confidence: 0, assumptions: [], missingInfo: [] };
  state.planPreview = cycle.planPreview || null;
  state.correctionSignals = cycle.correctionSignals || null;
  state.goalExecutionContract = cycle.contract || state.goalExecutionContract || null;
  state.activeGoalId = cycle.goalGovernanceContract?.goalId || state.activeGoalId || null;
  state.truthEntries = cycle.truthEntries || state.truthEntries || [];
  state.suggestionHistory = cycle.suggestionHistory || state.suggestionHistory || null;
  return state;
}

export function persistActiveCycleState(state) {
  ensureCycleStructures(state);
  const cycle = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] : null;
  if (!cycle) return state;
  cycle.executionEvents = state.executionEvents || [];
  cycle.suggestionEvents = state.suggestionEvents || [];
  cycle.suggestedBlocks = state.suggestedBlocks || [];
  cycle.planDraft = state.planDraft || null;
  cycle.calibration = state.planCalibration || null;
  cycle.planPreview = state.planPreview || null;
  cycle.correctionSignals = state.correctionSignals || null;
  cycle.contract = state.goalExecutionContract || cycle.contract || null;
  cycle.truthEntries = state.truthEntries || cycle.truthEntries || [];
  cycle.suggestionHistory = state.suggestionHistory || cycle.suggestionHistory || null;
  state.cyclesById[state.activeCycleId] = cycle;
  return state;
}

function collectGovernanceContracts(state) {
  if (state.activeCycleId && state.cyclesById?.[state.activeCycleId]?.goalGovernanceContract) {
    return [state.cyclesById[state.activeCycleId].goalGovernanceContract];
  }
  return Object.values(state.cyclesById || {})
    .map((cycle) => cycle?.goalGovernanceContract)
    .filter(Boolean);
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
  if (typeof state.activeCycleId === 'undefined') state.activeCycleId = null;
}

function ensureAdmissionStores(state) {
  if (!state.goalAdmissionByGoal) state.goalAdmissionByGoal = {};
  if (!state.aspirationsByCycleId) state.aspirationsByCycleId = {};
  if (!('lastPlanError' in state)) state.lastPlanError = null;
}

function ensureDeliverablesStore(state) {
  if (!state.deliverablesByCycleId) state.deliverablesByCycleId = {};
}

function getActiveCycle(state) {
  return state.activeCycleId ? state.cyclesById?.[state.activeCycleId] : null;
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

function generateColdPlanForCycle(state, { rebaseMode = 'NONE' } = {}) {
  const cycle = getActiveCycle(state);
  if (!cycle) return;
  const timeZone = state.appTime?.timeZone || cycle.strategy?.constraints?.tz;
  if (!cycle.strategy) {
    const goalId = cycle.goalContract?.goalId || cycle.contract?.goalId || state.activeGoalId || 'goal';
    const deadlineISO = cycle.goalContract?.deadlineISO || cycle.definiteGoal?.deadlineDayKey || '';
    const deliverables = normalizeDeliverables(cycle.strategy?.deliverables || []);
    cycle.strategy = buildDefaultStrategy({ goalId, deadlineISO, timeZone, deliverables });
  }
  const nowISO = state.appTime?.nowISO || '';
  const startDayKey = cycle.startedAtDayKey || dayKeyFromISO(nowISO, timeZone);
  const startISO = buildLocalStartISO(startDayKey, '00:00', timeZone);
  const deadlineKey = cycle.definiteGoal?.deadlineDayKey || cycle.strategy?.deadlineISO?.slice(0, 10);
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
  const nextPlan = generateColdPlan({
    cycleStartISO: startISO?.startISO || `${startDayKey}T00:00:00.000Z`,
    nowISO,
    strategy,
    completedCountToDate,
    rebaseMode
  });
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
  if (!state.planCalibration) state.planCalibration = { confidence: 0, assumptions: [], missingInfo: [] };
  if (!('planPreview' in state)) state.planPreview = null;
  if (!('correctionSignals' in state)) state.correctionSignals = null;
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
    const constraints = {
      timezone,
      maxBlocksPerDay: state?.constraints?.maxBlocksPerDay,
      maxBlocksPerWeek: state?.constraints?.maxBlocksPerWeek,
      workableDayPolicy: state?.constraints?.workableDayPolicy,
      blackoutDates: state?.constraints?.blackoutDates,
      dailyCapacityOverrides: state?.constraints?.dailyCapacityOverrides,
      calendarCommittedBlocksByDate: state?.constraints?.calendarCommittedBlocksByDate,
      scoringWindowDays: state?.constraints?.scoringWindowDays
    };
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
    const constraints = {
      timezone,
      maxBlocksPerDay: state?.constraints?.maxBlocksPerDay ?? 4,
      workableDayPolicy: state?.constraints?.workableDayPolicy,
      blackoutDates: state?.constraints?.blackoutDates,
      dailyCapacityOverrides: state?.constraints?.dailyCapacityOverrides,
      calendarCommittedBlocksByDate: state?.constraints?.calendarCommittedBlocksByDate
    };
    const deadlineISO = resolveGoalDeadline(goalId, state) || nowISO;
    feasibilityByGoal[goalId] = computeFeasibility({ goalId, deadlineISO }, state, constraints, nowISO);
  });
  state.feasibilityByGoal = feasibilityByGoal;
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
  if (state.activeCycleId && state.cyclesById?.[state.activeCycleId]) {
    const active = state.cyclesById[state.activeCycleId];
    if (active?.goalGovernanceContract?.goalId === goalId) {
      return active?.definiteGoal?.deadlineDayKey || null;
    }
  }
  const cycles = Object.values(state?.cyclesById || {});
  const match = cycles.find((cycle) => cycle?.goalGovernanceContract?.goalId === goalId);
  return match?.definiteGoal?.deadlineDayKey || null;
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

function computePlanPreview({ suggestedBlocks = [], planDraft = null, contract = null } = {}) {
  const onlySuggested = (suggestedBlocks || []).filter((s) => s && s.status === 'suggested');
  const totalBlocks = onlySuggested.length;
  const totalMinutes = onlySuggested.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  return {
    totalBlocks,
    totalMinutes,
    primaryDomain: planDraft?.primaryDomain,
    horizonDays: contract?.horizonDays
  };
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
  const suggestions = state.suggestedBlocks || [];
  const events = state.suggestionEvents || [];
  if (!suggestions.length || !events.length) return false;
  const next = rehydrateSuggestionOverrides(suggestions, events);
  const changed = next.some((entry, idx) => entry.status !== suggestions[idx]?.status || entry.rejectedReason !== suggestions[idx]?.rejectedReason);
  if (changed) state.suggestedBlocks = next;
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

function applyOnboardingInputs(state, onboarding = {}) {
  const focusAreas = normalizeFocusAreas(onboarding.focusAreas);
  const pattern = derivePatternFromGoal({ ...onboarding, focusAreas });
  const goalText = (onboarding.goalText || onboarding.direction || state.vector.direction || '').trim();
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
      domainsAllowed: ['Body', 'Focus', 'Creation', 'Resources'],
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
    daysPerWeek
  };

  const suggested = buildSuggestedBlocks({
    goalId,
    startDayKey,
    blocksPerWeek,
    templates,
    daysPerWeek,
    goalText,
    primaryDomain,
    timeZone: state.appTime?.timeZone
  });
  state.suggestedBlocks = suggested;
  state.suggestionEvents = state.suggestionEvents || [];
  suggested.forEach((s) => {
    state.suggestionEvents.push({
      id: `sev-${s.id}`,
      type: 'suggested_block_created',
      proposalId: s.id,
      goalId,
      atISO: s.createdAtISO
    });
  });

  state.planCalibration = {
    confidence: parseMinimumDays(onboarding.minimumDaysPerWeek) ? 0.45 : 0.3,
    daysPerWeek,
    assumptions: [`Assuming ${daysPerWeek} days/week execution.`, `Default capacity ${blocksPerWeek} blocks/week.`],
    missingInfo: parseMinimumDays(onboarding.minimumDaysPerWeek) ? [] : ['daysPerWeek']
  };
  state.planPreview = computePlanPreview({
    suggestedBlocks: state.suggestedBlocks,
    planDraft: state.planDraft,
    contract: state.goalExecutionContract
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
  const goalText = (payload.goalText || state.goalExecutionContract?.goalText || state.vector?.direction || '').trim();
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

  if (current && current.status === 'active') {
    endCycle(state, current.id);
    const ended = state.cyclesById[current.id];
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

  const goalContract = {
    goalId,
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
      domainsAllowed: ['Body', 'Focus', 'Creation', 'Resources'],
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
    daysPerWeek
  };

  const suggested = buildSuggestedBlocks({
    goalId,
    startDayKey,
    blocksPerWeek,
    templates,
    daysPerWeek,
    goalText,
    primaryDomain,
    timeZone: state.appTime?.timeZone
  });
  state.suggestedBlocks = suggested;
  state.suggestionEvents = [];
  suggested.forEach((s) => {
    state.suggestionEvents.push({
      id: `sev-${s.id}`,
      type: 'suggested_block_created',
      proposalId: s.id,
      goalId,
      atISO: s.createdAtISO
    });
  });

  state.planCalibration = {
    confidence: 0.3,
    daysPerWeek,
    assumptions: [`Assuming ${daysPerWeek} days/week execution.`, `Default capacity ${blocksPerWeek} blocks/week.`],
    missingInfo: ['daysPerWeek']
  };
  state.planPreview = computePlanPreview({
    suggestedBlocks: state.suggestedBlocks,
    planDraft: state.planDraft,
    contract: state.goalExecutionContract
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
  state.cyclesById[newCycleId].suggestedBlocks = state.suggestedBlocks;
  state.cyclesById[newCycleId].suggestionEvents = state.suggestionEvents;
  state.cyclesById[newCycleId].executionEvents = state.executionEvents;
  state.cyclesById[newCycleId].contract = state.goalExecutionContract;
  state.cyclesById[newCycleId].suggestionHistory = state.suggestionHistory;

  generateColdPlanForCycle(state, { rebaseMode: 'NONE' });
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

function deleteCycle(state, cycleId) {
  ensureCycleStructures(state);
  if (!cycleId || !state.cyclesById?.[cycleId]) return;
  // Allow deleting active cycle: clear active UI state and unset activeCycleId
  if (state.activeCycleId === cycleId) {
    state.activeCycleId = null;
    // Clear active projections shown in UI
    state.today = { ...(state.today || {}), blocks: [] };
    state.currentWeek = { ...(state.currentWeek || {}), days: [] };
    state.cycle = [];
    state.suggestedBlocks = [];
    state.suggestionEvents = [];
    state.executionEvents = [];
    state.suggestionHistory = { dayKey: state.appTime?.activeDayKey || nowDayKey(), count: 0, lastSuggestedAtISO: null, lastSuggestedAtISOByGoal: {}, dailyCountByGoal: {}, denials: [] };
  }
  const cycle = state.cyclesById[cycleId];
  cycle.status = 'deleted';
  cycle.executionEvents = [];
  cycle.suggestionEvents = [];
  cycle.suggestedBlocks = [];
  cycle.planDraft = null;
  cycle.planPreview = null;
  cycle.correctionSignals = null;
  cycle.truthEntries = [];
  cycle.suggestionHistory = null;
  state.cyclesById[cycleId] = cycle;
  if (state.deliverablesByCycleId?.[cycleId]) {
    delete state.deliverablesByCycleId[cycleId];
  }
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
    state.suggestedBlocks = [];
    state.suggestionEvents = [];
    state.executionEvents = [];
    state.suggestionHistory = { dayKey: state.appTime?.activeDayKey || nowDayKey(), count: 0, lastSuggestedAtISO: null, lastSuggestedAtISOByGoal: {}, dailyCountByGoal: {}, denials: [] };
  }
  delete state.cyclesById[cycleId];
  if (state.deliverablesByCycleId?.[cycleId]) {
    delete state.deliverablesByCycleId[cycleId];
  }
  if (state.history?.cycles) {
    state.history.cycles = state.history.cycles.filter((c) => c.id !== cycleId);
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
  state.cyclesById[id] = cycle;
  // Archive behavior: remove from active execution and clear active UI projections
  if (state.activeCycleId === id) {
    state.activeCycleId = null;
    state.today = { ...(state.today || {}), blocks: [] };
    state.currentWeek = { ...(state.currentWeek || {}), days: [] };
    state.cycle = [];
    state.suggestedBlocks = [];
    state.suggestionEvents = [];
    state.executionEvents = [];
  }
}

function generatePlan(state) {
  const contract = state.goalExecutionContract;
  const plan = state.planDraft;
  const cycle = getActiveCycle(state);
  if (!cycle || !contract) return;
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
  const startDayKey = contract.startDayKey || state.appTime?.activeDayKey || nowDayKey();
  const preserved = (state.suggestedBlocks || []).filter((s) => s && s.status !== 'suggested');
  const reservedIds = new Set(preserved.map((s) => s.id));
  const timeZone = state.appTime?.timeZone || 'UTC';
  const nowISO = state.appTime?.nowISO || new Date().toISOString();
  const planProof =
    cycle.planProof ||
    (cycle.goalEquation ? derivePlanProof(cycle.goalEquation, { nowDayKey: startDayKey, timeZone }) : null);
  if (planProof) {
    cycle.planProof = planProof;
    const constraints = {
      timezone: timeZone,
      maxBlocksPerDay: state?.constraints?.maxBlocksPerDay,
      maxBlocksPerWeek: state?.constraints?.maxBlocksPerWeek,
      workableDayPolicy: state?.constraints?.workableDayPolicy,
      blackoutDates: state?.constraints?.blackoutDates,
      calendarCommittedBlocksByDate: state?.constraints?.calendarCommittedBlocksByDate
    };
    const horizonEnd = addDays(startDayKey, 13, timeZone);
    const { days } = materializeBlocksFromEvents(state.executionEvents || [], { todayISO: state.today?.date });
    const acceptedBlocks = (days || [])
      .filter((d) => d?.date && d.date >= startDayKey && d.date <= horizonEnd)
      .flatMap((d) => (d.blocks || []).filter((b) => b?.cycleId === cycle.id));
    cycle.autoAsanaPlan = compileAutoAsanaPlan({
      goalId: contract.goalId,
      cycleId: cycle.id,
      planProof,
      constraints,
      nowISO,
      horizonDays: 14,
      acceptedBlocks
    });
  }

  const suggestions = buildSuggestedBlocks({
    goalId: contract.goalId,
    startDayKey,
    blocksPerWeek: plan?.blocksPerWeek || 6,
    templates: plan?.templates || [],
    daysPerWeek: plan?.daysPerWeek || 4,
    goalText: contract.goalText,
    primaryDomain: plan?.primaryDomain || 'FOCUS',
    reservedIds,
    timeZone
  });
  state.suggestedBlocks = [...preserved, ...suggestions];
  state.suggestionEvents = state.suggestionEvents || [];
  state.suggestionEvents.push({
    id: `sev-suggestions-${contract.goalId}-${Date.now()}`,
    type: 'suggestions_generated',
    proposalIds: suggestions.map((s) => s.id),
    goalId: contract.goalId,
    atISO: nowISO
  });
  state.planPreview = computePlanPreview({
    suggestedBlocks: state.suggestedBlocks,
    planDraft: state.planDraft,
    contract: state.goalExecutionContract
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
    id: `plan-applied-${cycle.id}-${Date.now()}`,
    type: 'PLAN_APPLIED',
    cycleId: cycle.id,
    goalId: contract.goalId,
    atISO: nowISO,
    policyVersion: plan.audit?.policyVersion || 'auto_asana_v1'
  });
  cycle.lastPlanAppliedAtISO = nowISO;
  state.cyclesById[cycle.id] = cycle;
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
      aspirationId: `asp-${cycle.id}-${Date.now()}`,
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
  const suggestions = state.suggestedBlocks || [];
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
    suggestedBlocks: state.suggestedBlocks,
    planDraft: state.planDraft,
    contract: state.goalExecutionContract
  });
}

function applyCalibrationDays(state, daysPerWeek, uncertain = false) {
  const parsed = Number.parseInt(daysPerWeek, 10);
  if (!Number.isFinite(parsed) || parsed < 3 || parsed > 7) return;
  const plan = state.planDraft;
  const contract = state.goalExecutionContract;
  if (!plan || !contract) return;
  if (plan.status === 'calibrated' && plan.daysPerWeek === parsed) return;
  const prevSuggestionIds = (state.suggestedBlocks || [])
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

  const preserved = (state.suggestedBlocks || []).filter((s) => s && s.status !== 'suggested');
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
  state.suggestedBlocks = [...preserved, ...nextSuggested];

  const nowISO = new Date().toISOString();
  state.suggestionEvents = state.suggestionEvents || [];
  state.suggestionEvents.push({
    id: `sev-recompute-${contract.goalId}-${Date.now()}`,
    type: 'suggestions_recomputed',
    reason: 'capacity_calibration',
    prevSuggestionIds,
    nextSuggestionIds: nextSuggested.map((s) => s.id),
    atISO: nowISO
  });

  state.planPreview = computePlanPreview({
    suggestedBlocks: state.suggestedBlocks,
    planDraft: state.planDraft,
    contract: state.goalExecutionContract
  });

  state.calibrationEvents = state.calibrationEvents || [];
  state.calibrationEvents.push({
    id: `cal-${contract.goalId}-${Date.now()}`,
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
  const suggestions = state.suggestedBlocks || [];
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
    suggestedBlocks: state.suggestedBlocks,
    planDraft: state.planDraft,
    contract: state.goalExecutionContract
  });
}

function ignoreSuggestedBlock(state, proposalId) {
  if (!proposalId) return;
  const suggestions = state.suggestedBlocks || [];
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
    suggestedBlocks: state.suggestedBlocks,
    planDraft: state.planDraft,
    contract: state.goalExecutionContract
  });
}

function dismissSuggestedBlock(state, proposalId) {
  if (!proposalId) return;
  const suggestions = state.suggestedBlocks || [];
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
    suggestedBlocks: state.suggestedBlocks,
    planDraft: state.planDraft,
    contract: state.goalExecutionContract
  });
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
    id: payload.id || `blk-${Date.now()}`,
    cycleId,
    goalId,
    origin,
    suggestionId: payload.suggestionId || null,
    deliverableId,
    criterionId,
    lockedUntilDayKey,
    practice,
    domain,
    label: payload.label || payload.title || practice || 'Block',
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    status,
    optional: payload.optional || false,
    objectiveId: payload.objectiveId || state.today?.primaryObjectiveId || null
  };

  const event = buildExecutionEventFromBlock(newBlock, {
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
