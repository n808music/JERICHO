import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../state/identityStore.js';
import { computeDerivedState } from '../state/identityCompute.js';
import { applyMasterPlanAction } from '../state/masterPlanStore.js';
import { IS_PRODUCTION } from '../utils/runtimeEnv.js';

export const OPERATION_ENDGAME_GOAL_TEXT =
  'Build a 5-year multi-venture platform reaching 10k users and coordinate Operation Endgame through a multi-lane master plan.';
export const OPERATION_ENDGAME_SUCCESS_STATE =
  'Build an active scaling ecosystem with validated product, creative, media, operations, revenue, capital, institution, and civic pathways.';
export const OPERATION_ENDGAME_CONSTRAINT =
  'Capital is constrained and near-term revenue matters. The system must coordinate multiple lanes without losing full-horizon truth.';
export const OPERATION_ENDGAME_NON_NEGOTIABLE =
  'Ownership, execution discipline, and mission continuity cannot slip.';

const DEFAULT_NOW_ISO = '2026-05-19T12:00:00.000Z';
const DEFAULT_TODAY_DATE = '2026-05-19';
const DEFAULT_HORIZON_END = '2031-05-19';
const DEFAULT_HORIZON_MONTHS = 60;
const PRIMARY_ANCHOR_DATE = '2026-10-17';
const STORAGE_KEY = 'jericho-identity';
const BACKUP_LATEST_KEY = 'jericho-identity-backup-latest';
const BACKUP_LATEST_POINTER_KEY = 'jericho-identity-backup-latest-key';

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
  return `jericho-identity-backup:${String(nowISO).replace(/[:.]/g, '-')}`;
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
        id: 'anchor-oct17-album-drop',
        date: PRIMARY_ANCHOR_DATE,
        label: 'October 17 album drop',
        isFixed: true,
        affectedLaneIds: [],
        priority: 0,
      },
      {
        id: 'anchor-terminal-review',
        date: horizonEnd,
        label: '2031 terminal review',
        isFixed: true,
        affectedLaneIds: [],
        priority: 1,
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
    plan.outcomeTarget = 'Reach 10k users by the 2031 strategic horizon.';
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

  next = computeDerivedState(next, { type: 'NO_OP' });
  next = computeDerivedState(next, { type: 'START_NEW_CYCLE_WITH_DECISION', payload: { mode: 'archive' } });

  const activeCycle = next?.activeCycleId ? next?.cyclesById?.[next.activeCycleId] || null : null;
  if (activeCycle && planId) {
    activeCycle.masterPlanId = planId;
    activeCycle.status = 'active';
    if (activeCycle.goalContract) {
      activeCycle.goalContract.goalText = OPERATION_ENDGAME_GOAL_TEXT;
      activeCycle.goalContract.goalLabel = 'Operation Endgame';
      activeCycle.goalContract.declaredHorizonMonths = declaredHorizonMonths;
      activeCycle.goalContract.fullHorizonEndDayKey = horizonEnd;
      activeCycle.goalContract.nonNegotiables = [OPERATION_ENDGAME_NON_NEGOTIABLE];
    }
  }

  return computeDerivedState(next, { type: 'NO_OP' });
}

export function summarizeOperationEndgameFixtureState(state) {
  const { profile, planId, plan } = getFixturePlan(state);
  const activeCycle = state?.activeCycleId ? state?.cyclesById?.[state.activeCycleId] || null : null;

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
    fullHorizonEndDayKey: activeCycle?.goalContract?.fullHorizonEndDayKey || plan?.horizonEnd || null,
  };
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
  let backupKey = null;
  if (backup && previousRaw) {
    backupKey = buildBackupKey(fixtureOptions.nowISO || new Date().toISOString());
    storage.setItem(backupKey, previousRaw);
    storage.setItem(BACKUP_LATEST_KEY, previousRaw);
    storage.setItem(BACKUP_LATEST_POINTER_KEY, backupKey);
  }

  const state = buildOperationEndgameFixtureState(fixtureOptions);
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
  const summary = {
    wroteKey: STORAGE_KEY,
    backupKey,
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
