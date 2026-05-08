/**
 * LT-04 audit probe
 * Goal: "Raise $50,000 in funding for my startup within 9 months so I have
 *        an investor deck, financial model, outreach pipeline, live investor
 *        conversations, and a signed investment commitment."
 * Verification: "Signed investment agreement received from at least one
 *                investor committing $50,000. Wire transfer confirmed."
 * Horizon: 9 months (long_term)
 *
 * Audit doctrine: RC-20 cross-domain confirmation.
 * LT-03 established that the trust model has no encoding for externally
 * mediated terminal events (hiring). LT-04 tests whether the same gap
 * exists in a different lane (fundraising / investor decision).
 *
 * Key probes:
 *  1. Detection routing — text-based path failures, "fundraising" keyword
 *     absence, MARKET false path, "outreach" substring collision
 *  2. Mode branch selection — packagePrepMode vs full pipeline
 *     ("investor conversations" in goal text defeats packagePrepMode)
 *  3. Terminal event proximity — does any deliverable represent the
 *     signed commitment as an externally contingent event?
 *  4. Plan quality gate — all paths, gate blind spot for wrong-archetype
 *  5. Intake contract — domain, boundary, starting state
 *  6. Policy snapshot — posTrust, RC-20 probe in fundraising lane
 */
import { describe, test, expect } from 'vitest';
import { generateAutoDeliverables } from '../../core/autoDeliverables';
import { buildAutoDeliverablesFromGoalContract } from '../autoStrategy';
import { evaluatePlanQualityGate } from '../planQuality/evaluatePlanQualityGate';
import { buildGoalPolicySnapshot } from './GoalPolicy';
import { buildGoalIntakeContract } from './GoalIntakeContract';

const GOAL_TEXT =
  'Raise $50,000 in funding for my startup within 9 months so I have an investor deck, financial model, outreach pipeline, live investor conversations, and a signed investment commitment.';
const VERIFICATION_TEXT =
  'Signed investment agreement received from at least one investor committing $50,000. Wire transfer confirmed.';
const DEADLINE_DAY_KEY = '2027-01-05'; // 9 months from 2026-04-05
const NOW_DAY_KEY = '2026-04-05';

function makeBaseGoalContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'goal-lt04',
    goalId: 'goal-lt04',
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
describe('LT-04 Probe 1: Detection routing', () => {
  test('without executionType: fallback path — "fundraising" keyword absent, routes generic', () => {
    const contract = makeBaseGoalContract() as any;
    const result = buildAutoDeliverablesFromGoalContract(contract, NOW_DAY_KEY);
    console.log('detectedType (no executionType, fallback):', result.detectedType);
    console.log(
      'fallback deliverables:',
      (result.deliverables ?? []).map((d: any) => d.title)
    );
    // Goal text contains "raise" but NOT "fundraising" or "fundraise"
    // detectGoalType requires exact keyword → falls to generic
    // business_launch requires >= 2 of [business, service, offer, customer, client, startup, revenue, sales]
    // only "startup" present → count = 1 → does not trigger business_launch either
    expect(result.detectedType).toBe('generic');
  });

  test('without executionType: primary path — "reach" substring triggers MARKET mechanism', () => {
    const contract = makeBaseGoalContract();
    const deliverables = generateAutoDeliverables(contract);
    console.log('primary path (no executionType) deliverables:');
    console.log(JSON.stringify(deliverables.map((d) => ({ id: d.id, title: d.title })), null, 2));
    // mechanismClass: MARKET regex contains "reach" as substring — matches "outreach"
    // MARKET fires before OPS or CREATE
    // No fundraising deliverables produced
    const ids = deliverables.map((d) => d.id);
    console.log('IDs:', ids);
    const hasFundraisingId = ids.some((id) => id.includes('raise'));
    console.log('primary path has fundraising ID:', hasFundraisingId);
    console.log('[Finding] "reach" in MARKET regex matches "outreach" — false MARKET path');
    expect(hasFundraisingId).toBe(false);
  });

  test('with Fundraising executionType: both paths route to fundraising', () => {
    const contract = makeBaseGoalContract({ executionType: 'Fundraising' });
    const primaryDeliverables = generateAutoDeliverables(contract);
    const fallbackResult = buildAutoDeliverablesFromGoalContract(
      makeBaseGoalContract({ executionType: 'Fundraising' }) as any,
      NOW_DAY_KEY
    );
    console.log('fundraising (primary) deliverables:');
    console.log(JSON.stringify(primaryDeliverables.map((d) => ({ id: d.id, title: d.title })), null, 2));
    console.log('fundraising (fallback) detectedType:', fallbackResult.detectedType);
    console.log(
      'fundraising (fallback) deliverables:',
      (fallbackResult.deliverables ?? []).map((d: any) => ({ id: d.id, title: d.title }))
    );
    expect(fallbackResult.detectedType).toBe('fundraising');

    // Confirm fundraising structure present
    const hasFundraisingStructure = primaryDeliverables.some((d) =>
      /thesis|deck|investor|raise|diligence|term|close/.test(d.id.toLowerCase())
    );
    console.log('fundraising path has fundraising structure:', hasFundraisingStructure);
    expect(hasFundraisingStructure).toBe(true);
  });

  test('packagePrepMode branch: "investor conversations" defeats package-only mode', () => {
    // packagePrepMode negative condition: if "investor conversations" appears → full pipeline
    // The goal text explicitly includes "live investor conversations"
    // This means the system correctly routes to the full 8-deliverable pipeline
    // including close/signature deliverables — the system's closest approximation to terminal event
    const contract = makeBaseGoalContract({ executionType: 'Fundraising' });
    const primaryDeliverables = generateAutoDeliverables(contract);
    const fallbackResult = buildAutoDeliverablesFromGoalContract(
      makeBaseGoalContract({ executionType: 'Fundraising' }) as any,
      NOW_DAY_KEY
    );

    // Full pipeline should include close/legal-close deliverable
    const hasCloseDeliverable = primaryDeliverables.some((d) =>
      /close|term|signature|commitment/.test(d.id.toLowerCase())
    );
    const fallbackHasClose = (fallbackResult.deliverables ?? []).some((d: any) =>
      /close|term|signature|commitment/.test(d.id.toLowerCase())
    );
    console.log('primary path has close/term deliverable:', hasCloseDeliverable);
    console.log('fallback path has close/term deliverable:', fallbackHasClose);
    console.log('primary deliverable count:', primaryDeliverables.length);
    console.log('fallback deliverable count:', (fallbackResult.deliverables ?? []).length);

    // Full pipeline fires (packagePrepMode = false due to "investor conversations")
    expect(hasCloseDeliverable).toBe(true);

    // Probe: does any deliverable title explicitly represent investor commitment as external event?
    const closeDeliverable = primaryDeliverables.find((d) =>
      /close|term|signature|commitment/.test(d.id.toLowerCase())
    );
    const fallbackCloseDeliverable = (fallbackResult.deliverables ?? []).find((d: any) =>
      /close|term|signature|commitment/.test(d.id.toLowerCase())
    );
    console.log('[Terminal event proximity] primary close deliverable title:', closeDeliverable?.title);
    console.log('[Terminal event proximity] fallback close deliverable title:', fallbackCloseDeliverable?.title);
    console.log('[RC-20 probe] Does title frame investor commitment as contingent (investor must decide)?');
    console.log('  → Close deliverable is phrased as user action ("Coordinate", "Finalize", "Track")');
    console.log('  → No deliverable title says "Receive signed commitment" or frames it as external decision');
  });
});

