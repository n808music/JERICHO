import { promises as fs } from 'fs';
import path from 'path';
import { mockGoals, mockIdentity } from './mock-data.js';
import { EMPTY_TEAM_STATE, normalizeTeam } from '../core/team-model.js';
import { checkInvariants } from '../core/validation/invariants.js';

const getStorePath = () =>
  process.env.STATE_PATH || path.join(process.cwd(), 'src', 'data', 'state.json');

const defaultState = buildState({
  goals: mockGoals.goals || [],
  identity: mockIdentity || {},
  history: [],
  tasks: [],
  integrity: {
    score: 0,
    completedCount: 0,
    pendingCount: 0,
    lastRun: null
  },
  team: EMPTY_TEAM_STATE
});

/**
 * Load and normalize the persisted application state from the configured store file.
 *
 * If the store file does not exist, writes the default state to disk and returns it.
 * @returns {object} The normalized state object; if no persisted file existed, the default state.
 * @throws {Error} Propagates errors that occur while reading or parsing the state file, except for a missing file which is handled by creating the default state.
 */
export async function readState() {
  try {
    const raw = await fs.readFile(getStorePath(), 'utf-8');
    return buildState(JSON.parse(raw));
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeState(defaultState);
      return defaultState;
    }
    throw err;
  }
}

/**
 * Read and parse the persisted state file, returning a normalized state and optional invariant validation, or a structured error.
 * @param {Object} [options] - Optional flags.
 * @param {boolean} [options.validate] - When true, run invariant checks and include a `validation` result alongside the state.
 * @returns {{ok: true, state: Object, validation?: Object} | {ok: false, errorCode: string, reason: string}}
 *   On success: an object with `ok: true`, the normalized `state`, and, if requested, a `validation` result.
 *   On failure: an object with `ok: false`, `errorCode: 'BAD_STATE'`, and a human-readable `reason`.
 */
export async function safeReadState(options = {}) {
  try {
    const raw = await fs.readFile(getStorePath(), 'utf-8');
    const state = buildState(JSON.parse(raw));

    if (options.validate) {
      const validation = checkInvariants(state);
      return { ok: true, state, validation };
    }

    return { ok: true, state };
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeState(defaultState);
      const validation = options.validate ? checkInvariants(defaultState) : undefined;
      return { ok: true, state: defaultState, validation };
    }
    if (err instanceof SyntaxError) {
      return { ok: false, errorCode: 'BAD_STATE', reason: 'State file is not valid JSON.' };
    }
    return { ok: false, errorCode: 'BAD_STATE', reason: err.message || 'State read failed.' };
  }
}

/**
 * Persist a normalized application state to the configured store file.
 *
 * @param {Object} state - Raw or partial state to normalize and persist.
 * @returns {Object} The normalized state that was written to disk.
 */
export async function writeState(state) {
  const next = buildState(state);
  await fs.mkdir(path.dirname(getStorePath()), { recursive: true });
  await fs.writeFile(getStorePath(), JSON.stringify(next, null, 2));
  return next;
}

export async function appendGoal(goal) {
  const current = await readState();
  const goals = [...(current.goals || []), goal];
  return writeState({ ...current, goals });
}

export async function updateIdentity(domain, capability, level) {
  const current = await readState();
  const identity = {
    ...(current.identity || {}),
    [domain]: { ...(current.identity?.[domain] || {}), [capability]: { level } }
  };
  return writeState({ ...current, identity });
}

export async function recordTaskStatus(taskId, status, meta = {}) {
  const current = await readState();
  const nowIso = new Date().toISOString();
  const defaultBreakdown = {
    completedOnTime: status === 'completed' ? 1 : 0,
    completedLate: 0,
    missed: status === 'missed' ? 1 : 0,
    totalTasks: 1,
    completionRate: status === 'completed' ? 1 : 0,
    onTimeRate: status === 'completed' ? 1 : 0
  };
  const historyEntry = {
    id: taskId,
    taskId,
    domain: meta.domain || 'unknown',
    capability: meta.capability || 'unknown',
    tier: meta.tier || 'foundation',
    effortMinutes: meta.effortMinutes ?? 60,
    goalLink: meta.goalLink || 'goal',
    status,
    timestamp: nowIso,
    integrity: {
      scoreDelta: 0,
      breakdown: { ...(meta.integrityBreakdown || {}), ...defaultBreakdown }
    }
  };
  const history = [...(current.history || []), historyEntry];
  const tasks = Array.isArray(current.tasks)
    ? current.tasks.map((task) => (task.id === taskId ? { ...task, status } : task))
    : [];
  const nextTasks = !tasks.find((t) => t.id === taskId)
    ? [
        ...tasks,
        {
          id: taskId,
          status,
          domain: meta.domain,
          capability: meta.capability,
          tier: meta.tier,
          effortMinutes: meta.effortMinutes,
          goalLink: meta.goalLink
        }
      ]
    : tasks;
  return writeState({ ...current, history, tasks: nextTasks });
}

function buildState(raw) {
  const base = raw || {};
  return {
    goals: Array.isArray(base.goals) ? base.goals : [],
    identity: typeof base.identity === 'object' && base.identity !== null ? base.identity : {},
    history: Array.isArray(base.history) ? base.history : [],
    tasks: Array.isArray(base.tasks) ? base.tasks : [],
    integrity: normalizeIntegrity(base.integrity),
    team: normalizeTeam(base.team)
  };
}

function normalizeIntegrity(integrity) {
  if (!integrity || typeof integrity !== 'object') {
    return { score: 0, completedCount: 0, pendingCount: 0, lastRun: null };
  }
  return {
    score: Number(integrity.score) || 0,
    completedCount: Number(integrity.completedCount) || 0,
    pendingCount: Number(integrity.pendingCount) || 0,
    lastRun: integrity.lastRun || null
  };
}