import { describe, expect, it } from 'vitest';
import { callClaudeForActionGraph } from '../../state/mockLLMActionGraph';
import { compileGoalToDeliverables } from '../../state/engine/goalToDeliverables';
import { getLaneContextSpec, selectContextQuestionsForLane } from '../../state/contracts/contextAdmissionMatrix1_0';
import { buildGoalPolicySnapshot } from './GoalPolicy';
import type { CompletionBoundary, GoalIntakeContract, IntakeQuestion } from './GoalIntakeContract';
import { buildValidGoalContract } from './testHelpers';
import { attemptGoalAdmissionPure } from '../../state/identityStore.js';

type LaunchFamilyScenario = {
  archetype: 'VentureLaunch' | 'BrandLaunch';
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
    domain: 'launch-identity',
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
    commitmentVerb: 'launch',
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

function makePolicy({
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
}) {
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

const LANES: LaunchFamilyScenario[] = [
  {
    archetype: 'VentureLaunch',
    subtype: 'Service Business Launch',
    goalText:
      'Launch a project management consulting service in 30 days with offer, pricing, onboarding materials, and first 15 prospect outreaches completed.',
    admittedBoundary: 'launched',
    startingState: 'offer defined',
    required: ['offer', 'pricing', 'delivery process', 'outreach', 'close'],
    recommended: ['landing page', 'post-launch review'],
    optional: ['secondary channel'],
    blockedPrompt: 'Is the service offer already clearly defined or still being designed?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
  },
  {
    archetype: 'BrandLaunch',
    subtype: 'Business Brand Launch',
    goalText:
      'Launch a consulting business brand in 45 days with strategy, messaging, visual identity, website basics, and launch collateral completed.',
    admittedBoundary: 'launched',
    startingState: 'identity defined',
    required: ['positioning', 'messaging', 'identity system', 'brand kit'],
    recommended: ['profile rollout', 'launch announcement'],
    optional: ['campaign extras'],
    blockedPrompt: 'Is the business offer already defined, or is branding happening before the offer is ready?',
    blockedReason: 'INTAKE_ARTIFACT_UNCLEAR',
  },
];

describe.each(LANES)('$archetype / $subtype policy parity', (scenario) => {
  it('asks the family-specific boundary questions up front', () => {
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
    expect(selection.requiredQuestionsToAsk.some((question) => question.text.toLowerCase().includes('launch'))).toBe(
      true
    );
    expect(selection.assumptionsApplied.length).toBeGreaterThan(0);
  });

  it('keeps fully admitted, draft, and blocked outcomes distinct', () => {
    const admitted = makePolicy({
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

    const draft = makePolicy({
      goalId: `${scenario.archetype}-draft`,
      goalText: scenario.goalText,
      intake: makeIntake(
        `${scenario.archetype}-draft`,
        scenario.goalText,
        scenario.admittedBoundary,
        'assumption_marked_draft',
        {
          assumptions: ['starting state', 'launch boundary'],
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

    const blocked = makePolicy({
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

    expect(admitted.intakeReadiness.state).toBe('fully_admitted');
    expect(admitted.planQuality.state).toBe('policy_clean');
    expect(admitted.posTrust.state).toBe('trusted');
    expect(admitted.macroBoundaryPolicy.required).toEqual(scenario.required);
    expect(admitted.scopeClassification.recommended).toEqual(scenario.recommended);
    expect(admitted.scopeClassification.optional).toEqual(scenario.optional);

    expect(draft.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(draft.planQuality.state).toBe('policy_degraded');
    expect(draft.planQuality.reasonCodes).toContain('PLAN_STARTING_STATE_ASSUMED');
    expect(draft.posTrust.state).toBe('provisional');
    expect(draft.scopeClassification.assumedBaselineSupporting).toContain('starting state');

    expect(blocked.intakeReadiness.state).toBe('intake_blocked');
    expect(blocked.planQuality.state).toBe('policy_blocked');
    expect(blocked.posTrust.state).toBe('withheld');
    expect(blocked.scopeClassification.blockedByUnconfirmedContext).toContain('offer');
  });
});

describe('Launch / Identity execution graph bootstrap', () => {
  it('seeds VentureLaunch and BrandLaunch goals with family-shaped deliverables in admission', () => {
    const ventureContract = buildValidGoalContract({
      goalId: 'launch-venture',
      cycleId: 'cycle-launch-venture',
      executionType: 'VentureLaunch',
      terminalOutcome: {
        text: 'Launch a project management consulting service in 30 days with offer, pricing, onboarding materials, and first 15 prospect outreaches completed.',
        hash: 'launch-venture-outcome',
        verificationCriteria: 'Offer defined and first clients acquired',
        isConcrete: true,
      },
      deadline: { dayKey: '2026-02-20', isHardDeadline: true },
    });

    const brandContract = buildValidGoalContract({
      goalId: 'launch-brand',
      cycleId: 'cycle-launch-brand',
      executionType: 'BrandLaunch',
      terminalOutcome: {
        text: 'Launch a consulting business brand in 45 days with strategy, messaging, visual identity, website basics, and launch collateral completed.',
        hash: 'launch-brand-outcome',
        verificationCriteria: 'Identity is defined and first rollout is complete',
        isConcrete: true,
      },
      deadline: { dayKey: '2026-02-20', isHardDeadline: true },
    });

    const ventureOutcome = attemptGoalAdmissionPure(
      {
        appTime: { nowISO: '2026-01-10T12:00:00.000Z', timeZone: 'UTC', activeDayKey: '2026-01-10' },
        timeIsPinned: true,
        cyclesById: {},
        activeCycleId: null,
        cycleOrder: [],
        aspirations: [],
        aspirationsByCycleId: [],
      },
      ventureContract
    );
    const brandOutcome = attemptGoalAdmissionPure(
      {
        appTime: { nowISO: '2026-01-10T12:00:00.000Z', timeZone: 'UTC', activeDayKey: '2026-01-10' },
        timeIsPinned: true,
        cyclesById: {},
        activeCycleId: null,
        cycleOrder: [],
        aspirations: [],
        aspirationsByCycleId: [],
      },
      brandContract
    );

    expect(ventureOutcome.result.status).toBe('ADMITTED');
    expect(brandOutcome.result.status).toBe('ADMITTED');

    const ventureDeliverables =
      ventureOutcome.nextState.deliverablesByCycleId?.[ventureOutcome.result.cycleId]?.deliverables || [];
    const brandDeliverables =
      brandOutcome.nextState.deliverablesByCycleId?.[brandOutcome.result.cycleId]?.deliverables || [];

    expect(ventureDeliverables.map((entry: any) => String(entry?.title || '').toLowerCase())).toEqual(
      expect.arrayContaining([
        expect.stringContaining('offer'),
        expect.stringContaining('pricing'),
        expect.stringContaining('onboarding workflow'),
        expect.stringContaining('outreach'),
        expect.stringContaining('close'),
      ])
    );
    expect(brandDeliverables.map((entry: any) => String(entry?.title || '').toLowerCase())).toEqual(
      expect.arrayContaining([
        expect.stringContaining('positioning'),
        expect.stringContaining('messaging'),
        expect.stringContaining('identity'),
        expect.stringContaining('brand kit'),
      ])
    );
  });

  it('keeps BrandLaunch action graphs concrete and deliverable-linked', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText:
          'Launch a consulting business brand in 45 days with strategy, messaging, visual identity, website basics, and launch collateral completed.',
        goalLabel: 'Business brand launch',
      },
      {
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: 'Launch a consulting business brand in 45 days with strategy, messaging, visual identity, website basics, and launch collateral completed.',
          verificationCriteria: 'Identity is defined and first rollout is complete',
          isConcrete: true,
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const graphTitles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());
    expect(graphTitles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('brand positioning'),
        expect.stringContaining('messaging architecture'),
        expect.stringContaining('visual identity'),
        expect.stringContaining('launch announcement'),
      ])
    );
    expect(graphTitles.some((title) => title.includes('content batch'))).toBe(false);
    expect(graphTitles.some((title) => title.includes('engagement followup'))).toBe(false);

    const compiled = compileGoalToDeliverables({
      executionType: 'BrandLaunch',
      actions: result.graph.actions,
      contract: {
        goalText:
          'Launch a consulting business brand in 45 days with strategy, messaging, visual identity, website basics, and launch collateral completed.',
      },
      cycleId: 'cycle-brand-launch',
    });

    expect(compiled.usesCanonicalDeliverablePath).toBe(true);
    expect(compiled.deliverables.map((entry) => entry.title.toLowerCase())).toEqual(
      expect.arrayContaining([
        expect.stringContaining('brand positioning'),
        expect.stringContaining('messaging architecture'),
        expect.stringContaining('visual identity direction'),
      ])
    );
    expect(compiled.actionSeeds.every((seed) => seed.deliverableId.length > 0)).toBe(true);
  });

  it('seeds VentureLaunch service goals with offer-pricing-onboarding-outreach-close graph grammar', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'VentureLaunch',
        goalText:
          'Launch a project management consulting service in 30 days with offer, pricing, onboarding materials, and first 15 prospect outreaches completed.',
        goalLabel: 'Service business launch',
      },
      {
        executionType: 'VentureLaunch',
        terminalOutcome: {
          text: 'Launch a project management consulting service in 30 days with offer, pricing, onboarding materials, and first 15 prospect outreaches completed.',
          verificationCriteria: 'Offer defined and first clients acquired',
          isConcrete: true,
        },
      },
      'VentureLaunch',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const graphTitles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());
    expect(graphTitles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('offer'),
        expect.stringContaining('pricing'),
        expect.stringContaining('onboarding'),
        expect.stringContaining('outreach'),
        expect.stringContaining('close'),
      ])
    );
    expect(graphTitles.some((title) => title.includes('brand'))).toBe(false);
    expect(graphTitles.some((title) => title.includes('launch prep'))).toBe(false);
  });
});
