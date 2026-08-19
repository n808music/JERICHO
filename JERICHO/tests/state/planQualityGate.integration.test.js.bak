import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildBaseState() {
  return {
    today: {
      date: '2026-03-21',
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: '2026-03-21', days: [], metrics: {} },
    cycle: [],
    viewDate: '2026-03-21',
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: false },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    aspirations: [],
    aspirationsByCycleId: {},
    cyclesById: {},
    cycleOrder: [],
    activeCycleId: 'cycle-quality-1',
    appTime: {
      timeZone: 'UTC',
      nowISO: '2026-03-21T12:00:00.000Z',
      activeDayKey: '2026-03-21',
      isFollowingNow: true,
    },
    constraints: { maxBlocksPerDay: 4, maxBlocksPerWeek: 16 },
    goalAdmissionByGoal: { 'goal-quality-1': { status: 'ADMITTED' } },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    deliverablesByCycleId: {},
  };
}

function attachCycle(state, { deliverables, actions, proposedBlocks, goalContract = {} }) {
  state.cyclesById['cycle-quality-1'] = {
    id: 'cycle-quality-1',
    status: 'ACTIVE',
    startedAtDayKey: '2026-03-21',
    goalContract: {
      goalId: 'goal-quality-1',
      goalText: 'Start a podcast',
      goalLabel: 'Start a podcast',
      terminalOutcome: {
        text: 'Start a podcast',
        verificationCriteria: '6 episodes recorded and edited for release',
      },
      deadline: { dayKey: '2026-06-30' },
      ...goalContract,
    },
    canonicalDeliverables: deliverables,
    actions,
    proposedBlocks,
    suggestedBlocks: proposedBlocks,
  };
  state.deliverablesByCycleId['cycle-quality-1'] = { deliverables };
  return state;
}

