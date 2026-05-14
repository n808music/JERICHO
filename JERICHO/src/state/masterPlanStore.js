import { useCallback } from 'react';
import { buildMasterPlan, buildLane, buildMilestone, buildAnchor, buildRequirement } from '../domain/masterPlan/masterPlanFactory.js';
import {
  extractLanesFromDescription,
  assessLaneFromAnswers,
  getPlannedGlobalQuestions,
  getPlannedLaneQuestions,
  suggestHorizonFromAnchors,
  inferHorizonYearsFromText,
  buildStructureQuestionPlan,
  evaluateStructureCritic,
} from '../domain/masterPlan/masterPlanIntakeEngine.js';
import { generateMilestonesForLane } from '../domain/masterPlan/masterPlanMilestoneGenerator.js';
import { deriveMasterPlanSemanticModel } from '../domain/masterPlan/masterPlanSemanticModel.js';

export const MASTER_PLAN_ACTION_TYPES = new Set([
  'CREATE_MASTER_PLAN',
  'UPDATE_MASTER_PLAN',
  'SET_ACTIVE_MASTER_PLAN',
  'ADD_MASTER_PLAN_ANCHOR',
  'UPDATE_MASTER_PLAN_ANCHOR',
  'ADD_MASTER_PLAN_LANE',
  'UPDATE_MASTER_PLAN_LANE',
  'ADD_MASTER_PLAN_MILESTONE',
  'UPDATE_MASTER_PLAN_MILESTONE',
  'ADD_LANE_REQUIREMENT',
  'UPDATE_LANE_REQUIREMENT',
  // Intake state machine
  'MASTER_PLAN_INTAKE_START',
  'MASTER_PLAN_INTAKE_ANSWER',
  'MASTER_PLAN_INTAKE_LANE_ADDED',
  'MASTER_PLAN_INTAKE_SET_LANES',
  'MASTER_PLAN_INTAKE_ASSESSED',
  'MASTER_PLAN_INTAKE_COMPLETE',
  'MASTER_PLAN_INTAKE_RESET',
  'DELETE_MASTER_PLAN',
]);

// ─── State slice initializer ──────────────────────────────────────────────────
// Spread the return value into buildBlankIdentityState's blankState object.

export function buildMasterPlanStateFields() {
  return {
    masterPlansById: {},
    masterPlanLanesById: {},
    masterPlanMilestonesById: {},
    masterPlanIntake: buildBlankIntakeState(),
  };
}

function buildBlankIntakeState() {
  return {
    status: 'idle',      // "idle" | "in-progress" | "complete" | "error"
    phase: null,         // 1 | 2 | 3 | 4
    step: null,          // 1–13
    profileId: null,
    answers: {},         // keyed by answer key (e.g. "step_1", "lane_0_description")
    extractedLanes: [],  // LaneCandidate[] from step 1
    anchors: [],         // accumulated from step 4 loop
    currentLaneIdx: 0,   // which lane is being calibrated in phase 3
    clarifyingQuestionIdx: 0, // which sub-question in step 8
    questionPlan: null,
    draft: null,         // { masterPlanId } after COMPLETE
    errorMessage: null,
  };
}

function refreshQuestionPlan(intake) {
  intake.questionPlan = buildStructureQuestionPlan({
    goalText: intake?.answers?.step_1 || '',
    extractedLanes: intake?.extractedLanes || [],
    anchors: intake?.anchors || [],
  });
}

function deriveFinancialConstraintFromAnswers(questionPlan, answers = {}, extractedLanes = []) {
  const legacyStructured = answers?.step_5;
  if (legacyStructured && typeof legacyStructured === 'object' && 'exists' in legacyStructured) {
    return legacyStructured;
  }
  const globalQuestions = getPlannedGlobalQuestions(questionPlan);
  const incomeLaneIdx = (Array.isArray(extractedLanes) ? extractedLanes : []).findIndex(
    (lane) => String(lane?.domain || '').trim().toLowerCase() === 'income'
  );
  const candidateTexts = [];
  globalQuestions.forEach((question, index) => {
    if (
      question?.resolvesField === 'profile.runwayPressure' ||
      question?.resolvesField === 'profile.jobSearchRelation'
    ) {
      candidateTexts.push(answers?.[`step_${5 + index}`]);
    }
  });
  if (incomeLaneIdx >= 0) {
    candidateTexts.push(answers?.[`lane_${incomeLaneIdx}_clarifying_0`]);
  }
  const firstText = candidateTexts.find(
    (value) => typeof value === 'string' && value.trim().length > 0
  );
  if (!firstText) {
    return null;
  }
  const normalized = String(firstText).trim();
  const lower = normalized.toLowerCase();
  return {
    exists: /\b(urgent|runway|income|revenue|money|cash|client|contract|pressure|need)\b/.test(lower),
    urgency: /\b(immediate|urgent|asap|now|soon)\b/.test(lower) ? 'immediate' : /\b(high|tight|short)\b/.test(lower) ? 'high' : null,
    notes: normalized,
  };
}