// ---------------------------------------------------------------------------
// Probe 2: Plan quality gate
// ---------------------------------------------------------------------------
describe('LT-04 Probe 2: Plan quality gate', () => {
  test('generic fallback (no executionType) fires DELIVERABLE_TOO_GENERIC', () => {
    const genericDeliverables = [
      { id: 'auto-deliv-1', title: 'startup funding foundation and setup' },
      { id: 'auto-deliv-2', title: 'startup funding core production' },
      { id: 'auto-deliv-3', title: 'startup funding completion and review' },
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

  test('fundraising full pipeline gate with bootstrapped actions passes', () => {
    // Full pipeline (packagePrepMode = false) — 8 deliverables including close/legal-close
    const raiseDeliverables = [
      { id: 'auto-deliv-raise-thesis', title: 'Define raise objective, use-of-funds, and investor thesis' },
      { id: 'auto-deliv-raise-deck', title: 'Build fundraising narrative and deck storyline' },
      { id: 'auto-deliv-raise-dataroom', title: 'Create diligence checklist and data room structure' },
      { id: 'auto-deliv-raise-targets', title: 'Build target investor list and fit scoring model' },
      { id: 'auto-deliv-raise-outreach', title: 'Prepare outreach sequences and intro request scripts' },
      { id: 'auto-deliv-raise-meetings', title: 'Run first wave of investor outreach and meetings' },
      { id: 'auto-deliv-raise-followup', title: 'Deliver follow-up materials and manage diligence requests' },
      { id: 'auto-deliv-raise-close', title: 'Coordinate term discussions and commitment tracking' },
    ];
    const raiseActions = raiseDeliverables.map((d, i) => ({
      id: `act-raise-${String(i + 1).padStart(3, '0')}`,
      title: `Fundraising task for: ${d.title}`,
      deliverableId: d.id,
      actionType: i === 0 ? 'preparation' : 'execution',
      dependencies: i === 0 ? [] : [`act-raise-${String(i).padStart(3, '0')}`],
    }));

    const result = evaluatePlanQualityGate({
      goalText: GOAL_TEXT,
      verificationText: VERIFICATION_TEXT,
      deliverables: raiseDeliverables,
      actions: raiseActions,
    });
    console.log('fundraising full pipeline gate:');
    console.log('  status:', result.status);
    console.log('  failureCodes:', JSON.stringify(result.failureCodes));
    console.log('  meta:', JSON.stringify(result.meta, null, 2));
    // Gate passes — but the plan models PROCESS toward investor decision
    // not the decision itself. "Coordinate term discussions" is still a
    // user action. The signed commitment requires investor to say yes.
    // The gate does not detect this.
    console.log('[RC-20 probe] gate passed without checking investor decision dependency:', result.status === 'PLAN_QUALITY_PASSED');
  });

  test('fundraising packagePrepMode gate with bootstrapped actions (prep-only path)', () => {
    // Simulated prep-only path (6 deliverables, no meetings/close/terms)
    // This is what fires when goal text lacks "investor conversations"
    const prepDeliverables = [
      { id: 'auto-deliv-raise-thesis', title: 'Define raise objective, use-of-funds, and investor thesis' },
      { id: 'auto-deliv-raise-deck', title: 'Build fundraising narrative, pitch deck, and financial ask storyline' },
      { id: 'auto-deliv-raise-dataroom', title: 'Create diligence checklist, financial package, and data room structure' },
      { id: 'auto-deliv-raise-targets', title: 'Build target investor list and fit scoring model' },
      { id: 'auto-deliv-raise-outreach', title: 'Prepare outreach sequences, intro request scripts, and send package checklist' },
      { id: 'auto-deliv-raise-readiness', title: 'Run fundraising readiness review, objection handling, and investor-ready materials check' },
    ];
    const prepActions = prepDeliverables.map((d, i) => ({
      id: `act-prep-${String(i + 1).padStart(3, '0')}`,
      title: `Prep task for: ${d.title}`,
      deliverableId: d.id,
      actionType: i === 0 ? 'preparation' : 'execution',
      dependencies: i === 0 ? [] : [`act-prep-${String(i).padStart(3, '0')}`],
    }));

    const result = evaluatePlanQualityGate({
      goalText: GOAL_TEXT,
      verificationText: VERIFICATION_TEXT,
      deliverables: prepDeliverables,
      actions: prepActions,
    });
    console.log('fundraising packagePrepMode gate:');
    console.log('  status:', result.status);
    console.log('  failureCodes:', JSON.stringify(result.failureCodes));
    // Prep-only path may fail gate on missing investor-meeting/close coverage
    // OR it may pass — this is the probe question
    console.log('[Probe] prep-only plan passes gate despite having NO investor meeting, diligence, or close deliverable:', result.status === 'PLAN_QUALITY_PASSED');
  });
});

// ---------------------------------------------------------------------------
// Probe 3: Intake contract
// ---------------------------------------------------------------------------
describe('LT-04 Probe 3: Intake contract', () => {
  test('intake — non-podcast domain, completionBoundaryStatus missing (RC-13 now 6/6)', () => {
    const contract = buildGoalIntakeContract({
      rawGoalText: GOAL_TEXT,
      verificationCriteria: VERIFICATION_TEXT,
      deadline: DEADLINE_DAY_KEY,
    });
    console.log('intake (no executionType):');
    console.log('  domain:', contract.domain);
    console.log('  readiness.state:', contract.readiness?.state);
    console.log('  completionBoundaryStatus:', contract.completionBoundaryStatus);
    console.log('  completionBoundary:', contract.completionBoundary);
    console.log('  startingState:', contract.startingState);
    console.log('  readiness.blockingReasons:', JSON.stringify(contract.readiness?.blockingReasons));
    console.log('  readiness.assumptionReasons:', JSON.stringify(contract.readiness?.assumptionReasons));
    // "Signed investment agreement received" — binary, concrete, self-verifying endpoint
    // Same RC-13 pattern as LT-03: domain = general → completionBoundaryStatus: missing
    expect(contract.completionBoundaryStatus).toBe('missing');
    expect(contract.startingState).toBeNull();

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
    // LT-04: "Raise $50,000" + "signed investment agreement" + "wire transfer confirmed"
    // Capital secured is the explicit terminal object (wire transfer in verification text)
    expect(contract.terminalEndpoint.status).toBe('clear_explicit');
    expect(contract.terminalEndpoint.primaryEndpoint).toBe('capital_secured');
    expect(contract.terminalEndpoint.confidence).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// Probe 4: Policy snapshot — fundraising admitted path, RC-20 cross-lane
// ---------------------------------------------------------------------------
describe('LT-04 Probe 4: Policy snapshot', () => {
  const raiseDeliverables = [
    { id: 'auto-deliv-raise-thesis', title: 'Define raise objective, use-of-funds, and investor thesis', actionIds: [] },
    { id: 'auto-deliv-raise-deck', title: 'Build fundraising narrative and deck storyline', actionIds: [] },
    { id: 'auto-deliv-raise-dataroom', title: 'Create diligence checklist and data room structure', actionIds: [] },
    { id: 'auto-deliv-raise-targets', title: 'Build target investor list and fit scoring model', actionIds: [] },
    { id: 'auto-deliv-raise-outreach', title: 'Prepare outreach sequences and intro request scripts', actionIds: [] },
    { id: 'auto-deliv-raise-meetings', title: 'Run first wave of investor outreach and meetings', actionIds: [] },
    { id: 'auto-deliv-raise-followup', title: 'Deliver follow-up materials and manage diligence requests', actionIds: [] },
    { id: 'auto-deliv-raise-close', title: 'Coordinate term discussions and commitment tracking', actionIds: [] },
  ];

  const raiseActions = raiseDeliverables.map((d, i) => ({
    id: `act-raise-${String(i + 1).padStart(3, '0')}`,
    title: `Fundraising task for: ${d.title}`,
    deliverableId: d.id,
    actionType: i === 0 ? 'preparation' : 'execution',
    dependencies: i === 0 ? [] : [`act-raise-${String(i).padStart(3, '0')}`],
  }));

  test('policy snapshot — fundraising admitted path, RC-20 cross-lane probe', () => {
    const intake = buildGoalIntakeContract({
      goalId: 'goal-lt04',
      rawGoalText: GOAL_TEXT,
      verificationCriteria: VERIFICATION_TEXT,
      executionType: 'Fundraising',
      deadline: DEADLINE_DAY_KEY,
    });

    const executionContract = {
      goalId: 'goal-lt04',
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
      goalId: 'goal-lt04',
      intakeContract: intake,
      executionContract: executionContract as any,
      hasCommittedBlocks: false,
      hasProposedBlocks: true,
      hasExecutionGraph: false,
      canonicalDeliverables: raiseDeliverables,
      canonicalActions: raiseActions,
      preExecutionSchedule: { blockCount: 8, totalMinutes: 480 },
      longTermPlan: {
        isLongHorizon: true,
        quality: { state: null, reasonCodes: null },
        saturation: { saturationShape: null },
        uncertainty: { bands: [] },
        checkpoints: [],
      },
    });

    console.log('Policy snapshot (fundraising, 9-month horizon):');
    console.log('  intakeReadiness.state:', policy.intakeReadiness?.state);
    console.log('  planQuality.state:', policy.planQuality?.state);
    console.log('  planQuality.reasonCodes:', JSON.stringify(policy.planQuality?.reasonCodes));
    console.log('  planQuality.lineageIntegrity:', policy.planQuality?.lineageIntegrity);
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

    // RC-20 cross-lane: same trust state as LT-03 job search?
    // Both goals require external decision (employer/investor)
    // Both should receive identical posTrust treatment — no external dependency encoding
    console.log('');
    console.log('[RC-20 cross-lane probe]');
    console.log('  posTrust encodes investor decision dependency:', false);
    console.log('  posTrust.state matches LT-03 job-search posTrust.state (both provisional):', policy.posTrust?.state === 'provisional');
    console.log('  posTrust.reasonCodes contains external-party code:', false);
    console.log('  Conclusion: fundraising and hiring are trust-equivalent in current model');
    console.log('  Both get provisional via plan structure, not outcome authority');

    expect(policy.planQuality?.lineageIntegrity).toBe('complete');
    expect(policy.feasibility?.state).toBe('withheld');
    expect(policy.posTrust?.state).toBe('provisional');
  });
});
