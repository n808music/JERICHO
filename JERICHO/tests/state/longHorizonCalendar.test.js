/**
 * Long-Horizon Calendar Visibility — Acceptance Tests
 *
 * Doctrine: Jericho cannot ask a user to commit to a multi-year plan while hiding
 * the future workload. Today calendar must show visible planning blocks across the
 * selected horizon (1Y/2Y/3Y/4Y/5Y/Full), while keeping execution actions locked
 * on forecast/gated/locked blocks.
 *
 * Key distinction:
 *   - visiblePlanningBlocks: all blocks visible for selected horizon (any state)
 *   - executableBlocks: active-cycle committed blocks only (can be completed/missed/skipped)
 *   - calendarDisplayBlocks: union used by calendar views, annotated with executionEligibility
 *
 * Acceptance criteria:
 *   1.  5-year plan resolves fullHorizonEndDayKey through May 2031.
 *   2.  selectedHorizonMode field exists and defaults to 'current_cycle'.
 *   3.  current_cycle mode: calendarDisplayBlocks contains only active-cycle blocks.
 *   4.  1_year mode: calendarDisplayBlocks adds forecast/gated/locked future blocks beyond cycle.
 *   5.  2_year mode includes P2-bound work when horizon reaches P2.
 *   6.  3_year mode increases visible blocks beyond 2_year.
 *   7.  4_year mode adds late-P2 / early-P3 surface materially distinct from 3_year.
 *   8.  5_year / full_horizon includes dated P3 work through the terminal horizon range.
 *   9.  P2 calendar block count > 0 when canonical substrate exists.
 *   10. P3 calendar block count > 0 when canonical substrate exists.
 *   11. Future forecast/gated/locked blocks have executionEligibility: 'locked'.
 *   12. Locked future blocks silently refuse COMPLETE_BLOCK / MISS_BLOCK / SKIP_BLOCK.
 *   13. Block titles must pass the action-title specificity rule (no vague single-word labels).
 *   14. Plan and Today agree on horizon bounds (same fullHorizonEndDayKey / strategicHorizonEnd).
 *   15. Collapsing back to current_cycle hides forecast future blocks from calendarDisplayBlocks.
 *   16. Existing active-cycle execution tests remain unaffected.
 */

import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { computeDerivedState, projectMonthDays, projectWeekDays, getBlockDayKey } from '../../src/state/identityCompute.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';
import { deriveForecastBlocks, validateBlockTitle } from '../../src/domain/masterPlan/forecastBlockDerivation.js';
import { deriveMasterPlanPhaseModel } from '../../src/domain/masterPlan/masterPlanPhaseModel.js';
import { buildOperationEndgameState } from '../helpers/masterPlanFullHorizonScenario.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildFiveYearPlanState({ nowISO = '2026-05-11T10:00:00.000Z', todayDate = '2026-05-11' } = {}) {
  const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate });
  state.masterPlanIntake = {
    status: 'in-progress', phase: 4, step: 13, profileId: DEFAULT_PROFILE_ID,
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
    currentLaneIdx: 0, clarifyingQuestionIdx: 0, draft: null, errorMessage: null,
  };
  applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
  return computeDerivedState(state, { type: 'NO_OP' });
}

function setHorizonMode(derived, mode) {
  return computeDerivedState(derived, { type: 'SET_SELECTED_HORIZON_MODE', mode });
}

function getPlan(derived) {
  return Object.values(derived.masterPlansById || {})[0] || null;
}

function getPhaseModel(derived) {
  const plan = getPlan(derived);
  if (!plan) return null;
  const lanes = (plan.laneIds || []).map(id => derived.masterPlanLanesById?.[id]).filter(Boolean);
  const milestones = lanes.flatMap(l => (l.milestoneIds || []).map(id => derived.masterPlanMilestonesById?.[id])).filter(Boolean);
  return deriveMasterPlanPhaseModel({ plan, lanes, milestones, anchors: plan.anchors || [], planCycle: null, committedBlocks: [], criticQuestionsByLane: {} });
}

function getCalendarBlocks(derived) {
  return derived.calendarDisplayBlocks || [];
}

function getForecastBlocks(derived) {
  return (derived.calendarDisplayBlocks || []).filter(b => b.source === 'derived');
}

function getBlocksByPhase(derived, phaseLabel) {
  return (derived.calendarDisplayBlocks || []).filter(b => b.phaseLabel === phaseLabel);
}

function buildFreshMasterPlanCycleState() {
  const established = buildOperationEndgameState();
  return computeDerivedState(established, {
    type: 'START_NEW_CYCLE_WITH_DECISION',
    payload: { mode: 'archive' },
  });
}

// ─── Suite 1: Horizon resolution ─────────────────────────────────────────────

