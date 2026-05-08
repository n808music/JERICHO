import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildLiveShapeState() {
  const cycleId = 'cycle-live-tail-1';
  const goalId = 'goal-live-tail-1';
  const dayKey = '2026-04-13';
  const goalText = 'Launch a marketable Jericho v1 platform';
  const verificationCriteria =
    'marketable Jericho v1 has value proposition, landing page, user validation, traction evidence, and launch review';

  return {
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: {
      weeklyWindows: {
        MON: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        TUE: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        WED: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        THU: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        FRI: [{ startHHMM: '09:00', endHHMM: '11:00' }],
      },
    },
    deliverablesByCycleId: {
      [cycleId]: {
        cycleId,
        deliverables: [
          { id: 'd1', title: 'Jericho v1 value proposition', actionIds: ['a1'] },
          { id: 'd2', title: 'Jericho v1 landing page and waitlist funnel', actionIds: ['a2'] },
          { id: 'd3', title: 'Jericho v1 user validation and traction evidence', actionIds: ['a3'] },
        ],
        suggestionLinks: {},
        lastUpdatedAtISO: `${dayKey}T12:00:00.000Z`,
      },
    },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: {
          goalId,
          goalText,
          goalLabel: goalText,
          executionType: 'VentureLaunch',
          startDayKey: '2026-04-13',
          endDayKey: '2027-04-12',
          terminalOutcome: {
            text: goalText,
            verificationCriteria,
          },
          goalIntakeContract: {
            readiness: { isReadyForPlanning: true },
            requiredContextQuestions: [],
          },
        },
        planProof: {
          workableDaysRemaining: 260,
          totalRequiredUnits: 5,
          requiredPacePerDay: 0,
          maxPerDay: 1,
          maxPerWeek: 5,
        },
        actions: [
          { id: 'a1', title: 'Define Jericho v1 value proposition', estimateMin: 60 },
          { id: 'a2', title: 'Build Jericho v1 landing page and waitlist funnel', estimateMin: 60 },
          { id: 'a3', title: 'Validate Jericho v1 users and traction evidence', estimateMin: 60 },
        ],
        llmSessionPlan: [
          {
            date: '2026-04-20',
            startTime: '09:00',
            durationMinutes: 60,
            title: 'Define Jericho v1 value proposition',
            deliverableId: 'd1',
            actionId: 'a1',
          },
          {
            date: '2026-06-15',
            startTime: '09:00',
            durationMinutes: 60,
            title: 'Build Jericho v1 landing page and waitlist funnel',
            deliverableId: 'd2',
            actionId: 'a2',
          },
          {
            date: '2026-08-03',
            startTime: '09:00',
            durationMinutes: 60,
            title: 'Build Jericho v1 customer outreach list',
            deliverableId: 'd2',
            actionId: 'a2',
          },
          {
            date: '2026-09-21',
            startTime: '09:00',
            durationMinutes: 60,
            title: 'Run Jericho v1 first-user validation loop',
            deliverableId: 'd3',
            actionId: 'a3',
          },
          {
            date: '2026-11-09',
            startTime: '09:00',
            durationMinutes: 60,
            title: 'Compile Jericho v1 traction evidence and launch next-step review',
            deliverableId: 'd3',
            actionId: 'a3',
          },
        ],
      },
    },
    activeCycleId: cycleId,
    activeGoalId: goalId,
    goalExecutionContract: { goalId, goalText, startDayKey: '2026-04-13', endDayKey: '2027-04-12' },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    lastPlanError: null,
  };
}

describe('GENERATE_PLAN long-horizon live-shape tail materialization', () => {
  it('generates and applies a final-horizon checkpoint while preserving lineage into review blocks', () => {
    const generated = computeDerivedState(buildLiveShapeState(), {
      type: 'GENERATE_PLAN',
      payload: { cycleId: 'cycle-live-tail-1' },
    });
    const proposed = generated.proposedBlocks || [];
    const proposedClosure = proposed.find((block) => /terminal closure checkpoint/i.test(block.title));

    expect(proposedClosure).toBeTruthy();
    expect(proposedClosure.dayKey >= '2027-02-01').toBe(true);
    expect(proposedClosure.deliverableId).toBe('d3');
    expect(proposedClosure.actionId).toBe('a3');
    expect(generated.cyclesById['cycle-live-tail-1'].planQualityGate.failureCodes).not.toContain(
      'LONG_HORIZON_UNJUSTIFIED_TAIL_GAP'
    );
    expect(generated.cyclesById['cycle-live-tail-1'].planQualityGate.failureCodes).not.toContain(
      'ACTION_LINEAGE_BROKEN'
    );

    const applied = computeDerivedState(generated, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-live-tail-1' },
    });
    const reviewClosure = (applied.cyclesById['cycle-live-tail-1'].scheduleReviewBlocks || []).find((block) =>
      /terminal closure checkpoint/i.test(block.title)
    );

    expect(reviewClosure).toBeTruthy();
    expect((reviewClosure.start || '').slice(0, 10) >= '2027-02-01').toBe(true);
    expect(reviewClosure.deliverableId).toBe('d3');
    expect(reviewClosure.actionId).toBe('a3');
    expect(applied.cyclesById['cycle-live-tail-1'].planQualityGate.failureCodes).not.toContain(
      'LONG_HORIZON_UNJUSTIFIED_TAIL_GAP'
    );
    expect(applied.cyclesById['cycle-live-tail-1'].planQualityGate.failureCodes).not.toContain('ACTION_LINEAGE_BROKEN');
  });
});