// Augments a profile object (in place) with master plan fields.
// Call this when constructing or hydrating a profile that predates the master plan feature.
export function ensureMasterPlanProfileFields(profile) {
  if (!Array.isArray(profile.masterPlanIds)) {
    profile.masterPlanIds = [];
  }
  if (!('activeMasterPlanId' in profile)) {
    profile.activeMasterPlanId = null;
  }
  return profile;
}

// ─── Action handlers ──────────────────────────────────────────────────────────
// Each function receives (draft, action) and mutates draft in place.
// Follow the identityStore.js pattern: caller does structuredClone before passing.

function applyCreateMasterPlan(draft, action) {
  const plan = buildMasterPlan({ ...action.payload, nowISO: action.nowISO });

  draft.masterPlansById[plan.id] = plan;

  const profileId = plan.profileId;
  const profile = draft.profilesById?.[profileId];
  if (profile) {
    ensureMasterPlanProfileFields(profile);
    if (!profile.masterPlanIds.includes(plan.id)) {
      profile.masterPlanIds.push(plan.id);
    }
    // First plan on this profile becomes active automatically
    if (!profile.activeMasterPlanId) {
      profile.activeMasterPlanId = plan.id;
    }
  }
}

function applyUpdateMasterPlan(draft, action) {
  const plan = draft.masterPlansById?.[action.masterPlanId];
  if (!plan) return;
  const { id, profileId, createdAt, laneIds, anchors, ...rest } = action.updates || {};
  Object.assign(plan, rest);
  plan.updatedAt = action.nowISO || new Date().toISOString();
}

function applySetActiveMasterPlan(draft, action) {
  const profileId = action.profileId || draft.activeProfileId;
  const profile = draft.profilesById?.[profileId];
  if (!profile) return;
  ensureMasterPlanProfileFields(profile);
  if (draft.masterPlansById?.[action.masterPlanId]) {
    profile.activeMasterPlanId = action.masterPlanId;
  }
}

function applyAddMasterPlanAnchor(draft, action) {
  const plan = draft.masterPlansById?.[action.masterPlanId];
  if (!plan) return;
  const anchor = action.anchor?.id ? action.anchor : buildAnchor(action.anchor);
  plan.anchors = plan.anchors || [];
  plan.anchors.push(anchor);
  plan.updatedAt = action.nowISO || new Date().toISOString();
}

function applyUpdateMasterPlanAnchor(draft, action) {
  const plan = draft.masterPlansById?.[action.masterPlanId];
  if (!plan) return;
  const idx = (plan.anchors || []).findIndex((a) => a.id === action.anchorId);
  if (idx === -1) return;
  plan.anchors[idx] = { ...plan.anchors[idx], ...action.updates };
  plan.updatedAt = action.nowISO || new Date().toISOString();
}

function applyAddMasterPlanLane(draft, action) {
  const plan = draft.masterPlansById?.[action.masterPlanId];
  if (!plan) return;
  const lane = buildLane({ ...action.payload, masterPlanId: action.masterPlanId });

  draft.masterPlanLanesById[lane.id] = lane;
  if (!plan.laneIds.includes(lane.id)) {
    plan.laneIds.push(lane.id);
  }
  plan.updatedAt = action.nowISO || new Date().toISOString();
}

function applyUpdateMasterPlanLane(draft, action) {
  const lane = draft.masterPlanLanesById?.[action.laneId];
  if (!lane) return;
  // milestoneIds and id are managed by the store, not patched directly
  const { id, masterPlanId, milestoneIds, ...rest } = action.updates || {};
  Object.assign(lane, rest);
}

