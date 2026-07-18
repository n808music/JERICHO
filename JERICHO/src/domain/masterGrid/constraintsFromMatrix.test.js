import { describe, it, expect } from 'vitest';
import { buildConstraintsFromMatrix } from './constraintsFromMatrix.js';

const ENTITY_ONLY = { entitiesById: { e1: { id: 'e1', name: 'Global State Corp.' } } };

describe('buildConstraintsFromMatrix', () => {
  it('returns null when there is no capacity data at all', () => {
    expect(buildConstraintsFromMatrix({})).toBeNull();
    expect(buildConstraintsFromMatrix(ENTITY_ONLY)).toBeNull();
  });

  it('returns null when capacity exists but is not CONFIRMED', () => {
    const matrix = {
      ...ENTITY_ONLY,
      capacityById: {
        c1: {
          id: 'c1',
          owningEntityId: 'e1',
          reviewStatus: 'DRAFT',
          workWindows: { mon: [{ start: '09:00', end: '17:00' }] },
        },
      },
    };
    expect(buildConstraintsFromMatrix(matrix)).toBeNull();
  });

  it('translates a CONFIRMED single-entity capacity row into generator constraints', () => {
    const matrix = {
      ...ENTITY_ONLY,
      capacityById: {
        c1: {
          id: 'c1',
          owningEntityId: 'e1',
          reviewStatus: 'CONFIRMED',
          maxBlocksPerDay: 4,
          maxBlocksPerWeek: 16,
          blackoutDayKeys: ['2026-12-25'],
          workWindows: {
            mon: [{ start: '09:00', end: '12:00' }], // 180 min -> 3 blocks
            tue: [{ start: '09:00', end: '12:00' }],
            wed: [], thu: [], fri: [], sat: [], sun: [],
          },
        },
      },
    };
    const result = buildConstraintsFromMatrix(matrix);
    expect(result).toEqual({
      maxBlocksPerDay: 3, // min(declared 4, floor(180/60)=3)
      maxBlocksPerWeek: 6, // min(declared 16, floor(360/60)=6)
      preferredDaysOfWeek: [1, 2], // mon, tue
      blackoutDayKeys: ['2026-12-25'],
    });
  });

  it('resolves the acting entity via the first CONFIRMED project when multiple capacity rows exist', () => {
    const matrix = {
      entitiesById: {
        e1: { id: 'e1', name: 'Entity One' },
        e2: { id: 'e2', name: 'Entity Two' },
      },
      projectsById: {
        p1: { id: 'p1', name: 'Confirmed Work', owningEntityId: 'e2', reviewStatus: 'CONFIRMED', phase: '1' },
      },
      capacityById: {
        c1: {
          id: 'c1', owningEntityId: 'e1', reviewStatus: 'CONFIRMED', maxBlocksPerDay: 2, maxBlocksPerWeek: 8,
          workWindows: { mon: [{ start: '09:00', end: '10:00' }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
        },
        c2: {
          id: 'c2', owningEntityId: 'e2', reviewStatus: 'CONFIRMED', maxBlocksPerDay: 5, maxBlocksPerWeek: 20,
          workWindows: { mon: [{ start: '09:00', end: '14:00' }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
        },
      },
    };
    const result = buildConstraintsFromMatrix(matrix);
    // e2 owns the confirmed project -> c2's capacity should be used, not c1's.
    expect(result.maxBlocksPerDay).toBe(5);
  });

  it('never lets the declared cap exceed what the actual windows can physically hold', () => {
    const matrix = {
      ...ENTITY_ONLY,
      capacityById: {
        c1: {
          id: 'c1',
          owningEntityId: 'e1',
          reviewStatus: 'CONFIRMED',
          maxBlocksPerDay: 10, // wildly over-declared
          maxBlocksPerWeek: 50,
          workWindows: {
            mon: [{ start: '09:00', end: '10:00' }], // only 60 min = 1 block
            tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
          },
        },
      },
    };
    const result = buildConstraintsFromMatrix(matrix);
    expect(result.maxBlocksPerDay).toBe(1);
    expect(result.maxBlocksPerWeek).toBe(1);
  });

  it('returns null when the CONFIRMED row has no non-empty work windows', () => {
    const matrix = {
      ...ENTITY_ONLY,
      capacityById: {
        c1: {
          id: 'c1',
          owningEntityId: 'e1',
          reviewStatus: 'CONFIRMED',
          workWindows: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
        },
      },
    };
    expect(buildConstraintsFromMatrix(matrix)).toBeNull();
  });
});