function addDaysUTC(dayKey, days) {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('plan quality gate integration', () => {
  it('withholds feasibility when the plan quality gate fails', () => {
    const state = attachCycle(buildBaseState(), {
      deliverables: [{ id: 'd1', title: 'Record and edit episode set', actionIds: ['a1'] }],
      actions: [{ id: 'a1', title: 'Record and edit episode set', deliverableId: 'd1', estimateMin: 60 }],
      proposedBlocks: [{ id: 'b1', title: 'review notes', deliverableId: 'd1', actionId: 'a1', status: 'suggested' }],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });

    expect(next.cyclesById['cycle-quality-1'].planQualityGate.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(next.feasibilityByGoal['goal-quality-1'].status).toBe('WITHHELD');
    expect(next.feasibilityByGoal['goal-quality-1'].reasons).toContain(
      'FEASIBILITY_NOT_ADMITTED_PLAN_QUALITY_WITHHELD'
    );
  });

  it('withholds POS when the plan quality gate fails', () => {
    const state = attachCycle(buildBaseState(), {
      deliverables: [{ id: 'd1', title: 'Record episode 1', actionIds: [] }],
      actions: [],
      proposedBlocks: [],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });

    expect(next.cyclesById['cycle-quality-1'].planQualityGate.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(next.probabilityByGoal['goal-quality-1'].admissionStatus).toBe('withheld');
    expect(next.probabilityByGoal['goal-quality-1'].reasons).toContain('POS_NOT_ADMITTED_PLAN_QUALITY_WITHHELD');
  });

  it('branch coverage wiring: no failure codes when all declared branches have block coverage', () => {
    const state = attachCycle(buildBaseState(), {
      deliverables: [
        { id: 'd1', title: 'podcast show format', actionIds: ['a1'] },
        { id: 'd2', title: 'podcast episode recording', actionIds: ['a2'] },
      ],
      actions: [
        { id: 'a1', title: 'podcast show format', deliverableId: 'd1', estimateMin: 60 },
        { id: 'a2', title: 'podcast episode recording', deliverableId: 'd2', estimateMin: 60 },
      ],
      proposedBlocks: [
        { id: 'b1', title: 'podcast show format session', deliverableId: 'd1', actionId: 'a1', status: 'suggested' },
        {
          id: 'b2',
          title: 'podcast episode recording session',
          deliverableId: 'd2',
          actionId: 'a2',
          status: 'suggested',
        },
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const failureCodes = next.cyclesById['cycle-quality-1'].planQualityGate.failureCodes;

    expect(failureCodes).not.toContain('PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH');
    expect(failureCodes).not.toContain('PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE');
  });

  it('branch coverage wiring: MISSING_DELIVERABLE_BRANCH fires when scheduling has started but a declared branch has no blocks', () => {
    // Scheduling is active (one block exists), but d2 has an action and no block coverage
    const state = attachCycle(buildBaseState(), {
      deliverables: [
        { id: 'd1', title: 'podcast show format', actionIds: ['a1'] },
        { id: 'd2', title: 'podcast episode recording', actionIds: ['a2'] },
      ],
      actions: [
        { id: 'a1', title: 'podcast show format', deliverableId: 'd1', estimateMin: 60 },
        { id: 'a2', title: 'podcast episode recording', deliverableId: 'd2', estimateMin: 60 },
      ],
      proposedBlocks: [
        // d1 is covered — scheduling has started
        { id: 'b1', title: 'podcast show format session', deliverableId: 'd1', actionId: 'a1', status: 'suggested' },
        // d2 has action a2 but no block — declared branch without coverage
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const gate = next.cyclesById['cycle-quality-1'].planQualityGate;

    expect(gate.failureCodes).toContain('PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH');
    expect(gate.meta?.missingDeliverableBranches).toContain('d2');
    expect(gate.meta?.missingDeliverableBranches).not.toContain('d1');
  });

  it('branch coverage wiring: empty deliverables (no actions) are excluded from declared branches and do not fail', () => {
    // Scheduling is active (one block exists), d1 has action+block (covered),
    // d2 has no actions (excluded), d3 has action but no block (the only missing branch)
    const state = attachCycle(buildBaseState(), {
      deliverables: [
        { id: 'd1', title: 'podcast show format', actionIds: ['a1'] }, // has action + block
        { id: 'd2', title: 'podcast empty branch', actionIds: [] }, // no actions — excluded
        { id: 'd3', title: 'podcast episode recording', actionIds: ['a3'] }, // has action, no block
      ],
      actions: [
        { id: 'a1', title: 'podcast show format', deliverableId: 'd1', estimateMin: 60 },
        { id: 'a3', title: 'podcast episode recording', deliverableId: 'd3', estimateMin: 60 },
      ],
      proposedBlocks: [
        { id: 'b1', title: 'podcast show format session', deliverableId: 'd1', actionId: 'a1', status: 'suggested' },
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const gate = next.cyclesById['cycle-quality-1'].planQualityGate;

    expect(gate.failureCodes).toContain('PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH');
    expect(gate.meta?.missingDeliverableBranches).toContain('d3');
    expect(gate.meta?.missingDeliverableBranches).not.toContain('d1');
    expect(gate.meta?.missingDeliverableBranches).not.toContain('d2');
  });

  it('branch coverage wiring: PARTIAL_SCOPE_COLLAPSE fires when majority covered but one action-bearing branch is dropped', () => {
    const state = attachCycle(buildBaseState(), {
      deliverables: [
        { id: 'd1', title: 'podcast show format', actionIds: ['a1'] },
        { id: 'd2', title: 'podcast episode recording', actionIds: ['a2'] },
        { id: 'd3', title: 'podcast audience strategy', actionIds: ['a3'] },
      ],
      actions: [
        { id: 'a1', title: 'podcast show format', deliverableId: 'd1', estimateMin: 60 },
        { id: 'a2', title: 'podcast episode recording', deliverableId: 'd2', estimateMin: 60 },
        { id: 'a3', title: 'podcast audience strategy', deliverableId: 'd3', estimateMin: 60 },
      ],
      proposedBlocks: [
        { id: 'b1', title: 'podcast show format session', deliverableId: 'd1', actionId: 'a1', status: 'suggested' },
        {
          id: 'b2',
          title: 'podcast episode recording session',
          deliverableId: 'd2',
          actionId: 'a2',
          status: 'suggested',
        },
        // d3 has action a3 but no blocks — silently dropped while d1 and d2 appear scheduled
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const gate = next.cyclesById['cycle-quality-1'].planQualityGate;

    expect(gate.failureCodes).toContain('PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE');
    expect(gate.meta?.missingDeliverableBranches).toContain('d3');
    expect(gate.meta?.missingDeliverableBranches).not.toContain('d1');
    expect(gate.meta?.missingDeliverableBranches).not.toContain('d2');
  });

  it('withholds feasibility when surfaced block labels lose the goal object', () => {
    const state = attachCycle(buildBaseState(), {
      deliverables: [{ id: 'd1', title: 'Film podcast episode 1', actionIds: ['a1'] }],
      actions: [{ id: 'a1', title: 'Film podcast episode 1', deliverableId: 'd1', estimateMin: 60 }],
      proposedBlocks: [
        { id: 'b1', title: 'production session', deliverableId: 'd1', actionId: 'a1', status: 'suggested' },
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });

    expect(next.cyclesById['cycle-quality-1'].planQualityGate.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(next.cyclesById['cycle-quality-1'].planQualityGate.failureCodes).toContain('BLOCK_GOAL_OBJECT_MISSING');
    expect(next.feasibilityByGoal['goal-quality-1'].status).toBe('WITHHELD');
  });

  it('wires long-horizon temporal compression into the cycle plan quality gate', () => {
    const state = attachCycle(buildBaseState(), {
      goalContract: {
        goalText: 'Ship Jericho v1 platform',
        goalLabel: 'Ship Jericho v1 platform',
        startDayKey: '2026-01-05',
        terminalOutcome: {
          text: 'Ship Jericho v1 platform',
          verificationCriteria:
            'Jericho v1 platform shipped with onboarding, scheduler, dashboard, and validation ready',
        },
        deadline: { dayKey: '2027-01-04' },
      },
      deliverables: [
        { id: 'd1', title: 'Jericho v1 onboarding system', actionIds: ['a1'] },
        { id: 'd2', title: 'Jericho v1 scheduler system', actionIds: ['a2'] },
        { id: 'd3', title: 'Jericho v1 dashboard validation', actionIds: ['a3'] },
      ],
      actions: [
        { id: 'a1', title: 'Build Jericho v1 onboarding system', deliverableId: 'd1', estimateMin: 60 },
        { id: 'a2', title: 'Build Jericho v1 scheduler system', deliverableId: 'd2', estimateMin: 60 },
        { id: 'a3', title: 'Validate Jericho v1 dashboard', deliverableId: 'd3', estimateMin: 60 },
      ],
      proposedBlocks: [
        {
          id: 'b1',
          title: 'Build Jericho v1 onboarding system',
          deliverableId: 'd1',
          actionId: 'a1',
          status: 'suggested',
          dayKey: '2026-01-05',
        },
        {
          id: 'b2',
          title: 'Build Jericho v1 scheduler system',
          deliverableId: 'd2',
          actionId: 'a2',
          status: 'suggested',
          dayKey: '2026-01-19',
        },
        {
          id: 'b3',
          title: 'Validate Jericho v1 dashboard',
          deliverableId: 'd3',
          actionId: 'a3',
          status: 'suggested',
          dayKey: '2026-02-02',
        },
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const gate = next.cyclesById['cycle-quality-1'].planQualityGate;

    expect(gate.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(gate.failureCodes).toContain('LONG_HORIZON_TEMPORAL_COMPRESSION');
    expect(gate.meta?.temporalDistribution?.lastScheduledDayKey).toBe('2026-02-02');
    expect(next.feasibilityByGoal['goal-quality-1'].status).toBe('WITHHELD');
  });

  it('wires long-horizon unjustified tail gaps into the cycle plan quality gate', () => {
    const state = attachCycle(buildBaseState(), {
      goalContract: {
        goalText: 'Launch a marketable Jericho v1 platform',
        goalLabel: 'Launch a marketable Jericho v1 platform',
        startDayKey: '2026-04-13',
        terminalOutcome: {
          text: 'Launch a marketable Jericho v1 platform',
          verificationCriteria:
            'marketable Jericho v1 has value proposition, landing page, user validation, traction evidence, and launch review',
        },
        deadline: { dayKey: '2027-04-12' },
      },
      deliverables: [
        { id: 'd1', title: 'Jericho v1 value proposition', actionIds: ['a1'] },
        { id: 'd2', title: 'Jericho v1 landing page and waitlist funnel', actionIds: ['a2'] },
        { id: 'd3', title: 'Jericho v1 user validation and traction evidence', actionIds: ['a3'] },
      ],
      actions: [
        { id: 'a1', title: 'Define Jericho v1 value proposition', deliverableId: 'd1', estimateMin: 60 },
        {
          id: 'a2',
          title: 'Build Jericho v1 landing page and waitlist funnel',
          deliverableId: 'd2',
          estimateMin: 60,
        },
        {
          id: 'a3',
          title: 'Validate Jericho v1 users and traction evidence',
          deliverableId: 'd3',
          estimateMin: 60,
        },
      ],
      proposedBlocks: [
        {
          id: 'b1',
          title: 'Define Jericho v1 value proposition',
          deliverableId: 'd1',
          actionId: 'a1',
          status: 'suggested',
          dayKey: '2026-04-20',
        },
        {
          id: 'b2',
          title: 'Build Jericho v1 landing page and waitlist funnel',
          deliverableId: 'd2',
          actionId: 'a2',
          status: 'suggested',
          dayKey: '2026-06-15',
        },
        {
          id: 'b3',
          title: 'Build Jericho v1 customer outreach list',
          deliverableId: 'd2',
          actionId: 'a2',
          status: 'suggested',
          dayKey: '2026-08-03',
        },
        {
          id: 'b4',
          title: 'Run Jericho v1 first-user validation loop',
          deliverableId: 'd3',
          actionId: 'a3',
          status: 'suggested',
          dayKey: '2026-09-21',
        },
        {
          id: 'b5',
          title: 'Compile Jericho v1 traction evidence and launch next-step review',
          deliverableId: 'd3',
          actionId: 'a3',
          status: 'suggested',
          dayKey: '2026-11-09',
        },
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const gate = next.cyclesById['cycle-quality-1'].planQualityGate;

    expect(gate.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(gate.failureCodes).toContain('LONG_HORIZON_UNJUSTIFIED_TAIL_GAP');
    expect(gate.failureCodes).not.toContain('LONG_HORIZON_TEMPORAL_COMPRESSION');
    expect(gate.meta?.temporalDistribution?.lastScheduledDayKey).toBe('2026-11-09');
    expect(next.feasibilityByGoal['goal-quality-1'].status).toBe('WITHHELD');
  });

  it('wires sparse commercial launch cadence gaps into the cycle plan quality gate', () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const deliverables = [
      {
        id: 'd1',
        title: 'Finalize caffeinated gum formula, sample approval, packaging, sourcing, and sellable unit readiness',
        actionIds: ['a1'],
      },
      {
        id: 'd2',
        title: 'Set caffeinated gum offer, pricing, product page, checkout, ordering, and fulfillment path',
        actionIds: ['a2'],
      },
      {
        id: 'd3',
        title: 'Create caffeinated gum positioning, launch messaging, campaign assets, and sales CTA',
        actionIds: ['a3'],
      },
      {
        id: 'd4',
        title: 'Activate caffeinated gum first-sales outreach to initial buyers and track first order attempts',
        actionIds: ['a4'],
      },
      {
        id: 'd5',
        title: 'Review caffeinated gum first-sales evidence, conversion results, and next-step decision',
        actionIds: ['a5'],
      },
    ];
    const actions = deliverables.map((deliverable, index) => ({
      id: `a${index + 1}`,
      title: deliverable.title,
      deliverableId: deliverable.id,
      estimateMin: 60,
    }));
    const proposedBlocks = Array.from({ length: 53 }).map((_, index) => {
      const actionIndex = Math.min(actions.length - 1, Math.floor(index / 11));
      return {
        id: `b${index + 1}`,
        title: actions[actionIndex].title,
        deliverableId: deliverables[actionIndex].id,
        actionId: actions[actionIndex].id,
        status: 'suggested',
        dayKey: addDaysUTC('2026-01-01', index * 7),
      };
    });
    const state = attachCycle(buildBaseState(), {
      goalContract: {
        goalText,
        goalLabel: goalText,
        startDayKey: '2026-01-01',
        terminalOutcome: {
          text: goalText,
          verificationCriteria:
            'Caffeinated gum formula, packaging, sourcing, purchase path, first real sales, and sales evidence review completed.',
        },
        deadline: { dayKey: '2026-12-31' },
      },
      deliverables,
      actions,
      proposedBlocks,
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const gate = next.cyclesById['cycle-quality-1'].planQualityGate;

    expect(gate.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(gate.failureCodes).toContain('LONG_HORIZON_SPARSE_CADENCE');
    expect(gate.failureCodes).toContain('LONG_HORIZON_WORK_GAPS');
    expect(next.feasibilityByGoal['goal-quality-1'].status).toBe('WITHHELD');
  });
});
