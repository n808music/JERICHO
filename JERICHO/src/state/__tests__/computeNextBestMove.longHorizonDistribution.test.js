import { describe, it, expect } from 'vitest';
import { computeNextBestMove, isLongLeadForFilter, isLongLeadForAllocation, areUrgentChainsCleared, applyNonDominationFilter } from '../aimCompute.js';

describe('Task 4: Long-horizon distribution — non-domination hard rule + background-capacity allocation', () => {
  it('detects long-lead blocks: >90 days from scheduledDate', () => {
    const todayKey = '2026-07-31';
    const baseDate = `${todayKey}T00:00:00Z`;

    // Block scheduled 5 days away — not long-lead
    const nearBlock = {
      id: 'near-block',
      scheduledDate: '2026-08-05T09:00:00Z',
    };
    expect(isLongLeadForFilter(nearBlock, 90, baseDate)).toBe(false);

    // Block scheduled 100 days away — is long-lead
    const farBlock = {
      id: 'far-block',
      scheduledDate: '2026-11-08T09:00:00Z', // ~100 days out
    };
    expect(isLongLeadForFilter(farBlock, 90, baseDate)).toBe(true);

    // Block at exactly 90-day boundary — not long-lead (threshold is > not >=)
    const boundaryBlock = {
      id: 'boundary-block',
      scheduledDate: '2026-10-29T00:00:00Z', // exactly 90 days, no time component
    };
    expect(isLongLeadForFilter(boundaryBlock, 90, baseDate)).toBe(false);
  });

  it('detects long-lead Deliverables: >90 days from targetDate', () => {
    const todayKey = '2026-07-31';
    const baseDate = `${todayKey}T00:00:00Z`;

    // Deliverable with target 5 days away — not long-lead
    const nearDeliverable = {
      id: 'd-near',
      targetDate: '2026-08-05T23:59:59Z',
    };
    expect(isLongLeadForAllocation(nearDeliverable, 90, baseDate)).toBe(false);

    // Deliverable with target 100 days away — is long-lead
    const farDeliverable = {
      id: 'd-far',
      targetDate: '2026-11-08T23:59:59Z',
    };
    expect(isLongLeadForAllocation(farDeliverable, 90, baseDate)).toBe(true);
  });

  it('checks if CRITICAL/HIGH chains are cleared (zero urgent items ranked)', () => {
    // Empty ranking — urgent chains cleared
    expect(areUrgentChainsCleared({})).toBe(true);

    // Only MEDIUM/LOW items — chains cleared
    const lowRanking = {
      'd1': { urgencyBand: 'MEDIUM', daysToDeadline: 45 },
      'd2': { urgencyBand: 'LOW', daysToDeadline: 120 },
    };
    expect(areUrgentChainsCleared(lowRanking)).toBe(true);

    // Has CRITICAL item — chains NOT cleared
    const criticalRanking = {
      'd1': { urgencyBand: 'CRITICAL', daysToDeadline: 5 },
    };
    expect(areUrgentChainsCleared(criticalRanking)).toBe(false);

    // Has HIGH item — chains NOT cleared
    const highRanking = {
      'd1': { urgencyBand: 'HIGH', daysToDeadline: 15 },
    };
    expect(areUrgentChainsCleared(highRanking)).toBe(false);
  });

  it('applies non-domination filter: suppresses long-lead blocks when urgent chains exist', () => {
    const todayKey = '2026-07-31';
    const baseDate = `${todayKey}T00:00:00Z`;

    const blocks = [
      {
        id: 'urgent-block',
        start: '2026-07-31T09:00:00Z',
        end: '2026-07-31T10:00:00Z',
        durationMinutes: 60,
        deliverableId: 'd-critical',
        scheduledDate: '2026-07-31T09:00:00Z', // today, not long-lead
      },
      {
        id: 'long-lead-block-1',
        start: '2026-07-31T10:00:00Z',
        end: '2026-07-31T11:00:00Z',
        durationMinutes: 120,
        deliverableId: 'd-long-lead',
        scheduledDate: '2026-11-08T10:00:00Z', // 100+ days away — long-lead
      },
      {
        id: 'long-lead-block-2',
        start: '2026-07-31T11:00:00Z',
        end: '2026-07-31T12:00:00Z',
        durationMinutes: 120,
        deliverableId: 'd-long-lead',
        scheduledDate: '2026-11-08T11:00:00Z', // 100+ days away — long-lead
      },
    ];

    const deliverablesById = {
      'd-critical': { id: 'd-critical', targetDate: '2026-08-15T23:59:59Z' },
      'd-long-lead': { id: 'd-long-lead', targetDate: '2026-11-08T23:59:59Z' },
    };

    // CRITICAL chains exist — suppress long-lead
    const urgencyRanking = {
      'd-critical': { urgencyBand: 'CRITICAL', daysToDeadline: 15 },
    };

    const filtered = applyNonDominationFilter(
      blocks,
      deliverablesById,
      urgencyRanking,
      90,
      todayKey
    );

    // Only urgent block should pass filter
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('urgent-block');
  });

  it('allows long-lead through filter when urgent chains are cleared', () => {
    const todayKey = '2026-07-31';

    const blocks = [
      {
        id: 'long-lead-block',
        start: '2026-07-31T09:00:00Z',
        end: '2026-07-31T10:00:00Z',
        durationMinutes: 120,
        deliverableId: 'd-long-lead',
        scheduledDate: '2026-11-08T09:00:00Z', // 100+ days away
      },
    ];

    const deliverablesById = {
      'd-long-lead': { id: 'd-long-lead', targetDate: '2026-11-08T23:59:59Z' },
    };

    // No urgent chains — empty ranking (cleared)
    const urgencyRanking = {};

    const filtered = applyNonDominationFilter(
      blocks,
      deliverablesById,
      urgencyRanking,
      90,
      todayKey
    );

    // Long-lead should pass when urgent chains are cleared
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('long-lead-block');
  });

  it('real domination scenario: 60+ hour long-lead task suppressed by hard rule', () => {
    const goal = 'Execute project plan';
    const deadlineISO = '2026-08-31T23:59:59Z';
    const todayKey = '2026-07-31';

    // Scenario: A 60-hour long-lead Deliverable would normally dominate the week
    // WITHOUT the filter. With the filter, it should be suppressed until urgent work is done.

    const blocks = [
      // Urgent block (CRITICAL chain exists)
      {
        id: 'urgent-high-value',
        start: '2026-07-31T09:00:00Z',
        end: '2026-07-31T10:00:00Z',
        durationMinutes: 60,
        practice: 'FOCUS',
        domain: 'FOCUS',
        deliverableId: 'd-critical',
        scheduledDate: '2026-07-31T09:00:00Z', // today
      },

      // Long-lead Deliverable with 60+ hours of blocks (would dominate naively)
      {
        id: 'long-lead-1',
        start: '2026-07-31T10:00:00Z',
        end: '2026-07-31T11:00:00Z',
        durationMinutes: 120,
        practice: 'FOCUS',
        domain: 'FOCUS',
        deliverableId: 'd-longterm',
        scheduledDate: '2026-11-08T09:00:00Z', // ~100 days out
      },
      {
        id: 'long-lead-2',
        start: '2026-07-31T11:00:00Z',
        end: '2026-07-31T12:00:00Z',
        durationMinutes: 120,
        practice: 'FOCUS',
        domain: 'FOCUS',
        deliverableId: 'd-longterm',
        scheduledDate: '2026-11-08T11:00:00Z',
      },
      {
        id: 'long-lead-3',
        start: '2026-07-31T12:00:00Z',
        end: '2026-07-31T13:00:00Z',
        durationMinutes: 120,
        practice: 'FOCUS',
        domain: 'FOCUS',
        deliverableId: 'd-longterm',
        scheduledDate: '2026-11-08T13:00:00Z',
      },
      {
        id: 'long-lead-4',
        start: '2026-07-31T13:00:00Z',
        end: '2026-07-31T14:00:00Z',
        durationMinutes: 120,
        practice: 'FOCUS',
        domain: 'FOCUS',
        deliverableId: 'd-longterm',
        scheduledDate: '2026-11-08T14:00:00Z',
      },
    ];

    const deliverablesById = {
      'd-critical': { id: 'd-critical', targetDate: '2026-08-15T23:59:59Z' },
      'd-longterm': { id: 'd-longterm', targetDate: '2026-11-08T23:59:59Z' }, // 100+ days
    };

    // CRITICAL chains exist — long-lead should be suppressed
    const urgencyRanking = {
      'd-critical': { urgencyBand: 'CRITICAL', daysToDeadline: 15 },
    };

    // Call with Task 4 parameters (filter enabled)
    const recommendation = computeNextBestMove(
      goal,
      deadlineISO,
      blocks,
      [],
      todayKey,
      urgencyRanking,
      deliverablesById,
      90 // longLeadThresholdDays
    );

    // Recommendation must be the urgent block, NOT any long-lead block
    expect(recommendation).toBeDefined();
    expect(recommendation.blockId).toBe('urgent-high-value');
    expect(recommendation.deliverableId).toBe('d-critical');

    // Proof: the hard rule is active and suppressing the 480-minute (8-hour) long-lead blocks
    expect(recommendation.blockId).not.toMatch(/long-lead/);
  });

  it('long-lead blocks allowed through when no urgent chains exist', () => {
    const goal = 'Execute project plan';
    const deadlineISO = '2026-08-31T23:59:59Z';
    const todayKey = '2026-07-31';

    const blocks = [
      {
        id: 'long-lead-background',
        start: '2026-07-31T09:00:00Z',
        end: '2026-07-31T10:00:00Z',
        durationMinutes: 120,
        practice: 'FOCUS',
        domain: 'FOCUS',
        deliverableId: 'd-longterm',
        scheduledDate: '2026-11-08T09:00:00Z', // 100+ days out
      },
    ];

    const deliverablesById = {
      'd-longterm': { id: 'd-longterm', targetDate: '2026-11-08T23:59:59Z' },
    };

    // No urgent chains — empty ranking (cleared)
    const urgencyRanking = {};

    // Call with Task 4 parameters
    const recommendation = computeNextBestMove(
      goal,
      deadlineISO,
      blocks,
      [],
      todayKey,
      urgencyRanking,
      deliverablesById,
      90
    );

    // Long-lead block should be recommended when urgent chains are cleared
    expect(recommendation).toBeDefined();
    expect(recommendation.blockId).toBe('long-lead-background');
    expect(recommendation.deliverableId).toBe('d-longterm');
  });
});
