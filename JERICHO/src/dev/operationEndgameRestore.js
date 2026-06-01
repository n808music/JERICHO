import {
  buildBlankIdentityState,
  buildPersistableIdentityState,
  DEFAULT_PROFILE_ID,
} from '../state/identityStore.js';
import { computeDerivedState } from '../state/identityCompute.js';
import { applyMasterPlanAction } from '../state/masterPlanStore.js';
import { IS_PRODUCTION } from '../utils/runtimeEnv.js';

export const OPERATION_ENDGAME_GOAL_TEXT =
  'Coordinate Operation Endgame as a 5-year multi-lane master plan across product, creative, media, operations, revenue, capital, institution, and civic pathways.';
export const OPERATION_ENDGAME_SUCCESS_STATE =
  'Build an active scaling ecosystem with validated product, creative, media, operations, revenue, capital, institution, and civic pathways through the 2031 strategic horizon.';
// Falsifiable terminal target: each active lane must show externally verifiable
// proof of scale by 2031-05-19. Specific dollar/user/audience thresholds are
// intentionally left to the next plan-quality review so the seed does not
// fabricate numbers the user hasn't stated.
export const OPERATION_ENDGAME_OUTCOME_TARGET =
  'By 2031-05-19, every active lane shows externally verifiable proof of scale: a shipping product with a paying user base, a published creative catalog with sustained audience, a recurring revenue stream, and a funded capital pathway or signed institutional/civic partnership. Specific dollar, user, and audience thresholds to be set at the next plan-quality review.';
export const OPERATION_ENDGAME_CONSTRAINT =
  'Capital is constrained and near-term revenue matters. The system must coordinate multiple lanes without losing full-horizon truth.';
export const OPERATION_ENDGAME_NON_NEGOTIABLE =
  'Ownership, execution discipline, and mission continuity cannot slip.';

const DEFAULT_NOW_ISO = '2026-05-19T12:00:00.000Z';
const DEFAULT_TODAY_DATE = '2026-05-19';
const DEFAULT_HORIZON_END = '2031-05-19';
const DEFAULT_HORIZON_MONTHS = 60;
export const OPERATION_ENDGAME_REFERENCE_PROFILE_ID = 'profile-james-endgame';
export const OPERATION_ENDGAME_REFERENCE_PROFILE_DISPLAY_NAME = 'James / Operation Endgame';
export const OPERATION_ENDGAME_REFERENCE_PROFILE_ROLE = 'GSS founder';
const FOUNDATION_ANCHOR_DATE = '2026-06-15';
const PRIMARY_ANCHOR_DATE = '2026-10-17';
const P2_GATE_DATE = '2028-06-15';
const P2_MILESTONES = [
  {
    laneDomain: 'product',
    title: 'Validate repeatable conversion path',
    targetDate: '2027-05-15',
    derivedFrom: 'anchorId:anchor-p2-gate - 13 months',
    missConsequence: 'P2 cannot scale product acquisition without a repeatable conversion path.',
  },
  {
    laneDomain: 'brand',
    title: 'Establish operating cadence dashboard',
    targetDate: '2027-09-15',
    derivedFrom: 'anchorId:anchor-p2-gate - 9 months',
    missConsequence: 'Execution system remains reactive without a stable operating cadence.',
  },
  {
    laneDomain: 'income',
    title: 'Prove revenue conversion architecture',
    targetDate: '2027-12-15',
    derivedFrom: 'anchorId:anchor-p2-gate - 6 months',
    missConsequence: 'Revenue bridge stays provisional without a tested conversion architecture.',
  },
  {
    laneDomain: 'media',
    title: 'Widen channel distribution loop',
    targetDate: '2028-03-15',
    derivedFrom: 'anchorId:anchor-p2-gate - 3 months',
    missConsequence: 'Audience growth remains narrow without a widened distribution loop.',
  },
  {
    laneDomain: 'brand',
    title: 'Stabilize cross-lane execution loop',
    targetDate: '2028-05-15',
    derivedFrom: 'anchorId:anchor-p2-gate - 1 month',
    missConsequence: 'P2 review gate cannot pass without a stable cross-lane execution loop.',
  },
];
const STORAGE_KEY = 'jericho-identity';
const BACKUP_LATEST_KEY = 'jericho-identity-backup-latest';
const BACKUP_LATEST_POINTER_KEY = 'jericho-identity-backup-latest-key';
const BACKUP_PREFIX = 'jericho-identity-backup:';

