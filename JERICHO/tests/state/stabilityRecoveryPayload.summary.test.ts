import { describe, expect, it } from 'vitest';
import { buildStabilityRecoveryPayload } from '../../src/state/engine/stabilityRecoveryPayload';

describe('stabilityRecoveryPayload summary', () => {
  it('builds a complete stability-safe recovery payload for drifted state', () => {
    const payload = buildStabilityRecoveryPayload({
      laneKey: 'Fundraising::Angel Raise',
      archetype: 'Fundraising',
      subtype: 'Angel Raise',
      planState: { plannedOutputs: 6, completedOutputs: 2, requiredWeeklySessions: 8, availableWeeklySessions: 4 },
      executionState: {
        plannedSessions: 10,
        completedSessions: 4,
        missedSessions: 6,
        throughputActual: 2,
        throughputExpected: 8,
      },
      contextState: {
        missingRequiredAnswers: ['What amount are you raising and what stage are you at?'],
        successDefinitionClear: false,
      },
    });

    expect(payload.signalCount).toBeGreaterThan(0);
    expect(payload.primaryFailureClass).toBeTruthy();
    expect(payload.recommendation.issueDetected.length).toBeGreaterThan(0);
    expect(payload.recommendation.proposedAdjustment.length).toBeGreaterThan(0);
    expect(typeof payload.recommendation.confirmationRequired).toBe('boolean');
    expect(payload.recoveryIntegrity.usedLaneSpecificRules).toBe(true);
  });

  it('returns no-recovery-needed payload when no drift is detected', () => {
    const payload = buildStabilityRecoveryPayload({
      laneKey: 'ProfessionalQualification::Certification Exam',
      archetype: 'ProfessionalQualification',
      subtype: 'Certification Exam',
      planState: { plannedOutputs: 3, completedOutputs: 3 },
      executionState: { plannedSessions: 6, completedSessions: 6, adherenceRate: 0.9, readinessScore: 0.85 },
      contextState: { successDefinitionClear: true },
    });

    expect(payload.signalCount).toBe(0);
    expect(payload.primaryFailureClass).toBeNull();
    expect(payload.recommendation.confirmationRequired).toBe(false);
  });
});
