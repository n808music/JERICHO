import { describe, it, expect } from 'vitest';
import {
  derivePosDisplayPolicy,
  EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER,
} from '../../src/state/engine/probabilityScore.ts';

// ─── POS-W3-006: withheld hides strong confidence ─────────────────────────────

describe('POS-W3-006: withheld display policy', () => {
  it('withheld produces showScore: false and displayValue "—"', () => {
    const policy = derivePosDisplayPolicy('withheld', 75, null);
    expect(policy.showScore).toBe(false);
    expect(policy.displayValue).toBe('—');
  });

  it('withheld suppresses a non-zero posValuePct', () => {
    const policy = derivePosDisplayPolicy('withheld', 80, null);
    expect(policy.displayValue).toBe('—');
    expect(policy.showScore).toBe(false);
  });

  it('withheld displayValue is "—" even when posValuePct is 80', () => {
    const policy = derivePosDisplayPolicy('withheld', 80, 'some qualifier');
    expect(policy.displayValue).toBe('—');
  });

  it('withheld qualifierText is null regardless of passed qualifier', () => {
    const policy = derivePosDisplayPolicy('withheld', 50, 'qualifier text');
    expect(policy.qualifierText).toBeNull();
  });

  it('withheld trustBand is "withheld"', () => {
    const policy = derivePosDisplayPolicy('withheld', null, null);
    expect(policy.trustBand).toBe('withheld');
  });

  it('withheld with null posValuePct still produces showScore: false and displayValue "—"', () => {
    const policy = derivePosDisplayPolicy('withheld', null, null);
    expect(policy.showScore).toBe(false);
    expect(policy.displayValue).toBe('—');
  });
});

// ─── POS-W3-007: provisional shows capped signal with qualifier ───────────────

describe('POS-W3-007: provisional display policy', () => {
  it('provisional with posValuePct shows score', () => {
    const policy = derivePosDisplayPolicy('provisional', 55, null);
    expect(policy.showScore).toBe(true);
    expect(policy.displayValue).toBe('55%');
  });

  it('provisional with qualifier returns qualifierText equal to the qualifier', () => {
    const policy = derivePosDisplayPolicy('provisional', 55, EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER);
    expect(policy.qualifierText).toBe(EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER);
  });

  it('provisional without qualifier returns qualifierText: null', () => {
    const policy = derivePosDisplayPolicy('provisional', 55, null);
    expect(policy.qualifierText).toBeNull();
  });

  it('provisional without qualifier (undefined) returns qualifierText: null', () => {
    const policy = derivePosDisplayPolicy('provisional', 55);
    expect(policy.qualifierText).toBeNull();
  });

  it('provisional with null posValuePct returns displayValue "—" and showScore: false', () => {
    const policy = derivePosDisplayPolicy('provisional', null, null);
    expect(policy.displayValue).toBe('—');
    expect(policy.showScore).toBe(false);
  });

  it('provisional trustBand is "provisional"', () => {
    const policy = derivePosDisplayPolicy('provisional', 40, null);
    expect(policy.trustBand).toBe('provisional');
  });

  it('provisional display value formats integer pct correctly', () => {
    const policy = derivePosDisplayPolicy('provisional', 0, null);
    expect(policy.displayValue).toBe('0%');
  });
});

// ─── POS-W3-008: trusted shows full live signal, no qualifier ─────────────────

describe('POS-W3-008: trusted display policy', () => {
  it('trusted shows full score', () => {
    const policy = derivePosDisplayPolicy('trusted', 82, null);
    expect(policy.showScore).toBe(true);
    expect(policy.displayValue).toBe('82%');
  });

  it('trusted qualifierText is null even when posQualifier is passed', () => {
    const policy = derivePosDisplayPolicy('trusted', 82, EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER);
    expect(policy.qualifierText).toBeNull();
  });

  it('trusted trustBand is "trusted"', () => {
    const policy = derivePosDisplayPolicy('trusted', 82, null);
    expect(policy.trustBand).toBe('trusted');
  });

  it('trusted with null posValuePct returns showScore: false and displayValue "—"', () => {
    const policy = derivePosDisplayPolicy('trusted', null, null);
    expect(policy.showScore).toBe(false);
    expect(policy.displayValue).toBe('—');
  });
});

// ─── POS-W3-009: null trust state preserves legacy behavior ───────────────────

describe('POS-W3-009: null trust state (legacy path)', () => {
  it('null trust state with posValuePct shows score', () => {
    const policy = derivePosDisplayPolicy(null, 60, null);
    expect(policy.showScore).toBe(true);
    expect(policy.displayValue).toBe('60%');
  });

  it('null trust state with null posValuePct shows "—"', () => {
    const policy = derivePosDisplayPolicy(null, null, null);
    expect(policy.showScore).toBe(false);
    expect(policy.displayValue).toBe('—');
  });

  it('null trust state trustBand is "unknown"', () => {
    const policy = derivePosDisplayPolicy(null, 50, null);
    expect(policy.trustBand).toBe('unknown');
  });

  it('null trust state qualifierText is null', () => {
    const policy = derivePosDisplayPolicy(null, 50, 'qualifier text');
    expect(policy.qualifierText).toBeNull();
  });
});

// ─── Cross-trust-state invariants ─────────────────────────────────────────────

describe('Cross-trust-state display invariants', () => {
  it('only provisional passes through qualifierText', () => {
    const qualifier = 'some qualifier';
    expect(derivePosDisplayPolicy('withheld', 50, qualifier).qualifierText).toBeNull();
    expect(derivePosDisplayPolicy('provisional', 50, qualifier).qualifierText).toBe(qualifier);
    expect(derivePosDisplayPolicy('trusted', 50, qualifier).qualifierText).toBeNull();
    expect(derivePosDisplayPolicy(null, 50, qualifier).qualifierText).toBeNull();
  });

  it('only withheld suppresses a non-null score', () => {
    expect(derivePosDisplayPolicy('withheld', 50, null).showScore).toBe(false);
    expect(derivePosDisplayPolicy('provisional', 50, null).showScore).toBe(true);
    expect(derivePosDisplayPolicy('trusted', 50, null).showScore).toBe(true);
    expect(derivePosDisplayPolicy(null, 50, null).showScore).toBe(true);
  });
});
