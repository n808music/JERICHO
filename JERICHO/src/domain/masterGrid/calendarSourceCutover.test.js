import { describe, it, expect } from 'vitest';
import {
  MATRIX_CALENDAR_CUTOVER_DEFAULT,
  matrixCalendarBlocksForCycle,
  resolveCommittedCalendarSource,
  describeCalendarSource,
} from './calendarSourceCutover.js';

const CYCLE_WITH_SCHEDULE = {
  id: 'cycle-1',
  schedule: {
    blocks: [
      { id: 'sb1', startISO: '2026-02-02T09:00:00.000Z', entityId: 'e1', initiativeId: 'i1', sourceProjectId: 'p1', deliverableTitle: 'Foundation' },
      { id: 'sb2', startISO: '2026-02-03T09:00:00.000Z', entityId: 'e1', initiativeId: null, sourceProjectId: 'p2', deliverableTitle: 'Finish' },
    ],
  },
};
const FALLBACK = [{ id: 'fb1', entityId: null, initiativeId: null, sourceProjectId: null }];

describe('calendarSourceCutover — dormant matrix calendar source, gated', () => {
  it('ships DORMANT by default (production live source unchanged until the operator flips)', () => {
    expect(MATRIX_CALENDAR_CUTOVER_DEFAULT).toBe(false);
  });

  it('matrixCalendarBlocksForCycle returns the cycle schedule blocks, [] when absent', () => {
    expect(matrixCalendarBlocksForCycle(CYCLE_WITH_SCHEDULE).map((b) => b.id)).toEqual(['sb1', 'sb2']);
    expect(matrixCalendarBlocksForCycle({ id: 'x' })).toEqual([]);
    expect(matrixCalendarBlocksForCycle(null)).toEqual([]);
  });

  it('cutover OFF → returns the existing fallback unchanged (no live behavior change)', () => {
    expect(resolveCommittedCalendarSource({ cutoverEnabled: false, cycle: CYCLE_WITH_SCHEDULE, fallbackItems: FALLBACK }))
      .toEqual(FALLBACK);
  });

  it('cutover ON + schedule blocks present → overrides committed source with matrix blocks (full identity)', () => {
    const out = resolveCommittedCalendarSource({ cutoverEnabled: true, cycle: CYCLE_WITH_SCHEDULE, fallbackItems: FALLBACK });
    expect(out.map((b) => b.id)).toEqual(['sb1', 'sb2']);
    expect(out[0]).toMatchObject({ entityId: 'e1', initiativeId: 'i1', sourceProjectId: 'p1' });
  });

  it('cutover ON but NO schedule blocks → falls back (never blanks the calendar)', () => {
    const out = resolveCommittedCalendarSource({ cutoverEnabled: true, cycle: { id: 'x' }, fallbackItems: FALLBACK });
    expect(out).toEqual(FALLBACK);
  });

  it('describeCalendarSource labels which source is live, for the operator-visible control', () => {
    expect(describeCalendarSource({ cutoverEnabled: true, cycle: CYCLE_WITH_SCHEDULE }).source).toBe('matrix');
    expect(describeCalendarSource({ cutoverEnabled: false, cycle: CYCLE_WITH_SCHEDULE }).source).toBe('forecast');
    // ON but empty → still forecast, because that's what actually renders.
    expect(describeCalendarSource({ cutoverEnabled: true, cycle: { id: 'x' } }).source).toBe('forecast');
    expect(describeCalendarSource({ cutoverEnabled: true, cycle: CYCLE_WITH_SCHEDULE }).label).toMatch(/matrix/i);
  });
});
