import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyDraft, FIXED_DAY, rebuildPreview, seedScenario } from './_helpers.ts';

function withAdmissiblePreviewLineage(preview: any) {
  const cycleId = preview.activeCycleId;
  const cycle = preview.cyclesById?.[cycleId];
  const goalId = cycle?.goalContract?.goalId;
  const deliverableId = cycle?.canonicalDeliverables?.[0]?.id || cycle?.deliverables?.[0]?.id || 'd1';
  const actionId = cycle?.actions?.[0]?.id || 'A0001';
  const decorate = (block: any, index: number) => ({
    ...block,
    title: block?.title || `Ship v0 block ${index + 1}`,
    rawLabel: block?.rawLabel || block?.title || `Ship v0 block ${index + 1}`,
    deliverableId,
    actionId,
    cycleId,
    goalId,
  });
  const proposedBlocks = (preview.proposedBlocks || []).map(decorate);
  const suggestedBlocks = (preview.suggestedBlocks || []).map(decorate);
  return {
    ...preview,
    proposedBlocks,
    suggestedBlocks,
    cyclesById: {
      ...preview.cyclesById,
      [cycleId]: {
        ...cycle,
        proposedBlocks,
        suggestedBlocks,
      },
    },
  };
}

function* combinations() {
  const bools = [false, true];
  for (const enableQualityOptimizer of bools)
    for (const autoPolicySelection of bools)
      for (const enableHistoryPolicySelection of bools)
        for (const enableMilestonePacing of bools)
          for (const withCapacityCaps of bools)
            yield {
              enableQualityOptimizer,
              autoPolicySelection,
              enableHistoryPolicySelection,
              enableMilestonePacing,
              withCapacityCaps,
            };
}

describe('mode combinations stress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps parity/invariants across all flag combinations', () => {
    for (const flags of combinations()) {
      const seeded = seedScenario(flags);
      const preview = withAdmissiblePreviewLineage(rebuildPreview(seeded));
      const applied = applyDraft(preview);

      expect(applied.policySelectionParity).toBe(true);
      expect(applied.scoreParity).toBe(true);
      expect(applied.pacingParity).toBe(true);
      expect(applied.lastPlanError).toBeNull();

      const byMilestone = preview.planPreview?.pacingInjectedByMilestone || {};
      Object.values<any>(byMilestone).forEach((entry) => {
        const ids = entry?.ids || [];
        expect(new Set(ids).size).toBe(ids.length);
      });

      const slack = Number(preview.planPreview?.pacingSlackRatio || 0);
      expect(Number.isNaN(slack)).toBe(false);
      expect(slack).toBeGreaterThanOrEqual(0);
    }
  });
});