function applyAddMasterPlanMilestone(draft, action) {
  const lane = draft.masterPlanLanesById?.[action.laneId];
  if (!lane) return;
  const milestone = buildMilestone({ ...action.payload, laneId: action.laneId });

  draft.masterPlanMilestonesById[milestone.id] = milestone;
  if (!lane.milestoneIds.includes(milestone.id)) {
    lane.milestoneIds.push(milestone.id);
  }
}

function applyUpdateMasterPlanMilestone(draft, action) {
  const milestone = draft.masterPlanMilestonesById?.[action.milestoneId];
  if (!milestone) return;
  const { id, laneId, anchorId, ...rest } = action.updates || {};
  Object.assign(milestone, rest);
}

function applyAddLaneRequirement(draft, action) {
  const lane = draft.masterPlanLanesById?.[action.laneId];
  if (!lane) return;
  const req = buildRequirement(action.payload);
  lane.requirements = lane.requirements || [];
  lane.requirements.push(req);
}

function applyUpdateLaneRequirement(draft, action) {
  const lane = draft.masterPlanLanesById?.[action.laneId];
  if (!lane) return;
  const idx = (lane.requirements || []).findIndex((r) => r.id === action.requirementId);
  if (idx === -1) return;
  lane.requirements[idx] = { ...lane.requirements[idx], ...action.updates };
}

// ─── Intake helpers ───────────────────────────────────────────────────────────

function nextIntakeStep(intake, answer = {}) {
  const { phase, step, currentLaneIdx, clarifyingQuestionIdx, extractedLanes } = intake;

  if (phase === 1) {
    if (step === 1) return { phase: 1, step: 2 };
    if (step === 2) return { phase: 1, step: 3 };
    if (step === 3) return { phase: 2, step: 4 };
  }

  if (phase === 2) {
    if (step === 4) {
      // Stay at step 4 if the user indicated more anchors exist
      return answer.hasMore ? { phase: 2, step: 4 } : { phase: 2, step: 5 };
    }
    if (step === 5) return { phase: 2, step: 6 };
    if (step === 6) {
      if (!extractedLanes || extractedLanes.length === 0) return { phase: 4, step: 11 };
      return { phase: 3, step: 7, currentLaneIdx: 0, clarifyingQuestionIdx: 0 };
    }
  }

  if (phase === 3) {
    if (step === 7) {
      const lane = extractedLanes[currentLaneIdx];
      const laneQuestions = getPlannedLaneQuestions(intake.questionPlan, currentLaneIdx, lane?.domain, lane);
      if (!Array.isArray(laneQuestions) || laneQuestions.length === 0) {
        return { phase: 3, step: 9, clarifyingQuestionIdx: 0 };
      }
      return { phase: 3, step: 8, clarifyingQuestionIdx: 0 };
    }
    if (step === 8) {
      const lane = extractedLanes[currentLaneIdx];
      const totalQuestions = getPlannedLaneQuestions(intake.questionPlan, currentLaneIdx, lane?.domain, lane).length;
      const nextIdx = clarifyingQuestionIdx + 1;
      if (nextIdx < totalQuestions) {
        return { phase: 3, step: 8, clarifyingQuestionIdx: nextIdx };
      }
      return { phase: 3, step: 9, clarifyingQuestionIdx: 0 };
    }
    if (step === 9) return { phase: 3, step: 10 };
    if (step === 10) {
      const nextLane = currentLaneIdx + 1;
      if (nextLane < extractedLanes.length) {
        return { phase: 3, step: 7, currentLaneIdx: nextLane, clarifyingQuestionIdx: 0 };
      }
      return { phase: 4, step: 11 };
    }
  }

  if (phase === 4) {
    if (step === 11) return { phase: 4, step: 12 };
    if (step === 12) return { phase: 4, step: 13 };
    // Step 13 completion is triggered by MASTER_PLAN_INTAKE_COMPLETE
  }

  return {};
}

// ─── Intake action handlers ───────────────────────────────────────────────────

function applyIntakeStart(draft, action) {
  const profileId = action.profileId || draft.activeProfileId;
  draft.masterPlanIntake = {
    ...buildBlankIntakeState(),
    status: 'in-progress',
    phase: 1,
    step: 1,
    profileId,
  };
}

