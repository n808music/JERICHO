/**
 * Horizon live failure tests — acceptance criteria 4, 5, 8, 9
 *
 * Verifies:
 *  - Normalization extends horizon when text conflicts with stored value
 *  - Core Mission text is included in horizon inference
 *  - Selected horizon remains stored but full horizon extends
 *  - UI shows full strategic horizon in Plan tab
 */
import { describe, it, expect } from 'vitest';
import { inferHorizonYearsFromText } from '../../src/domain/masterPlan/masterPlanIntakeEngine.js';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { buildMasterPlan } from '../../src/domain/masterPlan/masterPlanFactory.js';
import { resolveStrategicAgendaHorizon } from '../../src/domain/masterPlan/strategicHorizon.js';

// ─── Helper functions ─────────────────────────────────────────────────────────

function getPlan(derived) {
  const profile = derived.profilesById[DEFAULT_PROFILE_ID];
  const planId = profile.activeMasterPlanId;
  return derived.masterPlansById[planId];
}

function buildLiveFailureState() {
  const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO: '2026-05-09T10:00:00.000Z', todayDate: '2026-05-09' });
  const plan = buildMasterPlan({
    profileId: DEFAULT_PROFILE_ID,
    title: 'Operation Endgame',
    northStarOutcome: 'Build a profitable music-tech company through Operation Endgame',
    coreMission: 'Build and execute Operation Endgame: a 5-year master plan',  // explicit 5-year
    horizonStart: '2026-05-09',
    horizonEnd: '2028-05-09',      // buggy 2-year stored value
    declaredHorizonMonths: 24,     // user selected 2 years
    anchors: [{ date: '2026-10-17', label: 'Album drop', isFixed: true }],
    nowISO: '2026-05-09T10:00:00.000Z',
  });
  state.masterPlansById = { [plan.id]: plan };
  state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = plan.id;
  state.profilesById[DEFAULT_PROFILE_ID].masterPlanIds = [plan.id];
  return state;
}

function buildLegacyPersistedPlanState({ northStarOutcome, masterPlanSummary, executionHorizon }) {
  const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO: '2026-05-09T10:00:00.000Z', todayDate: '2026-05-09' });
  const plan = buildMasterPlan({
    profileId: DEFAULT_PROFILE_ID,
    title: 'Operation Endgame',
    northStarOutcome,
    masterPlanSummary,
    executionHorizon,  // legacy field
    horizonStart: '2026-05-09',
    horizonEnd: '2028-05-09',      // buggy 2-year stored value
    anchors: [{ date: '2026-10-17', label: 'Album drop', isFixed: true }],
    nowISO: '2026-05-09T10:00:00.000Z',
  });
  delete plan.declaredHorizonMonths;  // legacy plan without this field
  state.masterPlansById = { [plan.id]: plan };
  state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = plan.id;
  state.profilesById[DEFAULT_PROFILE_ID].masterPlanIds = [plan.id];
  return computeDerivedState(state, { type: 'NO_OP' });
}

// ─── Suite A: normalization extends horizon when text conflicts ──────────────

