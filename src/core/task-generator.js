/**
 * TASK QUALITY DIAGNOSTIC
 * Current observed tasks (e.g., Set start time, Ship daily output, Honor fixed block, Time-block week) map to:
 * - execution/disc ladder foundation tasks; distribution matches red health/reset_identity but mixes similar maturity levels.
 * - overflow vs active differ only by governance cap, not by tier.
 * - “under” tags reflect portfolio imbalance; tiers were not explicit previously.
 *
 * TASK QUALITY: TIER MODEL
 * - T1 (Foundation): red health, reset_identity, low integrity. Stability/routine/baseline.
 * - T2 (Production): yellow/rising integrity. Output generation, assets, deliverables.
 * - T3 (Scaling): green/consistent streaks. Strategy, experiments, metrics, structured reviews.
 * All tasks must be atomic (30–90 min), observable, time-bounded, goal-linked, progressive.
 */
import { randomUUID } from 'crypto';
import { getConfig } from './config.js';

const LADDERS = {
  execution: {
    execution: {
      T1: [
        {
          title: 'Define a single offer',
          description: (goal) => `Define one specific offer for the next 30 days toward: ${goal.outcome}.`,
          effortMinutes: 45,
          difficulty: 2,
          estimatedImpact: 0.6
        },
        {
          title: 'Identify top 3 customer segments',
          description: () => 'List your top 3 customer segments and why they buy.',
          effortMinutes: 45,
          difficulty: 1,
          estimatedImpact: 0.6
        },
        {
          title: 'Block 90 minutes for outreach/creation',
          description: () => 'Put a 90-minute block on your calendar today for outreach or creation.',
          effortMinutes: 90,
          difficulty: 2,
          estimatedImpact: 0.7
        }
      ],
      T2: [
        {
          title: 'Ship one revenue asset',
          description: (goal) =>
            `Ship one asset that can generate revenue (page/link/booking) for: ${goal.outcome}.`,
          effortMinutes: 90,
          difficulty: 3,
          estimatedImpact: 0.8
        },
        {
          title: 'Execute 20 minutes of direct outreach',
          description: () => 'Spend 20 minutes on direct outreach (email/DM/calls) to qualified leads.',
          effortMinutes: 30,
          difficulty: 2,
          estimatedImpact: 0.7
        },
        {
          title: 'Write 3 lessons from yesterday',
          description: () => 'Review yesterday’s actions and write 3 bullet-point lessons.',
          effortMinutes: 20,
          difficulty: 1,
          estimatedImpact: 0.5
        }
      ],
      T3: [
        {
          title: 'Weekly pipeline review',
          description: () => 'Review weekly numbers (leads, calls, closes, revenue) and log them.',
          effortMinutes: 45,
          difficulty: 2,
          estimatedImpact: 0.6
        },
        {
          title: 'Design a conversion experiment',
          description: () => 'Design one experiment to improve conversion and schedule it.',
          effortMinutes: 60,
          difficulty: 3,
          estimatedImpact: 0.7
        },
        {
          title: 'Document acquisition channel',
          description: () => 'Write a 1-page outline of your current acquisition channel.',
          effortMinutes: 60,
          difficulty: 2,
          estimatedImpact: 0.5
        }
      ]
    }
  },
  discipline: {
    discipline: {
      T1: [
        {
          title: 'Honor a fixed work block',
          description: (goal) => `Commit to a single uninterrupted block for: ${goal.outcome}.`,
          effortMinutes: 60,
          difficulty: 2,
          estimatedImpact: 0.6
        },
        {
          title: 'Set and follow a daily start time',
          description: () => 'Choose a realistic daily start time and honor it for this cycle.',
          effortMinutes: 30,
          difficulty: 2,
          estimatedImpact: 0.7
        }
      ],
      T2: [
        {
          title: 'Plan tomorrow’s first block',
          description: () => 'Pick tomorrow’s first 60-minute block and protect it.',
          effortMinutes: 20,
          difficulty: 1,
          estimatedImpact: 0.5
        }
      ],
      T3: [
        {
          title: 'Weekly cadence review',
          description: () => 'Review last week’s cadence, note slips, and reset anchors.',
          effortMinutes: 45,
          difficulty: 2,
          estimatedImpact: 0.5
        }
      ]
    },
    consistency: {
      T1: [
        {
          title: 'Set and follow a daily start time',
          description: () => 'Choose a realistic daily start time and honor it for this cycle.',
          effortMinutes: 30,
          difficulty: 2,
          estimatedImpact: 0.7
        }
      ],
      T2: [],
      T3: []
    }
    ,
    consistency: {
      T1: [
        {
          title: 'Set and follow a daily start time',
          description: () => 'Choose a realistic daily start time and honor it for this cycle.',
          effortMinutes: 30,
          difficulty: 2,
          estimatedImpact: 0.7
        }
      ],
      T2: [],
      T3: []
    }
  },
  focus: {
    deep_work: {
      T1: [
        {
          title: 'Define a deep-work target',
          description: (goal) => `Pick one sub-outcome that moves ${goal.outcome} forward and write it down.`,
          effortMinutes: 30,
          difficulty: 1,
          estimatedImpact: 0.5
        },
        {
          title: 'Deep work session',
          description: (goal) =>
            `Schedule and complete a 90-minute deep work session moving ${goal.outcome} forward.`,
          effortMinutes: 90,
          difficulty: 3,
          estimatedImpact: 0.8
        }
      ],
      T2: [
        {
          title: 'Reflect on deep work block',
          description: () => 'Log what worked/blocked you in today’s deep work block and adjust tomorrow.',
          effortMinutes: 20,
          difficulty: 1,
          estimatedImpact: 0.4
        }
      ],
      T3: [
        {
          title: 'Design next deep-work sprint',
          description: () => 'Outline a 3-day deep-work sprint with daily targets.',
          effortMinutes: 60,
          difficulty: 2,
          estimatedImpact: 0.6
        }
      ]
    }
  }
};