function applyIntakeAnswer(draft, action) {
  const intake = draft.masterPlanIntake;
  if (!intake || intake.status !== 'in-progress') return;

  const { phase, step, currentLaneIdx, clarifyingQuestionIdx } = intake;
  const value = action.value;

  // Store the answer under a stable key
  const answerKey = phase === 3
    ? (step === 8
        ? `lane_${currentLaneIdx}_clarifying_${clarifyingQuestionIdx}`
        : step === 7 ? `lane_${currentLaneIdx}_description`
        : step === 9 ? `lane_${currentLaneIdx}_assessment_confirm`
        : step === 10 ? `lane_${currentLaneIdx}_activation`
        : `lane_${currentLaneIdx}_step_${step}`)
    : `step_${step}`;

  intake.answers[answerKey] = value;

  // Side effects before advancing
  if (phase === 1 && step === 1) {
    const text = typeof value === 'string' ? value : value?.text || '';
    intake.extractedLanes = extractLanesFromDescription(text);
    refreshQuestionPlan(intake);
  }

  if (phase === 2 && step === 4 && value?.anchor) {
    intake.anchors.push(value.anchor);
    refreshQuestionPlan(intake);
  }

  if (!intake.questionPlan && intake.extractedLanes.length > 0) {
    refreshQuestionPlan(intake);
  }

  // Run assessment after all clarifying questions are answered (entering step 9)
  if (phase === 3 && step === 8) {
    const lane = intake.extractedLanes[currentLaneIdx];
    const domain = lane?.domain;
    const plannedQuestions = getPlannedLaneQuestions(intake.questionPlan, currentLaneIdx, domain, lane);
    const totalQuestions = plannedQuestions.length;
    const isLastClarifying = clarifyingQuestionIdx + 1 >= totalQuestions;
    if (isLastClarifying) {
      const description = intake.answers[`lane_${currentLaneIdx}_description`] || '';
      const clarifyingAnswers = plannedQuestions.map(
        (_, i) => intake.answers[`lane_${currentLaneIdx}_clarifying_${i}`] || ''
      );
      intake.answers[`lane_${currentLaneIdx}_system_assessment`] = assessLaneFromAnswers(
        domain,
        description,
        clarifyingAnswers
      );
    }
  }

  // Advance state
  const next = nextIntakeStep(intake, value);
  Object.assign(intake, next);
}

function applyIntakeLaneAdded(draft, action) {
  const intake = draft.masterPlanIntake;
  if (!intake) return;
  if (action.lane) {
    intake.extractedLanes = [...(intake.extractedLanes || []), action.lane];
  }
}

function applyIntakeSetLanes(draft, action) {
  const intake = draft.masterPlanIntake;
  if (!intake) return;
  intake.extractedLanes = Array.isArray(action.lanes) ? [...action.lanes] : [];
  refreshQuestionPlan(intake);
}

function applyIntakeAssessed(draft, action) {
  const intake = draft.masterPlanIntake;
  if (!intake) return;
  const { laneIdx, assessment } = action;
  if (typeof laneIdx === 'number' && assessment) {
    intake.answers[`lane_${laneIdx}_system_assessment`] = assessment;
  }
}

function resolveLaneAnchorIds(candidate, anchors = []) {
  if (!Array.isArray(anchors) || anchors.length === 0) {
    return [];
  }
  const domain = String(candidate?.domain || '').trim().toLowerCase();
  if (domain === 'brand' || domain === 'income') {
    return [];
  }
  const sorted = [...anchors].sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
  const explicit = sorted.filter((anchor) => Array.isArray(anchor?.affectedLaneIds) && anchor.affectedLaneIds.length > 0);
  if (explicit.length > 0) {
    return explicit.map((anchor) => anchor.id).filter(Boolean);
  }
  const fixed = sorted.filter((anchor) => anchor?.isFixed);
  const primary = fixed.length > 0 ? fixed[fixed.length - 1] : sorted[sorted.length - 1];
  return primary?.id ? [primary.id] : [];
}

