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

  it('Mixed mode: ANY_ONE edge takes precedence', () => {
    // If there's at least one ANY_ONE edge, use ANY_ONE logic
    const canonicalActions = [
      { id: 'action1', dependencies: ['dep1', 'dep2'] }
    ];
    const dependenciesById = {
      'edge1': { id: 'edge1', upstreamId: 'dep1', downstreamId: 'action1', satisfactionMode: 'ANY_ONE' },
      'edge2': { id: 'edge2', upstreamId: 'dep2', downstreamId: 'action1', satisfactionMode: 'ALL' },
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

    // dep1 (ANY_ONE edge) is complete, so satisfied
    expect(truth.dependencyRelation).toBe('dependency_clear');
  });
});
