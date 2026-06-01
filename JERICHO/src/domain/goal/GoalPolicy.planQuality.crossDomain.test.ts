import { describe, expect, it } from 'vitest';
import { buildGoalPolicySnapshot, type GoalPolicySnapshot } from './GoalPolicy';
import type { CompletionBoundary, GoalIntakeContract, IntakeQuestion } from './GoalIntakeContract';

type DomainFixture = {
  label: string;
  goalText: string;
  boundary: CompletionBoundary;
  startingState: string;
  required: string[];
  recommended: string[];
  optional: string[];
};

const DOMAINS: DomainFixture[] = [
  {
    label: 'podcast / media',
    goalText: 'Publish 6 episodes by deadline',
    boundary: 'published',
    startingState: 'from scratch',
    required: ['outline', 'record', 'edit', 'show notes', 'hosting setup', 'release workflow', 'publish'],
    recommended: ['launch landing page', 'social pack'],
    optional: ['post-launch review'],
  },
  {
    label: 'software / product build',
    goalText: 'Build the product by deadline',
    boundary: 'launched',
    startingState: 'prototype ready',
    required: ['artifact definition', 'implementation', 'basic verification'],
    recommended: ['release workflow', 'rollout'],
    optional: ['polish'],
  },
  {
    label: 'fitness / training',
    goalText: 'Prepare for a marathon by deadline',
    boundary: 'custom',
    startingState: 'baseline recorded',
    required: ['training sessions', 'recovery', 'milestone tests'],
    recommended: ['nutrition', 'mobility'],
    optional: ['gear upgrades'],
  },
  {
    label: 'business launch',
    goalText: 'Launch a service by deadline',
    boundary: 'launched',
    startingState: 'offer defined',
    required: ['offer', 'pricing', 'delivery process', 'outreach', 'close'],
    recommended: ['landing page', 'post-launch review'],
    optional: ['secondary channel'],
  },
  {
    label: 'real estate / project',
    goalText: 'Renovate a rental unit to inspection-ready by deadline',
    boundary: 'approved',
    startingState: 'site verified',
    required: ['scope', 'permits', 'critical path', 'inspection milestones'],
    recommended: ['contingency tasks'],
    optional: ['upgrades'],
  },
];

function makeQuestion(reasonCode: string, prompt: string): IntakeQuestion {
  return {
    id: `${reasonCode}-question`,
    domain: 'cross-domain',
    prompt,
    field: 'completionBoundary',
    answerType: 'single_select',
    required: true,
    reasonCode,
  };
}

function makeExecutionContract(goalId: string, goalText: string, isConcrete = true) {
  return {
    goalId,
    terminalOutcome: {
      text: goalText,
      hash: `${goalId}-hash`,
      verificationCriteria: `${goalText} verified`,
      isConcrete,
    },
  } as any;
}

function makeIntake(
  goalId: string,
  goalText: string,
  boundary: CompletionBoundary | null,
  state: GoalIntakeContract['readiness']['state'],
  options: {
    startingState?: string | null;
    assumptions?: string[];
    blockingReasons?: string[];
    requiredContextQuestions?: IntakeQuestion[];
    required?: string[];
    recommended?: string[];
    optional?: string[];
    excluded?: string[];
    completionBoundaryStatus?: 'resolved' | 'ambiguous' | 'missing';
    targetArtifactType?: string | null;
    verificationCriteria?: string | null;
  } = {}
): GoalIntakeContract {
  return {
    goalId,
    rawGoalText: goalText,
    domain: 'general',
    targetArtifactType: options.targetArtifactType ?? 'deliverables',
    targetCount: 1,
    deadline: '2026-06-30',
    commitmentVerb: goalText.split(' ', 1)[0]?.toLowerCase() || null,
    completionBoundary: boundary,
    completionBoundaryStatus: options.completionBoundaryStatus || (boundary ? 'resolved' : 'missing'),
    deliveryMode: null,
    productionMode: null,
    startingState: options.startingState ?? null,
    requiredContextQuestions: options.requiredContextQuestions || [],
    answeredContext: {},
    scopePolicy: {
      required: options.required || [],
      recommended: options.recommended || [],
      optional: options.optional || [],
      excluded: options.excluded || [],
      assumptionsNeedingConfirmation: options.assumptions || [],
    },
    readiness: {
      state,
      isReadyForPlanning: state !== 'intake_blocked',
      blockingReasons: options.blockingReasons || [],
      assumptionReasons: options.assumptions || [],
    },
  };
}

function buildPolicy(args: {
  goalId: string;
  goalText: string;
  intake: GoalIntakeContract;
  isConcrete?: boolean;
  verificationCriteria?: string;
  planProof?: { feasibilityStatus?: 'FEASIBLE' | 'INFEASIBLE' | string };
}) {
  return buildGoalPolicySnapshot({
    goalId: args.goalId,
    intakeContract: args.intake,
    executionContract: {
      goalId: args.goalId,
      terminalOutcome: {
        text: args.goalText,
        hash: `${args.goalId}-hash`,
        verificationCriteria: args.verificationCriteria || `${args.goalText} verified`,
        isConcrete: args.isConcrete ?? true,
      },
    } as any,
    planProof: args.planProof || { feasibilityStatus: 'FEASIBLE' },
    probabilityStatus: 'computed',
    feasibilityStatus: args.planProof?.feasibilityStatus || 'FEASIBLE',
    hasCommittedBlocks: true,
    hasProposedBlocks: true,
    hasExecutionGraph: true,
  });
}

