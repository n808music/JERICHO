/**
 * gumChain.e2e.test.ts
 *
 * End-to-end chain regression for the caffeinated gum goal.
 * Exact 15-month goal text is run through all five signal layers.
 *
 * Layer 1  Intake qualification
 * Layer 2  Feasibility + policy snapshot
 * Layer 3  Execution evidence
 * Layer 4  Course correction signal
 * Layer 5  Live P.O.S. surfacing
 *
 * Critical invariants proved here (not in any existing single-layer suite):
 *   I-1  authority = 'unknown' for "first real sales" without threshold metrics (Phase 1 limit)
 *   I-2  policy_degraded alone does NOT gate livePos — gate fires only on TRUST_WITHHOLDING_GATE_CODES
 *   I-3  policy_blocked (INFEASIBLE) alone does NOT erase execution evidence from livePos
 *   I-4  authority 'unknown' caps posTrust to provisional (ceiling includes uncharacterized goals)
 */

import { describe, it, expect } from 'vitest';
import { buildGoalIntakeContract } from '../../src/domain/goal/GoalIntakeContract';
import { buildGoalPolicySnapshot } from '../../src/domain/goal/GoalPolicy';
import { identityReducer } from '../../src/state/identityStore.js';
import { computeDerivedState, getAllBlocks } from '../../src/state/identityCompute.js';

// ---------------------------------------------------------------------------
// Exact goal text from the 15-month spec
// ---------------------------------------------------------------------------

const GUM_GOAL_TEXT =
  'Build a caffeinated gum brand and take it to first real sales within 15 months with ' +
  'product concept validation, branding, packaging, sourcing, checkout/channel readiness, ' +
  'outreach, and launch execution completed.';

const GUM_VERIFICATION = 'First cold sale confirmed';

// ---------------------------------------------------------------------------
// Canonical gum actions + deliverables
// ---------------------------------------------------------------------------

const GUM_ACTIONS = [
  {
    id: 'brand:00:01:investigate-gum-category',
    actionType: 'preparation',
    dependencies: [],
  },
  {
    id: 'brand:00:02:white-label-vendor-research',
    actionType: 'execution',
    dependencies: ['brand:00:01:investigate-gum-category'],
  },
];

