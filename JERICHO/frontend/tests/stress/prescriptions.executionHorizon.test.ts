import { describe, expect, it } from 'vitest';
import { computePrescriptions } from '../../src/domain/prescriptions.ts';

describe('prescriptions execution horizon', () => {
  it('emits INCREASE_EXECUTION_HORIZON when outside execution horizon work dominates', () => {
    const bundle = computePrescriptions({
      outsideExecutionHorizonEstimateMinTotal: 900,
      outsideExecutionHorizonCount: 18,
      maxScheduledMinutesPerWeek: 300,
      executionHorizonDays: 90,
    });

    expect(bundle.primaryConstraint).toBe('EXECUTION_HORIZON');
    const rec = bundle.prescriptions.find((entry) => entry.code === 'INCREASE_EXECUTION_HORIZON');
    expect(rec).toBeTruthy();
    expect(rec?.parameters.requiredExtraWeeks).toBe(3);
  });
});
