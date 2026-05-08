import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { identityReducer } from '../../src/state/identityStore.js';
import { buildDraftScheduleItems, isAutomationScheduleItem } from '../../src/state/draftSchedule.js';
import { selectVisibleDraftItems, getContractDeadlineDayKey } from '../../src/state/suggestionFilters.js';
import { materializeBlocksFromEvents } from '../../src/state/engine/todayAuthority.ts';
import { useDirective } from '../../src/services/directiveAdapter.js';

export const DAY_KEY = '2026-01-20';
export const NOW_ISO = '2026-01-20T08:00:00.000Z';

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeCycle({ id, goalId, goalText, deadlineDayKey }) {
  return {
    id,
    status: 'active',
    startedAtDayKey: DAY_KEY,
    goalContract: {
      goalId,
      goalLabel: goalText,
      goalText,
      terminalOutcome: { text: goalText },
      startDate: DAY_KEY,
      deadline: { dayKey: deadlineDayKey || '2026-05-20' },
    },
    coldPlan: {
      forecastByDayKey: {
        [DAY_KEY]: { totalBlocks: 3, byDeliverable: {}, summary: '' },
      },
      dailyProjection: { forecastByDayKey: {} },
    },
    actions: [],
    summary: { completionCount: 0, completionRate: 0 },
  };
}

function makeAction(id, cycleId, goalId, title, detail, deps, topoIndex, priority) {
  return {
    id,
    cycleId,
    goalId,
    title,
    brief: detail,
    detail,
    definitionOfDone: 'Done',
    estimateMin: 30,
    category: 'Focus',
    deps,
    status: 'todo',
    topoIndex,
    priority,
  };
}

export function buildAdvancementBaseState({ includeCycle2 = false } = {}) {
  const cycle1 = makeCycle({
    id: 'cycle-1',
    goalId: 'goal-1',
    goalText: 'ship deterministic planner validation',
    deadlineDayKey: '2026-05-20',
  });
  const cycle2 = includeCycle2
    ? makeCycle({
        id: 'cycle-2',
        goalId: 'goal-2',
        goalText: 'launch jericho marketing page',
        deadlineDayKey: '2026-03-01',
      })
    : null;

  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [] }, flow: { streams: [] } },
    today: { date: DAY_KEY, blocks: [], completionRate: 0, loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: DAY_KEY, days: [], metrics: {} },
    cycle: [],
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    ledger: [],
    executionEvents: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    constraints: {},
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    profileLearning: {},
    appTime: { timeZone: 'UTC', nowISO: NOW_ISO, activeDayKey: DAY_KEY, isFollowingNow: true },
    activeCycleId: 'cycle-1',
    actionsByCycleId: {
      'cycle-1': { cycleId: 'cycle-1', goalId: 'goal-1', actions: [] },
      ...(includeCycle2 ? { 'cycle-2': { cycleId: 'cycle-2', goalId: 'goal-2', actions: [] } } : {}),
    },
    cyclesById: {
      'cycle-1': cycle1,
      ...(includeCycle2 ? { 'cycle-2': cycle2 } : {}),
    },
    goalExecutionContract: null,
    goalDirective: { goalId: 'goal-1', directiveId: 'dir-1' },
    directiveEligibilityByGoal: { 'goal-1': { eligible: true } },
    planDraft: { blocksPerWeek: 4, daysPerWeek: 4, primaryDomain: 'CREATION', minutesPerDay: 90 },
    planCalibration: null,
    correctionSignals: null,
  };
}

export function seedActionsAThenB(state, { cycleId, goalId }) {
  const next = deepClone(state);
  const aId = `act:${cycleId}:A`;
  const bId = `act:${cycleId}:B`;
  const actions = [
    makeAction(
      aId,
      cycleId,
      goalId,
      'Define season thesis',
      'Write the one-sentence argument and emotional promise for the full season.',
      [],
      0,
      1
    ),
    makeAction(
      bId,
      cycleId,
      goalId,
      'Map season arc beats',
      'Lay out beginning, midpoint, and ending turns for the season arc.',
      [aId],
      1,
      2
    ),
  ];

  next.actionsByCycleId[cycleId] = { cycleId, goalId, actions };
  next.cyclesById[cycleId].actions = actions;
  return { state: computeDerivedState(next, { type: 'NO_OP' }), aId, bId, actions };
}

function routeSuggestionsFromCycle(cycle) {
  const forecast = cycle?.coldPlan?.forecastByDayKey || {};
  return Object.keys(forecast)
    .map((dayKey) => ({
      dayKey,
      totalBlocks: Number(forecast[dayKey]?.totalBlocks || 0),
      byDeliverable: forecast[dayKey]?.byDeliverable || {},
      summary: forecast[dayKey]?.summary || '',
    }))
    .filter((entry) => entry.totalBlocks > 0);
}

export function buildCycleDraftItems(state, { cycleId }) {
  const cycle = state.cyclesById?.[cycleId];
  if (!cycle) return [];
  const actions = state.actionsByCycleId?.[cycleId]?.actions || cycle.actions || [];
  const routeSuggestions = routeSuggestionsFromCycle(cycle);
  const raw = buildDraftScheduleItems(state, cycleId, {
    suggestedBlocks: [],
    routeSuggestions,
    deliverables: [],
    actions,
    contract: cycle.goalContract || null,
    timeZone: state.appTime?.timeZone || 'UTC',
    boundaryMode: 'GOAL_ONLY',
    defaults: {
      todayKey: state.appTime?.activeDayKey || DAY_KEY,
      primaryDomain: cycle.goalContract?.primaryDomain || 'FOCUS',
      routeMinutes: state.planDraft?.routeMinutes || 30,
    },
  });
  return selectVisibleDraftItems({
    cycle,
    draftItems: raw,
    timeZone: state.appTime?.timeZone || 'UTC',
    deadlineDayKey: getContractDeadlineDayKey(cycle.goalContract || null),
  });
}

