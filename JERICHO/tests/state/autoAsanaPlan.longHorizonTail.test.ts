import { describe, expect, it } from 'vitest';
import { evaluatePlanQualityGate } from '../../src/domain/planQuality/evaluatePlanQualityGate.ts';
import { compileAutoAsanaPlan } from '../../src/state/engine/autoAsanaPlan.ts';

const sessionPlan = [
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
];

const actionSequence = [
  { id: 'a1', title: 'Define Jericho v1 value proposition', deliverableId: 'd1' },
  { id: 'a2', title: 'Build Jericho v1 landing page and waitlist funnel', deliverableId: 'd2' },
  { id: 'a3', title: 'Validate Jericho v1 users and traction evidence', deliverableId: 'd3' },
];

function compileTailPlan({ longHorizonNonRecurring = true, earlyCompletionJustification = null } = {}) {
  return compileAutoAsanaPlan({
    goalId: 'goal-long-tail-1',
    cycleId: 'cycle-long-tail-1',
    planProof: {
      workableDaysRemaining: 260,
      totalRequiredUnits: 5,
      requiredPacePerDay: 1,
      maxPerDay: 2,
      maxPerWeek: 5,
      slackUnits: 0,
      slackRatio: 0,
      intensityRatio: 0.25,
    },
    constraints: {
      timezone: 'UTC',
      longHorizonNonRecurring,
      earlyCompletionJustification,
      weeklyWindows: {
        MON: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        TUE: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        WED: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        THU: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        FRI: [{ startHHMM: '09:00', endHHMM: '11:00' }],
      },
      cycleStartDayKey: '2026-04-13',
      cycleEndDayKey: '2027-04-12',
    },
    nowISO: '2026-04-13T12:00:00.000Z',
    horizonDays: 365,
    acceptedBlocks: [],
    actionSequence,
    sessionPlan,
  });
}

function evaluateTailPlan(plan: ReturnType<typeof compileTailPlan>) {
  return evaluatePlanQualityGate({
    goalText: 'Launch a marketable Jericho v1 platform',
    verificationText:
      'marketable Jericho v1 has value proposition, landing page, user validation, traction evidence, and launch review',
    deliverables: [
      { id: 'd1', title: 'Jericho v1 value proposition', actionIds: ['a1'] },
      { id: 'd2', title: 'Jericho v1 landing page and waitlist funnel', actionIds: ['a2'] },
      { id: 'd3', title: 'Jericho v1 user validation and traction evidence', actionIds: ['a3'] },
    ],
    actions: actionSequence,
    proposedBlocks: plan.horizonBlocks.map((block) => ({
      id: block.id,
      title: block.title,
      deliverableId: block.deliverableId,
      actionId: block.actionId,
      dayKey: block.dayKey,
    })),
    temporalContext: {
      contractStartDayKey: '2026-04-13',
      contractEndDayKey: '2027-04-12',
    },
  });
}

describe('autoAsanaPlan long-horizon tail materialization', () => {
  it('materializes a final-horizon closure checkpoint for non-recurring long-horizon plans with empty tails', () => {
    const plan = compileTailPlan({ longHorizonNonRecurring: true });
    const dayKeys = plan.horizonBlocks.map((block) => block.dayKey).sort();
    const closureBlock = plan.horizonBlocks.find((block) => /terminal closure checkpoint/i.test(block.title));

    expect(plan.horizonBlocks).toHaveLength(6);
    expect(closureBlock).toBeTruthy();
    expect(closureBlock?.dayKey >= '2027-02-01').toBe(true);
    expect(dayKeys[dayKeys.length - 1] >= '2027-02-01').toBe(true);

    const gate = evaluateTailPlan(plan);
    expect(gate.failureCodes).not.toContain('LONG_HORIZON_UNJUSTIFIED_TAIL_GAP');
    expect(gate.failureCodes).not.toContain('LONG_HORIZON_TEMPORAL_COMPRESSION');
  });

  it('does not materialize final-horizon closure for recurring or cadence plans without the non-recurring flag', () => {
    const plan = compileTailPlan({ longHorizonNonRecurring: false });

    expect(plan.horizonBlocks).toHaveLength(5);
    expect(plan.horizonBlocks.some((block) => /terminal closure checkpoint/i.test(block.title))).toBe(false);
    expect(evaluateTailPlan(plan).failureCodes).toContain('LONG_HORIZON_UNJUSTIFIED_TAIL_GAP');
  });

  it('does not materialize final-horizon closure when explicit early-completion justification exists', () => {
    const plan = compileTailPlan({
      longHorizonNonRecurring: true,
      earlyCompletionJustification: 'Core launch closes early and remaining contract time is deliberate buffer.',
    });

    expect(plan.horizonBlocks).toHaveLength(5);
    expect(plan.horizonBlocks.some((block) => /terminal closure checkpoint/i.test(block.title))).toBe(false);
  });
});
