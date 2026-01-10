import { getConfig } from './config.js';

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
