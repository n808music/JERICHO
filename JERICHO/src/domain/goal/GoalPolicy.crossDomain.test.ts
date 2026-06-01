import { describe, expect, it } from 'vitest';
import { buildGoalPolicySnapshot, type GoalPolicySnapshot } from './GoalPolicy';
import type { CompletionBoundary, GoalIntakeContract, IntakeQuestion } from './GoalIntakeContract';

type DomainScenario = {
  label: string;
  goalText: string;
  admittedBoundary: CompletionBoundary;
  startingState: string;
  required: string[];
  recommended: string[];
  optional: string[];
  blockedPrompt: string;
  blockedReason: string;
  blockedAssumptions: string[];
  draftAssumptions: string[];
};

type PolicyInput = {
  goalId: string;
  goalText: string;
  intake: GoalIntakeContract;
  probabilityStatus: 'disabled' | 'insufficient_evidence' | 'computed';
  hasCommittedBlocks: boolean;
  hasProposedBlocks: boolean;
  hasExecutionGraph: boolean;
};

function makeExecutionContract(goalId: string, goalText: string) {
  return {
    goalId,
    terminalOutcome: {
      text: goalText,
      hash: `${goalId}-hash`,
      verificationCriteria: `${goalText} verified`,
      isConcrete: true,
    },
  } as any;
}

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

function makeIntake(
  goalId: string,
  goalText: string,
  boundary: CompletionBoundary | null,
  state: 'fully_admitted' | 'assumption_marked_draft' | 'intake_blocked',
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
  } = {}
): GoalIntakeContract {
  const assumptions = options.assumptions || [];
  const blockingReasons = options.blockingReasons || [];
  const requiredContextQuestions = options.requiredContextQuestions || [];
  return {
    goalId,
    rawGoalText: goalText,
    domain: 'general',
    targetArtifactType: 'deliverables',
    targetCount: 1,
    deadline: '2026-06-30',
    commitmentVerb: goalText.split(' ', 1)[0]?.toLowerCase() || null,
    completionBoundary: boundary,
    completionBoundaryStatus: options.completionBoundaryStatus || (boundary ? 'resolved' : 'missing'),
    deliveryMode: null,
    productionMode: null,
    startingState: options.startingState ?? null,
    requiredContextQuestions,
    answeredContext: {},
    scopePolicy: {
      required: options.required || [],
      recommended: options.recommended || [],
      optional: options.optional || [],
      excluded: options.excluded || [],
      assumptionsNeedingConfirmation: assumptions,
    },
    readiness: {
      state,
      isReadyForPlanning: state !== 'intake_blocked',
      blockingReasons,
      assumptionReasons: assumptions,
    },
  };
}

function buildPolicy({
  goalId,
  goalText,
  intake,
  probabilityStatus,
  hasCommittedBlocks,
  hasProposedBlocks,
  hasExecutionGraph,
}: PolicyInput): GoalPolicySnapshot {
  return buildGoalPolicySnapshot({
    goalId,
    intakeContract: intake,
    executionContract: makeExecutionContract(goalId, goalText),
    planProof: { feasibilityStatus: 'FEASIBLE' },
    probabilityStatus,
    feasibilityStatus: 'FEASIBLE',
    hasCommittedBlocks,
    hasProposedBlocks,
    hasExecutionGraph,
  });
}

function expectScopeSplit(
  snapshot: GoalPolicySnapshot,
  scenario: Pick<DomainScenario, 'required' | 'recommended' | 'optional'>
) {
  expect(snapshot.macroBoundaryPolicy.required).toEqual(scenario.required);
  expect(snapshot.scopeClassification.required).toEqual(scenario.required);
  expect(snapshot.scopeClassification.recommended).toEqual(scenario.recommended);
  expect(snapshot.scopeClassification.optional).toEqual(scenario.optional);
  expect(snapshot.macroBoundaryPolicy.bounded).toEqual([...scenario.recommended, ...scenario.optional]);
}

