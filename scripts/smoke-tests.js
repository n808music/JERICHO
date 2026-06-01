#!/usr/bin/env node

/*
 * Smoke test runner: Runs one goal per canonical family through the live API pipeline.
 * - Writes state to a dedicated smoke state file
 * - Calls /pipeline for each goal
 * - Retrieves the latest diagnostic trace for each run
 *
 * Usage: node scripts/smoke-tests.js
 */

import fs from 'fs/promises';
import path from 'path';

const STATE_PATH = path.resolve(process.cwd(), 'src', 'data', 'state_good.json');
const API_URL = 'http://localhost:3000';

const baseState = {
  goals: [],
  identity: {
    focus: { 'deep-work': { level: 2 } },
    health: { 'daily-movement': { level: 3 } }
  },
  history: [],
  tasks: [],
  integrity: {
    score: 0,
    completedCount: 0,
    pendingCount: 0,
    lastRun: null
  },
  team: {
    users: [
      {
        active: true,
        email: null,
        id: 'user-1',
        name: 'Primary User',
        roles: ['individual']
      }
    ],
    teams: [
      {
        active: true,
        id: 'team-1',
        memberIds: ['user-1'],
        name: 'Default Team',
        sharedGoalIds: []
      }
    ],
    roles: {},
    goalsById: {},
    teamCycles: {}
  }
};

const smokeGoals = [
  {
    family: 'VentureLaunch',
    goal: 'I will launch a SaaS product by 2026-07-01'
  },
  {
    family: 'SkillAcquisition',
    goal: 'I will complete 10 coding practice sessions by 2026-05-01'
  },
  {
    family: 'ProfessionalQualification',
    goal: 'I will pass the AWS certification exam by 2026-05-01'
  },
  {
    family: 'PhysicalTraining',
    goal: 'I will complete 10 strength workouts by 2026-04-01'
  },
  {
    family: 'JobSearchPipeline',
    goal: 'I will send 20 job applications by 2026-05-01'
  },
  {
    family: 'CreativeProduction',
    goal: 'I will publish 1 podcast episode by 2026-04-01'
  },
  {
    family: 'BrandLaunch',
    goal: 'I will launch a personal brand website by 2026-05-01'
  },
  {
    family: 'SalesPipeline',
    goal: 'I will close 5 sales deals by 2026-06-01'
  },
  {
    family: 'Fundraising',
    goal: 'I will raise 50000 in funding by 2026-06-01'
  }
];

async function writeState(goal) {
  const nextState = { ...baseState, goals: [goal] };
  await fs.writeFile(STATE_PATH, JSON.stringify(nextState, null, 2));
  return nextState;
}

async function getLatestTrace() {
  const res = await fetch(`${API_URL}/diagnostics/traces`);
  const body = await res.json();
  if (!body.ok || !Array.isArray(body.traces)) return null;
  return body.traces[body.traces.length - 1] || null;
}

async function runPipeline() {
  const res = await fetch(`${API_URL}/pipeline`);
  return await res.json();
}

async function runAll() {
  const results = [];
  for (const { family, goal } of smokeGoals) {
    process.stdout.write(`\n=== Smoke test: ${family} ===\n`);

    await writeState(goal);

    const pipelineResult = await runPipeline();

    const trace = await getLatestTrace();

    results.push({ family, goal, pipelineResult, trace });

    const status = pipelineResult.ok ? 'PASS' : 'FAIL';
    process.stdout.write(`Result: ${status} (error=${pipelineResult.error || 'none'})\n`);
    if (trace) {
      process.stdout.write(`Trace: ${trace.traceId} status=${trace.status} events=${trace.eventCount}\n`);
    }
  }

  console.log('\n=== SUMMARY ===');
  for (const r of results) {
    console.log(`${r.family}: ${r.pipelineResult.ok ? 'OK' : 'ERROR'} (${r.pipelineResult.error || 'none'}) — trace=${r.trace?.traceId || 'n/a'}`);
  }
}

runAll().catch((err) => {
  console.error('Smoke test runner failed:', err);
  process.exit(1);
});
