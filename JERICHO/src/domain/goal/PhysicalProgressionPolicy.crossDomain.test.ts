import { describe, expect, it } from 'vitest';
import { buildGoalPolicySnapshot, type GoalPolicySnapshot } from './GoalPolicy';
import type { CompletionBoundary, GoalIntakeContract, IntakeQuestion } from './GoalIntakeContract';

type PhysicalScenario = {
  label: string;
  goalText: string;
  startingState: string;
  required: string[];
  recommended: string[];
  optional: string[];
  blockedPrompt: string;
  blockedReason: string;
  blockedAssumptions: string[];
  draftAssumptions: string[];
};

const SCENARIOS: PhysicalScenario[] = [
  {
    label: 'strength program',
    goalText: 'Complete a 12-week strength cycle by deadline',
    startingState: 'baseline recorded',
    required: ['baseline benchmark', 'training progression', 'recovery checkpoints', 'benchmark re-test'],
    recommended: ['mobility extras', 'nutrition extras'],
    optional: ['bonus conditioning'],
    blockedPrompt: 'What load benchmark counts as success?',
    blockedReason: 'INTAKE_CONTEXT_REQUIRED',
    blockedAssumptions: ['load benchmark'],
    draftAssumptions: ['recovery profile'],
  },
  {
    label: 'endurance performance',
    goalText: 'Train for a 5k in 8 weeks with pacing and recovery checks',
    startingState: 'baseline recorded',
    required: ['baseline run benchmark', 'training progression', 'recovery checkpoints', 'benchmark re-test'],
    recommended: ['mobility extras', 'nutrition extras'],
    optional: ['bonus conditioning'],
    blockedPrompt: 'What event or benchmark counts as completion?',
    blockedReason: 'INTAKE_BOUNDARY_AMBIGUOUS',
    blockedAssumptions: ['event boundary'],
    draftAssumptions: ['benchmark target'],
  },
  {
    label: 'weight loss / body composition',
    goalText: 'Get in shape by summer',
    startingState: 'baseline recorded',
    required: ['baseline body composition', 'training progression', 'recovery checkpoints', 'benchmark re-test'],
    recommended: ['nutrition extras', 'mobility extras'],
    optional: ['bonus conditioning'],
    blockedPrompt: 'What measurable body composition target counts as done?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
    blockedAssumptions: ['measurable target'],
    draftAssumptions: ['baseline'],
  },
  {
    label: 'rehab return to training',
    goalText: 'Return to training after rehab with load tolerance rebuilt by deadline',
    startingState: 'recovery stable',
    required: ['recovery baseline', 'training progression', 'load tolerance checkpoints', 'return-to-training review'],
    recommended: ['mobility extras', 'nutrition extras'],
    optional: ['bonus conditioning'],
    blockedPrompt: 'What recovery clearance or readiness proof is still missing?',
    blockedReason: 'INTAKE_CONTEXT_REQUIRED',
    blockedAssumptions: ['recovery clearance'],
    draftAssumptions: ['recovery profile'],
  },
  {
    label: 'general conditioning',
    goalText: 'Build a conditioning base by deadline',
    startingState: 'baseline recorded',
    required: ['baseline benchmark', 'training progression', 'recovery checkpoints', 'benchmark re-test'],
    recommended: ['mobility extras', 'nutrition extras'],
    optional: ['bonus conditioning'],
    blockedPrompt: 'What performance threshold or benchmark are you building toward?',
    blockedReason: 'INTAKE_DOMAIN_CONTEXT_REQUIRED',
    blockedAssumptions: ['performance threshold'],
    draftAssumptions: ['baseline'],
  },
];

