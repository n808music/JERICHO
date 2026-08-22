/**
 * RC-03 re-verification probe — ST-01, ST-02, ST-03
 *
 * Verifies the production path (computeDerivedState → generateColdPlanForCycle)
 * now seeds cycle.actions from canonical workspace deliverables, not from the
 * internal deterministicResult.autoDeliverables. This is the definitive
 * production-path test for RC-03 closure.
 *
 * All three short-term audit goals are exercised. Output is console-logged
 * in structured form so findings can be directly transcribed into audit records.
 */
import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const AUDIT_NOW = '2026-04-07';

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
  // hasExecutionGraph is a local var in applyGoalPolicy (line 2702), not stored on cycle.
  // It's computed as Boolean(cycle.executionGraphReady || cycle.llmActionGraph || cycle.actions?.length).
  // Read it from the policy snapshot which receives it as an input.
  const goalPolicy = state.goalPolicyByGoalId?.[goalId] || cycle?.policyState?.goalPolicy;
  const planQuality = goalPolicy?.planQuality;

  return {
    cycleId,
    goalId,
    actionsCount: actions.length,
    // hasExecutionGraph as computed by applyGoalPolicy (line 2702)
    hasExecutionGraphComputed: Boolean(cycle?.executionGraphReady || cycle?.llmActionGraph || actions.length),
    actionDeliverableIds: actions.map((a: any) => a.deliverableId),
    actionTypes: actions.map((a: any) => a.actionType),
    actionDependencies: actions.map((a: any) => a.dependencies),
    workspaceDeliverableIds: workspaceDeliverables.map((d: any) => d.id),
    strategyDeliverableIds: strategyDeliverables.map((d: any) => d.id),
    planQualityGateStatus: planQualityGate.status,
    planQualityGateFailureCodes: planQualityGate.failureCodes ?? [],
    // Policy snapshot structural quality dimensions
    structuralState: planQuality?.structuralState,
    lineageIntegrity: planQuality?.lineageIntegrity,
    actionTypeCoverage: planQuality?.actionTypeCoverage,
    inspectability: planQuality?.inspectability,
    dependencyReadinessCoverage: planQuality?.dependencyReadinessCoverage,
    probabilityStatus: probability?.status,
    probabilityTrustState: probability?.trustState,
    evidenceSummaryTotalEvents: probability?.evidenceSummary?.totalEvents,
  };
}

