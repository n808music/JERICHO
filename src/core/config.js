// Centralized deterministic parameters for the Jericho engine.
// Internal-only: not exposed via public APIs. Tests can override via setConfig/withConfig.

const defaultConfig = {
  governance: {
    lookbackCycles: 3,
    reset: { integrityMax: 20, failureRateMin: 0.6, allowedTasks: 2 },
    caution: { integrityMin: 20, integrityMax: 50, failureRateMax: 0.6, allowedTasks: 3 },
    normal: { integrityMin: 50, failureRateMax: 0.4, allowedTasks: 4 }
  },
  taskGenerator: {
    maxTasks: 4,
    cycleDays: 7,
    healthBands: { red: 30, yellow: 70 },
    tierMix: {
      red: ['T1', 'T1'],
      yellow: ['T1', 'T2'],
      green: ['T2', 'T3']
    }
  },
  integrity: {
    min: 0,
    max: 100
  },
  temporal: {
    streakResetThreshold: 0,
    rolloverCap: 100
  }
};

let activeConfig = structuredClone(defaultConfig);

function deepMerge(target, source) {
  const output = Array.isArray(target) ? [...target] : { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = deepMerge(target[key] || {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

export function getConfig() {
  return activeConfig;
}

export function setConfig(overrides = {}) {
  activeConfig = deepMerge(defaultConfig, overrides);
  return activeConfig;
}

export function resetConfig() {
  activeConfig = structuredClone(defaultConfig);
  return activeConfig;
}

export { defaultConfig };
