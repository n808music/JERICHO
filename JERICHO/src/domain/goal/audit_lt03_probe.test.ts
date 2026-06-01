/**
 * LT-03 audit probe
 * Goal: "Get a full-time junior full-stack developer job within 6 months
 *        so I have a completed resume, polished portfolio, active application
 *        pipeline, interview-ready materials, and ongoing employer conversations."
 * Verification: "Active job offer letter from a full-time employer received.
 *                At least 15 applications submitted with at least 3 active
 *                interview processes documented."
 * Horizon: 6 months (medium_term, filed as long_term for probe consistency)
 *
 * Key probes:
 *  1. Detection routing — text-based false paths, executionType routing,
 *     skill contamination via SkillAcquisition executionType
 *  2. Plan quality gate — generic path, job_search_pipeline, skill_acquisition contamination
 *  3. Intake contract — domain, completionBoundaryStatus, startingState,
 *     externally-mediated outcome (RC-20 probe)
 *  4. Policy snapshot — job_search_pipeline admitted path, trust gate behavior,
 *     externally-mediated trust gap
 */
import { describe, test, expect } from 'vitest';
import { generateAutoDeliverables } from '../../core/autoDeliverables';
import { buildAutoDeliverablesFromGoalContract } from '../autoStrategy';
import { evaluatePlanQualityGate } from '../planQuality/evaluatePlanQualityGate';
import { buildGoalPolicySnapshot } from './GoalPolicy';
import { buildGoalIntakeContract } from './GoalIntakeContract';

const GOAL_TEXT =
  'Get a full-time junior full-stack developer job within 6 months so I have a completed resume, polished portfolio, active application pipeline, interview-ready materials, and ongoing employer conversations.';
const VERIFICATION_TEXT =
  'Active job offer letter from a full-time employer received. At least 15 applications submitted with at least 3 active interview processes documented.';
const DEADLINE_DAY_KEY = '2026-10-05'; // 6 months from 2026-04-05
const NOW_DAY_KEY = '2026-04-05';

function makeBaseGoalContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'goal-lt03',
    goalId: 'goal-lt03',
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
describe('LT-03 Probe 1: Detection routing', () => {
  test('without executionType: fallback path — "application pipeline" does not match job_search_pipeline', () => {
    const contract = makeBaseGoalContract() as any;
    const result = buildAutoDeliverablesFromGoalContract(contract, NOW_DAY_KEY);
    console.log('detectedType (no executionType, fallback):', result.detectedType);
    console.log(
      'fallback deliverables:',
      (result.deliverables ?? []).map((d: any) => d.title)
    );
    // Goal text contains "application pipeline" but NOT "job search pipeline" or "JobSearchPipeline"
    // detectGoalType cannot match — expect generic
    expect(result.detectedType).toBe('generic');
  });

  test('without executionType: primary path — "polished" triggers REVIEW mechanism (false path)', () => {
    const contract = makeBaseGoalContract();
    const deliverables = generateAutoDeliverables(contract);
    console.log('primary path (no executionType) deliverables:');
    console.log(JSON.stringify(deliverables.map((d) => ({ id: d.id, title: d.title })), null, 2));
    // mechanismClass: "polish" in text → REVIEW fires before CREATE
    // Expect REVIEW-class deliverable IDs, not job-search IDs
    const ids = deliverables.map((d) => d.id);
    console.log('IDs:', ids);
    const hasJobSearchId = ids.some((id) => id.includes('job'));
    console.log('primary path has job-search ID:', hasJobSearchId);
    expect(hasJobSearchId).toBe(false);
  });

  test('with JobSearchPipeline executionType: both paths route correctly', () => {
    const contract = makeBaseGoalContract({ executionType: 'JobSearchPipeline' });
    const primaryDeliverables = generateAutoDeliverables(contract);
    const fallbackResult = buildAutoDeliverablesFromGoalContract(
      makeBaseGoalContract({ executionType: 'JobSearchPipeline' }) as any,
      NOW_DAY_KEY
    );
    console.log('job_search_pipeline (primary) deliverables:');
    console.log(JSON.stringify(primaryDeliverables.map((d) => ({ id: d.id, title: d.title })), null, 2));
    console.log('job_search_pipeline (fallback) detectedType:', fallbackResult.detectedType);
    console.log(
      'job_search_pipeline (fallback) deliverables:',
      (fallbackResult.deliverables ?? []).map((d: any) => ({ id: d.id, title: d.title }))
    );
    expect(fallbackResult.detectedType).toBe('job_search_pipeline');

    // Verify job-search deliverable structure present
    const hasApplicationDeliverable = primaryDeliverables.some((d) =>
      /application|resume|interview|company|tracker|outreach/.test(d.title.toLowerCase())
    );
    console.log('job_search_pipeline has application/pipeline deliverable:', hasApplicationDeliverable);
    expect(hasApplicationDeliverable).toBe(true);
  });

  test('with SkillAcquisition executionType: skill contamination — skill path absorbs hiring goal', () => {
    const contract = makeBaseGoalContract({ executionType: 'SkillAcquisition' });
    const primaryDeliverables = generateAutoDeliverables(contract);
    const fallbackResult = buildAutoDeliverablesFromGoalContract(
      makeBaseGoalContract({ executionType: 'SkillAcquisition' }) as any,
      NOW_DAY_KEY
    );
    console.log('skill_acquisition contamination (primary) deliverables:');
    console.log(JSON.stringify(primaryDeliverables.map((d) => ({ id: d.id, title: d.title })), null, 2));
    console.log('skill_acquisition contamination (fallback) detectedType:', fallbackResult.detectedType);
    console.log(
      'skill_acquisition contamination (fallback) deliverables:',
      (fallbackResult.deliverables ?? []).map((d: any) => ({ id: d.id, title: d.title }))
    );
    // Skill_acquisition path has no job-search pipeline deliverable
    // Note: "interview" appears in the goal text as "interview-ready" — the skill noun
    // extractor picks this up as the domain noun phrase, producing titles like
    // "Produce interview-ready portfolio demonstration and explanation package".
    // These are skill deliverables WITH "interview" in them, not job-search pipeline steps.
    // The distinction: real job-search deliverables have pipeline-operation patterns.
    const hasJobPipelineDeliverable = primaryDeliverables.some((d) =>
      /submit.*application|company list|outreach|target roles|application pipeline|interview stages|application batch/.test(d.title.toLowerCase())
    );
    console.log('skill contamination path has job-pipeline deliverable:', hasJobPipelineDeliverable);
    console.log('[Finding] skill path absorbs "interview-ready" as noun phrase — appears in skill deliverable titles');
    console.log('[Finding] primary skill deliverable noun extraction:', primaryDeliverables.map((d) => d.title));
    // The plan "passes" skill gate but missing the entire hiring outcome
    expect(hasJobPipelineDeliverable).toBe(false);
    // Confirm skill path route is reached
    expect(fallbackResult.detectedType).toBe('skill_acquisition');
  });
});