function expectScopeSplit(snapshot: GoalPolicySnapshot, scenario: DomainFixture) {
  expect(snapshot.macroBoundaryPolicy.required).toEqual(scenario.required);
  expect(snapshot.scopeClassification.required).toEqual(scenario.required);
  expect(snapshot.scopeClassification.recommended).toEqual(scenario.recommended);
  expect(snapshot.scopeClassification.optional).toEqual(scenario.optional);
  expect(snapshot.macroBoundaryPolicy.bounded).toEqual([...scenario.recommended, ...scenario.optional]);
}

describe.each(DOMAINS)('$label quality parity', (scenario) => {
  it('keeps a policy-clean plan trusted and measurable', () => {
    const policy = buildPolicy({
      goalId: `${scenario.label}-clean`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-clean`, scenario.goalText, scenario.boundary, 'fully_admitted', {
        startingState: scenario.startingState,
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
      }),
    });

    expect(policy.intakeReadiness.state).toBe('fully_admitted');
    expect(policy.planQuality.state).toBe('policy_clean');
    expect(policy.planQuality.endpointClarity).toBe('clear');
    expect(policy.planQuality.startingPointHonesty).toBe('explicit');
    expect(policy.planQuality.scopeDiscipline).toBe('clean');
    expect(policy.planQuality.blockMeasurability).toBe('clear');
    expect(policy.planQuality.feasibilityHonesty).toBe('clear');
    expect(policy.posTrust.state).toBe('trusted');
    expectScopeSplit(policy, scenario);
  });

  it('downgrades a plan when the starting state is only assumed', () => {
    const policy = buildPolicy({
      goalId: `${scenario.label}-draft`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-draft`, scenario.goalText, scenario.boundary, 'assumption_marked_draft', {
        assumptions: ['starting state'],
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
        startingState: null,
      }),
    });

    expect(policy.planQuality.state).toBe('policy_degraded');
    expect(policy.planQuality.startingPointHonesty).toBe('assumed');
    expect(policy.planQuality.reasonCodes).toContain('PLAN_STARTING_STATE_ASSUMED');
    expect(policy.planQuality.scopeDiscipline).toBe('degraded');
    expect(policy.posTrust.state).toBe('provisional');
  });

  it('downgrades a plan when measurability is weak', () => {
    const policy = buildPolicy({
      goalId: `${scenario.label}-weak-measure`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-weak-measure`, scenario.goalText, scenario.boundary, 'fully_admitted', {
        startingState: scenario.startingState,
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
      }),
      isConcrete: false,
      verificationCriteria: '',
    });

    expect(policy.planQuality.state).toBe('policy_degraded');
    expect(policy.planQuality.blockMeasurability).toBe('weak');
    expect(policy.planQuality.reasonCodes).toContain('PLAN_MEASURABILITY_WEAK');
    expect(policy.posTrust.state).toBe('provisional');
  });

  it('blocks trust when feasibility is not truthful', () => {
    const policy = buildPolicy({
      goalId: `${scenario.label}-infeasible`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-infeasible`, scenario.goalText, scenario.boundary, 'fully_admitted', {
        startingState: scenario.startingState,
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
      }),
      planProof: { feasibilityStatus: 'INFEASIBLE' },
    });

    expect(policy.planQuality.state).toBe('policy_blocked');
    expect(policy.planQuality.feasibilityHonesty).toBe('blocked');
    expect(policy.planQuality.reasonCodes).toContain('PLAN_FEASIBILITY_NOT_TRUTHFUL');
    expect(policy.posTrust.state).toBe('withheld');
    expect(policy.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_PLAN_QUALITY');
  });
});

describe('cross-domain plan-quality parity', () => {
  it('treats the same quality defect family consistently across domains', () => {
    const podcastDraft = buildPolicy({
      goalId: 'podcast-quality-draft',
      goalText: 'Publish 6 episodes by deadline',
      intake: makeIntake(
        'podcast-quality-draft',
        'Publish 6 episodes by deadline',
        'published',
        'assumption_marked_draft',
        {
          assumptions: ['starting state'],
          required: ['outline', 'record', 'edit', 'show notes', 'hosting setup', 'release workflow', 'publish'],
          recommended: ['launch landing page', 'social pack'],
          optional: ['post-launch review'],
        }
      ),
    });

    const softwareWeak = buildPolicy({
      goalId: 'software-quality-weak',
      goalText: 'Build the product by deadline',
      intake: makeIntake('software-quality-weak', 'Build the product by deadline', 'launched', 'fully_admitted', {
        startingState: 'prototype ready',
        required: ['artifact definition', 'implementation', 'basic verification'],
        recommended: ['release workflow', 'rollout'],
        optional: ['polish'],
      }),
      isConcrete: false,
      verificationCriteria: '',
    });

    expect(podcastDraft.planQuality.state).toBe('policy_degraded');
    expect(softwareWeak.planQuality.state).toBe('policy_degraded');
    expect(podcastDraft.posTrust.state).toBe('provisional');
    expect(softwareWeak.posTrust.state).toBe('provisional');
  });
});
