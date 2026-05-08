/**
 * livePOS.gumSchedule.test.ts
 *
 * Acceptance tests for canonical Live P.O.S. wiring on the gum goal.
 * Proves authority ceiling, execution evidence gating, correction-state
 * influence, and panel separation — without touching scoring doctrine.
 */

import { describe, it, expect } from 'vitest';
import { buildGoalIntakeContract } from '../../src/domain/goal/GoalIntakeContract';
import { buildGoalPolicySnapshot } from '../../src/domain/goal/GoalPolicy';
import { identityReducer } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function buildExecutionContract(goalId: string, text: string) {
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
    terminalOutcome: { text, verificationCriteria: `${text} verified`, isConcrete: true },
  } as any;
}

function makeLinkedCompleteEvent(blockId: string, actionId: string, dateISO: string, goalId: string, cycleId: string) {
  return {
    id: `evt:complete:${blockId}:${dateISO}`,
    blockId,
    dateISO,
    minutes: 60,
    rawLabel: 'Test block',
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

function makeLinkedMissedEvent(blockId: string, actionId: string, dateISO: string, goalId: string, cycleId: string) {
  return {
    id: `evt:missed:${blockId}:${dateISO}`,
    blockId,
    dateISO,
    minutes: 60,
    rawLabel: 'Test block',
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

const CANONICAL_ACTIONS = [
  {
    id: 'brand:00:01:investigate-gum-category',
    actionType: 'execution',
    dependencies: [],
    dependencyDetails: [],
  },
  {
    id: 'brand:00:02:white-label-vendor-research',
    actionType: 'execution',
    dependencies: ['brand:00:01:investigate-gum-category'],
    dependencyDetails: [
      { actionId: 'brand:00:01:investigate-gum-category', dependencyType: 'hard_gate' },
    ],
  },
];

const CANONICAL_DELIVERABLES = [
  { id: 'd-gum-1', actionIds: ['brand:00:01:investigate-gum-category', 'brand:00:02:white-label-vendor-research'], dependencyIds: [] },
];

// ---------------------------------------------------------------------------
// Box 1: No execution evidence → livePos withheld, no fake score
// ---------------------------------------------------------------------------

describe('Box 1: No execution evidence → livePos withheld', () => {
  it('livePos.state is withheld when no execution events and schedule live', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-livepos',
      rawGoalText: 'Launch caffeinated functional energy gum brand',
      verificationCriteria: 'First cold sale confirmed',
      executionType: 'ProductLaunch',
      deadline: '2027-08-01',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-livepos',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-gum-livepos', 'Launch caffeinated functional energy gum brand'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: CANONICAL_DELIVERABLES,
      canonicalActions: CANONICAL_ACTIONS,
      canonicalExecutionEvents: [],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
    });

    expect(policy.livePos.state).toBe('withheld');
    expect(policy.livePos.reasonCodes).toContain('LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE');
  });

  it('livePos.score.value is null when no execution evidence', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-livepos-score',
      rawGoalText: 'Launch caffeinated functional energy gum brand',
      verificationCriteria: 'First cold sale confirmed',
      executionType: 'ProductLaunch',
      deadline: '2027-08-01',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-livepos-score',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-gum-livepos-score', 'Launch caffeinated functional energy gum brand'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: CANONICAL_DELIVERABLES,
      canonicalActions: CANONICAL_ACTIONS,
      canonicalExecutionEvents: [],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
    });

    expect(policy.livePos.score.state).toBe('withheld');
    expect(policy.livePos.score.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Box 2: Completed gum blocks + on_track correction → livePos eligible
// ---------------------------------------------------------------------------

describe('Box 2: Completed gum blocks with on_track correction → livePos eligible', () => {
  it('livePos enters activating when linked completion events are present', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-activating',
      rawGoalText: 'Launch caffeinated functional energy gum brand',
      verificationCriteria: 'First cold sale confirmed',
      executionType: 'ProductLaunch',
      deadline: '2027-08-01',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-activating',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-gum-activating', 'Launch caffeinated functional energy gum brand'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: CANONICAL_DELIVERABLES,
      canonicalActions: CANONICAL_ACTIONS,
      canonicalExecutionEvents: [
        makeLinkedCompleteEvent('blk-1', 'brand:00:01:investigate-gum-category', '2026-05-02', 'goal-gum-activating', 'cycle-gum'),
      ],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      executionCorrectionState: 'on_track',
    });

    expect(policy.livePos.state).toBe('provisional');
    expect(policy.livePos.liveState).toBe('activating');
    expect(policy.livePos.score.state).toBe('available');
    expect(policy.livePos.percent).not.toBeNull();
  });

  it('no correction reason codes injected when correctionState is on_track', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-on-track',
      rawGoalText: 'Launch caffeinated functional energy gum brand',
      verificationCriteria: 'First cold sale confirmed',
      executionType: 'ProductLaunch',
      deadline: '2027-08-01',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-on-track',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-gum-on-track', 'Launch caffeinated functional energy gum brand'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: CANONICAL_DELIVERABLES,
      canonicalActions: CANONICAL_ACTIONS,
      canonicalExecutionEvents: [
        makeLinkedCompleteEvent('blk-1', 'brand:00:01:investigate-gum-category', '2026-05-02', 'goal-gum-on-track', 'cycle-gum'),
      ],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      executionCorrectionState: 'on_track',
    });

    expect(policy.livePos.liveStateReasonCodes).not.toContain('LIVE_POS_CORRECTION_RECOVERY_REQUIRED');
    expect(policy.livePos.liveStateReasonCodes).not.toContain('LIVE_POS_CORRECTION_ADJUSTMENT_RECOMMENDED');
  });
});