function applyIntakeComplete(draft, action) {
  const intake = draft.masterPlanIntake;
  if (!intake || intake.status !== 'in-progress') return;

  try {
    const { answers, extractedLanes, anchors, profileId } = intake;
    const nowISO = action.nowISO || new Date().toISOString();
    const questionPlan =
      intake.questionPlan ||
      buildStructureQuestionPlan({
        goalText: answers['step_1'] || '',
        extractedLanes,
        anchors,
      });
    const structureCritic = evaluateStructureCritic(questionPlan, answers, extractedLanes);

    const northStarText = answers['step_2'];
    const goalText = answers['step_1'] || northStarText || '';
    const horizonAnswer = answers['step_3'];

    // Resolve horizonEnd with authority order:
    // 1. Explicit user answer from step_3 (highest trust)
    // 2. Multi-year inference from goal text (catches "5-year plan" language)
    // 3. Anchor-based suggestion (last resort — anchor is a launch milestone, not the full horizon)
    let resolvedHorizonEnd = horizonAnswer?.horizonEnd || null;
    if (!resolvedHorizonEnd) {
      const inferred = inferHorizonYearsFromText(goalText);
      if (inferred) {
        const inferredEnd = new Date(nowISO);
        inferredEnd.setMonth(inferredEnd.getMonth() + inferred.months);
        resolvedHorizonEnd = inferredEnd.toISOString().slice(0, 10);
      } else {
        resolvedHorizonEnd = suggestHorizonFromAnchors(anchors, nowISO)?.horizonEnd || null;
      }
    }

    // Compute and store declared months so the normalization pass in applyGoalPolicy
    // can extend a truncated horizonEnd without depending on text-inference alone.
    // Priority: explicit step_3.months → computed from resolvedHorizonEnd vs nowISO → null.
    let declaredHorizonMonths = null;
    if (horizonAnswer?.months && Number.isFinite(Number(horizonAnswer.months))) {
      declaredHorizonMonths = Math.round(Number(horizonAnswer.months));
    } else if (resolvedHorizonEnd) {
      const startMs = new Date(`${nowISO.slice(0, 10)}T12:00:00Z`).getTime();
      const endMs = new Date(`${resolvedHorizonEnd}T12:00:00Z`).getTime();
      const computed = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24 * 30.44));
      if (computed > 0) {
        declaredHorizonMonths = computed;
      }
    }

    const financialConstraint = deriveFinancialConstraintFromAnswers(questionPlan, answers, extractedLanes);
    const semanticModel = deriveMasterPlanSemanticModel({
      goalText: northStarText || '',
      extractedLanes,
      horizonAnswer,
    });
    const plan = buildMasterPlan({
      profileId,
      title: semanticModel.coreMission || (northStarText ? northStarText.slice(0, 60) : 'Master Plan'),
      northStarOutcome: northStarText || '',
      coreMission: semanticModel.coreMission,
      outcomeTarget: semanticModel.outcomeTarget,
      successStandard: semanticModel.successStandard,
      masterPlanSummary: semanticModel.masterPlanSummary,
      executionHorizon: semanticModel.executionHorizon,
      controllableSuccessSignals: semanticModel.controllableSuccessSignals,
      externallyMediatedTargets: semanticModel.externallyMediatedTargets,
      controllabilityClass: semanticModel.controllabilityClass,
      terminalTargetClass: semanticModel.terminalTargetClass,
      goalArchitecture: semanticModel.goalArchitecture,
      executionModel: semanticModel.executionModel,
      primaryLane: semanticModel.primaryLane,
      supportingLanes: semanticModel.supportingLanes,
      laneComposition: semanticModel.laneComposition,
      laneClassificationConfidence: semanticModel.laneClassificationConfidence,
      classificationSource: semanticModel.classificationSource,
      officialStartDate: nowISO.slice(0, 10),
      horizonStart: nowISO.slice(0, 10),
      horizonEnd: resolvedHorizonEnd,
      declaredHorizonMonths,
      anchors,
      financialConstraint,
      nowISO,
    });
    plan.structureCritic = structureCritic;

    draft.masterPlansById[plan.id] = plan;

    const profile = draft.profilesById?.[profileId];
    if (profile) {
      ensureMasterPlanProfileFields(profile);
      if (!profile.masterPlanIds.includes(plan.id)) {
        profile.masterPlanIds.push(plan.id);
      }
      if (!profile.activeMasterPlanId) {
        profile.activeMasterPlanId = plan.id;
      }
    }

    for (let idx = 0; idx < extractedLanes.length; idx++) {
      const candidate = extractedLanes[idx];
      const activation = answers[`lane_${idx}_activation`] || 'incubating';
      const description = answers[`lane_${idx}_description`] || '';
      const sysAssessment = answers[`lane_${idx}_system_assessment`] || {};
      const userConfirm = answers[`lane_${idx}_assessment_confirm`];

      const assessedStage = userConfirm?.correctedStage || sysAssessment.assessedStage || '';
      const assessedConfidence = userConfirm?.correctedConfidence || sysAssessment.assessedConfidence || 'low';
      const assessmentNotes = sysAssessment.assessmentNotes || '';

      const lane = buildLane({
        masterPlanId: plan.id,
        title: candidate.title,
        domain: candidate.domain,
        role: candidate.role,
        activationState: activation,
        userDescription: description,
        assessedStage,
        assessedConfidence,
        assessmentNotes,
        anchorIds: resolveLaneAnchorIds(candidate, anchors),
      });

      draft.masterPlanLanesById[lane.id] = lane;
      plan.laneIds.push(lane.id);

      const milestones = generateMilestonesForLane(plan, lane, anchors, nowISO);
      for (const milestone of milestones) {
        draft.masterPlanMilestonesById[milestone.id] = milestone;
        if (!lane.milestoneIds.includes(milestone.id)) {
          lane.milestoneIds.push(milestone.id);
        }
      }
    }

    plan.updatedAt = nowISO;

    // Link to active Core Mission Contract if one exists for this profile.
    // Creation happens at onPlanningTierRouted time (Structure intake); here we only link.
    const activeMissionId = draft.profilesById?.[profileId]?.activeCoreMissionContractId || null;
    if (activeMissionId && draft.coreMissionContractsById?.[activeMissionId]) {
      plan.coreMissionContractId = activeMissionId;
    }

    intake.status = 'complete';
    intake.draft = { masterPlanId: plan.id };
  } catch (err) {
    intake.status = 'error';
    intake.errorMessage = err.message;
  }
}

