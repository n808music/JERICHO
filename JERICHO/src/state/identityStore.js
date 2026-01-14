import React, { createContext, useContext, useReducer, useCallback } from 'react';
import structuredClone from '@ungap/structured-clone';
import { computeDerivedState } from './identityCompute.js';
import { canEmitExecutionEvent } from './engine/executionContract.ts';
import { appendExecutionEvent, buildExecutionEventFromBlock } from './engine/todayAuthority.ts';
import { addDays, dayKeyFromDate, dayKeyFromISO, nowDayKey } from './time/time.ts';
import { assertEngineAuthority } from './invariants/engineAuthority.ts';
import { validateGoalAdmission } from '../domain/goal/GoalAdmissionPolicy.ts';
import { GoalRejectionCode } from '../domain/goal/GoalRejectionCode.ts';
import { buildAutoDeliverablesFromGoalContract, detectCompoundGoal } from '../domain/autoStrategy.ts';

const STATE_VERSION = '1.0.0';

const IdentityContext = createContext(null);

const seedState = buildInitialIdentityState();

function buildInitialIdentityState() {
  const persisted = loadPersisted();
  if (persisted && persisted.meta?.version === STATE_VERSION) {
    const withTemplates = ensureTemplates(persisted);
    const hydrated = computeDerivedState(withTemplates, {
      type: 'SET_VIEW_DATE',
      date: withTemplates.viewDate || withTemplates.today?.date || withTemplates.cycle?.[0]?.date
    });
    persistState(hydrated);
    return hydrated;
  }

  const todayDate = '2025-12-09';
  const deviceTimeZone =
    typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';
  const nowISO = new Date().toISOString();
  const activeDayKey = dayKeyFromISO(nowISO, deviceTimeZone);
  const blocks = [
    {
      id: 'b1',
      practice: 'Creation',
      label: 'Assign capabilities',
      start: `${todayDate}T09:00:00.000Z`,
      end: `${todayDate}T10:30:00.000Z`,
      status: 'in_progress'
    },
    {
      id: 'b2',
      practice: 'Focus',
      label: 'Pipeline build',
      start: `${todayDate}T11:00:00.000Z`,
      end: `${todayDate}T12:00:00.000Z`,
      status: 'planned'
    }
  ];

  const vector = {
    day: 6,
    direction: 'Grow revenue to $10k/month',
    stability: 'steady',
    drift: 'contained',
    momentum: 'active'
  };

  const lenses = {
    aim: { description: 'Grow revenue to $10k/month', horizon: '90d' },
    pattern: {
      routines: { Body: [], Resources: [], Creation: [], Focus: [] },
      dailyTargets: [
        { name: 'Body', minutes: 30 },
        { name: 'Resources', minutes: 45 },
        { name: 'Creation', minutes: 120 },
        { name: 'Focus', minutes: 60 }
      ],
      defaultMinutes: 30
    },
    flow: { streams: ['Client work', 'Content', 'Pipeline'] }
  };

  const practices = buildPracticesFromTargets(lenses.pattern.dailyTargets);
  const contractDeadline = addDays(todayDate, 30);
  const goalContract = {
    goalId: 'goal-1',
    status: 'active',
    activationDateISO: todayDate,
    deadlineISO: contractDeadline,
    success: [
      {
        metricType: 'threshold',
        metricName: 'revenue',
        targetValue: 10000,
        validationMethod: 'user_attest'
      }
    ],
    requirements: {
      requiredDomains: ['Body', 'Focus', 'Creation', 'Resources'],
      minimumCadencePerDomain: {
        Body: 2,
        Focus: 3,
        Creation: 4,
        Resources: 1
      },
      expectedDomainMix: {
        Body: 0.2,
        Focus: 0.3,
        Creation: 0.4,
        Resources: 0.1
      },
      maxAllowedVariance: 0.2
    }
  };
  const goalGovernanceContract = {
    contractId: 'gov-1',
    version: 1,
    goalId: 'goal-1',
    activeFromISO: todayDate,
    activeUntilISO: contractDeadline,
    scope: {
      domainsAllowed: ['Body', 'Focus', 'Creation', 'Resources'],
      timeHorizon: 'week',
      timezone: 'America/Chicago'
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
  const goalWorkById = {
    'goal-1': [
      {
        workItemId: 'goal-1-body',
        title: 'Body base',
        blocksRemaining: 4,
        category: 'Body',
        focusMode: 'shallow',
        energyCost: 'medium',
        producesOutput: false,
        unblockType: null,
        dependencies: []
      },
      {
        workItemId: 'goal-1-creation',
        title: 'Creation output',
        blocksRemaining: 6,
        category: 'Creation',
        focusMode: 'deep',
        energyCost: 'high',
        producesOutput: true,
        unblockType: null,
        dependencies: []
      },
      {
        workItemId: 'goal-1-focus',
        title: 'Focus block',
        blocksRemaining: 4,
        category: 'Focus',
        focusMode: 'deep',
        energyCost: 'medium',
        producesOutput: false,
        unblockType: null,
        dependencies: []
      }
    ]
  };

  const today = {
    date: todayDate,
    blocks,
    completionRate: 0,
    driftSignal: 'forming',
    loadByPractice: { Body: 30, Resources: 45, Creation: 90, Focus: 60 },
    practices
  };

  const weekDays = Array.from({ length: 7 }).map((_, idx) => ({
    date: `2025-12-0${idx + 8}`,
    blocks: idx === 1 ? blocks : [],
    completionRate: idx === 1 ? 0.5 : 0,
    driftSignal: idx === 1 ? 'forming' : 'contained',
    loadByPractice: { Body: 0, Resources: 0, Creation: idx === 1 ? 90 : 0, Focus: idx === 1 ? 60 : 0 },
    practices
  }));

  let initialState = {
    vector,
    lenses,
    activeCycleId: 'cycle-1',
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        startedAtDayKey: todayDate,
        definiteGoal: { outcome: 'Grow revenue to $10k/month', deadlineDayKey: contractDeadline },
        goalContract,
        goalGovernanceContract,
        contract: null,
        aim: { text: lenses.aim.description },
        pattern: { dailyTargets: lenses.pattern.dailyTargets },
        flow: lenses.flow,
        executionEvents: [],
        suggestionEvents: [],
        suggestedBlocks: [],
        truthEntries: [],
        suggestionHistory: {
          dayKey: todayDate,
          count: 0,
          lastSuggestedAtISO: null,
          lastSuggestedAtISOByGoal: {},
          dailyCountByGoal: {},
          denials: []
        }
      }
    },
    deliverablesByCycleId: {
      'cycle-1': {
        cycleId: 'cycle-1',
        deliverables: [],
        suggestionLinks: {},
        lastUpdatedAtISO: nowISO
      }
    },
    goalAdmissionByGoal: {},
    aspirationsByCycleId: { 'cycle-1': [] },
    lastPlanError: null,
    history: { cycles: [] },
    today,
    currentWeek: { weekStart: '2025-12-08', days: weekDays },
    cycle: weekDays,
    viewDate: todayDate,
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    profileLearning: { cycleCount: 0, totalCompletionCount: 0, averageCompletionRate: 0 },
    meta: {
      version: STATE_VERSION,
      onboardingComplete: false,
      lastActiveDate: todayDate,
      scenarioLabel: '',
      demoScenarioEnabled: false,
      showHints: false
    },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    ledger: [],
    executionEvents: [],
    truthEntries: [],
    suggestionHistory: {
      dayKey: todayDate,
      count: 0,
      lastSuggestedAtISO: null,
      lastSuggestedAtISOByGoal: {},
      dailyCountByGoal: {},
      denials: []
    },
    suggestionEligibility: {},
    directiveEligibilityByGoal: {},
    goalDirective: null,
    goalWorkById,
    activeGoalId: goalGovernanceContract.goalId
  };
  initialState.appTime = {
    timeZone: deviceTimeZone,
    nowISO,
    activeDayKey,
    isFollowingNow: true
  };
  initialState.constraints = {
    maxBlocksPerDay: 4,
    workableDayPolicy: { weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] }
  };
  initialState = computeDerivedState(initialState, { type: 'SET_VIEW_DATE', date: todayDate });
  persistState(initialState);
  return initialState;
}

