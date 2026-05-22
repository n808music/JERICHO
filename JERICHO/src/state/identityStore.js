import React, { createContext, useContext, useReducer, useCallback } from 'react';
import structuredClone from '@ungap/structured-clone';
import { appendTransitionTrace, computeDerivedState } from './identityCompute.js';
import { canEmitExecutionEvent } from './engine/executionContract.ts';
import {
  appendExternalEvidenceEvent,
  appendExecutionEvent,
  buildExternalEvidenceEvent,
  buildExecutionEventFromBlock,
  deriveExecutionTruthClassification,
} from './engine/todayAuthority.ts';
import { appendFrictionEvent, buildFrictionEvent } from './engine/profileExecutionContainment.ts';
import { addDays, dayKeyFromDate, dayKeyFromISO, nowDayKey } from './time/time.ts';
import { assertEngineAuthority } from './invariants/engineAuthority.ts';
import { validateGoalAdmission } from '../domain/goal/GoalAdmissionPolicy.ts';
import { GoalRejectionCode } from '../domain/goal/GoalRejectionCode.ts';
import { buildAutoDeliverablesFromGoalContract, detectCompoundGoal } from '../domain/autoStrategy.ts';
import { buildGoalIntakeContract, getIntakeGateCode } from '../domain/goal/GoalIntakeContract.ts';
import { createGeneratePlanWithLLM } from './storeLLMActions.ts';
import { getCanonicalCycleActions } from './cycleSelectors.js';
import { IS_PRODUCTION } from '../utils/runtimeEnv.js';
import {
  applyMasterPlanAction,
  buildMasterPlanStateFields,
  ensureMasterPlanProfileFields,
  MASTER_PLAN_ACTION_TYPES,
  useMasterPlanActions,
} from './masterPlanStore.js';
import {
  applyCoreMissionContractAction,
  buildCoreMissionContractStateFields,
  ensureCoreMissionContractProfileFields,
  CORE_MISSION_CONTRACT_ACTION_TYPES,
  useCoreMissionContractActions,
} from './coreMissionContractStore.js';

const STATE_VERSION = '1.0.0';
export const DEFAULT_PROFILE_ID = 'profile-local-default';
export const DEFAULT_PROFILE_DISPLAY_NAME = 'Local Profile';
const DEFAULT_PROFILE_LABEL = DEFAULT_PROFILE_DISPLAY_NAME;
const DERIVED_PERSISTENCE_KEYS = [
  'calendarDisplayBlocks',
  'fullHorizonScheduleBlocks',
  'fullHorizonCoverageAudit',
  'fullHorizonPlanQuality',
  'fullHorizonRenderTruthAudit',
  'fullHorizonCoverageFailureCodes',
];

const IdentityContext = createContext(null);

const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function emptyWorkWindows() {
  return ALL_DAYS.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {});
}

function buildDefaultSeedGoalArtifacts(todayDate) {
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
        validationMethod: 'user_attest',
      },
    ],
    requirements: {
      requiredDomains: ['Body', 'Focus', 'Creation', 'Resources'],
      minimumCadencePerDomain: {
        Body: 2,
        Focus: 3,
        Creation: 4,
        Resources: 1,
      },
      expectedDomainMix: {
        Body: 0.2,
        Focus: 0.3,
        Creation: 0.4,
        Resources: 0.1,
      },
      maxAllowedVariance: 0.2,
    },
  };
  const goalGovernanceContract = {
    contractId: 'gov-1',
    version: 1,
    goalId: 'goal-1',
    activeFromISO: todayDate,
    activeUntilISO: contractDeadline,
    scope: {
      domainsAllowed: [],
      timeHorizon: 'week',
      timezone: 'America/Chicago',
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
        dependencies: [],
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
        dependencies: [],
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
        dependencies: [],
      },
    ],
  };

  return { contractDeadline, goalContract, goalGovernanceContract, goalWorkById };
}

function normalizeProfileIdentity(profile = {}, options = {}) {
  const fallbackDisplayName = String(
    options.displayName || options.profileLabel || profile?.displayName || profile?.label || DEFAULT_PROFILE_DISPLAY_NAME
  ).trim() || DEFAULT_PROFILE_DISPLAY_NAME;
  const roleLabel = String(
    profile?.roleLabel || profile?.profileRole || options.roleLabel || options.profileRole || ''
  ).trim();
  return {
    ...profile,
    displayName: fallbackDisplayName,
    label: String(profile?.label || fallbackDisplayName).trim() || fallbackDisplayName,
    roleLabel: roleLabel || null,
  };
}

function getCanonicalActionsForBlock(state, block) {
  const cycleId = String(block?.cycleId || state?.activeCycleId || '').trim();
  const cycle = cycleId ? state?.cyclesById?.[cycleId] || null : null;
  return getCanonicalCycleActions(cycle);
}

function findBlockForExecutionOutcome(state, id) {
  if (!id) {
    return null;
  }
  const blockId = String(id);
  const activeCycleId = String(state?.activeCycleId || '').trim();
  const reviewBlock = (state?.scheduleReviewBlocks || []).find((block) => String(block?.id || '') === blockId);
  if (reviewBlock) {
    return reviewBlock;
  }
  const todayBlock = (state?.today?.blocks || []).find((block) => String(block?.id || '') === blockId);
  if (todayBlock) {
    return todayBlock;
  }
  const cycleBlock = Array.isArray(state?.cycle)
    ? state.cycle
        .flatMap((day) => (Array.isArray(day?.blocks) ? day.blocks : []))
        .find((block) => String(block?.id || '') === blockId)
    : null;
  if (cycleBlock) {
    return cycleBlock;
  }
  if (activeCycleId) {
    const activeCycle = state?.cyclesById?.[activeCycleId] || null;
    const proposed = (activeCycle?.proposedBlocks || []).find((block) => String(block?.id || '') === blockId);
    if (proposed) {
      return proposed;
    }
    const applied = (activeCycle?.scheduleReviewBlocks || []).find((block) => String(block?.id || '') === blockId);
    if (applied) {
      return applied;
    }
  }
  const blockStoreBlock = state?.blockStore?.blocks?.[blockId];
  if (blockStoreBlock) {
    return blockStoreBlock;
  }
  return null;
}

function buildRecoveredGoalArtifacts({ goalId, startDayKey, endDayKey, goalText, timeZone }) {
  if (!goalId || !startDayKey || !endDayKey) {
    return null;
  }
  return {
    goalContract: {
      goalId,
      goalLabel: goalText || null,
      goalText: goalText || null,
      status: 'active',
      activationDateISO: startDayKey,
      startDayKey,
      deadlineISO: endDayKey,
      endDayKey,
      success: [],
      requirements: {
        requiredDomains: [],
        minimumCadencePerDomain: {},
        expectedDomainMix: {},
        maxAllowedVariance: 0.2,
      },
    },
    goalGovernanceContract: {
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
    },
  };
}

const seedState = buildInitialIdentityState();

export function buildBlankIdentityState(options = {}) {
  const deviceTimeZone =
    options.timeZone ||
    (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC');
  const nowISO = options.nowISO || new Date().toISOString();
  const todayDate = options.todayDate || dayKeyFromISO(nowISO, deviceTimeZone);
  const requestedProfileId = String(options.activeProfileId || DEFAULT_PROFILE_ID).trim() || DEFAULT_PROFILE_ID;
  const providedProfiles =
    options.profilesById && typeof options.profilesById === 'object' ? structuredClone(options.profilesById) : {};
  const baseProfiles = Object.keys(providedProfiles).length > 0 ? providedProfiles : {};
  if (!baseProfiles[requestedProfileId]) {
    baseProfiles[requestedProfileId] = {
      id: requestedProfileId,
      ...normalizeProfileIdentity({}, options),
      goalIds: [],
      activeGoalId: null,
      masterCalendarId: `calendar-${requestedProfileId}`,
      strategicClusterIds: [],
      createdAtISO: nowISO,
      status: 'active',
    };
  } else {
    baseProfiles[requestedProfileId] = {
      ...baseProfiles[requestedProfileId],
      id: requestedProfileId,
      ...normalizeProfileIdentity(baseProfiles[requestedProfileId], options),
      goalIds: Array.isArray(baseProfiles[requestedProfileId].goalIds) ? baseProfiles[requestedProfileId].goalIds : [],
      activeGoalId: baseProfiles[requestedProfileId].activeGoalId || null,
      masterCalendarId:
        baseProfiles[requestedProfileId].masterCalendarId || `calendar-${requestedProfileId}`,
      strategicClusterIds: Array.isArray(baseProfiles[requestedProfileId].strategicClusterIds)
        ? baseProfiles[requestedProfileId].strategicClusterIds
        : [],
      status: baseProfiles[requestedProfileId].status || 'active',
    };
  }
  ensureMasterPlanProfileFields(baseProfiles[requestedProfileId]);
  ensureCoreMissionContractProfileFields(baseProfiles[requestedProfileId]);
  const blankState = {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'quiet' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    activeProfileId: requestedProfileId,
    profilesById: baseProfiles,
    goalsById: {},
    masterCalendarsById: {},
    strategicClustersById: {},
    goalRelations: [],
    constraintRelations: [],
    frictionEvents: [],
    frictionPropagationResults: [],
    activeCycleId: null,
    activeGoalId: null,
    cyclesById: {},
    cycleOrder: [],
    deliverablesByCycleId: {},
    aspirationsByCycleId: {},
    goalAdmissionByGoal: {},
    goalLifecycleState: 'blank',
    proposedBlocks: [],
    proposedBlocksByCycleId: {},
    suggestedBlocks: [],
    suggestionEvents: [],
    executionEvents: [],
    externalEvidenceEvents: [],
    planMutationEvents: [],
    truthEntries: [],
    goalExecutionContract: null,
    pendingOnboardingInputs: null,
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    planRecovery: null,
    lastPlanError: null,
    planDraft: null,
    planPreview: null,
    planCalibration: null,
    correctionSignals: null,
    scheduleApplied: false,
    scheduleLifecycle: 'no_schedule',
    scheduleReviewBlocks: [],
    draftScheduleAppliedAtISO: null,
    pendingPlanConfirmation: false,
    today: {
      date: todayDate,
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: todayDate, days: [], metrics: {} },
    cycle: [],
    blockStore: { blocks: {} },
    goalPolicyByGoalId: {},
    masterPlanPolicyByPlanId: {},
    planQualityGateByGoal: {},
    systemShotClockByGoal: {},
    executionCorrectionByGoal: {},
    cycleDynamicsByCycleId: {},
    viewDate: todayDate,
    selectedHorizonMode: 'current_cycle',
    calendarDisplayBlocks: [],
    scheduleLifecycleState: 'no_goal',
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
      showHints: false,
    },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    ledger: [],
    suggestionHistory: {
      dayKey: todayDate,
      count: 0,
      lastSuggestedAtISO: null,
      lastSuggestedAtISOByGoal: {},
      dailyCountByGoal: {},
      denials: [],
    },
    suggestionEligibility: {},
    directiveEligibilityByGoal: {},
    goalDirective: null,
    appTime: {
      timeZone: deviceTimeZone,
      nowISO,
      activeDayKey: todayDate,
      isFollowingNow: true,
    },
    constraints: {
      maxBlocksPerDay: 4,
      workableDayPolicy: { weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] },
    },
    ...buildMasterPlanStateFields(),
    ...buildCoreMissionContractStateFields(),
  };
  return blankState;
}