const DOMAINS: DomainScenario[] = [
  {
    label: 'podcast / media',
    goalText: 'Publish 6 episodes by deadline',
    admittedBoundary: 'published',
    startingState: 'from scratch',
    required: ['outline', 'record', 'edit', 'show notes', 'hosting setup', 'release workflow', 'publish'],
    recommended: ['launch landing page', 'social pack'],
    optional: ['post-launch review'],
    blockedPrompt: 'What counts as complete by the deadline?',
    blockedReason: 'INTAKE_BOUNDARY_AMBIGUOUS',
    blockedAssumptions: ['completion boundary'],
    draftAssumptions: ['starting state'],
  },
  {
    label: 'software / product build',
    goalText: 'Ship a v1 feature by deadline',
    admittedBoundary: 'launched',
    startingState: 'prototype ready',
    required: ['implementation', 'basic verification'],
    recommended: ['test coverage', 'release workflow', 'rollout'],
    optional: ['polish'],
    blockedPrompt: 'What is the actual feature artifact?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
    blockedAssumptions: ['artifact'],
    draftAssumptions: ['deployment boundary'],
  },
  {
    label: 'fitness / training',
    goalText: 'Prepare for a marathon by deadline',
    admittedBoundary: 'custom',
    startingState: 'baseline recorded',
    required: ['training sessions', 'recovery', 'milestone tests'],
    recommended: ['nutrition', 'mobility'],
    optional: ['gear upgrades'],
    blockedPrompt: 'What is the measurable event target?',
    blockedReason: 'INTAKE_CONTEXT_REQUIRED',
    blockedAssumptions: ['measurable target'],
    draftAssumptions: ['baseline'],
  },
  {
    label: 'business launch',
    goalText: 'Launch a service by deadline',
    admittedBoundary: 'launched',
    startingState: 'offer defined',
    required: ['offer', 'pricing', 'delivery process', 'outreach', 'close'],
    recommended: ['landing page', 'post-launch review'],
    optional: ['secondary channel'],
    blockedPrompt: 'What offer are you launching?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
    blockedAssumptions: ['offer'],
    draftAssumptions: ['launch boundary'],
  },
  {
    label: 'real estate / project',
    goalText: 'Renovate a rental unit to inspection-ready by deadline',
    admittedBoundary: 'approved',
    startingState: 'site verified',
    required: ['scope', 'permits', 'critical path', 'inspection milestones'],
    recommended: ['contingency tasks'],
    optional: ['upgrades'],
    blockedPrompt: 'What permit or ownership state is still unresolved?',
    blockedReason: 'INTAKE_CONTEXT_REQUIRED',
    blockedAssumptions: ['permit status'],
    draftAssumptions: ['permit status'],
  },
];