function buildPracticesFromTargets(targets = []) {
  return targets.map((t) => {
    const load = t.minutes <= 30 ? 'light' : t.minutes <= 90 ? 'moderate' : 'heavy';
    return { name: t.name, load, trend: 'holding' };
  });
}

function ensureCycleStructures(state) {
  if (!state.history) state.history = { cycles: [] };
  if (!state.cyclesById) state.cyclesById = {};
  if (typeof state.activeCycleId === 'undefined') state.activeCycleId = null;
  if (!state.cycleOrder) state.cycleOrder = Object.keys(state.cyclesById || {});
  if (!state.aspirations) state.aspirations = [];
}

function sanitizeTargets(dailyTargets = []) {
  const map = {
    Body: 0,
    Resources: 0,
    Creation: 0,
    Focus: 0
  };
  dailyTargets.forEach((t) => {
    if (!t?.name) return;
    const key = t.name;
    if (map[key] === undefined) return;
    const val = Number(t.minutes);
    map[key] = Number.isFinite(val) && val >= 0 ? val : 0;
  });
  return Object.entries(map).map(([name, minutes]) => ({ name, minutes }));
}

function applySetDefiniteGoal(state, action) {
  const outcome = (action.outcome || '').trim();
  const deadlineDayKey = (action.deadlineDayKey || '').slice(0, 10);
  if (!outcome || !deadlineDayKey) return;
  ensureCycleStructures(state);
  const current = state.activeCycleId ? state.cyclesById[state.activeCycleId] : null;
  if (!current) return;
  current.definiteGoal = { outcome, deadlineDayKey };
  if (current.goalGovernanceContract) {
    current.goalGovernanceContract.activeUntilISO = deadlineDayKey;
  }
  if (state.goalExecutionContract) {
    state.goalExecutionContract.goalText = outcome;
    state.goalExecutionContract.endDayKey = deadlineDayKey;
    current.contract = state.goalExecutionContract;
  }
}

