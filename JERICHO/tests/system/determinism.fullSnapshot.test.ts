import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/utils/stableStringify.ts';
import { applyDraft, FIXED_DAY, rebuildPreview, seedScenario } from './_helpers.ts';

function runSnapshot(flags: {
  autoPolicySelection?: boolean;
  enableHistoryPolicySelection?: boolean;
  enableMilestonePacing?: boolean;
  enableQualityOptimizer?: boolean;
}) {
  const initial = seedScenario({ ...flags, withCapacityCaps: true });
  const previewA = rebuildPreview(initial);
  const previewB = rebuildPreview(initial);
  const appliedA = applyDraft(previewA);
  const appliedB = applyDraft(previewB);

  return {
    previewA: stableStringify(previewA.planPreview),
    previewB: stableStringify(previewB.planPreview),
    applyA: stableStringify(appliedA),
    applyB: stableStringify(appliedB),
  };
}

describe('system determinism full snapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is deterministic with optimizer off and advanced posture switches on', () => {
    const snap = runSnapshot({
      autoPolicySelection: true,
      enableHistoryPolicySelection: true,
      enableMilestonePacing: true,
      enableQualityOptimizer: false,
    });

    expect(snap.previewA).toBe(snap.previewB);
    expect(snap.applyA).toBe(snap.applyB);
  });

  it('is deterministic with optimizer on (bounded)', () => {
    const snap = runSnapshot({
      autoPolicySelection: true,
      enableHistoryPolicySelection: true,
      enableMilestonePacing: true,
      enableQualityOptimizer: true,
    });

    expect(snap.previewA).toBe(snap.previewB);
    expect(snap.applyA).toBe(snap.applyB);
  });
});
