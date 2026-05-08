import { describe, expect, it } from 'vitest';
import { buildGoalIntakeContract } from './GoalIntakeContract';
import { buildGoalPolicySnapshot } from './GoalPolicy';
import type { CompletionBoundary, GoalIntakeContract, IntakeQuestion } from './GoalIntakeContract';
import { gumBrandFounderIntake } from '../../../tests/fixtures/gumBrandFounderIntake';

function buildExecutionContract(
  goalId: string,
  text: string,
  options: {
    startDayKey?: string;
    endDayKey?: string;
    workWindows?: Record<string, Array<{ start: string; end: string }>>;
  } = {}
) {
  const defaultWorkWindows = {
    mon: [{ start: '09:00', end: '11:00' }],
    tue: [{ start: '09:00', end: '11:00' }],
    wed: [{ start: '09:00', end: '11:00' }],
    thu: [{ start: '09:00', end: '11:00' }],
    fri: [{ start: '09:00', end: '11:00' }],
    sat: [],
    sun: [],
  };
  return {
    goalId,
    startDayKey: options.startDayKey || '2026-05-01',
    endDayKey: options.endDayKey || '2026-06-30',
    deadline: { dayKey: options.endDayKey || '2026-06-30' },
    workWindows: options.workWindows || defaultWorkWindows,
    terminalOutcome: {
      text,
      hash: 'hash',
      verificationCriteria: `${text} verified`,
      isConcrete: true,
    },
  } as any;
}