function applyIntakeReset(draft) {
  const intake = draft.masterPlanIntake;
  if (!intake) return;
  intake.status = 'idle';
  intake.draft = null;
  intake.answers = {};
  intake.extractedLanes = [];
  intake.anchors = [];
    intake.currentLaneIdx = 0;
    intake.clarifyingQuestionIdx = 0;
    intake.questionPlan = null;
    intake.phase = null;
  intake.step = null;
  intake.errorMessage = null;
  // profileId intentionally left — harmless, avoids losing the profile association
  // masterPlansById is NOT touched — reset cancels intake, not a completed plan
}

function applyDeleteMasterPlan(draft, action) {
  const masterPlanId = String(action?.masterPlanId || '').trim();
  if (!masterPlanId) return;
  const plan = draft.masterPlansById?.[masterPlanId];
  if (!plan) return;

  const laneIds = Array.isArray(plan.laneIds) ? [...plan.laneIds] : [];
  laneIds.forEach((laneId) => {
    const lane = draft.masterPlanLanesById?.[laneId];
    const milestoneIds = Array.isArray(lane?.milestoneIds) ? [...lane.milestoneIds] : [];
    milestoneIds.forEach((milestoneId) => {
      delete draft.masterPlanMilestonesById?.[milestoneId];
    });
    delete draft.masterPlanLanesById?.[laneId];
  });

  const profileId = plan.profileId || action?.profileId || draft.activeProfileId;
  const profile = draft.profilesById?.[profileId];
  if (profile) {
    ensureMasterPlanProfileFields(profile);
    profile.masterPlanIds = (profile.masterPlanIds || []).filter((id) => id !== masterPlanId);
    if (profile.activeMasterPlanId === masterPlanId) {
      profile.activeMasterPlanId = profile.masterPlanIds[0] || null;
    }
  }

  delete draft.masterPlansById?.[masterPlanId];
  if (draft.masterPlanPolicyByPlanId) {
    delete draft.masterPlanPolicyByPlanId[masterPlanId];
  }

  const linkedGoalId = `masterplan:${masterPlanId}`;
  const linkedCycleId = `masterplan-cycle:${masterPlanId}`;
  if (draft.activeGoalId === linkedGoalId) {
    draft.activeGoalId = null;
  }
  if (draft.activeCycleId === linkedCycleId) {
    draft.activeCycleId = null;
  }
  if (draft.goalsById) {
    delete draft.goalsById[linkedGoalId];
  }
  if (draft.cyclesById) {
    delete draft.cyclesById[linkedCycleId];
  }
  if (draft.deliverablesByCycleId) {
    delete draft.deliverablesByCycleId[linkedCycleId];
  }
  if (draft.goalPolicyByGoalId) {
    delete draft.goalPolicyByGoalId[linkedGoalId];
  }
  if (draft.goalAdmissionByGoal) {
    delete draft.goalAdmissionByGoal[linkedGoalId];
  }
  if (Array.isArray(draft.proposedBlocks)) {
    draft.proposedBlocks = draft.proposedBlocks.filter((block) => block?.masterPlanId !== masterPlanId);
  }
  if (draft.proposedBlocksByCycleId) {
    delete draft.proposedBlocksByCycleId[linkedCycleId];
  }
  if (draft.scheduleReviewBlocksByCycleId) {
    delete draft.scheduleReviewBlocksByCycleId[linkedCycleId];
  }
  if (draft.masterPlanIntake?.draft?.masterPlanId === masterPlanId) {
    draft.masterPlanIntake.draft = null;
    draft.masterPlanIntake.status = 'idle';
  }
}

