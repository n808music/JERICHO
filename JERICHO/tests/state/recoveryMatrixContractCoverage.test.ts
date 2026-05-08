import { describe, expect, it } from 'vitest';
import { ARCHETYPE_MATRIX_1_0 } from '../../src/state/contracts/archetypeMatrix1_0';
import { normalizeLaneKey } from '../../src/state/contracts/archetypeRepresentativeGoals1_0';
import { buildStabilityRecoveryPayload } from '../../src/state/engine/stabilityRecoveryPayload';

describe('recovery matrix contract coverage', () => {
  it('provides deterministic recovery path coverage for all 45 canonical lanes', () => {
    const laneResults = ARCHETYPE_MATRIX_1_0.flatMap((archetype) =>
      archetype.lanes.map((lane) => {
        const laneKey = normalizeLaneKey(archetype.archetype, lane.subtype);
        const payload = buildStabilityRecoveryPayload({
          laneKey,
          archetype: archetype.archetype,
          subtype: lane.subtype,
          planState: { plannedOutputs: 5, completedOutputs: 2, requiredWeeklySessions: 7, availableWeeklySessions: 4 },
          executionState: { plannedSessions: 10, completedSessions: 5, missedSessions: 3 },
          contextState: { successDefinitionClear: true },
        });
        return { laneKey, payload };
      })
    );

    expect(laneResults).toHaveLength(45);
    laneResults.forEach(({ laneKey, payload }) => {
      expect(payload.laneKey).toBe(laneKey);
      expect(payload.recommendation.proposedAdjustment.length).toBeGreaterThan(0);
      expect(payload.recoveryIntegrity.usedLaneSpecificRules).toBe(true);
    });
  });
});