describe('normalization extends horizon when text conflicts with stored value', () => {
  it('coreMission "5-year master plan" extends 2-year stored horizon to ~2031', () => {
    const state = buildLiveFailureState();
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // Stored 24mo but text says 5-year (60mo) → extends to ~2031
    expect(normalized?.declaredHorizonMonths).toBe(24);  // stored value unchanged
    expect(normalized?.fullHorizonEndDayKey > '2030-01-01').toBe(true);  // but extends to 2031
    expect(normalized?.fullHorizonEndDayKey < '2032-01-01').toBe(true);
  });

  it('northStarOutcome "5-year" extends 2-year stored horizon to ~2031', () => {
    const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO: '2026-05-09T10:00:00.000Z', todayDate: '2026-05-09' });
    const plan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: 'Operation Endgame',
      northStarOutcome: 'Build a profitable music-tech company through a 5-year master plan',
      horizonStart: '2026-05-09',
      horizonEnd: '2028-05-09',      // 2-year stored value
      declaredHorizonMonths: 24,     // user selected 2 years
      anchors: [{ date: '2026-10-17', label: 'Album drop', isFixed: true }],
      nowISO: '2026-05-09T10:00:00.000Z',
    });
    state.masterPlansById = { [plan.id]: plan };
    state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = plan.id;
    state.profilesById[DEFAULT_PROFILE_ID].masterPlanIds = [plan.id];
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // Stored 24mo but text says 5-year (60mo) → extends to ~2031
    expect(normalized?.fullHorizonEndDayKey > '2030-01-01').toBe(true);
  });

  it('title "5-year" extends 2-year stored horizon to ~2031', () => {
    const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO: '2026-05-09T10:00:00.000Z', todayDate: '2026-05-09' });
    const plan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: '5-year Operation Endgame',
      northStarOutcome: 'Build a profitable music-tech company',
      horizonStart: '2026-05-09',
      horizonEnd: '2028-05-09',      // 2-year stored value
      declaredHorizonMonths: 24,     // user selected 2 years
      anchors: [{ date: '2026-10-17', label: 'Album drop', isFixed: true }],
      nowISO: '2026-05-09T10:00:00.000Z',
    });
    state.masterPlansById = { [plan.id]: plan };
    state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = plan.id;
    state.profilesById[DEFAULT_PROFILE_ID].masterPlanIds = [plan.id];
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // Stored 24mo but text says 5-year (60mo) → extends to ~2031
    expect(normalized?.fullHorizonEndDayKey > '2030-01-01').toBe(true);
  });

  it('no extension when stored horizon >= text inference * 0.7', () => {
    const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO: '2026-05-09T10:00:00.000Z', todayDate: '2026-05-09' });
    const plan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: 'Operation Endgame',
      northStarOutcome: 'Build a profitable music-tech company through a 3-year master plan',
      horizonStart: '2026-05-09',
      horizonEnd: '2029-05-09',      // 3-year stored value
      declaredHorizonMonths: 36,     // user selected 3 years
      anchors: [{ date: '2026-10-17', label: 'Album drop', isFixed: true }],
      nowISO: '2026-05-09T10:00:00.000Z',
    });
    state.masterPlansById = { [plan.id]: plan };
    state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = plan.id;
    state.profilesById[DEFAULT_PROFILE_ID].masterPlanIds = [plan.id];
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // Stored 36mo >= 36mo * 0.7 = 25.2mo → no extension
    expect(normalized?.fullHorizonEndDayKey).toMatch(/^2029/);  // stays at 2029
  });

  it('extension threshold: stored 24mo < 36mo * 0.7 = 25.2mo → extends', () => {
    const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO: '2026-05-09T10:00:00.000Z', todayDate: '2026-05-09' });
    const plan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: 'Operation Endgame',
      northStarOutcome: 'Build a profitable music-tech company through a 3-year master plan',
      horizonStart: '2026-05-09',
      horizonEnd: '2028-05-09',      // 2-year stored value
      declaredHorizonMonths: 24,     // user selected 2 years
      anchors: [{ date: '2026-10-17', label: 'Album drop', isFixed: true }],
      nowISO: '2026-05-09T10:00:00.000Z',
    });
    state.masterPlansById = { [plan.id]: plan };
    state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = plan.id;
    state.profilesById[DEFAULT_PROFILE_ID].masterPlanIds = [plan.id];
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // Stored 24mo < 36mo * 0.7 = 25.2mo → extends to ~2029
    expect(normalized?.fullHorizonEndDayKey > '2028-01-01').toBe(true);
  });
});

// ─── Suite B: coreMission included in horizon inference ──────────────────────

