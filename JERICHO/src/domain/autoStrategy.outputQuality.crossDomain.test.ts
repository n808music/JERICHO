import { describe, expect, it } from 'vitest';
import { buildAutoDeliverablesFromGoalContract } from './autoStrategy';
import { compileAutoAsanaPlan } from '../state/engine/autoAsanaPlan.ts';
import type { GoalExecutionContract } from './goal/GoalExecutionContract';

type DomainFixture = {
  label: string;
  goalText: string;
  verificationCriteria: string;
  startingStateText: string;
  expectedDeliverableSnippets: string[];
  expectedScheduledTitleSnippets?: string[];
  expectedStartingStateSnippet: string;
};

const DOMAINS: DomainFixture[] = [
  {
    label: 'podcast / media',
    goalText: 'Publish 6 episodes by deadline from scratch',
    verificationCriteria: '6 episodes recorded and edited for release',
    startingStateText: 'already equipped',
    expectedDeliverableSnippets: [
      'podcast show format',
      'podcast recording workflow',
      'film episode 1',
      'edit episode 1',
      'publish episode 1',
    ],
    expectedStartingStateSnippet: 'podcast show format',
  },
  {
    label: 'software / product build',
    goalText: 'Build the product by deadline from scratch',
    verificationCriteria: 'Launch a v1 feature with verified tests',
    startingStateText: 'prototype ready',
    expectedDeliverableSnippets: [
      'define product artifact and acceptance criteria',
      'implement core feature set',
      'write verification tests and qa checklist',
      'prepare release workflow and deployment',
      'launch v1 and monitor post-release issues',
    ],
    expectedStartingStateSnippet: 'define product artifact and acceptance criteria',
  },
  {
    label: 'fitness / training',
    goalText: 'Prepare for a marathon by deadline from scratch',
    verificationCriteria: 'Baseline recorded and training blocks completed',
    startingStateText: 'baseline recorded',
    expectedDeliverableSnippets: [
      'record baseline metrics and target pace',
      'build weekly training structure',
      'complete progressive training sessions',
      'complete recovery and milestone checks',
    ],
    expectedStartingStateSnippet: 'record baseline metrics and target pace',
  },
  {
    label: 'business launch',
    goalText: 'Launch a service by deadline from scratch',
    verificationCriteria: 'Offer defined and first clients acquired',
    startingStateText: 'offer defined',
    expectedDeliverableSnippets: [
      'define service offer and target client',
      'define pricing tiers and qualification gates',
      'prepare delivery process and onboarding workflow',
      'build outreach scripts and first prospect list',
      'run discovery calls and close first client',
    ],
    expectedScheduledTitleSnippets: [
      'launch offer promise',
      'unit economics',
      'prepare delivery process and onboarding workflow',
      'first-buyer list',
      'run discovery calls and close first client',
    ],
    expectedStartingStateSnippet: 'define service offer and target client',
  },
  {
    label: 'brand launch',
    goalText: 'Launch a consulting business brand by deadline from scratch',
    verificationCriteria: 'Brand identity and launch announcement completed',
    startingStateText: 'identity defined',
    expectedDeliverableSnippets: [
      'define brand positioning and audience promise',
      'build messaging architecture for priority channels',
      'select visual identity direction and standards',
      'assemble core brand kit and starter assets',
      'update priority channel profiles and bios',
      'publish brand launch announcement and audience cta',
    ],
    expectedScheduledTitleSnippets: [
      'target buyer segment',
      'positioning statement',
      'visual identity direction and standards',
      'priority channel profiles and bios',
    ],
    expectedStartingStateSnippet: 'define brand positioning and audience promise',
  },
  {
    label: 'real estate / project',
    goalText: 'Renovate a rental unit to inspection-ready by deadline from scratch',
    verificationCriteria: 'Permit approved and inspection passed',
    startingStateText: 'site verified',
    expectedDeliverableSnippets: [
      'confirm site, permit, and approval status',
      'finalize scope and budget',
      'coordinate contractors and materials',
      'complete inspection-critical work',
      'pass inspection and handoff',
    ],
    expectedStartingStateSnippet: 'confirm site, permit, and approval status',
  },
];

