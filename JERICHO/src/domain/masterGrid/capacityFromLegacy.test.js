import { describe, it, expect } from 'vitest';
import { seedCapacityFromLegacyConstraints } from './capacityFromLegacy.js';

const ONE_ENTITY_MATRIX = {
  entitiesById: {
    e1: { id: 'e1', name: 'Global State Corp.', reviewStatus: 'CONFIRMED' },
  },
  projectsById: {},
};

describe('seedCapacityFromLegacyConstraints', () => {
  it('returns null when there is nothing to carry forward', () => {
    expect(seedCapacityFromLegacyConstraints({ matrix: ONE_ENTITY_MATRIX })).toBeNull();
  });

  it('returns null when a capacity row already exists for the resolved entity (idempotent)', () => {
    const matrix = {
      ...ONE_ENTITY_MATRIX,
      capacityById: { c1: { id: 'c1', owningEntityId: 'e1', reviewStatus: 'CONFIRMED' } },
    };
    const result = seedCapacityFromLegacyConstraints({
      matrix,
      goalContractWorkWindows: { mon: [{ start: '09:00', end: '12:00' }] },
    });
    expect(result).toBeNull();
  });

  it('returns null when there is no resolvable entity (ambiguous multi-entity, no confirmed projects)', () => {
    const matrix = {
      entitiesById: {
        e1: { id: 'e1', name: 'Entity One' },
        e2: { id: 'e2', name: 'Entity Two' },
      },
      projectsById: {},
    };
    const result = seedCapacityFromLegacyConstraints({
      matrix,
      goalContractWorkWindows: { mon: [{ start: '09:00', end: '12:00' }] },
    });
    expect(result).toBeNull();
  });

  it('resolves the acting entity via the first CONFIRMED project (phase order), not just "the only entity"', () => {
    const matrix = {
      entitiesById: {
        e1: { id: 'e1', name: 'Entity One' },
        e2: { id: 'e2', name: 'Entity Two' },
      },
      projectsById: {
        p2: { id: 'p2', name: 'Later', owningEntityId: 'e2', reviewStatus: 'CONFIRMED', phase: '2' },
        p1: { id: 'p1', name: 'Earlier', owningEntityId: 'e1', reviewStatus: 'CONFIRMED', phase: '1' },
      },
    };
    const result = seedCapacityFromLegacyConstraints({
      matrix,
      goalContractWorkWindows: { mon: [{ start: '09:00', end: '12:00' }] },
    });
    expect(result.entityId).toBe('e1');
  });

  it('carries forward goalContract.workWindows verbatim as a DRAFT row', () => {
    const workWindows = {
      mon: [{ start: '09:00', end: '12:00' }],
      tue: [{ start: '09:00', end: '12:00' }],
      wed: [], thu: [], fri: [], sat: [], sun: [],
    };
    const result = seedCapacityFromLegacyConstraints({
      matrix: ONE_ENTITY_MATRIX,
      goalContractWorkWindows: workWindows,
    });
    expect(result.entityId).toBe('e1');
    expect(result.row.workWindows).toEqual(workWindows);
    expect(result.row.reviewStatus).toBe('DRAFT');
    expect(result.row.owningEntityId).toBe('e1');
    expect(result.row.name).toBe('Global State Corp. Capacity');
  });

  it('falls back to availabilityPolicy workWindows when goalContract has none', () => {
    const workWindows = { mon: [{ start: '10:00', end: '11:00' }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
    const result = seedCapacityFromLegacyConstraints({
      matrix: ONE_ENTITY_MATRIX,
      goalContractWorkWindows: null,
      availabilityPolicyWorkWindows: workWindows,
    });
    expect(result.row.workWindows).toEqual(workWindows);
  });

  it('synthesizes workWindows from strategy.constraints when no workWindows exist anywhere', () => {
    const result = seedCapacityFromLegacyConstraints({
      matrix: ONE_ENTITY_MATRIX,
      strategyConstraints: { maxBlocksPerDay: 2, maxBlocksPerWeek: 8, preferredDaysOfWeek: [1, 3] },
    });
    expect(result).not.toBeNull();
    expect(result.row.workWindows.mon).toEqual([{ start: '09:00', end: '11:00' }]);
    expect(result.row.workWindows.wed).toEqual([{ start: '09:00', end: '11:00' }]);
    expect(result.row.workWindows.tue).toEqual([]);
    expect(result.row.maxBlocksPerDay).toBe(2);
    expect(result.row.maxBlocksPerWeek).toBe(8);
  });

  it('defaults to weekdays when strategy.constraints has no preferredDaysOfWeek', () => {
    const result = seedCapacityFromLegacyConstraints({
      matrix: ONE_ENTITY_MATRIX,
      strategyConstraints: { maxBlocksPerDay: 4, maxBlocksPerWeek: 16 },
    });
    expect(result.row.workWindows.mon.length).toBe(1);
    expect(result.row.workWindows.sat).toEqual([]);
    expect(result.row.workWindows.sun).toEqual([]);
  });

  it('prefers explicit workWindows over strategy.constraints when both exist, but still carries the block caps', () => {
    const workWindows = { mon: [{ start: '09:00', end: '12:00' }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
    const result = seedCapacityFromLegacyConstraints({
      matrix: ONE_ENTITY_MATRIX,
      goalContractWorkWindows: workWindows,
      strategyConstraints: { maxBlocksPerDay: 3, maxBlocksPerWeek: 12, blackoutDayKeys: ['2026-12-25'] },
    });
    expect(result.row.workWindows).toEqual(workWindows);
    expect(result.row.maxBlocksPerDay).toBe(3);
    expect(result.row.maxBlocksPerWeek).toBe(12);
    expect(result.row.blackoutDayKeys).toEqual(['2026-12-25']);
  });
});
