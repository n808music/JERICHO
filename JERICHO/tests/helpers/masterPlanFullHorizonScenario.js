import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';

const DEFAULT_SUCCESS_STANDARD =
  'Build an active scaling ecosystem with validated product, creative, media, operations, revenue, capital, institution, and civic pathways.';

function buildLaneAnswers(index, activation, description, assessedStage) {
  return {
    [`lane_${index}_description`]: description,
    [`lane_${index}_system_assessment`]: {
      assessedStage,
      assessedConfidence: 'high',
      assessmentNotes: description,
    },
    [`lane_${index}_activation`]: activation,
    [`lane_${index}_clarifying_0`]: description,
  };
}

export function buildOperationEndgameState({
  nowISO = '2026-05-11T10:00:00.000Z',
  todayDate = '2026-05-11',
  horizonEnd = '2031-05-11',
  horizonMonths = 60,
  goalText = 'Build a 5-year multi-venture platform reaching 10k users and coordinate Operation Endgame through a multi-lane master plan',
  includeCreativeLane = true,
  includeProductLane = true,
  creativeAnchor = true,
  anchorDate = '2026-10-17',
  successStandard = DEFAULT_SUCCESS_STANDARD,
  capitalAvailable = 0,
} = {}) {
  const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate });

  const extractedLanes = [];
  const answers = {
    step_2: goalText,
    step_3: { horizonEnd, months: horizonMonths, label: horizonEnd.slice(0, 7) },
    step_5: {
      exists: true,
      urgency: 'high',
      notes: 'The system must coordinate multiple lanes without losing full-horizon truth.',
    },
    step_6: successStandard,
  };

  const laneConfigs = [
    includeProductLane
      ? {
          title: 'Operation Endgame app platform',
          domain: 'product',
          role: 'revenue-engine',
          activation: 'active',
          description: 'Core product is in development and needs onboarding, proof, and repeatable conversion.',
          assessedStage: 'in-development',
        }
      : null,
    includeCreativeLane
      ? {
          title: 'Operation Endgame album release engine',
          domain: 'creative',
          role: 'proof-artifact',
          activation: creativeAnchor ? 'active' : 'incubating',
          description: 'Creative lane drives proof, audience attention, and post-release conversion evidence.',
          assessedStage: creativeAnchor ? 'ready-to-launch' : 'in-development',
        }
      : null,
    {
      title: 'Operation Endgame media narrative pipeline',
      domain: 'media',
      role: 'audience-engine',
      activation: 'active',
      description: 'Media lane supports audience capture and recurring distribution proof.',
      assessedStage: 'pilot-running',
    },
    {
      title: 'Operation Endgame studio operations system',
      domain: 'brand',
      role: 'operating-system',
      activation: 'active',
      description: 'Operations lane must stabilize planning, review, and delegation.',
      assessedStage: 'active',
    },
    {
      title: 'Operation Endgame services revenue bridge',
      domain: 'income',
      role: 'runway-protection',
      activation: 'active',
      description: 'Income stream protects runway while the ecosystem matures.',
      assessedStage: 'earning',
    },
    {
      title: 'Operation Endgame real estate acquisition thesis',
      domain: 'capital',
      role: 'asset-path',
      activation: capitalAvailable > 0 ? 'active' : 'incubating',
      description: 'Capital lane remains gated until proof and capital stack support direct expansion.',
      assessedStage: capitalAvailable > 0 ? 'researching' : 'blocked-by-capital',
    },
    {
      title: 'Operation Endgame apprenticeship institution design',
      domain: 'institution',
      role: 'institution-builder',
      activation: 'incubating',
      description: 'Institution lane should remain gated until later-stage proof and operating maturity.',
      assessedStage: 'conceptual',
    },
    {
      title: 'Operation Endgame district coalition development',
      domain: 'civic',
      role: 'district-builder',
      activation: 'incubating',
      description: 'Civic lane is strategic and dependency-heavy until credibility and capital exist.',
      assessedStage: 'conceptual',
    },
  ].filter(Boolean);

  laneConfigs.forEach((config, index) => {
    extractedLanes.push({ title: config.title, domain: config.domain, role: config.role });
    Object.assign(answers, buildLaneAnswers(index, config.activation, config.description, config.assessedStage));
  });

  const anchors = [
    {
      id: 'anchor-foundation-review',
      date: '2026-06-15',
      label: 'Foundation substrate review',
      isFixed: true,
      affectedLaneIds: [],
      priority: 0,
    },
    {
      id: 'anchor-main-launch',
      date: anchorDate,
      label: creativeAnchor ? 'Album release and app proof anchor' : 'Strategic proof anchor',
      isFixed: true,
      affectedLaneIds: [],
      priority: 1,
    },
    {
      id: 'anchor-p2-gate',
      date: '2028-06-15',
      label: 'P2 operating-system review gate',
      isFixed: true,
      affectedLaneIds: [],
      priority: 2,
    },
    {
      id: 'anchor-terminal-review',
      date: horizonEnd,
      label: 'Terminal readiness review',
      isFixed: true,
      affectedLaneIds: [],
      priority: 3,
    },
  ];

  state.masterPlanIntake = {
    status: 'in-progress',
    phase: 4,
    step: 13,
    profileId: DEFAULT_PROFILE_ID,
    answers,
    extractedLanes,
    anchors,
    currentLaneIdx: 0,
    clarifyingQuestionIdx: 0,
    draft: null,
    errorMessage: null,
  };

  applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
  let derived = computeDerivedState(state, { type: 'NO_OP' });

  const profile = derived.profilesById?.[DEFAULT_PROFILE_ID];
  const planId = profile?.activeMasterPlanId;
  const plan = planId ? derived.masterPlansById?.[planId] : null;
  if (plan) {
    plan.successStandard = successStandard;
    plan.outcomeTarget = successStandard;
    plan.financialConstraint = { capitalAvailable };
    derived = computeDerivedState(derived, { type: 'NO_OP' });
  }

  return derived;
}

export function setHorizonMode(derived, mode) {
  return computeDerivedState(derived, { type: 'SET_SELECTED_HORIZON_MODE', mode });
}

export function getActivePlan(derived) {
  const profile = derived?.profilesById?.[DEFAULT_PROFILE_ID];
  return profile?.activeMasterPlanId ? derived?.masterPlansById?.[profile.activeMasterPlanId] || null : null;
}
