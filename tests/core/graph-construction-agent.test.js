/**
 * Tests for Graph Construction Agent
 */

describe('Graph Construction Agent', () => {
  let generateActionGraph, validateDependencyGraph, confirmActionGraph, applyActionGraphAdjustments;

  beforeAll(async () => {
    const module = await import('../../src/core/graph-construction-agent.js');
    generateActionGraph = module.generateActionGraph;
    validateDependencyGraph = module.validateDependencyGraph;
    confirmActionGraph = module.confirmActionGraph;
    applyActionGraphAdjustments = module.applyActionGraphAdjustments;
  });

  it('generates a canonical action graph for SaaS Product Launch', () => {
    const goalPayload = {
      goalId: 'goal-1',
      goalSubtype: 'SaaS Product Launch',
      currentStatus: 'NOT_STARTED'
    };

    const { actionGraph, errorCode } = generateActionGraph(goalPayload);
    expect(errorCode).toBeNull();
    expect(actionGraph).toHaveLength(14);
    expect(actionGraph[0].title).toContain('Define core problem');
    expect(actionGraph[0].dependsOn).toEqual([]);
    expect(actionGraph[1].dependsOn).toEqual([actionGraph[0].actionId]);
  });

  it('validates a correct dependency graph', () => {
    const goalPayload = {
      goalId: 'goal-1',
      goalSubtype: 'SaaS Product Launch'
    };
    const { actionGraph } = generateActionGraph(goalPayload);
    const validation = validateDependencyGraph(actionGraph);

    expect(validation.graphValidationStatus).toBe('VALID');
    expect(validation.cyclesDetected).toBe(false);
    expect(validation.orphanedActions).toHaveLength(0);
    expect(validation.readyForEstimation).toBe(true);
  });

  it('flags missing dependencies as invalid', () => {
    const malformedGraph = [
      { actionId: 'a1', title: 'A1', dependsOn: [] },
      { actionId: 'a2', title: 'A2', dependsOn: ['missing'] }
    ];
    const validation = validateDependencyGraph(malformedGraph);

    expect(validation.graphValidationStatus).toBe('INVALID');
    expect(validation.orphanedActions).toContain('a2');
  });

  it('allows marking existing actions as complete and appending a custom action', () => {
    const goalPayload = {
      goalId: 'goal-2',
      goalSubtype: 'SaaS Product Launch'
    };
    const { actionGraph } = generateActionGraph(goalPayload);

    const updated = applyActionGraphAdjustments(actionGraph, {
      completedActionIds: [actionGraph[0].actionId],
      customActionTitle: 'Celebrate launch'
    });

    expect(updated.find(a => a.actionId === actionGraph[0].actionId).status).toBe('complete');
    expect(updated[updated.length - 1].title).toBe('Celebrate launch');
  });

  it('confirms the graph when user choice is correct', () => {
    const goalPayload = {
      goalId: 'goal-3',
      goalSubtype: 'SaaS Product Launch'
    };
    const { actionGraph } = generateActionGraph(goalPayload);

    const confirmed = confirmActionGraph(actionGraph, 'correct');
    expect(confirmed.confirmationStatus).toBe('CONFIRMED');
  });
});