import { describe, it, expect } from 'vitest';
import { deriveExecutionTruthClassification } from '../engine/todayAuthority.ts';

describe('Dependency Satisfaction Mode', () => {
  const NOW_ISO = '2026-08-07T15:30:00Z';
  const baseDayKey = '2026-08-07';

  it('ALL mode: satisfies only when all dependencies are complete', () => {
    const completedActionIds = new Set(['dep1']);
    const canonicalActions = [
      { id: 'action1', dependencies: ['dep1', 'dep2'] }
    ];
    const dependenciesById = {
      'edge1': { id: 'edge1', upstreamId: 'dep1', downstreamId: 'action1', satisfactionMode: 'ALL' },
      'edge2': { id: 'edge2', upstreamId: 'dep2', downstreamId: 'action1', satisfactionMode: 'ALL' },
    };

    const futureDate = '2026-08-08'; // Future date so temporalRelation is 'future_claim'
    const truth = deriveExecutionTruthClassification({
      block: { id: 'block1', actionId: 'action1', date: futureDate },
      nowISO: NOW_ISO,
      activeDayKey: baseDayKey,
      executionEvents: [{ kind: 'complete', actionId: 'dep1' }],
      canonicalActions,
      dependenciesById,
    });

    // Only one dependency is complete, so not satisfied in ALL mode
    expect(truth.dependencyRelation).toBe('dependency_suspicious');
  });

  it('ALL mode: satisfies when all dependencies are complete', () => {
    const canonicalActions = [
      { id: 'action1', dependencies: ['dep1', 'dep2'] }
    ];
    const dependenciesById = {
      'edge1': { id: 'edge1', upstreamId: 'dep1', downstreamId: 'action1', satisfactionMode: 'ALL' },
      'edge2': { id: 'edge2', upstreamId: 'dep2', downstreamId: 'action1', satisfactionMode: 'ALL' },
    };

    const futureDate = '2026-08-08'; // Future date so temporalRelation is 'future_claim'
    const truth = deriveExecutionTruthClassification({
      block: { id: 'block1', actionId: 'action1', date: futureDate },
      nowISO: NOW_ISO,
      activeDayKey: baseDayKey,
      executionEvents: [
        { kind: 'complete', actionId: 'dep1' },
        { kind: 'complete', actionId: 'dep2' },
      ],
      canonicalActions,
      dependenciesById,
    });

    // Both dependencies are complete, so satisfied in ALL mode
    expect(truth.dependencyRelation).toBe('dependency_clear');
  });

  it('ANY_ONE mode: satisfies when at least one dependency is complete', () => {
    const canonicalActions = [
      { id: 'action1', dependencies: ['dep1', 'dep2'] }
    ];
    const dependenciesById = {
      'edge1': { id: 'edge1', upstreamId: 'dep1', downstreamId: 'action1', satisfactionMode: 'ANY_ONE' },
      'edge2': { id: 'edge2', upstreamId: 'dep2', downstreamId: 'action1', satisfactionMode: 'ANY_ONE' },
    };

    const futureDate = '2026-08-08'; // Future date so temporalRelation is 'future_claim'
    const truth = deriveExecutionTruthClassification({
      block: { id: 'block1', actionId: 'action1', date: futureDate },
      nowISO: NOW_ISO,
      activeDayKey: baseDayKey,
      executionEvents: [
        { kind: 'complete', actionId: 'dep1' },
      ],
      canonicalActions,
      dependenciesById,
    });

    // One dependency is complete, so satisfied in ANY_ONE mode
    expect(truth.dependencyRelation).toBe('dependency_clear');
  });

  it('ANY_ONE mode: does not satisfy when no dependencies are complete', () => {
    const canonicalActions = [
      { id: 'action1', dependencies: ['dep1', 'dep2'] }
    ];
    const dependenciesById = {
      'edge1': { id: 'edge1', upstreamId: 'dep1', downstreamId: 'action1', satisfactionMode: 'ANY_ONE' },
      'edge2': { id: 'edge2', upstreamId: 'dep2', downstreamId: 'action1', satisfactionMode: 'ANY_ONE' },
    };

    const futureDate = '2026-08-08'; // Future date so temporalRelation is 'future_claim'
    const truth = deriveExecutionTruthClassification({
      block: { id: 'block1', actionId: 'action1', date: futureDate },
      nowISO: NOW_ISO,
      activeDayKey: baseDayKey,
      executionEvents: [],
      canonicalActions,
      dependenciesById,
    });

    // No dependencies are complete, so not satisfied even in ANY_ONE mode
    expect(truth.dependencyRelation).toBe('dependency_suspicious');
  });

  it('Mixed mode: ALL-mode edges independently required, ANY_ONE-mode needs at least one', () => {
    // Mixed scenario: A and C are ALL-mode (each required), B is ANY_ONE-mode (any one of B group)
    // Action should only be satisfied if: A is complete AND C is complete AND (B is complete)
    const canonicalActions = [
      { id: 'action1', dependencies: ['depA', 'depB', 'depC'] }
    ];
    const dependenciesById = {
      'edgeA': { id: 'edgeA', upstreamId: 'depA', downstreamId: 'action1', satisfactionMode: 'ALL' },
      'edgeB': { id: 'edgeB', upstreamId: 'depB', downstreamId: 'action1', satisfactionMode: 'ANY_ONE' },
      'edgeC': { id: 'edgeC', upstreamId: 'depC', downstreamId: 'action1', satisfactionMode: 'ALL' },
    };

    const futureDate = '2026-08-08';

    // Case 1: Only B complete — should NOT be satisfied (A and C are still required)
    const truth1 = deriveExecutionTruthClassification({
      block: { id: 'block1', actionId: 'action1', date: futureDate },
      nowISO: NOW_ISO,
      activeDayKey: baseDayKey,
      executionEvents: [{ kind: 'complete', actionId: 'depB' }],
      canonicalActions,
      dependenciesById,
    });
    expect(truth1.dependencyRelation).toBe('dependency_suspicious', 'B alone should not satisfy when A,C are required');

    // Case 2: A and C complete, B not complete — should NOT be satisfied (ANY_ONE group needs at least one)
    const truth2 = deriveExecutionTruthClassification({
      block: { id: 'block1', actionId: 'action1', date: futureDate },
      nowISO: NOW_ISO,
      activeDayKey: baseDayKey,
      executionEvents: [
        { kind: 'complete', actionId: 'depA' },
        { kind: 'complete', actionId: 'depC' },
      ],
      canonicalActions,
      dependenciesById,
    });
    expect(truth2.dependencyRelation).toBe('dependency_suspicious', 'A,C complete but B missing from ANY_ONE group');

    // Case 3: A, B, and C all complete — should be satisfied
    const truth3 = deriveExecutionTruthClassification({
      block: { id: 'block1', actionId: 'action1', date: futureDate },
      nowISO: NOW_ISO,
      activeDayKey: baseDayKey,
      executionEvents: [
        { kind: 'complete', actionId: 'depA' },
        { kind: 'complete', actionId: 'depB' },
        { kind: 'complete', actionId: 'depC' },
      ],
      canonicalActions,
      dependenciesById,
    });
    expect(truth3.dependencyRelation).toBe('dependency_clear', 'All requirements met');
  });
});