describe.each(DOMAINS)('$label policy parity', (scenario) => {
  it('keeps fully admitted, draft, and blocked outcomes distinct', () => {
    const admitted = buildPolicy({
      goalId: `${scenario.label}-admitted`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-admitted`, scenario.goalText, scenario.admittedBoundary, 'fully_admitted', {
        startingState: scenario.startingState,
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
        excluded: [],
      }),
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    const draft = buildPolicy({
      goalId: `${scenario.label}-draft`,
      goalText: scenario.goalText,
      intake: makeIntake(
        `${scenario.label}-draft`,
        scenario.goalText,
        scenario.admittedBoundary,
        'assumption_marked_draft',
        {
          assumptions: scenario.draftAssumptions,
          required: scenario.required,
          recommended: scenario.recommended,
          optional: scenario.optional,
          excluded: [],
          startingState: null,
        }
      ),
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    const blocked = buildPolicy({
      goalId: `${scenario.label}-blocked`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-blocked`, scenario.goalText, null, 'intake_blocked', {
        blockingReasons: [scenario.blockedReason],
        assumptions: scenario.blockedAssumptions,
        requiredContextQuestions: [makeQuestion(scenario.blockedReason, scenario.blockedPrompt)],
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
        excluded: scenario.required,
        completionBoundaryStatus: 'ambiguous',
      }),
      probabilityStatus: 'insufficient_evidence',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(admitted.intakeReadiness.state).toBe('fully_admitted');
    expect(admitted.planQuality.state).toBe('policy_clean');
    expect(admitted.posTrust.state).toBe('trusted');
    expectScopeSplit(admitted, scenario);

    expect(draft.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(draft.planQuality.state).toBe('policy_degraded');
    expect(draft.planQuality.reasonCodes).toContain('PLAN_STARTING_STATE_ASSUMED');
    expect(draft.posTrust.state).toBe('provisional');
    expect(draft.scopeClassification.assumedBaselineSupporting).toEqual(scenario.draftAssumptions);

    expect(blocked.intakeReadiness.state).toBe('intake_blocked');
    expect(blocked.planQuality.state).toBe('policy_blocked');
    expect(blocked.posTrust.state).toBe('withheld');
    expect(blocked.scopeClassification.blockedByUnconfirmedContext).toEqual(scenario.blockedAssumptions);
  });
});

describe('cross-domain ambiguity parity', () => {
  it('maps the same ambiguity class to the same readiness and trust family across domains', () => {
    const softwareBlocked = buildPolicy({
      goalId: 'software-ambiguity',
      goalText: 'Build the product by deadline',
      intake: makeIntake('software-ambiguity', 'Build the product by deadline', null, 'intake_blocked', {
        blockingReasons: ['INTAKE_ARTIFACT_UNCLEAR'],
        assumptions: ['artifact'],
        requiredContextQuestions: [makeQuestion('INTAKE_ARTIFACT_UNCLEAR', 'What is the actual product artifact?')],
        required: ['implementation'],
        recommended: ['tests'],
        optional: ['polish'],
        excluded: ['release workflow'],
        completionBoundaryStatus: 'missing',
      }),
      probabilityStatus: 'insufficient_evidence',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    const realEstateBlocked = buildPolicy({
      goalId: 'real-estate-ambiguity',
      goalText: 'Complete the project',
      intake: makeIntake('real-estate-ambiguity', 'Complete the project', null, 'intake_blocked', {
        blockingReasons: ['INTAKE_CONTEXT_REQUIRED'],
        assumptions: ['permit status'],
        requiredContextQuestions: [
          makeQuestion('INTAKE_CONTEXT_REQUIRED', 'What permit or ownership state is unresolved?'),
        ],
        required: ['scope'],
        recommended: ['contingency tasks'],
        optional: ['upgrades'],
        excluded: ['acquisition assumption'],
        completionBoundaryStatus: 'missing',
      }),
      probabilityStatus: 'insufficient_evidence',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    const podcastDraft = buildPolicy({
      goalId: 'podcast-draft',
      goalText: 'Publish 6 episodes by deadline',
      intake: makeIntake('podcast-draft', 'Publish 6 episodes by deadline', 'published', 'assumption_marked_draft', {
        assumptions: ['starting state'],
        required: ['outline', 'record', 'edit', 'show notes', 'hosting setup', 'release workflow', 'publish'],
        recommended: ['launch landing page', 'social pack'],
        optional: ['post-launch review'],
        excluded: [],
        startingState: null,
      }),
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    const fitnessDraft = buildPolicy({
      goalId: 'fitness-draft',
      goalText: 'Prepare for a marathon by deadline',
      intake: makeIntake('fitness-draft', 'Prepare for a marathon by deadline', 'custom', 'assumption_marked_draft', {
        assumptions: ['baseline'],
        required: ['training sessions', 'recovery', 'milestone tests'],
        recommended: ['nutrition', 'mobility'],
        optional: ['gear upgrades'],
        excluded: [],
        startingState: null,
      }),
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(softwareBlocked.intakeReadiness.state).toBe('intake_blocked');
    expect(realEstateBlocked.intakeReadiness.state).toBe('intake_blocked');
    expect(softwareBlocked.posTrust.state).toBe('withheld');
    expect(realEstateBlocked.posTrust.state).toBe('withheld');

    expect(podcastDraft.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(fitnessDraft.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(podcastDraft.posTrust.state).toBe('provisional');
    expect(fitnessDraft.posTrust.state).toBe('provisional');
  });
});