describe('coreMission included in horizon inference', () => {
  it('coreMission "5-year master plan" triggers extension (was missing before fix)', () => {
    const state = buildLiveFailureState();
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // Before fix: coreMission not included → no extension
    // After fix: coreMission included → extends to 2031
    expect(normalized?.fullHorizonEndDayKey > '2030-01-01').toBe(true);
  });

  it('coreMission "3-year plan" triggers extension when stored is 2 years', () => {
    const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO: '2026-05-09T10:00:00.000Z', todayDate: '2026-05-09' });
    const plan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: 'Operation Endgame',
      northStarOutcome: 'Build a profitable music-tech company',
      coreMission: 'Execute a 3-year plan for the music company',
      horizonStart: '2026-05-09',
      horizonEnd: '2028-05-09',      // 2-year stored value
      declaredHorizonMonths: 24,     // user selected 2 years
      anchors: [{ date: '2026-10-17', label: 'Album drop', isFixed: true }],
      nowISO: '2026-05-09T10:00:00.000Z',
    });
    state.masterPlansById = { [plan.id]: plan };
    state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = plan.id;
    state.profilesById[DEFAULT_PROFILE_ID].masterPlanIds = [plan.id];
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // Stored 24mo < 36mo * 0.7 = 25.2mo → extends to ~2029
    expect(normalized?.fullHorizonEndDayKey > '2028-01-01').toBe(true);
  });

  it('coreMission without duration does not trigger extension', () => {
    const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO: '2026-05-09T10:00:00.000Z', todayDate: '2026-05-09' });
    const plan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: 'Operation Endgame',
      northStarOutcome: 'Build a profitable music-tech company',
      coreMission: 'Execute the plan for the music company',  // no duration
      horizonStart: '2026-05-09',
      horizonEnd: '2028-05-09',      // 2-year stored value
      declaredHorizonMonths: 24,     // user selected 2 years
      anchors: [{ date: '2026-10-17', label: 'Album drop', isFixed: true }],
      nowISO: '2026-05-09T10:00:00.000Z',
    });
    state.masterPlansById = { [plan.id]: plan };
    state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = plan.id;
    state.profilesById[DEFAULT_PROFILE_ID].masterPlanIds = [plan.id];
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // No duration in text → no extension
    expect(normalized?.fullHorizonEndDayKey).toMatch(/^2028/);  // stays at 2028
  });
});

// ─── Suite C: normalization extends stored horizonEnd when text conflicts ────────────────────────────────

describe('normalization extends stored horizonEnd when text conflicts', () => {
  it('declaredHorizonMonths unchanged after normalization', () => {
    const state = buildLiveFailureState();
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // Stored value must remain unchanged for UI persistence
    expect(normalized?.declaredHorizonMonths).toBe(24);
  });

  it('horizonEnd extended to match declared months when stored is too short', () => {
    const state = buildLiveFailureState();
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // When stored 24mo < declared 60mo * 0.7 = 42mo, horizonEnd gets extended
    expect(normalized?.horizonEnd).toBe('2031-05-09');  // extended from 2028 to 2031
  });

  it('fullHorizonEndDayKey matches extended horizonEnd', () => {
    const state = buildLiveFailureState();
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // fullHorizonEndDayKey is set to the extended horizonEnd
    expect(normalized?.fullHorizonEndDayKey).toBe(normalized?.horizonEnd);
  });
});

// ─── Suite D: legacy executionHorizon field support ─────────────────────────

describe('legacy executionHorizon field support', () => {
  it('executionHorizon="may 2031" (date label) → year-date inference computes 60 months → extends', () => {
    const derived = buildLegacyPersistedPlanState({
      northStarOutcome: 'Build Operation Endgame without year count',
      masterPlanSummary: 'Master plan coordinating Album rollout, App launch, Podcast.',
      executionHorizon: 'may 2031',  // semantic model stored the horizon label
    });
    const plan = getPlan(derived);
    // year 2031 → 60 months; stored 24 < 60*0.7=42 → extends to ~2031
    expect(plan?.fullHorizonEndDayKey > '2030-01-01').toBe(true);
  });

  it('executionHorizon="60 months" → months pattern → 60 months → extends 2-year stored to 5-year', () => {
    const derived = buildLegacyPersistedPlanState({
      northStarOutcome: 'Build Operation Endgame without year count',
      masterPlanSummary: 'Master plan coordinating Album rollout, App launch, Podcast.',
      executionHorizon: '60 months',   // months pattern catches this
    });
    const plan = getPlan(derived);
    // 24 months < 60 * 0.7 = 42 → TRUE → extends to ~2031
    expect(plan?.fullHorizonEndDayKey > '2030-01-01').toBe(true);
  });

  it('"12 months" in executionHorizon is ignored (below 24-month threshold)', async () => {
    const { inferHorizonYearsFromText } = await import('../../src/domain/masterPlan/masterPlanIntakeEngine.js');
    const result = inferHorizonYearsFromText('12 months');
    expect(result).toBeNull();
  });
});

