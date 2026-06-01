import { describe, expect, it } from 'vitest';
import { buildGoalPolicySnapshot, type GoalPolicySnapshot } from './GoalPolicy';
import type { CompletionBoundary, GoalIntakeContract, IntakeQuestion } from './GoalIntakeContract';

type EmploymentScenario = {
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
    domain: 'employment-pipeline',
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
  scenario: Pick<EmploymentScenario, 'required' | 'recommended' | 'optional'>
) {
  expect(snapshot.macroBoundaryPolicy.required).toEqual(scenario.required);
  expect(snapshot.scopeClassification.required).toEqual(scenario.required);
  expect(snapshot.scopeClassification.recommended).toEqual(scenario.recommended);
  expect(snapshot.scopeClassification.optional).toEqual(scenario.optional);
  expect(snapshot.macroBoundaryPolicy.bounded).toEqual([...scenario.recommended, ...scenario.optional]);
}

const DOMAINS: EmploymentScenario[] = [
  {
    label: 'corporate role search',
    goalText: 'Land interviews for a corporate role by deadline',
    admittedBoundary: 'custom',
    startingState: 'resume ready',
    required: ['target role family', 'resume', 'application tracker', 'outreach', 'interview prep'],
    recommended: ['networking polish', 'follow-up tracking'],
    optional: ['extra interview rehearsal'],
    blockedPrompt: 'What target role family are you pursuing?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
    blockedAssumptions: ['target role family'],
    draftAssumptions: ['interview boundary'],
  },
  {
    label: 'remote knowledge work search',
    goalText: 'Land a remote knowledge role by deadline',
    admittedBoundary: 'custom',
    startingState: 'materials ready',
    required: ['target role family', 'resume', 'application tracker', 'outreach', 'interview prep'],
    recommended: ['portfolio polish', 'follow-up tracking'],
    optional: ['extra interview rehearsal'],
    blockedPrompt: 'What target role family are you pursuing?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
    blockedAssumptions: ['target role family'],
    draftAssumptions: ['starting state'],
  },
  {
    label: 'creative role search',
    goalText: 'Apply for creative roles by deadline',
    admittedBoundary: 'custom',
    startingState: 'portfolio ready',
    required: ['target role family', 'portfolio', 'tailored applications', 'interview prep'],
    recommended: ['networking polish', 'follow-up tracking'],
    optional: ['extra portfolio variants'],
    blockedPrompt: 'What target creative role family are you pursuing?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
    blockedAssumptions: ['target role family'],
    draftAssumptions: ['portfolio baseline'],
  },
  {
    label: 'skilled trade role search',
    goalText: 'Apply for skilled trade roles by deadline',
    admittedBoundary: 'custom',
    startingState: 'credential baseline recorded',
    required: ['credential proof', 'applications', 'outreach', 'interview prep'],
    recommended: ['follow-up tracking', 'tooling prep'],
    optional: ['extra credential polish'],
    blockedPrompt: 'What trade role family are you targeting?',
    blockedReason: 'INTAKE_CONTEXT_REQUIRED',
    blockedAssumptions: ['target role family'],
    draftAssumptions: ['credential baseline'],
  },
  {
    label: 'career transition search',
    goalText: 'Transition into a new role family by deadline',
    admittedBoundary: 'custom',
    startingState: 'transition narrative ready',
    required: ['transition narrative', 'target role family', 'materials', 'applications', 'interview prep'],
    recommended: ['networking polish', 'follow-up tracking'],
    optional: ['broader role exploration'],
    blockedPrompt: 'What target role family is the transition moving into?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
    blockedAssumptions: ['target role family'],
    draftAssumptions: ['transition narrative'],
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
          startingState: null,
          required: scenario.required,
          recommended: scenario.recommended,
          optional: scenario.optional,
          completionBoundaryStatus: 'ambiguous',
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
        completionBoundaryStatus: 'missing',
      }),
      probabilityStatus: 'insufficient_evidence',
      hasCommittedBlocks: false,
      hasProposedBlocks: false,
      hasExecutionGraph: false,
    });

    expect(admitted.intakeReadiness.state).toBe('fully_admitted');
    expect(admitted.planQuality.state).toBe('policy_clean');
    expect(admitted.posTrust.state).toBe('trusted');

    expect(draft.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(draft.planQuality.state).toBe('policy_degraded');
    expect(draft.posTrust.state).toBe('provisional');

    expect(blocked.intakeReadiness.state).toBe('intake_blocked');
    expect(blocked.planQuality.state).toBe('policy_blocked');
    expect(blocked.posTrust.state).toBe('withheld');
    expect(blocked.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_ADMISSION');
  });

  it('keeps schedulable internal work provisional until employer evidence exists', () => {
    const policy = buildPolicy({
      goalId: `${scenario.label}-schedulable`,
      goalText: scenario.goalText,
      intake: makeIntake(
        `${scenario.label}-schedulable`,
        scenario.goalText,
        scenario.admittedBoundary,
        'fully_admitted',
        {
          startingState: scenario.startingState,
          required: scenario.required,
          recommended: scenario.recommended,
          optional: scenario.optional,
        }
      ),
      probabilityStatus: 'insufficient_evidence',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(policy.planQuality.state).toBe('policy_clean');
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_EVIDENCE');
  });

  it('keeps required work distinct from recommended support work', () => {
    const policy = buildPolicy({
      goalId: `${scenario.label}-scope`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-scope`, scenario.goalText, scenario.admittedBoundary, 'fully_admitted', {
        startingState: scenario.startingState,
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
      }),
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expectScopeSplit(policy, scenario);
  });

  it('refuses to invent employer traction or role-fit evidence', () => {
    const blocked = buildPolicy({
      goalId: `${scenario.label}-traction`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-traction`, scenario.goalText, null, 'intake_blocked', {
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
      hasCommittedBlocks: false,
      hasProposedBlocks: false,
      hasExecutionGraph: false,
    });

    expect(blocked.intakeReadiness.state).toBe('intake_blocked');
    expect(blocked.planQuality.state).toBe('policy_blocked');
    expect(blocked.scopeClassification.blockedByUnconfirmedContext).toContain(scenario.blockedAssumptions[0]);
    expect(blocked.posTrust.state).toBe('withheld');
  });
});
