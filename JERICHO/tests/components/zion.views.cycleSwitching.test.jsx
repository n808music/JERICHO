import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider } from '../../src/state/identityStore.js';

const TIME_ZONE = 'UTC';
const ANCHOR_DAY = '2026-02-10';

function makeBlock(id, dayKey, label, cycleId, goalId) {
  return {
    id,
    label,
    cycleId,
    goalId,
    start: `${dayKey}T09:00:00.000Z`,
    end: `${dayKey}T10:00:00.000Z`,
    status: 'planned',
    practice: 'Creation',
  };
}

function buildState(activeCycleId, blockLabel) {
  const goalId = `goal-${activeCycleId}`;
  const block = makeBlock(`blk-${activeCycleId}`, ANCHOR_DAY, blockLabel, activeCycleId, goalId);
  return {
    vector: { day: 1, direction: 'Test goal', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    activeCycleId,
    cyclesById: {
      [activeCycleId]: {
        id: activeCycleId,
        status: 'active',
        scheduleLifecycle: 'active_schedule',
        startedAtDayKey: '2026-02-01',
        definiteGoal: { outcome: `${blockLabel} goal`, deadlineDayKey: '2026-12-31' },
        goalContract: {
          goalId,
          goalText: `${blockLabel} goal`,
          startDayKey: '2026-02-01',
          endDayKey: '2026-12-31',
        },
      },
    },
    goalExecutionContract: {
      goalId,
      goalText: `${blockLabel} goal`,
      startDayKey: '2026-02-01',
      endDayKey: '2026-12-31',
    },
    today: {
      date: ANCHOR_DAY,
      blocks: [block],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: ANCHOR_DAY, days: [], metrics: {} },
    cycle: [
      {
        date: ANCHOR_DAY,
        blocks: [block],
        completionRate: 0,
        driftSignal: 'contained',
        loadByPractice: {},
        practices: [],
      },
    ],
    templates: { objectives: {} },
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    scheduleApplied: true,
    proposedBlocks: [],
    suggestedBlocks: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    constraints: {},
    goalDirective: null,
    directiveEligibilityByGoal: {},
    suggestionHistory: {
      dayKey: ANCHOR_DAY,
      count: 0,
      lastSuggestedAtISO: null,
      lastSuggestedAtISOByGoal: {},
      dailyCountByGoal: {},
      denials: [],
    },
    appTime: {
      timeZone: TIME_ZONE,
      nowISO: `${ANCHOR_DAY}T12:00:00.000Z`,
      activeDayKey: ANCHOR_DAY,
      isFollowingNow: true,
    },
  };
}

function buildMixedIdentityState() {
  const tvBlock = makeBlock('blk-tv', ANCHOR_DAY, 'TV Block', 'cycle-tv', 'goal-tv');
  const saasBlock = makeBlock('blk-saas', ANCHOR_DAY, 'SaaS Block', 'cycle-saas', 'goal-saas');
  return {
    ...buildState('cycle-tv', 'TV'),
    activeCycleId: 'cycle-tv',
    cyclesById: {
      'cycle-tv': {
        id: 'cycle-tv',
        status: 'active',
        scheduleLifecycle: 'active_schedule',
        startedAtDayKey: '2026-02-01',
        definiteGoal: { outcome: 'TV goal', deadlineDayKey: '2026-12-31' },
        goalContract: { goalId: 'goal-tv', goalText: 'TV goal', startDayKey: '2026-02-01', endDayKey: '2026-12-31' },
      },
      'cycle-saas': {
        id: 'cycle-saas',
        status: 'active',
        scheduleLifecycle: 'active_schedule',
        startedAtDayKey: '2026-01-01',
        definiteGoal: { outcome: 'SaaS goal', deadlineDayKey: '2026-12-31' },
        goalContract: {
          goalId: 'goal-saas',
          goalText: 'SaaS goal',
          startDayKey: '2026-01-01',
          endDayKey: '2026-12-31',
        },
      },
    },
    goalExecutionContract: {
      goalId: 'goal-saas',
      goalText: 'SaaS goal',
      startDayKey: '2026-01-01',
      endDayKey: '2026-12-31',
    },
    goalAdmissionByGoal: {
      'goal-tv': { status: 'ADMITTED', reasonCodes: [] },
      'goal-saas': { status: 'ADMITTED', reasonCodes: [] },
    },
    today: {
      date: ANCHOR_DAY,
      blocks: [tvBlock, saasBlock],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: ANCHOR_DAY, days: [], metrics: {} },
    cycle: [
      {
        date: ANCHOR_DAY,
        blocks: [tvBlock, saasBlock],
        completionRate: 0,
        driftSignal: 'contained',
        loadByPractice: {},
        practices: [],
      },
    ],
    scheduleApplied: true,
    proposedBlocks: [
      {
        id: 'p-tv',
        cycleId: 'cycle-tv',
        goalId: 'goal-tv',
        title: 'TV Block',
        label: 'TV Block',
        status: 'suggested',
        dayKey: ANCHOR_DAY,
        startISO: `${ANCHOR_DAY}T12:00:00.000Z`,
      },
      {
        id: 'p-saas',
        cycleId: 'cycle-saas',
        goalId: 'goal-saas',
        title: 'SaaS Block',
        label: 'SaaS Block',
        status: 'suggested',
        dayKey: ANCHOR_DAY,
        startISO: `${ANCHOR_DAY}T13:00:00.000Z`,
      },
    ],
    suggestedBlocks: [
      {
        id: 's-saas',
        cycleId: 'cycle-saas',
        goalId: 'goal-saas',
        status: 'suggested',
        dayKey: ANCHOR_DAY,
        startISO: `${ANCHOR_DAY}T14:00:00.000Z`,
      },
    ],
  };
}

describe('Zion view cycle switching', () => {
  it('renders cycle-scoped data for the active cycle', () => {
    const htmlA = ReactDOMServer.renderToString(
      <IdentityProvider initialState={buildState('cycle-a', 'Alpha')}>
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={ANCHOR_DAY} />
      </IdentityProvider>
    );
    const htmlB = ReactDOMServer.renderToString(
      <IdentityProvider initialState={buildState('cycle-b', 'Beta')}>
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={ANCHOR_DAY} />
      </IdentityProvider>
    );
    expect(htmlA).toContain('Alpha');
    expect(htmlA).not.toContain('Beta');
    expect(htmlB).toContain('Beta');
    expect(htmlB).not.toContain('Alpha');
  });

  it('locks month render to active cycle + canonical goal identity', () => {
    const html = ReactDOMServer.renderToString(
      <IdentityProvider initialState={buildMixedIdentityState()}>
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={ANCHOR_DAY} />
      </IdentityProvider>
    );
    expect(html).toContain('TV Block');
    expect(html).not.toContain('SaaS Block');
    expect(html).not.toContain('Route:');
  });
});