export function generateTasksForCycle(goal, rankedGaps, options = {}) {
  const cfg = getConfig().taskGenerator;
  const baseMax = options.maxTasks ?? cfg.maxTasks;
  const maxTasks = Math.max(1, baseMax + (options.maxTasksDelta ?? 0));
  const cycleDays = options.cycleDays ?? cfg.cycleDays;
  const domainHint = options.domainHint;
  const capabilityHint = options.capabilityHint;
  const integrityScore = options.integrityScore ?? 0;
  const healthBand = getHealthBand(options.integrityScore ?? 0);
  const goalLink = options.goalLink || slugifyGoal(goal?.raw || goal?.outcome || 'goal');
  const cycleMode = options.cycleMode || (healthBand === 'red' ? 'reset_identity' : 'normal');

  const createdAt = new Date();
  const dueDate = new Date(createdAt.getTime() + cycleDays * 24 * 60 * 60 * 1000);
  const createdAtISO = createdAt.toISOString();
  const dueDateISO = dueDate.toISOString();

  const tasks = [];
  const tierMix = pickTierMix(healthBand, integrityScore, maxTasks);
  let hasPositiveGap = false;
  for (const gap of rankedGaps || []) {
    if (tasks.length >= maxTasks) break;
    if (!gap || gap.weightedGap <= 0) continue;
    const domain = gap.domain || domainHint || 'execution';
    const capability = gap.capability || capabilityHint || domain || 'execution';
    const picked = pickTasksFromLadder(
      domain,
      capability,
      tierMix,
      goal,
      createdAtISO,
      dueDateISO,
      goalLink,
      cycleMode,
      maxTasks - tasks.length,
      options
    );
    picked.forEach((t) => {
      if (tasks.length < maxTasks) {
        tasks.push({
          ...t,
          id: randomUUID(),
          requirementId: gap.requirementId,
          domain,
          capability,
          status: 'pending'
        });
      }
    });
  }

  if (tasks.length === 0 && hasPositiveGap) {
    const domain = domainHint || 'execution';
    const capability = capabilityHint || domain;
    const picked = pickTasksFromLadder(
      domain,
      capability,
      tierMix,
      goal,
      createdAtISO,
      dueDateISO,
      goalLink,
      cycleMode,
      maxTasks - tasks.length,
      options
    );
    picked.forEach((t) => {
      if (tasks.length < maxTasks) {
        tasks.push({
          ...t,
          id: randomUUID(),
          requirementId: `fallback-${capability}-${tasks.length}`,
          domain,
          capability,
          status: 'pending'
        });
      }
    });
  }

  return tasks.sort((a, b) => tierWeight(a.tier) - tierWeight(b.tier));
}

