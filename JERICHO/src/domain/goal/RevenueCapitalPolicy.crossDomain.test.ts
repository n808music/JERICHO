import { describe, expect, it } from 'vitest';
import { getLaneContextSpec, selectContextQuestionsForLane } from '../../state/contracts/contextAdmissionMatrix1_0';
import { buildGoalPolicySnapshot } from './GoalPolicy';
import type { CompletionBoundary, GoalIntakeContract, IntakeQuestion } from './GoalIntakeContract';

type RevenueCapitalScenario = {
  archetype: 'SalesPipeline' | 'Fundraising';
  subtype: string;
  goalText: string;
  admittedBoundary: CompletionBoundary;
  startingState: string;
  required: string[];
  recommended: string[];
  optional: string[];
  blockedPrompt: string;
  blockedReason: string;
};

function makeQuestion(reasonCode: string, prompt: string): IntakeQuestion {
  return {
    id: `${reasonCode}-question`,
    domain: 'revenue-capital',
    prompt,
    field: 'completionBoundary',
    answerType: 'single_select',
    required: true,
    reasonCode,
  };
}

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
  } = {}
): GoalIntakeContract {
  const assumptions = options.assumptions || [];
  const blockingReasons = options.blockingReasons || [];
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
    requiredContextQuestions: options.requiredContextQuestions || [],
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

function buildPolicy(args: {
  goalId: string;
  goalText: string;
  intake: GoalIntakeContract;
  probabilityStatus: 'disabled' | 'insufficient_evidence' | 'computed';
  hasCommittedBlocks: boolean;
  hasProposedBlocks: boolean;
  hasExecutionGraph: boolean;
}) {
  return buildGoalPolicySnapshot({
    goalId: args.goalId,
    intakeContract: args.intake,
    executionContract: makeExecutionContract(args.goalId, args.goalText),
    planProof: { feasibilityStatus: 'FEASIBLE' },
    probabilityStatus: args.probabilityStatus,
    feasibilityStatus: 'FEASIBLE',
    hasCommittedBlocks: args.hasCommittedBlocks,
    hasProposedBlocks: args.hasProposedBlocks,
    hasExecutionGraph: args.hasExecutionGraph,
  });
}

const LANES: RevenueCapitalScenario[] = [
  {
    archetype: 'SalesPipeline',
    subtype: 'B2B Service Sales',
    goalText:
      'Close 10 B2B service sales by deadline with a qualified pipeline already active and proposals in motion.',
    admittedBoundary: 'sold',
    startingState: 'qualified pipeline active',
    required: ['target list', 'outreach', 'calls', 'proposals', 'close'],
    recommended: ['CRM hygiene', 'case studies'],
    optional: ['advanced analytics'],
    blockedPrompt: 'What exact offer are you selling and what counts as success by deadline?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
  },
  {
    archetype: 'Fundraising',
    subtype: 'Angel Raise',
    goalText: 'Secure angel funding by deadline with a deck, investor list, and qualified meetings already underway.',
    admittedBoundary: 'custom',
    startingState: 'investor meetings active',
    required: ['deck', 'target list', 'outreach', 'meetings', 'diligence'],
    recommended: ['data room', 'follow-up'],
    optional: ['PR / announcement'],
    blockedPrompt: 'What amount are you raising and what counts as success by deadline?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
  },
];

describe.each(LANES)('$archetype / $subtype policy parity', (scenario) => {
  it('asks stage-definition questions instead of inventing traction', () => {
    const spec = getLaneContextSpec(scenario.archetype, scenario.subtype);
    expect(spec.requiredQuestions).toHaveLength(3);
    expect(spec.optionalQuestions).toHaveLength(2);

    const selection = selectContextQuestionsForLane({
      archetype: scenario.archetype,
      subtype: scenario.subtype,
      answeredQuestionIds: [],
      askOptional: true,
    });

    expect(selection.confirmationRequired).toBe(true);
    expect(selection.requiredQuestionsToAsk.length).toBeGreaterThan(0);
    expect(selection.requiredQuestionsToAsk.some((question) => question.text.toLowerCase().includes('success'))).toBe(
      true
    );
    expect(
      selection.requiredQuestionsToAsk.some((question) => {
        const text = question.text.toLowerCase();
        return scenario.archetype === 'SalesPipeline' ? text.includes('offer') : text.includes('amount');
      })
    ).toBe(true);
    expect(selection.assumptionsApplied.length).toBeGreaterThan(0);
  });

  it('keeps fully admitted work trusted without inflating support scope', () => {
    const policy = buildPolicy({
      goalId: `${scenario.archetype}-admitted`,
      goalText: scenario.goalText,
      intake: makeIntake(
        `${scenario.archetype}-admitted`,
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
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(policy.intakeReadiness.state).toBe('fully_admitted');
    expect(policy.planQuality.state).toBe('policy_clean');
    expect(policy.posTrust.state).toBe('trusted');
    expect(policy.macroBoundaryPolicy.required).toEqual(scenario.required);
    expect(policy.scopeClassification.recommended).toEqual(scenario.recommended);
    expect(policy.scopeClassification.optional).toEqual(scenario.optional);
    expect(policy.macroBoundaryPolicy.bounded).toEqual([...scenario.recommended, ...scenario.optional]);
  });

  it('keeps assumption-marked drafts distinct from fully admitted plans', () => {
    const policy = buildPolicy({
      goalId: `${scenario.archetype}-draft`,
      goalText: scenario.goalText,
      intake: makeIntake(
        `${scenario.archetype}-draft`,
        scenario.goalText,
        scenario.admittedBoundary,
        'assumption_marked_draft',
        {
          assumptions: ['starting state', 'external evidence'],
          required: scenario.required,
          recommended: scenario.recommended,
          optional: scenario.optional,
          startingState: null,
        }
      ),
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(policy.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(policy.planQuality.state).toBe('policy_degraded');
    expect(policy.planQuality.reasonCodes).toContain('PLAN_STARTING_STATE_ASSUMED');
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.scopeClassification.assumedBaselineSupporting).toContain('starting state');
  });

  it('blocks unclear goals instead of inventing traction or investor response', () => {
    const blocked = buildPolicy({
      goalId: `${scenario.archetype}-blocked`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.archetype}-blocked`, scenario.goalText, null, 'intake_blocked', {
        blockingReasons: [scenario.blockedReason],
        assumptions: ['offer'],
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
    expect(blocked.posTrust.state).toBe('withheld');
    expect(blocked.scopeClassification.blockedByUnconfirmedContext).toContain('offer');
  });

  it('keeps scheduled work provisional when external evidence is missing', () => {
    const policy = buildPolicy({
      goalId: `${scenario.archetype}-schedulable`,
      goalText: scenario.goalText,
      intake: makeIntake(
        `${scenario.archetype}-schedulable`,
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
});