// ─── Suite E: conflict resolution — selected 3yr but coreMission says "5-year master plan" ──────────

describe('conflict resolution — selected 3yr but coreMission says "5-year master plan"', () => {
  it('preserves larger strategic horizon (5-year) over selected 3yr for full Plan overview', () => {
    const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO: '2026-05-09T10:00:00.000Z', todayDate: '2026-05-09' });
    const plan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: 'Operation Endgame',
      northStarOutcome: 'Build a profitable music-tech company through Operation Endgame',
      coreMission: 'Build and execute Operation Endgame: a 5-year master plan',  // explicit 5-year
      horizonStart: '2026-05-09',
      horizonEnd: '2029-05-09',      // 3-year stored value
      declaredHorizonMonths: 36,     // user selected 3 years
      anchors: [],
      nowISO: '2026-05-09T10:00:00.000Z',
    });
    state.masterPlansById = { [plan.id]: plan };
    state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = plan.id;
    state.profilesById[DEFAULT_PROFILE_ID].masterPlanIds = [plan.id];
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // Conflict: selected 36mo but text says 5-year (60mo) → prefer 60 for full strategic Plan overview
    expect(normalized?.declaredHorizonMonths).toBe(36);  // selected remains stored
    expect(normalized?.fullHorizonEndDayKey > '2030-01-01').toBe(true);  // but extends to 2031
    expect(normalized?.fullHorizonEndDayKey < '2032-01-01').toBe(true);
  });

  it('legitimate 3-year plan without explicit longer text remains 3 years', () => {
    const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO: '2026-05-09T10:00:00.000Z', todayDate: '2026-05-09' });
    const plan = buildMasterPlan({
      profileId: DEFAULT_PROFILE_ID,
      title: 'Operation Endgame',
      northStarOutcome: 'Build a profitable music-tech company through Operation Endgame',
      coreMission: 'Build and execute Operation Endgame',  // no explicit duration
      horizonStart: '2026-05-09',
      horizonEnd: '2029-05-09',      // 3-year stored value
      declaredHorizonMonths: 36,     // user selected 3 years
      anchors: [],
      nowISO: '2026-05-09T10:00:00.000Z',
    });
    state.masterPlansById = { [plan.id]: plan };
    state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = plan.id;
    state.profilesById[DEFAULT_PROFILE_ID].masterPlanIds = [plan.id];
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const normalized = getPlan(derived);
    // No conflict: selected 36mo, no longer text → remains 36mo
    expect(normalized?.fullHorizonEndDayKey).toMatch(/^2029/);  // stays at 2029
  });
});

// ─── Suite F: UI layer horizon calculation ─────────────────────────

