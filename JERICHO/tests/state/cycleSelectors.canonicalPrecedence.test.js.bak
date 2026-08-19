import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  getCanonicalCycleActions,
  getCanonicalCycleContract,
  getCanonicalProposedBlocks,
  resetMirrorWarningsForTests,
} from '../../src/state/cycleSelectors.js';

describe('cycleSelectors canonical precedence', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    resetMirrorWarningsForTests();
    warnSpy.mockClear();
  });

  afterEach(() => {
    warnSpy.mockClear();
  });

  it('prefers proposedBlocks over suggestedBlocks when both exist', () => {
    const proposed = [{ id: 'p1', title: 'Canonical proposal' }];
    const suggested = [{ id: 's1', title: 'Mirror proposal' }];
    const selected = getCanonicalProposedBlocks(proposed, suggested);

    expect(selected).toBe(proposed);
    expect(selected[0].id).toBe('p1');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('falls back to suggestedBlocks only when canonical proposedBlocks missing', () => {
    const selected = getCanonicalProposedBlocks(null, [{ id: 's1' }]);
    expect(Array.isArray(selected)).toBe(true);
    expect(selected[0].id).toBe('s1');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('prefers cycle.goalContract over goalExecutionContract mirror', () => {
    const canonical = { goalId: 'goal-canonical', goalText: 'Canonical goal' };
    const mirror = { goalId: 'goal-mirror', goalText: 'Mirror goal' };

    const selected = getCanonicalCycleContract({ goalContract: canonical }, mirror);
    expect(selected).toBe(canonical);
    expect(selected.goalId).toBe('goal-canonical');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('prefers canonical goalContract over cycle.contract adapter mirror', () => {
    const canonical = { goalId: 'goal-canonical', goalText: 'Canonical goal' };
    const adapter = { goalId: 'goal-adapter', goalText: 'Adapter goal' };

    const selected = getCanonicalCycleContract({ goalContract: canonical, contract: adapter }, null);
    expect(selected).toBe(canonical);
    expect(selected.goalId).toBe('goal-canonical');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('prefers cycle.actions over llmActionGraph.actions mirror', () => {
    const cycle = {
      actions: [{ id: 'act-canonical', title: 'Canonical Action' }],
      llmActionGraph: { actions: [{ id: 'act-mirror', title: 'Mirror Action' }] },
    };

    const selected = getCanonicalCycleActions(cycle);
    expect(selected[0].id).toBe('act-canonical');
    expect(warnSpy).toHaveBeenCalled();
  });
});
