import { describe, it, expect } from 'vitest';
import { buildOperationEndgameReferenceState } from '../../src/dev/operationEndgameRestore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';

// Regression guard for the enterprise-scale UI freeze / idle crash.
// At Operation-Endgame scale the full-horizon substrate is ~1k+ forecast blocks
// (~6MB per derived array). computeDerivedState runs on EVERY mutation, so if the
// full-horizon expansion is rebuilt each time, a single keystroke costs ~900ms and
// allocates ~12MB of garbage — the mechanism behind the freeze and the long-session
// crash. The full-horizon derivation must be memoized on its inputs so a mutation
// that does not touch those inputs reuses the prior result.
const TRIVIAL = { type: 'SET_VIEW_DATE', date: '2026-07-09' };

describe('full-horizon derivation is memoized at enterprise scale', () => {
  it('recomputes derived state well under the freeze threshold for an unrelated mutation', () => {
    const state = buildOperationEndgameReferenceState();
    // Confirm this fixture actually carries the heavy full-horizon substrate.
    expect(Array.isArray(state.fullHorizonScheduleBlocks)).toBe(true);
    expect(state.fullHorizonScheduleBlocks.length).toBeGreaterThan(100);

    // Chain outputs forward the way the reducer does: each mutation computes from
    // the prior derived state, which carries the memo key. A first warm compute
    // establishes the key, then repeated unrelated mutations must hit the memo.
    let s = computeDerivedState(state, TRIVIAL);
    const iterations = 5;
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) s = computeDerivedState(s, TRIVIAL);
    const perCall = (performance.now() - t0) / iterations;
    // Pre-fix this is ~900ms. Post-fix (memo hit + clone) is a few tens of ms.
    // 300ms is a generous ceiling that still catches the regression on slow CI.
    expect(perCall).toBeLessThan(300);
  });

  it('preserves full-horizon output across an unrelated mutation (memo reuse is not corruption)', () => {
    const state = buildOperationEndgameReferenceState();
    const before = computeDerivedState(state, TRIVIAL);
    const after = computeDerivedState(before, TRIVIAL);
    expect(after.fullHorizonScheduleBlocks.length).toBe(before.fullHorizonScheduleBlocks.length);
    expect(after.calendarDisplayBlocks.length).toBe(before.calendarDisplayBlocks.length);
    expect(after.fullHorizonScheduleBlocks.length).toBeGreaterThan(100);
  });
});