// ─── Main dispatch function ───────────────────────────────────────────────────
// Returns true if the action was handled, false if identityReducer should continue.
// Usage in identityReducer:
//
//   if (applyMasterPlanAction(draft, action)) {
//     return computeDerivedState(draft, { type: 'NO_OP' });
//   }

export function applyMasterPlanAction(draft, action) {
  switch (action.type) {
    case 'CREATE_MASTER_PLAN':
      applyCreateMasterPlan(draft, action);
      return true;
    case 'UPDATE_MASTER_PLAN':
      applyUpdateMasterPlan(draft, action);
      return true;
    case 'SET_ACTIVE_MASTER_PLAN':
      applySetActiveMasterPlan(draft, action);
      return true;
    case 'ADD_MASTER_PLAN_ANCHOR':
      applyAddMasterPlanAnchor(draft, action);
      return true;
    case 'UPDATE_MASTER_PLAN_ANCHOR':
      applyUpdateMasterPlanAnchor(draft, action);
      return true;
    case 'ADD_MASTER_PLAN_LANE':
      applyAddMasterPlanLane(draft, action);
      return true;
    case 'UPDATE_MASTER_PLAN_LANE':
      applyUpdateMasterPlanLane(draft, action);
      return true;
    case 'ADD_MASTER_PLAN_MILESTONE':
      applyAddMasterPlanMilestone(draft, action);
      return true;
    case 'UPDATE_MASTER_PLAN_MILESTONE':
      applyUpdateMasterPlanMilestone(draft, action);
      return true;
    case 'ADD_LANE_REQUIREMENT':
      applyAddLaneRequirement(draft, action);
      return true;
    case 'UPDATE_LANE_REQUIREMENT':
      applyUpdateLaneRequirement(draft, action);
      return true;
    case 'MASTER_PLAN_INTAKE_START':
      applyIntakeStart(draft, action);
      return true;
    case 'MASTER_PLAN_INTAKE_ANSWER':
      applyIntakeAnswer(draft, action);
      return true;
    case 'MASTER_PLAN_INTAKE_LANE_ADDED':
      applyIntakeLaneAdded(draft, action);
      return true;
    case 'MASTER_PLAN_INTAKE_SET_LANES':
      applyIntakeSetLanes(draft, action);
      return true;
    case 'MASTER_PLAN_INTAKE_ASSESSED':
      applyIntakeAssessed(draft, action);
      return true;
    case 'MASTER_PLAN_INTAKE_COMPLETE':
      applyIntakeComplete(draft, action);
      return true;
    case 'MASTER_PLAN_INTAKE_RESET':
      applyIntakeReset(draft);
      return true;
    case 'DELETE_MASTER_PLAN':
      applyDeleteMasterPlan(draft, action);
      return true;
    default:
      return false;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Call inside IdentityProvider, pass to context value alongside existing actions.
//
//   const masterPlanActions = useMasterPlanActions(dispatch);

export function useMasterPlanActions(dispatch) {
  const createMasterPlan = useCallback(
    (payload) =>
      dispatch({ type: 'CREATE_MASTER_PLAN', payload, nowISO: new Date().toISOString() }),
    [dispatch]
  );

  const updateMasterPlan = useCallback(
    (masterPlanId, updates) =>
      dispatch({ type: 'UPDATE_MASTER_PLAN', masterPlanId, updates, nowISO: new Date().toISOString() }),
    [dispatch]
  );

  const setActiveMasterPlan = useCallback(
    (masterPlanId, profileId) =>
      dispatch({ type: 'SET_ACTIVE_MASTER_PLAN', masterPlanId, profileId }),
    [dispatch]
  );

  const addMasterPlanAnchor = useCallback(
    (masterPlanId, anchor) =>
      dispatch({ type: 'ADD_MASTER_PLAN_ANCHOR', masterPlanId, anchor, nowISO: new Date().toISOString() }),
    [dispatch]
  );

  const updateMasterPlanAnchor = useCallback(
    (masterPlanId, anchorId, updates) =>
      dispatch({ type: 'UPDATE_MASTER_PLAN_ANCHOR', masterPlanId, anchorId, updates, nowISO: new Date().toISOString() }),
    [dispatch]
  );

  const addMasterPlanLane = useCallback(
    (masterPlanId, payload) =>
      dispatch({ type: 'ADD_MASTER_PLAN_LANE', masterPlanId, payload, nowISO: new Date().toISOString() }),
    [dispatch]
  );

  const updateMasterPlanLane = useCallback(
    (laneId, updates) => dispatch({ type: 'UPDATE_MASTER_PLAN_LANE', laneId, updates }),
    [dispatch]
  );

  const addMasterPlanMilestone = useCallback(
    (laneId, payload) => dispatch({ type: 'ADD_MASTER_PLAN_MILESTONE', laneId, payload }),
    [dispatch]
  );

  const updateMasterPlanMilestone = useCallback(
    (milestoneId, updates) =>
      dispatch({ type: 'UPDATE_MASTER_PLAN_MILESTONE', milestoneId, updates }),
    [dispatch]
  );

  const addLaneRequirement = useCallback(
    (laneId, payload) => dispatch({ type: 'ADD_LANE_REQUIREMENT', laneId, payload }),
    [dispatch]
  );

  const updateLaneRequirement = useCallback(
    (laneId, requirementId, updates) =>
      dispatch({ type: 'UPDATE_LANE_REQUIREMENT', laneId, requirementId, updates }),
    [dispatch]
  );

  const masterPlanIntakeStart = useCallback(
    (profileId) =>
      dispatch({ type: 'MASTER_PLAN_INTAKE_START', profileId }),
    [dispatch]
  );

  const masterPlanIntakeAnswer = useCallback(
    (value) =>
      dispatch({ type: 'MASTER_PLAN_INTAKE_ANSWER', value }),
    [dispatch]
  );

  const masterPlanIntakeLaneAdded = useCallback(
    (lane) =>
      dispatch({ type: 'MASTER_PLAN_INTAKE_LANE_ADDED', lane }),
    [dispatch]
  );

  const masterPlanIntakeSetLanes = useCallback(
    (lanes) =>
      dispatch({ type: 'MASTER_PLAN_INTAKE_SET_LANES', lanes }),
    [dispatch]
  );

  const masterPlanIntakeAssessed = useCallback(
    (laneIdx, assessment) =>
      dispatch({ type: 'MASTER_PLAN_INTAKE_ASSESSED', laneIdx, assessment }),
    [dispatch]
  );

  const masterPlanIntakeComplete = useCallback(
    () =>
      dispatch({ type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO: new Date().toISOString() }),
    [dispatch]
  );

  const masterPlanIntakeReset = useCallback(
    () => dispatch({ type: 'MASTER_PLAN_INTAKE_RESET' }),
    [dispatch]
  );

  const deleteMasterPlan = useCallback(
    (masterPlanId, profileId) => dispatch({ type: 'DELETE_MASTER_PLAN', masterPlanId, profileId }),
    [dispatch]
  );

  return {
    createMasterPlan,
    updateMasterPlan,
    setActiveMasterPlan,
    addMasterPlanAnchor,
    updateMasterPlanAnchor,
    addMasterPlanLane,
    updateMasterPlanLane,
    addMasterPlanMilestone,
    updateMasterPlanMilestone,
    addLaneRequirement,
    updateLaneRequirement,
    masterPlanIntakeStart,
    masterPlanIntakeAnswer,
    masterPlanIntakeLaneAdded,
    masterPlanIntakeSetLanes,
    masterPlanIntakeAssessed,
    masterPlanIntakeComplete,
    masterPlanIntakeReset,
    deleteMasterPlan,
  };
}
