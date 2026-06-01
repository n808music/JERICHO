import { describe, expect, it } from 'vitest';
import { computeDerivedState, getAllBlocks } from '../../src/state/identityCompute.js';
import { buildDraftNarrationModel } from '../../src/state/draftNarration.ts';
import { buildDraftScheduleItems, getDraftBoundary, getDraftDiagnostics } from '../../src/state/draftSchedule.js';
import { computeSpineNarrationMetrics, normalizeBlocks } from '../../src/state/metrics.js';
import { DEFAULT_BOUNDARY_MODE, DRAFT_WINDOW_DAYS } from '../../src/state/plannerConfig.ts';
import {
  DAY_KEY,
  NOW_ISO,
  assertAutomationItemsHaveContext,
  buildAdvancementBaseState,
  commitFirstActionItem,
  completeBlockByAction,
} from '../helpers/advancementHarness.js';

function addCycleAction(state, action) {
  state.actionsByCycleId['cycle-1'].actions.push(action);
  state.cyclesById['cycle-1'].actions.push(action);
}

function routeSuggestionsFromState(state, cycleId) {
  const forecast = state?.cyclesById?.[cycleId]?.coldPlan?.forecastByDayKey || {};
  return Object.keys(forecast)
    .map((dayKey) => ({
      dayKey,
      totalBlocks: Number(forecast[dayKey]?.totalBlocks || 0),
      byDeliverable: forecast[dayKey]?.byDeliverable || {},
      summary: forecast[dayKey]?.summary || '',
    }))
    .filter((entry) => entry.totalBlocks > 0);
}

function buildNarrationSnapshot(state, cycleId, draftItems) {
  const cycleActions = state.actionsByCycleId?.[cycleId]?.actions || state.cyclesById?.[cycleId]?.actions || [];
  const boundary = getDraftBoundary(state, cycleId, {
    daysForward: DRAFT_WINDOW_DAYS,
    mode: DEFAULT_BOUNDARY_MODE,
  });
  const diagnostics = getDraftDiagnostics({
    state,
    cycleId,
    routeSuggestions: routeSuggestionsFromState(state, cycleId),
    actions: cycleActions,
    draftItems,
    boundaryKind: boundary?.kind || 'HORIZON',
    boundaryLabel: boundary?.label || `Next ${DRAFT_WINDOW_DAYS} days`,
    routeSlotWindowDays: DRAFT_WINDOW_DAYS,
    graphInvalid: state?.lastPlanError?.code === 'ACTION_GRAPH_INVALID',
    noActionPlan: cycleActions.length <= 0,
  });
  const metrics = computeSpineNarrationMetrics({
    actions: cycleActions,
    blocks: normalizeBlocks(getAllBlocks(computeDerivedState(state, { type: 'NO_OP' })) || []),
    draftItems,
    diagnostics,
    cycleId,
  });
  const narration = buildDraftNarrationModel({
    diagnostics,
    spineMetrics: metrics,
    hasActionPlan: cycleActions.length > 0,
    hasActionContextGap: false,
    cycleId,
  });
  return { boundary, diagnostics, metrics, narration };
}

describe('spine narration integration', () => {
  it('keeps boundary stable while completion refreshes draft and narration metrics', () => {
    const cycleId = 'cycle-1';
    const goalId = 'goal-1';
    const day2 = '2026-01-21';
    let state = buildAdvancementBaseState({ includeCycle2: false });

    state.appTime.nowISO = NOW_ISO;
    state.cyclesById[cycleId].coldPlan.forecastByDayKey = {
      [DAY_KEY]: { totalBlocks: 1, byDeliverable: {}, summary: '' },
      [day2]: { totalBlocks: 2, byDeliverable: {}, summary: '' },
    };

    addCycleAction(state, {
      id: `act:${cycleId}:A`,
      cycleId,
      goalId,
      title: 'Define season thesis',
      detail: 'Write the one-sentence argument and emotional promise for the season.',
      brief: 'Define thesis',
      category: 'Focus',
      deps: [],
      status: 'todo',
      topoIndex: 0,
      priority: 1,
    });
    addCycleAction(state, {
      id: `act:${cycleId}:B`,
      cycleId,
      goalId,
      title: 'Map season arc beats',
      detail: 'Lay out beginning, midpoint, and ending turns.',
      brief: 'Map arc beats',
      category: 'Creation',
      deps: [`act:${cycleId}:A`],
      status: 'todo',
      topoIndex: 1,
      priority: 2,
    });
    addCycleAction(state, {
      id: `act:${cycleId}:C`,
      cycleId,
      goalId,
      title: 'Outline pilot cold open',
      detail: 'Draft the opening scene beats.',
      brief: 'Pilot open',
      category: 'Creation',
      deps: [],
      status: 'todo',
      topoIndex: 2,
      priority: 3,
    });
    state.deliverablesByCycleId[cycleId] = {
      deliverables: [
        {
          id: 'deliv-season-spine',
          title: 'Season spine',
          dueDayKey: '2026-01-25',
          actionIds: [`act:${cycleId}:A`, `act:${cycleId}:B`, `act:${cycleId}:C`],
        },
      ],
    };

    state = computeDerivedState(state, { type: 'NO_OP' });

    const preCommitDraft = buildDraftScheduleItems(state, cycleId, {
      startDateISO: `${DAY_KEY}T00:00:00.000Z`,
      daysForward: DRAFT_WINDOW_DAYS,
      boundaryMode: DEFAULT_BOUNDARY_MODE,
    });
    assertAutomationItemsHaveContext(preCommitDraft);
    expect(new Set(preCommitDraft.map((item) => item.dayKey)).size).toBeGreaterThan(0);

    const firstActionId = `act:${cycleId}:A`;
    const secondActionId = `act:${cycleId}:C`;
    const firstCommitted = commitFirstActionItem(state, { cycleId, actionId: firstActionId });
    const secondCommitted = commitFirstActionItem(firstCommitted.state, { cycleId, actionId: secondActionId });
    const preCompletionState = secondCommitted.state;

    const preCompletionDraft = buildDraftScheduleItems(preCompletionState, cycleId, {
      startDateISO: `${DAY_KEY}T00:00:00.000Z`,
      daysForward: DRAFT_WINDOW_DAYS,
      boundaryMode: DEFAULT_BOUNDARY_MODE,
    });
    const before = buildNarrationSnapshot(preCompletionState, cycleId, preCompletionDraft);

    const completed = completeBlockByAction(preCompletionState, { cycleId, actionId: firstActionId });
    const postCompletionState = completed.state;
    const postCompletionDraft = buildDraftScheduleItems(postCompletionState, cycleId, {
      startDateISO: `${DAY_KEY}T00:00:00.000Z`,
      daysForward: DRAFT_WINDOW_DAYS,
      boundaryMode: DEFAULT_BOUNDARY_MODE,
    });
    const after = buildNarrationSnapshot(postCompletionState, cycleId, postCompletionDraft);

    const boundaryUnchangedOrAdvanced =
      after.boundary.label === before.boundary.label ||
      (before.boundary.kind === 'DELIVERABLE' &&
        (after.diagnostics.reasonCode === 'DELIVERABLE_COVERED' || after.boundary.kind === 'HORIZON'));
    expect(boundaryUnchangedOrAdvanced).toBe(true);
    expect(after.metrics.remainingActionsCount).not.toEqual(before.metrics.remainingActionsCount);
    expect(after.narration.summaryLine).not.toEqual(before.narration.summaryLine);
  });
});
