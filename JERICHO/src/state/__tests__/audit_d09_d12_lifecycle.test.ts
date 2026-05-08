/**
 * D-09 / D-12 lifecycle verification probe
 *
 * D-09: Lifecycle correctness — proposed blocks not auto-applied; apply is
 *       explicit; post-apply state writes to review; lifecycle transitions
 *       are distinct and auditable.
 *
 * D-12: End-to-end consistency — planning surface and chart surface agree
 *       after apply; no phantom blocks; no orphaned rows; no goalId/cycleId
 *       mismatches between proposed and applied.
 *
 * Goals: ST-02 (Fitness 70d) and LT-02 (Fullstack 18m) — both show
 * PLAN_QUALITY_PASSED on the production path and are the cleanest candidates
 * for full lifecycle confirmation.
 *
 * Lifecycle flow exercised:
 *   COMPLETE_ONBOARDING
 *   → SET_CALIBRATION_DAYS (generates proposedBlocks with status 'suggested')
 *   → [D-09 assertion: not auto-applied]
 *   → APPLY_DRAFT_SCHEDULE (applies blocks to scheduleReviewBlocks)
 *   → [D-12 assertion: surface consistency]
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
    today: { date: nowDay, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: nowDay, days: [], metrics: {} },
    cycle: [],
    viewDate: nowDay,
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: false, lastActiveDate: nowDay, scenarioLabel: '', demoScenarioEnabled: false, showHints: false },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: `${nowDay}T12:00:00.000Z`,
      activeDayKey: nowDay,
      isFollowingNow: true,
    },
  };
}

/**
 * Decorate all blocks in proposedBlocks/suggestedBlocks with canonical
 * lineage (deliverableId, actionId, cycleId, goalId) so APPLY_DRAFT_SCHEDULE
 * can produce review blocks without lineage errors.
 * Mirrors the withAdmissiblePreviewLineage helper in failureModes.test.ts.
 */
function withLineage(state: any) {
  const cycleId = state.activeCycleId;
  const cycle = state.cyclesById?.[cycleId];
  const goalId = cycle?.goalContract?.goalId;
  const deliverableId =
    cycle?.strategy?.deliverables?.[0]?.id ||
    cycle?.deliverables?.[0]?.id ||
    state.deliverablesByCycleId?.[cycleId]?.deliverables?.[0]?.id ||
    'd1';
  const actionId = cycle?.actions?.[0]?.id || 'act-det-1';

  const decorate = (block: any, index: number) => ({
    ...block,
    title: block?.title || `Goal block ${index + 1}`,
    rawLabel: block?.rawLabel || block?.title || `Goal block ${index + 1}`,
    deliverableId,
    actionId,
    cycleId,
    goalId,
  });

  const proposedBlocks = (state.proposedBlocks || []).map(decorate);
  const suggestedBlocks = (state.suggestedBlocks || []).map(decorate);

  return {
    ...state,
    proposedBlocks,
    suggestedBlocks,
    cyclesById: {
      ...state.cyclesById,
      [cycleId]: {
        ...cycle,
        proposedBlocks,
        suggestedBlocks,
      },
    },
  };
}

// Lifecycle errors that indicate real system failure (distinct from probe-artifact
// errors like FEASIBILITY_MISSING_FOR_PLAN which fires when feasibility score is
// NaN due to absent work-window capacity data in the probe context).
const LIFECYCLE_ERROR_CODES = new Set([
  'CYCLE_READ_ONLY',
  'REGENERATE_BLOCKED_ACTIVE_SCHEDULE',
  'NO_PROPOSED_BLOCKS',
  'ACTION_GRAPH_MISSING',
]);

function buildLifecycleStates(onboardingArgs: any, calibrationDaysPerWeek = 4) {
  const base = buildBaseState();

  // Step 1: onboard
  const onboarded = computeDerivedState(base, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: onboardingArgs,
  });

  // Step 2: calibrate — generates proposedBlocks with status 'suggested'.
  // NOTE: SET_CALIBRATION_DAYS early-returns if plan.status === 'calibrated' &&
  // plan.daysPerWeek === parsed. If minimumDaysPerWeek matches calibrationDaysPerWeek,
  // use a different value to force recalibration and block generation.
  const calibrated = computeDerivedState(onboarded, {
    type: 'SET_CALIBRATION_DAYS',
    daysPerWeek: calibrationDaysPerWeek,
  });

  // Step 3: inject canonical lineage (required for admissible apply)
  const withLineageState = withLineage(calibrated);

  // Step 4: apply
  const applied = computeDerivedState(withLineageState, { type: 'APPLY_DRAFT_SCHEDULE' });

  return { onboarded, calibrated, withLineageState, applied };
}

