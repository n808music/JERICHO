import { describe, expect, it } from 'vitest';
import { buildGoalIntakeContract, getIntakeGateCode, type GoalIntakeContract } from './GoalIntakeContract';

const BASE_PLANNING_ANSWERS = {
  executionContext: 'part_time',
  weeklyHoursAvailable: 12,
  capitalAvailable: 5000,
  hardDeadline: '2026-06-30',
  existingDomainRelationships: [],
};

function expectResolvedBoundary(contract: GoalIntakeContract, boundary: GoalIntakeContract['completionBoundary']) {
  expect(contract.completionBoundaryStatus).toBe('resolved');
  expect(contract.completionBoundary).toBe(boundary);
  expect(contract.readiness.isReadyForPlanning).toBe(true);
  expect(getIntakeGateCode(contract)).toBe('INTAKE_OK');
}

describe('GoalIntakeContract', () => {
  it('flags create 6 episodes to publish by deadline as boundary ambiguous', () => {
    const contract = buildGoalIntakeContract({
      goalId: 'goal-1',
      rawGoalText: 'Create 6 episodes to publish by deadline',
      verificationCriteria: '6 episodes produced',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
      answeredContext: BASE_PLANNING_ANSWERS,
    });

    expect(contract.domain).toBe('podcast');
    expect(contract.targetCount).toBe(6);
    expect(contract.commitmentVerb).toBe('create');
    expect(contract.completionBoundaryStatus).toBe('ambiguous');
    expect(contract.completionBoundary).toBeNull();
    expect(contract.requiredContextQuestions).toHaveLength(1);
    expect(contract.requiredContextQuestions[0].prompt).toMatch(/what counts as complete/i);
    expect(contract.readiness.state).toBe('intake_blocked');
    expect(contract.readiness.isReadyForPlanning).toBe(false);
    expect(getIntakeGateCode(contract)).toBe('INTAKE_BOUNDARY_AMBIGUOUS');
  });

  it('resolves publish 6 episodes by deadline to published', () => {
    const contract = buildGoalIntakeContract({
      goalId: 'goal-2',
      rawGoalText: 'Publish 6 episodes by deadline',
      verificationCriteria: 'All six episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
      answeredContext: BASE_PLANNING_ANSWERS,
    });

    expectResolvedBoundary(contract, 'published');
    expect(contract.readiness.state).toBe('assumption_marked_draft');
  });

  it('marks explicit starting state as fully admitted', () => {
    const contract = buildGoalIntakeContract({
      goalId: 'goal-2a',
      rawGoalText: 'Publish 6 episodes from scratch by deadline',
      verificationCriteria: 'All six episodes are live',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
      answeredContext: BASE_PLANNING_ANSWERS,
    });

    expectResolvedBoundary(contract, 'published');
    expect(contract.readiness.state).toBe('fully_admitted');
  });

  it('resolves record 6 episodes by deadline to recorded', () => {
    const contract = buildGoalIntakeContract({
      goalId: 'goal-3',
      rawGoalText: 'Record 6 episodes by deadline',
      verificationCriteria: 'All six recordings are complete',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
      answeredContext: BASE_PLANNING_ANSWERS,
    });

    expectResolvedBoundary(contract, 'recorded');
  });

  it('treats edited goals as required-outline / record / edit and keeps publish optional', () => {
    const contract = buildGoalIntakeContract({
      goalId: 'goal-4',
      rawGoalText: 'Edit 6 episodes for release',
      verificationCriteria: 'Episodes edited for release',
      executionType: 'CreativeProduction',
      deadline: '2026-06-30',
      answeredContext: BASE_PLANNING_ANSWERS,
    });

    expectResolvedBoundary(contract, 'publish_ready');
    expect(contract.scopePolicy.required).toEqual(['outline', 'record', 'edit', 'show notes', 'hosting setup']);
    expect(contract.scopePolicy.recommended).toContain('release workflow');
    expect(contract.scopePolicy.excluded).toContain('published live launch');
  });

  it('infers pounds lost as the canonical target unit for weight-loss goals', () => {
    const contract = buildGoalIntakeContract({
      goalId: 'goal-5',
      rawGoalText: 'Lose 10 pounds in 12 weeks',
      executionType: 'PhysicalTraining',
      deadline: '2026-06-30',
      answeredContext: BASE_PLANNING_ANSWERS,
    });

    expect(contract.targetCount).toBe(10);
    expect(contract.targetUnit).toBe('pounds lost');
  });

  it('infers fundraising package unit for package-prep fundraising goals', () => {
    const contract = buildGoalIntakeContract({
      goalId: 'goal-6',
      rawGoalText: 'Prepare a friends-and-family fundraising package for Jericho',
      executionType: 'Fundraising',
      deadline: '2026-06-30',
      answeredContext: BASE_PLANNING_ANSWERS,
    });

    expect(contract.targetCount).toBe(1);
    expect(contract.targetUnit).toBe('fundraising packages prepared');
  });

  it('preserves a custom target unit from the admitted contract', () => {
    const contract = buildGoalIntakeContract({
      goalId: 'goal-7',
      rawGoalText: 'Reduce resting heart rate',
      executionType: 'PhysicalTraining',
      deadline: '2026-06-30',
      answeredContext: BASE_PLANNING_ANSWERS,
      targetCount: 12,
      contract: {
        target: {
          unit: 'resting heart-rate points reduced',
        },
      },
    });

    expect(contract.targetCount).toBe(12);
    expect(contract.targetUnit).toBe('resting heart-rate points reduced');
  });

  it('builds structured planning intake and consultant-style planning questions for regulated consumables', () => {
    const contract = buildGoalIntakeContract({
      goalId: 'goal-8',
      rawGoalText: 'Build a caffeinated gum brand and take it to first real sales',
      executionType: 'BrandLaunch',
      deadline: '2026-10-01',
    });

    expect(contract.planningIntake?.goalClassification).toBe('regulated_physical_consumable');
    expect(contract.prePlanFeasibility?.status).toBeTruthy();
    const planningQuestionFields = (contract.requiredContextQuestions || [])
      .filter((question) => question.domain === 'planning')
      .map((question) => question.field);
    expect(planningQuestionFields).toEqual(
      expect.arrayContaining([
        'executionContext',
        'weeklyHoursAvailable',
        'capitalAvailable',
        'hardDeadline',
        'existingDomainRelationships',
        'formulaPathway',
        'targetCategory',
        'distributionChannel',
      ])
    );
  });

  it('resolves portfolio-based qualification boundary from explicit shareable case-study page substrate', () => {
    const goalText =
      'Create a project-management portfolio case study in 60 days that documents a real or simulated project, includes a clear project charter, timeline, stakeholder map, risk register, execution notes, retrospective, and a polished shareable case-study page.';
    const verificationCriteria =
      'A polished, shareable project-management portfolio case-study page exists with project charter, timeline, stakeholder map, risk register, execution notes, and retrospective included.';

    const contract = buildGoalIntakeContract({
      goalId: 'goal-9',
      rawGoalText: goalText,
      verificationCriteria,
      executionType: 'ProfessionalQualification',
      deadline: '2026-07-05',
      answeredContext: {
        ...BASE_PLANNING_ANSWERS,
        startingState: 'from scratch',
      },
      contract: {
        target: {
          unit: 'published project-management case study',
        },
      },
    });

    expect(contract.completionBoundaryStatus).toBe('resolved');
    expect(contract.completionBoundary).toBe('delivered');
    expect(contract.terminalEndpoint.status).toBe('clear_explicit');
    expect(contract.terminalEndpoint.primaryEndpoint).toBe('artifact_complete');
    expect(contract.startingState).toBe('from scratch');
  });
});