export function rehydratePersistedState(persisted) {
  if (!persisted || persisted.meta?.version !== STATE_VERSION) {
    return null;
  }
  const withTemplates = ensureTemplates(persisted);
  return computeDerivedState(withTemplates, {
    type: 'SET_VIEW_DATE',
    date: withTemplates.viewDate || withTemplates.today?.date || withTemplates.cycle?.[0]?.date,
  });
}

function isLiveCycleStatus(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return false;
  }
  return !['archived', 'ended', 'deleted'].includes(normalized);
}

export function buildPersistableIdentityState(state) {
  const snapshot = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));

  DERIVED_PERSISTENCE_KEYS.forEach((key) => {
    delete snapshot[key];
  });

  if (!snapshot.activeCycleId) {
    snapshot.executionEvents = [];
    snapshot.externalEvidenceEvents = [];
    snapshot.proposedBlocks = [];
    snapshot.scheduleReviewBlocks = [];
    snapshot.proposedBlocksByCycleId = {};
    snapshot.scheduleApplied = false;
    snapshot.pendingPlanConfirmation = false;
  }

  const retainedCyclesById = Object.fromEntries(
    Object.entries(snapshot?.cyclesById || {}).filter(([, cycle]) => {
      if (!cycle?.id) {
        return false;
      }
      if (snapshot.activeCycleId && cycle.id === snapshot.activeCycleId) {
        return true;
      }
      return isLiveCycleStatus(cycle?.status || cycle?.state);
    })
  );

  snapshot.cyclesById = retainedCyclesById;
  snapshot.cycleOrder = (Array.isArray(snapshot.cycleOrder) ? snapshot.cycleOrder : []).filter(
    (cycleId) => Boolean(retainedCyclesById[cycleId])
  );
  if (!snapshot.activeCycleId || !retainedCyclesById[snapshot.activeCycleId]) {
    snapshot.activeCycleId = null;
  }

  Object.values(snapshot?.goalsById || {}).forEach((goal) => {
    if (!goal) {
      return;
    }
    if (!goal.activeCycleId || retainedCyclesById[goal.activeCycleId]) {
      return;
    }
    goal.activeCycleId = null;
  });

  return snapshot;
}

function buildInitialIdentityState() {
  const persisted = loadPersisted();
  const hydrated = rehydratePersistedState(persisted);
  if (hydrated) {
    persistState(hydrated);
    return hydrated;
  }

  const deviceTimeZone =
    typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';
  const nowISO = new Date().toISOString();
  const todayDate = dayKeyFromISO(nowISO, deviceTimeZone);
  const activeDayKey = dayKeyFromISO(nowISO, deviceTimeZone);
  const blocks = [
    {
      id: 'b1',
      practice: 'Creation',
      label: 'Assign capabilities',
      start: `${todayDate}T09:00:00.000Z`,
      end: `${todayDate}T10:30:00.000Z`,
      status: 'in_progress',
    },
    {
      id: 'b2',
      practice: 'Focus',
      label: 'Pipeline build',
      start: `${todayDate}T11:00:00.000Z`,
      end: `${todayDate}T12:00:00.000Z`,
      status: 'planned',
    },
  ];

  const vector = {
    day: 6,
    direction: 'Grow revenue to $10k/month',
    stability: 'steady',
    drift: 'contained',
    momentum: 'active',
  };

  const lenses = {
    aim: { description: 'Grow revenue to $10k/month', horizon: '90d' },
    pattern: {
      routines: { Body: [], Resources: [], Creation: [], Focus: [] },
      dailyTargets: [
        { name: 'Body', minutes: 30 },
        { name: 'Resources', minutes: 45 },
        { name: 'Creation', minutes: 120 },
        { name: 'Focus', minutes: 60 },
      ],
      defaultMinutes: 30,
    },
    flow: { streams: ['Client work', 'Content', 'Pipeline'] },
  };

  const practices = buildPracticesFromTargets(lenses.pattern.dailyTargets);
  const { contractDeadline, goalContract, goalGovernanceContract, goalWorkById } =
    buildDefaultSeedGoalArtifacts(todayDate);

  const today = {
    date: todayDate,
    blocks,
    completionRate: 0,
    driftSignal: 'forming',
    loadByPractice: { Body: 30, Resources: 45, Creation: 90, Focus: 60 },
    practices,
  };

  const weekDays = Array.from({ length: 7 }).map((_, idx) => ({
    date: `2025-12-0${idx + 8}`,
    blocks: idx === 1 ? blocks : [],
    completionRate: idx === 1 ? 0.5 : 0,
    driftSignal: idx === 1 ? 'forming' : 'contained',
    loadByPractice: { Body: 0, Resources: 0, Creation: idx === 1 ? 90 : 0, Focus: idx === 1 ? 60 : 0 },
    practices,
  }));

  let initialState = {
    vector,
    lenses,
    activeProfileId: DEFAULT_PROFILE_ID,
    profilesById: {
      [DEFAULT_PROFILE_ID]: {
        id: DEFAULT_PROFILE_ID,
        ...normalizeProfileIdentity({ label: DEFAULT_PROFILE_LABEL }),
        goalIds: [goalGovernanceContract.goalId],
        activeGoalId: goalGovernanceContract.goalId,
        masterCalendarId: `calendar-${DEFAULT_PROFILE_ID}`,
        strategicClusterIds: [],
        createdAtISO: nowISO,
        status: 'active',
      },
    },
    goalsById: {
      [goalGovernanceContract.goalId]: {
        id: goalGovernanceContract.goalId,
        profileId: DEFAULT_PROFILE_ID,
        cycleIds: ['cycle-1'],
        activeCycleId: 'cycle-1',
        status: 'active',
      },
    },
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
        proposedBlocks: [],
        suggestedBlocks: [],
        truthEntries: [],
        suggestionHistory: {
          dayKey: todayDate,
          count: 0,
          lastSuggestedAtISO: null,
          lastSuggestedAtISOByGoal: {},
          dailyCountByGoal: {},
          denials: [],
        },
      },
    },
    deliverablesByCycleId: {
      'cycle-1': {
        cycleId: 'cycle-1',
        deliverables: [],
        suggestionLinks: {},
        lastUpdatedAtISO: nowISO,
      },
    },
    goalAdmissionByGoal: {},
    aspirationsByCycleId: { 'cycle-1': [] },
    lastPlanError: null,
    planRecovery: null,
    proposedBlocks: [],
    proposedBlocksByCycleId: { 'cycle-1': [] },
    history: { cycles: [] },
    today,
    currentWeek: { weekStart: '2025-12-08', days: weekDays },
    cycle: weekDays,
    blockStore: { blocks: {} },
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
      showHints: false,
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
      denials: [],
    },
    suggestionEligibility: {},
    directiveEligibilityByGoal: {},
    goalDirective: null,
    goalWorkById,
    activeGoalId: goalGovernanceContract.goalId,
  };
  initialState.appTime = {
    timeZone: deviceTimeZone,
    nowISO,
    activeDayKey,
    isFollowingNow: true,
  };
  initialState.constraints = {
    maxBlocksPerDay: 4,
    workableDayPolicy: { weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] },
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
  if (!state.history) {
    state.history = { cycles: [] };
  }
  if (!state.cyclesById) {
    state.cyclesById = {};
  }
  if (typeof state.activeCycleId === 'undefined') {
    state.activeCycleId = null;
  }
  if (!state.cycleOrder) {
    state.cycleOrder = Object.keys(state.cyclesById || {});
  }
  if (!state.aspirations) {
    state.aspirations = [];
  }
}

function sanitizeTargets(dailyTargets = []) {
  const map = {
    Body: 0,
    Resources: 0,
    Creation: 0,
    Focus: 0,
  };
  dailyTargets.forEach((t) => {
    if (!t?.name) {
      return;
    }
    const key = t.name;
    if (map[key] === undefined) {
      return;
    }
    const val = Number(t.minutes);
    map[key] = Number.isFinite(val) && val >= 0 ? val : 0;
  });
  return Object.entries(map).map(([name, minutes]) => ({ name, minutes }));
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

function computeWeeklyCapacityFromWorkWindows(workWindows) {
  const workDays = getWorkDaysFromWindows(workWindows);
  return workDays.reduce((total, dow) => total + getAvailableMinutesForDow(dow, workWindows), 0);
}

function computeMaxDailyMinutesFromWorkWindows(workWindows) {
  const workDays = getWorkDaysFromWindows(workWindows);
  return workDays.reduce((maxValue, dow) => Math.max(maxValue, getAvailableMinutesForDow(dow, workWindows)), 0);
}

function workDaysToWeekdayIndexes(workDays = []) {
  const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const out = workDays.map((dow) => map[dow]).filter((idx) => Number.isFinite(idx));
  return out.length ? out : [1, 2, 3, 4, 5];
}

function bootstrapActionsFromDeliverables(cycleId, deliverables = []) {
  const normalized = Array.isArray(deliverables) ? deliverables : [];
  return normalized
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

function buildAdmissionPlanProofFromActions(actions = []) {
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

function applySetDefiniteGoal(state, action) {
  const outcome = (action.outcome || '').trim();
  const deadlineDayKey = (action.deadlineDayKey || '').slice(0, 10);
  if (!outcome || !deadlineDayKey) {
    return;
  }
  ensureCycleStructures(state);
  const current = state.activeCycleId ? state.cyclesById[state.activeCycleId] : null;
  if (!current) {
    return;
  }
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
      deadlineDayKey: nowDayKey(),
    });
  }
  if (!state.activeCycleId) {
    return;
  }
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
      deadlineDayKey: nowDayKey(),
    });
  }
  if (!state.activeCycleId) {
    return;
  }
  const sanitized = sanitizeTargets(action.dailyTargets || []);
  const cycle = state.cyclesById[state.activeCycleId];
  cycle.pattern = { dailyTargets: sanitized };
  if (state.lenses) {
    state.lenses.pattern = { ...(state.lenses.pattern || {}), dailyTargets: sanitized };
  }
}

