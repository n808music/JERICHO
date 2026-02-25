import { describe, expect, it } from 'vitest';
import { runPerfScenario } from '../../src/tests/perf/runPerfScenario.ts';
import type { ScaleScenarioConfig } from '../../src/tests/perf/scaleScenarioFactory.ts';

const CONFIG: ScaleScenarioConfig = {
  scenarioId: 'phase2_perf_lock_2k',
  horizon: { startDayKey: '2026-01-01', endDayKey: '2026-12-31' },
  executionHorizonDays: 365,
  actions: {
    count: 2000,
    estimatePatternMin: [30, 45, 60, 90],
    categoryPattern: ['FOCUS', 'CREATION', 'ADMIN'],
    deps: { mode: 'layered', depth: 20, fan: 4 },
  },
  milestones: {
    count: 8,
    windowDays: 21,
    spacingDays: 42,
    attachEveryNActions: 90,
    checkpointActionIds: 'auto',
  },
  optimizerMode: 'on',
  qualityPolicyId: 'BALANCED',
  autoPolicySelection: true,
  enableMilestonePacing: true,
  enableHistoryPolicySelection: true,
  historyWindowCycles: 5,
  historyInfluenceStrength: 'standard',
};

describe('phase2 perf revalidation lock', () => {
  it('remains within conservative runtime bounds with optimizer on', () => {
    const result = runPerfScenario(CONFIG);
    expect(result.parity.scheduleParity).toBe(true);
    expect(result.parity.scoreParity).toBe(true);
    expect(result.parity.policyParity).toBe(true);

    expect(result.perf.rebuildPreviewMs).toBeLessThan(6000);
    expect(result.perf.applyCommitMs).toBeLessThan(6000);
    expect(Number(result.perf.optimizeMs || 0)).toBeLessThan(7000);

    if (result.perf.heapDeltaBytesRebuild != null) {
      expect(Number.isFinite(result.perf.heapDeltaBytesRebuild)).toBe(true);
    }
    if (result.perf.heapDeltaBytesApply != null) {
      expect(Number.isFinite(result.perf.heapDeltaBytesApply)).toBe(true);
    }
  });
});