const GUM_DELIVERABLES = [
  {
    id: 'del-gum-chain-1',
    actionIds: [
      'brand:00:01:investigate-gum-category',
      'brand:00:02:white-label-vendor-research',
    ],
    dependencyIds: [],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildGumExecutionContract(goalId: string) {
  return {
    goalId,
    startDayKey: '2026-05-01',
    endDayKey: '2027-08-01',
    deadline: { dayKey: '2027-08-01' },
    workWindows: {
      mon: [{ start: '09:00', end: '11:00' }],
      tue: [{ start: '09:00', end: '11:00' }],
      wed: [{ start: '09:00', end: '11:00' }],
      thu: [{ start: '09:00', end: '11:00' }],
      fri: [{ start: '09:00', end: '11:00' }],
      sat: [],
      sun: [],
    },
    terminalOutcome: {
      text: GUM_GOAL_TEXT,
      verificationCriteria: GUM_VERIFICATION,
      isConcrete: true,
    },
  } as any;
}

function makeGumCompleteEvent(
  blockId: string,
  actionId: string,
  dateISO: string,
  goalId: string,
  cycleId: string
) {
  return {
    id: `evt:complete:${blockId}:${dateISO}`,
    blockId,
    dateISO,
    minutes: 60,
    rawLabel: 'Gum brand work',
    domain: 'Focus' as const,
    cycleId,
    goalId,
    actionId,
    requiredSystemBlock: true,
    completed: true,
    kind: 'complete' as const,
    status: 'completed',
  };
}

function makeGumMissedEvent(
  blockId: string,
  actionId: string,
  dateISO: string,
  goalId: string,
  cycleId: string
) {
  return {
    id: `evt:missed:${blockId}:${dateISO}`,
    blockId,
    dateISO,
    minutes: 60,
    rawLabel: 'Gum brand work',
    domain: 'Focus' as const,
    cycleId,
    goalId,
    actionId,
    requiredSystemBlock: true,
    completed: false,
    kind: 'missed' as const,
    status: 'missed',
  };
}

// ---------------------------------------------------------------------------
// Box 1: Intake qualification — actual gum goal text
// ---------------------------------------------------------------------------

describe('Box 1: Actual gum goal text qualifies through intake (Layer 1)', () => {
  const intake = buildGoalIntakeContract({
    goalId: 'goal-gum-chain-box1',
    rawGoalText: GUM_GOAL_TEXT,
    verificationCriteria: GUM_VERIFICATION,
    executionType: 'BrandLaunch',
    deadline: '2027-08-01',
  });

  it('goal is assumption_marked_draft — ready for planning, not intake_blocked', () => {
    expect(intake.readiness.isReadyForPlanning).toBe(true);
    expect(intake.readiness.state).toBe('assumption_marked_draft');
    expect(intake.readiness.state).not.toBe('intake_blocked');
  });

  it('Phase 1 invariant I-1: authority = unknown for "first real sales" without threshold metrics', () => {
    // "first real sales" contains no numeric threshold, no $-revenue pattern, no named external
    // actor. The Phase 1 detector cannot classify it. This is a documented limitation (RC-22).
    expect(intake.terminalOutcomeAuthority.authority).toBe('unknown');
    expect(intake.terminalOutcomeAuthority.reasons).toContain('INSUFFICIENT_SIGNAL');
  });

  it('completionBoundaryStatus is missing for BrandLaunch (non-podcast domain)', () => {
    // Non-podcast goals cannot resolve a completion boundary from text alone.
    // policy_degraded is the honest result — not a goal-specific bug.
    expect(intake.completionBoundaryStatus).toBe('missing');
    expect(intake.domain).toBe('general');
  });
});

// ---------------------------------------------------------------------------
// Box 2: policy_degraded alone does NOT gate Live P.O.S. (invariant I-2)
// ---------------------------------------------------------------------------

describe('Box 2: policy_degraded does NOT gate livePos — withheld only by lack of evidence', () => {
  const intake = buildGoalIntakeContract({
    goalId: 'goal-gum-chain-box2',
    rawGoalText: GUM_GOAL_TEXT,
    verificationCriteria: GUM_VERIFICATION,
    executionType: 'BrandLaunch',
    deadline: '2027-08-01',
  });

  const policy = buildGoalPolicySnapshot({
    goalId: 'goal-gum-chain-box2',
    intakeContract: intake,
    executionContract: buildGumExecutionContract('goal-gum-chain-box2'),
    planProof: { feasibilityStatus: 'FEASIBLE' },
    probabilityStatus: 'computed',
    hasCommittedBlocks: true,
    hasProposedBlocks: true,
    hasExecutionGraph: true,
    canonicalDeliverables: GUM_DELIVERABLES,
    canonicalActions: GUM_ACTIONS,
    canonicalExecutionEvents: [],
    liveScheduleApplied: true,
    preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
    // no planQualityFailureCodes — no TRUST_WITHHOLDING_GATE_CODES
  });

  it('gum plan is policy_degraded (endpointClarity missing for non-podcast goal)', () => {
    expect(policy.planQuality.state).toBe('policy_degraded');
    expect(policy.planQuality.endpointClarity).toBe('missing');
  });

  it('livePos withheld by lack of evidence, not by policy gate (invariant I-2)', () => {
    expect(policy.livePos.state).toBe('withheld');
    expect(policy.livePos.reasonCodes).toContain('LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE');
    // The gate code is injected ONLY when TRUST_WITHHOLDING_GATE_CODES are present.
    // policy_degraded alone must never produce this code.
    expect(policy.livePos.reasonCodes).not.toContain('LIVE_POS_WITHHELD_CANONICAL_TRUTH_THIN');
  });

  it('no fake live score for policy_degraded gum plan with no evidence', () => {
    expect(policy.livePos.score.state).toBe('withheld');
    expect(policy.livePos.score.value).toBeNull();
  });

  it('posTrust is provisional (plan degraded), not withheld', () => {
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_TRUST_PROVISIONAL_PLAN_DEGRADED');
  });
});

// ---------------------------------------------------------------------------
// Box 3: Execution evidence enables livePos despite policy_degraded (Layer 3 → 5)
// ---------------------------------------------------------------------------

describe('Box 3: Execution evidence enables livePos despite policy_degraded', () => {
  const intake = buildGoalIntakeContract({
    goalId: 'goal-gum-chain-box3',
    rawGoalText: GUM_GOAL_TEXT,
    verificationCriteria: GUM_VERIFICATION,
    executionType: 'BrandLaunch',
    deadline: '2027-08-01',
  });

  const policy = buildGoalPolicySnapshot({
    goalId: 'goal-gum-chain-box3',
    intakeContract: intake,
    executionContract: buildGumExecutionContract('goal-gum-chain-box3'),
    planProof: { feasibilityStatus: 'FEASIBLE' },
    probabilityStatus: 'computed',
    hasCommittedBlocks: true,
    hasProposedBlocks: true,
    hasExecutionGraph: true,
    canonicalDeliverables: GUM_DELIVERABLES,
    canonicalActions: GUM_ACTIONS,
    canonicalExecutionEvents: [
      makeGumCompleteEvent(
        'blk-chain-3-1',
        'brand:00:01:investigate-gum-category',
        '2026-05-02',
        'goal-gum-chain-box3',
        'cycle-gum-chain'
      ),
    ],
    liveScheduleApplied: true,
    preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
    executionCorrectionState: 'on_track',
  });

  it('planQuality remains policy_degraded (unchanged by execution evidence)', () => {
    expect(policy.planQuality.state).toBe('policy_degraded');
  });

  it('livePos becomes eligible when linked gum execution events are present', () => {
    expect(policy.livePos.state).toBe('eligible');
    expect(policy.livePos.score.state).toBe('available');
  });

  it('posTrust is provisional from plan degraded reason — not withheld, not trusted', () => {
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_TRUST_PROVISIONAL_PLAN_DEGRADED');
    expect(policy.posTrust.state).not.toBe('withheld');
    expect(policy.posTrust.state).not.toBe('trusted');
  });

  it('on_track correction injects no extra reason codes in liveStateReasonCodes', () => {
    expect(policy.livePos.liveStateReasonCodes).not.toContain('LIVE_POS_CORRECTION_RECOVERY_REQUIRED');
    expect(policy.livePos.liveStateReasonCodes).not.toContain('LIVE_POS_CORRECTION_ADJUSTMENT_RECOMMENDED');
  });
});

// ---------------------------------------------------------------------------
// Box 4: authority 'unknown' caps posTrust to provisional (invariant I-4)
// ---------------------------------------------------------------------------

describe('Box 4: authority = unknown caps posTrust to provisional on policy-clean plans', () => {
  // The actual gum goal produces authority = 'unknown' (Phase 1 limit, Box 1).
  // Under policy_degraded (which the actual gum goal always has), the degraded branch
  // fires first. This box proves that IF the plan is clean, unknown authority still
  // hits the ceiling — the ceiling catches uncharacterized goals, not just known bad ones.
  //
  // Uses a podcast goal with "from scratch" (policy_clean) + explicit outcomeAuthorityClass override.

  const cleanIntake = buildGoalIntakeContract({
    goalId: 'goal-gum-chain-box4',
    rawGoalText: 'Publish 6 podcast episodes from scratch by deadline',
    verificationCriteria: '6 episodes are live',
    executionType: 'CreativeProduction',
    deadline: '2027-08-01',
  });

  const cleanActions = [
    { id: 'a1', actionType: 'preparation', dependencies: [] },
    { id: 'a2', actionType: 'execution', dependencies: ['a1'] },
  ];
  const cleanDeliverables = [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }];

  it('unknown authority triggers POS_TRUST_PROVISIONAL_AUTHORITY_CEILING on clean plan', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-chain-box4',
      intakeContract: cleanIntake,
      executionContract: buildGumExecutionContract('goal-gum-chain-box4'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: cleanDeliverables,
      canonicalActions: cleanActions,
      canonicalExecutionEvents: [],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      outcomeAuthorityClass: 'unknown',
    });

    expect(policy.planQuality.state).toBe('policy_clean');
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_TRUST_PROVISIONAL_AUTHORITY_CEILING');
    expect(policy.posTrust.reasonCodes).not.toContain('POS_TRUST_PROVISIONAL_PLAN_DEGRADED');
  });

  it('the gum goal authority = unknown (from Box 1) feeds the same ceiling path', () => {
    // Invariant: the 'unknown' authority class returned by buildGoalIntakeContract for the
    // gum goal is the same class that hits the ceiling above.
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-chain-box4-verify',
      rawGoalText: GUM_GOAL_TEXT,
      verificationCriteria: GUM_VERIFICATION,
      executionType: 'BrandLaunch',
      deadline: '2027-08-01',
    });
    expect(intake.terminalOutcomeAuthority.authority).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Box 5: Integration chain — computeDerivedState + COMPLETE/MISS_BLOCK
// ---------------------------------------------------------------------------

describe('Box 5: Integration chain — all five layers in state machine', () => {
  const CYCLE_ID = 'cycle-gum-chain-int';
  const GOAL_ID = 'goal-gum-chain-int';
  const BLOCK_DATE = '2026-05-02';

  const GUM_BLOCK = {
    id: 'blk-gum-chain-1',
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    origin: 'schedule_active' as const,
    actionId: 'brand:00:01:investigate-gum-category',
    title: 'Investigate functional gum category',
    label: 'Investigate functional gum category',
    practice: 'Focus',
    domain: 'Focus',
    start: `${BLOCK_DATE}T09:00:00.000Z`,
    end: `${BLOCK_DATE}T10:00:00.000Z`,
    status: 'planned' as const,
    requiredSystemBlock: true,
  };

  const GUM_BLOCK_2 = {
    id: 'blk-gum-chain-2',
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    origin: 'schedule_active' as const,
    actionId: 'brand:00:02:white-label-vendor-research',
    title: 'White-label vendor research',
    label: 'White-label vendor research',
    practice: 'Focus',
    domain: 'Focus',
    start: '2026-05-03T09:00:00.000Z',
    end: '2026-05-03T10:00:00.000Z',
    status: 'planned' as const,
    requiredSystemBlock: false,
  };

  // Use actual intake built from exact gum goal text
  const ACTUAL_GUM_INTAKE = buildGoalIntakeContract({
    goalId: GOAL_ID,
    rawGoalText: GUM_GOAL_TEXT,
    verificationCriteria: GUM_VERIFICATION,
    executionType: 'BrandLaunch',
    deadline: '2027-08-01',
  });

  function buildBaseState() {
    return {
      appTime: {
        nowISO: `${BLOCK_DATE}T10:30:00.000Z`,
        activeDayKey: BLOCK_DATE,
        timeZone: 'UTC',
        isFollowingNow: true,
      },
      today: { date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK }] },
      currentWeek: {
        weekStart: BLOCK_DATE,
        days: [
          { date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK }] },
          { date: '2026-05-03', blocks: [{ ...GUM_BLOCK_2 }] },
        ],
      },
      cycle: [
        { date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK }] },
        { date: '2026-05-03', blocks: [{ ...GUM_BLOCK_2 }] },
      ],
      ledger: [],
      executionEvents: [],
      suggestionEvents: [],
      proposedBlocks: [],
      suggestedBlocks: [],
      blockStore: {
        blocks: {
          [GUM_BLOCK.id]: { ...GUM_BLOCK },
          [GUM_BLOCK_2.id]: { ...GUM_BLOCK_2 },
        },
      },
      scheduleApplied: true,
      scheduleLifecycle: 'active_schedule',
      scheduleReviewBlocks: [],
      vector: {},
      lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
      constraints: { maxBlocksPerDay: 3, weeklyWindows: {} },
      goalAdmissionByGoal: { [GOAL_ID]: { status: 'ADMITTED', reasonCodes: [] } },
      activeCycleId: CYCLE_ID,
      goalExecutionContract: {
        goalId: GOAL_ID,
        goalText: GUM_GOAL_TEXT,
        terminalOutcome: {
          text: GUM_GOAL_TEXT,
          verificationCriteria: GUM_VERIFICATION,
          isConcrete: true,
        },
        startDayKey: '2026-05-01',
        endDayKey: '2027-08-01',
      },
      cyclesById: {
        [CYCLE_ID]: {
          id: CYCLE_ID,
          status: 'active',
          scheduleLifecycle: 'active_schedule',
          scheduleReviewBlocks: [],
          goalContract: {
            goalId: GOAL_ID,
            goalText: GUM_GOAL_TEXT,
            terminalOutcome: {
              text: GUM_GOAL_TEXT,
              verificationCriteria: GUM_VERIFICATION,
              isConcrete: true,
            },
            startDayKey: '2026-05-01',
            endDayKey: '2027-08-01',
            // Embed actual intake so applyGoalPolicy reads authority + readiness from it
            goalIntakeContract: {
              terminalOutcomeAuthority: ACTUAL_GUM_INTAKE.terminalOutcomeAuthority,
              readiness: ACTUAL_GUM_INTAKE.readiness,
              completionBoundaryStatus: ACTUAL_GUM_INTAKE.completionBoundaryStatus,
              scopePolicy: ACTUAL_GUM_INTAKE.scopePolicy,
            },
          },
          actions: GUM_ACTIONS,
          executionEvents: [],
          metrics: {},
        },
      },
      lastPlanError: null,
    };
  }

  it('Layer 1+2: goalPolicyByGoalId populated and livePos defined after computeDerivedState', () => {
    const state = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const policy = (state as any).goalPolicyByGoalId?.[GOAL_ID];
    expect(policy).toBeDefined();
    expect(policy?.livePos).toBeDefined();
    // gum goal is policy_degraded — no evidence yet → withheld
    expect(policy?.livePos?.state).toBe('withheld');
    expect(policy?.planQuality?.state).toBe('policy_degraded');
  });

  it('Layer 4: executionCorrectionByGoal populated after MISS_BLOCK', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'MISS_BLOCK', id: GUM_BLOCK.id });
    const correction = (after as any).executionCorrectionByGoal?.[GOAL_ID];
    expect(correction).toBeDefined();
    expect(correction?.correctionState).toMatch(
      /^(adjustment_recommended|recovery_required|watch)$/
    );
  });

  it('Layer 5: posTrust never trusted for actual gum goal text after COMPLETE_BLOCK', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id });
    const policy = (after as any).goalPolicyByGoalId?.[GOAL_ID];
    // plan is policy_degraded + authority 'unknown' → both cap posTrust
    expect(policy?.posTrust?.state).not.toBe('trusted');
  });

  it('Layer 2: schedule unchanged after correction signal computes (Layer 4 does not mutate Layer 2)', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'MISS_BLOCK', id: GUM_BLOCK.id });
    const allBlocks = getAllBlocks(after as any);
    const day2Block = allBlocks.find((b: any) => b.id === GUM_BLOCK_2.id);
    expect(day2Block).toBeDefined();
    expect(day2Block?.status).toBe('planned');
  });

  it('executionCorrectionByGoal and goalPolicyByGoalId are separate (Layer 4 ≠ Layer 5)', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, {
      type: 'COMPLETE_BLOCK',
      id: GUM_BLOCK.id,
    }) as any;
    expect(after.executionCorrectionByGoal?.[GOAL_ID]).toBeDefined();
    expect(after.goalPolicyByGoalId?.[GOAL_ID]?.livePos).toBeDefined();
    expect(after.executionCorrectionByGoal?.[GOAL_ID]).not.toHaveProperty('livePos');
    expect(after.goalPolicyByGoalId?.[GOAL_ID]?.livePos).not.toHaveProperty('correctionState');
  });
});

