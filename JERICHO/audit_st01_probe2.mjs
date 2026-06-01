import { buildGoalIntakeContract } from './src/domain/goal/GoalIntakeContract.ts';
import { buildAutoDeliverablesFromGoalContract } from './src/domain/autoStrategy.ts';
import { generateAutoDeliverables } from './src/core/autoDeliverables.ts';
import { buildGoalPolicySnapshot } from './src/domain/goal/GoalPolicy.ts';

const goalContract = {
  goalId: 'goal-st01-ep',
  goalLabel: 'Finish and release a polished 3-song EP',
  goalText: 'Finish and release a polished 3-song EP',
  terminalOutcome: {
    text: 'A polished 3-song EP is recorded, mixed, mastered, and released on streaming platforms',
    verificationCriteria: '3 songs fully recorded, mixed, mastered, and live on at least 2 streaming platforms',
    isConcrete: true,
  },
  deadline: { dayKey: '2026-05-20', isHardDeadline: true },
  startDayKey: '2026-04-05',
  startDateISO: '2026-04-05T00:00:00.000Z',
  executionType: 'CreativeProduction',
  workWindows: {
    mon: [{ start: '18:00', end: '21:00' }],
    tue: [{ start: '18:00', end: '21:00' }],
    wed: [],
    thu: [{ start: '18:00', end: '21:00' }],
    fri: [],
    sat: [{ start: '10:00', end: '14:00' }],
    sun: [{ start: '10:00', end: '14:00' }],
  },
};

const intake = buildGoalIntakeContract({
  goalId: 'goal-st01-ep',
  rawGoalText: 'Finish and release a polished 3-song EP',
  verificationCriteria: '3 songs fully recorded, mixed, mastered, and live on at least 2 streaming platforms',
  executionType: 'CreativeProduction',
  deadline: '2026-05-20',
});

console.log('=== INTAKE CONTRACT ===');
console.log('readiness.state:', intake.readiness?.state);
console.log('readiness.isReadyForPlanning:', intake.readiness?.isReadyForPlanning);
console.log('readiness.blockingReasons:', JSON.stringify(intake.readiness?.blockingReasons));
console.log('readiness.assumptionReasons:', JSON.stringify(intake.readiness?.assumptionReasons));
console.log('completionBoundaryStatus:', intake.completionBoundaryStatus);
console.log('scopePolicy.required:', JSON.stringify(intake.scopePolicy?.required));
console.log('scopePolicy.assumptionsNeedingConfirmation:', JSON.stringify(intake.scopePolicy?.assumptionsNeedingConfirmation));

// Primary generation path
const primaryDelivs = generateAutoDeliverables(goalContract);
console.log('\n=== PRIMARY PATH (generateAutoDeliverables) ===');
primaryDelivs.forEach((d, i) => {
  console.log(`[D${i+1}] id=${d.id}`);
  console.log(`       title="${d.title}"`);
  console.log(`       requiredBlocks=${d.requiredBlocks} actionIds=${JSON.stringify(d.actionIds)}`);
  if (d.actions?.length) {
    d.actions.forEach((a, j) => {
      console.log(`       [A${j+1}] title="${a.title}" type=${a.actionType}`);
    });
  }
});

// Fallback (Phase 1) path — correct signature
const fallbackResult = buildAutoDeliverablesFromGoalContract(goalContract, '2026-04-05', 'UTC');
console.log('\n=== FALLBACK PATH (buildAutoDeliverablesFromGoalContract) ===');
console.log('detectedType:', fallbackResult.detectedType);
console.log('rationale:', fallbackResult.rationale);
fallbackResult.deliverables.forEach((d, i) => {
  console.log(`[D${i+1}] title="${d.title}" requiredBlocks=${d.requiredBlocks}`);
});

// Both paths produce same deliverables for this goal?
console.log('\n=== PATH AGREEMENT ===');
const primaryTitles = primaryDelivs.map(d => d.title);
const fallbackTitles = fallbackResult.deliverables.map(d => d.title);
console.log('Same count:', primaryTitles.length === fallbackTitles.length);
primaryTitles.forEach((t, i) => console.log(`  P[${i}]: "${t}" | F[${i}]: "${fallbackTitles[i]}"`));

// Policy snapshot — no actions (deterministic path)
const policyNoActions = buildGoalPolicySnapshot({
  goalId: 'goal-st01-ep',
  intakeContract: intake,
  executionContract: goalContract,
  hasCommittedBlocks: false,
  hasProposedBlocks: true,   // after generatePlan, blocks exist
  hasExecutionGraph: false,  // no LLM action graph
  canonicalActions: [],       // no actions in deterministic path
  canonicalDeliverables: primaryDelivs,
  planProof: null,
  probabilityStatus: 'disabled',
  feasibilityStatus: null,
  preExecutionSchedule: { blockCount: 15, totalMinutes: 900 }, // ~15 blocks after schedule gen
  longTermPlan: null,
});

console.log('\n=== GOAL POLICY — NO ACTIONS (deterministic path) ===');
console.log('intakeReadiness.state:', policyNoActions.intakeReadiness.state);
console.log('intakeReadiness.assumptions:', JSON.stringify(policyNoActions.intakeReadiness.assumptions));
console.log('planQuality.state:', policyNoActions.planQuality.state);
console.log('planQuality.structuralState:', policyNoActions.planQuality.structuralState);
console.log('planQuality.structuralReasonCodes:', JSON.stringify(policyNoActions.planQuality.structuralReasonCodes));
console.log('planQuality.actionTypeCoverage:', policyNoActions.planQuality.actionTypeCoverage);
console.log('planQuality.lineageIntegrity:', policyNoActions.planQuality.lineageIntegrity);
console.log('planQuality.inspectability:', policyNoActions.planQuality.inspectability);
console.log('planQuality.dependencyReadinessCoverage:', policyNoActions.planQuality.dependencyReadinessCoverage);
console.log('planQuality.assumptionBurden:', policyNoActions.planQuality.assumptionBurden);
console.log('planQuality.endpointClarity:', policyNoActions.planQuality.endpointClarity);
console.log('planQuality.startingPointHonesty:', policyNoActions.planQuality.startingPointHonesty);
console.log('planQuality.reasonCodes:', JSON.stringify(policyNoActions.planQuality.reasonCodes));
console.log('feasibility.state:', policyNoActions.feasibility.state);
console.log('feasibility.structuralSupport:', policyNoActions.feasibility.structuralSupport);
console.log('feasibility.scheduleFit:', policyNoActions.feasibility.scheduleFit);
console.log('feasibility.capacitySupport:', policyNoActions.feasibility.capacitySupport);
console.log('feasibility.assumptionBurden:', policyNoActions.feasibility.assumptionBurden);
console.log('feasibility.reasonCodes:', JSON.stringify(policyNoActions.feasibility.reasonCodes));
console.log('posTrust.state:', policyNoActions.posTrust.state);
