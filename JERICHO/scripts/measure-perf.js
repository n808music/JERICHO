#!/usr/bin/env node

/*
 * Temporary script to measure perf scenario timings for budget recalibration.
 * Runs the perf scenario 10 times and collects phase runtimes.
 */

import { runPerfScenario } from '../src/tests/perf/runPerfScenario.ts';

const CONFIG = {
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

const results = [];

console.log('Running perf scenario 10 times to measure timings...\n');

for (let i = 0; i < 10; i++) {
  console.log(`Run ${i + 1}/10...`);
  const result = runPerfScenario(CONFIG);
  results.push({
    run: i + 1,
    rebuildPreviewMs: result.perf.rebuildPreviewMs,
    optimizeMs: result.perf.optimizeMs || 0,
    applyCommitMs: result.perf.applyCommitMs,
  });
  console.log(`  rebuildPreviewMs: ${result.perf.rebuildPreviewMs}`);
  console.log(`  optimizeMs: ${result.perf.optimizeMs || 0}`);
  console.log(`  applyCommitMs: ${result.perf.applyCommitMs}`);
  console.log('');
}

console.log('=== SUMMARY ===');
console.log('All runs:');
results.forEach((r) => {
  console.log(`Run ${r.run}: rebuild=${r.rebuildPreviewMs}, optimize=${r.optimizeMs}, apply=${r.applyCommitMs}`);
});

function calculateStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
  return { min, max, median };
}

const rebuildStats = calculateStats(results.map((r) => r.rebuildPreviewMs));
const optimizeStats = calculateStats(results.map((r) => r.optimizeMs));
const applyStats = calculateStats(results.map((r) => r.applyCommitMs));

console.log('\n=== STATISTICS ===');
console.log(`rebuildPreviewMs: min=${rebuildStats.min}, max=${rebuildStats.max}, median=${rebuildStats.median}`);
console.log(`optimizeMs: min=${optimizeStats.min}, max=${optimizeStats.max}, median=${optimizeStats.median}`);
console.log(`applyCommitMs: min=${applyStats.min}, max=${applyStats.max}, median=${applyStats.median}`);

console.log('\n=== RECOMMENDED BUDGETS (median + 40% headroom, rounded up to 10ms) ===');
function calculateBudget(median) {
  const budget = median + median * 0.4;
  return Math.ceil(budget / 10) * 10;
}

console.log(`rebuildPreviewMs budget: ${calculateBudget(rebuildStats.median)}`);
console.log(`optimizeMs budget: ${calculateBudget(optimizeStats.median)}`);
console.log(`applyCommitMs budget: ${calculateBudget(applyStats.median)}`);
