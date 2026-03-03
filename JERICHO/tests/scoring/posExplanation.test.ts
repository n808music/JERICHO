import { describe, expect, it } from 'vitest';
import { aggregateCycleOutcomes, buildPosExplanation } from '../../src/domain/scoring/posExplanation.ts';

describe('posExplanation', () => {
  it('returns POS_NO_PLAN when feasibility is missing', () => {
    const explanation = buildPosExplanation({
      cycleId: 'cycle-1',
      nowISO: '2026-03-10T12:00:00.000Z',
      posPrev: null,
      posNow: null,
      feasibilityPrev: 0.8,
      feasibilityNow: null,
      integrityPrev: 1,
      integrityNow: 1,
      conflictsNow: [],
      outcomeAggPrev: null,
      outcomeAggNow: null,
    });

    expect(explanation.reasons).toHaveLength(1);
    expect(explanation.reasons[0].code).toBe('POS_NO_PLAN');
  });

  it('returns POS_UNSCHEDULABLE as dominant reason when feasibility is zero with unschedulable conflicts', () => {
    const explanation = buildPosExplanation({
      cycleId: 'cycle-1',
      nowISO: '2026-03-10T12:00:00.000Z',
      posPrev: 0.5,
      posNow: 0,
      feasibilityPrev: 0.4,
      feasibilityNow: 0,
      integrityPrev: 0.8,
      integrityNow: 0.6,
      conflictsNow: ['UNSCHEDULABLE'],
      outcomeAggPrev: null,
      outcomeAggNow: null,
    });

    expect(explanation.reasons).toHaveLength(1);
    expect(explanation.reasons[0].code).toBe('POS_UNSCHEDULABLE');
  });

  it('includes missed-work down reason when missed delta increases', () => {
    const explanation = buildPosExplanation({
      cycleId: 'cycle-1',
      nowISO: '2026-03-10T12:00:00.000Z',
      posPrev: 0.8,
      posNow: 0.7,
      feasibilityPrev: 0.8,
      feasibilityNow: 0.8,
      integrityPrev: 0.8,
      integrityNow: 0.7,
      conflictsNow: [],
      outcomeAggPrev: {
        missedMinutes: 0,
        missedBlocks: 0,
        lateMinutes: 0,
        lateBlocks: 0,
        onTimeMinutes: 60,
        onTimeBlocks: 1,
        earlyReschedMinutes: 0,
        earlyReschedBlocks: 0,
        lateReschedMinutes: 0,
        lateReschedBlocks: 0,
        canceledValidMinutes: 0,
        canceledValidBlocks: 0,
        canceledWeakMinutes: 0,
        canceledWeakBlocks: 0,
        totalMinutesCounted: 60,
      },
      outcomeAggNow: {
        missedMinutes: 60,
        missedBlocks: 1,
        lateMinutes: 0,
        lateBlocks: 0,
        onTimeMinutes: 60,
        onTimeBlocks: 1,
        earlyReschedMinutes: 0,
        earlyReschedBlocks: 0,
        lateReschedMinutes: 0,
        lateReschedBlocks: 0,
        canceledValidMinutes: 0,
        canceledValidBlocks: 0,
        canceledWeakMinutes: 0,
        canceledWeakBlocks: 0,
        totalMinutesCounted: 120,
      },
    });

    expect(explanation.reasons.some((reason) => reason.code === 'POS_DOWN_MISSED_WORK')).toBe(true);
  });

  it('includes feasibility decrease reason when feasibility drops by >=0.01', () => {
    const explanation = buildPosExplanation({
      cycleId: 'cycle-1',
      nowISO: '2026-03-10T12:00:00.000Z',
      posPrev: 0.8,
      posNow: 0.7,
      feasibilityPrev: 0.8,
      feasibilityNow: 0.7,
      integrityPrev: 1,
      integrityNow: 1,
      conflictsNow: [],
      outcomeAggPrev: null,
      outcomeAggNow: null,
    });

    expect(explanation.reasons.some((reason) => reason.code === 'POS_DOWN_FEASIBILITY_DECREASE')).toBe(true);
  });

  it('trims to top 3 reasons and keeps deterministic magnitude ordering', () => {
    const explanation = buildPosExplanation({
      cycleId: 'cycle-1',
      nowISO: '2026-03-10T12:00:00.000Z',
      posPrev: 0.9,
      posNow: 0.4,
      feasibilityPrev: 0.95,
      feasibilityNow: 0.6,
      integrityPrev: 0.95,
      integrityNow: 0.55,
      conflictsNow: [],
      outcomeAggPrev: {
        missedMinutes: 0,
        missedBlocks: 0,
        lateMinutes: 0,
        lateBlocks: 0,
        onTimeMinutes: 0,
        onTimeBlocks: 0,
        earlyReschedMinutes: 0,
        earlyReschedBlocks: 0,
        lateReschedMinutes: 0,
        lateReschedBlocks: 0,
        canceledValidMinutes: 0,
        canceledValidBlocks: 0,
        canceledWeakMinutes: 0,
        canceledWeakBlocks: 0,
        totalMinutesCounted: 0,
      },
      outcomeAggNow: {
        missedMinutes: 180,
        missedBlocks: 3,
        lateMinutes: 60,
        lateBlocks: 1,
        onTimeMinutes: 30,
        onTimeBlocks: 1,
        earlyReschedMinutes: 15,
        earlyReschedBlocks: 1,
        lateReschedMinutes: 45,
        lateReschedBlocks: 1,
        canceledValidMinutes: 20,
        canceledValidBlocks: 1,
        canceledWeakMinutes: 20,
        canceledWeakBlocks: 1,
        totalMinutesCounted: 370,
      },
    });

    expect(explanation.reasons).toHaveLength(3);
    const magnitudes = explanation.reasons.map((reason) => reason.magnitude);
    expect(magnitudes[0]).toBeGreaterThanOrEqual(magnitudes[1]);
    expect(magnitudes[1]).toBeGreaterThanOrEqual(magnitudes[2]);
  });

  it('aggregates outcomes for cycle-only past blocks', () => {
    const nowISO = '2026-03-10T12:00:00.000Z';
    const agg = aggregateCycleOutcomes({
      cycleId: 'cycle-a',
      nowISO,
      blocks: [
        {
          id: '1',
          cycleId: 'cycle-a',
          scheduledStartISO: '2026-03-09T10:00:00.000Z',
          endISO: '2026-03-09T11:00:00.000Z',
          durationMinutes: 60,
          outcome: 'MISSED',
        },
        {
          id: '2',
          cycleId: 'cycle-a',
          start: '2026-03-10T13:00:00.000Z',
          end: '2026-03-10T14:00:00.000Z',
          durationMinutes: 60,
          outcome: 'COMPLETED_ON_TIME',
        },
        {
          id: '3',
          cycleId: 'cycle-b',
          start: '2026-03-09T09:00:00.000Z',
          end: '2026-03-09T10:00:00.000Z',
          durationMinutes: 60,
          outcome: 'COMPLETED_LATE',
        },
      ],
    });

    expect(agg.missedBlocks).toBe(1);
    expect(agg.onTimeBlocks).toBe(0);
    expect(agg.totalMinutesCounted).toBe(60);
  });
});