describe('GoalPolicy snapshot', () => {
  it('withholds trust when podcast boundary remains ambiguous', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-1',
      rawGoalText: 'Create 6 episodes to publish by deadline',
      verificationCriteria: '6 episodes produced',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-1',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-1', 'Create 6 episodes to publish by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'insufficient_evidence',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: false,
      hasProposedBlocks: false,
      hasExecutionGraph: false,
    });

    expect(policy.intakeReadiness.state).toBe('intake_blocked');
    expect(policy.planQuality.state).toBe('policy_blocked');
    expect(policy.posTrust.state).toBe('withheld');
    expect(policy.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_ADMISSION');
  });

  it('marks admitted podcast goals with unresolved starting state as draft quality', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-2',
      rawGoalText: 'Publish 6 episodes by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-2',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-2', 'Publish 6 episodes by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(intake.readiness.state).toBe('assumption_marked_draft');
    expect(policy.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(policy.planQuality.state).toBe('policy_degraded');
    expect(policy.planQuality.reasonCodes).toContain('PLAN_STARTING_STATE_ASSUMED');
    expect(policy.posTrust.state).toBe('provisional');
  });

  it('marks explicit starting state as policy clean and trusted', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-3',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-3',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-3', 'Publish 6 episodes from scratch by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(intake.readiness.state).toBe('fully_admitted');
    expect(policy.intakeReadiness.state).toBe('fully_admitted');
    expect(policy.planQuality.state).toBe('policy_clean');
    expect(policy.posTrust.state).toBe('trusted');
  });

  it('marks structural plan quality trusted when action typing, lineage, readiness, and inspectability are complete', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-typed',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-typed',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-typed', 'Publish 6 episodes from scratch by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [] },
        { id: 'a2', actionType: 'execution', dependencies: ['a1'] },
      ],
    });

    expect(policy.planQuality.structuralState).toBe('trusted');
    expect(policy.planQuality.actionTypeCoverage).toBe('complete');
    expect(policy.planQuality.dependencyReadinessCoverage).toBe('sufficient');
    expect(policy.planQuality.lineageIntegrity).toBe('complete');
    expect(policy.planQuality.inspectability).toBe('strong');
  });

  it('degrades structural quality when action type coverage is broadly missing', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-unknown-types',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-unknown-types',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-unknown-types', 'Publish 6 episodes from scratch by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', dependencies: [] },
        { id: 'a2', dependencies: ['a1'] },
      ],
    });

    expect(policy.planQuality.structuralState).toBe('degraded');
    expect(policy.planQuality.actionTypeCoverage).toBe('missing');
    expect(policy.planQuality.structuralReasonCodes).toContain('PLAN_ACTION_TYPE_COVERAGE_WEAK');
  });

  it('degrades structural quality when assumption burden remains high', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-high-assumptions',
      rawGoalText: 'Publish 6 episodes by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-high-assumptions',
      intakeContract: {
        ...intake,
        readiness: {
          ...intake.readiness,
          state: 'assumption_marked_draft',
          assumptionReasons: ['STARTING_STATE_ASSUMED', 'AUDIENCE_ASSUMED', 'WORKFLOW_ASSUMED'],
        },
        scopePolicy: {
          ...intake.scopePolicy,
          assumptionsNeedingConfirmation: ['STARTING_STATE_ASSUMED', 'AUDIENCE_ASSUMED', 'WORKFLOW_ASSUMED'],
        },
      },
      executionContract: buildExecutionContract('goal-high-assumptions', 'Publish 6 episodes by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [] },
        { id: 'a2', actionType: 'execution', dependencies: ['a1'] },
      ],
    });

    expect(policy.planQuality.structuralState).toBe('degraded');
    expect(policy.planQuality.assumptionBurden).toBe('high');
    expect(policy.planQuality.structuralReasonCodes).toContain('PLAN_ASSUMPTION_BURDEN_HIGH');
  });

  it('withholds structural quality when canonical lineage is too thin to inspect honestly', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-thin-lineage',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-thin-lineage',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-thin-lineage', 'Publish 6 episodes from scratch by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: false,
      hasProposedBlocks: false,
      hasExecutionGraph: true,
      canonicalDeliverables: [],
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
    });

    expect(policy.planQuality.structuralState).toBe('withheld');
    expect(policy.planQuality.lineageIntegrity).toBe('missing');
    expect(policy.planQuality.structuralReasonCodes).toContain('PLAN_STRUCTURAL_TRUTH_WITHHELD');
  });

  it('degrades structural quality when canonical dependency references are incoherent', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-bad-deps',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-bad-deps',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-bad-deps', 'Publish 6 episodes from scratch by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [] },
        { id: 'a2', actionType: 'execution', dependencies: ['missing-action'] },
      ],
    });

    expect(policy.planQuality.structuralState).toBe('degraded');
    expect(policy.planQuality.structuralReasonCodes).toContain('PLAN_DEPENDENCY_INCOHERENT');
  });

  it('marks structural quality provisional when action typing is complete but readiness metadata remains thin', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-thin-readiness',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-thin-readiness',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-thin-readiness', 'Publish 6 episodes from scratch by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation' },
        { id: 'a2', actionType: 'execution' },
      ],
    });

    expect(policy.planQuality.structuralState).toBe('provisional');
    expect(policy.planQuality.structuralReasonCodes).toContain('PLAN_READINESS_METADATA_THIN');
  });

  it('evaluates feasibility as feasible when structural, temporal, schedule, and capacity support are strong', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-feasible',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-feasible',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-feasible', 'Publish 6 episodes from scratch by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [], readinessConditions: ['Scope approved'] },
        { id: 'a2', actionType: 'execution', dependencies: ['a1'], readinessConditions: ['Recording setup ready'] },
      ],
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      longTermPlan: {
        isLongHorizon: true,
        quality: { state: 'trusted', reasonCodes: [] },
        saturation: { saturationShape: 'balanced' },
        uncertainty: { bands: [{ certainty: 'firm' }, { certainty: 'provisional' }] },
        checkpoints: [{ checkpointId: 'cp-1' }],
      },
    });

    expect(policy.feasibility.state).toBe('feasible');
    expect(policy.feasibility.reasonCodes).toEqual([]);
  });

  it('evaluates feasibility as constrained when schedule strain is real but still inspectable', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-constrained',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-constrained',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-constrained', 'Publish 6 episodes from scratch by deadline', {
        workWindows: {
          mon: [{ start: '09:00', end: '10:00' }],
          tue: [{ start: '09:00', end: '10:00' }],
          wed: [],
          thu: [],
          fri: [],
          sat: [],
          sun: [],
        },
      }),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [], readinessConditions: ['Outline done'] },
        { id: 'a2', actionType: 'execution', dependencies: ['a1'], readinessConditions: ['Studio booked'] },
      ],
      preExecutionSchedule: { blockCount: 8, totalMinutes: 900 },
      longTermPlan: {
        isLongHorizon: false,
        quality: { state: 'not_applicable', reasonCodes: [] },
      },
    });

    expect(['constrained', 'degraded']).toContain(policy.feasibility.state);
    expect(policy.feasibility.reasonCodes).toContain('FEASIBILITY_SCHEDULE_STRAINED');
  });

  it('evaluates feasibility as degraded when structural or temporal support is materially weak', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-degraded',
      rawGoalText: 'Publish 6 episodes by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-degraded',
      intakeContract: {
        ...intake,
        readiness: {
          ...intake.readiness,
          state: 'assumption_marked_draft',
          assumptionReasons: ['STARTING_STATE_ASSUMED', 'AUDIENCE_ASSUMED', 'WORKFLOW_ASSUMED'],
        },
        scopePolicy: {
          ...intake.scopePolicy,
          assumptionsNeedingConfirmation: ['STARTING_STATE_ASSUMED', 'AUDIENCE_ASSUMED', 'WORKFLOW_ASSUMED'],
        },
      },
      executionContract: buildExecutionContract('goal-degraded', 'Publish 6 episodes by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [] },
        { id: 'a2', actionType: 'execution', dependencies: ['a1'] },
      ],
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      longTermPlan: {
        isLongHorizon: true,
        quality: { state: 'degraded', reasonCodes: ['LONG_HORIZON_PACING_WEAK'] },
        saturation: { saturationShape: 'overloaded' },
        uncertainty: { bands: [{ certainty: 'firm' }, { certainty: 'provisional' }, { certainty: 'provisional' }] },
        checkpoints: [{ checkpointId: 'cp-1' }],
      },
    });

    expect(policy.feasibility.state).toBe('degraded');
    expect(policy.feasibility.reasonCodes).toContain('FEASIBILITY_ASSUMPTION_BURDEN_HIGH');
    expect(policy.feasibility.reasonCodes).toContain('FEASIBILITY_TEMPORAL_QUALITY_WEAK');
    expect(policy.feasibility.reasonCodes).toContain('FEASIBILITY_LONG_HORIZON_OVERLOADED');
  });

  it('evaluates feasibility as withheld when canonical pre-execution truth is too thin', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-withheld',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-withheld',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-withheld', 'Publish 6 episodes from scratch by deadline', {
        workWindows: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
      }),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: false,
      hasProposedBlocks: false,
      hasExecutionGraph: true,
      canonicalDeliverables: [],
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
      preExecutionSchedule: { blockCount: 0, totalMinutes: 0 },
      longTermPlan: {
        isLongHorizon: true,
        quality: { state: 'withheld', reasonCodes: ['LONG_HORIZON_TEMPORAL_TRUTH_THIN'] },
        saturation: { saturationShape: 'insufficient_data' },
        uncertainty: { bands: [] },
        checkpoints: [],
      },
    });

    expect(policy.feasibility.state).toBe('withheld');
    expect(policy.feasibility.reasonCodes).toContain('FEASIBILITY_CANONICAL_TRUTH_THIN');
    expect(policy.feasibility.reasonCodes).toContain('FEASIBILITY_SCHEDULE_TRUTH_MISSING');
    expect(policy.feasibility.reasonCodes).toContain('FEASIBILITY_CAPACITY_SUPPORT_MISSING');
  });

  it('keeps zero-capital plans scorable when endpoint, timeline, lane, and plan substrate exist', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-zero-capital',
      rawGoalText: 'Launch a consulting offer to first paid client by deadline',
      verificationCriteria: 'First paid client closes',
      executionType: 'VentureLaunch',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-zero-capital',
      intakeContract: {
        ...intake,
        answeredContext: {
          capitalAvailable: 0,
          capitalAcquisitionRequired: true,
        },
      } as any,
      executionContract: buildExecutionContract('goal-zero-capital', 'Launch a consulting offer to first paid client by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [], readinessConditions: ['Offer scoped'] },
        { id: 'a2', actionType: 'execution', dependencies: ['a1'], readinessConditions: ['Outreach list ready'] },
      ],
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
    });

    expect(['constrained', 'degraded']).toContain(policy.feasibility.state);
    expect(policy.feasibility.score).not.toBeNull();
    expect(policy.feasibility.percent).not.toBeNull();
    expect(policy.feasibility.range).not.toBeNull();
    expect(policy.feasibility.assumptions).toContain('a capital bridge');
  });

  it('keeps externally mediated outcomes scorable when the substrate is valid', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-external-outcome',
      rawGoalText: 'Secure one signed enterprise client by deadline',
      verificationCriteria: 'Signed contract received',
      executionType: 'SalesPipeline',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-external-outcome',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-external-outcome', 'Secure one signed enterprise client by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      outcomeAuthorityClass: 'externally_mediated',
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [], readinessConditions: ['Offer defined'] },
        { id: 'a2', actionType: 'execution', dependencies: ['a1'], readinessConditions: ['Prospect list ready'] },
      ],
      preExecutionSchedule: { blockCount: 5, totalMinutes: 300 },
    });

    expect(['constrained', 'degraded']).toContain(policy.feasibility.state);
    expect(policy.feasibility.score).not.toBeNull();
    expect(policy.feasibility.percent).not.toBeNull();
    expect(policy.feasibility.assumptions).toContain('a third-party decision');
  });

  it('withholds initial feasibility when the endpoint remains unresolved', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-endpoint-missing',
      rawGoalText: 'Get traction by deadline',
      verificationCriteria: '',
      executionType: 'VentureLaunch',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-endpoint-missing',
      intakeContract: {
        ...intake,
        completionBoundaryStatus: 'missing',
      } as any,
      executionContract: {
        ...buildExecutionContract('goal-endpoint-missing', 'Get traction by deadline'),
        terminalOutcome: {
          text: 'Get traction by deadline',
          verificationCriteria: '',
          isConcrete: false,
        },
      } as any,
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
      preExecutionSchedule: { blockCount: 2, totalMinutes: 120 },
    });

    expect(policy.feasibility.state).toBe('withheld');
    expect(policy.feasibility.score).toBeNull();
    expect(policy.feasibility.percent).toBeNull();
  });

  it('withholds initial feasibility when the timeline substrate is missing', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-timeline-missing',
      rawGoalText: 'Publish 6 episodes from scratch',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-timeline-missing',
      intakeContract: intake,
      executionContract: {
        ...buildExecutionContract('goal-timeline-missing', 'Publish 6 episodes from scratch'),
        startDayKey: '',
        endDayKey: '',
        deadline: { dayKey: '' },
      } as any,
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
      preExecutionSchedule: { blockCount: 2, totalMinutes: 120 },
    });

    expect(policy.feasibility.state).toBe('withheld');
    expect(policy.feasibility.score).toBeNull();
    expect(policy.feasibility.percent).toBeNull();
  });

  it('withholds initial feasibility with an explicit lane-classification reason when the governing lane is unknown', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-lane-unknown',
      rawGoalText: 'Launch something meaningful by deadline',
      verificationCriteria: 'Outcome is verified',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-lane-unknown',
      intakeContract: {
        ...intake,
        domain: 'unknown',
      } as any,
      executionContract: buildExecutionContract('goal-lane-unknown', 'Launch something meaningful by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
      preExecutionSchedule: { blockCount: 2, totalMinutes: 120 },
    });

    expect(policy.feasibility.state).toBe('withheld');
    expect(policy.feasibility.reasonCodes).toContain('FEASIBILITY_LANE_CLASSIFICATION_MISSING');
    expect(policy.feasibility.score).toBeNull();
    expect(policy.feasibility.percent).toBeNull();
  });

  it('does not emit lane-classification-missing for difficult but classified goals', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-lane-classified-hard',
      rawGoalText: 'Secure one signed enterprise client by deadline',
      verificationCriteria: 'Signed contract received',
      executionType: 'SalesPipeline',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-lane-classified-hard',
      intakeContract: {
        ...intake,
        answeredContext: {
          capitalAvailable: 0,
          capitalAcquisitionRequired: true,
        },
      } as any,
      executionContract: buildExecutionContract('goal-lane-classified-hard', 'Secure one signed enterprise client by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      outcomeAuthorityClass: 'externally_mediated',
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [], readinessConditions: ['Offer defined'] },
        { id: 'a2', actionType: 'execution', dependencies: ['a1'], readinessConditions: ['Prospect list ready'] },
      ],
      preExecutionSchedule: { blockCount: 5, totalMinutes: 300 },
    });

    expect(policy.feasibility.state).not.toBe('withheld');
    expect(policy.feasibility.reasonCodes).not.toContain('FEASIBILITY_LANE_CLASSIFICATION_MISSING');
    expect(policy.feasibility.score).not.toBeNull();
    expect(policy.feasibility.percent).not.toBeNull();
  });

  it('always exposes a percentage when feasibility is not withheld', () => {
    const states = [
      buildGoalPolicySnapshot({
        goalId: 'goal-scored-feasible',
        intakeContract: buildGoalIntakeContract({
          goalId: 'goal-scored-feasible',
          rawGoalText: 'Publish 6 episodes from scratch by deadline',
          verificationCriteria: '6 episodes are live',
          executionType: 'CreativeProduction',
          deadline: '2026-06-30',
        }),
        executionContract: buildExecutionContract('goal-scored-feasible', 'Publish 6 episodes from scratch by deadline'),
        planProof: { feasibilityStatus: 'FEASIBLE' },
        probabilityStatus: 'computed',
        hasCommittedBlocks: true,
        hasProposedBlocks: true,
        hasExecutionGraph: true,
        canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
        canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
        preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      }),
      buildGoalPolicySnapshot({
        goalId: 'goal-scored-constrained',
        intakeContract: buildGoalIntakeContract({
          goalId: 'goal-scored-constrained',
          rawGoalText: 'Secure one signed enterprise client by deadline',
          verificationCriteria: 'Signed contract received',
          executionType: 'SalesPipeline',
          deadline: '2026-06-30',
        }),
        executionContract: buildExecutionContract('goal-scored-constrained', 'Secure one signed enterprise client by deadline'),
        planProof: { feasibilityStatus: 'FEASIBLE' },
        probabilityStatus: 'computed',
        hasCommittedBlocks: true,
        hasProposedBlocks: true,
        hasExecutionGraph: true,
        outcomeAuthorityClass: 'externally_mediated',
        canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
        canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
        preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      }),
      buildGoalPolicySnapshot({
        goalId: 'goal-scored-degraded',
        intakeContract: {
          ...buildGoalIntakeContract({
            goalId: 'goal-scored-degraded',
            rawGoalText: 'Publish 6 episodes by deadline',
            verificationCriteria: '6 episodes are live',
            executionType: 'CreativeProduction',
            deadline: '2026-06-30',
          }),
          readiness: {
            state: 'assumption_marked_draft',
            isReadyForPlanning: true,
            blockingReasons: [],
            assumptionReasons: ['STARTING_STATE_ASSUMED', 'AUDIENCE_ASSUMED', 'WORKFLOW_ASSUMED'],
          },
          scopePolicy: {
            required: [],
            recommended: [],
            optional: [],
            excluded: [],
            assumptionsNeedingConfirmation: ['STARTING_STATE_ASSUMED', 'AUDIENCE_ASSUMED', 'WORKFLOW_ASSUMED'],
          },
        } as any,
        executionContract: buildExecutionContract('goal-scored-degraded', 'Publish 6 episodes by deadline'),
        planProof: { feasibilityStatus: 'FEASIBLE' },
        probabilityStatus: 'computed',
        hasCommittedBlocks: true,
        hasProposedBlocks: true,
        hasExecutionGraph: true,
        canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
        canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
        preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      }),
    ];

    states.forEach((policy) => {
      expect(policy.feasibility.state).not.toBe('withheld');
      expect(policy.feasibility.score).not.toBeNull();
      expect(policy.feasibility.percent).not.toBeNull();
      expect(policy.feasibility.range).not.toBeNull();
    });
  });

  it('scores the gum first-sales lane as constrained or degraded instead of withheld when plan substrate exists', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-score',
      rawGoalText: 'Launch a caffeinated functional energy gum brand',
      verificationCriteria: 'Sellable gum offer, compliant label, merchant approval, production readiness, and first-sales evidence are complete.',
      executionType: 'BrandLaunch',
      deadline: '2027-07-31',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-score',
      intakeContract: {
        ...intake,
        answeredContext: gumBrandFounderIntake,
      } as any,
      executionContract: buildExecutionContract('goal-gum-score', 'Launch a caffeinated functional energy gum brand', {
        startDayKey: '2026-04-24',
        endDayKey: '2027-07-31',
      }),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      outcomeAuthorityClass: 'market_dependent',
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [], readinessConditions: ['Formula direction chosen'] },
        { id: 'a2', actionType: 'execution', dependencies: ['a1'], readinessConditions: ['Merchant path defined'] },
      ],
      preExecutionSchedule: { blockCount: 18, totalMinutes: 2160 },
      longTermPlan: {
        isLongHorizon: true,
        quality: { state: 'provisional', reasonCodes: [] },
        saturation: { saturationShape: 'understructured' },
        uncertainty: { bands: [{ certainty: 'provisional' }, { certainty: 'provisional' }] },
        checkpoints: [{ checkpointId: 'cp-1' }],
      },
    });

    expect(['constrained', 'degraded']).toContain(policy.feasibility.state);
    expect(policy.feasibility.state).not.toBe('withheld');
    expect(policy.feasibility.percent).not.toBeNull();
    expect(policy.feasibility.range).not.toBeNull();
    expect(Number(policy.feasibility.percent)).toBeLessThanOrEqual(45);
    expect(policy.feasibility.assumptions).toEqual(
      expect.arrayContaining(['a capital bridge', 'regulated sourcing and compliance-safe claims', 'first-sales conversion'])
    );
  });

  it('keeps post-cadence gum review-state substrate scorable when the quality gate passes', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-post-cadence',
      rawGoalText:
        'Launch a caffeinated energy gum brand to first real sales in 15 months with product concept validation, branding, packaging, sourcing, checkout setup, launch execution, and first sales proof completed.',
      verificationCriteria: 'Complete the admitted goal as defined in the intake review',
      executionType: 'BrandLaunch',
      deadline: '2027-07-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-post-cadence',
      intakeContract: {
        ...intake,
        completionBoundaryStatus: 'missing',
        answeredContext: gumBrandFounderIntake,
      } as any,
      executionContract: {
        ...buildExecutionContract(
          'goal-gum-post-cadence',
          'Launch a caffeinated energy gum brand to first real sales in 15 months with product concept validation, branding, packaging, sourcing, checkout setup, launch execution, and first sales proof completed.',
          {
            startDayKey: '2026-04-21',
            endDayKey: '2027-07-30',
          }
        ),
        terminalOutcome: {
          text: 'Launch a caffeinated energy gum brand to first real sales in 15 months with product concept validation, branding, packaging, sourcing, checkout setup, launch execution, and first sales proof completed.',
          verificationCriteria: 'Complete the admitted goal as defined in the intake review',
        },
      } as any,
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: false,
      hasProposedBlocks: false,
      hasExecutionGraph: true,
      outcomeAuthorityClass: 'market_dependent',
      planQualityFailureCodes: [],
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [], readinessConditions: ['Formula direction chosen'] },
        { id: 'a2', actionType: 'execution', dependencies: ['a1'], readinessConditions: ['Merchant path defined'] },
      ],
      preExecutionSchedule: { blockCount: 253, totalMinutes: 15180 },
      longTermPlan: {
        isLongHorizon: true,
        quality: { state: 'trusted', reasonCodes: [] },
        saturation: { saturationShape: 'balanced' },
        uncertainty: { bands: [{ certainty: 'provisional' }, { certainty: 'provisional' }] },
        checkpoints: [{ checkpointId: 'cp-1' }],
      },
    });

    expect(policy.feasibility.state).not.toBe('withheld');
    expect(policy.feasibility.reasonCodes).not.toContain('FEASIBILITY_CANONICAL_TRUTH_THIN');
    expect(policy.feasibility.reasonCodes).toContain('FEASIBILITY_STRUCTURAL_QUALITY_WEAK');
    expect(policy.feasibility.score).not.toBeNull();
    expect(policy.feasibility.percent).not.toBeNull();
    expect(policy.feasibility.range).not.toBeNull();
  });

  it('returns a hard point estimate alongside range for a constrained gum-like first-sales scenario', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-gum-range-score',
      rawGoalText: 'Launch a caffeinated functional energy gum brand',
      verificationCriteria:
        'Sellable gum offer, compliant label, merchant approval, production readiness, and first-sales evidence are complete.',
      executionType: 'BrandLaunch',
      deadline: '2027-07-31',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-gum-range-score',
      intakeContract: {
        ...intake,
        answeredContext: gumBrandFounderIntake,
      } as any,
      executionContract: buildExecutionContract('goal-gum-range-score', 'Launch a caffeinated functional energy gum brand', {
        startDayKey: '2026-04-24',
        endDayKey: '2027-07-31',
      }),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      outcomeAuthorityClass: 'market_dependent',
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [], readinessConditions: ['Formula direction chosen'] },
        { id: 'a2', actionType: 'execution', dependencies: ['a1'], readinessConditions: ['Merchant path defined'] },
      ],
      preExecutionSchedule: { blockCount: 18, totalMinutes: 2160 },
      longTermPlan: {
        isLongHorizon: true,
        quality: { state: 'provisional', reasonCodes: [] },
        saturation: { saturationShape: 'understructured' },
        uncertainty: { bands: [{ certainty: 'provisional' }, { certainty: 'provisional' }] },
        checkpoints: [{ checkpointId: 'cp-1' }],
      },
    });

    expect(policy.feasibility.state).not.toBe('withheld');
    expect(policy.feasibility.range).not.toBeNull();
    expect(policy.feasibility.score).not.toBeNull();
    expect(policy.feasibility.percent).not.toBeNull();
  });

  it('maintains the invariant that range implies point score and percent', () => {
    const cases = [
      buildGoalPolicySnapshot({
        goalId: 'goal-invariant-range-1',
        intakeContract: buildGoalIntakeContract({
          goalId: 'goal-invariant-range-1',
          rawGoalText: 'Publish 6 episodes from scratch by deadline',
          verificationCriteria: '6 episodes are live',
          executionType: 'CreativeProduction',
          deadline: '2026-06-30',
        }),
        executionContract: buildExecutionContract('goal-invariant-range-1', 'Publish 6 episodes from scratch by deadline'),
        planProof: { feasibilityStatus: 'FEASIBLE' },
        probabilityStatus: 'computed',
        hasCommittedBlocks: true,
        hasProposedBlocks: true,
        hasExecutionGraph: true,
        canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
        canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
        preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      }),
      buildGoalPolicySnapshot({
        goalId: 'goal-invariant-range-2',
        intakeContract: buildGoalIntakeContract({
          goalId: 'goal-invariant-range-2',
          rawGoalText: 'Secure one signed enterprise client by deadline',
          verificationCriteria: 'Signed contract received',
          executionType: 'SalesPipeline',
          deadline: '2026-06-30',
        }),
        executionContract: buildExecutionContract('goal-invariant-range-2', 'Secure one signed enterprise client by deadline'),
        planProof: { feasibilityStatus: 'FEASIBLE' },
        probabilityStatus: 'computed',
        hasCommittedBlocks: true,
        hasProposedBlocks: true,
        hasExecutionGraph: true,
        outcomeAuthorityClass: 'externally_mediated',
        canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
        canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
        preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
      }),
    ];

    cases.forEach((policy) => {
      if (policy.feasibility.range) {
        expect(policy.feasibility.score).not.toBeNull();
        expect(policy.feasibility.percent).not.toBeNull();
      }
    });
  });

  it('maintains the invariant that withheld feasibility has no score or range', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-invariant-withheld',
      intakeContract: buildGoalIntakeContract({
        goalId: 'goal-invariant-withheld',
        rawGoalText: 'Get traction by deadline',
        verificationCriteria: '',
        executionType: 'VentureLaunch',
        deadline: '2026-06-30',
      }),
      executionContract: {
        ...buildExecutionContract('goal-invariant-withheld', 'Get traction by deadline'),
        terminalOutcome: {
          text: 'Get traction by deadline',
          verificationCriteria: '',
          isConcrete: false,
        },
      } as any,
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
      preExecutionSchedule: { blockCount: 2, totalMinutes: 120 },
    });

    expect(policy.feasibility.state).toBe('withheld');
    expect(policy.feasibility.score).toBeNull();
    expect(policy.feasibility.percent).toBeNull();
    expect(policy.feasibility.range).toBeNull();
  });

  it('withholds live pos inputs when no canonical execution evidence exists yet', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-live-pos-withheld',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-live-pos-withheld',
      intakeContract: intake,
      executionContract: buildExecutionContract(
        'goal-live-pos-withheld',
        'Publish 6 episodes from scratch by deadline'
      ),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1', 'a2'], dependencyIds: [] }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', dependencies: [], readinessConditions: ['Scope approved'] },
        { id: 'a2', actionType: 'execution', dependencies: ['a1'], readinessConditions: ['Recording setup ready'] },
      ],
      canonicalExecutionEvents: [],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
    });

    expect(policy.livePos.state).toBe('withheld');
    expect(policy.livePos.reasonCodes).toContain('LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE');
    expect(policy.livePos.liveState).toBe('withheld');
    expect(policy.livePos.liveStateReasonCodes).toContain('LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE');
    expect(policy.livePos.score.state).toBe('withheld');
    expect(policy.livePos.score.value).toBeNull();
    expect(policy.livePos.score.reasonCodes).toContain('LIVE_POS_SCORE_WITHHELD');
  });

  it('withholds live pos inputs when evidence exists but remains unlinked', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-live-pos-unlinked',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-live-pos-unlinked',
      intakeContract: intake,
      executionContract: buildExecutionContract(
        'goal-live-pos-unlinked',
        'Publish 6 episodes from scratch by deadline'
      ),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
      canonicalExecutionEvents: [
        {
          id: 'evt-1',
          goalId: 'goal-live-pos-unlinked',
          cycleId: 'cycle-1',
          kind: 'complete',
          linkageStatus: 'UNLINKED_ACTIVITY',
        },
      ],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 1, totalMinutes: 60 },
    });

    expect(policy.livePos.state).toBe('withheld');
    expect(policy.livePos.reasonCodes).toContain('LIVE_POS_WITHHELD_UNLINKED_EVIDENCE_ONLY');
    expect(policy.livePos.reasonCodes).toContain('LIVE_POS_WITHHELD_LINEAGE_INSUFFICIENT');
    expect(policy.livePos.liveState).toBe('withheld');
  });

  it('enters activating when linked canonical execution evidence is present but still early', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-live-pos-eligible',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-live-pos-eligible',
      intakeContract: intake,
      executionContract: buildExecutionContract(
        'goal-live-pos-eligible',
        'Publish 6 episodes from scratch by deadline'
      ),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [], readinessConditions: ['Mic ready'] }],
      canonicalExecutionEvents: [
        {
          id: 'evt-1',
          goalId: 'goal-live-pos-eligible',
          cycleId: 'cycle-1',
          kind: 'complete',
          linkageStatus: 'LINKED',
          deliverableId: 'd1',
          actionId: 'a1',
        },
      ],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 1, totalMinutes: 60 },
    });

    expect(policy.livePos.state).toBe('provisional');
    expect(policy.livePos.reasonCodes).toEqual([]);
    expect(policy.livePos.linkedEvidenceCount).toBe(1);
    expect(policy.livePos.liveState).toBe('activating');
    expect(policy.livePos.liveStateReasonCodes).toContain('LIVE_POS_ACTIVATING_EVIDENCE_EARLY');
    expect(policy.livePos.score.state).toBe('available');
    expect(policy.livePos.score.value).toBeGreaterThanOrEqual(0.52);
    expect(policy.livePos.score.value).toBeLessThanOrEqual(0.6);
    expect(policy.livePos.score.capped).toBe(true);
    expect(policy.livePos.score.reasonCodes).toContain('LIVE_POS_SCORE_ACTIVATING_RANGE');
    expect(policy.livePos.score.reasonCodes).toContain('LIVE_POS_SCORE_CAPPED_EARLY_EVIDENCE');
  });

  it('enters stable when linked execution continuity spans multiple days without negative drift evidence', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-live-pos-stable',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-live-pos-stable',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-live-pos-stable', 'Publish 6 episodes from scratch by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [], readinessConditions: ['Mic ready'] }],
      canonicalExecutionEvents: [
        {
          id: 'evt-1',
          goalId: 'goal-live-pos-stable',
          cycleId: 'cycle-1',
          kind: 'complete',
          linkageStatus: 'LINKED',
          deliverableId: 'd1',
          actionId: 'a1',
          dateISO: '2026-05-02',
        },
        {
          id: 'evt-2',
          goalId: 'goal-live-pos-stable',
          cycleId: 'cycle-1',
          kind: 'complete',
          linkageStatus: 'LINKED',
          deliverableId: 'd1',
          actionId: 'a1',
          dateISO: '2026-05-04',
        },
      ],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
    });

    expect(policy.livePos.state).toBe('available');
    expect(policy.livePos.liveState).toBe('stable');
    expect(policy.livePos.liveStateReasonCodes).toContain('LIVE_POS_STABLE_LINKED_EXECUTION_CONTINUITY');
    expect(policy.livePos.score.state).toBe('available');
    expect(policy.livePos.score.value).toBeGreaterThanOrEqual(0.72);
    expect(policy.livePos.score.value).toBeLessThanOrEqual(0.86);
    expect(policy.livePos.score.capped).toBe(false);
    expect(policy.livePos.score.reasonCodes).toContain('LIVE_POS_SCORE_STABLE_CONTINUITY');
  });

  it('enters at_risk when linked miss or drift evidence accumulates before recovery', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-live-pos-risk',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-live-pos-risk',
      intakeContract: intake,
      executionContract: buildExecutionContract('goal-live-pos-risk', 'Publish 6 episodes from scratch by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [], readinessConditions: ['Mic ready'] }],
      canonicalExecutionEvents: [
        {
          id: 'evt-1',
          goalId: 'goal-live-pos-risk',
          cycleId: 'cycle-1',
          kind: 'complete',
          linkageStatus: 'LINKED',
          deliverableId: 'd1',
          actionId: 'a1',
          dateISO: '2026-05-02',
        },
        {
          id: 'evt-2',
          goalId: 'goal-live-pos-risk',
          cycleId: 'cycle-1',
          kind: 'missed',
          linkageStatus: 'LINKED',
          deliverableId: 'd1',
          actionId: 'a1',
          dateISO: '2026-05-03',
        },
      ],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
    });

    expect(policy.livePos.state).toBe('available');
    expect(policy.livePos.liveState).toBe('at_risk');
    expect(policy.livePos.liveStateReasonCodes).toContain('LIVE_POS_AT_RISK_MISSED_EXECUTION_BURDEN');
    expect(policy.livePos.score.state).toBe('available');
    expect(policy.livePos.score.value).toBeGreaterThanOrEqual(0.2);
    expect(policy.livePos.score.value).toBeLessThanOrEqual(0.55);
    expect(policy.livePos.score.reasonCodes).toContain('LIVE_POS_SCORE_AT_RISK_RANGE');
  });

  it('enters recovering when linked completions resume coherently after risk evidence', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-live-pos-recovering',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-live-pos-recovering',
      intakeContract: intake,
      executionContract: buildExecutionContract(
        'goal-live-pos-recovering',
        'Publish 6 episodes from scratch by deadline'
      ),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [], readinessConditions: ['Mic ready'] }],
      canonicalExecutionEvents: [
        {
          id: 'evt-1',
          goalId: 'goal-live-pos-recovering',
          cycleId: 'cycle-1',
          kind: 'complete',
          linkageStatus: 'LINKED',
          deliverableId: 'd1',
          actionId: 'a1',
          dateISO: '2026-05-02',
        },
        {
          id: 'evt-2',
          goalId: 'goal-live-pos-recovering',
          cycleId: 'cycle-1',
          kind: 'missed',
          linkageStatus: 'LINKED',
          deliverableId: 'd1',
          actionId: 'a1',
          dateISO: '2026-05-03',
        },
        {
          id: 'evt-3',
          goalId: 'goal-live-pos-recovering',
          cycleId: 'cycle-1',
          kind: 'complete',
          linkageStatus: 'LINKED',
          deliverableId: 'd1',
          actionId: 'a1',
          dateISO: '2026-05-05',
        },
        {
          id: 'evt-4',
          goalId: 'goal-live-pos-recovering',
          cycleId: 'cycle-1',
          kind: 'complete',
          linkageStatus: 'LINKED',
          deliverableId: 'd1',
          actionId: 'a1',
          dateISO: '2026-05-06',
        },
      ],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
    });

    expect(policy.livePos.state).toBe('available');
    expect(policy.livePos.liveState).toBe('recovering');
    expect(policy.livePos.liveStateReasonCodes).toContain('LIVE_POS_RECOVERING_AFTER_RISK');
    expect(policy.livePos.liveStateReasonCodes).toContain('LIVE_POS_RECOVERING_LINKED_RECOVERY_EVIDENCE');
    expect(policy.livePos.score.state).toBe('available');
    expect(policy.livePos.score.value).toBeGreaterThanOrEqual(0.46);
    expect(policy.livePos.score.value).toBeLessThanOrEqual(0.72);
    expect(policy.livePos.score.capped).toBe(true);
    expect(policy.livePos.score.reasonCodes).toContain('LIVE_POS_SCORE_RECOVERY_UPLIFT');
    expect(policy.livePos.score.reasonCodes).toContain('LIVE_POS_SCORE_CAPPED_RECOVERY_EARLY');
  });

  it('keeps live pos score independent from feasibility state when live evidence is unchanged', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-live-pos-separation',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: '6 episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
    });

    const baseInput = {
      goalId: 'goal-live-pos-separation',
      intakeContract: intake,
      executionContract: buildExecutionContract(
        'goal-live-pos-separation',
        'Publish 6 episodes from scratch by deadline'
      ),
      probabilityStatus: 'computed' as const,
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1', actionIds: ['a1'], dependencyIds: [] }],
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [], readinessConditions: ['Mic ready'] }],
      canonicalExecutionEvents: [
        {
          id: 'evt-1',
          goalId: 'goal-live-pos-separation',
          cycleId: 'cycle-1',
          kind: 'complete',
          linkageStatus: 'LINKED',
          deliverableId: 'd1',
          actionId: 'a1',
          dateISO: '2026-05-02',
        },
        {
          id: 'evt-2',
          goalId: 'goal-live-pos-separation',
          cycleId: 'cycle-1',
          kind: 'complete',
          linkageStatus: 'LINKED',
          deliverableId: 'd1',
          actionId: 'a1',
          dateISO: '2026-05-04',
        },
      ],
      liveScheduleApplied: true,
      preExecutionSchedule: { blockCount: 4, totalMinutes: 240 },
    };

    const strong = buildGoalPolicySnapshot({
      ...baseInput,
      planProof: { feasibilityStatus: 'FEASIBLE' },
    });
    const weak = buildGoalPolicySnapshot({
      ...baseInput,
      planProof: { feasibilityStatus: 'INFEASIBLE' },
      executionContract: buildExecutionContract(
        'goal-live-pos-separation',
        'Publish 6 episodes from scratch by deadline',
        {
          workWindows: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
        }
      ),
      preExecutionSchedule: { blockCount: 0, totalMinutes: 0 },
    });

    expect(strong.livePos.liveState).toBe('stable');
    expect(weak.livePos.liveState).toBe('stable');
    expect(strong.livePos.score.value).toBe(weak.livePos.score.value);
  });
});

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

