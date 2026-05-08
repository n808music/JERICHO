import { describe, expect, it } from 'vitest';
import { buildGoalPolicySnapshot, type GoalPolicySnapshot } from './GoalPolicy';
import type { CompletionBoundary, GoalIntakeContract, IntakeQuestion } from './GoalIntakeContract';

type CapabilityScenario = {
  label: string;
  family: 'SkillAcquisition' | 'ProfessionalQualification';
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

const SCENARIOS: CapabilityScenario[] = [
  {
    label: 'software skill acquisition',
    family: 'SkillAcquisition',
    goalText: 'Learn React well enough in 45 days to build and publish two working portfolio projects',
    startingState: 'baseline recorded',
    required: ['baseline assessment', 'practice plan', 'drill set', 'working project', 'proof review'],
    recommended: ['pair review', 'extra drills'],
    optional: ['bonus project'],
    blockedPrompt: 'What skill are you targeting and what proof counts as done?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
    blockedAssumptions: ['target skill'],
    draftAssumptions: ['baseline'],
  },
  {
    label: 'design skill acquisition',
    family: 'SkillAcquisition',
    goalText: 'Learn Figma in 30 days to create three polished mobile app mockup sets',
    startingState: 'tool fluency started',
    required: ['baseline assessment', 'practice drills', 'mockup set', 'critique review'],
    recommended: ['reference board', 'extra critique'],
    optional: ['bonus variant'],
    blockedPrompt: 'What design output counts as proof of competence?',
    blockedReason: 'INTAKE_CONTEXT_REQUIRED',
    blockedAssumptions: ['proof boundary'],
    draftAssumptions: ['baseline'],
  },
  {
    label: 'communication skill acquisition',
    family: 'SkillAcquisition',
    goalText: 'Improve public speaking in 21 days with daily drills and three recorded practice talks',
    startingState: 'baseline recorded',
    required: ['baseline recording', 'daily drill set', 'recorded talks', 'feedback review', 'final presentation'],
    recommended: ['timing review', 'extra rehearsal'],
    optional: ['bonus talk'],
    blockedPrompt: 'What performance boundary counts as completion?',
    blockedReason: 'INTAKE_BOUNDARY_AMBIGUOUS',
    blockedAssumptions: ['performance boundary'],
    draftAssumptions: ['performance boundary'],
  },
  {
    label: 'technical trade skill acquisition',
    family: 'SkillAcquisition',
    goalText: 'Learn HVAC maintenance fundamentals in 60 days to complete five procedures independently',
    startingState: 'safety review complete',
    required: ['safety review', 'guided reps', 'independent reps', 'checklist validation'],
    recommended: ['tool prep', 'extra supervision'],
    optional: ['reference notes'],
    blockedPrompt: 'What procedure set and independence threshold are you targeting?',
    blockedReason: 'INTAKE_CONTEXT_REQUIRED',
    blockedAssumptions: ['procedure threshold'],
    draftAssumptions: ['baseline'],
  },
  {
    label: 'creative skill acquisition',
    family: 'SkillAcquisition',
    goalText: 'Improve songwriting in 45 days with technique study and three finished song drafts',
    startingState: 'baseline recorded',
    required: ['technique study', 'writing exercises', 'song drafts', 'revision pass'],
    recommended: ['reference set', 'extra critique'],
    optional: ['bonus draft'],
    blockedPrompt: 'What finished output counts as proof of improvement?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
    blockedAssumptions: ['proof boundary'],
    draftAssumptions: ['baseline'],
  },
  {
    label: 'certification exam',
    family: 'ProfessionalQualification',
    goalText: 'Pass the AWS Certified Cloud Practitioner exam by May 15',
    startingState: 'study coverage mapped',
    required: ['requirements review', 'study plan', 'practice exams', 'remediation', 'final review'],
    recommended: ['flashcards', 'score tracking'],
    optional: ['bonus practice'],
    blockedPrompt: 'What certification boundary and readiness threshold are you targeting?',
    blockedReason: 'INTAKE_CONTEXT_REQUIRED',
    blockedAssumptions: ['exam boundary'],
    draftAssumptions: ['readiness threshold'],
  },
  {
    label: 'licensure exam',
    family: 'ProfessionalQualification',
    goalText: 'Prepare for and pass the real estate licensing exam within 90 days',
    startingState: 'registration complete',
    required: ['requirements review', 'registration', 'study coverage', 'practice testing', 'final readiness'],
    recommended: ['compliance prep', 'schedule checks'],
    optional: ['bonus review'],
    blockedPrompt: 'What licensure boundary and proof of readiness count as done?',
    blockedReason: 'INTAKE_BOUNDARY_AMBIGUOUS',
    blockedAssumptions: ['licensure boundary'],
    draftAssumptions: ['readiness threshold'],
  },
  {
    label: 'compliance training completion',
    family: 'ProfessionalQualification',
    goalText: 'Complete mandatory compliance training and verification by deadline',
    startingState: 'modules started',
    required: ['module completion', 'assessment', 'verification submission'],
    recommended: ['review notes'],
    optional: ['extra refresher'],
    blockedPrompt: 'Which compliance modules and verification step are required?',
    blockedReason: 'INTAKE_CONTEXT_REQUIRED',
    blockedAssumptions: ['verification boundary'],
    draftAssumptions: ['baseline'],
  },
  {
    label: 'portfolio-based qualification',
    family: 'ProfessionalQualification',
    goalText: 'Get a portfolio accepted by deadline',
    startingState: 'portfolio draft ready',
    required: ['artifact creation', 'curation', 'narrative alignment', 'submission'],
    recommended: ['extra samples', 'polish review'],
    optional: ['bonus version'],
    blockedPrompt: 'What portfolio acceptance criteria count as proof?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
    blockedAssumptions: ['acceptance criteria'],
    draftAssumptions: ['proof boundary'],
  },
  {
    label: 'interview-based qualification',
    family: 'ProfessionalQualification',
    goalText: 'Qualify through interviews for a target role by deadline',
    startingState: 'materials ready',
    required: ['materials prep', 'rehearsal', 'feedback', 'interview execution'],
    recommended: ['answer bank', 'follow-up'],
    optional: ['extra mock interview'],
    blockedPrompt: 'What interview qualification boundary counts as success?',
    blockedReason: 'INTAKE_CONTEXT_REQUIRED',
    blockedAssumptions: ['qualification boundary'],
    draftAssumptions: ['baseline'],
  },
];

function makeQuestion(reasonCode: string, prompt: string): IntakeQuestion {
  return {
    id: `${reasonCode}-question`,
    domain: 'capability-credential',
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

function expectScopeSplit(snapshot: GoalPolicySnapshot, scenario: CapabilityScenario) {
  expect(snapshot.macroBoundaryPolicy.required).toEqual(scenario.required);
  expect(snapshot.scopeClassification.required).toEqual(scenario.required);
  expect(snapshot.scopeClassification.recommended).toEqual(scenario.recommended);
  expect(snapshot.scopeClassification.optional).toEqual(scenario.optional);
  expect(snapshot.macroBoundaryPolicy.bounded).toEqual([...scenario.recommended, ...scenario.optional]);
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
    expectScopeSplit(admitted, scenario);

    expect(draft.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(draft.planQuality.state).toBe('policy_degraded');
    expect(draft.planQuality.reasonCodes).toContain('PLAN_STARTING_STATE_ASSUMED');
    expect(draft.posTrust.state).toBe('provisional');
    expect(draft.scopeClassification.assumedBaselineSupporting).toEqual(scenario.draftAssumptions);

    expect(blocked.intakeReadiness.state).toBe('intake_blocked');
    expect(blocked.planQuality.state).toBe('policy_blocked');
    expect(blocked.posTrust.state).toBe('withheld');
    expect(blocked.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_ADMISSION');
    expect(blocked.scopeClassification.blockedByUnconfirmedContext).toContain(scenario.blockedAssumptions[0]);
  });

  it('keeps schedulable internal work provisional when proof evidence is missing', () => {
    const policy = buildPolicy({
      goalId: `${scenario.label}-schedulable`,
      goalText: scenario.goalText,
      intake: makeIntake(`${scenario.label}-schedulable`, scenario.goalText, 'custom', 'fully_admitted', {
        startingState: scenario.startingState,
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
      }),
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
      intake: makeIntake(`${scenario.label}-scope`, scenario.goalText, 'custom', 'fully_admitted', {
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

    expect(policy.scopeClassification.required).toEqual(scenario.required);
    expect(policy.scopeClassification.recommended).toEqual(scenario.recommended);
    expect(policy.scopeClassification.optional).toEqual(scenario.optional);
    expect(policy.macroBoundaryPolicy.bounded).toEqual([...scenario.recommended, ...scenario.optional]);
  });
});
