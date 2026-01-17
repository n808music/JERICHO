#!/usr/bin/env node
/**
 * Task quality smoke:
 * - reset
 * - post canonical goal
 * - run cycle (integrity ~0)
 * - log tasks with tier/effort
 * - complete first task
 * - run cycle again
 * - log tasks and integrity
 */

const API = 'http://localhost:3000';
const goalText = 'Grow revenue to $10k/month by 2026-07-06';

async function main() {
  await post('/reset');
  console.log('Reset state');

  await post('/goals', { text: goalText });
  console.log('Posted goal');

  const cycle1 = await post('/cycle/next');
  logTasks('Cycle 1 (integrity ~0)', cycle1);

  const firstTask = cycle1.pipeline?.tasks?.[0];
  if (!firstTask) {
    console.log('No tasks generated; aborting.');
    return;
  }
  await post('/task-status', { taskId: firstTask.id, status: 'completed' });
  console.log('Completed task:', firstTask.id);

  const cycle2 = await post('/cycle/next');
  logTasks('Cycle 2 (after completion)', cycle2);
}

function logTasks(label, cycle) {
  const integrity = cycle.pipeline?.integrity?.score ?? 'n/a';
  const tasks = cycle.pipeline?.tasks || [];
  console.log(`${label}: integrity=${integrity}, tasks=${tasks.length}`);
  tasks.forEach((t, idx) => {
    console.log(
      `  [${idx}] ${t.title} | tier=${t.tier} | effort=${t.effortMinutes} | domain=${t.domain} | capability=${t.capability}`
    );
  });
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json();
  if (!res.ok || json?.ok === false) {
    throw new Error(`Request failed ${path}: ${JSON.stringify(json)}`);
  }
  return json;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