function makeContract(goalId: string, goalText: string, verificationCriteria: string): GoalExecutionContract {
  return {
    goalId,
    cycleId: `${goalId}-cycle`,
    planGenerationMechanismClass: 'DELIVERABLE_DRIVEN',
    terminalOutcome: {
      text: goalText,
      hash: `${goalId}-hash`,
      verificationCriteria,
      isConcrete: true,
    },
    deadline: {
      dayKey: '2026-06-30',
      isHardDeadline: true,
    },
    sacrifice: {
      whatIsGivenUp: 'free time',
      duration: 'until deadline',
      quantifiedImpact: '10 hours/week',
      rationale: 'bounded output-quality sprint',
      hash: `${goalId}-sacrifice`,
    },
    workWindows: {
      mon: [{ start: '09:00', end: '12:00' }],
      tue: [{ start: '09:00', end: '12:00' }],
      wed: [{ start: '09:00', end: '12:00' }],
      thu: [{ start: '09:00', end: '12:00' }],
      fri: [{ start: '09:00', end: '12:00' }],
      sat: [],
      sun: [],
    },
    causalChain: {
      steps: [
        { sequence: 1, description: 'establish baseline' },
        { sequence: 2, description: 'execute core work' },
        { sequence: 3, description: 'finish and verify' },
      ],
      hash: `${goalId}-causal`,
    },
    reinforcement: {
      dailyExposureEnabled: true,
      dailyMechanism: 'dashboard banner',
      checkInFrequency: 'DAILY',
      triggerDescription: 'every morning',
    },
    inscription: {
      contractHash: `${goalId}-contract`,
      inscribedAtISO: '2026-03-23T12:00:00.000Z',
      acknowledgment: 'I understand this is binding',
      acknowledgmentHash: `${goalId}-ack`,
      isCompromised: false,
    },
    admissionStatus: 'ADMITTED',
    admissionAttemptCount: 1,
    rejectionCodes: [],
    createdAtISO: '2026-03-23T12:00:00.000Z',
  } as GoalExecutionContract;
}

function deliverablesToActions(deliverables: Array<{ title: string; requiredBlocks: number }>) {
  return deliverables.map((deliverable, index) => ({
    id: `action-${index + 1}`,
    title: deliverable.title,
    estimateMin: Math.max(30, deliverable.requiredBlocks * 30),
    dependencies: index === 0 ? [] : [`action-${index}`],
  }));
}

function compileBlocks(deliverables: Array<{ title: string; requiredBlocks: number }>, goalId: string) {
  const actionSequence = deliverablesToActions(deliverables);
  return compileAutoAsanaPlan({
    goalId,
    cycleId: `${goalId}-cycle`,
    nowISO: '2026-03-23T12:00:00.000Z',
    horizonDays: 30,
    planProof: {
      workableDaysRemaining: 30,
      totalRequiredUnits: Math.max(1, deliverables.length),
      requiredPacePerDay: 1,
      maxPerDay: 1,
      maxPerWeek: 7,
      slackUnits: 0,
      slackRatio: 0,
      intensityRatio: 1,
    },
    constraints: {
      timezone: 'UTC',
    },
    actionSequence,
    acceptedBlocks: [],
  });
}

describe.each(DOMAINS)('$label output quality', (scenario) => {
  it('produces concrete deliverables instead of a generic scaffold', () => {
    const contract = makeContract(`${scenario.label}-base`, scenario.goalText, scenario.verificationCriteria);
    const result = buildAutoDeliverablesFromGoalContract(contract, '2026-03-23', 'UTC');
    const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

    scenario.expectedDeliverableSnippets.forEach((snippet) => {
      expect(titles.some((title) => title.includes(snippet))).toBe(true);
    });
  });

  it('keeps scheduled block titles aligned with concrete deliverables', () => {
    const contract = makeContract(`${scenario.label}-blocks`, scenario.goalText, scenario.verificationCriteria);
    const deliverables = buildAutoDeliverablesFromGoalContract(contract, '2026-03-23', 'UTC').deliverables;
    const plan = compileBlocks(deliverables, contract.goalId);
    const blockTitles = plan.horizonBlocks.map((block) => block.title.toLowerCase());
    const expectedTitleSnippets = scenario.expectedScheduledTitleSnippets || scenario.expectedDeliverableSnippets;

    expectedTitleSnippets.forEach((snippet) => {
      expect(blockTitles.some((title) => title.includes(snippet))).toBe(true);
    });
  });

  it('changes the first output when the starting state changes', () => {
    const fromScratch = makeContract(`${scenario.label}-scratch`, scenario.goalText, scenario.verificationCriteria);
    const equipped = makeContract(
      `${scenario.label}-equipped`,
      scenario.goalText.replace(/from scratch/i, scenario.startingStateText),
      scenario.verificationCriteria
    );

    const scratchDeliverables = buildAutoDeliverablesFromGoalContract(fromScratch, '2026-03-23', 'UTC').deliverables;
    const equippedDeliverables = buildAutoDeliverablesFromGoalContract(equipped, '2026-03-23', 'UTC').deliverables;

    expect(scratchDeliverables[0]?.title.toLowerCase()).toContain(scenario.expectedStartingStateSnippet);
    expect(equippedDeliverables[0]?.title.toLowerCase()).not.toBe(scratchDeliverables[0]?.title.toLowerCase());
  });
});
