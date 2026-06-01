import { describe, expect, it } from 'vitest';
import { normalizeLaneKey } from '../../src/state/contracts/archetypeRepresentativeGoals1_0';
import { buildStabilityRecoveryPayload } from '../../src/state/engine/stabilityRecoveryPayload';

describe('recovery end-to-end smoke', () => {
  it('runs lane -> drift detection -> failure mapping -> recommendation -> stability payload', () => {
    const laneKey = normalizeLaneKey('SalesPipeline', 'B2B Service Sales');
    const payload = buildStabilityRecoveryPayload({
      laneKey,
      archetype: 'SalesPipeline',
      subtype: 'B2B Service Sales',
      planState: { plannedOutputs: 5, completedOutputs: 2, requiredWeeklySessions: 8, availableWeeklySessions: 5 },
      executionState: {
        plannedSessions: 10,
        completedSessions: 6,
        missedSessions: 4,
        throughputActual: 3,
        throughputExpected: 9,
      },
      contextState: { successDefinitionClear: true },
    });

    expect(payload.signalCount).toBeGreaterThan(0);
    expect(payload.primaryFailureClass).toBeTruthy();
    expect(payload.recommendation.issueDetected.length).toBeGreaterThan(0);
    expect(payload.recommendation.proposedAdjustment.length).toBeGreaterThan(0);
  });
});