function buildLaneAnswers(index, config) {
  return {
    [`lane_${index}_description`]: config.description,
    [`lane_${index}_system_assessment`]: {
      assessedStage: config.assessedStage,
      assessedConfidence: config.assessedConfidence || 'high',
      assessmentNotes: config.description,
    },
    [`lane_${index}_activation`]: config.activation,
    [`lane_${index}_clarifying_0`]: config.description,
  };
}

function buildLaneConfigs() {
  return [
    {
      title: 'Operation Endgame product platform',
      domain: 'product',
      role: 'revenue-engine',
      activation: 'active',
      assessedStage: 'in-development',
      description: 'Product lane is active and building the platform, onboarding path, and proof substrate.',
    },
    {
      title: 'Operation Endgame album release engine',
      domain: 'creative',
      role: 'proof-artifact',
      activation: 'active',
      assessedStage: 'ready-to-launch',
      description: 'Creative lane is active and anchored to the October 17 album drop proof event.',
    },
    {
      title: 'Operation Endgame media narrative pipeline',
      domain: 'media',
      role: 'audience-engine',
      activation: 'active',
      assessedStage: 'pilot-running',
      description: 'Media lane is active and translating strategic proof into repeatable audience narrative.',
    },
    {
      title: 'Operation Endgame brand and operations system',
      domain: 'brand',
      role: 'operating-system',
      activation: 'active',
      assessedStage: 'active',
      description: 'Brand and operations lane is active and stabilizing the execution system around the mission.',
    },
    {
      title: 'Operation Endgame runway bridge',
      domain: 'income',
      role: 'runway-protection',
      activation: 'active',
      assessedStage: 'earning',
      description: 'Income lane is active and protecting runway while the larger ecosystem compounds.',
    },
    {
      title: 'Operation Endgame capital stack',
      domain: 'capital',
      role: 'asset-path',
      activation: 'incubating',
      assessedStage: 'blocked-by-capital',
      description: 'Capital lane is incubating until current proof and revenue support direct expansion.',
    },
    {
      title: 'Operation Endgame institution design',
      domain: 'institution',
      role: 'institution-builder',
      activation: 'incubating',
      assessedStage: 'conceptual',
      description: 'Institution lane is incubating until the operating model has stronger proof and repeatability.',
    },
    {
      title: 'Operation Endgame civic coalition path',
      domain: 'civic',
      role: 'district-builder',
      activation: 'incubating',
      assessedStage: 'conceptual',
      description: 'Civic lane is incubating until credibility, capital, and local proof are sufficient.',
    },
  ];
}

function getFixturePlan(state) {
  const profile = state?.profilesById?.[DEFAULT_PROFILE_ID] || null;
  const planId = String(profile?.activeMasterPlanId || '').trim() || null;
  const plan = planId ? state?.masterPlansById?.[planId] || null : null;
  return { profile, planId, plan };
}

function buildBackupKey(nowISO = new Date().toISOString()) {
  return `${BACKUP_PREFIX}${String(nowISO).replace(/[:.]/g, '-')}`;
}

function isQuotaExceededError(error) {
  return Boolean(
    error &&
      (error.name === 'QuotaExceededError' ||
        error.code === 22 ||
        error.code === 1014 ||
        /quota/i.test(String(error.message || '')))
  );
}

function listStorageKeys(storage) {
  if (!storage) {
    return [];
  }
  if (typeof storage.length === 'number' && typeof storage.key === 'function') {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (typeof key === 'string' && key) {
        keys.push(key);
      }
    }
    return keys;
  }
  return Object.keys(storage).filter((key) => typeof storage?.getItem === 'function' && storage.getItem(key) !== null);
}

function removeStorageKey(storage, key) {
  if (!storage || !key) {
    return;
  }
  if (typeof storage.removeItem === 'function') {
    storage.removeItem(key);
  }
}

function pruneBackupKeys(storage) {
  const prunedKeys = [];
  listStorageKeys(storage)
    .filter((key) => key.startsWith(BACKUP_PREFIX) || key === BACKUP_LATEST_KEY || key === BACKUP_LATEST_POINTER_KEY)
    .forEach((key) => {
      removeStorageKey(storage, key);
      prunedKeys.push(key);
    });
  return prunedKeys;
}

