import { describe, it, expect } from 'vitest';
import {
  mapLaneToEntity,
  DEPRECATED_LANE_LABELS,
} from './laneToEntity';

describe('mapLaneToEntity', () => {
  it('maps civic to Global State Holdings (Real Estate)', () => {
    const entity = mapLaneToEntity('civic');
    expect(entity?.displayName).toBe('Global State Holdings');
    expect(entity?.companyCategory).toBe('Real Estate');
  });

  it('maps real_estate to Global State Holdings', () => {
    expect(mapLaneToEntity('real_estate')?.displayName).toBe('Global State Holdings');
  });

  it('maps product to Global State Systems', () => {
    expect(mapLaneToEntity('product')?.displayName).toBe('Global State Systems');
  });

  it('maps creative to Global State Corp. (record label)', () => {
    expect(mapLaneToEntity('creative')?.displayName).toBe('Global State Corp.');
  });

  it('maps media to Global State Productions', () => {
    expect(mapLaneToEntity('media')?.displayName).toBe('Global State Productions');
  });

  it('maps operations to Global State Solutions (consulting/PM)', () => {
    expect(mapLaneToEntity('operations')?.displayName).toBe('Global State Solutions');
  });

  it('maps capital and revenue to Capital Path or Revenue Engine', () => {
    expect(mapLaneToEntity('capital')?.displayName).toBe('Capital Path or Revenue Engine');
    expect(mapLaneToEntity('revenue')?.displayName).toBe('Capital Path or Revenue Engine');
  });

  it('maps energy_gym to F8 Energy Co.', () => {
    expect(mapLaneToEntity('energy_gym')?.displayName).toBe('F8 Energy Co.');
  });

  it('maps education and institution to Global State Academy', () => {
    expect(mapLaneToEntity('education')?.displayName).toBe('Global State Academy');
    expect(mapLaneToEntity('institution')?.displayName).toBe('Global State Academy');
  });

  it('returns null for an unrecognized lane id', () => {
    expect(mapLaneToEntity('unrecognized_xyz')).toBeNull();
  });

  it('treats civic as deprecated as a user-facing label', () => {
    expect(DEPRECATED_LANE_LABELS).toContain('civic');
  });
});
