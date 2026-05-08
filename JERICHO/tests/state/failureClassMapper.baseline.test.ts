import { describe, expect, it } from 'vitest';
import { mapFailureClasses } from '../../src/state/engine/failureClassMapper';

const signal = (code: any) => ({ code, severity: 'warning', evidence: {}, laneKey: 'x::y' });

describe('failureClassMapper baseline', () => {
  it('maps output-delay + capacity-overrun to scope overload', () => {
    const failures = mapFailureClasses({
      laneKey: 'VentureLaunch::SaaS Product Launch',
      archetype: 'VentureLaunch',
      subtype: 'SaaS Product Launch',
      driftSignals: [signal('OUTPUT_DELAY'), signal('CAPACITY_OVERRUN')],
    });

    expect(failures[0]?.code).toBe('SCOPE_OVERLOAD');
  });

  it('maps low throughput in pipeline lanes to conversion failure', () => {
    const failures = mapFailureClasses({
      laneKey: 'Fundraising::Angel Raise',
      archetype: 'Fundraising',
      subtype: 'Angel Raise',
      driftSignals: [signal('LOW_THROUGHPUT')],
    });

    expect(failures[0]?.code).toBe('CONVERSION_FAILURE');
  });

  it('maps training readiness issues with pain risk to recovery safety failure', () => {
    const failures = mapFailureClasses({
      laneKey: 'PhysicalTraining::Rehab Return to Training',
      archetype: 'PhysicalTraining',
      subtype: 'Rehab Return to Training',
      driftSignals: [signal('LOW_READINESS')],
      contextState: { painOrSafetyRisk: true },
    });

    expect(failures[0]?.code).toBe('RECOVERY_SAFETY_FAILURE');
  });
});