function makeRevenueCapitalQuestion(reasonCode: string, prompt: string): IntakeQuestion {
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

function makeRevenueCapitalExecutionContract(goalId: string, goalText: string) {
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

function makeRevenueCapitalIntake(
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

const REVENUE_CAPITAL_LANES: RevenueCapitalScenario[] = [
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

describe.each(REVENUE_CAPITAL_LANES)('$archetype / $subtype revenue-capital policy parity', (scenario) => {
  it('keeps stage-boundary questions explicit before planning', () => {
    const intakeSpec = makeRevenueCapitalIntake(
      `${scenario.archetype}-spec`,
      scenario.goalText,
      scenario.admittedBoundary,
      'fully_admitted',
      {
        startingState: scenario.startingState,
        required: scenario.required,
        recommended: scenario.recommended,
        optional: scenario.optional,
      }
    );

    const policy = buildGoalPolicySnapshot({
      goalId: `${scenario.archetype}-spec`,
      intakeContract: intakeSpec,
      executionContract: makeRevenueCapitalExecutionContract(`${scenario.archetype}-spec`, scenario.goalText),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
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
  });

  it('keeps schedulable internal work provisional when external evidence is missing', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: `${scenario.archetype}-schedulable`,
      intakeContract: makeRevenueCapitalIntake(
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
      executionContract: makeRevenueCapitalExecutionContract(`${scenario.archetype}-schedulable`, scenario.goalText),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'insufficient_evidence',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(policy.planQuality.state).toBe('policy_clean');
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_EVIDENCE');
  });

  it('keeps draft assumptions separate from required pipeline work', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: `${scenario.archetype}-draft`,
      intakeContract: makeRevenueCapitalIntake(
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
      executionContract: makeRevenueCapitalExecutionContract(`${scenario.archetype}-draft`, scenario.goalText),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(policy.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(policy.planQuality.state).toBe('policy_degraded');
    expect(policy.planQuality.reasonCodes).toContain('PLAN_STARTING_STATE_ASSUMED');
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.scopeClassification.recommended).toEqual(scenario.recommended);
    expect(policy.scopeClassification.required).toEqual(scenario.required);
  });

  it('blocks unclear goals instead of inventing traction or investor response', () => {
    const blocked = buildGoalPolicySnapshot({
      goalId: `${scenario.archetype}-blocked`,
      intakeContract: makeRevenueCapitalIntake(
        `${scenario.archetype}-blocked`,
        scenario.goalText,
        null,
        'intake_blocked',
        {
          blockingReasons: [scenario.blockedReason],
          assumptions: ['offer'],
          requiredContextQuestions: [makeRevenueCapitalQuestion(scenario.blockedReason, scenario.blockedPrompt)],
          required: scenario.required,
          recommended: scenario.recommended,
          optional: scenario.optional,
          excluded: scenario.required,
          completionBoundaryStatus: 'ambiguous',
        }
      ),
      executionContract: makeRevenueCapitalExecutionContract(`${scenario.archetype}-blocked`, scenario.goalText),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'insufficient_evidence',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: false,
      hasProposedBlocks: false,
      hasExecutionGraph: false,
    });

    expect(blocked.intakeReadiness.state).toBe('intake_blocked');
    expect(blocked.planQuality.state).toBe('policy_blocked');
    expect(blocked.posTrust.state).toBe('withheld');
    expect(blocked.scopeClassification.blockedByUnconfirmedContext).toContain('offer');
  });

  it('keeps required work distinct from recommended support work', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: `${scenario.archetype}-scope`,
      intakeContract: makeRevenueCapitalIntake(
        `${scenario.archetype}-scope`,
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
      executionContract: makeRevenueCapitalExecutionContract(`${scenario.archetype}-scope`, scenario.goalText),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
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

describe('JobSearchPipeline policy snapshot', () => {
  function makeEmploymentExecutionContract(goalId: string, text: string) {
    return {
      goalId,
      terminalOutcome: {
        text,
        hash: `${goalId}-hash`,
        verificationCriteria: `${text} verified`,
        isConcrete: true,
      },
    } as any;
  }

  function makeEmploymentIntake(
    goalId: string,
    goalText: string,
    boundary: CompletionBoundary | null,
    state: GoalIntakeContract['readiness']['state'],
    options: {
      startingState?: string | null;
      assumptions?: string[];
      blockingReasons?: string[];
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
      requiredContextQuestions: [],
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

  it('withholds trust when job-search boundary remains ambiguous', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: 'job-search-1',
      intakeContract: makeEmploymentIntake('job-search-1', 'Get a job by deadline', null, 'intake_blocked', {
        blockingReasons: ['INTAKE_ARTIFACT_UNCLEAR'],
        assumptions: ['target role family'],
        excluded: ['generic career advice'],
        completionBoundaryStatus: 'missing',
      }),
      executionContract: makeEmploymentExecutionContract('job-search-1', 'Get a job by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'insufficient_evidence',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: false,
      hasProposedBlocks: false,
      hasExecutionGraph: false,
    });

    expect(policy.intakeReadiness.state).toBe('intake_blocked');
    expect(policy.planQuality.state).toBe('policy_blocked');
    expect(policy.posTrust.state).toBe('withheld');
    expect(policy.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_ADMISSION');
  });

  it('marks admitted job-search goals with unresolved starting state as draft quality', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: 'job-search-2',
      intakeContract: makeEmploymentIntake(
        'job-search-2',
        'Land interviews for a corporate role by deadline',
        'custom',
        'assumption_marked_draft',
        {
          assumptions: ['starting state'],
          startingState: null,
          required: ['target role family', 'resume', 'application tracker', 'outreach', 'interview prep'],
          recommended: ['networking polish', 'follow-up tracking'],
          optional: ['extra interview rehearsal'],
          completionBoundaryStatus: 'ambiguous',
        }
      ),
      executionContract: makeEmploymentExecutionContract(
        'job-search-2',
        'Land interviews for a corporate role by deadline'
      ),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(policy.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(policy.planQuality.state).toBe('policy_degraded');
    expect(policy.planQuality.reasonCodes).toContain('PLAN_STARTING_STATE_ASSUMED');
    expect(policy.posTrust.state).toBe('provisional');
  });

  it('marks explicit starting state as policy clean and trusted', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: 'job-search-3',
      intakeContract: makeEmploymentIntake(
        'job-search-3',
        'Land interviews for a remote role by deadline',
        'custom',
        'fully_admitted',
        {
          startingState: 'materials ready',
          required: ['target role family', 'resume', 'application tracker', 'outreach', 'interview prep'],
          recommended: ['networking polish', 'follow-up tracking'],
          optional: ['extra interview rehearsal'],
          completionBoundaryStatus: 'resolved',
        }
      ),
      executionContract: makeEmploymentExecutionContract(
        'job-search-3',
        'Land interviews for a remote role by deadline'
      ),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(policy.intakeReadiness.state).toBe('fully_admitted');
    expect(policy.planQuality.state).toBe('policy_clean');
    expect(policy.posTrust.state).toBe('trusted');
  });
});

describe('Capability / Credential policy snapshot', () => {
  function makeCapabilityExecutionContract(goalId: string, text: string) {
    return {
      goalId,
      terminalOutcome: {
        text,
        hash: `${goalId}-hash`,
        verificationCriteria: `${text} verified`,
        isConcrete: true,
      },
    } as any;
  }

  function makeCapabilityIntake(
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

  it('withholds trust when capability boundary remains ambiguous', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: 'capability-1',
      intakeContract: makeCapabilityIntake('capability-1', 'Learn a new skill by deadline', null, 'intake_blocked', {
        blockingReasons: ['INTAKE_ARTIFACT_UNCLEAR'],
        assumptions: ['target skill'],
        requiredContextQuestions: [
          {
            id: 'capability-boundary',
            domain: 'capability-credential',
            prompt: 'What skill or credential boundary are you targeting?',
            field: 'completionBoundary',
            answerType: 'single_select',
            required: true,
            reasonCode: 'INTAKE_ARTIFACT_UNCLEAR',
          },
        ],
        excluded: ['generic self-improvement'],
        completionBoundaryStatus: 'missing',
      }),
      executionContract: makeCapabilityExecutionContract('capability-1', 'Learn a new skill by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'insufficient_evidence',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: false,
      hasProposedBlocks: false,
      hasExecutionGraph: false,
    });

    expect(policy.intakeReadiness.state).toBe('intake_blocked');
    expect(policy.planQuality.state).toBe('policy_blocked');
    expect(policy.posTrust.state).toBe('withheld');
    expect(policy.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_ADMISSION');
  });

  it('marks admitted capability goals with unresolved starting state as draft quality', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: 'capability-2',
      intakeContract: makeCapabilityIntake(
        'capability-2',
        'Learn React well enough in 45 days to build and publish two working portfolio projects',
        'custom',
        'assumption_marked_draft',
        {
          assumptions: ['baseline'],
          startingState: null,
          required: ['baseline assessment', 'practice plan', 'drill set', 'working project', 'proof review'],
          recommended: ['pair review', 'extra drills'],
          optional: ['bonus project'],
          completionBoundaryStatus: 'resolved',
        }
      ),
      executionContract: makeCapabilityExecutionContract(
        'capability-2',
        'Learn React well enough in 45 days to build and publish two working portfolio projects'
      ),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(policy.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(policy.planQuality.state).toBe('policy_degraded');
    expect(policy.planQuality.reasonCodes).toContain('PLAN_STARTING_STATE_ASSUMED');
    expect(policy.posTrust.state).toBe('provisional');
  });

  it('marks explicit baseline and proof boundary as policy clean and trusted', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: 'capability-3',
      intakeContract: makeCapabilityIntake(
        'capability-3',
        'Pass the AWS Certified Cloud Practitioner exam by May 15',
        'custom',
        'fully_admitted',
        {
          startingState: 'study coverage mapped',
          required: ['requirements review', 'study plan', 'practice exams', 'remediation', 'final review'],
          recommended: ['flashcards', 'score tracking'],
          optional: ['bonus practice'],
          completionBoundaryStatus: 'resolved',
        }
      ),
      executionContract: makeCapabilityExecutionContract(
        'capability-3',
        'Pass the AWS Certified Cloud Practitioner exam by May 15'
      ),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(policy.intakeReadiness.state).toBe('fully_admitted');
    expect(policy.planQuality.state).toBe('policy_clean');
    expect(policy.posTrust.state).toBe('trusted');
  });
});

describe('Physical Progression policy snapshot', () => {
  function makePhysicalExecutionContract(goalId: string, text: string) {
    return {
      goalId,
      terminalOutcome: {
        text,
        hash: `${goalId}-hash`,
        verificationCriteria: `${text} verified`,
        isConcrete: true,
      },
    } as any;
  }

  function makePhysicalIntake(
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

  it('withholds trust when physical progression boundary remains ambiguous', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: 'physical-1',
      intakeContract: makePhysicalIntake('physical-1', 'Train for a 5k in 8 weeks', null, 'intake_blocked', {
        blockingReasons: ['INTAKE_CONTEXT_REQUIRED'],
        requiredContextQuestions: [
          {
            id: 'physical-boundary',
            domain: 'physical-progression',
            prompt: 'What measurable event or benchmark counts as completion?',
            field: 'completionBoundary',
            answerType: 'single_select',
            required: true,
            reasonCode: 'INTAKE_CONTEXT_REQUIRED',
          },
        ],
        assumptions: ['measurable target'],
        completionBoundaryStatus: 'missing',
      }),
      executionContract: makePhysicalExecutionContract('physical-1', 'Train for a 5k in 8 weeks'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'insufficient_evidence',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: false,
      hasProposedBlocks: false,
      hasExecutionGraph: false,
    });

    expect(policy.intakeReadiness.state).toBe('intake_blocked');
    expect(policy.planQuality.state).toBe('policy_blocked');
    expect(policy.posTrust.state).toBe('withheld');
    expect(policy.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_ADMISSION');
  });

  it('marks physical progression goals with assumed recovery state as draft quality', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: 'physical-2',
      intakeContract: makePhysicalIntake(
        'physical-2',
        'Complete a 12-week strength cycle',
        'custom',
        'assumption_marked_draft',
        {
          assumptions: ['recovery profile'],
          startingState: null,
          required: ['baseline benchmark', 'training progression', 'recovery checkpoints', 'benchmark re-test'],
          recommended: ['mobility extras', 'nutrition extras'],
          optional: ['bonus conditioning'],
          completionBoundaryStatus: 'resolved',
        }
      ),
      executionContract: makePhysicalExecutionContract('physical-2', 'Complete a 12-week strength cycle'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(policy.intakeReadiness.state).toBe('assumption_marked_draft');
    expect(policy.planQuality.state).toBe('policy_degraded');
    expect(policy.planQuality.reasonCodes).toContain('PLAN_STARTING_STATE_ASSUMED');
    expect(policy.posTrust.state).toBe('provisional');
  });

  it('marks explicit baseline and benchmark boundary as policy clean and trusted for physical progression', () => {
    const policy = buildGoalPolicySnapshot({
      goalId: 'physical-3',
      intakeContract: makePhysicalIntake(
        'physical-3',
        'Complete a 12-week endurance block by deadline',
        'custom',
        'fully_admitted',
        {
          startingState: 'baseline recorded',
          required: ['baseline benchmark', 'training progression', 'recovery checkpoints', 'benchmark re-test'],
          recommended: ['mobility extras', 'nutrition extras'],
          optional: ['bonus cross-training'],
          completionBoundaryStatus: 'resolved',
        }
      ),
      executionContract: makePhysicalExecutionContract('physical-3', 'Complete a 12-week endurance block by deadline'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: true,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
    });

    expect(policy.intakeReadiness.state).toBe('fully_admitted');
    expect(policy.planQuality.state).toBe('policy_clean');
    expect(policy.posTrust.state).toBe('trusted');
  });
});

// ST-01 remediation tests (RC-03: forward-linked action lineage)
describe('ST-01 remediation: forward-linked action lineage integrity', () => {
  function buildMusicIntake(goalId: string) {
    return buildGoalIntakeContract({
      goalId,
      rawGoalText: 'Finish and release a polished 3-song EP from scratch by deadline',
      verificationCriteria: 'EP is uploaded and live on streaming platforms',
      executionType: 'CreativeProduction',
      deadline: '2026-06-15',
    });
  }

  function buildMusicExecutionContract(goalId: string) {
    return buildExecutionContract(goalId, 'Finish and release a polished 3-song EP from scratch by deadline', {
      endDayKey: '2026-06-15',
    });
  }

  it('recognizes forward-linked actions (action.deliverableId) as mapped — lineageIntegrity is complete', () => {
    const intake = buildMusicIntake('st01-rc03-a');
    const policy = buildGoalPolicySnapshot({
      goalId: 'st01-rc03-a',
      intakeContract: intake,
      executionContract: buildMusicExecutionContract('st01-rc03-a'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      // Deterministic bootstrap path: deliverables have no actionIds, actions carry deliverableId
      canonicalDeliverables: [
        { id: 'auto-deliv-creative-music-brief' },
        { id: 'auto-deliv-creative-music-draft' },
        { id: 'auto-deliv-creative-music-polish' },
        { id: 'auto-deliv-creative-music-package' },
        { id: 'auto-deliv-creative-music-review' },
      ],
      canonicalActions: [
        { id: 'act-1', actionType: 'preparation', deliverableId: 'auto-deliv-creative-music-brief', dependencies: [] },
        {
          id: 'act-2',
          actionType: 'execution',
          deliverableId: 'auto-deliv-creative-music-draft',
          dependencies: ['act-1'],
        },
        {
          id: 'act-3',
          actionType: 'execution',
          deliverableId: 'auto-deliv-creative-music-polish',
          dependencies: ['act-2'],
        },
        {
          id: 'act-4',
          actionType: 'preparation',
          deliverableId: 'auto-deliv-creative-music-package',
          dependencies: ['act-3'],
        },
        {
          id: 'act-5',
          actionType: 'execution',
          deliverableId: 'auto-deliv-creative-music-review',
          dependencies: ['act-4'],
        },
      ],
    });

    expect(policy.planQuality.lineageIntegrity).toBe('complete');
    expect(policy.planQuality.actionTypeCoverage).toBe('complete');
    expect(policy.planQuality.structuralState).not.toBe('withheld');
  });

  it('structural state is not withheld solely because deliverables lack actionIds when forward links exist', () => {
    const intake = buildMusicIntake('st01-rc03-b');
    const policy = buildGoalPolicySnapshot({
      goalId: 'st01-rc03-b',
      intakeContract: intake,
      executionContract: buildMusicExecutionContract('st01-rc03-b'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1' }, { id: 'd2' }],
      canonicalActions: [
        { id: 'a1', actionType: 'preparation', deliverableId: 'd1', dependencies: [] },
        { id: 'a2', actionType: 'execution', deliverableId: 'd2', dependencies: ['a1'] },
      ],
    });

    expect(policy.planQuality.lineageIntegrity).toBe('complete');
    expect(policy.planQuality.structuralReasonCodes).not.toContain('PLAN_STRUCTURAL_TRUTH_WITHHELD');
    expect(policy.planQuality.structuralReasonCodes).not.toContain('PLAN_LINEAGE_INCOMPLETE');
  });

  it('lineageIntegrity remains missing when no forward or reverse links connect actions to deliverables', () => {
    const intake = buildMusicIntake('st01-rc03-c');
    const policy = buildGoalPolicySnapshot({
      goalId: 'st01-rc03-c',
      intakeContract: intake,
      executionContract: buildMusicExecutionContract('st01-rc03-c'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [{ id: 'd1' }],
      // Actions with no deliverableId and deliverable has no actionIds — no link in either direction
      canonicalActions: [{ id: 'a1', actionType: 'execution', dependencies: [] }],
    });

    expect(policy.planQuality.lineageIntegrity).toBe('missing');
  });

  it('feasibility is not withheld when forward-linked action lineage restores structural truth', () => {
    const intake = buildMusicIntake('st01-rc03-d');
    const policy = buildGoalPolicySnapshot({
      goalId: 'st01-rc03-d',
      intakeContract: intake,
      executionContract: buildMusicExecutionContract('st01-rc03-d'),
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [
        { id: 'auto-deliv-creative-music-brief' },
        { id: 'auto-deliv-creative-music-draft' },
        { id: 'auto-deliv-creative-music-polish' },
      ],
      canonicalActions: [
        { id: 'act-1', actionType: 'preparation', deliverableId: 'auto-deliv-creative-music-brief', dependencies: [] },
        {
          id: 'act-2',
          actionType: 'execution',
          deliverableId: 'auto-deliv-creative-music-draft',
          dependencies: ['act-1'],
        },
        {
          id: 'act-3',
          actionType: 'execution',
          deliverableId: 'auto-deliv-creative-music-polish',
          dependencies: ['act-2'],
        },
      ],
      preExecutionSchedule: { blockCount: 10, totalMinutes: 600 },
    });

    expect(policy.feasibility.state).not.toBe('withheld');
    expect(policy.feasibility.structuralSupport).not.toBe('missing');
  });

  it('treats explicit music-release endpoint, starting state, and measurable target as policy clean', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'st01-rc03-ep-clean',
      rawGoalText:
        'Finish and release a polished 3-song EP in 45 days so I have final recordings, cover art, distribution setup, and a ready release package.',
      verificationCriteria: 'EP is published and live on streaming platforms',
      executionType: 'CreativeProduction',
      deadline: '2026-06-19',
      answeredContext: {
        startingState: 'from scratch',
        executionContext: 'part_time',
        weeklyHoursAvailable: 20,
        capitalAvailable: 1500,
        hardDeadline: '2026-06-19',
        existingDomainRelationships: ['distributor account access pending'],
      },
    });

    const policy = buildGoalPolicySnapshot({
      goalId: 'st01-rc03-ep-clean',
      intakeContract: intake,
      executionContract: {
        ...buildMusicExecutionContract('st01-rc03-ep-clean'),
        terminalOutcome: {
          text: 'Finish and release a polished 3-song EP in 45 days so I have final recordings, cover art, distribution setup, and a ready release package.',
          verificationCriteria: 'EP is published and live on streaming platforms',
          isConcrete: true,
        },
        target: {
          count: 3,
          unit: 'songs',
          definitionOfDone: 'EP is published and live on streaming platforms',
        },
      },
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [
        { id: 'auto-deliv-creative-music-brief' },
        { id: 'auto-deliv-creative-music-draft' },
        { id: 'auto-deliv-creative-music-polish' },
        { id: 'auto-deliv-creative-music-package' },
        { id: 'auto-deliv-creative-music-review' },
      ],
      canonicalActions: [
        { id: 'act-1', actionType: 'preparation', deliverableId: 'auto-deliv-creative-music-brief', dependencies: [] },
        { id: 'act-2', actionType: 'execution', deliverableId: 'auto-deliv-creative-music-draft', dependencies: ['act-1'] },
        { id: 'act-3', actionType: 'execution', deliverableId: 'auto-deliv-creative-music-polish', dependencies: ['act-2'] },
        { id: 'act-4', actionType: 'preparation', deliverableId: 'auto-deliv-creative-music-package', dependencies: ['act-3'] },
        { id: 'act-5', actionType: 'execution', deliverableId: 'auto-deliv-creative-music-review', dependencies: ['act-4'] },
      ],
    });

    expect(intake.completionBoundaryStatus).toBe('resolved');
    expect(intake.startingState).toBe('from scratch');
    expect(policy.planQuality.endpointClarity).toBe('clear');
    expect(policy.planQuality.blockMeasurability).toBe('clear');
    expect(policy.planQuality.reasonCodes).not.toContain('INTAKE_CONTEXT_REQUIRED');
    expect(policy.planQuality.reasonCodes).not.toContain('PLAN_SCOPE_INFLATED');
    expect(policy.planQuality.reasonCodes).not.toContain('PLAN_MEASURABILITY_WEAK');
    expect(policy.planQuality.state).toBe('policy_clean');
  });

  it('treats explicit portfolio case-study endpoint substrate as policy-clean for professional qualification artifacts', () => {
    const goalText =
      'Create a project-management portfolio case study in 60 days that documents a real or simulated project, includes a clear project charter, timeline, stakeholder map, risk register, execution notes, retrospective, and a polished shareable case-study page.';
    const verificationCriteria =
      'A polished, shareable project-management portfolio case-study page exists with project charter, timeline, stakeholder map, risk register, execution notes, and retrospective included.';
    const intake = buildGoalIntakeContract({
      goalId: 'goal-pm-case-study',
      rawGoalText: goalText,
      verificationCriteria,
      executionType: 'ProfessionalQualification',
      deadline: '2026-07-05',
      answeredContext: {
        executionContext: 'part_time',
        weeklyHoursAvailable: 12,
        capitalAvailable: 250,
        hardDeadline: '2026-07-05',
        existingDomainRelationships: [],
        startingState: 'from scratch',
        projectContext: 'simulated_project',
        qualificationTarget: 'project-management portfolio proof artifact',
        workSampleRequirement: 'one polished case study with PM documentation artifacts',
      },
      contract: {
        target: {
          unit: 'published project-management case study',
        },
      },
    });
    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-pm-case-study',
      intakeContract: intake,
      executionContract: {
        goalId: 'goal-pm-case-study',
        startDayKey: '2026-05-06',
        deadline: { dayKey: '2026-07-05' },
        terminalOutcome: {
          text: goalText,
          verificationCriteria,
          isConcrete: true,
        },
        target: {
          count: 1,
          unit: 'published project-management case study',
          definitionOfDone: verificationCriteria,
        },
      },
      planProof: { feasibilityStatus: 'FEASIBLE' },
      probabilityStatus: 'computed',
      feasibilityStatus: 'FEASIBLE',
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: true,
      canonicalDeliverables: [
        { id: 'auto-deliv-pm-case-study-charter' },
        { id: 'auto-deliv-pm-case-study-artifacts' },
        { id: 'auto-deliv-pm-case-study-review' },
      ],
      canonicalActions: [
        { id: 'act-1', actionType: 'preparation', deliverableId: 'auto-deliv-pm-case-study-charter', dependencies: [] },
        { id: 'act-2', actionType: 'execution', deliverableId: 'auto-deliv-pm-case-study-artifacts', dependencies: ['act-1'] },
        { id: 'act-3', actionType: 'execution', deliverableId: 'auto-deliv-pm-case-study-review', dependencies: ['act-2'] },
      ],
    });

    expect(intake.completionBoundaryStatus).toBe('resolved');
    expect(intake.terminalEndpoint.status).toBe('clear_explicit');
    expect(policy.planQuality.endpointClarity).toBe('clear');
    expect(policy.planQuality.blockMeasurability).toBe('clear');
    expect(policy.planQuality.reasonCodes).not.toContain('INTAKE_CONTEXT_REQUIRED');
    expect(policy.planQuality.reasonCodes).not.toContain('PLAN_MEASURABILITY_WEAK');
    expect(policy.planQuality.state).toBe('policy_clean');
  });
});

// ---------------------------------------------------------------------------
// Trust-state semantics: authority ceiling and gate-failure propagation
// ---------------------------------------------------------------------------

function makeAdmittedIntakeContract() {
  // Minimal intake stub that clears the intake_blocked gate.
  return {
    readiness: { state: 'fully_admitted', isReadyForPlanning: true, blockingReasons: [], assumptionReasons: [] },
    completionBoundaryStatus: 'resolved',
    startingState: 'beginner level',
    scopePolicy: { required: [], recommended: [], optional: [], excluded: [], assumptionsNeedingConfirmation: [] },
    requiredContextQuestions: [],
    answeredContext: {},
  } as any;
}

function makeCleanPolicyInput(overrides: Record<string, unknown> = {}) {
  return {
    goalId: 'goal-trust',
    intakeContract: makeAdmittedIntakeContract(),
    executionContract: {
      goalId: 'goal-trust',
      startDayKey: '2026-04-07',
      endDayKey: '2026-10-07',
      deadline: { dayKey: '2026-10-07' },
      workWindows: {
        mon: [{ start: '09:00', end: '11:00' }],
        tue: [{ start: '09:00', end: '11:00' }],
        wed: [{ start: '09:00', end: '11:00' }],
        thu: [{ start: '09:00', end: '11:00' }],
        fri: [{ start: '09:00', end: '11:00' }],
        sat: [],
        sun: [],
      },
      terminalOutcome: { text: 'Test goal', verificationCriteria: 'Verified', isConcrete: true },
    } as any,
    probabilityStatus: 'computed' as const,
    planProof: { feasibilityStatus: 'FEASIBLE' },
    feasibilityStatus: 'FEASIBLE',
    hasCommittedBlocks: true,
    hasProposedBlocks: true,
    hasExecutionGraph: true,
    canonicalDeliverables: [{ id: 'd-1', title: 'Define target role and search criteria', actionIds: ['a-1'] }],
    canonicalActions: [{ id: 'a-1', actionType: 'execution', deliverableId: 'd-1', dependencies: [] }],
    preExecutionSchedule: { blockCount: 5, totalMinutes: 300 },
    ...overrides,
  };
}

describe('Trust-state semantics: authority ceiling', () => {
  it('fully_controllable + clean structure → trusted', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'fully_controllable',
      })
    );
    expect(policy.posTrust.state).toBe('trusted');
    expect(policy.posTrust.reasonCodes).not.toContain('POS_TRUST_PROVISIONAL_AUTHORITY_CEILING');
  });

  it('externally_mediated → capped at provisional pre-execution', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'externally_mediated',
      })
    );
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_TRUST_PROVISIONAL_AUTHORITY_CEILING');
    expect(policy.posTrust.reasonCodes).not.toContain('POS_TRUST_PROVISIONAL_PLAN_DEGRADED');
  });

  it('mixed → capped at provisional pre-execution', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'mixed',
      })
    );
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_TRUST_PROVISIONAL_AUTHORITY_CEILING');
  });

  it('unknown authority → capped at provisional', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'unknown',
      })
    );
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_TRUST_PROVISIONAL_AUTHORITY_CEILING');
  });

  it('null authority (not provided) → trusted when structure is clean', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: null,
      })
    );
    // No authority ceiling applied — falls through to trusted
    expect(policy.posTrust.state).toBe('trusted');
  });
});