export function commitFirstActionItem(state, { cycleId, actionId }) {
  const items = buildCycleDraftItems(state, { cycleId });
  const orderedItems = [...items].sort((a, b) => {
    if ((a?.dayKey || '') !== (b?.dayKey || '')) return (a?.dayKey || '').localeCompare(b?.dayKey || '');
    if ((a?.startISO || '') !== (b?.startISO || '')) return (a?.startISO || '').localeCompare(b?.startISO || '');
    if ((a?.actionId || '') !== (b?.actionId || '')) return (a?.actionId || '').localeCompare(b?.actionId || '');
    return (a?.id || '').localeCompare(b?.id || '');
  });
  const row = items.find((item) => item?.actionId === actionId) || orderedItems.find((item) => Boolean(item?.actionId));
  if (!row) {
    throw new Error(`Expected at least one draft item bound to action ${actionId}.`);
  }
  const committedActionId = row.actionId || actionId;
  const next = computeDerivedState(state, {
    type: 'COMMIT_PREVIEW_ITEMS',
    payload: { cycleId, items: [row] },
  });
  const materialized = materializeBlocksFromEvents(next.executionEvents || [], {
    todayISO: next.today?.date || DAY_KEY,
  });
  const allBlocks = [
    ...(materialized.todayBlocks || []),
    ...(materialized.days || []).flatMap((day) => day?.blocks || []),
  ];
  const committed = allBlocks.find((block) => block?.actionId === committedActionId);
  if (!committed) {
    throw new Error(`Expected committed block linked to action ${committedActionId}.`);
  }
  return { state: next, blockId: committed.id, committedItem: row };
}

export function completeBlockByAction(state, { cycleId, actionId }) {
  const materialized = materializeBlocksFromEvents(state.executionEvents || [], {
    todayISO: state.today?.date || DAY_KEY,
  });
  const block = (materialized.todayBlocks || []).find(
    (entry) => entry?.actionId === actionId && entry?.cycleId === cycleId
  );
  if (!block?.id) {
    throw new Error(`Expected block for action ${actionId} in cycle ${cycleId}.`);
  }
  const completed = identityReducer(state, { type: 'COMPLETE_BLOCK', id: block.id });
  const stabilized = computeDerivedState(completed, { type: 'NO_OP' });
  return { state: stabilized, blockId: block.id };
}

function Probe({ state, onDirective }) {
  const { directive } = useDirective(state);
  React.useEffect(() => {
    if (!directive) return;
    onDirective(directive);
  }, [directive, onDirective]);
  return React.createElement('div', { 'data-testid': 'directive-type' }, directive?.directive_type || 'none');
}

export async function getDirectiveFromState(state) {
  let captured = null;
  render(React.createElement(Probe, { state, onDirective: (value) => (captured = value) }));
  try {
    await waitFor(() => {
      if (!captured) throw new Error('Directive not ready');
    });
    return captured;
  } finally {
    cleanup();
  }
}

export async function getDirectiveForCycle(state, cycleId) {
  const scoped = deepClone(state);
  scoped.activeCycleId = cycleId;
  return getDirectiveFromState(scoped);
}

export async function runAdvancementSpine({ includeCycle2 = false } = {}) {
  let state = buildAdvancementBaseState({ includeCycle2 });
  const cycle1Seed = seedActionsAThenB(state, { cycleId: 'cycle-1', goalId: 'goal-1' });
  state = cycle1Seed.state;

  let cycle2Seed = null;
  if (includeCycle2) {
    cycle2Seed = seedActionsAThenB(state, { cycleId: 'cycle-2', goalId: 'goal-2' });
    state = cycle2Seed.state;
  }

  const postSeedState = state;
  const committed = commitFirstActionItem(state, { cycleId: 'cycle-1', actionId: cycle1Seed.aId });
  const postCommitState = committed.state;
  const completed = completeBlockByAction(postCommitState, { cycleId: 'cycle-1', actionId: cycle1Seed.aId });
  const postCompletionState = completed.state;

  return {
    aId: cycle1Seed.aId,
    bId: cycle1Seed.bId,
    cycle2Ids: cycle2Seed ? { aId: cycle2Seed.aId, bId: cycle2Seed.bId } : null,
    scheduledABlockId: committed.blockId,
    postSeedState,
    postCommitState,
    postCompletionState,
  };
}

export function assertAutomationItemsHaveContext(items = []) {
  const invalid = (items || []).find(
    (item) => isAutomationScheduleItem(item) && (!item?.actionId || !item?.title || !item?.detail)
  );
  if (invalid) {
    throw new Error(`Automation item missing context: ${invalid.id || invalid.source || 'unknown'}`);
  }
}

export function hasScheduledOrActiveActionBlock(state, { cycleId, actionId }) {
  const materialized = materializeBlocksFromEvents(state.executionEvents || [], {
    todayISO: state.today?.date || DAY_KEY,
  });
  const blocks = [
    ...(materialized.todayBlocks || []),
    ...(materialized.days || []).flatMap((day) => day?.blocks || []),
  ];
  return blocks.some((block) => {
    if (!block || block.cycleId !== cycleId || block.actionId !== actionId) return false;
    const status = (block.state || block.status || '').toString().toLowerCase();
    return ['scheduled', 'planned', 'active', 'in_progress', 'in-progress', 'started'].includes(status);
  });
}
