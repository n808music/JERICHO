import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider } from '../../src/state/identityStore.js';

const baseState = {
  vector: { day: 1, direction: 'Test', stability: 'steady', drift: 'contained', momentum: 'active' },
  lenses: {
    aim: { description: 'Test', horizon: '90d' },
    pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
    flow: { streams: [] }
  },
  activeCycleId: 'cycle-1',
  cyclesById: {
    'cycle-1': {
      id: 'cycle-1',
      status: 'active',
      startedAtDayKey: '2026-02-01',
      definiteGoal: { outcome: 'Test', deadlineDayKey: '2026-12-31' },
      pattern: { dailyTargets: [] },
      goalGovernanceContract: {
        contractId: 'gov-1',
        version: 1,
        goalId: 'goal-1',
        activeFromISO: '2026-01-01',
        activeUntilISO: '2026-12-31',
        scope: {
          domainsAllowed: ['Body', 'Focus', 'Creation', 'Resources'],
          timeHorizon: 'week',
          timezone: 'America/Chicago'
        },
        governance: {
          suggestionsEnabled: true,
          probabilityEnabled: true,
          minEvidenceEvents: 0
        }
      }
    }
  },
  history: { cycles: [] },
  today: { date: '2026-02-01', blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
  currentWeek: { weekStart: '2026-02-01', days: [], metrics: {} },
  cycle: [],
  templates: { objectives: {} },
  stability: { headline: '', actionLine: '' },
  meta: { version: '1.0.0', onboardingComplete: false },
  recurringPatterns: [],
  lastSessionChange: null,
  nextSuggestion: null,
  executionEvents: [],
  suggestionHistory: {
    dayKey: '2026-02-01',
    count: 0,
    lastSuggestedAtISO: null,
    lastSuggestedAtISOByGoal: {},
    dailyCountByGoal: {},
    denials: []
  },
  suggestionEligibility: {},
  directiveEligibilityByGoal: {
    'goal-1': { allowed: false, reasons: ['inactive'], contractId: 'gov-1' }
  },
  goalDirective: {
    goalId: 'goal-1',
    type: 'schedule',
    domain: 'Focus',
    durationMinutes: 30,
    rationale: [],
    doneWhen: 'When a block of this domain and duration is completed today.'
  },
  probabilityStatusByGoal: {}
};

describe('ZionDashboard directive eligibility consumption', () => {
  it('renders the dashboard when directive is ineligible', () => {
    const html = ReactDOMServer.renderToString(
      <IdentityProvider initialState={baseState}>
        <ZionDashboard initialView="today" />
      </IdentityProvider>
    );
    expect(html).toContain('System Loop');
    expect(html).toContain('Today');
  });

  it('fails fast when directive eligibility is missing', () => {
    const badState = { ...baseState };
    delete badState.directiveEligibilityByGoal;
    expect(() => {
      ReactDOMServer.renderToString(
        <IdentityProvider initialState={badState}>
          <ZionDashboard initialView="today" />
        </IdentityProvider>
      );
    }).toThrow();
  });

  it('fails fast when goal directive is missing', () => {
    const badState = { ...baseState };
    delete badState.goalDirective;
    expect(() => {
      ReactDOMServer.renderToString(
        <IdentityProvider initialState={badState}>
          <ZionDashboard initialView="today" />
        </IdentityProvider>
      );
    }).toThrow();
  });
});
