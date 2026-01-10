import { describe, it, expect } from 'vitest';
import { deriveProbabilityStatus } from '../contracts/probabilityEligibility.ts';

describe('probability eligibility', () => {
  it('does not disable probability for active contracts when probabilityEnabled is false', () => {
    const nowISO = '2026-01-08T12:00:00.000Z';
    const goalId = 'goal-1';
    const contracts = [
      {
        contractId: 'gov-1',
        version: 1,
        goalId,
        activeFromISO: '2026-01-01',
        activeUntilISO: '2026-02-01',
        scope: { domainsAllowed: ['Body'], timeHorizon: 'week', timezone: 'UTC' },
        governance: {
          suggestionsEnabled: true,
          probabilityEnabled: false,
          minEvidenceEvents: 1,
          cooldowns: { resuggestMinutes: 30, maxSuggestionsPerDay: 6 }
        },
        constraints: { forbiddenDirectives: [], maxActiveBlocks: 6 }
      }
    ];

    const result = deriveProbabilityStatus({
      goalId,
      nowISO,
      executionEventCount: 0,
      contracts,
      executionEvents: []
    });

    expect(result.status).not.toBe('disabled');
    expect(result.reasons).not.toContain('probability_disabled');
    expect(result.contractId).toBe('gov-1');
  });
});