// ---------------------------------------------------------------------------
// Box 3: Missed required gum work → livePos at_risk with correction reason code
// ---------------------------------------------------------------------------

describe('Box 3: Missed/skipped required work → livePos reflects degraded state', () => {
  it('missed required work triggers at_risk with missed execution burden reason', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-at-risk',
      rawGoalText: 'Launch caffeinated functional energy gum brand',
      verificationCriteria: 'First cold sale confirmed',
      executionType: 'ProductLaunch',
      deadline: '2027-08-01',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-at-risk',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-gum-at-risk', 'Launch caffeinated functional energy gum brand'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: CANONICAL_DELIVERABLES,
      canonicalActions: CANONICAL_ACTIONS,
      canonicalExecutionEvents: [
        makeLinkedMissedEvent('blk-1', 'brand:00:01:investigate-gum-category', '2026-05-02', 'goal-gum-at-risk', 'cycle-gum'),
      ],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      executionCorrectionState: 'adjustment_recommended',
    });

    expect(policy.livePos.state).toBe('provisional');
    expect(policy.livePos.liveState).toBe('at_risk');
    expect(policy.livePos.liveStateReasonCodes).toContain('LIVE_POS_AT_RISK_MISSED_EXECUTION_BURDEN');
    expect(policy.livePos.liveStateReasonCodes).toContain('LIVE_POS_CORRECTION_ADJUSTMENT_RECOMMENDED');
    expect(policy.livePos.percent).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Box 4: recovery_required correction → livePos correction code injected
// ---------------------------------------------------------------------------

describe('Box 4: recovery_required correction → livePos annotated', () => {
  it('recovery_required injects LIVE_POS_CORRECTION_RECOVERY_REQUIRED reason code', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-recovery',
      rawGoalText: 'Launch caffeinated functional energy gum brand',
      verificationCriteria: 'First cold sale confirmed',
      executionType: 'ProductLaunch',
      deadline: '2027-08-01',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-recovery',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-gum-recovery', 'Launch caffeinated functional energy gum brand'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: CANONICAL_DELIVERABLES,
      canonicalActions: CANONICAL_ACTIONS,
      canonicalExecutionEvents: [
        makeLinkedMissedEvent('blk-1', 'brand:00:01:investigate-gum-category', '2026-05-02', 'goal-gum-recovery', 'cycle-gum'),
      ],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      executionCorrectionState: 'recovery_required',
    });

    expect(policy.livePos.state).toBe('provisional');
    expect(policy.livePos.liveStateReasonCodes).toContain('LIVE_POS_CORRECTION_RECOVERY_REQUIRED');
    expect(policy.livePos.liveStateReasonCodes).not.toContain('LIVE_POS_CORRECTION_ADJUSTMENT_RECOMMENDED');
    expect(policy.livePos.percent).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Box 5: Substrate withheld → livePos withheld regardless of events
// ---------------------------------------------------------------------------

describe('Box 5: Substrate withheld → livePos withheld', () => {
  it('policy_blocked plan withholds livePos regardless of execution events', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-blocked',
      rawGoalText: 'Launch caffeinated functional energy gum brand',
      verificationCriteria: 'First cold sale confirmed',
      executionType: 'ProductLaunch',
      deadline: '2027-08-01',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-blocked',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-gum-blocked', 'Launch caffeinated functional energy gum brand'),
      planProof: { feasibilityStatus: 'INFEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: CANONICAL_DELIVERABLES,
      canonicalActions: CANONICAL_ACTIONS,
      canonicalExecutionEvents: [
        makeLinkedCompleteEvent('blk-1', 'brand:00:01:investigate-gum-category', '2026-05-02', 'goal-gum-blocked', 'cycle-gum'),
      ],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      planQualityFailureCodes: ['OUTCOME_COVERAGE_PREP_ONLY'],
    });

    // With gate failure, plan quality is blocked → livePos withheld
    expect(policy.livePos.state).toBe('withheld');
    // Feasibility is withheld when substrate is not eligible
    expect(policy.feasibility.substrateLevel).toBe('withheld');
    // Score is withheld — no fake live score despite existing events
    expect(policy.livePos.score.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Box 6: outcomeAuthorityClass flows through and caps posTrust for market_dependent
// ---------------------------------------------------------------------------

describe('Box 6: outcomeAuthorityClass flows through canonical policy path', () => {
  // These tests need a policy-clean plan so the authority ceiling else-branch fires.
  // "from scratch" in rawGoalText triggers startingState detection, preventing
  // STARTING_STATE_ASSUMED from making planQuality.state = 'policy_degraded'.
  // This matches the GoalPolicy.test.ts trusted-state baseline exactly.
  const CLEAN_ACTIONS = [
    { id: 'a1', actionType: 'preparation', dependencies: [] },
    { id: 'a2', actionType: 'execution', dependencies: ['a1'] },
  ];
  const CLEAN_DELIVERABLES = [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }];

  it('market_dependent authority caps posTrust to provisional', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-authority',
      rawGoalText: 'Publish 6 podcast episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2027-08-01',
    });
    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-authority',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-gum-authority', 'Publish 6 podcast episodes from scratch by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: CLEAN_DELIVERABLES,
      canonicalActions: CLEAN_ACTIONS,
      canonicalExecutionEvents: [],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      outcomeAuthorityClass: 'market_dependent',
    });

    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_TRUST_PROVISIONAL_AUTHORITY_CEILING');
  });

  it('fully_controllable authority does not get authority ceiling reason code', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-fc-authority',
      rawGoalText: 'Publish 6 podcast episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2027-08-01',
    });
    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-fc-authority',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-fc-authority', 'Publish 6 podcast episodes from scratch by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: CLEAN_DELIVERABLES,
      canonicalActions: CLEAN_ACTIONS,
      canonicalExecutionEvents: [],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      outcomeAuthorityClass: 'fully_controllable',
    });

    expect(policy.posTrust.reasonCodes).not.toContain('POS_TRUST_PROVISIONAL_AUTHORITY_CEILING');
  });

  it('externally_mediated authority also caps posTrust to provisional', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-em-authority',
      rawGoalText: 'Publish 6 podcast episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2027-08-01',
    });
    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-em-authority',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-em-authority', 'Publish 6 podcast episodes from scratch by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: CLEAN_DELIVERABLES,
      canonicalActions: CLEAN_ACTIONS,
      canonicalExecutionEvents: [],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      outcomeAuthorityClass: 'externally_mediated',
    });

    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_TRUST_PROVISIONAL_AUTHORITY_CEILING');
  });
});

