import { describe, expect, it } from 'vitest';
import { authorizeProbability, authorizeSuggestion, isContractActive, validateContract } from '../../src/state/contracts/goalContract.validate.ts';

const baseContract = {
  contractId: 'gov-1',
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
    minEvidenceEvents: 2,
    cooldowns: { resuggestMinutes: 30, maxSuggestionsPerDay: 2 }
  },
  constraints: {
    forbiddenDirectives: ['repair'],
    maxActiveBlocks: 3
  }
};

describe('goal governance contract', () => {
  it('validates structural requirements', () => {
    const validation = validateContract(baseContract);
    expect(validation.valid).toBe(true);
  });

  it('blocks suggestion and probability when inactive', () => {
    const nowISO = '2025-12-01';
    expect(isContractActive(baseContract, nowISO)).toBe(false);
    const suggestionGate = authorizeSuggestion(baseContract, {
      nowISO,
      executionEventCount: 5,
      activeBlocksCount: 0
    });
    const probabilityGate = authorizeProbability(baseContract, { nowISO, executionEventCount: 5 });
    expect(suggestionGate.allowed).toBe(false);
    expect(probabilityGate.allowed).toBe(false);
  });

  it('blocks probability when evidence is insufficient', () => {
    const gate = authorizeProbability(baseContract, { nowISO: '2026-01-10', executionEventCount: 1 });
    expect(gate.allowed).toBe(false);
    expect(gate.reasons).toContain('insufficient_evidence');
  });

  it('filters forbidden directives', () => {
    const gate = authorizeSuggestion(baseContract, {
      nowISO: '2026-01-10',
      executionEventCount: 3,
      activeBlocksCount: 0,
      directiveTags: ['repair']
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reasons).toContain('forbidden_directive');
  });

  it('enforces cooldown and daily limits', () => {
    const gate = authorizeSuggestion(baseContract, {
      nowISO: '2026-01-10',
      executionEventCount: 3,
      activeBlocksCount: 0,
      lastSuggestedAtISO: '2026-01-10T00:10:00.000Z',
      suggestionsTodayCount: 2
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reasons).toContain('cooldown');
    expect(gate.reasons).toContain('daily_limit');
  });

  it('blocks suggestions when max active blocks reached', () => {
    const gate = authorizeSuggestion(baseContract, {
      nowISO: '2026-01-10',
      executionEventCount: 3,
      activeBlocksCount: 3
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reasons).toContain('max_active_blocks');
  });
});
