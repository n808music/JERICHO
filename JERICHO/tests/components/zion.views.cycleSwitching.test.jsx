import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider } from '../../src/state/identityStore.js';

const TIME_ZONE = 'UTC';
const ANCHOR_DAY = '2026-02-10';

function makeBlock(id, dayKey, label) {
  return {
    id,
    label,
    start: `${dayKey}T09:00:00.000Z`,
    end: `${dayKey}T10:00:00.000Z`,
    status: 'planned',
    practice: 'Creation'
  };
}

function buildState(activeCycleId, blockLabel) {
  const block = makeBlock(`blk-${activeCycleId}`, ANCHOR_DAY, blockLabel);
  return {
    vector: { day: 1, direction: 'Test goal', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] }
    },
    activeCycleId,
    cyclesById: {
      [activeCycleId]: {
        id: activeCycleId,
        status: 'active',
        startedAtDayKey: '2026-02-01',
        definiteGoal: { outcome: `${blockLabel} goal`, deadlineDayKey: '2026-12-31' }
      }
    },
    goalExecutionContract: {
      goalId: `goal-${activeCycleId}`,
      goalText: `${blockLabel} goal`,
      startDayKey: '2026-02-01',
      endDayKey: '2026-12-31'
    },
    today: { date: ANCHOR_DAY, blocks: [block], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: ANCHOR_DAY, days: [], metrics: {} },
    cycle: [{ date: ANCHOR_DAY, blocks: [block], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] }],
    templates: { objectives: {} },
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    goalDirective: null,
    directiveEligibilityByGoal: {},
    suggestionHistory: { dayKey: ANCHOR_DAY, count: 0, lastSuggestedAtISO: null, lastSuggestedAtISOByGoal: {}, dailyCountByGoal: {}, denials: [] },
    appTime: { timeZone: TIME_ZONE, nowISO: `${ANCHOR_DAY}T12:00:00.000Z`, activeDayKey: ANCHOR_DAY, isFollowingNow: true }
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
});