function buildCompactBackupMetadata(previousRaw, nowISO) {
  let parsed = null;
  try {
    parsed = previousRaw ? JSON.parse(previousRaw) : null;
  } catch {
    parsed = null;
  }
  const profileId = parsed?.activeProfileId || null;
  const profile = profileId ? parsed?.profilesById?.[profileId] || null : null;
  return {
    type: 'compact-backup-metadata',
    createdAtISO: nowISO,
    approxBytes: String(previousRaw || '').length,
    activeProfileId: profileId,
    activeGoalId: parsed?.activeGoalId || profile?.activeGoalId || null,
    activeMasterPlanId: profile?.activeMasterPlanId || null,
    activeCycleId: parsed?.activeCycleId || null,
    masterPlanCount: Object.keys(parsed?.masterPlansById || {}).length,
    goalCount: Object.keys(parsed?.goalsById || {}).length,
  };
}

function writeBackupSnapshot(storage, previousRaw, nowISO) {
  const prunedKeys = pruneBackupKeys(storage);
  if (!previousRaw) {
    return {
      backupStatus: 'skipped',
      backupKey: null,
      backupPointer: null,
      prunedKeys,
      backupError: null,
    };
  }

  const backupKey = buildBackupKey(nowISO);
  try {
    storage.setItem(backupKey, previousRaw);
    storage.setItem(BACKUP_LATEST_KEY, previousRaw);
    storage.setItem(BACKUP_LATEST_POINTER_KEY, backupKey);
    return {
      backupStatus: 'full',
      backupKey,
      backupPointer: backupKey,
      prunedKeys,
      backupError: null,
    };
  } catch (error) {
    removeStorageKey(storage, backupKey);
    removeStorageKey(storage, BACKUP_LATEST_KEY);
    removeStorageKey(storage, BACKUP_LATEST_POINTER_KEY);

    const compactKey = `${backupKey}:compact`;
    const compactMetadata = JSON.stringify(buildCompactBackupMetadata(previousRaw, nowISO));
    try {
      storage.setItem(BACKUP_LATEST_KEY, compactMetadata);
      storage.setItem(BACKUP_LATEST_POINTER_KEY, compactKey);
      return {
        backupStatus: 'compact',
        backupKey: null,
        backupPointer: compactKey,
        prunedKeys,
        backupError: isQuotaExceededError(error) ? 'quota-exceeded' : String(error?.message || error || 'backup-write-failed'),
      };
    } catch (compactError) {
      removeStorageKey(storage, BACKUP_LATEST_KEY);
      removeStorageKey(storage, BACKUP_LATEST_POINTER_KEY);
      return {
        backupStatus: 'failed',
        backupKey: null,
        backupPointer: null,
        prunedKeys,
        backupError: isQuotaExceededError(compactError)
          ? 'quota-exceeded'
          : String(compactError?.message || compactError || 'backup-write-failed'),
      };
    }
  }
}

