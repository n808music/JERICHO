import { describe, expect, it } from 'vitest';
import { evaluatePlanQualityGate } from '../../../src/domain/planQuality/evaluatePlanQualityGate.ts';

function addDaysUTC(dayKey: string, days: number) {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function gumCommercialDeliverables() {
  return [
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
}

function actionsForDeliverables(deliverables: Array<{ id: string; title: string }>) {
  return deliverables.map((deliverable, index) => ({
    id: `a${index + 1}`,
    title: deliverable.title,
    deliverableId: deliverable.id,
  }));
}

function blocksForDates(
  dates: string[],
  deliverables: Array<{ id: string; title: string }>,
  actions: Array<{ id: string; title: string }>
) {
  return dates.map((dayKey, index) => {
    const actionIndex = Math.min(actions.length - 1, Math.floor((index * actions.length) / Math.max(1, dates.length)));
    return {
      id: `b${index + 1}`,
      title: actions[actionIndex].title,
      deliverableId: deliverables[actionIndex].id,
      actionId: actions[actionIndex].id,
      dayKey,
    };
  });
}

function commercialShellBlocksForDates(dates: string[]) {
  const deliverables = gumCommercialDeliverables();
  const actions = actionsForDeliverables(deliverables);
  const shellTitles = [
    'Resolve gum formula, sample, and packaging readiness',
    'Build gum offer, pricing, and checkout path',
    'Build gum launch positioning and messaging assets',
    'Activate first-buyer outreach and first-order attempts',
    'Track buyer responses and conversion attempts',
  ];
  return dates.map((dayKey, index) => {
    const actionIndex = index % actions.length;
    const shellTitle = shellTitles[actionIndex % shellTitles.length];
    return {
      id: `b-shell-${index + 1}`,
      title: `${shellTitle} — Session ${(index % 9) + 1} of 9`,
      deliverableId: deliverables[actionIndex].id,
      actionId: actions[actionIndex].id,
      dayKey,
    };
  });
}

describe('evaluatePlanQualityGate', () => {
  it('passes a complete, specific plan', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Start a podcast',
      verificationText: '6 episodes recorded and edited for release',
      deliverables: [
        { id: 'd1', title: 'Record episode 1', actionIds: ['a1'] },
        { id: 'd2', title: 'Edit episode 1', actionIds: ['a2'] },
        { id: 'd3', title: 'Record episode 2', actionIds: ['a3'] },
        { id: 'd4', title: 'Edit episode 2', actionIds: ['a4'] },
        { id: 'd5', title: 'Record episode 3', actionIds: ['a5'] },
        { id: 'd6', title: 'Edit episode 3', actionIds: ['a6'] },
        { id: 'd7', title: 'Record episode 4', actionIds: ['a7'] },
        { id: 'd8', title: 'Edit episode 4', actionIds: ['a8'] },
        { id: 'd9', title: 'Record episode 5', actionIds: ['a9'] },
        { id: 'd10', title: 'Edit episode 5', actionIds: ['a10'] },
        { id: 'd11', title: 'Record episode 6', actionIds: ['a11'] },
        { id: 'd12', title: 'Edit episode 6', actionIds: ['a12'] },
      ],
      actions: [
        { id: 'a1', title: 'Record episode 1', deliverableId: 'd1' },
        { id: 'a2', title: 'Edit episode 1', deliverableId: 'd2' },
        { id: 'a3', title: 'Record episode 2', deliverableId: 'd3' },
        { id: 'a4', title: 'Edit episode 2', deliverableId: 'd4' },
        { id: 'a5', title: 'Record episode 3', deliverableId: 'd5' },
        { id: 'a6', title: 'Edit episode 3', deliverableId: 'd6' },
        { id: 'a7', title: 'Record episode 4', deliverableId: 'd7' },
        { id: 'a8', title: 'Edit episode 4', deliverableId: 'd8' },
        { id: 'a9', title: 'Record episode 5', deliverableId: 'd9' },
        { id: 'a10', title: 'Edit episode 5', deliverableId: 'd10' },
        { id: 'a11', title: 'Record episode 6', deliverableId: 'd11' },
        { id: 'a12', title: 'Edit episode 6', deliverableId: 'd12' },
      ],
      proposedBlocks: [
        { id: 'b1', title: 'Record episode 1', deliverableId: 'd1', actionId: 'a1' },
        { id: 'b2', title: 'Edit episode 1', deliverableId: 'd2', actionId: 'a2' },
        { id: 'b3', title: 'Record episode 2', deliverableId: 'd3', actionId: 'a3' },
        { id: 'b4', title: 'Edit episode 2', deliverableId: 'd4', actionId: 'a4' },
      ],
    });

    expect(result.status).toBe('PLAN_QUALITY_PASSED');
    expect(result.failureCodes).toEqual([]);
  });

  it('withholds when major episode coverage is missing', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Start a podcast',
      verificationText: '3 episodes recorded and edited for release',
      deliverables: [
        { id: 'd1', title: 'Record episode 1', actionIds: ['a1'] },
        { id: 'd2', title: 'Edit episode 1', actionIds: ['a2'] },
        { id: 'd3', title: 'Record episode 2', actionIds: ['a3'] },
        { id: 'd4', title: 'Edit episode 2', actionIds: ['a4'] },
      ],
      actions: [
        { id: 'a1', title: 'Record episode 1', deliverableId: 'd1' },
        { id: 'a2', title: 'Edit episode 1', deliverableId: 'd2' },
        { id: 'a3', title: 'Record episode 2', deliverableId: 'd3' },
        { id: 'a4', title: 'Edit episode 2', deliverableId: 'd4' },
      ],
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('PLAN_COVERAGE_MISSING_MAJOR_COMPONENT');
    expect(result.meta?.missingMajorComponents).toContain('episode 3');
  });

  it('withholds deliverables that are structurally present but object-missing', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Start a podcast',
      verificationText: '6 episodes recorded and edited for release',
      deliverables: [{ id: 'd1', title: 'Record and edit episode set', actionIds: ['a1'] }],
      actions: [{ id: 'a1', title: 'Record and edit episode set', deliverableId: 'd1' }],
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('DELIVERABLE_OBJECT_MISSING');
    expect(result.meta?.weakDeliverableIds).toContain('d1');
  });

  it('withholds generic blocks that lose the goal object', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Start a podcast',
      verificationText: '6 episodes recorded and edited for release',
      deliverables: [{ id: 'd1', title: 'Record episode 1', actionIds: ['a1'] }],
      actions: [{ id: 'a1', title: 'Record episode 1', deliverableId: 'd1' }],
      proposedBlocks: [{ id: 'b1', title: 'review notes', deliverableId: 'd1', actionId: 'a1' }],
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('BLOCK_TOO_GENERIC');
    expect(result.meta?.weakBlockIds).toContain('b1');
  });

  it('withholds deliverables that drift away from the goal object', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Start a podcast',
      verificationText: '6 episodes recorded and edited for release',
      deliverables: [{ id: 'd1', title: 'Finalize weekly cadence and stakeholder review', actionIds: ['a1'] }],
      actions: [{ id: 'a1', title: 'Finalize weekly cadence and stakeholder review', deliverableId: 'd1' }],
      proposedBlocks: [{ id: 'b1', title: 'Finalize weekly cadence and stakeholder review', deliverableId: 'd1' }],
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('DELIVERABLE_GOAL_DISCONNECTED');
    expect(result.meta?.goalDisconnectedDeliverableIds).toContain('d1');
  });

  it('withholds semantically hollow deliverables with planning shape but no clear object', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Start a podcast',
      verificationText: '6 episodes recorded and edited for release',
      deliverables: [{ id: 'd1', title: 'Production workflow package', actionIds: ['a1'] }],
      actions: [{ id: 'a1', title: 'Production workflow package', deliverableId: 'd1' }],
      proposedBlocks: [{ id: 'b1', title: 'Production workflow package', deliverableId: 'd1', actionId: 'a1' }],
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('DELIVERABLE_SEMANTIC_HOLLOWNESS');
    expect(result.meta?.semanticHollowDeliverableIds).toContain('d1');
  });

  it('withholds blocks that omit the goal object even when lineage exists', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Start a podcast',
      verificationText: '6 episodes recorded and edited for release',
      deliverables: [{ id: 'd1', title: 'Film podcast episode 1', actionIds: ['a1'] }],
      actions: [{ id: 'a1', title: 'Film podcast episode 1', deliverableId: 'd1' }],
      proposedBlocks: [{ id: 'b1', title: 'production session', deliverableId: 'd1', actionId: 'a1' }],
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('BLOCK_GOAL_OBJECT_MISSING');
    expect(result.meta?.goalObjectMissingBlockIds).toContain('b1');
  });

  it('withholds when declared branches are explicitly required but have no block coverage', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Start a podcast',
      verificationText: 'podcast show published with audience',
      deliverables: [
        { id: 'd1', title: 'podcast show format', actionIds: ['a1'] },
        { id: 'd2', title: 'podcast episode recording', actionIds: ['a2'] },
      ],
      actions: [
        { id: 'a1', title: 'podcast show format', deliverableId: 'd1' },
        { id: 'a2', title: 'podcast episode recording', deliverableId: 'd2' },
      ],
      // branchCoverageSummary explicitly declares both branches as required
      branchCoverageSummary: { declaredBranches: ['d1', 'd2'] },
      // no blocks — structure declared, never scheduled
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH');
    expect(result.meta?.missingDeliverableBranches).toContain('d1');
    expect(result.meta?.missingDeliverableBranches).toContain('d2');
  });

  it('withholds when some deliverable branches are covered and others are silently dropped', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Start a podcast',
      verificationText: 'podcast show published with audience',
      deliverables: [
        { id: 'd1', title: 'podcast show format', actionIds: ['a1'] },
        { id: 'd2', title: 'podcast episode recording', actionIds: ['a2'] },
        { id: 'd3', title: 'podcast audience strategy', actionIds: ['a3'] },
      ],
      actions: [
        { id: 'a1', title: 'podcast show format', deliverableId: 'd1' },
        { id: 'a2', title: 'podcast episode recording', deliverableId: 'd2' },
        { id: 'a3', title: 'podcast audience strategy', deliverableId: 'd3' },
      ],
      proposedBlocks: [
        { id: 'b1', title: 'podcast show format session', deliverableId: 'd1', actionId: 'a1' },
        { id: 'b2', title: 'podcast episode recording session', deliverableId: 'd2', actionId: 'a2' },
        // d3 has action a3 but no blocks — silently dropped while d1 and d2 appear scheduled
      ],
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE');
    expect(result.meta?.missingDeliverableBranches).toContain('d3');
  });

  it('passes coverage checks when all declared deliverable branches have block coverage', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Start a podcast',
      verificationText: 'podcast show published with audience',
      deliverables: [
        { id: 'd1', title: 'podcast show format', actionIds: ['a1'] },
        { id: 'd2', title: 'podcast episode recording', actionIds: ['a2'] },
      ],
      actions: [
        { id: 'a1', title: 'podcast show format', deliverableId: 'd1' },
        { id: 'a2', title: 'podcast episode recording', deliverableId: 'd2' },
      ],
      proposedBlocks: [
        { id: 'b1', title: 'podcast show format session', deliverableId: 'd1', actionId: 'a1' },
        { id: 'b2', title: 'podcast episode recording session', deliverableId: 'd2', actionId: 'a2' },
      ],
    });

    expect(result.status).toBe('PLAN_QUALITY_PASSED');
    expect(result.failureCodes).not.toContain('PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH');
    expect(result.failureCodes).not.toContain('PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE');
  });

  it('does not fire MISSING_DELIVERABLE_BRANCH when declared branch has block coverage via action linkage', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Start a podcast',
      verificationText: 'podcast show published with audience',
      deliverables: [{ id: 'd1', title: 'podcast show format', actionIds: ['a1'] }],
      actions: [{ id: 'a1', title: 'podcast show format', deliverableId: 'd1' }],
      proposedBlocks: [
        // block linked to the action only — no direct deliverableId
        { id: 'b1', title: 'podcast show format session', actionId: 'a1' },
      ],
      // branchCoverageSummary declares d1 as required — via-action block should satisfy it
      branchCoverageSummary: { declaredBranches: ['d1'] },
    });

    expect(result.status).toBe('PLAN_QUALITY_PASSED');
    expect(result.failureCodes).not.toContain('PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH');
    expect(result.failureCodes).not.toContain('PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE');
  });

  it('withholds visible lineage meaning loss when surfaced block labels become generic', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Start a podcast',
      verificationText: '6 episodes recorded and edited for release',
      deliverables: [{ id: 'd1', title: 'Edit podcast episode 1', actionIds: ['a1'] }],
      actions: [{ id: 'a1', title: 'Edit podcast episode 1', deliverableId: 'd1' }],
      proposedBlocks: [{ id: 'b1', title: 'session', deliverableId: 'd1', actionId: 'a1' }],
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('LINEAGE_VISIBLE_MEANING_LOSS');
    expect(result.meta?.meaningLossBlockIds).toContain('b1');
  });

  it('withholds long-horizon non-recurring plans that end in the opening months', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Ship Jericho v1 platform',
      verificationText: 'Jericho v1 platform shipped with onboarding, scheduler, dashboard, and validation ready',
      deliverables: [
        { id: 'd1', title: 'Jericho v1 onboarding system', actionIds: ['a1'] },
        { id: 'd2', title: 'Jericho v1 scheduler system', actionIds: ['a2'] },
        { id: 'd3', title: 'Jericho v1 dashboard validation', actionIds: ['a3'] },
      ],
      actions: [
        { id: 'a1', title: 'Build Jericho v1 onboarding system', deliverableId: 'd1' },
        { id: 'a2', title: 'Build Jericho v1 scheduler system', deliverableId: 'd2' },
        { id: 'a3', title: 'Validate Jericho v1 dashboard', deliverableId: 'd3' },
      ],
      proposedBlocks: [
        {
          id: 'b1',
          title: 'Build Jericho v1 onboarding system',
          deliverableId: 'd1',
          actionId: 'a1',
          dayKey: '2026-01-05',
        },
        {
          id: 'b2',
          title: 'Build Jericho v1 scheduler system',
          deliverableId: 'd2',
          actionId: 'a2',
          dayKey: '2026-01-19',
        },
        { id: 'b3', title: 'Validate Jericho v1 dashboard', deliverableId: 'd3', actionId: 'a3', dayKey: '2026-02-02' },
      ],
      temporalContext: {
        contractStartDayKey: '2026-01-05',
        contractEndDayKey: '2027-01-04',
      },
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('LONG_HORIZON_TEMPORAL_COMPRESSION');
    expect(result.meta?.temporalDistribution?.lastScheduledDayKey).toBe('2026-02-02');
    expect(result.meta?.temporalDistribution?.requiredLatestHorizonRatio).toBe(2 / 3);
  });

  it('passes long-horizon non-recurring plans that reach the later horizon with enough occupied months', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Ship Jericho v1 platform',
      verificationText: 'Jericho v1 platform shipped with onboarding, scheduler, dashboard, and validation ready',
      deliverables: [
        { id: 'd1', title: 'Jericho v1 onboarding system', actionIds: ['a1'] },
        { id: 'd2', title: 'Jericho v1 scheduler system', actionIds: ['a2'] },
        { id: 'd3', title: 'Jericho v1 dashboard validation', actionIds: ['a3'] },
      ],
      actions: [
        { id: 'a1', title: 'Build Jericho v1 onboarding system', deliverableId: 'd1' },
        { id: 'a2', title: 'Build Jericho v1 scheduler system', deliverableId: 'd2' },
        { id: 'a3', title: 'Validate Jericho v1 dashboard', deliverableId: 'd3' },
      ],
      proposedBlocks: [
        {
          id: 'b1',
          title: 'Build Jericho v1 onboarding system',
          deliverableId: 'd1',
          actionId: 'a1',
          dayKey: '2026-01-05',
        },
        {
          id: 'b2',
          title: 'Build Jericho v1 scheduler system',
          deliverableId: 'd2',
          actionId: 'a2',
          dayKey: '2026-03-02',
        },
        { id: 'b3', title: 'Validate Jericho v1 dashboard', deliverableId: 'd3', actionId: 'a3', dayKey: '2026-05-04' },
        {
          id: 'b4',
          title: 'Build Jericho v1 scheduler system',
          deliverableId: 'd2',
          actionId: 'a2',
          dayKey: '2026-06-01',
        },
        {
          id: 'b5',
          title: 'Build Jericho v1 scheduler system',
          deliverableId: 'd2',
          actionId: 'a2',
          dayKey: '2026-07-06',
        },
        { id: 'b6', title: 'Validate Jericho v1 dashboard', deliverableId: 'd3', actionId: 'a3', dayKey: '2026-09-07' },
        { id: 'b7', title: 'Validate Jericho v1 dashboard', deliverableId: 'd3', actionId: 'a3', dayKey: '2026-11-02' },
      ],
      temporalContext: {
        contractStartDayKey: '2026-01-05',
        contractEndDayKey: '2027-01-04',
      },
    });

    expect(result.status).toBe('PLAN_QUALITY_PASSED');
    expect(result.failureCodes).not.toContain('LONG_HORIZON_TEMPORAL_COMPRESSION');
    expect(result.failureCodes).not.toContain('LONG_HORIZON_UNJUSTIFIED_TAIL_GAP');
  });

  it('withholds commercial product launch plans that only schedule one sparse block per week across a long horizon', () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const deliverables = gumCommercialDeliverables();
    const actions = actionsForDeliverables(deliverables);
    const proposedBlocks = blocksForDates(
      Array.from({ length: 53 }).map((_, index) => addDaysUTC('2026-01-01', index * 7)),
      deliverables,
      actions
    );

    const result = evaluatePlanQualityGate({
      goalText,
      verificationText:
        'Caffeinated gum formula, packaging, sourcing, purchase path, first real sales, and sales evidence review completed.',
      deliverables,
      actions,
      proposedBlocks,
      temporalContext: {
        contractStartDayKey: '2026-01-01',
        contractEndDayKey: '2026-12-31',
      },
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('LONG_HORIZON_SPARSE_CADENCE');
    expect(result.failureCodes).toContain('LONG_HORIZON_WORK_GAPS');
    expect(result.meta?.temporalDistribution?.averageBlocksPerWeek).toBeLessThan(2);
    expect(result.meta?.temporalDistribution?.maxInterBlockGapDays).toBeGreaterThan(6);
  });

  it('withholds commercial product launch plans whose surfaced blocks are repeated family shells', () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const deliverables = gumCommercialDeliverables();
    const actions = actionsForDeliverables(deliverables);
    const proposedBlocks = commercialShellBlocksForDates(
      Array.from({ length: 25 }).map((_, index) => addDaysUTC('2026-04-06', index))
    );

    const result = evaluatePlanQualityGate({
      goalText,
      verificationText:
        'Caffeinated gum formula, packaging, sourcing, purchase path, first real sales, and sales evidence review completed.',
      deliverables,
      actions,
      proposedBlocks,
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('COMMERCIAL_BLOCK_SPECIFICITY_WEAK');
    expect(result.failureCodes).not.toContain('LONG_HORIZON_SPARSE_CADENCE');
    expect(result.meta?.commercialBlockSpecificity?.repeatedShellTitleCount).toBeGreaterThan(6);
    expect(result.meta?.weakBlockIds?.length).toBeGreaterThan(6);
  });

  it('withholds commercial product launch plans that occupy only two weekdays across active build weeks', () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const deliverables = gumCommercialDeliverables();
    const actions = actionsForDeliverables(deliverables);
    const dates = Array.from({ length: 52 }).flatMap((_, weekIndex) => [
      addDaysUTC('2026-01-05', weekIndex * 7),
      addDaysUTC('2026-01-05', weekIndex * 7 + 1),
    ]);
    const proposedBlocks = blocksForDates(dates, deliverables, actions);

    const result = evaluatePlanQualityGate({
      goalText,
      verificationText:
        'Caffeinated gum formula, packaging, sourcing, purchase path, first real sales, and sales evidence review completed.',
      deliverables,
      actions,
      proposedBlocks,
      temporalContext: {
        contractStartDayKey: '2026-01-05',
        contractEndDayKey: '2026-12-31',
      },
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('COMMERCIAL_WORK_WINDOW_UNDERUSED');
    expect(result.failureCodes).not.toContain('LONG_HORIZON_SPARSE_CADENCE');
    expect(result.failureCodes).not.toContain('LONG_HORIZON_WORK_GAPS');
    expect(result.meta?.temporalDistribution?.averageActiveWeekdaysPerScheduledWeek).toBeLessThan(3);
  });

  it('does not apply commercial sparse cadence codes to a non-commercial long-horizon plan with the same raw spacing', () => {
    const deliverables = [
      { id: 'd1', title: 'Jericho v1 onboarding system', actionIds: ['a1'] },
      { id: 'd2', title: 'Jericho v1 scheduler system', actionIds: ['a2'] },
      { id: 'd3', title: 'Jericho v1 dashboard validation', actionIds: ['a3'] },
    ];
    const actions = actionsForDeliverables(deliverables);
    const proposedBlocks = blocksForDates(
      Array.from({ length: 53 }).map((_, index) => addDaysUTC('2026-01-01', index * 7)),
      deliverables,
      actions
    );

    const result = evaluatePlanQualityGate({
      goalText: 'Ship Jericho v1 platform',
      verificationText: 'Jericho v1 platform shipped with onboarding, scheduler, dashboard, and validation ready',
      deliverables,
      actions,
      proposedBlocks,
      temporalContext: {
        contractStartDayKey: '2026-01-01',
        contractEndDayKey: '2026-12-31',
      },
    });

    expect(result.status).toBe('PLAN_QUALITY_PASSED');
    expect(result.failureCodes).not.toContain('LONG_HORIZON_SPARSE_CADENCE');
    expect(result.failureCodes).not.toContain('LONG_HORIZON_WORK_GAPS');
  });

  it('isolates commercial work-gap failures when average density is adequate but one inactive span is too large', () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const deliverables = gumCommercialDeliverables();
    const actions = actionsForDeliverables(deliverables);
    const proposedBlocks = blocksForDates(
      [
        ...Array.from({ length: 60 }).map((_, index) => addDaysUTC('2026-01-01', index)),
        ...Array.from({ length: 50 }).map((_, index) => addDaysUTC('2026-09-01', index)),
      ],
      deliverables,
      actions
    );

    const result = evaluatePlanQualityGate({
      goalText,
      verificationText:
        'Caffeinated gum formula, packaging, sourcing, purchase path, first real sales, and sales evidence review completed.',
      deliverables,
      actions,
      proposedBlocks,
      temporalContext: {
        contractStartDayKey: '2026-01-01',
        contractEndDayKey: '2026-12-31',
      },
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('LONG_HORIZON_WORK_GAPS');
    expect(result.failureCodes).not.toContain('LONG_HORIZON_SPARSE_CADENCE');
    expect(result.meta?.temporalDistribution?.averageBlocksPerWeek).toBeGreaterThanOrEqual(2);
    expect(result.meta?.temporalDistribution?.maxInterBlockGapDays).toBeGreaterThan(6);
  });

  it('isolates commercial sparse-cadence failures when density is low but no single work gap is extreme', () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const deliverables = gumCommercialDeliverables();
    const actions = actionsForDeliverables(deliverables);
    const proposedBlocks = blocksForDates(
      Array.from({ length: 70 }).map((_, index) => addDaysUTC('2026-01-01', index * 5)),
      deliverables,
      actions
    );

    const result = evaluatePlanQualityGate({
      goalText,
      verificationText:
        'Caffeinated gum formula, packaging, sourcing, purchase path, first real sales, and sales evidence review completed.',
      deliverables,
      actions,
      proposedBlocks,
      temporalContext: {
        contractStartDayKey: '2026-01-01',
        contractEndDayKey: '2026-12-31',
      },
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('LONG_HORIZON_SPARSE_CADENCE');
    expect(result.failureCodes).not.toContain('LONG_HORIZON_WORK_GAPS');
    expect(result.meta?.temporalDistribution?.averageBlocksPerWeek).toBeLessThan(2);
    expect(result.meta?.temporalDistribution?.maxInterBlockGapDays).toBeLessThanOrEqual(6);
  });

  it('treats commercial waiting-period spans as occupied time instead of false work gaps', () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const deliverables = gumCommercialDeliverables();
    const actions = actionsForDeliverables(deliverables);
    const proposedBlocks = [
      ...blocksForDates(
        Array.from({ length: 70 }).map((_, index) => addDaysUTC('2026-01-05', index)),
        deliverables,
        actions
      ),
      {
        id: 'wait-1',
        title: 'Wait for packaged sample production, shipment, and receipt',
        deliverableId: deliverables[0]!.id,
        actionId: actions[0]!.id,
        start: '2026-03-16',
        endISO: '2026-04-05',
        blockType: 'waiting_period',
      },
      ...blocksForDates(
        Array.from({ length: 70 }).map((_, index) => addDaysUTC('2026-04-06', index)),
        deliverables,
        actions
      ),
      {
        id: 'wait-2',
        title: 'Wait for first buyer response window and fulfillment confirmation',
        deliverableId: deliverables[4]!.id,
        actionId: actions[4]!.id,
        start: '2026-06-15',
        endISO: '2026-07-05',
        blockType: 'waiting_period',
      },
      ...blocksForDates(
        Array.from({ length: 120 }).map((_, index) => addDaysUTC('2026-07-06', index)),
        deliverables,
        actions
      ),
    ];

    const result = evaluatePlanQualityGate({
      goalText,
      verificationText:
        'Caffeinated gum formula, packaging, sourcing, purchase path, first real sales, and sales evidence review completed.',
      deliverables,
      actions,
      proposedBlocks,
      temporalContext: {
        contractStartDayKey: '2026-01-05',
        contractEndDayKey: '2026-12-31',
      },
    });

    expect(result.status).toBe('PLAN_QUALITY_PASSED');
    expect(result.failureCodes).not.toContain('LONG_HORIZON_WORK_GAPS');
    expect(result.meta?.temporalDistribution?.averageBlocksPerWeek).toBeGreaterThanOrEqual(2);
    expect(result.meta?.temporalDistribution?.maxInterBlockGapDays).toBeLessThanOrEqual(6);
  });

  it('withholds long-horizon non-recurring plans that leave a large unexplained tail', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Launch a marketable Jericho v1 platform',
      verificationText:
        'marketable Jericho v1 has value proposition, landing page, user validation, traction evidence, and launch review',
      deliverables: [
        { id: 'd1', title: 'Jericho v1 value proposition', actionIds: ['a1'] },
        { id: 'd2', title: 'Jericho v1 landing page and waitlist funnel', actionIds: ['a2'] },
        { id: 'd3', title: 'Jericho v1 user validation and traction evidence', actionIds: ['a3'] },
      ],
      actions: [
        { id: 'a1', title: 'Define Jericho v1 value proposition', deliverableId: 'd1' },
        { id: 'a2', title: 'Build Jericho v1 landing page and waitlist funnel', deliverableId: 'd2' },
        { id: 'a3', title: 'Validate Jericho v1 users and traction evidence', deliverableId: 'd3' },
      ],
      proposedBlocks: [
        {
          id: 'b1',
          title: 'Define Jericho v1 value proposition',
          deliverableId: 'd1',
          actionId: 'a1',
          dayKey: '2026-04-20',
        },
        {
          id: 'b2',
          title: 'Build Jericho v1 landing page and waitlist funnel',
          deliverableId: 'd2',
          actionId: 'a2',
          dayKey: '2026-06-15',
        },
        {
          id: 'b3',
          title: 'Build Jericho v1 customer outreach list',
          deliverableId: 'd2',
          actionId: 'a2',
          dayKey: '2026-08-03',
        },
        {
          id: 'b4',
          title: 'Run Jericho v1 first-user validation loop',
          deliverableId: 'd3',
          actionId: 'a3',
          dayKey: '2026-09-21',
        },
        {
          id: 'b5',
          title: 'Compile Jericho v1 traction evidence and launch next-step review',
          deliverableId: 'd3',
          actionId: 'a3',
          dayKey: '2026-11-09',
        },
      ],
      temporalContext: {
        contractStartDayKey: '2026-04-13',
        contractEndDayKey: '2027-04-12',
      },
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('LONG_HORIZON_UNJUSTIFIED_TAIL_GAP');
    expect(result.failureCodes).not.toContain('LONG_HORIZON_TEMPORAL_COMPRESSION');
    expect(result.meta?.temporalDistribution?.lastScheduledDayKey).toBe('2026-11-09');
    expect(result.meta?.temporalDistribution?.remainingTailDays).toBeGreaterThanOrEqual(60);
  });

  it('derives long-horizon temporal diagnostics from applied review block start timestamps', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Launch a marketable Jericho v1 platform',
      verificationText:
        'marketable Jericho v1 has value proposition, landing page, user validation, traction evidence, and launch review',
      deliverables: [
        { id: 'd1', title: 'Jericho v1 value proposition', actionIds: ['a1'] },
        { id: 'd2', title: 'Jericho v1 landing page and waitlist funnel', actionIds: ['a2'] },
        { id: 'd3', title: 'Jericho v1 user validation and traction evidence', actionIds: ['a3'] },
      ],
      actions: [
        { id: 'a1', title: 'Define Jericho v1 value proposition', deliverableId: 'd1' },
        { id: 'a2', title: 'Build Jericho v1 landing page and waitlist funnel', deliverableId: 'd2' },
        { id: 'a3', title: 'Validate Jericho v1 users and traction evidence', deliverableId: 'd3' },
      ],
      committedBlocks: [
        {
          id: 'b1',
          title: 'Define Jericho v1 value proposition',
          deliverableId: 'd1',
          actionId: 'a1',
          start: '2026-04-20T09:00:00.000Z',
        },
        {
          id: 'b2',
          title: 'Build Jericho v1 landing page and waitlist funnel',
          deliverableId: 'd2',
          actionId: 'a2',
          start: '2026-06-15T09:00:00.000Z',
        },
        {
          id: 'b3',
          title: 'Build Jericho v1 customer outreach list',
          deliverableId: 'd2',
          actionId: 'a2',
          start: '2026-08-03T09:00:00.000Z',
        },
        {
          id: 'b4',
          title: 'Run Jericho v1 first-user validation loop',
          deliverableId: 'd3',
          actionId: 'a3',
          start: '2026-09-21T09:00:00.000Z',
        },
        {
          id: 'b5',
          title: 'Compile Jericho v1 traction evidence and launch next-step review',
          deliverableId: 'd3',
          actionId: 'a3',
          start: '2026-11-09T09:00:00.000Z',
        },
      ],
      temporalContext: {
        contractStartDayKey: '2026-04-13',
        contractEndDayKey: '2027-04-12',
      },
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('LONG_HORIZON_UNJUSTIFIED_TAIL_GAP');
    expect(result.meta?.temporalDistribution?.lastScheduledDayKey).toBe('2026-11-09');
  });

  it('allows a large long-horizon tail when explicit early-completion justification is present', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Launch a marketable Jericho v1 platform',
      verificationText:
        'marketable Jericho v1 has value proposition, landing page, user validation, traction evidence, and launch review',
      deliverables: [
        { id: 'd1', title: 'Jericho v1 value proposition', actionIds: ['a1'] },
        { id: 'd2', title: 'Jericho v1 landing page and waitlist funnel', actionIds: ['a2'] },
        { id: 'd3', title: 'Jericho v1 user validation and traction evidence', actionIds: ['a3'] },
      ],
      actions: [
        { id: 'a1', title: 'Define Jericho v1 value proposition', deliverableId: 'd1' },
        { id: 'a2', title: 'Build Jericho v1 landing page and waitlist funnel', deliverableId: 'd2' },
        { id: 'a3', title: 'Validate Jericho v1 users and traction evidence', deliverableId: 'd3' },
      ],
      proposedBlocks: [
        {
          id: 'b1',
          title: 'Define Jericho v1 value proposition',
          deliverableId: 'd1',
          actionId: 'a1',
          dayKey: '2026-04-20',
        },
        {
          id: 'b2',
          title: 'Build Jericho v1 landing page and waitlist funnel',
          deliverableId: 'd2',
          actionId: 'a2',
          dayKey: '2026-06-15',
        },
        {
          id: 'b3',
          title: 'Build Jericho v1 customer outreach list',
          deliverableId: 'd2',
          actionId: 'a2',
          dayKey: '2026-08-03',
        },
        {
          id: 'b4',
          title: 'Run Jericho v1 first-user validation loop',
          deliverableId: 'd3',
          actionId: 'a3',
          dayKey: '2026-09-21',
        },
        {
          id: 'b5',
          title: 'Compile Jericho v1 traction evidence and launch next-step review',
          deliverableId: 'd3',
          actionId: 'a3',
          dayKey: '2026-11-09',
        },
      ],
      temporalContext: {
        contractStartDayKey: '2026-04-13',
        contractEndDayKey: '2027-04-12',
        earlyCompletionJustification: 'Core launch closes early and the remaining contract tail is deliberate buffer.',
      },
    });

    expect(result.failureCodes).not.toContain('LONG_HORIZON_UNJUSTIFIED_TAIL_GAP');
  });

  it('withholds short active schedules that cluster onto Tuesday and Wednesday without an availability reason', () => {
    const deliverables = [
      { id: 'd1', title: 'Jericho execution package', actionIds: ['a1'] },
      { id: 'd2', title: 'Jericho validation package', actionIds: ['a2'] },
    ];
    const actions = actionsForDeliverables(deliverables);
    const proposedBlocks = [
      ...blocksForDates(['2026-06-02', '2026-06-03', '2026-06-09', '2026-06-10', '2026-06-16', '2026-06-17'], deliverables, actions),
    ];

    const result = evaluatePlanQualityGate({
      goalText: 'Ship Jericho v1 platform',
      verificationText: 'Jericho v1 platform shipped with onboarding, scheduler, dashboard, and validation ready',
      deliverables,
      actions,
      proposedBlocks,
      temporalContext: {
        contractStartDayKey: '2026-06-01',
        contractEndDayKey: '2026-06-21',
        workWindows: {
          mon: [{ start: '09:00', end: '15:00' }],
          tue: [{ start: '09:00', end: '15:00' }],
          wed: [{ start: '09:00', end: '15:00' }],
          thu: [{ start: '09:00', end: '15:00' }],
          fri: [{ start: '09:00', end: '15:00' }],
        },
      },
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('SCHEDULE_DISTRIBUTION_CLUSTER_UNJUSTIFIED');
    expect(result.meta?.temporalDistribution?.clusteredWeekdayLabels).toEqual(['Tue', 'Wed']);
  });

  it('does not flag Tuesday and Wednesday concentration when availability only allows those days', () => {
    const deliverables = [
      { id: 'd1', title: 'Jericho execution package', actionIds: ['a1'] },
      { id: 'd2', title: 'Jericho validation package', actionIds: ['a2'] },
    ];
    const actions = actionsForDeliverables(deliverables);
    const proposedBlocks = blocksForDates(['2026-06-02', '2026-06-03', '2026-06-09', '2026-06-10', '2026-06-16', '2026-06-17'], deliverables, actions);

    const result = evaluatePlanQualityGate({
      goalText: 'Ship Jericho v1 platform',
      verificationText: 'Jericho v1 platform shipped with onboarding, scheduler, dashboard, and validation ready',
      deliverables,
      actions,
      proposedBlocks,
      temporalContext: {
        contractStartDayKey: '2026-06-01',
        contractEndDayKey: '2026-06-21',
        workWindows: {
          tue: [{ start: '09:00', end: '15:00' }],
          wed: [{ start: '09:00', end: '15:00' }],
        },
      },
    });

    expect(result.failureCodes).not.toContain('SCHEDULE_DISTRIBUTION_CLUSTER_UNJUSTIFIED');
  });

  it('does not apply non-recurring temporal compression rules to recurring cadence goals', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Publish a weekly podcast for one year',
      verificationText: 'weekly podcast cadence maintained for one year',
      deliverables: [{ id: 'd1', title: 'weekly podcast cadence', actionIds: ['a1'] }],
      actions: [{ id: 'a1', title: 'publish weekly podcast episode', deliverableId: 'd1' }],
      proposedBlocks: [
        {
          id: 'b1',
          title: 'publish weekly podcast episode',
          deliverableId: 'd1',
          actionId: 'a1',
          dayKey: '2026-01-05',
        },
        {
          id: 'b2',
          title: 'publish weekly podcast episode',
          deliverableId: 'd1',
          actionId: 'a1',
          dayKey: '2026-01-12',
        },
      ],
      temporalContext: {
        contractStartDayKey: '2026-01-05',
        contractEndDayKey: '2027-01-04',
      },
    });

    expect(result.failureCodes).not.toContain('LONG_HORIZON_TEMPORAL_COMPRESSION');
    expect(result.failureCodes).not.toContain('LONG_HORIZON_UNJUSTIFIED_TAIL_GAP');
  });

  it('withholds a gum product launch plan when brand-launch work substitutes for commercial completion', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Launch a caffeinated gum product in 75 days',
      verificationText:
        'caffeinated gum product sample approved, packaging ready, product page live, and first sales campaign prepared',
      deliverables: [
        { id: 'd1', title: 'Define caffeinated gum brand positioning and audience promise', actionIds: ['a1'] },
        { id: 'd2', title: 'Build caffeinated gum messaging and launch narrative', actionIds: ['a2'] },
        { id: 'd3', title: 'Create caffeinated gum visual identity and launch assets', actionIds: ['a3'] },
        { id: 'd4', title: 'Publish caffeinated gum brand launch announcement and audience CTA', actionIds: ['a4'] },
      ],
      actions: [
        { id: 'a1', title: 'Define caffeinated gum brand positioning and audience promise', deliverableId: 'd1' },
        { id: 'a2', title: 'Build caffeinated gum messaging and launch narrative', deliverableId: 'd2' },
        { id: 'a3', title: 'Create caffeinated gum visual identity and launch assets', deliverableId: 'd3' },
        { id: 'a4', title: 'Publish caffeinated gum brand launch announcement and audience CTA', deliverableId: 'd4' },
      ],
      proposedBlocks: [
        {
          id: 'b1',
          title: 'Define caffeinated gum brand positioning and audience promise',
          deliverableId: 'd1',
          actionId: 'a1',
        },
        {
          id: 'b2',
          title: 'Build caffeinated gum messaging and launch narrative',
          deliverableId: 'd2',
          actionId: 'a2',
        },
        {
          id: 'b3',
          title: 'Create caffeinated gum visual identity and launch assets',
          deliverableId: 'd3',
          actionId: 'a3',
        },
        {
          id: 'b4',
          title: 'Publish caffeinated gum brand launch announcement and audience CTA',
          deliverableId: 'd4',
          actionId: 'a4',
        },
      ],
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('TERMINAL_OBJECT_DRIFT');
    expect(result.failureCodes).toContain('COMMERCIAL_READINESS_MISSING');
    expect(result.failureCodes).toContain('PURCHASE_PATH_MISSING');
    expect(result.failureCodes).toContain('FIRST_SALES_CORRIDOR_MISSING');
    expect(result.failureCodes).toContain('BRAND_LAUNCH_SUBSTITUTED_FOR_PRODUCT_LAUNCH');
    expect(result.failureCodes).toContain('TERMINAL_EVENT_EVIDENCE_MISSING');
    expect(result.meta?.commercialSemanticCoverage?.coveredFamilies).toContain('launchCommunications');
    expect(result.meta?.commercialSemanticCoverage?.missingFamilies).toContain('purchasePath');
  });

  it('passes the gum semantic slice when product readiness, purchase path, first sales, and terminal review are covered', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Launch a caffeinated gum product in 75 days',
      verificationText:
        'caffeinated gum product sample approved, packaging ready, product page live, and first sales campaign prepared',
      deliverables: [
        {
          id: 'd1',
          title: 'Finalize caffeinated gum formula, sample approval, packaging, and sellable unit readiness',
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
      ],
      actions: [
        {
          id: 'a1',
          title: 'Finalize caffeinated gum formula, sample approval, packaging, and sellable unit readiness',
          deliverableId: 'd1',
        },
        {
          id: 'a2',
          title: 'Set caffeinated gum offer, pricing, product page, checkout, ordering, and fulfillment path',
          deliverableId: 'd2',
        },
        {
          id: 'a3',
          title: 'Create caffeinated gum positioning, launch messaging, campaign assets, and sales CTA',
          deliverableId: 'd3',
        },
        {
          id: 'a4',
          title: 'Activate caffeinated gum first-sales outreach to initial buyers and track first order attempts',
          deliverableId: 'd4',
        },
        {
          id: 'a5',
          title: 'Review caffeinated gum first-sales evidence, conversion results, and next-step decision',
          deliverableId: 'd5',
        },
      ],
      proposedBlocks: [
        {
          id: 'b1',
          title: 'Finalize caffeinated gum formula, sample approval, packaging, and sellable unit readiness',
          deliverableId: 'd1',
          actionId: 'a1',
        },
        {
          id: 'b2',
          title: 'Set caffeinated gum offer, pricing, product page, checkout, ordering, and fulfillment path',
          deliverableId: 'd2',
          actionId: 'a2',
        },
        {
          id: 'b3',
          title: 'Create caffeinated gum positioning, launch messaging, campaign assets, and sales CTA',
          deliverableId: 'd3',
          actionId: 'a3',
        },
        {
          id: 'b4',
          title: 'Activate caffeinated gum first-sales outreach to initial buyers and track first order attempts',
          deliverableId: 'd4',
          actionId: 'a4',
        },
        {
          id: 'b5',
          title: 'Review caffeinated gum first-sales evidence, conversion results, and next-step decision',
          deliverableId: 'd5',
          actionId: 'a5',
        },
      ],
    });

    expect(result.failureCodes).not.toContain('TERMINAL_OBJECT_DRIFT');
    expect(result.failureCodes).not.toContain('COMMERCIAL_READINESS_MISSING');
    expect(result.failureCodes).not.toContain('PURCHASE_PATH_MISSING');
    expect(result.failureCodes).not.toContain('FIRST_SALES_CORRIDOR_MISSING');
    expect(result.failureCodes).not.toContain('BRAND_LAUNCH_SUBSTITUTED_FOR_PRODUCT_LAUNCH');
    expect(result.failureCodes).not.toContain('TERMINAL_EVENT_EVIDENCE_MISSING');
    expect(result.status).toBe('PLAN_QUALITY_PASSED');
  });

  it('does not treat concrete gum execution blocks as goal-object-missing when lineage semantics remain specific', () => {
    const result = evaluatePlanQualityGate({
      goalText:
        'Launch a caffeinated energy gum brand to first real sales in 15 months with product concept validation, branding, packaging, sourcing, checkout setup, launch execution, and first sales proof completed.',
      verificationText: 'Complete the admitted goal as defined in the intake review',
      deliverables: [
        {
          id: 'd1',
          title: 'Finalize caffeinated energy gum formula, sample approval, packaging, sourcing, and sellable unit readiness',
          actionIds: ['a1'],
        },
        {
          id: 'd2',
          title: 'Set caffeinated energy gum offer, pricing, product page, checkout, ordering, and fulfillment path',
          actionIds: ['a2'],
        },
        {
          id: 'd3',
          title: 'Activate caffeinated energy gum first-sales outreach to initial buyers and track first order attempts',
          actionIds: ['a3'],
        },
        {
          id: 'd4',
          title: 'Review caffeinated energy gum first-sales evidence, conversion results, and next-step decision',
          actionIds: ['a4'],
        },
      ],
      actions: [
        {
          id: 'a1',
          title: 'Compare manufacturer MOQ, lead times, and sampling constraints for the caffeinated energy gum formula path',
          deliverableId: 'd1',
        },
        {
          id: 'a2',
          title: 'Configure checkout fields, shipping logic, and order-capture flow for first real sales',
          deliverableId: 'd2',
        },
        {
          id: 'a3',
          title: 'Send first 10 buyer outreach messages for the caffeinated energy gum offer',
          deliverableId: 'd3',
        },
        {
          id: 'a4',
          title: 'Review first-sales evidence, replies, and conversion blockers before the next gum sales move',
          deliverableId: 'd4',
        },
      ],
      proposedBlocks: [
        {
          id: 'b1',
          title: 'Compare manufacturer MOQ, lead times, and sampling constraints',
          deliverableId: 'd1',
          actionId: 'a1',
        },
        {
          id: 'b2',
          title: 'Configure checkout fields and shipping logic',
          deliverableId: 'd2',
          actionId: 'a2',
        },
        {
          id: 'b3',
          title: 'Send first 10 buyer outreach messages',
          deliverableId: 'd3',
          actionId: 'a3',
        },
        {
          id: 'b4',
          title: 'Review first-sales evidence and conversion blockers',
          deliverableId: 'd4',
          actionId: 'a4',
        },
      ],
    });

    expect(result.failureCodes).not.toContain('OUTCOME_ENDPOINT_MISSING');
    expect(result.failureCodes).not.toContain('BLOCK_GOAL_OBJECT_MISSING');
    expect(result.status).toBe('PLAN_QUALITY_PASSED');
  });

  it('does not count support-only brand announcement work as terminal first-sales coverage', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Launch a caffeinated gum product and get first sales',
      verificationText: 'caffeinated gum has a purchase path, first order attempt, and first-sales evidence review',
      deliverables: [
        { id: 'd1', title: 'Prepare caffeinated gum channel profiles and bios', actionIds: ['a1'] },
        { id: 'd2', title: 'Publish caffeinated gum launch announcement and audience CTA', actionIds: ['a2'] },
      ],
      actions: [
        { id: 'a1', title: 'Prepare caffeinated gum channel profiles and bios', deliverableId: 'd1' },
        { id: 'a2', title: 'Publish caffeinated gum launch announcement and audience CTA', deliverableId: 'd2' },
      ],
      proposedBlocks: [
        { id: 'b1', title: 'Prepare caffeinated gum channel profiles and bios', deliverableId: 'd1', actionId: 'a1' },
        {
          id: 'b2',
          title: 'Publish caffeinated gum launch announcement and audience CTA',
          deliverableId: 'd2',
          actionId: 'a2',
        },
      ],
    });

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('BRAND_LAUNCH_SUBSTITUTED_FOR_PRODUCT_LAUNCH');
    expect(result.failureCodes).toContain('FIRST_SALES_CORRIDOR_MISSING');
    expect(result.failureCodes).toContain('TERMINAL_EVENT_EVIDENCE_MISSING');
  });
});