// ---------------------------------------------------------------------------
// Box 7: Stability panel reads canonical policy state (integration smoke test)
// ---------------------------------------------------------------------------

describe('Box 7: Live P.O.S. reads from canonical policy state in integration', () => {
  const CYCLE_ID = 'cycle-livepos-integ';
  const GOAL_ID = 'goal-livepos-integ';
  const BLOCK_DATE = '2026-05-02';

  const GUM_BLOCK = {
    id: 'blk-livepos-1',
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

  function buildBaseState() {
    return {
      appTime: { nowISO: `${BLOCK_DATE}T10:30:00.000Z`, activeDayKey: BLOCK_DATE, timeZone: 'UTC', isFollowingNow: true },
      today: { date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK }] },
      currentWeek: {
        weekStart: BLOCK_DATE,
        days: [{ date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK }] }],
      },
      cycle: [{ date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK }] }],
      ledger: [],
      executionEvents: [],
      suggestionEvents: [],
      proposedBlocks: [],
      suggestedBlocks: [],
      blockStore: { blocks: { [GUM_BLOCK.id]: { ...GUM_BLOCK } } },
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
        goalText: 'Launch caffeinated functional energy gum brand',
        terminalOutcome: {
          text: 'Caffeinated energy gum product launched',
          verificationCriteria: 'First cold sale confirmed.',
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
            goalText: 'Launch caffeinated functional energy gum brand',
            terminalOutcome: {
              text: 'Caffeinated energy gum product launched',
              verificationCriteria: 'First cold sale confirmed.',
              isConcrete: true,
            },
            startDayKey: '2026-05-01',
            endDayKey: '2027-08-01',
            goalIntakeContract: {
              terminalOutcomeAuthority: { authority: 'market_dependent', reasons: ['THRESHOLD_METRIC_DETECTED'], confidence: 'medium' },
            },
          },
          actions: CANONICAL_ACTIONS,
          executionEvents: [],
          metrics: {},
        },
      },
      lastPlanError: null,
    };
  }

  it('goalPolicyByGoalId is populated after computeDerivedState', () => {
    const state = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const policy = (state as any).goalPolicyByGoalId?.[GOAL_ID];
    expect(policy).toBeDefined();
    expect(policy?.livePos).toBeDefined();
  });

  it('livePos is withheld before any execution events', () => {
    const state = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const policy = (state as any).goalPolicyByGoalId?.[GOAL_ID];
    expect(policy?.livePos?.state).toBe('withheld');
  });

  it('posTrust is not trusted for market_dependent gum goal after COMPLETE_BLOCK', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id });
    const policy = (after as any).goalPolicyByGoalId?.[GOAL_ID];
    // market_dependent authority ceiling ensures posTrust never reaches 'trusted'
    // (withheld or provisional both satisfy this; unit tests in Box 6 verify the specific reason code)
    expect(policy?.posTrust?.state).not.toBe('trusted');
  });
});

