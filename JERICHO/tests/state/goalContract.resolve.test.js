import { describe, expect, it } from 'vitest';
import { resolveActiveContract } from '../../src/state/contracts/goalContract.resolve.ts';

const base = (overrides = {}) => ({
  contractId: 'c-1',
  version: 1,
  goalId: 'goal-1',
  activeFromISO: '2026-01-01',
  activeUntilISO: '2026-12-31',
  scope: {
    domainsAllowed: ['Body', 'Focus', 'Creation', 'Resources'],
    timeHorizon: 'week',
    timezone: 'America/Chicago'
  },
  governance: {
    suggestionsEnabled: true,
    probabilityEnabled: true,
    minEvidenceEvents: 0
  },
  ...overrides
});

describe('resolveActiveContract', () => {
  it('selects highest version when multiple active', () => {
    const contracts = [
      base({ contractId: 'c-1', version: 1 }),
      base({ contractId: 'c-2', version: 2 })
    ];
    const resolved = resolveActiveContract('goal-1', contracts, '2026-06-01');
    expect(resolved.contract?.contractId).toBe('c-2');
    expect(resolved.reasonCode).toBe('multiple_active');
  });

  it('returns null when inactive', () => {
    const contracts = [base({ activeFromISO: '2026-06-01', activeUntilISO: '2026-06-30' })];
    const resolved = resolveActiveContract('goal-1', contracts, '2026-05-01');
    expect(resolved.contract).toBe(null);
    expect(resolved.reasonCode).toBe('inactive');
  });

  it('returns null when goalId does not match', () => {
    const contracts = [base({ goalId: 'other-goal' })];
    const resolved = resolveActiveContract('goal-1', contracts, '2026-06-01');
    expect(resolved.contract).toBe(null);
    expect(resolved.reasonCode).toBe('no_match');
  });
});