function parsePersistedState(raw) {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasNamedProfile(profile) {
  const displayName = String(profile?.displayName || profile?.label || '').trim();
  if (!displayName) {
    return false;
  }
  return displayName.toLowerCase() !== 'local profile';
}

function preserveExistingProfileMetadata(state, previousState) {
  if (!state?.profilesById || !previousState?.profilesById) {
    return state;
  }
  const previousActiveProfileId = String(previousState?.activeProfileId || '').trim() || DEFAULT_PROFILE_ID;
  const previousActiveProfile = previousState?.profilesById?.[previousActiveProfileId] || null;
  if (!hasNamedProfile(previousActiveProfile)) {
    return state;
  }

  const targetProfileId = String(state?.activeProfileId || DEFAULT_PROFILE_ID).trim() || DEFAULT_PROFILE_ID;
  const targetProfile = state.profilesById?.[targetProfileId] || null;
  if (!targetProfile) {
    return state;
  }

  const preservedDisplayName = String(previousActiveProfile.displayName || previousActiveProfile.label || '').trim();
  const preservedRoleLabel = String(
    previousActiveProfile.roleLabel || previousActiveProfile.profileRole || ''
  ).trim();
  const preservedLabel = String(previousActiveProfile.label || preservedDisplayName).trim() || preservedDisplayName;

  state.profilesById[targetProfileId] = {
    ...targetProfile,
    displayName: preservedDisplayName || targetProfile.displayName || targetProfile.label || 'Local Profile',
    label: preservedLabel || targetProfile.label || targetProfile.displayName || 'Local Profile',
    roleLabel: preservedRoleLabel || targetProfile.roleLabel || null,
    profileRole: preservedRoleLabel || targetProfile.profileRole || null,
  };
  state.activeProfileId = targetProfileId;
  return state;
}

function retargetProfileScopedCollections(state, sourceProfileId, targetProfileId) {
  [
    'goalsById',
    'cyclesById',
    'masterPlansById',
    'masterPlanLanesById',
    'masterPlanAnchorsById',
    'masterPlanMilestonesById',
    'masterPlanAgendaVersionsById',
    'scheduleConstraintVersionsById',
    'masterCalendarsById',
  ].forEach((collectionKey) => {
    Object.values(state?.[collectionKey] || {}).forEach((entry) => {
      if (entry?.profileId === sourceProfileId) {
        entry.profileId = targetProfileId;
      }
    });
  });
}

export function promoteOperationEndgameReferenceProfile(
  state,
  {
    profileId = OPERATION_ENDGAME_REFERENCE_PROFILE_ID,
    displayName = OPERATION_ENDGAME_REFERENCE_PROFILE_DISPLAY_NAME,
    roleLabel = OPERATION_ENDGAME_REFERENCE_PROFILE_ROLE,
  } = {}
) {
  if (!state?.profilesById?.[DEFAULT_PROFILE_ID]) {
    return state;
  }

  const targetProfileId = String(profileId || OPERATION_ENDGAME_REFERENCE_PROFILE_ID).trim();
  const masterCalendarId = `calendar-${targetProfileId}`;
  const sourceProfile = state.profilesById[DEFAULT_PROFILE_ID];
  const promotedProfile = {
    ...sourceProfile,
    id: targetProfileId,
    displayName,
    label: displayName,
    roleLabel,
    profileRole: roleLabel,
    masterCalendarId,
    status: 'active',
  };

  delete state.profilesById[DEFAULT_PROFILE_ID];
  state.profilesById[targetProfileId] = promotedProfile;
  retargetProfileScopedCollections(state, DEFAULT_PROFILE_ID, targetProfileId);

  state.masterCalendarsById =
    state.masterCalendarsById && typeof state.masterCalendarsById === 'object' ? state.masterCalendarsById : {};
  Object.keys(state.masterCalendarsById).forEach((calendarId) => {
    if (calendarId === `calendar-${DEFAULT_PROFILE_ID}`) {
      delete state.masterCalendarsById[calendarId];
    }
  });
  state.masterCalendarsById[masterCalendarId] = {
    ...(state.masterCalendarsById[masterCalendarId] || {}),
    id: masterCalendarId,
    profileId: targetProfileId,
    activeGoalIds: Array.isArray(promotedProfile.goalIds) ? promotedProfile.goalIds : [],
    activeCycleIds: Array.isArray(promotedProfile.cycleIds) ? promotedProfile.cycleIds : [],
    availableCapacityHours: state.masterCalendarsById[masterCalendarId]?.availableCapacityHours || 40,
    capacityLoadHours: state.masterCalendarsById[masterCalendarId]?.capacityLoadHours || 0,
    status: 'active',
  };

  if (state.masterPlanIntake?.profileId === DEFAULT_PROFILE_ID) {
    state.masterPlanIntake.profileId = targetProfileId;
  }

  state.activeProfileId = targetProfileId;
  state.profileAccess = {
    status: 'profile_selected',
    selectedProfileId: targetProfileId,
    lastSelectedAtISO: state.appTime?.nowISO || new Date().toISOString(),
  };

  return computeDerivedState(state, { type: 'NO_OP' });
}

function addP2Milestones(state, nowISO) {
  const { planId, plan } = getFixturePlan(state);
  if (!planId || !plan) {
    return state;
  }

  const laneByDomain = new Map(
    (Array.isArray(plan?.laneIds) ? plan.laneIds : [])
      .map((laneId) => state?.masterPlanLanesById?.[laneId] || null)
      .filter(Boolean)
      .map((lane) => [String(lane?.domain || '').trim().toLowerCase(), lane])
  );

  const existingMilestones = Object.values(state?.masterPlanMilestonesById || {});
  P2_MILESTONES.forEach((entry) => {
    const lane = laneByDomain.get(entry.laneDomain);
    if (!lane) {
      return;
    }
    const alreadyExists = existingMilestones.some(
      (milestone) =>
        milestone?.laneId === lane.id &&
        String(milestone?.title || '').trim().toLowerCase() === entry.title.toLowerCase()
    );
    if (alreadyExists) {
      return;
    }
    applyMasterPlanAction(state, {
      type: 'ADD_MASTER_PLAN_MILESTONE',
      laneId: lane.id,
      nowISO,
      payload: {
        anchorId: 'anchor-p2-gate',
        title: entry.title,
        description: entry.title,
        milestoneType: 'checkpoint',
        targetDate: entry.targetDate,
        derivedFrom: entry.derivedFrom,
        flex: 'medium',
        missConsequence: entry.missConsequence,
        origin: 'system',
      },
    });
  });

  return state;
}

export function buildPersistableOperationEndgameFixtureState(state) {
  return buildPersistableIdentityState(state);
}

export function buildOperationEndgameFixtureState({
  nowISO = DEFAULT_NOW_ISO,
  todayDate = DEFAULT_TODAY_DATE,
  horizonEnd = DEFAULT_HORIZON_END,
  declaredHorizonMonths = DEFAULT_HORIZON_MONTHS,
} = {}) {
  const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate });
  const laneConfigs = buildLaneConfigs();
  const answers = {
    step_1: OPERATION_ENDGAME_GOAL_TEXT,
    step_2: OPERATION_ENDGAME_SUCCESS_STATE,
    step_3: { horizonEnd, months: declaredHorizonMonths, label: '5 years through 2031' },
    step_5: OPERATION_ENDGAME_CONSTRAINT,
    step_6: OPERATION_ENDGAME_NON_NEGOTIABLE,
  };

  laneConfigs.forEach((config, index) => {
    Object.assign(answers, buildLaneAnswers(index, config));
  });

  state.masterPlanIntake = {
    status: 'in-progress',
    phase: 4,
    step: 13,
    profileId: DEFAULT_PROFILE_ID,
    answers,
    extractedLanes: laneConfigs.map(({ title, domain, role }) => ({ title, domain, role })),
    anchors: [
      {
        id: 'anchor-foundation-review',
        date: FOUNDATION_ANCHOR_DATE,
        label: 'Foundation substrate review',
        isFixed: true,
        affectedLaneIds: [],
        priority: 0,
      },
      {
        id: 'anchor-oct17-album-drop',
        date: PRIMARY_ANCHOR_DATE,
        label: 'October 17 album drop',
        isFixed: true,
        affectedLaneIds: [],
        priority: 1,
      },
      {
        id: 'anchor-p2-gate',
        date: P2_GATE_DATE,
        label: 'P2 operating-system review gate',
        isFixed: true,
        affectedLaneIds: [],
        priority: 2,
      },
      {
        id: 'anchor-terminal-review',
        date: horizonEnd,
        label: '2031 terminal review',
        isFixed: true,
        affectedLaneIds: [],
        priority: 3,
      },
    ],
    currentLaneIdx: 0,
    clarifyingQuestionIdx: 0,
    questionPlan: null,
    draft: null,
    errorMessage: null,
  };

  applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
  let next = computeDerivedState(state, { type: 'NO_OP' });
  const { planId, plan } = getFixturePlan(next);

  if (planId && plan) {
    plan.title = 'Operation Endgame';
    plan.coreMission = OPERATION_ENDGAME_GOAL_TEXT;
    plan.masterPlanSummary = OPERATION_ENDGAME_GOAL_TEXT;
    plan.northStarOutcome = OPERATION_ENDGAME_SUCCESS_STATE;
    plan.outcomeTarget = OPERATION_ENDGAME_OUTCOME_TARGET;
    plan.successStandard = OPERATION_ENDGAME_SUCCESS_STATE;
    plan.executionHorizon = '60 months through 2031';
    plan.horizonStart = todayDate;
    plan.horizonEnd = horizonEnd;
    plan.declaredHorizonMonths = declaredHorizonMonths;
    plan.officialStartDate = todayDate;
    plan.financialConstraint = {
      exists: true,
      urgency: 'high',
      notes: OPERATION_ENDGAME_CONSTRAINT,
    };
    plan.nonNegotiables = [OPERATION_ENDGAME_NON_NEGOTIABLE];
  }

  addP2Milestones(next, nowISO);
  next = computeDerivedState(next, { type: 'NO_OP' });

  next = computeDerivedState(next, { type: 'START_NEW_CYCLE_WITH_DECISION', payload: { mode: 'archive' } });

  const seededGoalId = next?.activeGoalId || next?.profilesById?.[DEFAULT_PROFILE_ID]?.activeGoalId || null;
  const seededCycleId = next?.activeCycleId || null;
  const seededGoal = seededGoalId ? next?.goalsById?.[seededGoalId] || null : null;
  const seededCycle = seededCycleId ? next?.cyclesById?.[seededCycleId] || null : null;

  if (seededGoalId && next?.profilesById?.[DEFAULT_PROFILE_ID]) {
    next.profilesById[DEFAULT_PROFILE_ID].activeGoalId = seededGoalId;
  }
  if (seededGoal) {
    seededGoal.activeCycleId = null;
    seededGoal.title = 'Operation Endgame';
  }
  if (seededCycle) {
    seededCycle.status = 'archived';
    seededCycle.scheduleLifecycle = 'no_schedule';
    seededCycle.endedAtISO = nowISO;
    seededCycle.archivedAtISO = nowISO;
    seededCycle.goalId = seededGoalId;
    seededCycle.masterPlanId = planId;
  }

  next.activeCycleId = null;
  next.scheduleLifecycleState = 'goal_admitted';
  next = computeDerivedState(next, { type: 'SET_SELECTED_HORIZON_MODE', mode: 'full_horizon' });

  if (planId && next?.profilesById?.[DEFAULT_PROFILE_ID]) {
    next.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = planId;
  }

  next.proposedBlocks = [];
  next.scheduleReviewBlocks = [];
  next.scheduleApplied = false;
  next.pendingPlanConfirmation = false;
  next = computeDerivedState(next, { type: 'NO_OP' });

  const restoredGoalId = next?.activeGoalId || seededGoalId || null;
  if (restoredGoalId && next?.goalsById?.[restoredGoalId]) {
    next.goalsById[restoredGoalId].activeCycleId = null;
  }
  next.activeCycleId = null;
  next.scheduleLifecycleState = 'goal_admitted';
  next.proposedBlocks = [];
  next.scheduleReviewBlocks = [];

  return next;
}