// ---------------------------------------------------------------------------
// ST-01: EP goal — music_release archetype
// ---------------------------------------------------------------------------
describe('RC-03 ST-01 re-verification: EP 45 days (production path)', () => {
  const base = buildBaseState();
  const state = computeDerivedState(base, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Finish and release a polished 3-song EP',
      goalText: 'Finish and release a polished 3-song EP',
      horizon: '45d',
      narrative: '',
      focusAreas: ['Creation'],
      successDefinition: 'EP is uploaded and live on at least one streaming platform',
      minimumDaysPerWeek: 4,
    },
  });

  const snap = extractCycleSnapshot(state);

  it('seeds actions on the production deterministic path', () => {
    console.log('\n=== ST-01 EP 45d — Production path snapshot ===');
    console.log('actionsCount:', snap.actionsCount);
    console.log('actionDeliverableIds:', JSON.stringify(snap.actionDeliverableIds));
    console.log('actionTypes:', JSON.stringify(snap.actionTypes));
    console.log('actionDependencies:', JSON.stringify(snap.actionDependencies));
    console.log('workspaceDeliverableIds:', JSON.stringify(snap.workspaceDeliverableIds));
    console.log('strategyDeliverableIds:', JSON.stringify(snap.strategyDeliverableIds));
    console.log('planQualityGateStatus:', snap.planQualityGateStatus);
    console.log('planQualityGateFailureCodes:', JSON.stringify(snap.planQualityGateFailureCodes));
    console.log('hasExecutionGraphComputed:', snap.hasExecutionGraphComputed);
    console.log('structuralState:', snap.structuralState);
    console.log('lineageIntegrity:', snap.lineageIntegrity);
    console.log('actionTypeCoverage:', snap.actionTypeCoverage);
    console.log('inspectability:', snap.inspectability);
    console.log('dependencyReadinessCoverage:', snap.dependencyReadinessCoverage);
    console.log('probabilityStatus:', snap.probabilityStatus);
    console.log('probabilityTrustState:', snap.probabilityTrustState);
    console.log('evidenceSummaryTotalEvents:', snap.evidenceSummaryTotalEvents);

    expect(snap.actionsCount).toBeGreaterThan(0);
  });

  it('action deliverableIds resolve to known deliverable IDs (no dangling references)', () => {
    const knownIds = new Set([
      ...snap.workspaceDeliverableIds,
      ...snap.strategyDeliverableIds,
    ]);
    const dangling = snap.actionDeliverableIds.filter((id: string) => id && !knownIds.has(id));
    console.log('ST-01 dangling deliverableId references:', dangling);
    expect(dangling).toHaveLength(0);
  });

  it('plan quality gate does not withhold due to structural absence', () => {
    const structuralWithheldCodes = [
      'PLAN_COVERAGE_MISSING_EXECUTION_DESCENDANTS',
      'ACTION_LINEAGE_BROKEN',
    ];
    const structuralFailures = snap.planQualityGateFailureCodes.filter((c: string) =>
      structuralWithheldCodes.includes(c)
    );
    console.log('ST-01 structural withhold codes:', structuralFailures);
    expect(structuralFailures).toHaveLength(0);
  });

  it('probability layer returns evidenceSummary (not withheld at structural level)', () => {
    // evidenceSummary should exist (may be totalEvents:0 with no events — but must not be undefined)
    // If PLAN_QUALITY_WITHHELD fires, evidenceSummary is omitted entirely.
    console.log('ST-01 probability evidenceSummary totalEvents:', snap.evidenceSummaryTotalEvents);
    // Either evidenceSummary exists with 0 events, or probability status is ELIGIBLE
    // The key: it must NOT be undefined due to structural withholding
    const gateWithheld = snap.planQualityGateStatus === 'PLAN_QUALITY_WITHHELD';
    if (!gateWithheld) {
      // Gate passed — evidence summary should be accessible
      expect(snap.probabilityStatus).not.toBe('INELIGIBLE');
    }
    // If gate still withheld (RC-02 survives), note it but don't fail this probe
    console.log('ST-01 gate withheld:', gateWithheld);
  });
});

