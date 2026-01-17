import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildRealEstateState(empty = false) {
  const todayDate = '2026-02-10';
  const blocks = empty
    ? []
    : [
        {
          id: 'blk1',
          practice: 'Creation',
          label: 'Source listings',
          start: `${todayDate}T09:00:00.000Z`,
          end: `${todayDate}T10:00:00.000Z`,
          status: 'planned'
        },
        {
          id: 'blk2',
          practice: 'Focus',
          label: 'Underwriting',
          start: `${todayDate}T11:00:00.000Z`,
          end: `${todayDate}T12:30:00.000Z`,
          status: 'planned'
        }
      ];

  const baseState = {
    vector: {
      day: 1,
      direction: 'Acquire a multi-unit property by 2026-12-31',
      stability: 'steady',
      drift: 'contained',
      momentum: 'active'
    },
    lenses: {
      aim: { description: 'Acquire a multi-unit property by 2026-12-31', horizon: '90d' },
      pattern: {
        routines: { Body: [], Resources: [], Creation: [], Focus: [] },
        dailyTargets: [
          { name: 'Body', minutes: 30 },
          { name: 'Resources', minutes: 60 },
          { name: 'Creation', minutes: 120 },
          { name: 'Focus', minutes: 90 }
        ],
        defaultMinutes: 30
      },
      flow: { streams: ['Sourcing', 'Underwriting', 'Lender calls'] },
      practice: { defaults: { Body: { targetMinutesPerDay: 30 }, Resources: { targetMinutesPerDay: 60 }, Creation: { targetMinutesPerDay: 120 }, Focus: { targetMinutesPerDay: 90 } } }
    },
    today: {
      date: todayDate,
      blocks,
      completionRate: 0,
      driftSignal: 'forming',
      loadByPractice: {},
      practices: []
    },
    currentWeek: { weekStart: todayDate, days: [] },
    cycle: [],
    viewDate: todayDate,
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: {
      version: '1.0.0',
      onboardingComplete: true,
      lastActiveDate: todayDate,
      scenarioLabel: 'Real estate acquisition',
      demoScenarioEnabled: false,
      showHints: false
    },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null
  };

  return computeDerivedState(baseState, { type: 'SET_VIEW_DATE', date: todayDate });
}

describe('Real estate scenario stability hardening', () => {
  it('keeps metrics finite with sparse data', () => {
    const state = buildRealEstateState(true);
    expect(Number.isFinite(state.vector.driftDetail ? Object.values(state.vector.driftDetail.byPractice || {})[0] || 0 : 0)).toBe(true);
    expect(Number.isFinite(state.currentWeek?.metrics?.completionRate)).toBe(true);
    expect(state.currentWeek.metrics.completionRate).toBeGreaterThanOrEqual(0);
    expect(state.currentWeek.metrics.completionRate).toBeLessThanOrEqual(1);
    expect(state.stability?.headline).toBeTruthy();
    expect(Array.isArray(state.cycle)).toBe(true);
    // full month generated
    expect(state.cycle.length).toBeGreaterThanOrEqual(28);
  });

  it('renders ZionDashboard Stability inline without crashing', () => {
    const state = buildRealEstateState(false);
    const html = ReactDOMServer.renderToString(
      <IdentityProvider initialState={state}>
        <ZionDashboard initialView="stability" assistantOpen={false} />
      </IdentityProvider>
    );
    expect(html.toLowerCase()).toContain('stability');
    expect(html.toLowerCase()).toContain('pattern');
    expect(html.toLowerCase()).toContain('probability of success');
    expect(html.toLowerCase()).toContain('stability score');
  });
});
