/**
 * LT-02 audit probe
 * Goal: "Learn full-stack web development, build a portfolio of 3 projects,
 *        and land a junior software engineer role within 18 months"
 * Verification: "3 portfolio projects deployed and live on GitHub.
 *                Junior software engineer offer letter received."
 * Horizon: 18 months (long_term)
 *
 * Key probes:
 *  1. Detection routing — no executionType vs SkillAcquisition vs JobSearchPipeline
 *  2. Deliverable output per path — what each archetype covers and omits
 *  3. Plan quality gate per path
 *  4. Intake contract — completionBoundaryStatus (non-podcast → missing again)
 *  5. Policy snapshot — dual-outcome gap, structural dimensions
 */
import { describe, test, expect } from 'vitest';
import { generateAutoDeliverables } from '../../core/autoDeliverables';
import { buildAutoDeliverablesFromGoalContract } from '../autoStrategy';
import { evaluatePlanQualityGate } from '../planQuality/evaluatePlanQualityGate';
import { buildGoalPolicySnapshot } from './GoalPolicy';
import { buildGoalIntakeContract } from './GoalIntakeContract';

const GOAL_TEXT =
  'Learn full-stack web development, build a portfolio of 3 projects, and land a junior software engineer role within 18 months';
const VERIFICATION_TEXT =
  '3 portfolio projects deployed and live on GitHub. Junior software engineer offer letter received.';
const DEADLINE_DAY_KEY = '2027-10-05'; // 18 months from 2026-04-05
const NOW_DAY_KEY = '2026-04-05';

function makeBaseGoalContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'goal-lt02',
    goalId: 'goal-lt02',
    terminalOutcome: {
      text: GOAL_TEXT,
      verificationCriteria: VERIFICATION_TEXT,
      isConcrete: true,
    },
    deadline: { dayKey: DEADLINE_DAY_KEY },
    horizonClass: 'long_term',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Probe 1: Detection routing
