#!/usr/bin/env node
/**
 * Closed-loop smoke test:
 * - reset state
 * - post a goal
 * - run cycle once
 * - mark first task complete
 * - run cycle again
 * Logs integrity and task counts before/after completion.
 */

const API = 'http://localhost:3000';

async function main() {
  const goalText = 'Grow revenue to $10k/month by 2026-07-06';

  await post('/reset');
  console.log('Reset state');

  await post('/goals', { text: goalText });
  console.log('Posted goal:', goalText);

  let cycle1 = await post('/cycle/next');
  logCycle('After first cycle', cycle1);

  const firstTask = cycle1.pipeline?.tasks?.[0];
  if (!firstTask) {
    console.log('No tasks produced; aborting completion step.');
    return;
  }

  await post('/task-status', { taskId: firstTask.id, status: 'completed' });
  console.log('Marked task completed:', firstTask.id);

  let cycle2 = await post('/cycle/next');
  logCycle('After second cycle', cycle2);
}

function logCycle(label, cycle) {
  const integrity = cycle.pipeline?.integrity?.score ?? 'n/a';
  const tasks = cycle.pipeline?.tasks?.length ?? 0;
  const history = cycle.pipeline?.history?.length ?? 0;
  console.log(`${label}: integrity=${integrity}, tasks=${tasks}, history=${history}`);
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
