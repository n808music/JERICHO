import { runPipeline } from '../../src/core/pipeline.js';
import { normalizeStateForPipeline } from '../../src/core/state-normalization.js';
import { setConfig, resetConfig } from '../../src/core/config.js';

function simulateProfile({ cycles = 50, completionRate = 0.6, name = 'profile', configOverrides = {} }) {
  resetConfig();
  setConfig(configOverrides);
  let state = {
    goals: ['Grow revenue to $10k/month by 2026-07-06'],
    identity: {},
    history: [],
    tasks: [],
    team: {}
  };
  const logs = [];

  for (let i = 0; i < cycles; i++) {
    const normalized = normalizeStateForPipeline(state);
    const pipeline = runPipeline(
      { goals: state.goals },
      normalized.identity || {},
      normalized.history || [],
      normalized.tasks || [],
      normalized.team || {}
    );

    // Deterministic completion based on completionRate
    const tasks = (pipeline.tasks || []).map((t, idx) => ({
      ...t,
      status: idx / (pipeline.tasks.length || 1) < completionRate ? 'completed' : 'missed'
    }));

    state = {
      ...state,
      tasks,
      history: [...(state.history || []), ...tasks]
    };

    logs.push({
      cycle: i,
      integrity: pipeline?.integrity?.score ?? 0,
      tierCounts: tasks.reduce((acc, t) => {
        acc[t.tier || 'unknown'] = (acc[t.tier || 'unknown'] || 0) + 1;
        return acc;
      }, {})
    });
  }

  return { name, cycles, logs };
}

function main() {
  const profiles = [
    { name: 'steady', completionRate: 0.7 },
    { name: 'burnout', completionRate: 0.4 },
    { name: 'high', completionRate: 0.9 }
  ];

  const results = profiles.map((p) => simulateProfile(p));
  console.log(JSON.stringify({ results }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
