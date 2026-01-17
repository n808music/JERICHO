import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider } from '../../src/state/identityStore.js';

const TIME_ZONE = 'UTC';
const ANCHOR_DAY = '2026-02-10';

function buildReviewState() {
  return {
    vector: { day: 1, direction: 'Review goal', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] }
    },
    activeCycleId: 'cycle-review',
    cyclesById: {
      'cycle-review': {
        id: 'cycle-review',
        status: 'ended',
        startedAtDayKey: '2026-02-01',
        definiteGoal: { outcome: 'Review goal', deadlineDayKey: '2026-12-31' }
      }
    },
    goalExecutionContract: {
      goalId: 'goal-review',
      goalText: 'Review goal',
      startDayKey: '2026-02-01',
      endDayKey: '2026-12-31'
    },
    today: { date: ANCHOR_DAY, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: ANCHOR_DAY, days: [], metrics: {} },
    cycle: [],
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

describe('Zion views review mode gating', () => {
  it('renders views read-only in review mode', () => {
    const html = ReactDOMServer.renderToString(
      <IdentityProvider initialState={buildReviewState()}>
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={ANCHOR_DAY} />
      </IdentityProvider>
    );
    expect(html).toContain('Quarter');
    expect(html).toContain('disabled');
  });
});
