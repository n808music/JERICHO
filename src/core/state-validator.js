import { getConfig } from './config.js';

const VALID_TASK_STATUSES = ['pending', 'completed', 'missed'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

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
  } else if (typeof task.status !== 'string' || !VALID_TASK_STATUSES.includes(task.status)) {
    errors.push('task_invalid_status');
  }

  return { ok: errors.length === 0, errors };
}

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
