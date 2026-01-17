import { getConfig } from './config.js';

const VALID_TASK_STATUSES = ['pending', 'completed', 'missed'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/**
 * Validate a task object's required fields and status.
 * @param {Object} task - The task to validate. Expected properties:
 *   - id: string identifier of the task.
 *   - domain: string domain the task belongs to.
 *   - status: string status; must be one of 'pending', 'completed', or 'missed'.
 * @returns {{ok: boolean, errors: string[]}} Validation result where `ok` is `true` if no errors were found, and `errors` is an array of error codes which may include:
 *   'task_invalid', 'task_missing_id', 'task_missing_domain', 'task_missing_status', 'task_invalid_status'.
 */
export function validateTask(task) {
  const errors = [];

  if (!task || typeof task !== 'object') {
    return { ok: false, errors: ['task_invalid'] };
  }

  if (!task.id || typeof task.id !== 'string') {
    errors.push('task_missing_id');
  }
  if (!task.domain || typeof task.domain !== 'string') {
    errors.push('task_missing_domain');
  }
  if (!task.status) {
    errors.push('task_missing_status');
  } else if (!VALID_TASK_STATUSES.includes(task.status)) {
    errors.push('task_invalid_status');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Validate a history entry object for timestamp presence/format and, when applicable, task status.
 * @param {object} entry - The history entry to validate; may represent a task record (has `taskId` or `id`) or a cycle snapshot (has `goalId`).
 * @returns {{ok: boolean, errors: string[]}} An object where `ok` is true if validation passed and `errors` is an array of error codes. Possible error codes: `history_invalid`, `history_missing_timestamp`, `history_invalid_timestamp_format`, `history_invalid_status`.
 */
export function validateHistoryEntry(entry) {
  const errors = [];

  if (!entry || typeof entry !== 'object') {
    return { ok: false, errors: ['history_invalid'] };
  }

  if (!entry.timestamp || typeof entry.timestamp !== 'string') {
    errors.push('history_missing_timestamp');
  } else if (!ISO_DATE_REGEX.test(entry.timestamp)) {
    errors.push('history_invalid_timestamp_format');
  }

  // Detect entry type: task record has taskId, cycle snapshot has goalId
  const isTaskRecord = 'taskId' in entry || 'id' in entry;
  const isCycleSnapshot = 'goalId' in entry;

  if (isTaskRecord && !isCycleSnapshot) {
    if (!entry.status || !VALID_TASK_STATUSES.includes(entry.status)) {
      errors.push('history_invalid_status');
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Validate a full state object for integrity score, tasks, and goals.
 *
 * The function returns a list of validation error codes when checks fail:
 * - 'state_missing' — the state is missing or not an object.
 * - 'integrity_out_of_bounds' — integrity.score is NaN or outside configured min..max.
 * - 'task_invalid' — a task entry is missing or not an object.
 * - 'task_missing_id' — a task is missing its `id`.
 * - 'task_invalid_tier' — a task `tier` is not one of 'T1', 'T2', 'T3', `null`, or `undefined`.
 * - 'goal_invalid' — a goal is not a non-empty string.
 *
 * @param {object} state - The application state to validate.
 * @returns {{ok: boolean, errors: string[]}} An object where `ok` is true when no validation errors were found, and `errors` lists the encountered error codes.
 */
export function validateState(state) {
  const errors = [];
  const cfg = getConfig().integrity;
  if (!state || typeof state !== 'object') {
    return { ok: false, errors: ['state_missing'] };
  }

  const integrity = state.integrity?.score ?? 0;
  if (Number.isNaN(integrity) || integrity < cfg.min || integrity > cfg.max) {
    errors.push('integrity_out_of_bounds');
  }

  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  for (const task of tasks) {
    if (!task || typeof task !== 'object') {
      errors.push('task_invalid');
      continue;
    }
    if (!task.id) errors.push('task_missing_id');
    if (!['T1', 'T2', 'T3', undefined, null].includes(task.tier)) errors.push('task_invalid_tier');
  }

  const goals = Array.isArray(state.goals) ? state.goals : [];
  for (const g of goals) {
    if (typeof g !== 'string' || !g.trim()) errors.push('goal_invalid');
  }

  return { ok: errors.length === 0, errors };
}