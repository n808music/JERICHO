#!/usr/bin/env node
/**
 * Smoke the API against different state fixtures.
 * Usage: node scripts/api-structure-smoke.js [good|broken|weird-history]
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

const mode = process.argv[2];
const fixtures = {
  good: path.join(repoRoot, 'src', 'data', 'state_good.json'),
  broken: path.join(repoRoot, 'src', 'data', 'state_broken.json'),
  'weird-history': path.join(repoRoot, 'src', 'data', 'state_history_weird.json')
};

if (!fixtures[mode]) {
  console.error(`Mode must be one of: ${Object.keys(fixtures).join(', ')}`);
  process.exit(1);
}

const routes = [
  { name: 'health', method: 'GET', path: '/health', expected: ['status'] },
  { name: 'state', method: 'GET', path: '/state', expected: ['goals'] },
  {
    name: 'goals',
    method: 'POST',
    path: '/goals',
    body: { text: 'I will test goal via smoke by 2025-12-31' },
    expected: ['ok', 'goals']
  },
  {
    name: 'identity',
    method: 'POST',
    path: '/identity',
    body: { domain: 'focus', capability: 'deep-work', level: 5 },
    expected: ['status']
  },
  {
    name: 'task-status',
    method: 'POST',
    path: '/task-status',
    body: { taskId: 'test-1', status: 'completed' },
    expected: ['ok']
  },
  { name: 'cycle-next', method: 'POST', path: '/cycle/next', expected: ['integrity', 'tasks'] }
];

async function main() {
  console.log(`Mode: ${mode}`);
  const fixture = fixtures[mode];
  const server = startServer(fixture);
  try {
    await waitForHealth();
    for (const route of routes) {
      // eslint-disable-next-line no-await-in-loop
      await hitRoute(route, mode);
    }
  } finally {
    server.kill();
  }
}

function startServer(fixturePath) {
  console.log(`Starting API with STATE_PATH=${fixturePath}`);
  const child = spawn('node', ['src/api/server.js'], {
    cwd: repoRoot,
    env: { ...process.env, STATE_PATH: fixturePath },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (d) => process.stdout.write(d.toString()));
  child.stderr.on('data', (d) => process.stderr.write(d.toString()));
  child.on('exit', (code) => console.log(`Server exited with code ${code}`));
  return child;
}

async function waitForHealth() {
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch('http://localhost:3000/health');
      if (res.ok) return;
    } catch (err) {
      // ignore until timeout
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not become healthy in time');
}

async function hitRoute(route, modeName) {
  const url = `http://localhost:3000${route.path}`;
  const options = { method: route.method, headers: {} };
  if (route.body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(route.body);
  }

  let status = null;
  let parseable = false;
  let hasExpected = false;
  let body = null;
  try {
    const res = await fetch(url, options);
    status = res.status;
    const text = await res.text();
    try {
      body = JSON.parse(text);
      parseable = true;
      hasExpected = Array.isArray(route.expected)
        ? route.expected.every((k) => Object.prototype.hasOwnProperty.call(body, k))
        : false;
    } catch (err) {
      parseable = false;
    }
  } catch (err) {
    status = 'fetch_error';
  }

  console.log(
    `[${modeName}] ${route.method} ${route.path} -> status=${status}, json=${parseable}, expectedKeys=${hasExpected}`
  );
  if (body && status >= 400) {
    console.log(`  body: ${JSON.stringify(body)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
