import { describe, expect, it } from 'vitest';
import { computeCycleIntegrityScore } from '../../src/domain/scoring/cycleScoring.ts';

describe('cycleScoring integrity', () => {
  it('returns 1.0 when no past cycle blocks exist', () => {
    const result = computeCycleIntegrityScore({
      cycleId: 'cycle-1',
      nowISO: '2026-03-10T12:00:00.000Z',
      blocks: [
        {
          id: 'future-1',
          cycleId: 'cycle-1',
          start: '2026-03-11T09:00:00.000Z',
          end: '2026-03-11T10:00:00.000Z',
          durationMinutes: 60,
          outcome: 'MISSED',
        },
      ],
    });

    expect(result.integrityScore).toBe(1);
    expect(result.minutesTotal).toBe(0);
  });

  it('computes deterministic duration-weighted integrity across mixed outcomes', () => {
    const result = computeCycleIntegrityScore({
      cycleId: 'cycle-1',
      nowISO: '2026-03-10T12:00:00.000Z',
      blocks: [
        {
          id: 'b1',
          cycleId: 'cycle-1',
          start: '2026-03-09T09:00:00.000Z',
          end: '2026-03-09T11:00:00.000Z',
          durationMinutes: 120,
          outcome: 'COMPLETED_ON_TIME',
        },
        {
          id: 'b2',
          cycleId: 'cycle-1',
          start: '2026-03-09T12:00:00.000Z',
          end: '2026-03-09T13:00:00.000Z',
          durationMinutes: 60,
          outcome: 'COMPLETED_LATE',
        },
        {
          id: 'b3',
          cycleId: 'cycle-1',
          start: '2026-03-08T12:00:00.000Z',
          end: '2026-03-08T13:00:00.000Z',
          durationMinutes: 60,
          outcome: 'MISSED',
        },
      ],
    });

    // (120*1.0 + 60*0.5 + 60*0.0) / 240 = 0.625
    expect(result.integrityScore).toBeCloseTo(0.625, 6);
    expect(result.minutesTotal).toBe(240);
  });

  it('ignores blocks from other cycles', () => {
    const result = computeCycleIntegrityScore({
      cycleId: 'cycle-a',
      nowISO: '2026-03-10T12:00:00.000Z',
      blocks: [
        {
          id: 'a-1',
          cycleId: 'cycle-a',
          start: '2026-03-09T09:00:00.000Z',
          end: '2026-03-09T10:00:00.000Z',
          durationMinutes: 60,
          outcome: 'COMPLETED_ON_TIME',
        },
        {
          id: 'b-1',
          cycleId: 'cycle-b',
          start: '2026-03-09T09:00:00.000Z',
          end: '2026-03-09T10:00:00.000Z',
          durationMinutes: 60,
          outcome: 'MISSED',
        },
      ],
    });

    expect(result.integrityScore).toBe(1);
    expect(result.minutesTotal).toBe(60);
  });

  it('excludes future scheduled starts from cycle-to-date window', () => {
    const result = computeCycleIntegrityScore({
      cycleId: 'cycle-1',
      nowISO: '2026-03-10T12:00:00.000Z',
      blocks: [
        {
          id: 'past',
          cycleId: 'cycle-1',
          scheduledStartISO: '2026-03-10T11:00:00.000Z',
          endISO: '2026-03-10T12:00:00.000Z',
          durationMinutes: 60,
          outcome: 'MISSED',
        },
        {
          id: 'future',
          cycleId: 'cycle-1',
          scheduledStartISO: '2026-03-10T13:00:00.000Z',
          endISO: '2026-03-10T14:00:00.000Z',
          durationMinutes: 60,
          outcome: 'COMPLETED_ON_TIME',
        },
      ],
    });

    expect(result.minutesTotal).toBe(60);
    expect(result.integrityScore).toBe(0);
  });
});