export function buildOperationEndgameReferenceState(options = {}) {
  return promoteOperationEndgameReferenceProfile(buildOperationEndgameFixtureState(options), options);
}

export function summarizeOperationEndgameFixtureState(state) {
  const { profile, planId, plan } = getFixturePlan(state);
  const activeCycle = state?.activeCycleId ? state?.cyclesById?.[state.activeCycleId] || null : null;
  const agendaVersionId = String(plan?.currentAgendaVersionId || '').trim() || null;
  const agendaVersion = agendaVersionId ? state?.masterPlanAgendaVersionsById?.[agendaVersionId] || null : null;
  const constraintVersionId = String(plan?.currentScheduleConstraintVersionId || '').trim() || null;
  const constraintVersion = constraintVersionId ? state?.scheduleConstraintVersionsById?.[constraintVersionId] || null : null;

  return {
    activeProfileId: state?.activeProfileId || null,
    activeGoalId: state?.activeGoalId || null,
    activeMasterPlanId: planId,
    activeCycleId: state?.activeCycleId || null,
    masterPlanCount: Object.keys(state?.masterPlansById || {}).length,
    goalCount: Object.keys(state?.goalsById || {}).length,
    profileGoalIds: Array.isArray(profile?.goalIds) ? profile.goalIds : [],
    masterPlanIds: Array.isArray(profile?.masterPlanIds) ? profile.masterPlanIds : [],
    horizonEnd: plan?.horizonEnd || null,
    fullHorizonEndDayKey: activeCycle?.goalContract?.fullHorizonEndDayKey || plan?.fullHorizonEndDayKey || plan?.horizonEnd || null,
    fullHorizonBlockCount: Array.isArray(state?.fullHorizonScheduleBlocks) ? state.fullHorizonScheduleBlocks.length : 0,
    coverageState: state?.fullHorizonCoverageAudit?.fullHorizonCovered ? 'covered' : getCoverageState(state),
    planQualityState: state?.fullHorizonPlanQuality?.state || null,
    blockQualityState: state?.fullHorizonBlockQuality?.state || null,
    agendaVersionId,
    agendaState: agendaVersion?.state || null,
    agendaBlockCount: agendaVersion?.blockCount || 0,
    constraintVersionId,
    constraintHash: constraintVersion?.constraintHash || null,
  };
}

