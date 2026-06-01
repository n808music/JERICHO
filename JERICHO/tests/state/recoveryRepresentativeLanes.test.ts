import { describe, expect, it } from 'vitest';
import { buildStabilityRecoveryPayload } from '../../src/state/engine/stabilityRecoveryPayload';

const representativeCases = [
  {
    laneKey: 'ProfessionalQualification::Certification Exam',
    archetype: 'ProfessionalQualification',
    subtype: 'Certification Exam',
    planState: { plannedOutputs: 5, completedOutputs: 2 },
    executionState: { readinessScore: 0.45, plannedSessions: 8, completedSessions: 5 },
  },
  {
    laneKey: 'PhysicalTraining::Rehab Return to Training',
    archetype: 'PhysicalTraining',
    subtype: 'Rehab Return to Training',
    planState: { plannedOutputs: 5, completedOutputs: 3 },
    executionState: { readinessScore: 0.4, qualityFailures: 1, plannedSessions: 8, completedSessions: 4 },
    contextState: { painOrSafetyRisk: true },
  },
  {
    laneKey: 'JobSearchPipeline::Corporate Role Search',
    archetype: 'JobSearchPipeline',
    subtype: 'Corporate Role Search',
    executionState: { throughputActual: 3, throughputExpected: 10, plannedSessions: 10, completedSessions: 6 },
  },
  {
    laneKey: 'CreativeProduction::Podcast Production',
    archetype: 'CreativeProduction',
    subtype: 'Podcast Production',
    planState: { plannedOutputs: 6, completedOutputs: 2, requiredWeeklySessions: 8, availableWeeklySessions: 4 },
    executionState: { plannedSessions: 10, completedSessions: 4, missedSessions: 5 },
  },
  {
    laneKey: 'Fundraising::Angel Raise',
    archetype: 'Fundraising',
    subtype: 'Angel Raise',
    executionState: { throughputActual: 2, throughputExpected: 7, plannedSessions: 9, completedSessions: 5 },
  },
] as const;

describe('recovery representative lanes', () => {
  it('produces lane-appropriate recovery behavior across key archetype families', () => {
    const payloads = representativeCases.map((entry) =>
      buildStabilityRecoveryPayload({
        laneKey: entry.laneKey,
        archetype: entry.archetype,
        subtype: entry.subtype,
        planState: entry.planState,
        executionState: entry.executionState,
        contextState: entry.contextState,
      })
    );

    const byLane = Object.fromEntries(payloads.map((payload) => [payload.laneKey, payload]));

    expect(
      byLane['ProfessionalQualification::Certification Exam'].recommendation.proposedAdjustment.toLowerCase()
    ).toContain('weak domains');
    expect(byLane['PhysicalTraining::Rehab Return to Training'].primaryFailureClass).toBe('RECOVERY_SAFETY_FAILURE');
    expect(byLane['JobSearchPipeline::Corporate Role Search'].primaryFailureClass).toBe('CONVERSION_FAILURE');
    expect(byLane['CreativeProduction::Podcast Production'].recommendation.proposedAdjustment.toLowerCase()).toContain(
      'trailer plus first episode'
    );
    expect(byLane['Fundraising::Angel Raise'].recommendation.proposedAdjustment.toLowerCase()).toContain(
      'narrative/deck'
    );
  });
});
