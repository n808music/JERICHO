import { describe, it, expect } from 'vitest';
import { computeStability } from '../../src/state/identityCompute.js';

function iso(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00.000Z`;
}

function makeBlock({ id, practice = 'Focus', label = 'X', start, end, status = 'planned' }) {
  return { id, practice, label, start, end, status };
}

function makeDay({ date, blocks = [], inMonth = true }) {
  let planned = 0;
  let completed = 0;
  for (const b of blocks) {
    const s = new Date(b.start).getTime();
    const e = new Date(b.end).getTime();
    const mins = Math.max(0, (e - s) / 60000);
    planned += mins;
    if (b.status === 'completed') completed += mins;
  }
  const cr = planned > 0 ? completed / planned : 0;

  return {
    date,
    blocks,
    plannedMinutes: planned,
    completedMinutes: completed,
    completionRate: Number.isFinite(cr) ? cr : 0,
    inMonth
  };
}

describe('computeStability (month window)', () => {
  it('treats low completion as dominant and forces overall Weak', () => {
    const days = [
      makeDay({
        date: '2025-12-01',
        blocks: [
          makeBlock({
            id: 'a',
            start: iso('2025-12-01', '10:00'),
            end: iso('2025-12-01', '11:00'),
            status: 'planned'
          })
        ]
      })
    ];

    const s = computeStability({ monthDays: days });
    expect(s.integrityStatus).toBe('low');
    expect(s.overallBand).toBe('Weak');
    expect(s.factorBands.completion).toBe('Weak');
  });

  it('keeps all values finite/bounded when planned is zero', () => {
    const days = [makeDay({ date: '2025-12-01', blocks: [] })];
    const s = computeStability({ monthDays: days });

    expect(Number.isFinite(s.completionRate)).toBe(true);
    expect(Number.isFinite(s.driftScore)).toBe(true);
    expect(Number.isFinite(s.streakScore)).toBe(true);
    expect(Number.isFinite(s.momentumScore)).toBe(true);
    expect(s.completionRate).toBe(0);
    expect(s.driftScore).toBeGreaterThanOrEqual(0);
    expect(s.driftScore).toBeLessThanOrEqual(1);
  });

  it('ignores padded days (inMonth=false) when computing completion and drift', () => {
    const padded = makeDay({
      date: '2025-11-30',
      inMonth: false,
      blocks: [makeBlock({ id: 'p', start: iso('2025-11-30', '10:00'), end: iso('2025-11-30', '12:00'), status: 'completed' })]
    });
    const real = makeDay({ date: '2025-12-01', blocks: [] });

    const s = computeStability({ monthDays: [padded, real] });

    expect(s.completionRate).toBe(0);
    expect(s.integrityStatus).toBe('low');
  });

  it('breaks streak when the latest day is below threshold', () => {
    const days = [
      makeDay({
        date: '2025-12-01',
        blocks: [makeBlock({ id: 'a', start: iso('2025-12-01', '10:00'), end: iso('2025-12-01', '11:00'), status: 'completed' })]
      }),
      makeDay({
        date: '2025-12-02',
        blocks: [makeBlock({ id: 'b', start: iso('2025-12-02', '10:00'), end: iso('2025-12-02', '11:00'), status: 'completed' })]
      }),
      makeDay({
        date: '2025-12-03',
        blocks: [makeBlock({ id: 'c', start: iso('2025-12-03', '10:00'), end: iso('2025-12-03', '11:00'), status: 'planned' })]
      })
    ];

    const s = computeStability({ monthDays: days });
    expect(s.streakDays).toBe(0);
    expect(s.factorBands.streak).toBe('Weak');
  });

  it('produces deterministic recommendations for low integrity', () => {
    const days = [
      makeDay({
        date: '2025-12-01',
        blocks: [
          makeBlock({
            id: 'a',
            practice: 'Focus',
            start: iso('2025-12-01', '10:00'),
            end: iso('2025-12-01', '12:00'),
            status: 'planned'
          })
        ]
      })
    ];

    const s = computeStability({ monthDays: days });
    expect(s.integrityStatus).toBe('low');
    expect(s.recommendations.length).toBeGreaterThan(0);
    expect(s.recommendations[0].key).toBe('protect-one');
  });

  it('when no planned minutes exist, only protect-one recommendation is shown', () => {
    const days = [makeDay({ date: '2025-12-01', blocks: [] })];
    const s = computeStability({ monthDays: days });

    expect(s.integrityStatus).toBe('low');
    expect(s.recommendations.length).toBe(1);
    expect(s.recommendations[0].key).toBe('protect-one');
  });

  it('targets present but no scheduled plan keeps gating unchanged', () => {
    const days = [makeDay({ date: '2025-12-01', blocks: [] })];
    const s = computeStability({
      monthDays: days,
      targetMix: { Body: 0.25, Resources: 0.25, Creation: 0.25, Focus: 0.25 }
    });
    expect(s.integrityStatus).toBe('low');
    expect(s.recommendations.length).toBe(1);
    expect(s.recommendations[0].key).toBe('protect-one');
  });
});