function applySetAim(state, action) {
  ensureCycleStructures(state);
  if (!state.activeCycleId) {
    // if no cycle, create minimal one
    applySetDefiniteGoal(state, {
      outcome: state.vector?.direction || 'Definite goal',
      deadlineDayKey: nowDayKey()
    });
  }
  if (!state.activeCycleId) return;
  const cycle = state.cyclesById[state.activeCycleId];
  cycle.aim = { text: action.text || '' };
  if (state.lenses) {
    state.lenses.aim = { ...(state.lenses.aim || {}), description: action.text || '' };
  }
}

function applySetPatternTargets(state, action) {
  ensureCycleStructures(state);
  if (!state.activeCycleId) {
    applySetDefiniteGoal(state, {
      outcome: state.vector?.direction || 'Definite goal',
      deadlineDayKey: nowDayKey()
    });
  }
  if (!state.activeCycleId) return;
  const sanitized = sanitizeTargets(action.dailyTargets || []);
  const cycle = state.cyclesById[state.activeCycleId];
  cycle.pattern = { dailyTargets: sanitized };
  if (state.lenses) {
    state.lenses.pattern = { ...(state.lenses.pattern || {}), dailyTargets: sanitized };
  }
}

function identityReducer(state, action) {
  if (action.type === 'RESET_IDENTITY') {
    return buildInitialIdentityState();
  }

  if (action.type === 'SET_DEFINITE_GOAL') {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    applySetDefiniteGoal(draft, action);
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  if (action.type === 'SET_AIM') {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    applySetAim(draft, action);
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  if (action.type === 'SET_PATTERN_TARGETS') {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    applySetPatternTargets(draft, action);
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  if (action.type === 'SET_ACTIVE_DAY_KEY') {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    const dayKey = action.dayKey || draft.appTime?.activeDayKey || nowDayKey();
    draft.appTime = {
      ...(draft.appTime || {}),
      activeDayKey: dayKey,
      isFollowingNow: false
    };
    draft.viewDate = dayKey;
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  if (action.type === 'JUMP_TO_TODAY') {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    const timeZone = draft.appTime?.timeZone || 'UTC';
    const nowISO = draft.appTime?.nowISO || new Date().toISOString();
    const activeDayKey = dayKeyFromISO(nowISO, timeZone);
    draft.appTime = {
      ...(draft.appTime || {}),
      nowISO,
      activeDayKey,
      isFollowingNow: true
    };
    draft.viewDate = activeDayKey;
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  if (action.type === 'TICK_NOW') {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    const timeZone = draft.appTime?.timeZone || 'UTC';
    const nowISO = action.nowISO || new Date().toISOString();
    const activeDayKey = draft.appTime?.isFollowingNow ? dayKeyFromISO(nowISO, timeZone) : draft.appTime?.activeDayKey;
    draft.appTime = {
      ...(draft.appTime || {}),
      nowISO,
      activeDayKey: activeDayKey || draft.appTime?.activeDayKey || nowDayKey()
    };
    if (draft.appTime.isFollowingNow && draft.appTime.activeDayKey) {
      draft.viewDate = draft.appTime.activeDayKey;
    }
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  // Handle completion in the reducer to keep ledger append single-source
  if (action.type === 'COMPLETE_BLOCK') {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    draft.ledger = draft.ledger || [];
    const { found, changed } = markCompletedAcrossProjections(draft, action.id);
    if (!changed) return state;
    const alreadyLogged = draft.ledger.some((entry) => entry.blockId === action.id);
    if (!alreadyLogged && found) {
      const rawStart = Date.parse(found.start);
      const rawEnd = Date.parse(found.end);
      const raw = (rawEnd - rawStart) / 60000;
      const plannedMinutes = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
      // UI uses a 24h column; clamp plannedMinutes to 1440 to keep metrics/layout bounded.
      const plannedMinutesClamped = Math.min(plannedMinutes, 24 * 60);
      const todayDate = nowDayKey();
      const eventDate =
        Number.isFinite(rawStart) && rawStart
          ? dayKeyFromDate(new Date(rawStart))
          : found.date || todayDate;
      const event = buildExecutionEventFromBlock(found, {
        blockId: action.id,
        dateISO: eventDate,
        minutes: plannedMinutesClamped,
        completed: true,
        kind: 'complete'
      });
      const existingBlockIds = found ? new Set([action.id]) : undefined;
      if (!canEmitExecutionEvent(draft.executionEvents || [], event, { existingBlockIds })) return state;
      draft.ledger.push({
        eventId: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        blockId: action.id,
        date: eventDate,
        plannedMinutes: plannedMinutesClamped,
        completedMinutes: plannedMinutesClamped,
        completedAt: new Date().toISOString(),
        practice: found.practice,
        label: found.label
      });
      appendExecutionEvent(draft, event);
    }
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  if (action.type === 'APPLY_NEXT_STATE') {
    // Replace state with provided nextState (already derived by pure admission reducer)
    return computeDerivedState(action.nextState || state, { type: 'NO_OP' });
  }

  return computeDerivedState(state, action);
}

export function IdentityProvider({ children, initialState }) {
  const [state, dispatch] = useReducer(identityReducer, initialState || seedState);
  const [activePractice, setActivePractice] = React.useState(null);
  const [activeLens, setActiveLens] = React.useState(null);

  if (process.env.NODE_ENV !== 'production') {
    assertEngineAuthority(state);
  }

  const beginBlock = useCallback((id) => dispatch({ type: 'BEGIN_BLOCK', id }), []);
  const completeBlock = useCallback((id) => dispatch({ type: 'COMPLETE_BLOCK', id }), []);
  const rescheduleBlock = useCallback((id, start, end) => dispatch({ type: 'RESCHEDULE_BLOCK', id, start, end }), []);
  const applyLenses = useCallback((lenses) => dispatch({ type: 'APPLY_LENSES', lenses }), []);
  const setDefiniteGoal = useCallback((payload) => dispatch({ type: 'SET_DEFINITE_GOAL', ...payload }), []);
  const setAim = useCallback((payload) => dispatch({ type: 'SET_AIM', ...payload }), []);
  const setPatternTargets = useCallback((payload) => dispatch({ type: 'SET_PATTERN_TARGETS', ...payload }), []);
  const setViewDate = useCallback((date) => dispatch({ type: 'SET_VIEW_DATE', date }), []);
  const highlightPractice = useCallback((practice) => setActivePractice(practice), []);
  const openLens = useCallback((lens) => setActiveLens(lens), []);
  const rebalanceToday = useCallback((mode) => dispatch({ type: 'REBALANCE_TODAY', mode }), []);
  const completeOnboarding = useCallback((onboarding) => dispatch({ type: 'COMPLETE_ONBOARDING', onboarding }), []);
  const applyOnboardingInputs = useCallback((onboarding) => dispatch({ type: 'APPLY_ONBOARDING_INPUTS', onboarding }), []);
  const startNewCycle = useCallback((payload) => dispatch({ type: 'START_NEW_CYCLE', payload }), []);
  const endCycle = useCallback((cycleId) => dispatch({ type: 'END_CYCLE', cycleId }), []);
  const archiveAndCloneCycle = useCallback((cycleId, overrides = {}) => dispatch({ type: 'ARCHIVE_AND_CLONE_CYCLE', cycleId, overrides }), []);
  const setActiveCycle = useCallback((cycleId) => dispatch({ type: 'SET_ACTIVE_CYCLE', cycleId }), []);
  const deleteCycle = useCallback((cycleId) => dispatch({ type: 'DELETE_CYCLE', cycleId }), []);
  const hardDeleteCycle = useCallback((cycleId) => dispatch({ type: 'HARD_DELETE_CYCLE', cycleId }), []);
  const addTruthEntry = useCallback((payload) => dispatch({ type: 'ADD_TRUTH_ENTRY', payload }), []);
  const createBlock = useCallback((payload) => dispatch({ type: 'CREATE_BLOCK', payload }), []);
  const updateBlock = useCallback((payload) => dispatch({ type: 'UPDATE_BLOCK', payload }), []);
  const deleteBlock = useCallback((id) => dispatch({ type: 'DELETE_BLOCK', id }), []);
  const setActiveDayKey = useCallback((dayKey) => dispatch({ type: 'SET_ACTIVE_DAY_KEY', dayKey }), []);
  const jumpToToday = useCallback(() => dispatch({ type: 'JUMP_TO_TODAY' }), []);
  const tickNow = useCallback((nowISO) => dispatch({ type: 'TICK_NOW', nowISO }), []);
  const addRecurringPattern = useCallback((pattern) => dispatch({ type: 'ADD_RECURRING_PATTERN', pattern }), []);
  const setPrimaryObjective = useCallback((objectiveId) => dispatch({ type: 'SET_PRIMARY_OBJECTIVE', objectiveId }), []);
  const applyNextSuggestion = useCallback(() => dispatch({ type: 'APPLY_NEXT_SUGGESTION' }), []);
  const setCalibrationDays = useCallback(
    (daysPerWeek, uncertain = false) => dispatch({ type: 'SET_CALIBRATION_DAYS', daysPerWeek, uncertain }),
    []
  );
  const generatePlan = useCallback(() => dispatch({ type: 'GENERATE_PLAN' }), []);
  const applyPlan = useCallback(() => dispatch({ type: 'APPLY_PLAN' }), []);
  const setStrategy = useCallback((payload) => dispatch({ type: 'SET_STRATEGY', payload }), []);
  const generateColdPlan = useCallback(() => dispatch({ type: 'GENERATE_COLD_PLAN' }), []);
  const rebaseColdPlan = useCallback(() => dispatch({ type: 'REBASE_COLD_PLAN' }), []);
  const acceptSuggestedBlock = useCallback((proposalId) => dispatch({ type: 'ACCEPT_SUGGESTED_BLOCK', proposalId }), []);
  const rejectSuggestedBlock = useCallback(
    (proposalId, reason) => dispatch({ type: 'REJECT_SUGGESTED_BLOCK', proposalId, reason }),
    []
  );
  const ignoreSuggestedBlock = useCallback((proposalId) => dispatch({ type: 'IGNORE_SUGGESTED_BLOCK', proposalId }), []);
  const dismissSuggestedBlock = useCallback((proposalId) => dispatch({ type: 'DISMISS_SUGGESTED_BLOCK', proposalId }), []);
  const createDeliverable = useCallback(
    (payload) => dispatch({ type: 'CREATE_DELIVERABLE', payload }),
    []
  );
  const updateDeliverable = useCallback(
    (payload) => dispatch({ type: 'UPDATE_DELIVERABLE', payload }),
    []
  );
  const deleteDeliverable = useCallback(
    (payload) => dispatch({ type: 'DELETE_DELIVERABLE', payload }),
    []
  );
  const createCriterion = useCallback(
    (payload) => dispatch({ type: 'CREATE_CRITERION', payload }),
    []
  );
  const toggleCriterionDone = useCallback(
    (payload) => dispatch({ type: 'TOGGLE_CRITERION_DONE', payload }),
    []
  );
  const deleteCriterion = useCallback(
    (payload) => dispatch({ type: 'DELETE_CRITERION', payload }),
    []
  );
  const linkBlockToDeliverable = useCallback(
    (payload) => dispatch({ type: 'LINK_BLOCK_TO_DELIVERABLE', payload }),
    []
  );
  const assignSuggestionLink = useCallback(
    (payload) => dispatch({ type: 'ASSIGN_SUGGESTION_LINK', payload }),
    []
  );
  const compileGoalEquation = useCallback(
    (payload) => dispatch({ type: 'COMPILE_GOAL_EQUATION', payload }),
    []
  );
  const acceptSuggestedBlockWithPlacement = useCallback((proposalId, payload) => {
    if (!proposalId) return;
    dispatch({ type: 'ACCEPT_SUGGESTED_BLOCK', proposalId });
    dispatch({ type: 'UPDATE_BLOCK', payload: { ...(payload || {}), id: `blk-${proposalId}` } });
  }, []);
  const resetIdentity = useCallback(() => dispatch({ type: 'RESET_IDENTITY' }), []);

  const attemptGoalAdmission = useCallback(
    (contract) => {
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      dispatch({ type: 'APPLY_NEXT_STATE', nextState });
      return result;
    },
    [state]
  );

  React.useEffect(() => {
    persistState(state);
  }, [state]);

  return React.createElement(
    IdentityContext.Provider,
    {
      value: {
        ...state,
        activePractice,
        activeLens,
        beginBlock,
        completeBlock,
        rescheduleBlock,
        applyLenses,
        setViewDate,
        highlightPractice,
        openLens,
        rebalanceToday,
        completeOnboarding,
        applyOnboardingInputs,
        startNewCycle,
        endCycle,
        setActiveCycle,
        deleteCycle,
        hardDeleteCycle,
        addTruthEntry,
        createBlock,
        updateBlock,
        deleteBlock,
        setActiveDayKey,
        jumpToToday,
        tickNow,
        addRecurringPattern,
        setPrimaryObjective,
        applyNextSuggestion,
        setCalibrationDays,
        generatePlan,
        applyPlan,
        setStrategy,
        generateColdPlan,
        rebaseColdPlan,
        acceptSuggestedBlock,
        acceptSuggestedBlockWithPlacement,
        rejectSuggestedBlock,
        ignoreSuggestedBlock,
        dismissSuggestedBlock,
        createDeliverable,
        updateDeliverable,
        deleteDeliverable,
        createCriterion,
        toggleCriterionDone,
        deleteCriterion,
        linkBlockToDeliverable,
        assignSuggestionLink,
        compileGoalEquation,
        resetIdentity,
        setDefiniteGoal,
        setAim,
        setPatternTargets
        ,
        attemptGoalAdmission,
        archiveAndCloneCycle
      }
    },
    children
  );
}

export function useIdentityStore() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error('useIdentityStore must be used within IdentityProvider');
  return ctx;
}

export function getAssistantContext(state) {
  return {
    aim: state.lenses?.aim?.description || '',
    vector: state.vector,
    today: state.today,
    currentWeek: state.currentWeek,
    stability: state.stability,
    primaryObjective: state.today?.primaryObjectiveId || state.today?.objectiveId,
    nextSuggestion: state.nextSuggestion
  };
}

function loadPersisted() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('jericho-identity');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistState(state) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('jericho-identity', JSON.stringify(state));
  } catch {
    // ignore
  }
}

function ensureTemplates(state) {
  if (!state.templates) state.templates = { objectives: {} };
  if (!state.templates.objectives) state.templates.objectives = {};
  if (!('lastAdaptedDate' in state)) state.lastAdaptedDate = null;
  if (!state.stability) state.stability = { headline: '', actionLine: '' };
  state.today = state.today || {};
  state.today.blocks = Array.isArray(state.today.blocks) ? state.today.blocks : [];
  if (!('nextSuggestion' in state)) state.nextSuggestion = null;
  state.currentWeek = state.currentWeek || { days: [] };
  state.currentWeek.days = Array.isArray(state.currentWeek.days) ? state.currentWeek.days : [];
  state.currentWeek.metrics = state.currentWeek.metrics || {};
  state.cycle = Array.isArray(state.cycle) ? state.cycle : [];
  if (!state.meta || state.meta.version !== STATE_VERSION) {
    state.meta = {
      version: STATE_VERSION,
      onboardingComplete: state.meta?.onboardingComplete || false,
      lastActiveDate: state.meta?.lastActiveDate || state.today?.date,
      scenarioLabel: state.meta?.scenarioLabel || '',
      demoScenarioEnabled: state.meta?.demoScenarioEnabled || false,
      showHints: state.meta?.showHints || false
    };
  }
  if (!state.recurringPatterns) state.recurringPatterns = [];
  if (!state.lastSessionChange) state.lastSessionChange = null;
  if (!state.currentWeek.metrics) state.currentWeek.metrics = {};
  if (!('completionRate' in state.currentWeek.metrics)) state.currentWeek.metrics.completionRate = 0;
  if (!state.ledger) state.ledger = [];
  if (!state.executionEvents) state.executionEvents = [];
  if (!state.goalAdmissionByGoal) state.goalAdmissionByGoal = {};
  if (!state.aspirationsByCycleId) state.aspirationsByCycleId = {};
  if (!('lastPlanError' in state)) state.lastPlanError = null;
  if (!('goalExecutionContract' in state)) state.goalExecutionContract = null;
  if (!('planDraft' in state)) state.planDraft = null;
  if (!state.planCalibration) state.planCalibration = { confidence: 0, assumptions: [], missingInfo: [] };
  if (!('planPreview' in state)) state.planPreview = null;
  if (!('correctionSignals' in state)) state.correctionSignals = null;
  if (!state.suggestedBlocks) state.suggestedBlocks = [];
  if (!state.suggestionEvents) state.suggestionEvents = [];
  if (!state.truthEntries) state.truthEntries = [];
  if (!state.calibrationEvents) state.calibrationEvents = [];
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
  if (!state.directiveEligibilityByGoal) state.directiveEligibilityByGoal = {};
  if (!('goalDirective' in state)) state.goalDirective = null;
  if (!state.appTime) {
    const deviceTimeZone =
      typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : 'UTC';
    const nowISO = new Date().toISOString();
    state.appTime = {
      timeZone: deviceTimeZone,
      nowISO,
      activeDayKey: dayKeyFromISO(nowISO, deviceTimeZone),
      isFollowingNow: true
    };
  } else {
    if (!state.appTime.timeZone) {
      state.appTime.timeZone =
        typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : 'UTC';
    }
    if (!state.appTime.nowISO) state.appTime.nowISO = new Date().toISOString();
    if (!state.appTime.activeDayKey) {
      state.appTime.activeDayKey = dayKeyFromISO(state.appTime.nowISO, state.appTime.timeZone);
    }
    if (typeof state.appTime.isFollowingNow !== 'boolean') state.appTime.isFollowingNow = true;
  }
  return state;
}

/**
 * Pure admission reducer: validates a contract and returns nextState + result
 * This is intentionally pure so it can be tested without React.
 */
export function attemptGoalAdmissionPure(state, contract) {
  const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  ensureCycleStructures(draft);
  const nowISO = draft.appTime?.nowISO || new Date().toISOString();

  const existingOutcomes = Object.values(draft.cyclesById || {})
    .map((c) => (c?.goalContract?.terminalOutcome?.text || c?.definiteGoal?.outcome || ''))
    .filter(Boolean);

  // Check for compound goal (multiple outcomes) - POLICY ENFORCEMENT
  const compoundCheck = detectCompoundGoal(contract);
  if (compoundCheck.isCompound) {
    // Reject compound goals with specific code
    const validation = {
      status: 'REJECTED',
      rejectionCodes: ['MULTIPLE_OUTCOMES_DETECTED']
    };

    const aspirationId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const aspiration = {
      id: aspirationId,
      createdAtISO: nowISO,
      contractDraft: structuredClone ? structuredClone(contract) : JSON.parse(JSON.stringify(contract)),
      rejectionCodes: validation.rejectionCodes || [],
      rejectionReason: `Goal contains multiple outcomes: ${compoundCheck.outcomes.join('; ')}. Please choose one primary objective for this cycle.`
    };

    draft.aspirations = draft.aspirations || [];
    draft.aspirations.push(aspiration);

    if (!draft.aspirationsByCycleId) draft.aspirationsByCycleId = {};
    const forCycle = draft.activeCycleId || 'global';
    draft.aspirationsByCycleId[forCycle] = draft.aspirationsByCycleId[forCycle] || [];
    draft.aspirationsByCycleId[forCycle].push(aspiration);

    const nextState = computeDerivedState(draft, { type: 'NO_OP' });
    return {
      nextState,
      result: { status: 'REJECTED', aspirationId: aspiration.id, rejectionCodes: validation.rejectionCodes, rejectionReason: aspiration.rejectionReason }
    };
  }

  const validation = validateGoalAdmission(contract, nowISO, existingOutcomes);

  if (validation.status === 'REJECTED') {
    const aspirationId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const aspiration = {
      id: aspirationId,
      createdAtISO: nowISO,
      contractDraft: structuredClone ? structuredClone(contract) : JSON.parse(JSON.stringify(contract)),
      rejectionCodes: validation.rejectionCodes || []
    };

    draft.aspirations = draft.aspirations || [];
    draft.aspirations.push(aspiration);

    // Maintain per-cycle aspirations mapping if available
    if (!draft.aspirationsByCycleId) draft.aspirationsByCycleId = {};
    const forCycle = draft.activeCycleId || 'global';
    draft.aspirationsByCycleId[forCycle] = draft.aspirationsByCycleId[forCycle] || [];
    draft.aspirationsByCycleId[forCycle].push(aspiration);

    const nextState = computeDerivedState(draft, { type: 'NO_OP' });
    return {
      nextState,
      result: { status: 'REJECTED', aspirationId: aspiration.id, rejectionCodes: validation.rejectionCodes }
    };
  }

  // ADMITTED -> create new cycle and set active
  const newCycleId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const newCycle = {
    id: newCycleId,
    status: 'Active',
    createdAtISO: nowISO,
    endedAtISO: null,
    goalContract: structuredClone ? structuredClone(contract) : JSON.parse(JSON.stringify(contract)),
    goalHash: contract?.inscription?.contractHash || null,
    executionEvents: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    truthEntries: []
  };

  draft.cyclesById = draft.cyclesById || {};
  draft.cyclesById[newCycleId] = newCycle;
  draft.cycleOrder = Array.isArray(draft.cycleOrder) ? [...draft.cycleOrder, newCycleId] : [newCycleId];
  draft.activeCycleId = newCycleId;

  // STEP 2: Auto-seed deliverables if none exist
  if (!draft.deliverablesByCycleId) draft.deliverablesByCycleId = {};
  const cycleDeliverablesEntry = draft.deliverablesByCycleId[newCycleId] || {
    cycleId: newCycleId,
    deliverables: [],
    suggestionLinks: {},
    lastUpdatedAtISO: nowISO
  };

  // Only seed if deliverables are empty (don't overwrite user edits)
  if (!cycleDeliverablesEntry.deliverables || cycleDeliverablesEntry.deliverables.length === 0) {
    const timeZone = draft.appTime?.timeZone || 'UTC';
    const nowDayKey = dayKeyFromISO(nowISO, timeZone);
    const autoResult = buildAutoDeliverablesFromGoalContract(contract, nowDayKey, timeZone);

    cycleDeliverablesEntry.deliverables = autoResult.deliverables || [];
    cycleDeliverablesEntry.autoGenerated = true;
    cycleDeliverablesEntry.autoGeneratedAt = nowISO;
    cycleDeliverablesEntry.autoStrategy = {
      detectedType: autoResult.detectedType,
      rationale: autoResult.rationale
    };
  }

  draft.deliverablesByCycleId[newCycleId] = cycleDeliverablesEntry;

  // STEP 3: Initialize cycle.strategy with auto-seeded deliverables
  // This ensures they're visible in cycle.strategy.deliverables immediately after admission
  const deadline = contract?.deadline?.dayKey || contract?.endDayKey || null;
  newCycle.strategy = {
    deadlineISO: deadline ? `${deadline}T23:59:59Z` : null,
    deliverables: cycleDeliverablesEntry.deliverables || [],
    constraints: {
      maxBlocksPerDay: contract?.temporalBinding?.sessionDurationMinutes ? Math.ceil(contract.temporalBinding.sessionDurationMinutes / 120) : 4,
      maxBlocksPerWeek: contract?.temporalBinding?.daysPerWeek ? contract.temporalBinding.daysPerWeek * 4 : 16,
      preferredDaysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri (0=Sun, 6=Sat)
      blackoutDayKeys: [],
      tz: draft.appTime?.timeZone || 'UTC'
    },
    assumptionsHash: null
  };
  draft.cyclesById[newCycleId] = newCycle;

  // STEP 5: Auto-run plan generation after admission to populate suggestedBlocks
  let derivedState = computeDerivedState(draft, { type: 'NO_OP' });
  
  // Trigger GENERATE_COLD_PLAN action to automatically generate blocks
  derivedState = computeDerivedState(derivedState, { type: 'GENERATE_COLD_PLAN' });
  
  return { nextState: derivedState, result: { status: 'ADMITTED', cycleId: newCycleId } };
}

function markCompletedAcrossProjections(state, id) {
  let found = null;
  let changed = false;
  const touch = (blocks = []) => {
    blocks.forEach((b) => {
      if (!b || b.id !== id) return;
      if (!found) found = b;
      if (b.status !== 'completed') {
        b.status = 'completed';
        changed = true;
      }
    });
  };
  touch(state.today?.blocks);
  (state.currentWeek?.days || []).forEach((d) => touch(d.blocks));
  (state.cycle || []).forEach((d) => touch(d.blocks));
  return { found, changed };
}

export { identityReducer };