function identityReducer(state, action) {
  if (action.type === 'RESET_IDENTITY') {
    const activeProfileId = String(state?.activeProfileId || DEFAULT_PROFILE_ID).trim() || DEFAULT_PROFILE_ID;
    const currentProfile = state?.profilesById?.[activeProfileId] || {};
    const profileLabel = currentProfile?.label || DEFAULT_PROFILE_LABEL;
    const profileDisplayName = currentProfile?.displayName || profileLabel || DEFAULT_PROFILE_DISPLAY_NAME;
    const roleLabel = currentProfile?.roleLabel || null;
    const sanitizedProfiles = {
      [activeProfileId]: {
        id: activeProfileId,
        ...normalizeProfileIdentity(
          {
            label: profileLabel,
            displayName: profileDisplayName,
            roleLabel,
          },
          {
            profileLabel,
            displayName: profileDisplayName,
            roleLabel,
          }
        ),
        masterCalendarId: currentProfile?.masterCalendarId || `calendar-${activeProfileId}`,
        strategicClusterIds: [],
        goalIds: [],
        activeGoalId: null,
        status: currentProfile?.status || 'active',
      },
    };
    return computeDerivedState(
      buildBlankIdentityState({
        activeProfileId,
        profileLabel,
        displayName: profileDisplayName,
        roleLabel,
        profilesById: sanitizedProfiles,
        timeZone: state?.appTime?.timeZone || 'UTC',
      }),
      { type: 'NO_OP' }
    );
  }

  if (MASTER_PLAN_ACTION_TYPES.has(action.type)) {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    if (applyMasterPlanAction(draft, action)) {
      return computeDerivedState(draft, { type: 'NO_OP' });
    }
  }

  if (CORE_MISSION_CONTRACT_ACTION_TYPES.has(action.type)) {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    applyCoreMissionContractAction(draft, action);
    return computeDerivedState(draft, { type: 'NO_OP' });
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
      isFollowingNow: false,
    };
    draft.viewDate = dayKey;
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  if (action.type === 'SET_SELECTED_HORIZON_MODE') {
    const VALID_MODES = new Set(['current_cycle', '1_year', '2_year', '3_year', '4_year', '5_year', 'full_horizon']);
    const mode = VALID_MODES.has(action.mode) ? action.mode : 'current_cycle';
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    draft.selectedHorizonMode = mode;
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  if (action.type === 'UPSERT_PROFILE_DETAILS') {
    const profileId = String(action.profileId || state?.activeProfileId || DEFAULT_PROFILE_ID).trim() || DEFAULT_PROFILE_ID;
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    draft.profilesById = draft.profilesById && typeof draft.profilesById === 'object' ? draft.profilesById : {};
    const existingProfile = draft.profilesById[profileId] || { id: profileId };
    const nextDisplayName = String(action.displayName || existingProfile.displayName || existingProfile.label || '').trim();
    const nextRoleLabel = String(action.roleLabel || '').trim();
    draft.profilesById[profileId] = {
      ...existingProfile,
      ...normalizeProfileIdentity(existingProfile, {
        displayName: nextDisplayName || DEFAULT_PROFILE_DISPLAY_NAME,
        profileLabel: nextDisplayName || existingProfile.label || DEFAULT_PROFILE_LABEL,
        roleLabel: nextRoleLabel,
      }),
      id: profileId,
      label: nextDisplayName || DEFAULT_PROFILE_DISPLAY_NAME,
    };
    draft.activeProfileId = profileId;
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
      isFollowingNow: true,
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
      activeDayKey: activeDayKey || draft.appTime?.activeDayKey || nowDayKey(),
    };
    if (draft.appTime.isFollowingNow && draft.appTime.activeDayKey) {
      draft.viewDate = draft.appTime.activeDayKey;
    }
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  // Handle completion in the reducer to keep ledger append single-source
  if (action.type === 'COMPLETE_BLOCK') {
    // Silently refuse to mutate derived forecast blocks — they are visible but not executable
    const isForecastBlock = (state?.calendarDisplayBlocks || []).some(
      b => b.source === 'derived' && String(b.id || '') === String(action.id || '')
    );
    if (isForecastBlock) return state;
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    draft.ledger = draft.ledger || [];
    const candidate = findBlockForExecutionOutcome(draft, action.id);
    if (candidate && !canMutateExecutionBlock(draft, candidate)) {
      draft.lastPlanError = buildActivationRequiredError(draft, candidate);
      return draft;
    }
    const { found, changed } = markCompletedAcrossProjections(draft, action.id);
    if (!changed) {
      return state;
    }
    const alreadyLogged = draft.ledger.some((entry) => entry.blockId === action.id);
    if (!alreadyLogged && found) {
      const rawStart = Date.parse(found.start);
      const rawEnd = Date.parse(found.end);
      const raw = (rawEnd - rawStart) / 60000;
      const plannedMinutes = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
      // UI uses a 24h column; clamp plannedMinutes to 1440 to keep metrics/layout bounded.
      const plannedMinutesClamped = Math.min(plannedMinutes, 24 * 60);
      const nowISO = draft.appTime?.nowISO || new Date().toISOString();
      const timeZone = draft.appTime?.timeZone || 'UTC';
      const truth = deriveExecutionTruthClassification({
        block: found,
        nowISO,
        activeDayKey: draft.appTime?.activeDayKey || draft.today?.date || null,
        timeZone,
        executionEvents: draft.executionEvents || [],
        canonicalActions: getCanonicalActionsForBlock(draft, found),
        source: action.source || 'user_action',
        reasonCode: action.reasonCode || null,
        note: action.note || null,
      });
      const event = buildExecutionEventFromBlock(found, {
        blockId: action.id,
        dateISO: truth.eventDate,
        minutes: plannedMinutesClamped,
        completed: true,
        kind: 'complete',
        completedAtISO: nowISO,
        ...truth,
      });
      const existingBlockIds = found ? new Set([action.id]) : undefined;
      if (!canEmitExecutionEvent(draft.executionEvents || [], event, { existingBlockIds })) {
        return state;
      }
      draft.ledger.push({
        eventId: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        blockId: action.id,
        date: truth.eventDate,
        plannedMinutes: plannedMinutesClamped,
        completedMinutes: plannedMinutesClamped,
        completedAt: nowISO,
        practice: found.practice,
        label: found.label,
      });
      appendExecutionEvent(draft, event);
      appendTransitionTrace(draft, {
        transition: 'complete',
        blockId: action.id,
        label: found.title || found.label || '',
      });
    }
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  if (action.type === 'MISS_BLOCK' || action.type === 'SKIP_BLOCK') {
    // Silently refuse to mutate derived forecast blocks
    const isForecastBlock = (state?.calendarDisplayBlocks || []).some(
      b => b.source === 'derived' && String(b.id || '') === String(action.id || '')
    );
    if (isForecastBlock) return state;
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    const targetStatus = action.type === 'MISS_BLOCK' ? 'missed' : 'skipped';
    const targetKind = action.type === 'MISS_BLOCK' ? 'missed' : 'skipped';
    const candidate = findBlockForExecutionOutcome(draft, action.id);
    if (candidate && !canMutateExecutionBlock(draft, candidate)) {
      draft.lastPlanError = buildActivationRequiredError(draft, candidate);
      return draft;
    }
    const found = markStatusAcrossProjections(draft, action.id, targetStatus);
    if (!found) {
      return state;
    }
    const rawStart = Date.parse(found.start);
    const rawEnd = Date.parse(found.end);
    const raw = (rawEnd - rawStart) / 60000;
    const plannedMinutes = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
    const nowISO = draft.appTime?.nowISO || new Date().toISOString();
    const timeZone = draft.appTime?.timeZone || 'UTC';
    const truth = deriveExecutionTruthClassification({
      block: found,
      nowISO,
      activeDayKey: draft.appTime?.activeDayKey || draft.today?.date || null,
      timeZone,
      executionEvents: draft.executionEvents || [],
      canonicalActions: getCanonicalActionsForBlock(draft, found),
      source: action.source || 'user_action',
      reasonCode: action.reasonCode || null,
      note: action.note || null,
    });
    const event = buildExecutionEventFromBlock(found, {
      blockId: action.id,
      dateISO: truth.eventDate,
      minutes: Math.min(plannedMinutes, 24 * 60),
      completed: false,
      kind: targetKind,
      status: targetStatus,
      missedAtISO: nowISO,
      ...truth,
    });
    if (!canEmitExecutionEvent(draft.executionEvents || [], event, { existingBlockIds: new Set([action.id]) })) {
      return state;
    }
    appendExecutionEvent(draft, event);
    appendTransitionTrace(draft, {
      transition: targetStatus,
      blockId: action.id,
      label: found.title || found.label || '',
    });
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  if (action.type === 'BEGIN_BLOCK' || action.type === 'UPDATE_BLOCK' || action.type === 'RESCHEDULE_BLOCK') {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    const targetId = action.id || action.payload?.id || null;
    const candidate = targetId ? findBlockForExecutionOutcome(draft, targetId) : null;
    if (candidate && !canMutateExecutionBlock(draft, candidate)) {
      draft.lastPlanError = buildActivationRequiredError(draft, candidate);
      return draft;
    }
    return computeDerivedState(draft, action);
  }

  if (action.type === 'ADD_EXTERNAL_EVIDENCE') {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    const payload = action.payload || {};
    const activeCycleId = payload.cycleId || draft.activeCycleId || null;
    const activeGoalId =
      payload.goalId ||
      draft.cyclesById?.[activeCycleId || '']?.goalContract?.goalId ||
      draft.cyclesById?.[activeCycleId || '']?.goalGovernanceContract?.goalId ||
      draft.goalExecutionContract?.goalId ||
      null;
    if (!payload?.evidenceType || !activeGoalId) {
      return state;
    }
    const activeCycle = activeCycleId ? draft.cyclesById?.[activeCycleId] || null : null;
    if (activeCycle && !canMutateExecutionBlock(draft, activeCycle)) {
      draft.lastPlanError = buildActivationRequiredError(draft, activeCycle);
      return draft;
    }
    const nowISO = draft.appTime?.nowISO || new Date().toISOString();
    const event = buildExternalEvidenceEvent({
      ...payload,
      goalId: activeGoalId,
      cycleId: payload.cycleId ?? activeCycleId,
      recordedAtISO: payload.recordedAtISO || nowISO,
      dateISO: payload.dateISO || draft.appTime?.activeDayKey || draft.today?.date || nowDayKey(),
      source: payload.source || 'user_confirmed',
    });
    const exists = (draft.externalEvidenceEvents || []).some((candidate) => candidate?.id === event.id);
    if (exists) {
      return state;
    }
    appendExternalEvidenceEvent(draft, event);
    return computeDerivedState(draft, { type: 'NO_OP' });
  }

  if (action.type === 'ADD_FRICTION_EVENT') {
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    const payload = action.payload || {};
    const activeCycleId = payload.cycleId || draft.activeCycleId || null;
    const activeGoalId =
      payload.goalId ||
      draft.cyclesById?.[activeCycleId || '']?.goalContract?.goalId ||
      draft.cyclesById?.[activeCycleId || '']?.goalGovernanceContract?.goalId ||
      draft.goalExecutionContract?.goalId ||
      draft.activeGoalId ||
      null;
    const profileId =
      payload.profileId ||
      draft.goalsById?.[activeGoalId || '']?.profileId ||
      draft.cyclesById?.[activeCycleId || '']?.profileId ||
      draft.activeProfileId ||
      null;
    const event = buildFrictionEvent({
      ...payload,
      profileId,
      goalId: activeGoalId,
      cycleId: payload.cycleId ?? activeCycleId,
      startDateISO: payload.startDateISO || draft.appTime?.activeDayKey || draft.today?.date || nowDayKey(),
    });
    if (!event) {
      return state;
    }
    appendFrictionEvent(draft, event);
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
  const stateRef = React.useRef(state);

  if (!IS_PRODUCTION) {
    assertEngineAuthority(state);
  }

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const masterPlanActions = useMasterPlanActions(dispatch);
  const coreMissionContractActions = useCoreMissionContractActions(dispatch);

  const beginBlock = useCallback((id) => dispatch({ type: 'BEGIN_BLOCK', id }), []);
  const completeBlock = useCallback((id, meta = {}) => dispatch({ type: 'COMPLETE_BLOCK', id, ...meta }), []);
  const missBlock = useCallback((id, meta = {}) => dispatch({ type: 'MISS_BLOCK', id, ...meta }), []);
  const skipBlock = useCallback((id, meta = {}) => dispatch({ type: 'SKIP_BLOCK', id, ...meta }), []);
  const rescheduleBlock = useCallback((id, start, end) => dispatch({ type: 'RESCHEDULE_BLOCK', id, start, end }), []);
  const applyLenses = useCallback((lenses) => dispatch({ type: 'APPLY_LENSES', lenses }), []);
  const setDefiniteGoal = useCallback((payload) => dispatch({ type: 'SET_DEFINITE_GOAL', ...payload }), []);
  const setAim = useCallback((payload) => dispatch({ type: 'SET_AIM', ...payload }), []);
  const setPatternTargets = useCallback((payload) => dispatch({ type: 'SET_PATTERN_TARGETS', ...payload }), []);
  const setViewDate = useCallback((date) => dispatch({ type: 'SET_VIEW_DATE', date }), []);
  const setSelectedHorizonMode = useCallback((mode) => dispatch({ type: 'SET_SELECTED_HORIZON_MODE', mode }), []);
  const highlightPractice = useCallback((practice) => setActivePractice(practice), []);
  const openLens = useCallback((lens) => setActiveLens(lens), []);
  const rebalanceToday = useCallback((mode) => dispatch({ type: 'REBALANCE_TODAY', mode }), []);
  const completeOnboarding = useCallback((onboarding) => dispatch({ type: 'COMPLETE_ONBOARDING', onboarding }), []);
  const finishOnboardingGate = useCallback(
    (onboarding) => dispatch({ type: 'FINISH_ONBOARDING_GATE', onboarding }),
    []
  );
  const updatePendingOnboardingInputs = useCallback(
    (onboarding) => dispatch({ type: 'UPDATE_PENDING_ONBOARDING_INPUTS', onboarding }),
    []
  );
  const applyOnboardingInputs = useCallback(
    (onboarding) => dispatch({ type: 'APPLY_ONBOARDING_INPUTS', onboarding }),
    []
  );
  const clearPlanRecovery = useCallback(() => dispatch({ type: 'CLEAR_PLAN_RECOVERY' }), []);
  const startNewCycle = useCallback((payload) => dispatch({ type: 'START_NEW_CYCLE', payload }), []);
  const startNewCycleWithDecision = useCallback(
    (payload) => dispatch({ type: 'START_NEW_CYCLE_WITH_DECISION', payload }),
    []
  );
  const resetActiveCycle = useCallback((cycleId) => dispatch({ type: 'RESET_ACTIVE_CYCLE', cycleId }), []);
  const completeCycleReassessment = useCallback(
    (cycleId) => dispatch({ type: 'COMPLETE_CYCLE_REASSESSMENT', cycleId }),
    []
  );
  const endCycle = useCallback((cycleId) => dispatch({ type: 'END_CYCLE', cycleId }), []);
  const archiveAndCloneCycle = useCallback(
    (cycleId, overrides = {}) => dispatch({ type: 'ARCHIVE_AND_CLONE_CYCLE', cycleId, overrides }),
    []
  );
  const setActiveCycle = useCallback((cycleId) => dispatch({ type: 'SET_ACTIVE_CYCLE', cycleId }), []);
  const deleteCycle = useCallback((cycleId) => dispatch({ type: 'DELETE_CYCLE', cycleId }), []);
  const hardDeleteCycle = useCallback((cycleId) => dispatch({ type: 'HARD_DELETE_CYCLE', cycleId }), []);
  const addTruthEntry = useCallback((payload) => dispatch({ type: 'ADD_TRUTH_ENTRY', payload }), []);
  const createBlock = useCallback((payload) => dispatch({ type: 'CREATE_BLOCK', payload }), []);
  const updateBlock = useCallback((payload) => dispatch({ type: 'UPDATE_BLOCK', payload }), []);
  const deleteBlock = useCallback((id, meta = {}) => dispatch({ type: 'DELETE_BLOCK', id, ...meta }), []);
  const addExternalEvidence = useCallback(
    (payload) => dispatch({ type: 'ADD_EXTERNAL_EVIDENCE', payload }),
    []
  );
  const addFrictionEvent = useCallback((payload) => dispatch({ type: 'ADD_FRICTION_EVENT', payload }), []);
  const setActiveDayKey = useCallback((dayKey) => dispatch({ type: 'SET_ACTIVE_DAY_KEY', dayKey }), []);
  const jumpToToday = useCallback(() => dispatch({ type: 'JUMP_TO_TODAY' }), []);
  const tickNow = useCallback((nowISO) => dispatch({ type: 'TICK_NOW', nowISO }), []);
  const addRecurringPattern = useCallback((pattern) => dispatch({ type: 'ADD_RECURRING_PATTERN', pattern }), []);
  const setPrimaryObjective = useCallback(
    (objectiveId) => dispatch({ type: 'SET_PRIMARY_OBJECTIVE', objectiveId }),
    []
  );
  const applyNextSuggestion = useCallback(() => dispatch({ type: 'APPLY_NEXT_SUGGESTION' }), []);
  const setCalibrationDays = useCallback(
    (daysPerWeek, uncertain = false) => dispatch({ type: 'SET_CALIBRATION_DAYS', daysPerWeek, uncertain }),
    []
  );
  const generatePlan = useCallback(
    (payload = {}) =>
      dispatch({
        type: 'GENERATE_PLAN',
        payload: { ...(payload || {}), cycleId: payload?.cycleId || state.activeCycleId || null },
      }),
    [state.activeCycleId]
  );
  const generatePlanForCycle = useCallback(
    (cycleId) =>
      dispatch({
        type: 'GENERATE_PLAN',
        payload: { cycleId: cycleId || state.activeCycleId || null },
      }),
    [state.activeCycleId]
  );
  const llmStore = React.useMemo(
    () => ({
      getState: () => stateRef.current,
      dispatch,
      generatePlan,
      getAnthropicApiKey: () => null,
    }),
    [dispatch, generatePlan]
  );
  const generatePlanWithLLMAsync = createGeneratePlanWithLLM(llmStore);
  const generatePlanWithLLM = useCallback(
    (payload = {}) => {
      const resolvedCycleId = payload?.cycleId || state.activeCycleId || null;
      const activeMasterPlanId =
        state?.profilesById?.[state?.activeProfileId || '']?.activeMasterPlanId || null;
      if (!resolvedCycleId && activeMasterPlanId) {
        dispatch({
          type: 'GENERATE_PLAN',
          payload: {
            ...(payload || {}),
            cycleId: null,
            masterPlanId: activeMasterPlanId,
            source: 'MASTER_PLAN_FIRST_CYCLE',
          },
        });
        return Promise.resolve();
      }
      return generatePlanWithLLMAsync({
        cycleId: resolvedCycleId,
        anchorDayKey: payload?.anchorDayKey || null,
      });
    },
    [dispatch, generatePlanWithLLMAsync, state.activeCycleId, state.activeProfileId, state.profilesById]
  );
  const generateScheduleForActiveCycle = useCallback(
    (payload = {}) => {
      const resolvedCycleId = payload?.cycleId || state.activeCycleId || null;
      if (!resolvedCycleId) {
        return Promise.resolve();
      }
      dispatch({
        type: 'GENERATE_PLAN',
        payload: {
          cycleId: resolvedCycleId,
          anchorDayKey: payload?.anchorDayKey || null,
        },
      });
      return Promise.resolve();
    },
    [dispatch, state.activeCycleId]
  );
  const commitPreviewItems = useCallback((payload) => dispatch({ type: 'COMMIT_PREVIEW_ITEMS', payload }), []);
  const applyPlan = useCallback((payload = {}) => dispatch({ type: 'APPLY_PLAN', payload }), []);
  const setPlanResolutionKind = useCallback(
    (payload = {}) => dispatch({ type: 'SET_PLAN_RESOLUTION_KIND', payload }),
    []
  );
  const activateSchedule = useCallback((payload = {}) => dispatch({ type: 'ACTIVATE_SCHEDULE', payload }), []);
  const applyDraftSchedule = useCallback(
    (payload = {}) =>
      dispatch({
        type: 'APPLY_DRAFT_SCHEDULE',
        payload: { ...(payload || {}), cycleId: payload?.cycleId || state.activeCycleId || null },
      }),
    [state.activeCycleId]
  );
  const applyRenegotiationOption = useCallback(
    (payload = {}) =>
      dispatch({
        type: 'APPLY_RENEGOTIATION_OPTION',
        payload: { ...(payload || {}), cycleId: payload?.cycleId || state.activeCycleId || null },
      }),
    [state.activeCycleId]
  );
  const setSchedulingConstraints = useCallback(
    (payload = {}) => dispatch({ type: 'SET_SCHEDULING_CONSTRAINTS', payload }),
    []
  );
  const updateWorkWindows = useCallback((payload = {}) => dispatch({ type: 'UPDATE_WORK_WINDOWS', payload }), []);
  const setStrategy = useCallback((payload) => dispatch({ type: 'SET_STRATEGY', payload }), []);
  const generateColdPlan = useCallback(() => dispatch({ type: 'GENERATE_COLD_PLAN' }), []);
  const rebaseColdPlan = useCallback(() => dispatch({ type: 'REBASE_COLD_PLAN' }), []);
  const acceptSuggestedBlock = useCallback(
    (proposalId) => dispatch({ type: 'ACCEPT_SUGGESTED_BLOCK', proposalId }),
    []
  );
  const rejectSuggestedBlock = useCallback(
    (proposalId, reason) => dispatch({ type: 'REJECT_SUGGESTED_BLOCK', proposalId, reason }),
    []
  );
  const ignoreSuggestedBlock = useCallback(
    (proposalId) => dispatch({ type: 'IGNORE_SUGGESTED_BLOCK', proposalId }),
    []
  );
  const dismissSuggestedBlock = useCallback(
    (proposalId) => dispatch({ type: 'DISMISS_SUGGESTED_BLOCK', proposalId }),
    []
  );
  const createDeliverable = useCallback((payload) => dispatch({ type: 'CREATE_DELIVERABLE', payload }), []);
  const updateDeliverable = useCallback((payload) => dispatch({ type: 'UPDATE_DELIVERABLE', payload }), []);
  const deleteDeliverable = useCallback((payload) => dispatch({ type: 'DELETE_DELIVERABLE', payload }), []);
  const createCriterion = useCallback((payload) => dispatch({ type: 'CREATE_CRITERION', payload }), []);
  const toggleCriterionDone = useCallback((payload) => dispatch({ type: 'TOGGLE_CRITERION_DONE', payload }), []);
  const deleteCriterion = useCallback((payload) => dispatch({ type: 'DELETE_CRITERION', payload }), []);
  const linkBlockToDeliverable = useCallback((payload) => dispatch({ type: 'LINK_BLOCK_TO_DELIVERABLE', payload }), []);
  const assignSuggestionLink = useCallback((payload) => dispatch({ type: 'ASSIGN_SUGGESTION_LINK', payload }), []);
  const compileGoalEquation = useCallback((payload) => dispatch({ type: 'COMPILE_GOAL_EQUATION', payload }), []);
  const acceptSuggestedBlockWithPlacement = useCallback((proposalId, payload) => {
    if (!proposalId) {
      return;
    }
    dispatch({ type: 'ACCEPT_SUGGESTED_BLOCK', proposalId });
    dispatch({ type: 'UPDATE_BLOCK', payload: { ...(payload || {}), id: `blk-${proposalId}` } });
  }, []);
  const resetIdentity = useCallback(() => dispatch({ type: 'RESET_IDENTITY' }), []);
  const upsertProfileDetails = useCallback(
    (payload = {}) => dispatch({ type: 'UPSERT_PROFILE_DETAILS', ...payload }),
    []
  );

  const attemptGoalAdmission = useCallback(
    (payload) => {
      const { nextState, result } = attemptGoalAdmissionPure(state, payload);
      dispatch({ type: 'APPLY_NEXT_STATE', nextState });
      return result;
    },
    [state]
  );

  React.useEffect(() => {
    persistState(state);
  }, [state]);

  const store = {
    ...state,
    ...masterPlanActions,
    getState: () => state,
    activePractice,
    activeLens,
    beginBlock,
    completeBlock,
    missBlock,
    skipBlock,
    rescheduleBlock,
    applyLenses,
    setViewDate,
    setSelectedHorizonMode,
    highlightPractice,
    openLens,
    rebalanceToday,
    completeOnboarding,
    finishOnboardingGate,
    updatePendingOnboardingInputs,
    applyOnboardingInputs,
    clearPlanRecovery,
    startNewCycle,
    startNewCycleWithDecision,
    resetActiveCycle,
    completeCycleReassessment,
    endCycle,
    setActiveCycle,
    deleteCycle,
    hardDeleteCycle,
    addTruthEntry,
    createBlock,
    updateBlock,
    deleteBlock,
    addExternalEvidence,
    addFrictionEvent,
    setActiveDayKey,
    jumpToToday,
    tickNow,
    addRecurringPattern,
    setPrimaryObjective,
    applyNextSuggestion,
    setCalibrationDays,
    generatePlan,
    generatePlanWithLLM,
    generatePlanForCycle,
    generateScheduleForActiveCycle,
    commitPreviewItems,
    applyPlan,
    setPlanResolutionKind,
    activateSchedule,
    applyDraftSchedule,
    applyRenegotiationOption,
    setSchedulingConstraints,
    updateWorkWindows,
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
    upsertProfileDetails,
    setDefiniteGoal,
    setAim,
    setPatternTargets,
    attemptGoalAdmission,
    archiveAndCloneCycle,
    ...coreMissionContractActions,
  };

  React.useEffect(() => {
    if (IS_PRODUCTION || typeof window === 'undefined') {
      return undefined;
    }
    let active = true;
    import('../dev/operationEndgameRestore.js')
      .then(({ installOperationEndgameRestore }) => {
        if (active) {
          installOperationEndgameRestore(window);
        }
      })
      .catch(() => {
        // Dev-only helper should never block the app if it fails to load.
      });
    return () => {
      active = false;
    };
  }, []);

  if (typeof window !== 'undefined') {
    window.__jerichoDebug__ = store;
    window.__jerichoResetIntake = () => dispatch({ type: 'MASTER_PLAN_INTAKE_RESET' });
  }

  return React.createElement(
    IdentityContext.Provider,
    {
      value: store,
    },
    children
  );
}

export function useIdentityStore() {
  const ctx = useContext(IdentityContext);
  if (!ctx) {
    throw new Error('useIdentityStore must be used within IdentityProvider');
  }
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
    nextSuggestion: state.nextSuggestion,
  };
}

function loadPersisted() {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem('jericho-identity');
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistState(state) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const persistableState = buildPersistableIdentityState(state);
    localStorage.setItem('jericho-identity', JSON.stringify(persistableState));
  } catch {
    // ignore
  }
}

function isExecutionOutcomeAllowed(state, block) {
  if (!block) {
    return false;
  }
  const cycleId = String(block?.cycleId || state?.activeCycleId || '').trim();
  if (!cycleId) {
    return true;
  }
  const cycle = state?.cyclesById?.[cycleId] || null;
  const lifecycle = String(cycle?.scheduleLifecycle || state?.scheduleLifecycle || '').trim().toLowerCase();
  const hasCreateEvent = Array.isArray(state?.executionEvents)
    ? state.executionEvents.some((event) => event?.kind === 'create' && event?.blockId === block.id && event?.cycleId === cycleId)
    : false;
  const isScheduledCycleBlock =
    Boolean(block?.requiredSystemBlock) ||
    String(block?.origin || '').trim() === 'schedule_active' ||
    hasCreateEvent ||
    lifecycle === 'applied_review' ||
    lifecycle === 'active_schedule';
  if (!isScheduledCycleBlock) {
    return true;
  }
  return lifecycle === 'active_schedule';
}

function buildActivationRequiredError(state, block = null) {
  return {
    code: 'EXECUTION_REQUIRES_ACTIVATION',
    reason: 'Scheduled blocks cannot produce execution evidence until the cycle has been activated.',
    cycleId: block?.cycleId || state?.activeCycleId || null,
    goalId: block?.goalId || state?.activeGoalId || null,
  };
}

function canMutateExecutionBlock(state, block) {
  return isExecutionOutcomeAllowed(state, block);
}

function addMinutesToHHMM(startHHMM = '09:00', durationMinutes = 60) {
  const [startHoursRaw, startMinutesRaw] = String(startHHMM || '09:00')
    .split(':')
    .map((value) => Number(value));
  const startHours = Number.isFinite(startHoursRaw) ? startHoursRaw : 9;
  const startMinutes = Number.isFinite(startMinutesRaw) ? startMinutesRaw : 0;
  const safeDuration = Number.isFinite(durationMinutes) ? Number(durationMinutes) : 60;
  const totalMinutes = Math.max(0, startHours * 60 + startMinutes + safeDuration);
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  const hh = String(Math.max(0, Math.min(23, endHours))).padStart(2, '0');
  const mm = String(Math.max(0, Math.min(59, endMinutes))).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function migrateTemporalBindingToWorkWindows(cycle) {
  if (!cycle?.goalContract) {
    return;
  }
  if (cycle.goalContract.workWindows) {
    return;
  }

  const temporalBinding = cycle.goalContract.temporalBinding;
  if (!temporalBinding) {
    cycle.goalContract.workWindows = emptyWorkWindows();
    return;
  }

  const activeDays = String(temporalBinding.specificDays || '')
    .split(',')
    .map((day) => day.trim().toLowerCase().slice(0, 3))
    .filter((day) => ALL_DAYS.includes(day));
  const start = temporalBinding.activationTime || '09:00';
  const end = addMinutesToHHMM(start, temporalBinding.sessionDurationMinutes ?? 60);

  cycle.goalContract.workWindows = ALL_DAYS.reduce((acc, day) => {
    acc[day] = activeDays.includes(day) ? [{ start, end }] : [];
    return acc;
  }, {});
}

export function ensureTemplates(state) {
  if (!state.templates) {
    state.templates = { objectives: {} };
  }
  if (!state.templates.objectives) {
    state.templates.objectives = {};
  }
  if (!state.blockStore || typeof state.blockStore !== 'object') {
    state.blockStore = { blocks: {} };
  }
  if (!state.blockStore.blocks || typeof state.blockStore.blocks !== 'object') {
    state.blockStore.blocks = {};
  }
  if (!('lastAdaptedDate' in state)) {
    state.lastAdaptedDate = null;
  }
  if (!state.stability) {
    state.stability = { headline: '', actionLine: '' };
  }
  state.today = state.today || {};
  state.today.blocks = Array.isArray(state.today.blocks) ? state.today.blocks : [];
  if (!('nextSuggestion' in state)) {
    state.nextSuggestion = null;
  }
  if (!('planRecovery' in state)) {
    state.planRecovery = null;
  }
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
      showHints: state.meta?.showHints || false,
    };
  }
  if (!state.recurringPatterns) {
    state.recurringPatterns = [];
  }
  if (!state.lastSessionChange) {
    state.lastSessionChange = null;
  }
  if (!state.currentWeek.metrics) {
    state.currentWeek.metrics = {};
  }
  if (!('completionRate' in state.currentWeek.metrics)) {
    state.currentWeek.metrics.completionRate = 0;
  }
  if (!state.ledger) {
    state.ledger = [];
  }
  if (!state.executionEvents) {
    state.executionEvents = [];
  }
  if (!state.goalAdmissionByGoal) {
    state.goalAdmissionByGoal = {};
  }
  if (!state.aspirationsByCycleId) {
    state.aspirationsByCycleId = {};
  }
  if (!('lastPlanError' in state)) {
    state.lastPlanError = null;
  }
  if (!('goalExecutionContract' in state)) {
    state.goalExecutionContract = null;
  }
  if (!('pendingOnboardingInputs' in state)) {
    state.pendingOnboardingInputs = null;
  }
  if (!('planDraft' in state)) {
    state.planDraft = null;
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
  if (!state.suggestedBlocks) {
    state.suggestedBlocks = [];
  }
  if (!state.suggestionEvents) {
    state.suggestionEvents = [];
  }
  if (!state.truthEntries) {
    state.truthEntries = [];
  }
  if (!state.calibrationEvents) {
    state.calibrationEvents = [];
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
  if (!state.directiveEligibilityByGoal) {
    state.directiveEligibilityByGoal = {};
  }
  if (!('goalDirective' in state)) {
    state.goalDirective = null;
  }
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
      isFollowingNow: true,
    };
  } else {
    if (!state.appTime.timeZone) {
      state.appTime.timeZone =
        typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : 'UTC';
    }
    if (!state.appTime.nowISO) {
      state.appTime.nowISO = new Date().toISOString();
    }
    if (!state.appTime.activeDayKey) {
      state.appTime.activeDayKey = dayKeyFromISO(state.appTime.nowISO, state.appTime.timeZone);
    }
    if (typeof state.appTime.isFollowingNow !== 'boolean') {
      state.appTime.isFollowingNow = true;
    }
  }
  const activeCycleId = state.activeCycleId || null;
  if (activeCycleId && state.cyclesById?.[activeCycleId]) {
    const activeCycle = state.cyclesById[activeCycleId];
    const activeTodayDayKey =
      activeCycle?.startedAtDayKey || state.today?.date || nowDayKey(state.appTime?.timeZone || 'UTC');
    const {
      contractDeadline: repairedDeadline,
      goalContract: repairedGoalContract,
      goalGovernanceContract: repairedGoalGovernanceContract,
      goalWorkById: repairedGoalWorkById,
    } = buildDefaultSeedGoalArtifacts(activeTodayDayKey);
    if (!activeCycle.goalContract && state.goalExecutionContract) {
      activeCycle.goalContract = structuredClone
        ? structuredClone(state.goalExecutionContract)
        : JSON.parse(JSON.stringify(state.goalExecutionContract));
      state.cyclesById[activeCycleId] = activeCycle;
    } else if (!activeCycle.goalContract && activeCycleId === 'cycle-1') {
      activeCycle.definiteGoal = activeCycle.definiteGoal || {
        outcome: 'Grow revenue to $10k/month',
        deadlineDayKey: repairedDeadline,
      };
      activeCycle.goalContract = structuredClone
        ? structuredClone(repairedGoalContract)
        : JSON.parse(JSON.stringify(repairedGoalContract));
      activeCycle.goalGovernanceContract = structuredClone
        ? structuredClone(repairedGoalGovernanceContract)
        : JSON.parse(JSON.stringify(repairedGoalGovernanceContract));
      state.goalExecutionContract =
        state.goalExecutionContract ||
        (structuredClone ? structuredClone(repairedGoalContract) : JSON.parse(JSON.stringify(repairedGoalContract)));
      state.activeGoalId = state.activeGoalId || repairedGoalGovernanceContract.goalId;
      state.goalWorkById = {
        ...(state.goalWorkById || {}),
        ...repairedGoalWorkById,
      };
      state.cyclesById[activeCycleId] = activeCycle;
    }
    if (!activeCycle.goalContract) {
      const fallbackGoalIds = Object.keys(state.goalWorkById || {}).filter(Boolean);
      const recoveredGoalId =
        state.goalExecutionContract?.goalId ||
        activeCycle.goalGovernanceContract?.goalId ||
        activeCycle.contract?.goalId ||
        state.activeGoalId ||
        state.planDraft?.goalId ||
        (fallbackGoalIds.length === 1 ? fallbackGoalIds[0] : null);
      const recoveredStartDayKey =
        activeCycle.startedAtDayKey ||
        state.goalExecutionContract?.startDayKey ||
        state.today?.date ||
        nowDayKey(state.appTime?.timeZone || 'UTC');
      const recoveredEndDayKey =
        activeCycle.definiteGoal?.deadlineDayKey ||
        state.goalExecutionContract?.endDayKey ||
        addDays(recoveredStartDayKey, 90, state.appTime?.timeZone || 'UTC');
      const recoveredGoalText =
        activeCycle.definiteGoal?.outcome ||
        state.goalExecutionContract?.goalText ||
        state.lenses?.aim?.description ||
        '';
      const recoveredArtifacts = buildRecoveredGoalArtifacts({
        goalId: recoveredGoalId,
        startDayKey: recoveredStartDayKey,
        endDayKey: recoveredEndDayKey,
        goalText: recoveredGoalText,
        timeZone: state.appTime?.timeZone || 'UTC',
      });
      if (recoveredArtifacts) {
        activeCycle.definiteGoal = activeCycle.definiteGoal || {
          outcome: recoveredGoalText || 'Definite goal',
          deadlineDayKey: recoveredEndDayKey,
        };
        activeCycle.goalContract = structuredClone
          ? structuredClone(recoveredArtifacts.goalContract)
          : JSON.parse(JSON.stringify(recoveredArtifacts.goalContract));
        activeCycle.goalGovernanceContract =
          activeCycle.goalGovernanceContract ||
          (structuredClone
            ? structuredClone(recoveredArtifacts.goalGovernanceContract)
            : JSON.parse(JSON.stringify(recoveredArtifacts.goalGovernanceContract)));
        state.goalExecutionContract = state.goalExecutionContract || {
          goalId: recoveredGoalId,
          goalText: recoveredGoalText,
          startDayKey: recoveredStartDayKey,
          endDayKey: recoveredEndDayKey,
          domains: [],
          successDefinition: recoveredGoalText || 'success',
        };
        state.activeGoalId = state.activeGoalId || recoveredGoalId;
        state.cyclesById[activeCycleId] = activeCycle;
      }
    }
  }

  Object.values(state.cyclesById || {}).forEach((cycle) => {
    migrateTemporalBindingToWorkWindows(cycle);
    const inferredStartDayKey =
      cycle?.startedAtDayKey ||
      cycle?.goalContract?.startDayKey ||
      dayKeyFromISO(cycle?.goalGovernanceContract?.activeFromISO || '', state.appTime?.timeZone || 'UTC') ||
      null;
    if (inferredStartDayKey) {
      if (!cycle.startedAtDayKey) {
        cycle.startedAtDayKey = inferredStartDayKey;
      }
      if (cycle.goalContract && !cycle.goalContract.startDayKey) {
        cycle.goalContract.startDayKey = inferredStartDayKey;
      }
      if (state.activeCycleId && state.activeCycleId === cycle.id) {
        state.goalExecutionContract = state.goalExecutionContract || {};
        if (!state.goalExecutionContract.startDayKey) {
          state.goalExecutionContract.startDayKey = inferredStartDayKey;
        }
      }
    }
  });

  if (state.goalExecutionContract && !state.goalExecutionContract.workWindows) {
    const hasOwnTemporalBinding = Boolean(state.goalExecutionContract.temporalBinding);
    if (hasOwnTemporalBinding) {
      const wrapper = { goalContract: state.goalExecutionContract };
      migrateTemporalBindingToWorkWindows(wrapper);
      state.goalExecutionContract.workWindows = state.goalExecutionContract.workWindows || emptyWorkWindows();
    } else {
      const activeCycle = state.activeCycleId ? state.cyclesById?.[state.activeCycleId] : null;
      const activeCycleWindows = activeCycle?.goalContract?.workWindows || null;
      if (activeCycleWindows) {
        state.goalExecutionContract.workWindows = structuredClone
          ? structuredClone(activeCycleWindows)
          : JSON.parse(JSON.stringify(activeCycleWindows));
        state.goalExecutionContract.workWindowsSource =
          activeCycle?.goalContract?.workWindowsSource || state.goalExecutionContract.workWindowsSource || 'user_defined';
        state.goalExecutionContract.constraintsStatus =
          activeCycle?.goalContract?.constraintsStatus || state.goalExecutionContract.constraintsStatus || 'approved';
        state.goalExecutionContract.capacityValidation =
          activeCycle?.goalContract?.capacityValidation || state.goalExecutionContract.capacityValidation || null;
      } else {
        const wrapper = { goalContract: state.goalExecutionContract };
        migrateTemporalBindingToWorkWindows(wrapper);
        state.goalExecutionContract.workWindows = state.goalExecutionContract.workWindows || emptyWorkWindows();
      }
    }
  }

  return state;
}

/**
 * Pure admission reducer: validates a contract and returns nextState + result
 * This is intentionally pure so it can be tested without React.
 */
export function attemptGoalAdmissionPure(state, admissionInput) {
  const payload =
    admissionInput && typeof admissionInput === 'object' && 'contract' in admissionInput
      ? admissionInput
      : { contract: admissionInput };
  const contract = payload?.contract || null;
  const goalDraftV2 = payload?.goalDraftV2 || contract?.goalDraftV2 || null;
  if (!contract) {
    return {
      nextState: state,
      result: { status: 'REJECTED', rejectionCodes: ['GOAL_CONTRACT_MISSING'] },
    };
  }
  const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  ensureCycleStructures(draft);
  const nowISO = draft.appTime?.nowISO || new Date().toISOString();
  const timeZone = draft.appTime?.timeZone || 'UTC';
  const appNowDayKey = dayKeyFromISO(nowISO, timeZone);
  const effectiveTodayDayKey = appNowDayKey || nowDayKey(timeZone);
  const normalizeToDayKey = (value) => {
    const text = String(value || '').trim();
    if (!text) {
      return null;
    }
    const explicitDayKeyMatch = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(text);
    if (explicitDayKeyMatch) {
      return explicitDayKeyMatch[1];
    }
    return dayKeyFromISO(text, timeZone);
  };
  const inferredStartDayKey =
    normalizeToDayKey(contract?.startDayKey) ||
    normalizeToDayKey(contract?.startDateISO) ||
    normalizeToDayKey(contract?.startDate) ||
    normalizeToDayKey(contract?.temporalBinding?.startDayKey) ||
    effectiveTodayDayKey;
  if (inferredStartDayKey < effectiveTodayDayKey) {
    const rejectionCode = GoalRejectionCode.START_DAY_BEFORE_ACTIVE_DAY;
    const rejectionReason = `Inferred start day ${inferredStartDayKey} is before current day ${effectiveTodayDayKey}.`;
    const aspirationId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const aspiration = {
      id: aspirationId,
      createdAtISO: nowISO,
      contractDraft: structuredClone ? structuredClone(contract) : JSON.parse(JSON.stringify(contract)),
      rejectionCodes: [rejectionCode],
      rejectionReason,
    };
    draft.aspirations = draft.aspirations || [];
    draft.aspirations.push(aspiration);
    if (!draft.aspirationsByCycleId) {
      draft.aspirationsByCycleId = {};
    }
    const forCycle = draft.activeCycleId || 'global';
    draft.aspirationsByCycleId[forCycle] = draft.aspirationsByCycleId[forCycle] || [];
    draft.aspirationsByCycleId[forCycle].push(aspiration);
    const nextState = computeDerivedState(draft, { type: 'NO_OP' });
    return {
      nextState,
      result: { status: 'REJECTED', aspirationId, rejectionCodes: [rejectionCode], rejectionReason },
    };
  }

  const activeCycles = Object.values(draft.cyclesById || {}).filter((cycle) => cycle?.status === 'Active');
  const existingOutcomes = activeCycles
    .map((c) => c?.goalContract?.terminalOutcome?.text || c?.definiteGoal?.outcome || '')
    .filter(Boolean);
  const activeGoalSignatures = activeCycles
    .map((c) => c?.goalHash || c?.goalContract?.inscription?.contractHash)
    .filter(Boolean);

  // Check for compound goal (multiple outcomes) - POLICY ENFORCEMENT
  const compoundCheck = detectCompoundGoal(contract);
  if (compoundCheck.isCompound) {
    // Reject compound goals with specific code
    const validation = {
      status: 'REJECTED',
      rejectionCodes: ['MULTIPLE_OUTCOMES_DETECTED'],
    };

    const aspirationId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const aspiration = {
      id: aspirationId,
      createdAtISO: nowISO,
      contractDraft: structuredClone ? structuredClone(contract) : JSON.parse(JSON.stringify(contract)),
      rejectionCodes: validation.rejectionCodes || [],
      rejectionReason: `Goal contains multiple outcomes: ${compoundCheck.outcomes.join('; ')}. Please choose one primary objective for this cycle.`,
    };

    draft.aspirations = draft.aspirations || [];
    draft.aspirations.push(aspiration);

    if (!draft.aspirationsByCycleId) {
      draft.aspirationsByCycleId = {};
    }
    const forCycle = draft.activeCycleId || 'global';
    draft.aspirationsByCycleId[forCycle] = draft.aspirationsByCycleId[forCycle] || [];
    draft.aspirationsByCycleId[forCycle].push(aspiration);

    const nextState = computeDerivedState(draft, { type: 'NO_OP' });
    return {
      nextState,
      result: {
        status: 'REJECTED',
        aspirationId: aspiration.id,
        rejectionCodes: validation.rejectionCodes,
        rejectionReason: aspiration.rejectionReason,
      },
    };
  }

  const validation = validateGoalAdmission(contract, nowISO, existingOutcomes, activeGoalSignatures);

  if (validation.status === 'REJECTED') {
    const aspirationId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const aspiration = {
      id: aspirationId,
      createdAtISO: nowISO,
      contractDraft: structuredClone ? structuredClone(contract) : JSON.parse(JSON.stringify(contract)),
      rejectionCodes: validation.rejectionCodes || [],
    };

    draft.aspirations = draft.aspirations || [];
    draft.aspirations.push(aspiration);

    // Maintain per-cycle aspirations mapping if available
    if (!draft.aspirationsByCycleId) {
      draft.aspirationsByCycleId = {};
    }
    const forCycle = draft.activeCycleId || 'global';
    draft.aspirationsByCycleId[forCycle] = draft.aspirationsByCycleId[forCycle] || [];
    draft.aspirationsByCycleId[forCycle].push(aspiration);

    const nextState = computeDerivedState(draft, { type: 'NO_OP' });
    return {
      nextState,
      result: { status: 'REJECTED', aspirationId: aspiration.id, rejectionCodes: validation.rejectionCodes },
    };
  }

  const admittedExecutionType =
    goalDraftV2?.executionType || contract?.goalDraftV2?.executionType || contract?.executionType || null;
  const intakeContract = buildGoalIntakeContract({
    goalId: contract?.goalId || null,
    rawGoalText:
      goalDraftV2?.goalLabel ||
      goalDraftV2?.goalText ||
      contract?.goalLabel ||
      contract?.goalText ||
      contract?.terminalOutcome?.text ||
      contract?.terminalOutcome?.verificationCriteria ||
      '',
    verificationCriteria: contract?.terminalOutcome?.verificationCriteria || '',
    executionType: admittedExecutionType,
    deadline: contract?.deadline?.dayKey || contract?.endDayKey || contract?.deadlineISO || contract?.deadline || null,
    goalDraftV2,
    contract,
  });

  if (!intakeContract.readiness.isReadyForPlanning) {
    const rejectionCode = getIntakeGateCode(intakeContract);
    const rejectionReason = intakeContract.requiredContextQuestions.length
      ? intakeContract.requiredContextQuestions[0].prompt
      : 'Goal intake is not ready for planning.';
    const aspirationId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const aspiration = {
      id: aspirationId,
      createdAtISO: nowISO,
      contractDraft: structuredClone ? structuredClone(contract) : JSON.parse(JSON.stringify(contract)),
      rejectionCodes: [rejectionCode],
      rejectionReason,
    };
    draft.aspirations = draft.aspirations || [];
    draft.aspirations.push(aspiration);
    if (!draft.aspirationsByCycleId) {
      draft.aspirationsByCycleId = {};
    }
    const forCycle = draft.activeCycleId || 'global';
    draft.aspirationsByCycleId[forCycle] = draft.aspirationsByCycleId[forCycle] || [];
    draft.aspirationsByCycleId[forCycle].push(aspiration);

    const nextState = computeDerivedState(draft, { type: 'NO_OP' });
    return {
      nextState,
      result: {
        status: 'REJECTED',
        aspirationId,
        rejectionCodes: [rejectionCode],
        rejectionReason,
      },
    };
  }

  const admittedGoalText =
    goalDraftV2?.goalLabel ||
    goalDraftV2?.goalText ||
    contract?.goalLabel ||
    contract?.goalText ||
    contract?.terminalOutcome?.text ||
    contract?.terminalOutcome?.verificationCriteria ||
    '';
  const activeProfileId = String(draft.activeProfileId || DEFAULT_PROFILE_ID).trim() || DEFAULT_PROFILE_ID;
  draft.profilesById = draft.profilesById && typeof draft.profilesById === 'object' ? draft.profilesById : {};
  if (!draft.profilesById[activeProfileId]) {
    draft.profilesById[activeProfileId] = {
      id: activeProfileId,
      ...normalizeProfileIdentity({ label: DEFAULT_PROFILE_LABEL }),
      goalIds: [],
      activeGoalId: null,
      createdAtISO: nowISO,
      status: 'active',
    };
  }
  draft.goalsById = draft.goalsById && typeof draft.goalsById === 'object' ? draft.goalsById : {};
  const normalizedGoalContract = structuredClone ? structuredClone(contract) : JSON.parse(JSON.stringify(contract));
  normalizedGoalContract.admissionStatus = 'ADMITTED';
  normalizedGoalContract.executionType = admittedExecutionType;
  normalizedGoalContract.goalDraftV2 = goalDraftV2 || normalizedGoalContract.goalDraftV2 || null;
  normalizedGoalContract.goalIntakeContract = intakeContract;
  normalizedGoalContract.planningIntake = intakeContract.planningIntake || null;
  normalizedGoalContract.prePlanFeasibility = intakeContract.prePlanFeasibility || null;
  normalizedGoalContract.profileId = normalizedGoalContract.profileId || activeProfileId;
  if (!normalizedGoalContract.goalText && admittedGoalText) {
    normalizedGoalContract.goalText = admittedGoalText;
  }
  if (!normalizedGoalContract.goalLabel && admittedGoalText) {
    normalizedGoalContract.goalLabel = admittedGoalText;
  }

  // ADMITTED -> attach to active blank cycle when possible, otherwise create a new cycle.
  const existingActiveId = draft.activeCycleId || null;
  const existingActiveCycle = existingActiveId ? draft.cyclesById?.[existingActiveId] || null : null;
  const existingStatus = String(existingActiveCycle?.status || existingActiveCycle?.state || '')
    .trim()
    .toLowerCase();
  const canAttachToActiveBlankCycle = Boolean(
    existingActiveCycle && existingStatus === 'active' && !existingActiveCycle.goalContract
  );
  const newCycleId = canAttachToActiveBlankCycle
    ? existingActiveId
    : crypto?.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  const newCycle = canAttachToActiveBlankCycle
    ? {
        ...existingActiveCycle,
        id: newCycleId,
        status: 'Active',
        endedAtISO: null,
      }
    : {
        id: newCycleId,
        status: 'Active',
        createdAtISO: nowISO,
        endedAtISO: null,
        executionEvents: [],
        suggestionEvents: [],
        proposedBlocks: [],
        suggestedBlocks: [],
        truthEntries: [],
      };
  newCycle.profileId = activeProfileId;
  newCycle.goalId = normalizedGoalContract?.goalId || newCycle.goalId || null;
  newCycle.goalContract = normalizedGoalContract;
  newCycle.goalDraftV2 = goalDraftV2 || null;
  newCycle.goalHash = contract?.inscription?.contractHash || null;
  const deadlineDayKey =
    normalizedGoalContract?.deadline?.dayKey ||
    normalizedGoalContract?.endDayKey ||
    normalizedGoalContract?.deadlineISO ||
    null;
  const explicitStartDayKey =
    normalizeToDayKey(normalizedGoalContract?.startDayKey) ||
    normalizeToDayKey(normalizedGoalContract?.startDateISO) ||
    normalizeToDayKey(normalizedGoalContract?.startDate) ||
    null;
  const startDayKey = explicitStartDayKey || effectiveTodayDayKey;
  normalizedGoalContract.startDayKey = startDayKey;
  const timezone = timeZone;
  newCycle.goalGovernanceContract = {
    contractId: `gov-${newCycleId}`,
    version: 1,
    goalId: normalizedGoalContract?.goalId || null,
    profileId: activeProfileId,
    activeFromISO: startDayKey,
    activeUntilISO: deadlineDayKey || null,
    scope: {
      domainsAllowed: [],
      timeHorizon: 'week',
      timezone,
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
  newCycle.definiteGoal = {
    outcome: admittedGoalText || newCycle?.definiteGoal?.outcome || 'Definite goal',
    deadlineDayKey: deadlineDayKey || newCycle?.definiteGoal?.deadlineDayKey || null,
  };
  newCycle.startedAtDayKey = startDayKey;
  newCycle.executionEvents = [];
  newCycle.suggestionEvents = [];
  newCycle.proposedBlocks = [];
  newCycle.suggestedBlocks = [];
  newCycle.truthEntries = [];

  draft.cyclesById = draft.cyclesById || {};
  draft.cyclesById[newCycleId] = newCycle;
  if (!canAttachToActiveBlankCycle) {
    draft.cycleOrder = Array.isArray(draft.cycleOrder) ? [...draft.cycleOrder, newCycleId] : [newCycleId];
  }
  draft.activeCycleId = newCycleId;
  draft.viewDate = startDayKey;
  if (draft.appTime) {
    draft.appTime.activeDayKey = startDayKey;
  }
  draft.goalAdmissionByGoal = draft.goalAdmissionByGoal || {};
  if (normalizedGoalContract?.goalId) {
    const goalId = normalizedGoalContract.goalId;
    const existingGoalRecord = draft.goalsById[goalId] || {};
    const existingCycleIds = Array.isArray(existingGoalRecord.cycleIds) ? existingGoalRecord.cycleIds : [];
    draft.goalsById[goalId] = {
      ...existingGoalRecord,
      id: goalId,
      profileId: activeProfileId,
      cycleIds: existingCycleIds.includes(newCycleId) ? existingCycleIds : [...existingCycleIds, newCycleId],
      activeCycleId: newCycleId,
      status: existingGoalRecord.status || 'active',
      title:
        existingGoalRecord.title ||
        normalizedGoalContract.goalLabel ||
        normalizedGoalContract.goalText ||
        admittedGoalText ||
        null,
    };
    const profileGoalIds = Array.isArray(draft.profilesById[activeProfileId].goalIds)
      ? draft.profilesById[activeProfileId].goalIds
      : [];
    draft.profilesById[activeProfileId].goalIds = profileGoalIds.includes(goalId)
      ? profileGoalIds
      : [...profileGoalIds, goalId];
    draft.profilesById[activeProfileId].activeGoalId = goalId;
    draft.goalAdmissionByGoal[normalizedGoalContract.goalId] = {
      status: 'ADMITTED',
      reasonCodes: [],
      admittedAtISO: nowISO,
    };
  }
  draft.goalExecutionContract = {
    ...(draft.goalExecutionContract || {}),
    goalId: normalizedGoalContract?.goalId || draft.goalExecutionContract?.goalId || null,
    profileId: activeProfileId,
    goalText: admittedGoalText || draft.goalExecutionContract?.goalText || '',
    startDayKey,
    endDayKey:
      normalizedGoalContract?.endDayKey ||
      normalizedGoalContract?.deadline?.dayKey ||
      normalizedGoalContract?.deadlineISO ||
      draft.goalExecutionContract?.endDayKey ||
      null,
    workWindows: normalizedGoalContract?.workWindows || draft.goalExecutionContract?.workWindows || null,
    executionType: admittedExecutionType,
    goalDraftV2: goalDraftV2 || null,
    goalIntakeContract: intakeContract,
    planningIntake: intakeContract.planningIntake || null,
    prePlanFeasibility: intakeContract.prePlanFeasibility || null,
  };
  draft.pendingOnboardingInputs = null;
  draft.planRecovery = null;

  // STEP 2: Auto-seed deliverables if none exist
  if (!draft.deliverablesByCycleId) {
    draft.deliverablesByCycleId = {};
  }
  const cycleDeliverablesEntry = draft.deliverablesByCycleId[newCycleId] || {
    cycleId: newCycleId,
    deliverables: [],
    suggestionLinks: {},
    lastUpdatedAtISO: nowISO,
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
      rationale: autoResult.rationale,
    };
  }

  draft.deliverablesByCycleId[newCycleId] = cycleDeliverablesEntry;

  // STEP 3: Initialize cycle.strategy with auto-seeded deliverables
  // This ensures they're visible in cycle.strategy.deliverables immediately after admission
  const deadline = contract?.deadline?.dayKey || contract?.endDayKey || null;
  const workWindows = normalizedGoalContract?.workWindows || null;
  const workDays = getWorkDaysFromWindows(workWindows);
  const weeklyCapMinutes = computeWeeklyCapacityFromWorkWindows(workWindows);
  const maxDailyMinutes = computeMaxDailyMinutesFromWorkWindows(workWindows);
  newCycle.strategy = {
    deadlineISO: deadline ? `${deadline}T23:59:59Z` : null,
    deliverables: cycleDeliverablesEntry.deliverables || [],
    constraints: {
      maxBlocksPerDay: maxDailyMinutes > 0 ? Math.max(1, Math.ceil(maxDailyMinutes / 120)) : 4,
      maxBlocksPerWeek: weeklyCapMinutes > 0 ? Math.max(1, Math.ceil(weeklyCapMinutes / 120)) : 16,
      weeklyCapacityMinutes: weeklyCapMinutes,
      preferredDaysOfWeek: workDaysToWeekdayIndexes(workDays),
      blackoutDayKeys: [],
      tz: draft.appTime?.timeZone || 'UTC',
    },
    assumptionsHash: null,
  };
  const bootstrappedActions = bootstrapActionsFromDeliverables(newCycleId, cycleDeliverablesEntry.deliverables || []);
  newCycle.actions = bootstrappedActions;
  newCycle.executionGraphReady = bootstrappedActions.length > 0;
  if (bootstrappedActions.length > 0) {
    newCycle.planProof = buildAdmissionPlanProofFromActions(bootstrappedActions);
  }
  draft.cyclesById[newCycleId] = newCycle;

  if (!newCycle.executionGraphReady) {
    draft.lastPlanError = {
      code: 'ACTION_GRAPH_MISSING',
      reason: 'Goal admission completed without a validated execution graph.',
      reasonCodes: ['NO_ACTION_GRAPH'],
      cycleId: newCycleId,
      actionType: 'ATTEMPT_GOAL_ADMISSION',
    };
  } else if (draft.lastPlanError?.code === 'ACTION_GRAPH_MISSING') {
    draft.lastPlanError = null;
  }

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
      if (!b || b.id !== id) {
        return;
      }
      if (!found) {
        found = b;
      }
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

function markStatusAcrossProjections(state, id, status) {
  let found = null;
  const touch = (blocks = []) => {
    blocks.forEach((b) => {
      if (!b || b.id !== id) return;
      if (!found) found = b;
      b.status = status;
    });
  };
  touch(state.today?.blocks);
  (state.currentWeek?.days || []).forEach((d) => touch(d.blocks));
  (state.cycle || []).forEach((d) => touch(d.blocks));
  return found;
}

export { identityReducer };