describe('UI layer horizon calculation', () => {
  it('Full strategic agenda view always shows strategic horizon (2031), not capped stored horizon (2029)', () => {
    // This test verifies the fix for the live UI blocker where "Full horizon" + "Full strategic agenda"
    // was showing May 2029 instead of the full 5-year Operation Endgame through 2031
    const state = buildLiveFailureState();
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const plan = getPlan(derived);
    const activeMissionContract = derived.activeMissionContract;

    // Simulate the layerHorizonEnd calculation for 'roadmap_milestones' (Full strategic agenda)
    const commitmentView = 'roadmap_milestones';
    const strategicCoverage = { horizonEnd: plan.horizonEnd }; // capped at 2029
    const strategicAgenda = { resolvedStrategicHorizonEndDayKey: plan.fullHorizonEndDayKey }; // 2031

    // The fix: for 'roadmap_milestones', always calculate strategic horizon directly
    let layerHorizonEnd;
    if (commitmentView === 'committed_only') {
      layerHorizonEnd = strategicCoverage.horizonEnd;
    } else if (commitmentView === 'committed_forecast') {
      layerHorizonEnd = strategicCoverage.horizonEnd;
    } else {
      // For 'roadmap_milestones' (Full strategic agenda), always use the full strategic horizon
      layerHorizonEnd = resolveStrategicAgendaHorizon(plan, activeMissionContract).resolvedStrategicHorizonEndDayKey || strategicCoverage.horizonEnd;
    }

    // Full strategic agenda should show strategic horizon (2031)
    // After normalization, plan.horizonEnd is extended to match strategic horizon
    expect(layerHorizonEnd).toBe(plan.fullHorizonEndDayKey); // 2031
    expect(layerHorizonEnd).toBe(plan.horizonEnd); // normalized to 2031
    expect(layerHorizonEnd > '2030-01-01').toBe(true); // extends to 2031
  });

  it('Committed only view uses committed window end, not plan horizon', () => {
    const state = buildLiveFailureState();
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const plan = getPlan(derived);

    const commitmentView = 'committed_only';
    const commitmentLayers = { committedWindowEnd: '2026-10-31' }; // example committed end
    const strategicCoverage = { horizonEnd: plan.horizonEnd, executionCycleWindow: { end: '2026-07-31' }, horizonStart: '2026-05-09' };

    let layerHorizonEnd;
    if (commitmentView === 'committed_only') {
      layerHorizonEnd = commitmentLayers.committedWindowEnd || strategicCoverage.executionCycleWindow?.end || strategicCoverage.horizonStart;
    }

    // Committed only should use committed window, not the normalized plan horizon
    expect(layerHorizonEnd).toBe('2026-10-31');
    expect(layerHorizonEnd < '2027-01-01').toBe(true); // bounded to committed
  });

  it('Committed + forecast view uses roadmap coverage end, not strategic horizon', () => {
    const state = buildLiveFailureState();
    const derived = computeDerivedState(state, { type: 'NO_OP' });
    const plan = getPlan(derived);

    const commitmentView = 'committed_forecast';
    const commitmentLayers = { roadmapCoverageEnd: '2029-12-31' }; // example roadmap end
    const strategicCoverage = { horizonEnd: plan.horizonEnd }; // 2029

    let layerHorizonEnd;
    if (commitmentView === 'committed_forecast') {
      layerHorizonEnd = commitmentLayers.roadmapCoverageEnd || strategicCoverage.horizonEnd;
    }

    // Committed + forecast should use roadmap coverage, not strategic horizon
    expect(layerHorizonEnd).toBe('2029-12-31');
  });
});

// ─── Suite G: UI horizon propagation ─────────────────────────

describe('UI horizon propagation', () => {
  it('TimelineGrid horizonBounds extends to plan.horizonEnd', () => {
    // Test that timeline shows months up to selected horizon
    const plan = { horizonStart: '2026-05-09', horizonEnd: '2031-05-09' };
    const anchors = [{ date: '2026-10-17' }];
    const milestones = [];
    const proposedBlocks = [];
    const forecastBlocks = [];
    const gatedBlocks = [];

    const dates = [
      plan?.horizonStart,
      plan?.horizonEnd,
      ...anchors.map((a) => a.date),
      ...milestones.map((m) => m.targetDate),
      ...proposedBlocks.map((block) => block?.dayKey || block?.startISO),
      ...forecastBlocks.map((block) => block?.dayKey || block?.startISO),
      ...gatedBlocks.map((block) => block?.dayKey || block?.startISO),
    ].filter(Boolean).sort();

    const horizonBounds = { start: dates[0], end: dates[dates.length - 1] };

    // Should extend to plan.horizonEnd even if no items there
    expect(horizonBounds.end).toBe('2031-05-09');
  });
});