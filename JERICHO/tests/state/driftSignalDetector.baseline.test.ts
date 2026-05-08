import { describe, expect, it } from 'vitest';
import { detectDriftSignals } from '../../src/state/engine/driftSignalDetector';

describe('driftSignalDetector baseline', () => {
  it('emits stable signals for missed sessions, output delay, throughput, and capacity overrun', () => {
    const signals = detectDriftSignals({
      laneKey: 'JobSearchPipeline::Corporate Role Search',
      archetype: 'JobSearchPipeline',
      subtype: 'Corporate Role Search',
      planState: {
        plannedOutputs: 6,
        completedOutputs: 2,
        requiredWeeklySessions: 8,
        availableWeeklySessions: 4,
      },
      executionState: {
        plannedSessions: 10,
        completedSessions: 4,
        missedSessions: 6,
        throughputActual: 3,
        throughputExpected: 8,
        adherenceRate: 0.5,
      },
      scheduleState: {
        requiredWeeklySessions: 8,
        availableWeeklySessions: 4,
        unplacedSessions: 3,
      },
    });

    const codes = signals.map((signal) => signal.code);
    expect(codes).toContain('MISSED_SESSIONS');
    expect(codes).toContain('OUTPUT_DELAY');
    expect(codes).toContain('LOW_THROUGHPUT');
    expect(codes).toContain('CAPACITY_OVERRUN');
    expect(codes).toContain('LOW_ADHERENCE');
  });

  it('does not hallucinate signals when data is healthy/minimal', () => {
    const signals = detectDriftSignals({
      laneKey: 'ProfessionalQualification::Certification Exam',
      archetype: 'ProfessionalQualification',
      subtype: 'Certification Exam',
      planState: { plannedOutputs: 3, completedOutputs: 3 },
      executionState: { plannedSessions: 6, completedSessions: 6, adherenceRate: 0.9, readinessScore: 0.85 },
    });

    expect(signals).toEqual([]);
  });
});