describe('Trust-state semantics: gate-failure propagation', () => {
  it('OUTCOME_COVERAGE_PREP_ONLY → withheld', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'externally_mediated',
        planQualityFailureCodes: ['OUTCOME_COVERAGE_PREP_ONLY'],
      })
    );
    expect(policy.posTrust.state).toBe('withheld');
    expect(policy.posTrust.reasonCodes).toContain('POS_WITHHELD_UNTIL_PLAN_QUALITY');
  });

  it('OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING → withheld', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'externally_mediated',
        planQualityFailureCodes: ['OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING'],
      })
    );
    expect(policy.posTrust.state).toBe('withheld');
  });

  it('OUTCOME_ENDPOINT_MISSING → withheld', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'externally_mediated',
        planQualityFailureCodes: ['OUTCOME_ENDPOINT_MISSING'],
      })
    );
    expect(policy.posTrust.state).toBe('withheld');
  });

  it('OUTCOME_SPLIT_DIMENSION_UNCOVERED → withheld', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'mixed',
        planQualityFailureCodes: ['OUTCOME_SPLIT_DIMENSION_UNCOVERED'],
      })
    );
    expect(policy.posTrust.state).toBe('withheld');
  });

  it('gate failure takes precedence over authority ceiling — produces withheld, not provisional', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'externally_mediated',
        planQualityFailureCodes: ['OUTCOME_COVERAGE_PREP_ONLY', 'OUTCOME_ENDPOINT_MISSING'],
      })
    );
    expect(policy.posTrust.state).toBe('withheld');
  });

  it('non-withholding failure codes do not force withheld', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'fully_controllable',
        planQualityFailureCodes: ['DELIVERABLE_TOO_GENERIC'],
      })
    );
    // DELIVERABLE_TOO_GENERIC is not a trust-withholding gate code
    expect(policy.posTrust.state).toBe('trusted');
  });

  it('empty failure codes array → authority ceiling still applies', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'externally_mediated',
        planQualityFailureCodes: [],
      })
    );
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_TRUST_PROVISIONAL_AUTHORITY_CEILING');
  });
});

