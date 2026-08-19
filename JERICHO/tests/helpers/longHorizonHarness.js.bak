import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import {
  computeDerivedState,
  projectMonthDays,
  projectWeekDays,
  getBlockDayKey,
} from '../../src/state/identityCompute.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';
import { deriveForecastBlocks, validateBlockTitle } from '../../src/domain/masterPlan/forecastBlockDerivation.js';
import { deriveMasterPlanPhaseModel } from '../../src/domain/masterPlan/masterPlanPhaseModel.js';
import { buildOperationEndgameState } from './masterPlanFullHorizonScenario.js';

export { DEFAULT_PROFILE_ID, projectMonthDays, projectWeekDays, getBlockDayKey, deriveForecastBlocks, validateBlockTitle };

export function buildFiveYearPlanState({ nowISO = '2026-05-11T10:00:00.000Z', todayDate = '2026-05-11' } = {}) {
  const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate });
  state.masterPlanIntake = {
    status: 'in-progress',
    phase: 4,
    step: 13,
    profileId: DEFAULT_PROFILE_ID,
    answers: {
      step_2: 'Build a 5-year multi-venture platform reaching 10k users — coordinate Operation Endgame through a multi-lane master plan',
      step_3: { horizonEnd: '2031-05-11', months: 60, label: 'May 2031' },
      step_5: { exists: true, urgency: 'high', notes: '' },
      step_6: 'Execute.',
      lane_0_description: 'App in development.',
      lane_0_system_assessment: { assessedStage: 'in-development', assessedConfidence: 'high', assessmentNotes: '' },
      lane_0_activation: 'active',
      lane_0_clarifying_0: 'beta complete',
    },
    extractedLanes: [{ title: 'App launch', domain: 'product', role: 'revenue-engine' }],
    anchors: [{ id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17 launch', isFixed: true, affectedLaneIds: [], priority: 0 }],
    currentLaneIdx: 0,
    clarifyingQuestionIdx: 0,
    draft: null,
    errorMessage: null,
  };
  applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
  return computeDerivedState(state, { type: 'NO_OP' });
}

export function setHorizonMode(derived, mode) {
  return computeDerivedState(derived, { type: 'SET_SELECTED_HORIZON_MODE', mode });
}

export function getPlan(derived) {
  return Object.values(derived.masterPlansById || {})[0] || null;
}

export function getPhaseModel(derived) {
  const plan = getPlan(derived);
  if (!plan) {return null;}
  const lanes = (plan.laneIds || []).map((id) => derived.masterPlanLanesById?.[id]).filter(Boolean);
  const milestones = lanes
    .flatMap((lane) => (lane.milestoneIds || []).map((id) => derived.masterPlanMilestonesById?.[id]))
    .filter(Boolean);
  return deriveMasterPlanPhaseModel({
    plan,
    lanes,
    milestones,
    anchors: plan.anchors || [],
    planCycle: null,
    committedBlocks: [],
    criticQuestionsByLane: {},
  });
}

export function getCalendarBlocks(derived) {
  return derived.calendarDisplayBlocks || [];
}

export function getForecastBlocks(derived) {
  return (derived.calendarDisplayBlocks || []).filter((block) => block.source === 'derived');
}

export function getBlocksByPhase(derived, phaseLabel) {
  return (derived.calendarDisplayBlocks || []).filter((block) => block.phaseLabel === phaseLabel);
}

export function buildFreshMasterPlanCycleState() {
  const established = buildOperationEndgameState();
  return computeDerivedState(established, {
    type: 'START_NEW_CYCLE_WITH_DECISION',
    payload: { mode: 'archive' },
  });
}

export function makeSyntheticCalendarBlock(overrides = {}) {
  return {
    id: 'synthetic-block-1',
    title: 'Synthetic horizon block',
    displayTitle: 'Synthetic horizon block',
    dayKey: '2027-01-15',
    start: '2027-01-15T09:00:00.000Z',
    startISO: '2027-01-15T09:00:00.000Z',
    end: '2027-01-15T10:00:00.000Z',
    endISO: '2027-01-15T10:00:00.000Z',
    source: 'derived',
    phaseLabel: 'P2',
    executionEligibility: 'locked',
    ...overrides,
  };
}
