// From project root:
// node scripts/behavior-simulation.js
//
// Simulates multiple cycles without HTTP to study how task mix, integrity, and cycle modes evolve
// for different user behavior profiles. Uses the same pipeline and task status logic as the API.

import { runPipeline } from '../src/core/pipeline.js';
import { normalizeStateForPipeline } from '../src/core/state-normalization.js';

// Must satisfy validate-goal: "I will <outcome> by YYYY-MM-DD"
const DEFAULT_GOAL = 'I will grow revenue to 10000 per month by 2026-07-06';

const DEFAULT_INTEGRITY = {
  score: 0,
  completedCount: 0,
  pendingCount: 0,
  missedCount: 0,
  breakdown: {
    completedOnTime: 0,
    completedLate: 0,
    missed: 0,
    totalTasks: 0,
    completionRate: 0,
    onTimeRate: 0
  }
};

function createDefaultState(goal = DEFAULT_GOAL) {
  return normalizeStateForPipeline({
    goals: [goal],
    identity: {},
    history: [],
    tasks: [],
    integrity: { ...DEFAULT_INTEGRITY },
    team: {}
  });
}

function hashSeed(seed) {
  const str = String(seed ?? 'seed');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  return mulberry32(hashSeed(seed));
}

function applyTaskStatusToState(state, taskId, status, taskMeta = {}) {
  const tasks = Array.isArray(state.tasks) ? [...state.tasks] : [];
  let found = false;
  let matchedTask = null;
  const updatedTasks = tasks.map((task) => {
    if (task.id === taskId) {
      found = true;
      matchedTask = task;
      return { ...task, status };
    }
    return task;
  });
  if (!found) {
    matchedTask = {
      id: taskId,
      status,
      domain: taskMeta.domain || 'unknown',
      capability: taskMeta.capability || 'unknown',
      tier: taskMeta.tier || 'T1',
      effortMinutes: taskMeta.effortMinutes ?? 60,
      goalLink: taskMeta.goalLink || 'goal'
    };
    updatedTasks.push(matchedTask);
  }
  const history = Array.isArray(state.history) ? [...state.history] : [];
  history.push({
    id: matchedTask.id || taskId,
    taskId: matchedTask.id || taskId,
    domain: matchedTask.domain || 'unknown',
    capability: matchedTask.capability || 'unknown',
    tier: matchedTask.tier || 'T1',
    effortMinutes: matchedTask.effortMinutes ?? 60,
    goalLink: matchedTask.goalLink || 'goal',
    status,
    timestamp: new Date().toISOString(),
    integrity: {
      score: 0,
      breakdown: {}
    }
  });
  return { ...state, tasks: updatedTasks, history };
}