function getCoverageState(state) {
  if (state?.fullHorizonCoverageAudit?.fullHorizonQualityTrusted) {
    return 'trusted';
  }
  if (state?.fullHorizonCoverageAudit?.fullHorizonCovered) {
    return 'covered';
  }
  if (state?.fullHorizonCoverageAudit?.horizonExpanded) {
    return 'expanded';
  }
  if (state?.fullHorizonCoverageAudit?.horizonResolved) {
    return 'resolved';
  }
  return 'unresolved';
}

export function previewOperationEndgameFixture(options = {}) {
  if (IS_PRODUCTION) {
    throw new Error('Operation Endgame restore fixture is unavailable in production.');
  }
  const state = buildOperationEndgameFixtureState(options);
  const summary = summarizeOperationEndgameFixtureState(state);
  console.info('[Jericho] Operation Endgame fixture preview', summary);
  return { state, summary };
}

export function restoreOperationEndgameFixture({
  targetWindow = typeof window !== 'undefined' ? window : null,
  storage = targetWindow?.localStorage || null,
  backup = true,
  reload = false,
  ...fixtureOptions
} = {}) {
  if (IS_PRODUCTION) {
    throw new Error('Operation Endgame restore fixture is unavailable in production.');
  }
  if (!storage) {
    throw new Error('Operation Endgame restore fixture requires localStorage.');
  }

  const previousRaw = storage.getItem(STORAGE_KEY);
  const previousState = parsePersistedState(previousRaw);
  const backupTimestamp = fixtureOptions.nowISO || new Date().toISOString();
  const backupSummary = backup
    ? writeBackupSnapshot(storage, previousRaw, backupTimestamp)
    : {
        backupStatus: 'skipped',
        backupKey: null,
        backupPointer: null,
        prunedKeys: [],
        backupError: null,
      };

  const state = preserveExistingProfileMetadata(buildOperationEndgameFixtureState(fixtureOptions), previousState);
  const persistableState = buildPersistableOperationEndgameFixtureState(state);
  storage.setItem(STORAGE_KEY, JSON.stringify(persistableState));
  const summary = {
    wroteKey: STORAGE_KEY,
    backupKey: backupSummary.backupKey,
    backupStatus: backupSummary.backupStatus,
    backupPointer: backupSummary.backupPointer,
    backupError: backupSummary.backupError,
    prunedBackupKeys: backupSummary.prunedKeys,
    ...summarizeOperationEndgameFixtureState(state),
  };
  console.info('[Jericho] Operation Endgame restore fixture written', summary);

  if (reload && typeof targetWindow?.location?.reload === 'function') {
    targetWindow.location.reload();
  }

  return summary;
}

export function installOperationEndgameRestore(targetWindow = typeof window !== 'undefined' ? window : null, options = {}) {
  const isProduction = typeof options?.isProduction === 'boolean' ? options.isProduction : IS_PRODUCTION;
  if (isProduction || !targetWindow) {
    return false;
  }

  targetWindow.__jerichoPreviewOperationEndgame = (fixtureOptions = {}) => previewOperationEndgameFixture(fixtureOptions);
  targetWindow.__jerichoRestoreOperationEndgame = (fixtureOptions = {}) =>
    restoreOperationEndgameFixture({ ...fixtureOptions, targetWindow });
  console.info(
    '[Jericho] Dev restore available: await window.__jerichoRestoreOperationEndgame({ reload: true })'
  );
  return true;
}
