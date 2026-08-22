/**
 * RC-03 re-verification probe — LT-01, LT-02, LT-03, LT-04
 *
 * Verifies that the production path (computeDerivedState → generateColdPlanForCycle)
 * seeds cycle.actions from canonical workspace deliverables for long-term goals.
 * Structural quality dimensions are captured for each goal to update audit records.
 */
import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const AUDIT_NOW = '2026-04-09';

function buildBaseState(nowDay: string = AUDIT_NOW) {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: {
      date: nowDay,
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: nowDay, days: [], metrics: {} },
    cycle: [],
    viewDate: nowDay,
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: {
      version: '1.0.0',
      onboardingComplete: false,
      lastActiveDate: nowDay,
      scenarioLabel: '',
      demoScenarioEnabled: false,
      showHints: false,
    },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: `${nowDay}T12:00:00.000Z`,
      activeDayKey: nowDay,
        timeIsPinned: true,
      isFollowingNow: true,
        timeIsPinned: true,
    },
  };
}

function extractCycleSnapshot(state: any) {
  const cycleId = state.activeCycleId;
  const cycle = state.cyclesById?.[cycleId];
  const goalId = cycle?.goalContract?.goalId || state.activeGoalId;
  const actions = cycle?.actions ?? [];
  const planQualityGate = cycle?.planQualityGate ?? {};
  const probability = state.probabilityByGoal?.[goalId];
  const workspace = state.deliverablesByCycleId?.[cycleId];
  const workspaceDeliverables = workspace?.deliverables ?? [];
  const strategyDeliverables = cycle?.strategy?.deliverables ?? [];
  const goalPolicy = state.goalPolicyByGoalId?.[goalId] || cycle?.policyState?.goalPolicy;
  const planQuality = goalPolicy?.planQuality;

  return {
    cycleId,
    goalId,
    actionsCount: actions.length,
    hasExecutionGraphComputed: Boolean(cycle?.executionGraphReady || cycle?.llmActionGraph || actions.length),
    actionDeliverableIds: actions.map((a: any) => a.deliverableId),
    actionTypes: actions.map((a: any) => a.actionType),
    actionDependencies: actions.map((a: any) => a.dependencies),
    workspaceDeliverableIds: workspaceDeliverables.map((d: any) => d.id),
    strategyDeliverableIds: strategyDeliverables.map((d: any) => d.id),
    planQualityGateStatus: planQualityGate.status,
    planQualityGateFailureCodes: planQualityGate.failureCodes ?? [],
    structuralState: planQuality?.structuralState,
    lineageIntegrity: planQuality?.lineageIntegrity,
    actionTypeCoverage: planQuality?.actionTypeCoverage,
    inspectability: planQuality?.inspectability,
    dependencyReadinessCoverage: planQuality?.dependencyReadinessCoverage,
    posTrustState: goalPolicy?.posTrust?.state,
    posTrustReasonCodes: goalPolicy?.posTrust?.reasonCodes ?? [],
    probabilityStatus: probability?.status,
    probabilityTrustState: probability?.trustState,
    evidenceSummaryTotalEvents: probability?.evidenceSummary?.totalEvents,
  };
}

function runStructuralAssertions(snap: ReturnType<typeof extractCycleSnapshot>, label: string) {
  const knownIds = new Set([...snap.workspaceDeliverableIds, ...snap.strategyDeliverableIds]);
  const dangling = snap.actionDeliverableIds.filter((id: string) => id && !knownIds.has(id));
  const structuralWithheldCodes = ['PLAN_COVERAGE_MISSING_EXECUTION_DESCENDANTS', 'ACTION_LINEAGE_BROKEN'];
  const structuralFailures = snap.planQualityGateFailureCodes.filter((c: string) =>
    structuralWithheldCodes.includes(c)
  );

  console.log(`\n=== ${label} — Production path snapshot ===`);
  console.log('actionsCount:', snap.actionsCount);
  console.log('actionDeliverableIds:', JSON.stringify(snap.actionDeliverableIds));
  console.log('actionTypes:', JSON.stringify(snap.actionTypes));
  console.log('workspaceDeliverableIds:', JSON.stringify(snap.workspaceDeliverableIds));
  console.log('strategyDeliverableIds:', JSON.stringify(snap.strategyDeliverableIds));
  console.log('dangling deliverableId references:', dangling);
  console.log('planQualityGateStatus:', snap.planQualityGateStatus);
  console.log('planQualityGateFailureCodes:', JSON.stringify(snap.planQualityGateFailureCodes));
  console.log('hasExecutionGraphComputed:', snap.hasExecutionGraphComputed);
  console.log('structuralState:', snap.structuralState);
  console.log('lineageIntegrity:', snap.lineageIntegrity);
  console.log('actionTypeCoverage:', snap.actionTypeCoverage);
  console.log('inspectability:', snap.inspectability);
  console.log('dependencyReadinessCoverage:', snap.dependencyReadinessCoverage);
  console.log('posTrustState:', snap.posTrustState);
  console.log('posTrustReasonCodes:', JSON.stringify(snap.posTrustReasonCodes));
  console.log('probabilityStatus:', snap.probabilityStatus);
  console.log('probabilityTrustState:', snap.probabilityTrustState);
  console.log('evidenceSummaryTotalEvents:', snap.evidenceSummaryTotalEvents);

  return { dangling, structuralFailures };
}

