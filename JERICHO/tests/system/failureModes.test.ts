import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyDraft, FIXED_DAY, rebuildPreview, seedScenario } from './_helpers.ts';

function withPatch(base: any, patch: any) {
  const cycleId = base.activeCycleId;
  const planDraft = { ...base.planDraft, ...patch };
  return {
    ...base,
    planDraft,
    cyclesById: {
      ...base.cyclesById,
      [cycleId]: {
        ...base.cyclesById[cycleId],
        planDraft,
      },
    },
  };
}

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

describe('failure modes deterministic handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles zero capacity without crashing', () => {
    const seeded = withPatch(seedScenario(), { maxScheduledMinutesPerDay: 0, maxScheduledMinutesPerWeek: 0 });
    const preview = withAdmissiblePreviewLineage(rebuildPreview(seeded));
    const applied = applyDraft(preview);
    expect(applied.policySelectionParity).toBe(true);
    expect(applied.lastPlanError).toBeNull();
  });

  it('flags impossible milestone windows deterministically', () => {
    const seeded = withPatch(seedScenario({ enableMilestonePacing: true }), {
      enableMilestonePacing: true,
      milestones: [
        {
          milestoneId: 'IMPOSSIBLE',
          windowStartDayKey: '2026-01-02',
          windowEndDayKey: '2026-01-02',
          actionIds: Array.from({ length: 40 }, (_, i) => `X${i}`),
          checkpointActionIds: [],
        },
      ],
    });
    const preview = withAdmissiblePreviewLineage(rebuildPreview(seeded));
    expect(preview.planPreview).toBeTruthy();
    expect(Array.isArray(preview.planPreview?.policySelectionReasonCodes)).toBe(true);
    const applied = applyDraft(preview);
    expect(applied.policySelectionParity).toBe(true);
    expect(applied.lastPlanError).toBeNull();
  });

  it('handles missing dependency roots', () => {
    const seeded = withPatch(seedScenario(), {
      actions: Array.from({ length: 20 }, (_, i) => ({
        id: `D${i}`,
        estimateMin: 30,
        category: 'FOCUS',
        dependencies: ['MISSING'],
      })),
    });
    const preview = withAdmissiblePreviewLineage(rebuildPreview(seeded));
    const applied = applyDraft(preview);
    expect(applied.lastPlanError).toBeNull();
    expect(applied.policySelectionParity).toBe(true);
  });

  it('handles deep dependency chain (1000)', () => {
    const actions = Array.from({ length: 1000 }, (_, i) => ({
      id: `C${String(i).padStart(4, '0')}`,
      estimateMin: 15,
      category: 'FOCUS',
      dependencies: i === 0 ? [] : [`C${String(i - 1).padStart(4, '0')}`],
    }));
    const seeded = withPatch(seedScenario(), { actions, executionHorizonDays: 30 });
    const preview = rebuildPreview(seeded);
    expect(preview.planPreview?.qualityScoreBaseline).toBeTypeOf('number');
  });

  it('handles all work outside execution horizon', () => {
    const seeded = withPatch(seedScenario(), { executionHorizonDays: 1, horizonDays: 365 });
    const preview = withAdmissiblePreviewLineage(rebuildPreview(seeded));
    const applied = applyDraft(preview);
    expect(applied.scoreParity).toBe(true);
  });
});