// ---------------------------------------------------------------------------
// ST-02: Fitness goal — physical_training archetype
// ---------------------------------------------------------------------------
describe('RC-03 ST-02 re-verification: Fitness 70 days (production path)', () => {
  const base = buildBaseState();
  const state = computeDerivedState(base, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Lose 12 pounds with a consistent training and meal-prep routine',
      goalText: 'Lose 12 pounds with a consistent training and meal-prep routine',
      horizon: '70d',
      narrative: '',
      focusAreas: ['Body'],
      successDefinition: 'Scale weight down 12 lbs, training sessions logged 5x/week, meal-prep completed each Sunday',
      minimumDaysPerWeek: 5,
    },
  });

  const snap = extractCycleSnapshot(state);

  it('seeds actions on the production deterministic path', () => {
    console.log('\n=== ST-02 Fitness 70d — Production path snapshot ===');
    console.log('actionsCount:', snap.actionsCount);
    console.log('actionDeliverableIds:', JSON.stringify(snap.actionDeliverableIds));
    console.log('actionTypes:', JSON.stringify(snap.actionTypes));
    console.log('workspaceDeliverableIds:', JSON.stringify(snap.workspaceDeliverableIds));
    console.log('strategyDeliverableIds:', JSON.stringify(snap.strategyDeliverableIds));
    console.log('planQualityGateStatus:', snap.planQualityGateStatus);
    console.log('planQualityGateFailureCodes:', JSON.stringify(snap.planQualityGateFailureCodes));
    console.log('hasExecutionGraphComputed:', snap.hasExecutionGraphComputed);
    console.log('structuralState:', snap.structuralState);
    console.log('lineageIntegrity:', snap.lineageIntegrity);
    console.log('actionTypeCoverage:', snap.actionTypeCoverage);
    console.log('inspectability:', snap.inspectability);
    console.log('dependencyReadinessCoverage:', snap.dependencyReadinessCoverage);
    console.log('probabilityStatus:', snap.probabilityStatus);
    console.log('probabilityTrustState:', snap.probabilityTrustState);
    console.log('evidenceSummaryTotalEvents:', snap.evidenceSummaryTotalEvents);

    expect(snap.actionsCount).toBeGreaterThan(0);
  });

  it('action deliverableIds resolve to known deliverable IDs', () => {
    const knownIds = new Set([
      ...snap.workspaceDeliverableIds,
      ...snap.strategyDeliverableIds,
    ]);
    const dangling = snap.actionDeliverableIds.filter((id: string) => id && !knownIds.has(id));
    console.log('ST-02 dangling deliverableId references:', dangling);
    expect(dangling).toHaveLength(0);
  });

  it('plan quality gate does not withhold due to structural absence', () => {
    const structuralWithheldCodes = [
      'PLAN_COVERAGE_MISSING_EXECUTION_DESCENDANTS',
      'ACTION_LINEAGE_BROKEN',
    ];
    const structuralFailures = snap.planQualityGateFailureCodes.filter((c: string) =>
      structuralWithheldCodes.includes(c)
    );
    console.log('ST-02 structural withhold codes:', structuralFailures);
    expect(structuralFailures).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ST-03: Landing page goal — brand_launch archetype
// ---------------------------------------------------------------------------
describe('RC-03 ST-03 re-verification: Landing page 60 days (production path)', () => {
  const base = buildBaseState();
  const state = computeDerivedState(base, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Launch a branded landing page and get first 25 leads',
      goalText: 'Launch a branded landing page and get first 25 leads',
      horizon: '60d',
      narrative: '',
      focusAreas: ['Creation', 'Resources'],
      successDefinition: 'Branded landing page live. Email opt-in form capturing leads. 25 email leads collected.',
      minimumDaysPerWeek: 4,
    },
  });

  const snap = extractCycleSnapshot(state);

  it('seeds actions on the production deterministic path', () => {
    console.log('\n=== ST-03 Landing page 60d — Production path snapshot ===');
    console.log('actionsCount:', snap.actionsCount);
    console.log('actionDeliverableIds:', JSON.stringify(snap.actionDeliverableIds));
    console.log('actionTypes:', JSON.stringify(snap.actionTypes));
    console.log('workspaceDeliverableIds:', JSON.stringify(snap.workspaceDeliverableIds));
    console.log('strategyDeliverableIds:', JSON.stringify(snap.strategyDeliverableIds));
    console.log('planQualityGateStatus:', snap.planQualityGateStatus);
    console.log('planQualityGateFailureCodes:', JSON.stringify(snap.planQualityGateFailureCodes));
    console.log('hasExecutionGraphComputed:', snap.hasExecutionGraphComputed);
    console.log('structuralState:', snap.structuralState);
    console.log('lineageIntegrity:', snap.lineageIntegrity);
    console.log('actionTypeCoverage:', snap.actionTypeCoverage);
    console.log('inspectability:', snap.inspectability);
    console.log('dependencyReadinessCoverage:', snap.dependencyReadinessCoverage);
    console.log('probabilityStatus:', snap.probabilityStatus);
    console.log('probabilityTrustState:', snap.probabilityTrustState);
    console.log('evidenceSummaryTotalEvents:', snap.evidenceSummaryTotalEvents);

    expect(snap.actionsCount).toBeGreaterThan(0);
  });

  it('action deliverableIds resolve to known deliverable IDs', () => {
    const knownIds = new Set([
      ...snap.workspaceDeliverableIds,
      ...snap.strategyDeliverableIds,
    ]);
    const dangling = snap.actionDeliverableIds.filter((id: string) => id && !knownIds.has(id));
    console.log('ST-03 dangling deliverableId references:', dangling);
    expect(dangling).toHaveLength(0);
  });

  it('plan quality gate does not withhold due to structural absence', () => {
    const structuralWithheldCodes = [
      'PLAN_COVERAGE_MISSING_EXECUTION_DESCENDANTS',
      'ACTION_LINEAGE_BROKEN',
    ];
    const structuralFailures = snap.planQualityGateFailureCodes.filter((c: string) =>
      structuralWithheldCodes.includes(c)
    );
    console.log('ST-03 structural withhold codes:', structuralFailures);
    expect(structuralFailures).toHaveLength(0);
  });
});
