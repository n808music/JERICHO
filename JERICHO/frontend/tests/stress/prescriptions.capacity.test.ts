import { describe, expect, it } from 'vitest';
import { computePrescriptions } from '../../src/domain/prescriptions.ts';

describe('prescriptions capacity', () => {
  it('emits INCREASE_WEEKLY_CAPACITY with exact minutes/week and deterministic order', () => {
    const bundle = computePrescriptions({
      unplacedEstimateMinTotal: 1200,
      unplacedEstimateMinByCategory: { FOCUS: 900, RESOURCES: 300 },
      placementWindowDays: 28,
      maxScheduledMinutesPerWeek: 300,
    });

    expect(bundle.primaryConstraint).toBe('CAPACITY');
    expect(bundle.prescriptions[0]?.code).toBe('INCREASE_WEEKLY_CAPACITY');
    expect(bundle.prescriptions[0]?.parameters.requiredExtraMinutesPerWeek).toBe(300);
    expect(bundle.mustIncludeCodes).toEqual(['INCREASE_WEEKLY_CAPACITY', 'REDUCE_SCOPE_CATEGORY']);
  });
});
