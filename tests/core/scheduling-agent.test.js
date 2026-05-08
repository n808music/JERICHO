describe('Scheduling Agent dependency enforcement', () => {
  let buildSchedulingPolicy;
  let generateScheduleProposal;
  let validateMaterializedBlockDependencies;
  let resolveTransitiveDependencyIds;

  beforeAll(async () => {
    const schedulingModule = await import('../../src/core/scheduling-agent.js');
    buildSchedulingPolicy = schedulingModule.buildSchedulingPolicy;
    generateScheduleProposal = schedulingModule.generateScheduleProposal;
    const dependencyModule = await import('../../src/core/schedule-dependency-enforcement.js');
    validateMaterializedBlockDependencies = dependencyModule.validateMaterializedBlockDependencies;
    resolveTransitiveDependencyIds = dependencyModule.resolveTransitiveDependencyIds;
  });

  it('resolves full transitive ancestry across multi-hop lineage', () => {
    const actionById = new Map([
      ['moq-gate', { actionId: 'moq-gate', dependsOn: [] }],
      ['commerce-chunk', { actionId: 'commerce-chunk', dependsOn: ['moq-gate'] }],
      ['checkout-block', { actionId: 'checkout-block', dependsOn: ['commerce-chunk'] }]
    ]);

    const transitiveDependencyIds = resolveTransitiveDependencyIds('checkout-block', actionById);

    expect(transitiveDependencyIds).toEqual(['commerce-chunk', 'moq-gate']);
  });

  it('materializes transitive dependencies onto blocks and schedules after prerequisite completion', () => {
    const schedulingPolicy = buildSchedulingPolicy(
      {
        preferredWorkDays: ['sunday'],
        preferredTimeOfDay: 'custom',
        earliestStartTime: '09:00',
        latestEndTime: '12:00',
        minimumSessionLength: 60,
        maximumSessionLength: 60,
        bufferBetweenSessions: 0,
        hardBlockedDates: [],
        recurringBlockedWindows: [],
        deadlineFlexibility: 'hard',
        frontLoadOrBackLoadPreference: 'steady',
        dependencySequencingAwareness: 'enforced',
        familySchedulingInputs: {},
        startDate: '2026-04-20T00:00:00.000Z',
        deadline: '2026-04-20T23:59:59.000Z'
      },
      'VentureLaunch',
      'SaaS Product Launch'
    );
    const effortEstimate = { estimatedTotalEffortHours: 3 };
    const actionGraph = [
      { actionId: 'gate', title: 'MOQ gate', estimatedMinutes: 60, dependsOn: [], dependencyPosition: 1 },
      { actionId: 'mid', title: 'Commerce chunk', estimatedMinutes: 60, dependsOn: ['gate'], dependencyPosition: 2 },
      { actionId: 'leaf', title: 'Checkout config', estimatedMinutes: 60, dependsOn: ['mid'], dependencyPosition: 3 }
    ];

    const proposal = generateScheduleProposal(schedulingPolicy, effortEstimate, actionGraph, 'goal-1');

    expect(proposal.errorCode).toBeNull();
    expect(proposal.proposedBlocks).toHaveLength(3);

    const gateBlock = proposal.proposedBlocks.find((block) => block.actionId === 'gate');
    const midBlock = proposal.proposedBlocks.find((block) => block.actionId === 'mid');
    const leafBlock = proposal.proposedBlocks.find((block) => block.actionId === 'leaf');

    expect(new Date(midBlock.scheduledDate).getTime()).toBeGreaterThanOrEqual(
      new Date(gateBlock.completionDate).getTime()
    );
    expect(new Date(leafBlock.scheduledDate).getTime()).toBeGreaterThanOrEqual(
      new Date(midBlock.completionDate).getTime()
    );
    expect(leafBlock.directDependencyIds).toEqual(['mid']);
    expect(leafBlock.transitiveDependencyIds).toEqual(['mid', 'gate']);
    expect(validateMaterializedBlockDependencies(proposal.proposedBlocks)).toEqual([]);
  });

  it('allows same-day placement only after dependency completion timestamp', () => {
    const schedulingPolicy = buildSchedulingPolicy(
      {
        preferredWorkDays: ['sunday'],
        preferredTimeOfDay: 'custom',
        earliestStartTime: '09:00',
        latestEndTime: '12:00',
        minimumSessionLength: 60,
        maximumSessionLength: 60,
        bufferBetweenSessions: 0,
        hardBlockedDates: [],
        recurringBlockedWindows: [],
        deadlineFlexibility: 'hard',
        frontLoadOrBackLoadPreference: 'steady',
        dependencySequencingAwareness: 'enforced',
        familySchedulingInputs: {},
        startDate: '2026-04-20T00:00:00.000Z',
        deadline: '2026-04-20T23:59:59.000Z'
      },
      'VentureLaunch',
      'SaaS Product Launch'
    );
    const effortEstimate = { estimatedTotalEffortHours: 2 };
    const actionGraph = [
      { actionId: 'gate', title: 'MOQ gate', estimatedMinutes: 60, dependsOn: [], dependencyPosition: 1 },
      { actionId: 'leaf', title: 'Checkout config', estimatedMinutes: 60, dependsOn: ['gate'], dependencyPosition: 2 }
    ];

    const proposal = generateScheduleProposal(schedulingPolicy, effortEstimate, actionGraph, 'goal-3');

    const gateBlock = proposal.proposedBlocks.find((block) => block.actionId === 'gate');
    const leafBlock = proposal.proposedBlocks.find((block) => block.actionId === 'leaf');
    expect(gateBlock.date).toBe('2026-04-20');
    expect(leafBlock.date).toBe('2026-04-20');
    expect(new Date(leafBlock.scheduledDate).getTime()).toBeGreaterThanOrEqual(
      new Date(gateBlock.completionDate).getTime()
    );
  });

  it('leaves downstream actions unscheduled when dependencies cannot be materialized', () => {
    const schedulingPolicy = buildSchedulingPolicy(
      {
        preferredWorkDays: ['sunday'],
        preferredTimeOfDay: 'custom',
        earliestStartTime: '09:00',
        latestEndTime: '10:00',
        minimumSessionLength: 60,
        maximumSessionLength: 60,
        bufferBetweenSessions: 0,
        hardBlockedDates: [],
        recurringBlockedWindows: [],
        deadlineFlexibility: 'hard',
        frontLoadOrBackLoadPreference: 'steady',
        dependencySequencingAwareness: 'enforced',
        familySchedulingInputs: {},
        startDate: '2026-04-20T00:00:00.000Z',
        deadline: '2026-04-20T23:59:59.000Z'
      },
      'VentureLaunch',
      'SaaS Product Launch'
    );
    const effortEstimate = { estimatedTotalEffortHours: 3 };
    const actionGraph = [
      { actionId: 'gate', title: 'MOQ gate', estimatedMinutes: 120, dependsOn: [], dependencyPosition: 1 },
      { actionId: 'leaf', title: 'Checkout config', estimatedMinutes: 60, dependsOn: ['gate'], dependencyPosition: 2 }
    ];

    const proposal = generateScheduleProposal(schedulingPolicy, effortEstimate, actionGraph, 'goal-2');

    expect(proposal.proposedBlocks).toHaveLength(0);
    expect(proposal.unscheduledItems).toHaveLength(2);
    const blockedLeaf = proposal.unscheduledItems.find((item) => item.actionId === 'leaf');
    expect(blockedLeaf.reason).toContain('Blocked by unscheduled dependencies');
  });
});