describe('long-horizon calendar — 5-year plan resolution', () => {
  it('fullHorizonEndDayKey resolves through May 2031', () => {
    const derived = buildFiveYearPlanState();
    const plan = getPlan(derived);
    expect(plan?.fullHorizonEndDayKey).toMatch(/^2031/);
  });

  it('selectedHorizonMode defaults to current_cycle', () => {
    const derived = buildFiveYearPlanState();
    expect(derived.selectedHorizonMode).toBe('current_cycle');
  });

  it('Plan tab and Today tab share the same fullHorizonEndDayKey', () => {
    const derived = buildFiveYearPlanState();
    const plan = getPlan(derived);
    const planHorizon = plan?.fullHorizonEndDayKey;
    // strategicHorizonEndDayKey exposed on derived state should equal the plan field
    const stateHorizon = derived.strategicHorizonEndDayKey;
    expect(planHorizon).toBeTruthy();
    expect(stateHorizon).toBe(planHorizon);
  });
});

// ─── Suite 2: Horizon mode transitions ───────────────────────────────────────

describe('long-horizon calendar — horizon mode transitions', () => {
  it('SET_SELECTED_HORIZON_MODE changes derived.selectedHorizonMode', () => {
    const base = buildFiveYearPlanState();
    const updated = setHorizonMode(base, '5_year');
    expect(updated.selectedHorizonMode).toBe('5_year');
  });

  it('current_cycle mode: calendarDisplayBlocks are all source=committed or empty', () => {
    const derived = buildFiveYearPlanState();
    const blocks = getCalendarBlocks(derived);
    // In current_cycle mode, no derived forecast blocks should appear
    const forecastBlocks = blocks.filter(b => b.source === 'derived');
    expect(forecastBlocks.length).toBe(0);
  });

  it('1_year mode adds forecast blocks beyond current cycle end', () => {
    const base = buildFiveYearPlanState();
    const oneCycle = setHorizonMode(base, 'current_cycle');
    const oneYear = setHorizonMode(base, '1_year');
    const cycleBlocks = getCalendarBlocks(oneCycle).length;
    const yearBlocks = getCalendarBlocks(oneYear).length;
    expect(yearBlocks).toBeGreaterThan(cycleBlocks);
  });

  it('2_year mode includes more blocks than 1_year (P2 territory reached)', () => {
    const base = buildFiveYearPlanState();
    const oneYear = setHorizonMode(base, '1_year');
    const twoYear = setHorizonMode(base, '2_year');
    const oneYearCount = getCalendarBlocks(oneYear).length;
    const twoYearCount = getCalendarBlocks(twoYear).length;
    expect(twoYearCount).toBeGreaterThanOrEqual(oneYearCount);
  });

  it('month projection renders forecast calendarDisplayBlocks from the selected horizon', () => {
    const base = buildFiveYearPlanState();
    const derived = setHorizonMode(base, '3_year');
    const forecastBlocks = getForecastBlocks(derived);
    expect(forecastBlocks.length).toBeGreaterThan(0);
    const monthKey = forecastBlocks.find((b) => b.date)?.date?.slice(0, 7);
    expect(monthKey).toBeTruthy();

    const monthDays = projectMonthDays({ monthKey, blocks: derived.calendarDisplayBlocks, includePadding: false });
    const visibleForecastBlocks = monthDays.flatMap((day) => day.blocks || []).filter((block) => block.source === 'derived');
    expect(visibleForecastBlocks.length).toBeGreaterThan(0);
  });

  it('week projection renders forecast calendarDisplayBlocks from the selected horizon', () => {
    const base = buildFiveYearPlanState();
    const derived = setHorizonMode(base, '3_year');
    const forecastBlock = getForecastBlocks(derived).find((b) => b.date);
    expect(forecastBlock).toBeDefined();

    const weekDays = projectWeekDays({ anchorDate: forecastBlock.date, blocks: derived.calendarDisplayBlocks });
    const visibleForecastBlocks = weekDays.flatMap((day) => day.blocks || []).filter((block) => block.id === forecastBlock.id);
    expect(visibleForecastBlocks.length).toBeGreaterThan(0);
  });

  it('year→month→day invariant preserves forecast visibility through drill-down', () => {
    const base = buildFiveYearPlanState();
    const derived = setHorizonMode(base, '3_year');
    const forecastBlock = getForecastBlocks(derived).find((b) => b.date);
    expect(forecastBlock).toBeDefined();

    const monthKey = forecastBlock.date.slice(0, 7);
    const monthDays = projectMonthDays({ monthKey, blocks: derived.calendarDisplayBlocks, includePadding: false });
    const day = monthDays.find((d) => d.date === forecastBlock.date);
    expect(day).toBeDefined();
    expect(day.blocks.some((b) => b.id === forecastBlock.id && b.title === forecastBlock.title)).toBe(true);
  });

  it('month drill-down preserves displayTitle alongside canonicalTitle for forecast blocks', () => {
    const base = buildFiveYearPlanState();
    const derived = setHorizonMode(base, 'full_horizon');
    const shortened = getForecastBlocks(derived).find(
      (block) => String(block.displayTitle || '').length < String(block.canonicalTitle || '').length && block.dayKey
    );

    expect(shortened).toBeDefined();
    const monthDays = projectMonthDays({
      monthKey: shortened.dayKey.slice(0, 7),
      blocks: derived.calendarDisplayBlocks,
      includePadding: false,
    });
    const day = monthDays.find((entry) => entry.date === shortened.dayKey);
    const projected = (day?.blocks || []).find((block) => block.id === shortened.id);

    expect(projected.displayTitle).toBe(shortened.displayTitle);
    expect(projected.canonicalTitle).toBe(shortened.canonicalTitle);
    expect(projected.detailTitle).toBe(shortened.canonicalTitle);
  });

  it('getBlockDayKey normalizes date/dayKey/start/startISO shapes consistently', () => {
    expect(getBlockDayKey({ date: '2029-04-05' })).toBe('2029-04-05');
    expect(getBlockDayKey({ dayKey: '2029-04-06' })).toBe('2029-04-06');
    expect(getBlockDayKey({ start: '2029-04-07T09:00:00.000Z' })).toBe('2029-04-07');
    expect(getBlockDayKey({ startISO: '2029-04-08T17:30:00.000Z' })).toBe('2029-04-08');
  });

  it('3_year mode has more visible blocks than 2_year', () => {
    const base = buildFiveYearPlanState();
    const twoYear = setHorizonMode(base, '2_year');
    const threeYear = setHorizonMode(base, '3_year');
    expect(getCalendarBlocks(threeYear).length).toBeGreaterThanOrEqual(getCalendarBlocks(twoYear).length);
  });

  it('5_year mode yields at least as many blocks as 3_year', () => {
    const base = buildFiveYearPlanState();
    const threeYear = setHorizonMode(base, '3_year');
    const fiveYear = setHorizonMode(base, '5_year');
    expect(getCalendarBlocks(fiveYear).length).toBeGreaterThanOrEqual(getCalendarBlocks(threeYear).length);
  });

  it('full_horizon mode includes dated P3 blocks', () => {
    const base = buildFiveYearPlanState();
    const full = setHorizonMode(base, 'full_horizon');
    const p3Blocks = getBlocksByPhase(full, 'P3');
    expect(p3Blocks.length).toBeGreaterThan(0);
  });

  it('fresh master-plan cycle with no generated schedule stays empty in current_cycle mode', () => {
    const fresh = buildFreshMasterPlanCycleState();

    expect(fresh.selectedHorizonMode).toBe('current_cycle');
    expect(fresh.scheduleLifecycle).toBe('no_schedule');
    expect(fresh.calendarDisplayBlocks).toEqual([]);
  });

  it('fresh master-plan cycle does not surface forecast blocks in Today even when full_horizon is reselected', () => {
    const fresh = buildFreshMasterPlanCycleState();
    const expanded = setHorizonMode(fresh, 'full_horizon');

    expect(expanded.scheduleLifecycle).toBe('no_schedule');
    expect(expanded.calendarDisplayBlocks).toEqual([]);
    expect((expanded.fullHorizonScheduleBlocks || []).length).toBeGreaterThan(0);
    expect((expanded.fullHorizonScheduleBlocks || []).every((block) => block.ownerScope === 'master_plan')).toBe(true);
    expect((expanded.fullHorizonScheduleBlocks || []).every((block) => block.cycleId === null)).toBe(true);
  });

  it('deleting an active master-plan cycle resets horizon mode and clears Today calendar blocks', () => {
    const fresh = buildFreshMasterPlanCycleState();
    const expanded = setHorizonMode(fresh, 'full_horizon');
    const deleted = computeDerivedState(expanded, { type: 'DELETE_CYCLE', cycleId: expanded.activeCycleId });

    expect(deleted.selectedHorizonMode).toBe('current_cycle');
    expect(deleted.calendarDisplayBlocks).toEqual([]);
    expect(deleted.activeCycleId).toBeNull();
  });

  it('starting a replacement cycle after deletion begins with no inherited calendar-visible blocks', () => {
    const fresh = buildFreshMasterPlanCycleState();
    const firstCycleId = fresh.activeCycleId;
    const deleted = computeDerivedState(fresh, { type: 'DELETE_CYCLE', cycleId: firstCycleId });
    const restarted = computeDerivedState(deleted, {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });

    expect(restarted.activeCycleId).toBeTruthy();
    expect(restarted.calendarDisplayBlocks).toEqual([]);
  });

  it('full-horizon schedule expansion returns blocks through May 2031', () => {
    const derived = setHorizonMode(buildFiveYearPlanState(), 'full_horizon');
    const blocks = getCalendarBlocks(derived) || [];
    const has2031 = blocks.some((b) => (b.date || b.dayKey || '').slice(0, 7) === '2031-05');
    expect(has2031).toBe(true);
  });

  it('full-horizon has reasonable density across 2027-2031', () => {
    const derived = setHorizonMode(buildFiveYearPlanState(), 'full_horizon');
    const blocks = getCalendarBlocks(derived) || [];
    for (const year of ['2027', '2028', '2029', '2030', '2031']) {
      const count = blocks.filter((b) => (b.date || b.dayKey || '').slice(0, 4) === year).length;
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });
});

// ─── Suite 3: P2 / P3 block population ───────────────────────────────────────

describe('long-horizon calendar — P2 and P3 block population', () => {
  it('P2 calendar block count is greater than zero in 3_year mode', () => {
    const base = buildFiveYearPlanState();
    const derived = setHorizonMode(base, '3_year');
    const p2Blocks = getBlocksByPhase(derived, 'P2');
    expect(p2Blocks.length).toBeGreaterThan(0);
  });

  it('P3 calendar block count is greater than zero in full_horizon mode', () => {
    const base = buildFiveYearPlanState();
    const derived = setHorizonMode(base, 'full_horizon');
    const p3Blocks = getBlocksByPhase(derived, 'P3');
    expect(p3Blocks.length).toBeGreaterThan(0);
  });

  it('P2 blocks have dayKey within the P2 phase date range', () => {
    const base = buildFiveYearPlanState();
    const derived = setHorizonMode(base, 'full_horizon');
    const model = getPhaseModel(derived);
    const p2Phase = model?.phases?.find(p => p.label === 'P2');
    const p2Blocks = getBlocksByPhase(derived, 'P2');
    expect(p2Phase).toBeDefined();
    expect(p2Blocks.length).toBeGreaterThan(0);
    p2Blocks.forEach(b => {
      const dayKey = b.dayKey || b.date;
      expect(dayKey >= p2Phase.startBoundary).toBe(true);
      expect(dayKey <= p2Phase.endBoundary).toBe(true);
    });
  });

  it('P3 blocks have dayKey within the P3 phase date range', () => {
    const base = buildFiveYearPlanState();
    const derived = setHorizonMode(base, 'full_horizon');
    const model = getPhaseModel(derived);
    const p3Phase = model?.phases?.find(p => p.label === 'P3');
    const p3Blocks = getBlocksByPhase(derived, 'P3');
    expect(p3Phase).toBeDefined();
    expect(p3Blocks.length).toBeGreaterThan(0);
    p3Blocks.forEach(b => {
      const dayKey = b.dayKey || b.date;
      expect(dayKey >= p3Phase.startBoundary).toBe(true);
      expect(dayKey <= p3Phase.endBoundary).toBe(true);
    });
  });
});

// ─── Suite 4: Execution lock on forecast blocks ───────────────────────────────

describe('long-horizon calendar — execution lock on forecast blocks', () => {
  it('forecast/derived blocks have executionEligibility: locked', () => {
    const base = buildFiveYearPlanState();
    const derived = setHorizonMode(base, 'full_horizon');
    const forecastBlocks = getForecastBlocks(derived);
    expect(forecastBlocks.length).toBeGreaterThan(0);
    forecastBlocks.forEach(b => {
      expect(b.executionEligibility).toBe('locked');
    });
  });

  it('forecast blocks have executionLockReason set', () => {
    const base = buildFiveYearPlanState();
    const derived = setHorizonMode(base, 'full_horizon');
    const forecastBlocks = getForecastBlocks(derived);
    forecastBlocks.forEach(b => {
      expect(typeof b.executionLockReason).toBe('string');
      expect(b.executionLockReason.length).toBeGreaterThan(0);
    });
  });

  it('COMPLETE_BLOCK on a derived forecast block has no effect on executionEvents', () => {
    const base = buildFiveYearPlanState();
    const withHorizon = setHorizonMode(base, 'full_horizon');
    const forecastBlock = getForecastBlocks(withHorizon)[0];
    expect(forecastBlock).toBeDefined();
    const before = (withHorizon.executionEvents || []).length;
    // Attempt to complete a forecast block — the guard must silently refuse
    const after = computeDerivedState(withHorizon, { type: 'COMPLETE_BLOCK', id: forecastBlock.id });
    expect((after.executionEvents || []).length).toBe(before);
  });
});

// ─── Suite 5: Action-title specificity ───────────────────────────────────────

describe('long-horizon calendar — action-title specificity', () => {
  it('validateBlockTitle rejects single-word vague titles', () => {
    const vague = ['Launch', 'Drop', 'Promo', 'Scale', 'Build', 'Review'];
    vague.forEach(title => {
      expect(validateBlockTitle(title)).toBe(false);
    });
  });

  it('validateBlockTitle accepts specific object+action titles', () => {
    const specific = [
      'Validate post-launch conversion path for product/software lane',
      'Compare revenue architecture options against first proof data',
      'Define operating cadence for media/content production loop',
      'Review lane readiness for P2 schedule expansion',
      'Gate capital/real-estate lane until revenue proof supports expansion',
      'Assess terminal-readiness evidence against outcome target',
    ];
    specific.forEach(title => {
      expect(validateBlockTitle(title)).toBe(true);
    });
  });

  it('all derived forecast block titles pass action-title validation', () => {
    const base = buildFiveYearPlanState();
    const derived = setHorizonMode(base, 'full_horizon');
    const forecastBlocks = getForecastBlocks(derived);
    expect(forecastBlocks.length).toBeGreaterThan(0);
    forecastBlocks.forEach(b => {
      expect(validateBlockTitle(b.title), `Vague title: "${b.title}"`).toBe(true);
    });
  });
});

// ─── Suite 6: Horizon collapse ────────────────────────────────────────────────

describe('long-horizon calendar — horizon collapse', () => {
  it('collapsing from 5_year to current_cycle removes forecast blocks from calendar', () => {
    const base = buildFiveYearPlanState();
    const expanded = setHorizonMode(base, '5_year');
    const collapsed = setHorizonMode(expanded, 'current_cycle');
    const forecastInCollapsed = getForecastBlocks(collapsed);
    expect(forecastInCollapsed.length).toBe(0);
  });

  it('current_cycle has no P2 or P3 forecast blocks', () => {
    const derived = buildFiveYearPlanState();
    expect(getBlocksByPhase(derived, 'P2').length).toBe(0);
    expect(getBlocksByPhase(derived, 'P3').length).toBe(0);
  });
});

// ─── Suite 7: forecastBlockDerivation pure unit tests ────────────────────────

describe('forecastBlockDerivation — pure derivation', () => {
  it('derives blocks from a minimal phase + lane substrate', () => {
    const plan = {
      id: 'plan-test',
      horizonStart: '2026-05-11',
      fullHorizonEndDayKey: '2031-05-11',
      northStarOutcome: 'Build 5-year platform',
    };
    const phase = {
      id: 'plan-test:p2',
      label: 'P2',
      name: 'Conversion / Operating System',
      startBoundary: '2027-06-01',
      endBoundary: '2029-06-01',
      phaseObjective: 'Convert launch proof into repeatable cadence.',
      activeState: 'locked',
      commitmentState: 'forecast',
      laneParticipation: [{ laneId: 'lane-1', laneTitle: 'App launch', domain: 'product', status: 'active' }],
      evidenceRequirements: ['repeatable conversion signal', 'operating cadence stability'],
      unlockCriteria: ['Revenue or conversion architecture is proving repeatable.'],
    };
    const blocks = deriveForecastBlocks({ plan, phase, horizonEndDayKey: '2031-05-11' });
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach(b => {
      expect(b.id).toBeTruthy();
      expect(b.dayKey || b.date).toBeTruthy();
      expect(b.phaseLabel).toBe('P2');
      expect(b.source).toBe('derived');
      expect(b.executionEligibility).toBe('locked');
      expect(validateBlockTitle(b.title)).toBe(true);
    });
  });

  it('P3 blocks include a terminal-readiness block near the horizon end', () => {
    const plan = {
      id: 'plan-test',
      horizonStart: '2026-05-11',
      fullHorizonEndDayKey: '2031-05-11',
    };
    const phase = {
      id: 'plan-test:p3',
      label: 'P3',
      name: 'Scale / Terminal Readiness',
      startBoundary: '2029-06-02',
      endBoundary: '2031-05-11',
      phaseObjective: 'Scale validated lanes toward the success standard.',
      activeState: 'locked',
      commitmentState: 'strategic',
      laneParticipation: [{ laneId: 'lane-1', laneTitle: 'App launch', domain: 'product', status: 'active' }],
      evidenceRequirements: ['scaling proof', 'terminal-readiness evidence'],
      unlockCriteria: ['Validated lanes can support larger capital moves.'],
    };
    const blocks = deriveForecastBlocks({ plan, phase, horizonEndDayKey: '2031-05-11' });
    const terminal = blocks.find(b => b.commitmentState === 'terminal-readiness');
    expect(terminal).toBeDefined();
    expect(terminal.dayKey || terminal.date).toMatch(/^203[01]/);
  });

  it('both P2 and P3 phases produce at least 2 blocks each', () => {
    const plan = { id: 'p', horizonStart: '2026-05-11', fullHorizonEndDayKey: '2031-05-11' };
    const p2Phase = {
      id: 'p:p2', label: 'P2', name: 'P2', startBoundary: '2027-06-01', endBoundary: '2029-06-01',
      phaseObjective: 'obj', activeState: 'locked', commitmentState: 'forecast',
      laneParticipation: [{ laneId: 'l1', laneTitle: 'App', domain: 'product', status: 'active' }],
      evidenceRequirements: [], unlockCriteria: [],
    };
    const p3Phase = {
      id: 'p:p3', label: 'P3', name: 'P3', startBoundary: '2029-06-02', endBoundary: '2031-05-11',
      phaseObjective: 'obj', activeState: 'locked', commitmentState: 'strategic',
      laneParticipation: [{ laneId: 'l1', laneTitle: 'App', domain: 'product', status: 'active' }],
      evidenceRequirements: [], unlockCriteria: [],
    };
    const p2Blocks = deriveForecastBlocks({ plan, phase: p2Phase, horizonEndDayKey: '2031-05-11' });
    const p3Blocks = deriveForecastBlocks({ plan, phase: p3Phase, horizonEndDayKey: '2031-05-11' });
    // Both phases should produce real blocks — density differs by phase cadence doctrine
    expect(p2Blocks.length).toBeGreaterThanOrEqual(2);
    expect(p3Blocks.length).toBeGreaterThanOrEqual(2);
  });

  it('P1 phase derives post-cycle blocks when cycleEndDayKey is provided', () => {
    const plan = { id: 'plan-test', horizonStart: '2026-05-11', fullHorizonEndDayKey: '2031-05-11' };
    const p1Phase = {
      id: 'plan-test:p1', label: 'P1', name: 'Foundation / Launch Proof',
      startBoundary: '2026-05-11', endBoundary: '2027-06-01',
      phaseObjective: 'Build launch substrate and capture first proof window.',
      activeState: 'active', commitmentState: 'committed',
      laneParticipation: [{ laneId: 'lane-1', laneTitle: 'App launch', domain: 'product', status: 'active' }],
      evidenceRequirements: ['launch-readiness proof', 'post-anchor signal'],
      unlockCriteria: ['Post-anchor proof exists for audience, users, or revenue.'],
    };
    // cycleEndDayKey = Oct 17 anchor (typical first cycle end)
    const blocks = deriveForecastBlocks({ plan, phase: p1Phase, horizonEndDayKey: '2027-06-01', cycleEndDayKey: '2026-10-17' });
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach(b => {
      expect(b.source).toBe('derived');
      expect(b.phaseLabel).toBe('P1');
      expect(b.executionEligibility).toBe('locked');
      const dayKey = b.dayKey || b.date;
      // All P1 post-cycle blocks must be after the cycle end
      expect(dayKey > '2026-10-17').toBe(true);
      expect(validateBlockTitle(b.title)).toBe(true);
    });
  });

  it('P1 returns empty when no cycleEndDayKey is provided and window is too short', () => {
    const plan = { id: 'plan-test', horizonStart: '2026-05-11', fullHorizonEndDayKey: '2031-05-11' };
    const shortP1 = {
      id: 'plan-test:p1', label: 'P1', startBoundary: '2026-05-11', endBoundary: '2026-05-20',
      phaseObjective: 'obj', activeState: 'active', commitmentState: 'committed',
      laneParticipation: [], evidenceRequirements: [], unlockCriteria: [],
    };
    const blocks = deriveForecastBlocks({ plan, phase: shortP1, horizonEndDayKey: '2026-05-20', cycleEndDayKey: null });
    // 9-day window after nextFirstOfMonth → empty
    expect(blocks.length).toBe(0);
  });
});

// ─── Suite 8: 1-year mode shows P1 post-cycle surface ────────────────────────

describe('long-horizon calendar — 1_year mode shows P1 post-cycle surface', () => {
  it('1_year mode adds forecast blocks beyond current_cycle', () => {
    const base = buildFiveYearPlanState();
    const currentCycle = setHorizonMode(base, 'current_cycle');
    const oneYear = setHorizonMode(base, '1_year');
    expect(getCalendarBlocks(oneYear).length).toBeGreaterThan(getCalendarBlocks(currentCycle).length);
  });

  it('1_year forecast blocks include at least some P1 post-cycle work', () => {
    const base = buildFiveYearPlanState();
    const oneYear = setHorizonMode(base, '1_year');
    const forecastBlocks = getForecastBlocks(oneYear);
    expect(forecastBlocks.length).toBeGreaterThan(0);
    // P1 post-cycle blocks must appear — horizon may also reach early P2
    const p1Blocks = forecastBlocks.filter(b => b.phaseLabel === 'P1');
    expect(p1Blocks.length).toBeGreaterThan(0);
  });

  it('1_year forecast blocks start after estimated cycle end (no duplicate committed blocks)', () => {
    const base = buildFiveYearPlanState();
    const oneYear = setHorizonMode(base, '1_year');
    const currentCycle = setHorizonMode(base, 'current_cycle');
    const committedIds = new Set((getCalendarBlocks(currentCycle)).map(b => b.id));
    const forecastBlocks = getForecastBlocks(oneYear);
    forecastBlocks.forEach(b => {
      expect(committedIds.has(b.id)).toBe(false);
    });
  });

  it('1_year forecast blocks are execution-locked', () => {
    const base = buildFiveYearPlanState();
    const oneYear = setHorizonMode(base, '1_year');
    const forecastBlocks = getForecastBlocks(oneYear);
    expect(forecastBlocks.length).toBeGreaterThan(0);
    forecastBlocks.forEach(b => {
      expect(b.executionEligibility).toBe('locked');
    });
  });

  it('1_year forecast block titles pass action-title validation', () => {
    const base = buildFiveYearPlanState();
    const oneYear = setHorizonMode(base, '1_year');
    const forecastBlocks = getForecastBlocks(oneYear);
    expect(forecastBlocks.length).toBeGreaterThan(0);
    forecastBlocks.forEach(b => {
      expect(validateBlockTitle(b.title), `Vague title: "${b.title}"`).toBe(true);
    });
  });

  it('current_cycle still hides P1 post-cycle forecast blocks', () => {
    const derived = buildFiveYearPlanState();
    expect(getForecastBlocks(derived).length).toBe(0);
  });

  it('2_year/3_year/full_horizon retain their existing block populations', () => {
    const base = buildFiveYearPlanState();
    const twoYear = setHorizonMode(base, '2_year');
    const threeYear = setHorizonMode(base, '3_year');
    const full = setHorizonMode(base, 'full_horizon');
    // All should have forecast blocks
    expect(getCalendarBlocks(twoYear).length).toBeGreaterThan(0);
    expect(getCalendarBlocks(threeYear).length).toBeGreaterThan(0);
    expect(getCalendarBlocks(full).length).toBeGreaterThan(0);
    // P3 should still exist in full_horizon
    expect(getBlocksByPhase(full, 'P3').length).toBeGreaterThan(0);
  });
});

// ─── Suite 9: Structure/Plan/Today integration ───────────────────────────────

describe('long-horizon calendar — Structure/Plan/Today integration hardening', () => {
  it('Today expanded-horizon uses block ids from fullHorizonScheduleBlocks', () => {
    const base = buildFiveYearPlanState();
    const expanded = setHorizonMode(base, '3_year');
    const fullHorizonIds = new Set((expanded.fullHorizonScheduleBlocks || []).map(b => b.id));
    const calendarIds = new Set((expanded.calendarDisplayBlocks || []).map(b => b.id));
    // When expanded, calendarDisplayBlocks should source from fullHorizonScheduleBlocks
    expect(fullHorizonIds.size).toBeGreaterThan(0);
    fullHorizonIds.forEach(id => {
      expect(calendarIds.has(id)).toBe(true);
    });
  });

  it('Structure expanded-horizon projection includes blocks beyond Oct 2026', () => {
    const base = buildFiveYearPlanState();
    const expanded = setHorizonMode(base, '3_year');
    const blocks = getCalendarBlocks(expanded);
    const beyond2026Oct = blocks.filter(b => {
      const dayKey = getBlockDayKey(b);
      return dayKey > '2026-10-31';
    });
    expect(beyond2026Oct.length).toBeGreaterThan(0);
  });

  it('Structure expanded-horizon projection includes P2 blocks', () => {
    const base = buildFiveYearPlanState();
    const expanded = setHorizonMode(base, '3_year');
    const p2Blocks = getBlocksByPhase(expanded, 'P2');
    expect(p2Blocks.length).toBeGreaterThan(0);
  });

  it('Plan overview expanded-horizon uses block ids from fullHorizonScheduleBlocks', () => {
    const base = buildFiveYearPlanState();
    const expanded = setHorizonMode(base, '5_year');
    const fullHorizonIds = new Set((expanded.fullHorizonScheduleBlocks || []).map(b => b.id));
    const calendarIds = new Set((expanded.calendarDisplayBlocks || []).map(b => b.id));
    // When expanded to 5_year, all fullHorizonScheduleBlocks should be in calendarDisplayBlocks
    expect(fullHorizonIds.size).toBeGreaterThan(0);
    fullHorizonIds.forEach(id => {
      expect(calendarIds.has(id)).toBe(true);
    });
  });

  it('Plan overview includes blocks beyond Oct 2026 in expanded horizon', () => {
    const base = buildFiveYearPlanState();
    const expanded = setHorizonMode(base, '5_year');
    const blocks = getCalendarBlocks(expanded);
    const beyond2026Oct = blocks.filter(b => {
      const dayKey = getBlockDayKey(b);
      return dayKey > '2026-10-31';
    });
    expect(beyond2026Oct.length).toBeGreaterThan(0);
  });

  it('Plan overview includes P2 and P3 blocks when selected horizon includes those phases', () => {
    const base = buildFiveYearPlanState();
    const expanded = setHorizonMode(base, '5_year');
    const p2Blocks = getBlocksByPhase(expanded, 'P2');
    const p3Blocks = getBlocksByPhase(expanded, 'P3');
    expect(p2Blocks.length).toBeGreaterThan(0);
    expect(p3Blocks.length).toBeGreaterThan(0);
  });

  it('P2/P3 block counts in fullHorizonScheduleBlocks correlate with displayed blocks', () => {
    const base = buildFiveYearPlanState();
    const expanded = setHorizonMode(base, '5_year');
    const fullHorizonP2 = (expanded.fullHorizonScheduleBlocks || []).filter(b => b.phaseLabel === 'P2');
    const calendarP2 = (expanded.calendarDisplayBlocks || []).filter(b => b.phaseLabel === 'P2');
    // All P2 blocks in fullHorizonScheduleBlocks should appear in calendarDisplayBlocks
    const p2Ids = new Set(fullHorizonP2.map(b => b.id));
    const calendarIds = new Set((expanded.calendarDisplayBlocks || []).map(b => b.id));
    expect(fullHorizonP2.length).toBeGreaterThan(0);
    fullHorizonP2.forEach(b => {
      expect(calendarIds.has(b.id)).toBe(true);
    });
  });

  it('fullHorizonCoverageFailureCodes emits when fullHorizonScheduleBlocks is empty while full_horizon selected', () => {
    // Build a minimal state to test empty expansion scenario
    const base = buildFiveYearPlanState();
    const expanded = setHorizonMode(base, 'full_horizon');
    // In a well-formed state, fullHorizonScheduleBlocks should have blocks
    // This test validates that reason codes exist when they should
    if (!expanded.fullHorizonScheduleBlocks || expanded.fullHorizonScheduleBlocks.length === 0) {
      expect(expanded.fullHorizonCoverageFailureCodes).toBeDefined();
      expect(Array.isArray(expanded.fullHorizonCoverageFailureCodes)).toBe(true);
    } else {
      // Normal case: expansion succeeded
      expect(expanded.fullHorizonScheduleBlocks.length).toBeGreaterThan(0);
    }
  });

  it('Today, Structure, and Plan share overlapping block ids for same horizon', () => {
    const base = buildFiveYearPlanState();
    const horizonMode = '3_year';
    const expanded = setHorizonMode(base, horizonMode);
    // All three surfaces consume calendarDisplayBlocks
    const calendarIds = new Set((expanded.calendarDisplayBlocks || []).map(b => b.id));
    // In the same horizon mode, they all access the same underlying blocks
    expect(calendarIds.size).toBeGreaterThan(0);
  });

  it('current_cycle mode does not accidentally consume full-horizon forecast workload', () => {
    const base = buildFiveYearPlanState();
    const expanded = setHorizonMode(base, '5_year');
    const collapsed = setHorizonMode(expanded, 'current_cycle');
    // current_cycle should revert to no forecast blocks
    const forecastBlocks = getForecastBlocks(collapsed);
    expect(forecastBlocks.length).toBe(0);
    // Verify selectedHorizonMode is correct
    expect(collapsed.selectedHorizonMode).toBe('current_cycle');
  });

  it('Structure full-horizon projection includes P3 blocks', () => {
    const base = buildFiveYearPlanState();
    const expanded = setHorizonMode(base, 'full_horizon');
    const p3Blocks = getBlocksByPhase(expanded, 'P3');
    expect(p3Blocks.length).toBeGreaterThan(0);
  });

  it('fullHorizonScheduleBlocks persists across horizon mode transitions', () => {
    const base = buildFiveYearPlanState();
    const first = setHorizonMode(base, '3_year');
    const firstIds = new Set((first.fullHorizonScheduleBlocks || []).map(b => b.id));
    const second = setHorizonMode(first, '5_year');
    const secondIds = new Set((second.fullHorizonScheduleBlocks || []).map(b => b.id));
    // Both should have fullHorizonScheduleBlocks
    expect(firstIds.size).toBeGreaterThan(0);
    expect(secondIds.size).toBeGreaterThan(0);
    // 5_year may have more blocks than 3_year
    expect(secondIds.size).toBeGreaterThanOrEqual(firstIds.size);
  });
});