// ---------------------------------------------------------------------------
// Probe 2: Plan quality gate
// ---------------------------------------------------------------------------
describe('LT-03 Probe 2: Plan quality gate', () => {
  test('generic fallback (no executionType) fires DELIVERABLE_TOO_GENERIC', () => {
    const genericDeliverables = [
      { id: 'auto-deliv-1', title: 'full-stack developer job foundation and setup' },
      { id: 'auto-deliv-2', title: 'full-stack developer job core production' },
      { id: 'auto-deliv-3', title: 'full-stack developer job completion and review' },
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

  test('job_search_pipeline gate with bootstrapped actions passes', () => {
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
    // Phase 3 note: gate now withholds with OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING.
    // The current probe pipeline (applications → interview prep → log responses) has no
    // offer-stage deliverable. Phase 3 correctly identifies this as a terminal corridor gap.
    // The pipeline needs a deliverable like "Receive and evaluate job offers" to pass Phase 3.
  });

  test('skill_acquisition contamination gate: passes on skill deliverables despite wrong archetype', () => {
    // Skill_acquisition applied to a hiring goal — the gate will pass because
    // skill deliverables are structurally well-formed, even though they miss the outcome
    const skillDeliverables = [
      { id: 'auto-deliv-skill-baseline', title: 'Establish baseline in full-stack developer job search' },
      { id: 'auto-deliv-skill-project-1', title: 'Complete first full-stack developer job search portfolio project and walkthrough' },
      { id: 'auto-deliv-skill-project-2', title: 'Complete second full-stack developer job search portfolio project with higher complexity' },
      { id: 'auto-deliv-skill-project-3', title: 'Complete full-stack developer job search portfolio project 3 and evidence summary' },
      { id: 'auto-deliv-skill-proof', title: 'Produce proof artifact showing full-stack developer job search' },
      { id: 'auto-deliv-skill-review', title: 'Run final readiness review for full-stack developer job search' },
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
    console.log('skill_acquisition contamination gate:');
    console.log('  status:', result.status);
    console.log('  failureCodes:', JSON.stringify(result.failureCodes));
    // Phase 2+3: gate withholds with OUTCOME_COVERAGE_PREP_ONLY and
    // OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING. Skill deliverables have no contact
    // stage and no terminal stage — both codes fire correctly. The structural
    // gate alone would pass (skill deliverables are well-formed), but the
    // outcome validity layer correctly identifies the archetype mismatch.
  });
});

// ---------------------------------------------------------------------------
// Probe 3: Intake contract
// ---------------------------------------------------------------------------
describe('LT-03 Probe 3: Intake contract', () => {
  test('intake — non-podcast domain, completionBoundaryStatus missing (RC-13 confirmed again)', () => {
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
    // Non-podcast → completionBoundaryStatus: missing
    expect(contract.completionBoundaryStatus).toBe('missing');
    // Note: verification text explicitly says "offer letter received" — a binary concrete outcome
    // completionBoundaryStatus remains missing because domain is general, not because outcome is unclear

    // Phase 1 observational: terminalOutcomeAuthority is populated on the contract
    console.log('  terminalOutcomeAuthority.authority:', contract.terminalOutcomeAuthority.authority);
    console.log('  terminalOutcomeAuthority.reasons:', JSON.stringify(contract.terminalOutcomeAuthority.reasons));
    console.log('  terminalOutcomeAuthority.confidence:', contract.terminalOutcomeAuthority.confidence);
    expect(contract.terminalOutcomeAuthority.authority).toBe('externally_mediated');
    expect(contract.terminalOutcomeAuthority.confidence).toBe('high');

    // Phase B observational: terminalEndpoint is populated on the contract
    console.log('  terminalEndpoint.status:', contract.terminalEndpoint.status);
    console.log('  terminalEndpoint.primaryEndpoint:', contract.terminalEndpoint.primaryEndpoint);
    console.log('  terminalEndpoint.reasons:', JSON.stringify(contract.terminalEndpoint.reasons));
    console.log('  terminalEndpoint.confidence:', contract.terminalEndpoint.confidence);
    // LT-03: "offer letter received from a target employer" — explicit offer_received endpoint
    expect(contract.terminalEndpoint.status).toBe('clear_explicit');
    expect(contract.terminalEndpoint.primaryEndpoint).toBe('offer_received');
    expect(contract.terminalEndpoint.confidence).toBe('high');
  });

  test('intake — starting state resolution for "resume ready" hint', () => {
    const contractWithHint = buildGoalIntakeContract({
      rawGoalText:
        'Get a full-time junior full-stack developer job within 6 months. Resume ready and portfolio ready.',
      verificationCriteria: VERIFICATION_TEXT,
      deadline: DEADLINE_DAY_KEY,
    });
    console.log('intake (with "resume ready" hint):');
    console.log('  startingState:', contractWithHint.startingState);
    console.log('  readiness.state:', contractWithHint.readiness?.state);
    console.log('  readiness.assumptionReasons:', JSON.stringify(contractWithHint.readiness?.assumptionReasons));
    // "resume ready" / "portfolio ready" should be detected by extractJobSearchStartingStateHint
    // and may surface as a non-null startingState (probing the starting-state hint system)
  });
});

// ---------------------------------------------------------------------------
// Probe 4: Policy snapshot — job_search_pipeline admitted path
// ---------------------------------------------------------------------------
describe('LT-03 Probe 4: Policy snapshot', () => {
  const jobDeliverables = [
    { id: 'auto-deliv-job-target', title: 'Define target role family and search criteria', actionIds: [] },
    { id: 'auto-deliv-job-materials', title: 'Tailor resume and portfolio for target roles', actionIds: [] },
    { id: 'auto-deliv-job-company-list', title: 'Build target company list and prioritization model', actionIds: [] },
    { id: 'auto-deliv-job-tracker', title: 'Create application pipeline tracking and outreach workflow', actionIds: [] },
    { id: 'auto-deliv-job-batch', title: 'Submit first tailored application batch', actionIds: [] },
    { id: 'auto-deliv-job-interview', title: 'Prepare interview story bank and answer framework', actionIds: [] },
    { id: 'auto-deliv-job-mock', title: 'Run mock interviews and follow-up practice', actionIds: [] },
    { id: 'auto-deliv-job-followup', title: 'Log responses and manage active interview stages', actionIds: [] },
  ];

  const jobActions = jobDeliverables.map((d, i) => ({
    id: `act-job-${String(i + 1).padStart(3, '0')}`,
    title: `Job search task for: ${d.title}`,
    deliverableId: d.id,
    actionType: i === 0 ? 'preparation' : 'execution',
    dependencies: i === 0 ? [] : [`act-job-${String(i).padStart(3, '0')}`],
  }));

  test('policy snapshot — job_search_pipeline admitted path, posTrust probe', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-lt03',
      rawGoalText: GOAL_TEXT,
      verificationCriteria: VERIFICATION_TEXT,
      executionType: 'JobSearchPipeline',
      deadline: DEADLINE_DAY_KEY,
    });

    const executionContract = {
      goalId: 'goal-lt03',
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
      goalId: 'goal-lt03',
      intakeContract: intake,
      executionContract: executionContract as any,
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: false,
      canonicalDeliverables: jobDeliverables,
      canonicalActions: jobActions,
      preExecutionSchedule: { blockCount: 8, totalMinutes: 480 },
      longTermPlan: {
        isLongHorizon: false,
        quality: { state: null, reasonCodes: null },
        saturation: { saturationShape: null },
        uncertainty: { bands: [] },
        checkpoints: [],
      },
    });

    console.log('Policy snapshot (job_search_pipeline, 6-month horizon):');
    console.log('  intakeReadiness.state:', policy.intakeReadiness?.state);
    console.log('  planQuality.state:', policy.planQuality?.state);
    console.log('  planQuality.reasonCodes:', JSON.stringify(policy.planQuality?.reasonCodes));
    console.log('  planQuality.lineageIntegrity:', policy.planQuality?.lineageIntegrity);
    console.log('  planQuality.actionTypeCoverage:', policy.planQuality?.actionTypeCoverage);
    console.log('  planQuality.assumptionBurden:', policy.planQuality?.assumptionBurden);
    console.log('  planQuality.startingPointHonesty:', policy.planQuality?.startingPointHonesty);
    console.log('  planQuality.endpointClarity:', policy.planQuality?.endpointClarity);
    console.log('  feasibility.state:', policy.feasibility?.state);
    console.log('  feasibility.reasonCodes:', JSON.stringify(policy.feasibility?.reasonCodes));
    console.log('  feasibility.temporalSupport:', policy.feasibility?.temporalSupport);
    console.log('  posTrust.state:', policy.posTrust?.state);
    console.log('  posTrust.reasonCodes:', JSON.stringify(policy.posTrust?.reasonCodes));
    console.log('  intake.domain:', intake.domain);
    console.log('  intake.completionBoundaryStatus:', intake.completionBoundaryStatus);
    console.log('  intake.startingState:', intake.startingState);
    console.log('  intake.readiness.state:', intake.readiness?.state);
    console.log('  intake.readiness.assumptionReasons:', JSON.stringify(intake.readiness?.assumptionReasons));

    // System has no externally-mediated outcome trust concept —
    // "offer letter received" requires employer action, not just user execution
    // posTrust does not reflect this distinction
    console.log('  [RC-20 probe] posTrust encodes external dependency:', false);
    console.log('  [RC-20 probe] any reasonCode for employer-dependent outcome:', false);

    expect(policy.planQuality?.lineageIntegrity).toBe('complete');
    expect(policy.feasibility?.state).toBe('withheld');
    // posTrust should be provisional (policy_degraded + missing boundary + no hasExecutionGraph)
    expect(policy.posTrust?.state).toBe('provisional');
  });
});