function simulateProfile(profile) {
  const rng = makeRng(profile.randomSeed || profile.name || 'profile');
  let state = createDefaultState(profile.goal || DEFAULT_GOAL);
  const integrityHistory = [];
  const tierTally = { T1: 0, T2: 0, T3: 0 };
  const modeCounts = {};
  let allowedSum = 0;

  for (let cycle = 1; cycle <= profile.maxCycles; cycle++) {
    const result = runPipeline(
      { goals: state.goals || [] },
      state.identity || {},
      state.history || [],
      state.tasks || [],
      state.team || {}
    );
    const allowedTasks =
      result.analysis?.cycleGovernance?.allowedTasks ?? result.taskBoard?.summary?.allowedTasks ?? null;
    const mode =
      result.analysis?.cycleGovernance?.mode ||
      result.tasks?.[0]?.cycleMode ||
      result.taskBoard?.tasks?.[0]?.cycleMode ||
      'normal';

    const cycleTiers = countTiers(result.tasks || []);
    tierTally.T1 += cycleTiers.T1;
    tierTally.T2 += cycleTiers.T2;
    tierTally.T3 += cycleTiers.T3;
    modeCounts[mode] = (modeCounts[mode] || 0) + 1;
    if (Number.isFinite(allowedTasks)) allowedSum += allowedTasks;

    const integrityScore = result.integrity?.score ?? 0;
    integrityHistory.push(integrityScore);
    console.log(
      `[${profile.name}] cycle=${cycle} integrity=${integrityScore.toFixed(1)} tiers T1=${cycleTiers.T1} T2=${cycleTiers.T2} T3=${cycleTiers.T3} mode=${mode} allowed=${allowedTasks ?? 'n/a'}`
    );

    state = {
      ...state,
      goals: state.goals || [],
      identity: result.identityAfter || state.identity || {},
      history: result.history || state.history || [],
      tasks: result.tasks || [],
      integrity: result.integrity || state.integrity || { ...DEFAULT_INTEGRITY },
      team: result.team || state.team || {}
    };

    const effectiveRate =
      typeof profile.completionRate === 'function'
        ? profile.completionRate(cycle)
        : profile.completionRate ?? 0.5;
    const activeTasks =
      result.taskBoard?.tasks?.filter((t) => t.decision === 'keep') ??
      result.tasks ??
      [];
    const limit =
      allowedTasks != null ? Math.min(activeTasks.length, allowedTasks) : activeTasks.length;

    for (let i = 0; i < limit; i++) {
      const task = activeTasks[i];
      const done = rng() < effectiveRate;
      const status = done ? 'completed' : profile.honesty ? 'missed' : 'pending';
      if (status === 'pending') continue;
      state = applyTaskStatusToState(state, task.id, status, task);
    }
  }

  const avgIntegrity =
    integrityHistory.length === 0
      ? 0
      : integrityHistory.reduce((a, b) => a + b, 0) / integrityHistory.length;
  const finalIntegrity = integrityHistory[integrityHistory.length - 1] || 0;
  const totalCycles = integrityHistory.length || 1;
  const avgAllowed = allowedSum / totalCycles;
  const pct = (mode) => (((modeCounts[mode] || 0) / totalCycles) * 100).toFixed(1);
  console.log(`\n[${profile.name}] summary`);
  console.log(`  cycles: ${profile.maxCycles}`);
  console.log(`  avg integrity: ${avgIntegrity.toFixed(1)} | final: ${finalIntegrity.toFixed(1)}`);
  const totalTasks = tierTally.T1 + tierTally.T2 + tierTally.T3 || 1;
  console.log(
    `  task tier mix: T1=${tierTally.T1} (${((tierTally.T1 / totalTasks) * 100).toFixed(
      1
    )}%), T2=${tierTally.T2} (${((tierTally.T2 / totalTasks) * 100).toFixed(1)}%), T3=${tierTally.T3} (${(
      (tierTally.T3 / totalTasks) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `  cycle modes: reset_identity=${pct('reset_identity')}% caution=${pct('caution')}% normal=${pct('normal')}% other=${pct('execute')}%`
  );
  console.log(`  avg allowedTasks: ${avgAllowed.toFixed(2)}\n`);
}

function countTiers(tasks = []) {
  return tasks.reduce(
    (acc, task) => {
      const tier = task?.tier || 'T1';
      if (tier === 'T2') acc.T2 += 1;
      else if (tier === 'T3') acc.T3 += 1;
      else acc.T1 += 1;
      return acc;
    },
    { T1: 0, T2: 0, T3: 0 }
  );
}

function main() {
  const profiles = [
    {
      name: 'Burnout',
      completionRate: (cycle) => (cycle <= 5 ? 0.9 : 0.25),
      honesty: true,
      maxCycles: 15,
      randomSeed: 'burnout'
    },
    {
      name: 'Steady compounding',
      completionRate: () => 0.7,
      honesty: true,
      maxCycles: 20,
      randomSeed: 'steady'
    },
    {
      name: 'Low integrity',
      completionRate: () => 0.3,
      honesty: true,
      maxCycles: 15,
      randomSeed: 'low'
    }
  ];

  profiles.forEach((profile) => simulateProfile(profile));
}

main();