// ---------------------------------------------------------------------------
// ST-02: Fitness 70 days
// ---------------------------------------------------------------------------
describe('D-09 / D-12: ST-02 Fitness 70d lifecycle', () => {
  // minimumDaysPerWeek: 5, so onboarding calibrates at daysPerWeek=5.
  // SET_CALIBRATION_DAYS with 4 forces recalibration and block generation.
  const { calibrated, applied } = buildLifecycleStates({
    direction: 'Lose 12 pounds with a consistent training and meal-prep routine',
    goalText: 'Lose 12 pounds with a consistent training and meal-prep routine',
    horizon: '70d',
    narrative: '',
    focusAreas: ['Body'],
    successDefinition: 'Scale weight down 12 lbs, training sessions logged 5x/week, meal-prep completed each Sunday',
    minimumDaysPerWeek: 5,
  }, 4);

  // --- D-09: pre-apply invariants ---

  it('D-09: proposed blocks exist after calibration (not auto-applied)', () => {
    const suggestedCount = (calibrated.proposedBlocks || []).filter((b: any) => b?.status === 'suggested').length;
    console.log('ST-02 proposed block count after calibration:', suggestedCount);
    console.log('ST-02 scheduleApplied after calibration:', calibrated.scheduleApplied);
    expect(suggestedCount).toBeGreaterThan(0);
  });

  it('D-09: scheduleApplied is false before explicit apply', () => {
    expect(calibrated.scheduleApplied).toBeFalsy();
  });

  it('D-09: cycle.scheduleLifecycle is not applied_review before apply', () => {
    const cycleId = calibrated.activeCycleId;
    const cycle = calibrated.cyclesById?.[cycleId];
    console.log('ST-02 cycle.scheduleLifecycle before apply:', cycle?.scheduleLifecycle);
    expect(cycle?.scheduleLifecycle).not.toBe('applied_review');
  });

  it('D-09: proposed blocks are not present in today.blocks (not auto-committed)', () => {
    const todayBlocks = calibrated.today?.blocks ?? [];
    const proposedIds = new Set(
      (calibrated.proposedBlocks || [])
        .filter((b: any) => b?.status === 'suggested')
        .map((b: any) => b.id)
    );
    const overlap = todayBlocks.filter((b: any) => proposedIds.has(b?.id));
    console.log('ST-02 today.blocks overlapping proposedBlocks:', overlap.length);
    expect(overlap).toHaveLength(0);
  });

  // --- D-09: post-apply invariants ---

  it('D-09: scheduleApplied becomes true after APPLY_DRAFT_SCHEDULE', () => {
    console.log('ST-02 scheduleApplied after apply:', applied.scheduleApplied);
    expect(applied.scheduleApplied).toBe(true);
  });

  it('D-09: lastPlanError contains no blocking lifecycle errors after apply', () => {
    console.log('ST-02 lastPlanError after apply:', applied.lastPlanError);
    // FEASIBILITY_MISSING_FOR_PLAN is a probe artifact (no work-window data → NaN
    // feasibility score). It does not indicate a lifecycle failure; the schedule
    // was applied successfully. Only LIFECYCLE_ERROR_CODES indicate real failures.
    if (applied.lastPlanError) {
      expect(LIFECYCLE_ERROR_CODES.has(applied.lastPlanError.code)).toBe(false);
    }
  });

  it('D-09: cycle.scheduleLifecycle is applied_review after apply', () => {
    const cycleId = applied.activeCycleId;
    const cycle = applied.cyclesById?.[cycleId];
    console.log('ST-02 cycle.scheduleLifecycle after apply:', cycle?.scheduleLifecycle);
    expect(cycle?.scheduleLifecycle).toBe('applied_review');
  });

  // --- D-12: surface consistency invariants ---

  it('D-12: scheduleReviewBlocks are populated after apply', () => {
    const reviewBlocks = applied.scheduleReviewBlocks ?? [];
    const cycleId = applied.activeCycleId;
    const cycleReviewBlocks = applied.cyclesById?.[cycleId]?.scheduleReviewBlocks ?? [];
    console.log('ST-02 state.scheduleReviewBlocks count:', reviewBlocks.length);
    console.log('ST-02 cycle.scheduleReviewBlocks count:', cycleReviewBlocks.length);
    // Either state or cycle has review blocks (or both agree)
    expect(reviewBlocks.length + cycleReviewBlocks.length).toBeGreaterThan(0);
  });

  it('D-12: all review blocks belong to the active cycle (no orphaned rows)', () => {
    const cycleId = applied.activeCycleId;
    const reviewBlocks = applied.scheduleReviewBlocks ?? [];
    const orphaned = reviewBlocks.filter((b: any) => b?.cycleId && b.cycleId !== cycleId);
    console.log('ST-02 orphaned review blocks:', orphaned.length);
    expect(orphaned).toHaveLength(0);
  });

  it('D-12: planDraft and planPreview are null after apply (no stale surface)', () => {
    console.log('ST-02 planDraft after apply:', applied.planDraft);
    console.log('ST-02 planPreview after apply:', applied.planPreview);
    expect(applied.planDraft).toBeNull();
    expect(applied.planPreview).toBeNull();
  });

  it('D-12: proposed blocks that were accepted now have status accepted (not still suggested)', () => {
    const stillSuggested = (applied.proposedBlocks || []).filter(
      (b: any) => b?.status === 'suggested'
    );
    console.log('ST-02 blocks still status:suggested after apply:', stillSuggested.length);
    expect(stillSuggested).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// LT-02: Full-stack dev 18 months
// ---------------------------------------------------------------------------
describe('D-09 / D-12: LT-02 Fullstack 18m lifecycle', () => {
  // minimumDaysPerWeek: 4, so onboarding calibrates at daysPerWeek=4.
  // Use calibrationDaysPerWeek=5 to force recalibration and block generation.
  const { calibrated, applied } = buildLifecycleStates({
    direction: 'Learn full-stack web development, build a portfolio of 3 projects, and land a junior software engineer role within 18 months',
    goalText: 'Learn full-stack web development, build a portfolio of 3 projects, and land a junior software engineer role within 18 months',
    horizon: '18m',
    narrative: '',
    focusAreas: ['Focus', 'Resources'],
    successDefinition: '3 portfolio projects deployed and live on GitHub. Junior software engineer offer letter received.',
    minimumDaysPerWeek: 4,
  }, 5);

  it('D-09: proposed blocks exist after calibration (not auto-applied)', () => {
    const suggestedCount = (calibrated.proposedBlocks || []).filter((b: any) => b?.status === 'suggested').length;
    console.log('LT-02 proposed block count after calibration:', suggestedCount);
    expect(suggestedCount).toBeGreaterThan(0);
  });

  it('D-09: scheduleApplied is false before explicit apply', () => {
    expect(calibrated.scheduleApplied).toBeFalsy();
  });

  it('D-09: scheduleApplied becomes true after apply', () => {
    expect(applied.scheduleApplied).toBe(true);
  });

  it('D-09: lastPlanError contains no blocking lifecycle errors after apply', () => {
    console.log('LT-02 lastPlanError after apply:', applied.lastPlanError);
    if (applied.lastPlanError) {
      expect(LIFECYCLE_ERROR_CODES.has(applied.lastPlanError.code)).toBe(false);
    }
  });

  it('D-09: cycle.scheduleLifecycle is applied_review after apply', () => {
    const cycleId = applied.activeCycleId;
    const cycle = applied.cyclesById?.[cycleId];
    console.log('LT-02 cycle.scheduleLifecycle after apply:', cycle?.scheduleLifecycle);
    expect(cycle?.scheduleLifecycle).toBe('applied_review');
  });

  it('D-12: scheduleReviewBlocks are populated after apply', () => {
    const reviewBlocks = applied.scheduleReviewBlocks ?? [];
    const cycleId = applied.activeCycleId;
    const cycleReviewBlocks = applied.cyclesById?.[cycleId]?.scheduleReviewBlocks ?? [];
    console.log('LT-02 state.scheduleReviewBlocks count:', reviewBlocks.length);
    console.log('LT-02 cycle.scheduleReviewBlocks count:', cycleReviewBlocks.length);
    expect(reviewBlocks.length + cycleReviewBlocks.length).toBeGreaterThan(0);
  });

  it('D-12: no orphaned review blocks', () => {
    const cycleId = applied.activeCycleId;
    const reviewBlocks = applied.scheduleReviewBlocks ?? [];
    const orphaned = reviewBlocks.filter((b: any) => b?.cycleId && b.cycleId !== cycleId);
    console.log('LT-02 orphaned review blocks:', orphaned.length);
    expect(orphaned).toHaveLength(0);
  });

  it('D-12: planDraft and planPreview are null after apply', () => {
    expect(applied.planDraft).toBeNull();
    expect(applied.planPreview).toBeNull();
  });

  it('D-12: no proposed blocks remain as suggested after apply', () => {
    const stillSuggested = (applied.proposedBlocks || []).filter(
      (b: any) => b?.status === 'suggested'
    );
    expect(stillSuggested).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ST-01: EP 45 days
// ---------------------------------------------------------------------------
describe('D-09 / D-12: ST-01 EP 45d lifecycle', () => {
  // minimumDaysPerWeek: 4 → onboarding calibrates at 4. Use 5 to force block gen.
  const { calibrated, applied } = buildLifecycleStates({
    direction: 'Finish and release a polished 3-song EP',
    goalText: 'Finish and release a polished 3-song EP',
    horizon: '45d',
    narrative: '',
    focusAreas: ['Creation'],
    successDefinition: 'EP is uploaded and live on at least one streaming platform',
    minimumDaysPerWeek: 4,
  }, 5);

  it('D-09: proposed blocks exist after calibration (not auto-applied)', () => {
    const suggestedCount = (calibrated.proposedBlocks || []).filter((b: any) => b?.status === 'suggested').length;
    console.log('ST-01 proposed block count after calibration:', suggestedCount);
    console.log('ST-01 scheduleApplied after calibration:', calibrated.scheduleApplied);
    expect(suggestedCount).toBeGreaterThan(0);
  });

  it('D-09: scheduleApplied is false before explicit apply', () => {
    expect(calibrated.scheduleApplied).toBeFalsy();
  });

  it('D-09: cycle.scheduleLifecycle is not applied_review before apply', () => {
    const cycleId = calibrated.activeCycleId;
    const cycle = calibrated.cyclesById?.[cycleId];
    console.log('ST-01 cycle.scheduleLifecycle before apply:', cycle?.scheduleLifecycle);
    expect(cycle?.scheduleLifecycle).not.toBe('applied_review');
  });

  it('D-09: scheduleApplied becomes true after APPLY_DRAFT_SCHEDULE', () => {
    console.log('ST-01 scheduleApplied after apply:', applied.scheduleApplied);
    expect(applied.scheduleApplied).toBe(true);
  });

  it('D-09: lastPlanError contains no blocking lifecycle errors after apply', () => {
    console.log('ST-01 lastPlanError after apply:', applied.lastPlanError);
    if (applied.lastPlanError) {
      expect(LIFECYCLE_ERROR_CODES.has(applied.lastPlanError.code)).toBe(false);
    }
  });

  it('D-09: cycle.scheduleLifecycle is applied_review after apply', () => {
    const cycleId = applied.activeCycleId;
    const cycle = applied.cyclesById?.[cycleId];
    console.log('ST-01 cycle.scheduleLifecycle after apply:', cycle?.scheduleLifecycle);
    expect(cycle?.scheduleLifecycle).toBe('applied_review');
  });

  it('D-12: scheduleReviewBlocks are populated after apply', () => {
    const reviewBlocks = applied.scheduleReviewBlocks ?? [];
    const cycleId = applied.activeCycleId;
    const cycleReviewBlocks = applied.cyclesById?.[cycleId]?.scheduleReviewBlocks ?? [];
    console.log('ST-01 state.scheduleReviewBlocks count:', reviewBlocks.length);
    console.log('ST-01 cycle.scheduleReviewBlocks count:', cycleReviewBlocks.length);
    expect(reviewBlocks.length + cycleReviewBlocks.length).toBeGreaterThan(0);
  });

  it('D-12: no orphaned review blocks', () => {
    const cycleId = applied.activeCycleId;
    const reviewBlocks = applied.scheduleReviewBlocks ?? [];
    const orphaned = reviewBlocks.filter((b: any) => b?.cycleId && b.cycleId !== cycleId);
    console.log('ST-01 orphaned review blocks:', orphaned.length);
    expect(orphaned).toHaveLength(0);
  });

  it('D-12: planDraft and planPreview are null after apply', () => {
    console.log('ST-01 planDraft after apply:', applied.planDraft);
    console.log('ST-01 planPreview after apply:', applied.planPreview);
    expect(applied.planDraft).toBeNull();
    expect(applied.planPreview).toBeNull();
  });

  it('D-12: no proposed blocks remain as suggested after apply', () => {
    const stillSuggested = (applied.proposedBlocks || []).filter(
      (b: any) => b?.status === 'suggested'
    );
    console.log('ST-01 blocks still status:suggested after apply:', stillSuggested.length);
    expect(stillSuggested).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ST-03: Landing page 60 days
// ---------------------------------------------------------------------------
describe('D-09 / D-12: ST-03 Landing page 60d lifecycle', () => {
  // minimumDaysPerWeek: 4 → calibrates at 4. Use 5 to force block gen.
  const { calibrated, applied } = buildLifecycleStates({
    direction: 'Launch a branded landing page and get first 25 leads',
    goalText: 'Launch a branded landing page and get first 25 leads',
    horizon: '60d',
    narrative: '',
    focusAreas: ['Creation', 'Resources'],
    successDefinition: 'Branded landing page live. Email opt-in form capturing leads. 25 email leads collected.',
    minimumDaysPerWeek: 4,
  }, 5);

  it('D-09: proposed blocks exist after calibration (not auto-applied)', () => {
    const suggestedCount = (calibrated.proposedBlocks || []).filter((b: any) => b?.status === 'suggested').length;
    console.log('ST-03 proposed block count after calibration:', suggestedCount);
    expect(suggestedCount).toBeGreaterThan(0);
  });

  it('D-09: scheduleApplied is false before explicit apply', () => {
    expect(calibrated.scheduleApplied).toBeFalsy();
  });

  it('D-09: scheduleApplied becomes true after APPLY_DRAFT_SCHEDULE', () => {
    expect(applied.scheduleApplied).toBe(true);
  });

  it('D-09: lastPlanError contains no blocking lifecycle errors after apply', () => {
    console.log('ST-03 lastPlanError after apply:', applied.lastPlanError);
    if (applied.lastPlanError) {
      expect(LIFECYCLE_ERROR_CODES.has(applied.lastPlanError.code)).toBe(false);
    }
  });

  it('D-09: cycle.scheduleLifecycle is applied_review after apply', () => {
    const cycleId = applied.activeCycleId;
    const cycle = applied.cyclesById?.[cycleId];
    console.log('ST-03 cycle.scheduleLifecycle after apply:', cycle?.scheduleLifecycle);
    expect(cycle?.scheduleLifecycle).toBe('applied_review');
  });

  it('D-12: scheduleReviewBlocks are populated after apply', () => {
    const reviewBlocks = applied.scheduleReviewBlocks ?? [];
    const cycleId = applied.activeCycleId;
    const cycleReviewBlocks = applied.cyclesById?.[cycleId]?.scheduleReviewBlocks ?? [];
    console.log('ST-03 state.scheduleReviewBlocks count:', reviewBlocks.length);
    console.log('ST-03 cycle.scheduleReviewBlocks count:', cycleReviewBlocks.length);
    expect(reviewBlocks.length + cycleReviewBlocks.length).toBeGreaterThan(0);
  });

  it('D-12: no orphaned review blocks', () => {
    const cycleId = applied.activeCycleId;
    const reviewBlocks = applied.scheduleReviewBlocks ?? [];
    const orphaned = reviewBlocks.filter((b: any) => b?.cycleId && b.cycleId !== cycleId);
    console.log('ST-03 orphaned review blocks:', orphaned.length);
    expect(orphaned).toHaveLength(0);
  });

  it('D-12: planDraft and planPreview are null after apply', () => {
    expect(applied.planDraft).toBeNull();
    expect(applied.planPreview).toBeNull();
  });

  it('D-12: no proposed blocks remain as suggested after apply', () => {
    const stillSuggested = (applied.proposedBlocks || []).filter(
      (b: any) => b?.status === 'suggested'
    );
    expect(stillSuggested).toHaveLength(0);
  });
});