// ---------------------------------------------------------------------------
// LT-01: Podcast 12 months
// ---------------------------------------------------------------------------
describe('RC-03 LT-01 re-verification: Podcast 12 months (production path)', () => {
  const base = buildBaseState();
  const state = computeDerivedState(base, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Publish 24 episodes of my entrepreneurship podcast and grow to 1,000 monthly listeners',
      goalText: 'Publish 24 episodes of my entrepreneurship podcast and grow to 1,000 monthly listeners',
      horizon: '12m',
      narrative: '',
      focusAreas: ['Creation'],
      successDefinition: '24 episodes published to podcast directories. 1,000 monthly listeners reached by month 12.',
      minimumDaysPerWeek: 3,
    },
  });

  const snap = extractCycleSnapshot(state);

  it('seeds actions on production deterministic path', () => {
    const { dangling, structuralFailures } = runStructuralAssertions(snap, 'LT-01 Podcast 12m');
    expect(snap.actionsCount).toBeGreaterThan(0);
    expect(dangling).toHaveLength(0);
    expect(structuralFailures).toHaveLength(0);
  });

  it('hasExecutionGraph is true', () => {
    expect(snap.hasExecutionGraphComputed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LT-02: Full-stack dev 18 months
// ---------------------------------------------------------------------------
describe('RC-03 LT-02 re-verification: Full-stack dev 18 months (production path)', () => {
  const base = buildBaseState();
  const state = computeDerivedState(base, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Learn full-stack web development, build a portfolio of 3 projects, and land a junior software engineer role within 18 months',
      goalText: 'Learn full-stack web development, build a portfolio of 3 projects, and land a junior software engineer role within 18 months',
      horizon: '18m',
      narrative: '',
      focusAreas: ['Focus', 'Resources'],
      successDefinition: '3 portfolio projects deployed and live on GitHub. Junior software engineer offer letter received.',
      minimumDaysPerWeek: 4,
    },
  });

  const snap = extractCycleSnapshot(state);

  it('seeds actions on production deterministic path', () => {
    const { dangling, structuralFailures } = runStructuralAssertions(snap, 'LT-02 Fullstack 18m');
    expect(snap.actionsCount).toBeGreaterThan(0);
    expect(dangling).toHaveLength(0);
    expect(structuralFailures).toHaveLength(0);
  });

  it('hasExecutionGraph is true', () => {
    expect(snap.hasExecutionGraphComputed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LT-03: Job search 6 months
// ---------------------------------------------------------------------------
describe('RC-03 LT-03 re-verification: Job search 6 months (production path)', () => {
  const base = buildBaseState();
  const state = computeDerivedState(base, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Get a full-time junior full-stack developer job within 6 months',
      goalText: 'Get a full-time junior full-stack developer job within 6 months so I have a completed resume, polished portfolio, active application pipeline, interview-ready materials, and ongoing employer conversations.',
      horizon: '6m',
      narrative: '',
      focusAreas: ['Resources', 'Focus'],
      successDefinition: 'Offer letter received and start date confirmed at a full-time junior full-stack developer role.',
      minimumDaysPerWeek: 4,
    },
  });

  const snap = extractCycleSnapshot(state);

  it('seeds actions on production deterministic path', () => {
    const { dangling, structuralFailures } = runStructuralAssertions(snap, 'LT-03 Job search 6m');
    expect(snap.actionsCount).toBeGreaterThan(0);
    expect(dangling).toHaveLength(0);
    expect(structuralFailures).toHaveLength(0);
  });

  it('hasExecutionGraph is true', () => {
    expect(snap.hasExecutionGraphComputed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LT-04: Fundraising 9 months
// ---------------------------------------------------------------------------
describe('RC-03 LT-04 re-verification: Fundraising 9 months (production path)', () => {
  const base = buildBaseState();
  const state = computeDerivedState(base, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Raise $50,000 in funding for my startup within 9 months',
      goalText: 'Raise $50,000 in funding for my startup within 9 months so I have an investor deck, financial model, outreach pipeline, live investor conversations, and a signed investment commitment.',
      horizon: '9m',
      narrative: '',
      focusAreas: ['Resources'],
      successDefinition: 'Signed investment commitment for $50,000 or more received.',
      minimumDaysPerWeek: 4,
    },
  });

  const snap = extractCycleSnapshot(state);

  it('seeds actions on production deterministic path', () => {
    const { dangling, structuralFailures } = runStructuralAssertions(snap, 'LT-04 Fundraising 9m');
    expect(snap.actionsCount).toBeGreaterThan(0);
    expect(dangling).toHaveLength(0);
    expect(structuralFailures).toHaveLength(0);
  });

  it('hasExecutionGraph is true', () => {
    expect(snap.hasExecutionGraphComputed).toBe(true);
  });
});