// ---------------------------------------------------------------------------
// Box 6: Structural policy_blocked alone does NOT erase execution evidence (invariant I-3)
// ---------------------------------------------------------------------------

describe('Box 6: INFEASIBLE gum plan does NOT gate livePos when no TRUST_WITHHOLDING_GATE_CODES', () => {
  const intake = buildGoalIntakeContract({
    goalId: 'goal-gum-chain-box6',
    rawGoalText: GUM_GOAL_TEXT,
    verificationCriteria: GUM_VERIFICATION,
    executionType: 'BrandLaunch',
    deadline: '2027-08-01',
  });

  const policy = buildGoalPolicySnapshot({
    goalId: 'goal-gum-chain-box6',
    intakeContract: intake,
    executionContract: buildGumExecutionContract('goal-gum-chain-box6'),
    // INFEASIBLE triggers policy_blocked via feasibilityHonesty = 'blocked'
    planProof: { feasibilityStatus: 'INFEASIBLE' },
    probabilityStatus: 'computed',
    hasCommittedBlocks: true,
    hasProposedBlocks: true,
    hasExecutionGraph: true,
    canonicalDeliverables: GUM_DELIVERABLES,
    canonicalActions: GUM_ACTIONS,
    canonicalExecutionEvents: [
      makeGumCompleteEvent(
        'blk-chain-6-1',
        'brand:00:01:investigate-gum-category',
        '2026-05-02',
        'goal-gum-chain-box6',
        'cycle-gum-chain'
      ),
    ],
    liveScheduleApplied: true,
    preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
    // no planQualityFailureCodes — no TRUST_WITHHOLDING_GATE_CODES
  });

  it('plan is policy_blocked from INFEASIBLE feasibility', () => {
    expect(policy.planQuality.state).toBe('policy_blocked');
  });

  it('livePos stays eligible — INFEASIBLE alone does NOT erase execution evidence (invariant I-3)', () => {
    // Gate = TRUST_WITHHOLDING_GATE_CODES only. Structural policy_blocked without those codes
    // must not gate livePos — the execution evidence remains valid and observable.
    expect(policy.livePos.state).toBe('eligible');
    expect(policy.livePos.score.state).toBe('available');
    expect(policy.livePos.score.value).not.toBeNull();
  });

  it('feasibility substrateLevel is withheld when plan has violations', () => {
    // The feasibility layer is correctly withheld — but independently of livePos
    expect(policy.feasibility.substrateLevel).toBe('withheld');
  });
});