// ---------------------------------------------------------------------------
describe('LT-02 Probe 1: Detection routing', () => {
  test('without executionType: fallback path detects generic (no archetype keyword match)', () => {
    const contract = makeBaseGoalContract() as any;
    const result = buildAutoDeliverablesFromGoalContract(contract, NOW_DAY_KEY);
    console.log('detectedType (no executionType, fallback):', result.detectedType);
    console.log(
      'generic fallback deliverables:',
      (result.deliverables ?? []).map((d: any) => d.title)
    );
    expect(result.detectedType).toBe('generic');
  });

  test('without executionType: primary path falls to LEARN mechanism', () => {
    const contract = makeBaseGoalContract();
    const deliverables = generateAutoDeliverables(contract);
    console.log(
      'primary path (no executionType) deliverables:',
      JSON.stringify(deliverables.map((d) => ({ id: d.id, title: d.title })), null, 2)
    );
    // deriveMechanismClass: "learn" in text → LEARN mechanism fires first
    const ids = deliverables.map((d) => d.id);
    console.log('IDs:', ids);
  });

  test('with SkillAcquisition executionType: routes to skill_acquisition', () => {
    const contract = makeBaseGoalContract({ executionType: 'SkillAcquisition' });
    const primaryDeliverables = generateAutoDeliverables(contract);
    const fallbackResult = buildAutoDeliverablesFromGoalContract(
      makeBaseGoalContract({ executionType: 'SkillAcquisition' }) as any,
      NOW_DAY_KEY
    );
    console.log('skill_acquisition (primary) deliverables:');
    console.log(JSON.stringify(primaryDeliverables.map((d) => ({ id: d.id, title: d.title })), null, 2));
    console.log('skill_acquisition (fallback) detectedType:', fallbackResult.detectedType);
    console.log(
      'skill_acquisition (fallback) deliverables:',
      (fallbackResult.deliverables ?? []).map((d: any) => ({ id: d.id, title: d.title }))
    );
    // Neither covers job-search dimension
    const hasJobSearchDeliverable = primaryDeliverables.some(
      (d) => /offer|interview|application|resume|company list/.test(d.title.toLowerCase())
    );
    console.log('skill_acquisition path has job-search deliverable:', hasJobSearchDeliverable);
    expect(hasJobSearchDeliverable).toBe(false);
  });

  test('with JobSearchPipeline executionType: routes to job_search_pipeline', () => {
    const contract = makeBaseGoalContract({ executionType: 'JobSearchPipeline' });
    const primaryDeliverables = generateAutoDeliverables(contract);
    const fallbackResult = buildAutoDeliverablesFromGoalContract(
      makeBaseGoalContract({ executionType: 'JobSearchPipeline' }) as any,
      NOW_DAY_KEY
    );
    console.log('job_search_pipeline (primary) deliverables:');
    console.log(JSON.stringify(primaryDeliverables.map((d) => ({ id: d.id, title: d.title })), null, 2));
    console.log('job_search_pipeline (fallback) detectedType:', fallbackResult.detectedType);
    // Neither covers skill development / curriculum dimension
    const hasLearningDeliverable = primaryDeliverables.some((d) =>
      /learn|curriculum|course|study|exercises|drill|baseline/.test(d.title.toLowerCase())
    );
    console.log('job_search_pipeline path has learning deliverable:', hasLearningDeliverable);
    expect(hasLearningDeliverable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Probe 2: Plan quality gate per path
// ---------------------------------------------------------------------------
describe('LT-02 Probe 2: Plan quality gate', () => {
  test('generic fallback (no executionType) fires DELIVERABLE_TOO_GENERIC', () => {
    const genericDeliverables = [
      { id: 'auto-deliv-1', title: 'full stack web foundation and setup' },
      { id: 'auto-deliv-2', title: 'full stack web core production' },
      { id: 'auto-deliv-3', title: 'full stack web completion and review' },
    ];
    const result = evaluatePlanQualityGate({
      goalText: GOAL_TEXT,
      verificationText: VERIFICATION_TEXT,
      deliverables: genericDeliverables,
      actions: [],
    });
    console.log('generic gate:');
    console.log('  status:', result.status);
    console.log('  failureCodes:', JSON.stringify(result.failureCodes));
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('DELIVERABLE_TOO_GENERIC');
  });

  test('skill_acquisition gate with bootstrapped actions passes cleanly', () => {
    // 3 explicit portfolio projects → baseline + 3 projects + proof + review = 6 deliverables
    const skillDeliverables = [
      { id: 'auto-deliv-skill-baseline', title: 'Establish baseline in full-stack web development' },
      { id: 'auto-deliv-skill-project-1', title: 'Complete first full-stack web development portfolio project and walkthrough' },
      { id: 'auto-deliv-skill-project-2', title: 'Complete second full-stack web development portfolio project with higher complexity' },
      { id: 'auto-deliv-skill-project-3', title: 'Complete full-stack web development portfolio project 3 and evidence summary' },
      { id: 'auto-deliv-skill-proof', title: 'Produce proof artifact showing full-stack web development' },
      { id: 'auto-deliv-skill-review', title: 'Run final readiness review for full-stack web development' },
    ];
    const skillActions = skillDeliverables.map((d, i) => ({
      id: `act-skill-${String(i + 1).padStart(3, '0')}`,
      title: `Work session for: ${d.title}`,
      deliverableId: d.id,
      actionType: i === 0 ? 'preparation' : 'execution',
      dependencies: i === 0 ? [] : [`act-skill-${String(i).padStart(3, '0')}`],
    }));

    const result = evaluatePlanQualityGate({
      goalText: GOAL_TEXT,
      verificationText: VERIFICATION_TEXT,
      deliverables: skillDeliverables,
      actions: skillActions,
    });
    console.log('skill_acquisition gate:');
    console.log('  status:', result.status);
    console.log('  failureCodes:', JSON.stringify(result.failureCodes));
    console.log('  meta:', JSON.stringify(result.meta, null, 2));
    // Phase D behavior (split goal, primaryEndpoint=offer_received, secondaryEndpoint=artifact_complete):
    //   OUTCOME_COVERAGE_PREP_ONLY: no job-search contact-stage deliverable
    //   OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING: no job-search terminal-stage deliverable
    //   OUTCOME_SPLIT_DIMENSION_UNCOVERED does NOT fire: artifact_complete secondary dimension
    //     IS covered by the portfolio project deliverables
  });

  test('job_search_pipeline gate with bootstrapped actions', () => {
    const jobDeliverables = [
      { id: 'auto-deliv-job-target', title: 'Define target role family and search criteria' },
      { id: 'auto-deliv-job-materials', title: 'Tailor resume and portfolio for target roles' },
      { id: 'auto-deliv-job-company-list', title: 'Build target company list and prioritization model' },
      { id: 'auto-deliv-job-tracker', title: 'Create application pipeline tracking and outreach workflow' },
      { id: 'auto-deliv-job-batch', title: 'Submit first tailored application batch' },
      { id: 'auto-deliv-job-interview', title: 'Prepare interview story bank and answer framework' },
      { id: 'auto-deliv-job-mock', title: 'Run mock interviews and follow-up practice' },
      { id: 'auto-deliv-job-followup', title: 'Log responses and manage active interview stages' },
    ];
    const jobActions = jobDeliverables.map((d, i) => ({
      id: `act-job-${String(i + 1).padStart(3, '0')}`,
      title: `Job search task for: ${d.title}`,
      deliverableId: d.id,
      actionType: i === 0 ? 'preparation' : 'execution',
      dependencies: i === 0 ? [] : [`act-job-${String(i).padStart(3, '0')}`],
    }));

    const result = evaluatePlanQualityGate({
      goalText: GOAL_TEXT,
      verificationText: VERIFICATION_TEXT,
      deliverables: jobDeliverables,
      actions: jobActions,
    });
    console.log('job_search_pipeline gate:');
    console.log('  status:', result.status);
    console.log('  failureCodes:', JSON.stringify(result.failureCodes));
    console.log('  meta:', JSON.stringify(result.meta, null, 2));
    // Phase D behavior (split goal, primaryEndpoint=offer_received, secondaryEndpoint=artifact_complete):
    //   OUTCOME_SPLIT_DIMENSION_UNCOVERED fires: artifact_complete secondary dimension has
    //     zero representation — job-search deliverables have no build/deploy/portfolio vocabulary
  });
});

// ---------------------------------------------------------------------------
// Probe 3: Intake contract
// ---------------------------------------------------------------------------
describe('LT-02 Probe 3: Intake contract', () => {
  test('intake — non-podcast domain, completionBoundaryStatus reverts to missing', () => {
    const contract = buildGoalIntakeContract({
      rawGoalText: GOAL_TEXT,
      verificationCriteria: VERIFICATION_TEXT,
      deadline: DEADLINE_DAY_KEY,
    });
    console.log('intake (no starting state hint):');
    console.log('  domain:', contract.domain);
    console.log('  readiness.state:', contract.readiness?.state);
    console.log('  completionBoundaryStatus:', contract.completionBoundaryStatus);
    console.log('  completionBoundary:', contract.completionBoundary);
    console.log('  startingState:', contract.startingState);
    console.log('  readiness.blockingReasons:', JSON.stringify(contract.readiness?.blockingReasons));
    console.log('  readiness.assumptionReasons:', JSON.stringify(contract.readiness?.assumptionReasons));
    // Non-podcast → completionBoundaryStatus: missing (RC-13 pattern confirmed again)
    expect(contract.completionBoundaryStatus).toBe('missing');
    expect(contract.startingState).toBeNull();

    // Phase B/C observational: terminalEndpoint is populated on the contract
    console.log('  terminalEndpoint.status:', contract.terminalEndpoint.status);
    console.log('  terminalEndpoint.primaryEndpoint:', contract.terminalEndpoint.primaryEndpoint);
    console.log('  terminalEndpoint.secondaryEndpoint:', contract.terminalEndpoint.secondaryEndpoint);
    console.log('  terminalEndpoint.reasons:', JSON.stringify(contract.terminalEndpoint.reasons));
    console.log('  terminalEndpoint.confidence:', contract.terminalEndpoint.confidence);
    // LT-02 is the canonical split proof case:
    //   - "3 portfolio projects deployed and live on GitHub" → artifact_complete
    //   - "Junior software engineer offer letter received" → offer_received
    // Two distinct terminal outcomes with different authority classes.
    expect(contract.terminalEndpoint.status).toBe('split');
    const endpoints = [contract.terminalEndpoint.primaryEndpoint, contract.terminalEndpoint.secondaryEndpoint];
    expect(endpoints).toContain('offer_received');
    expect(endpoints).toContain('artifact_complete');
  });
});

// ---------------------------------------------------------------------------
// Probe 4: Policy snapshot — skill_acquisition admitted path
// ---------------------------------------------------------------------------
describe('LT-02 Probe 4: Policy snapshot', () => {
  const skillDeliverables = [
    { id: 'auto-deliv-skill-baseline', title: 'Establish baseline in full-stack web development', actionIds: [] },
    { id: 'auto-deliv-skill-project-1', title: 'Complete first full-stack web development portfolio project and walkthrough', actionIds: [] },
    { id: 'auto-deliv-skill-project-2', title: 'Complete second full-stack web development portfolio project with higher complexity', actionIds: [] },
    { id: 'auto-deliv-skill-project-3', title: 'Complete full-stack web development portfolio project 3 and evidence summary', actionIds: [] },
    { id: 'auto-deliv-skill-proof', title: 'Produce proof artifact showing full-stack web development', actionIds: [] },
    { id: 'auto-deliv-skill-review', title: 'Run final readiness review for full-stack web development', actionIds: [] },
  ];

  const skillActions = skillDeliverables.map((d, i) => ({
    id: `act-skill-${String(i + 1).padStart(3, '0')}`,
    title: `Work session for: ${d.title}`,
    deliverableId: d.id,
    actionType: i === 0 ? 'preparation' : 'execution',
    dependencies: i === 0 ? [] : [`act-skill-${String(i).padStart(3, '0')}`],
  }));

  test('policy snapshot for skill_acquisition admitted path', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-lt02',
      rawGoalText: GOAL_TEXT,
      verificationCriteria: VERIFICATION_TEXT,
      executionType: 'SkillAcquisition',
      deadline: DEADLINE_DAY_KEY,
    });

    const executionContract = {
      goalId: 'goal-lt02',
      startDayKey: NOW_DAY_KEY,
      endDayKey: DEADLINE_DAY_KEY,
      deadline: { dayKey: DEADLINE_DAY_KEY },
      workWindows: {},
      terminalOutcome: {
        text: GOAL_TEXT,
        verificationCriteria: VERIFICATION_TEXT,
        isConcrete: true,
      },
    };

    const policy = buildGoalPolicySnapshot({
      goalId: 'goal-lt02',
      intakeContract: intake,
      executionContract: executionContract as any,
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: false,
      canonicalDeliverables: skillDeliverables,
      canonicalActions: skillActions,
      preExecutionSchedule: { blockCount: 8, totalMinutes: 480 },
      longTermPlan: {
        isLongHorizon: true,
        quality: { state: null, reasonCodes: null },
        saturation: { saturationShape: null },
        uncertainty: { bands: [] },
        checkpoints: [],
      },
    });

    console.log('Policy snapshot (skill_acquisition, long-horizon):');
    console.log('  intakeReadiness.state:', policy.intakeReadiness?.state);
    console.log('  planQuality.state:', policy.planQuality?.state);
    console.log('  planQuality.reasonCodes:', JSON.stringify(policy.planQuality?.reasonCodes));
    console.log('  planQuality.lineageIntegrity:', policy.planQuality?.lineageIntegrity);
    console.log('  planQuality.actionTypeCoverage:', policy.planQuality?.actionTypeCoverage);
    console.log('  planQuality.dependencyReadinessCoverage:', policy.planQuality?.dependencyReadinessCoverage);
    console.log('  planQuality.inspectability:', policy.planQuality?.inspectability);
    console.log('  planQuality.assumptionBurden:', policy.planQuality?.assumptionBurden);
    console.log('  planQuality.startingPointHonesty:', policy.planQuality?.startingPointHonesty);
    console.log('  planQuality.endpointClarity:', policy.planQuality?.endpointClarity);
    console.log('  planQuality.blockMeasurability:', policy.planQuality?.blockMeasurability);
    console.log('  feasibility.state:', policy.feasibility?.state);
    console.log('  feasibility.reasonCodes:', JSON.stringify(policy.feasibility?.reasonCodes));
    console.log('  feasibility.temporalSupport:', policy.feasibility?.temporalSupport);
    console.log('  posTrust.state:', policy.posTrust?.state);
    console.log('  intake.domain:', intake.domain);
    console.log('  intake.completionBoundaryStatus:', intake.completionBoundaryStatus);
    console.log('  intake.startingState:', intake.startingState);
    console.log('  intake.readiness.state:', intake.readiness?.state);
    console.log('  intake.readiness.assumptionReasons:', JSON.stringify(intake.readiness?.assumptionReasons));

    expect(policy.planQuality?.lineageIntegrity).toBe('complete');
    expect(policy.feasibility?.state).toBe('withheld');
  });
});
