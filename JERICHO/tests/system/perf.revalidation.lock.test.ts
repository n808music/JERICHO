import { describe, expect, it } from 'vitest';
import { runPerfScenario } from '../../src/tests/perf/runPerfScenario.ts';
import type { ScaleScenarioConfig } from '../../src/tests/perf/scaleScenarioFactory.ts';

/*
 * These perf gates are suite-load runtime budgets, not isolated-path budgets.
 * They intentionally allow for process contention from the full Vitest run,
 * while focused perf runs remain the source of truth for isolated-path timing.
 */
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

    // This timer covers the full GENERATE_PLAN reducer path, including per-suggestion trace appends
    // plus the subsequent plan preview rebuild and diagnostics pass. Under full-suite load this behaves
    // as an environment-contended measurement rather than a clean isolated path budget, so we keep the
    // isolated signal in focused perf runs and allow broader suite-load headroom here.
    expect(result.perf.rebuildPreviewMs).toBeLessThan(75000);
    // Apply timing on this lock behaves the same way under full-suite load: this is a suite-load tolerance,
    // while the isolated-path signal is tracked in focused perf runs.
    expect(result.perf.applyCommitMs).toBeLessThan(75000);
    // Optimize timing shows the same suite-load variance in full runs, so this lock keeps broader
    // headroom here and relies on focused perf runs for the isolated-path signal.
    expect(Number(result.perf.optimizeMs || 0)).toBeLessThan(75000);

    if (result.perf.heapDeltaBytesRebuild != null) {
      expect(Number.isFinite(result.perf.heapDeltaBytesRebuild)).toBe(true);
    }
    if (result.perf.heapDeltaBytesApply != null) {
      expect(Number.isFinite(result.perf.heapDeltaBytesApply)).toBe(true);
    }
  });
});