export function generateTasks(gaps = [], goal = { id: '', raw: '', outcome: '', metric: '', deadline: '', type: 'event' }) {
  const ranked = (gaps || []).map((gap, idx) => ({
    requirementId: gap.requirementId || gap.id || `${gap.domain || 'req'}-${gap.capability || 'cap'}`,
    domain: gap.domain,
    capability: gap.capability,
    targetLevel: gap.targetLevel,
    currentLevel: gap.currentLevel ?? gap.currentLevel ?? 0,
    weight: gap.weight ?? 0.5,
    rawGap: gap.gap ?? gap.rawGap ?? Math.max((gap.targetLevel || 0) - (gap.currentLevel || 0), 0),
    weightedGap: gap.weightedGap ?? (gap.weight ?? 0.5) * Math.max((gap.targetLevel || 0) - (gap.currentLevel || 0), 0),
    rank: idx + 1
  }));

  const generated = generateTasksForCycle(goal, ranked, {});
  return generated.map((task, idx) => {
    const gap = ranked[idx];
    return gap
      ? {
          ...task,
          id: `habit-${gap.domain}-${gap.capability}`
        }
      : task;
  });
}

function pickTasksFromLadder(
  domain,
  capability,
  tierMix,
  goal,
  createdAtISO,
  dueDateISO,
  goalLink,
  cycleMode,
  remaining,
  options = {}
) {
  let ladder =
    (LADDERS[domain] && LADDERS[domain][capability]) ||
    (LADDERS[capability] && LADDERS[capability][capability]);
  if (!ladder && capability === 'consistency') {
    ladder = LADDERS.discipline?.consistency;
  }
  if (!ladder) return [];
  const tasks = [];
  let limit = remaining ?? tierMix.length;
  if (capability === 'consistency') {
    limit = Math.min(limit, 1);
  }
  const tierCount = tierMix.length || 1;
  for (let tierIdx = 0; tierIdx < tierMix.length; tierIdx++) {
    const tier = tierMix[tierIdx];
    if (tasks.length >= limit) break;
    const list = ladder[tier] || [];
    if (list.length === 0) continue;
    const remainingSlots = limit - tasks.length;
    const quota = Math.max(1, Math.floor(limit / tierCount));
    const take = Math.min(remainingSlots, quota);
    // Behavior sim note: burnout/steady profiles were stuck in T1 because we filled all slots from the first tier.
    // Evenly quota by tier to surface T2/T3 once integrity moves out of red/yellow.
    for (let i = 0; i < take; i++) {
      const template = list[i % list.length];
      tasks.push({
        title: template.title,
        description: template.description(goal),
        difficulty: clampDifficulty(template.difficulty + (options.difficultyBias || 0)),
        estimatedImpact: template.estimatedImpact,
        effortMinutes: template.effortMinutes ?? 60,
        tier,
        goalLink,
        cycleMode,
        dueDate: dueDateISO,
        createdAt: createdAtISO
      });
    }
  }
  return tasks;
}

function pickTierMix(healthBand, integrityScore, maxTasks) {
  const cfg = getConfig().taskGenerator;
  const mix = cfg.tierMix || {};
  if (healthBand === 'red') return (mix.red || ['T1']).slice(0, Math.min(maxTasks, mix.red?.length || 2));
  if (healthBand === 'yellow') return (mix.yellow || ['T1', 'T2']).slice(0, maxTasks);
  return (mix.green || ['T2', 'T3']).slice(0, maxTasks);
}

function tierWeight(tier) {
  if (tier === 'T1') return 1;
  if (tier === 'T2') return 2;
  return 3;
}

function getHealthBand(integrityScore) {
  const cfg = getConfig().taskGenerator;
  const redCutoff = cfg.healthBands.red;
  const yellowCutoff = cfg.healthBands.yellow;
  if (integrityScore < redCutoff) return 'red';
  if (integrityScore < yellowCutoff) return 'yellow';
  return 'green';
}

function slugifyGoal(text) {
  return String(text || 'goal')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

function clampDifficulty(val) {
  const num = Number(val);
  if (Number.isNaN(num)) return 1;
  return Math.max(1, Math.min(5, Math.round(num)));
}