function makeQuestion(reasonCode: string, prompt: string): IntakeQuestion {
  return {
    id: `${reasonCode}-question`,
    domain: 'physical-progression',
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
      blockingReasons: options.blockingReasons || [],
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
}: {
  goalId: string;
  goalText: string;
  intake: GoalIntakeContract;
  probabilityStatus: 'disabled' | 'insufficient_evidence' | 'computed';
  hasCommittedBlocks: boolean;
  hasProposedBlocks: boolean;
  hasExecutionGraph: boolean;
}): GoalPolicySnapshot {
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

function expectScopeSplit(snapshot: GoalPolicySnapshot, scenario: PhysicalScenario) {
  expect(snapshot.scopeClassification.required).toEqual(scenario.required);
  expect(snapshot.scopeClassification.recommended).toEqual(scenario.recommended);
  expect(snapshot.scopeClassification.optional).toEqual(scenario.optional);
  expect(snapshot.macroBoundaryPolicy.required).toEqual(scenario.required);
}

describe.each(SCENARIOS)('$label policy parity', (scenario) => {
  it('keeps fully admitted, draft, and blocked outcomes distinct', () => {
    const admitted = buildPolicy({
      goalId: `${scenario.label}-admitted`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-admitted`, scenario.goalText, 'custom', 'fully_admitted', {
        startingState: scenario.startingState,
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
        excluded: [],
        completionBoundaryStatus: 'resolved',
      }),
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    const draft = buildPolicy({
      goalId: `${scenario.label}-draft`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-draft`, scenario.goalText, 'custom', 'assumption_marked_draft', {
        assumptions: scenario.draftAssumptions,
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
        startingState: null,
        completionBoundaryStatus: 'resolved',
      }),
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
        requiredContextQuestions: [makeQuestion(scenario.blockedReason, scenario.blockedPrompt)],
        assumptions: scenario.blockedAssumptions,
        excluded: ['unconfirmed recovery assumptions'],
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
    expect(draft.planQuality.reasonCodes).toContain('PLAN_STARTING_STATE_ASSUMED');
    expect(draft.posTrust.state).toBe('provisional');

    expect(blocked.intakeReadiness.state).toBe('intake_blocked');
    expect(blocked.planQuality.state).toBe('policy_blocked');
    expect(blocked.posTrust.state).toBe('withheld');
    expect(blocked.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_ADMISSION');
  });

  it('keeps schedulable training provisional when recovery evidence is thin', () => {
    const policy = buildPolicy({
      goalId: `${scenario.label}-provisional`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-provisional`, scenario.goalText, 'custom', 'fully_admitted', {
        startingState: scenario.startingState,
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
        completionBoundaryStatus: 'resolved',
      }),
      probabilityStatus: 'insufficient_evidence',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(policy.intakeReadiness.state).toBe('fully_admitted');
    expect(policy.planQuality.state).toBe('policy_clean');
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_EVIDENCE');
  });

  it('keeps required vs recommended scope separated and measurable', () => {
    const policy = buildPolicy({
      goalId: `${scenario.label}-scope`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-scope`, scenario.goalText, 'custom', 'fully_admitted', {
        startingState: scenario.startingState,
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
        completionBoundaryStatus: 'resolved',
      }),
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expectScopeSplit(policy, scenario);
    expect(policy.planQuality.scopeDiscipline).toBe('clean');
    expect(policy.planQuality.blockMeasurability).toBe('clear');
    expect(policy.macroBoundaryPolicy.bounded).toEqual([...scenario.recommended, ...scenario.optional]);
  });

  it('refuses vague training goals from becoming trusted plans', () => {
    const policy = buildPolicy({
      goalId: `${scenario.label}-vague`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-vague`, scenario.goalText, null, 'intake_blocked', {
        blockingReasons: [scenario.blockedReason],
        requiredContextQuestions: [makeQuestion(scenario.blockedReason, scenario.blockedPrompt)],
        assumptions: scenario.blockedAssumptions,
        completionBoundaryStatus: 'missing',
      }),
      probabilityStatus: 'disabled',
      hasCommittedBlocks: false,
      hasProposedBlocks: false,
      hasExecutionGraph: false,
    });

    expect(policy.intakeReadiness.state).toBe('intake_blocked');
    expect(policy.planQuality.state).toBe('policy_blocked');
    expect(policy.posTrust.state).toBe('withheld');
    expect(policy.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_ADMISSION');
  });
});