// ---------------------------------------------------------------------------
// Box 8: Feasibility, Execution correction, and Live P.O.S. remain separate
// ---------------------------------------------------------------------------

describe('Box 8: Panel separation — feasibility, correction, and livePos are independent', () => {
  it('feasibility.state is not derived from livePos', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-separation',
      rawGoalText: 'Launch caffeinated functional energy gum brand',
      verificationCriteria: 'First cold sale confirmed',
      executionType: 'ProductLaunch',
      deadline: '2027-08-01',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-separation',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-gum-separation', 'Launch caffeinated functional energy gum brand'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: CANONICAL_DELIVERABLES,
      canonicalActions: CANONICAL_ACTIONS,
      canonicalExecutionEvents: [
        makeLinkedCompleteEvent('blk-1', 'brand:00:01:investigate-gum-category', '2026-05-02', 'goal-gum-separation', 'cycle-gum'),
      ],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      executionCorrectionState: 'on_track',
    });

    // livePos can be provisional while feasibility remains withheld/provisional
    expect(policy.livePos.state).toBe('provisional');
    // feasibility has its own state, not derived from livePos
    expect(typeof policy.feasibility.state).toBe('string');
    // correction state does not appear in feasibility
    expect(policy.feasibility).not.toHaveProperty('correctionState');
  });

  it('executionCorrection lives on executionCorrectionByGoal, not on livePos directly', () => {
    const CYCLE_ID = 'cycle-sep-test';
    const GOAL_ID = 'goal-sep-test';
    const BLOCK_DATE = '2026-05-02';

    const GUM_BLOCK = {
      id: 'blk-sep-1',
      cycleId: CYCLE_ID,
      goalId: GOAL_ID,
      origin: 'schedule_active' as const,
      actionId: 'brand:00:01:investigate-gum-category',
      title: 'Investigate gum',
      label: 'Investigate gum',
      practice: 'Focus',
      domain: 'Focus',
      start: `${BLOCK_DATE}T09:00:00.000Z`,
      end: `${BLOCK_DATE}T10:00:00.000Z`,
      status: 'planned' as const,
      requiredSystemBlock: true,
    };

    const baseState = {
      appTime: { nowISO: `${BLOCK_DATE}T10:30:00.000Z`, activeDayKey: BLOCK_DATE, timeZone: 'UTC', isFollowingNow: true },
      today: { date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK }] },
      currentWeek: { weekStart: BLOCK_DATE, days: [{ date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK }] }] },
      cycle: [{ date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK }] }],
      ledger: [],
      executionEvents: [],
      suggestionEvents: [],
      proposedBlocks: [],
      suggestedBlocks: [],
      blockStore: { blocks: { [GUM_BLOCK.id]: { ...GUM_BLOCK } } },
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
        goalText: 'Launch gum brand',
        terminalOutcome: { text: 'Launched', verificationCriteria: 'First sale.', isConcrete: true },
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
            goalText: 'Launch gum brand',
            terminalOutcome: { text: 'Launched', verificationCriteria: 'First sale.', isConcrete: true },
            startDayKey: '2026-05-01',
            endDayKey: '2027-08-01',
          },
          actions: CANONICAL_ACTIONS,
          executionEvents: [],
          metrics: {},
        },
      },
      lastPlanError: null,
    };

    const base = computeDerivedState(baseState as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id }) as any;

    // executionCorrectionByGoal is a separate state field
    expect(after.executionCorrectionByGoal?.[GOAL_ID]).toBeDefined();
    // livePos is on goalPolicyByGoalId, not on executionCorrectionByGoal
    expect(after.goalPolicyByGoalId?.[GOAL_ID]?.livePos).toBeDefined();
    // They are independent structures
    expect(after.executionCorrectionByGoal?.[GOAL_ID]).not.toHaveProperty('livePos');
    expect(after.goalPolicyByGoalId?.[GOAL_ID]?.livePos).not.toHaveProperty('correctionState');
  });
});