describe('Feasibility substrate level', () => {
  it('policy-clean + gate passed → trusted_feasibility, feasibility awardable', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'fully_controllable',
        planQualityFailureCodes: [],
      })
    );
    expect(policy.feasibility.substrateLevel).toBe('trusted_feasibility');
    expect(policy.feasibility.state).not.toBe('withheld');
  });

  it('trust-withholding gate code → substrate withheld, feasibility.state forced to withheld', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        planQualityFailureCodes: ['OUTCOME_COVERAGE_PREP_ONLY'],
      })
    );
    expect(policy.feasibility.substrateLevel).toBe('withheld');
    expect(policy.feasibility.state).toBe('withheld');
  });

  it('legacy feasibilityStatus does not by itself block canonical feasibility substrate', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        feasibilityStatus: 'INFEASIBLE',
        planQualityFailureCodes: [],
      })
    );
    expect(policy.feasibility.substrateLevel).toBe('trusted_feasibility');
    expect(policy.feasibility.state).not.toBe('withheld');
  });

  it('authority ceiling externally_mediated + trusted_feasibility substrate → posTrust provisional (ceiling intact)', () => {
    const policy = buildGoalPolicySnapshot(
      makeCleanPolicyInput({
        outcomeAuthorityClass: 'externally_mediated',
        planQualityFailureCodes: [],
      })
    );
    expect(policy.feasibility.substrateLevel).toBe('trusted_feasibility');
    expect(policy.posTrust.state).toBe('provisional');
    expect(policy.posTrust.reasonCodes).toContain('POS_TRUST_PROVISIONAL_AUTHORITY_CEILING');
  });
});
