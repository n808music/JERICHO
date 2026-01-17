import { getConfig } from './config.js';

const VALID_TASK_STATUSES = ['pending', 'completed', 'missed'];

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
