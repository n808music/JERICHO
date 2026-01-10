import { describe, expect, it } from 'vitest';
import { deriveProbabilityStatus } from '../../src/state/contracts/probabilityEligibility.ts';

const contract = (overrides = {}) => ({
  contractId: 'c-1',
  version: 1,
  goalId: 'goal-1',
  activeFromISO: '2026-01-01',
  activeUntilISO: '2026-12-31',
  scope: { domainsAllowed: ['Body', 'Focus', 'Creation', 'Resources'], timeHorizon: 'week', timezone: 'America/Chicago' },
  governance: { suggestionsEnabled: true, probabilityEnabled: true, minEvidenceEvents: 2 },
  ...overrides
});

describe('probability governance eligibility', () => {
  it('returns disabled when no active contract', () => {
    const result = deriveProbabilityStatus({
      goalId: 'goal-1',
      nowISO: '2025-12-01',
      executionEventCount: 3,
      contracts: [contract()],
      executionEvents: []
    });
    expect(result.status).toBe('disabled');
    expect(result.reasons).toContain('inactive');
    expect(result.evidenceSummary.totalEvents).toBe(0);
  });

  it('returns insufficient_evidence when threshold unmet', () => {
    const result = deriveProbabilityStatus({
      goalId: 'goal-1',
      nowISO: '2026-02-01',
      executionEventCount: 1,
      contracts: [contract()],
      executionEvents: [{ dateISO: '2026-02-01', completed: true }]
    });
    expect(result.status).toBe('insufficient_evidence');
    expect(result.reasons).toContain('insufficient_evidence');
    expect(result.evidenceSummary.completedCount).toBe(1);
  });

  it('is deterministic for same inputs', () => {
    const input = {
      goalId: 'goal-1',
      nowISO: '2026-02-01',
      executionEventCount: 2,
      contracts: [contract()],
      executionEvents: [
        { dateISO: '2026-02-01', completed: true },
        { dateISO: '2026-02-02', completed: false }
      ]
    };
    const first = deriveProbabilityStatus(input);
    const second = deriveProbabilityStatus(input);
    expect(first).toEqual(second);
  });

  it('returns computed when active and evidence met', () => {
    const result = deriveProbabilityStatus({
      goalId: 'goal-1',
      nowISO: '2026-02-01',
      executionEventCount: 3,
      contracts: [contract({ governance: { suggestionsEnabled: true, probabilityEnabled: true, minEvidenceEvents: 2 } })],
      executionEvents: [
        { dateISO: '2026-01-31', completed: true },
        { dateISO: '2026-02-01', completed: true },
        { dateISO: '2026-02-01', completed: false }
      ]
    });
    expect(result.status).toBe('computed');
    expect(result.reasons).toHaveLength(0);
    expect(result.evidenceSummary.totalEvents).toBe(3);
    expect(result.evidenceSummary.completedCount).toBe(2);
    expect(result.evidenceSummary.daysCovered).toBe(2);
  });
});
