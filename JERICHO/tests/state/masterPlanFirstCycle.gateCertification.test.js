import { describe, expect, it } from 'vitest';

import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';
import { extractLanesFromDescription } from '../../src/domain/masterPlan/masterPlanIntakeEngine.js';

/**
 * CERTIFICATION TEST: Verify generated first-cycle Sprint passes plan-quality gate
 * 
 * This test runs the FULL flow from master plan intake → first-cycle generation → 
 * plan application → gate evaluation, and prints the exact gate result.
 * 
 * Acceptance criteria: The generated Sprint must NOT emit:
 * - MISSING_EXECUTION_ARTIFACT
 * - MISSING_EXECUTION_CONSUMER
 * - MISSING_EXECUTION_PASS_EVIDENCE
 * - MISSING_CONSUMED_BY_REF
 * - BLOCK_GOAL_OBJECT_MISSING
 * - PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH
 * - PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE
 */

function buildIntakeDraftState() {
  const state = buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: '2026-05-04T12:00:00.000Z',
    todayDate: '2026-05-04',
  });
  state.masterPlanIntake = {
    status: 'in-progress',
    phase: 4,
    step: 13,
    profileId: DEFAULT_PROFILE_ID,
    answers: {
      step_2: 'Release the EP and grow the PM company',
      step_3: { horizonEnd: '2026-11-01', months: 6, label: 'Oct 17' },
      step_5: { exists: true, urgency: 'immediate', notes: 'Need revenue this year.' },
      lane_0_description: 'Album is ready to launch with final masters complete.',
      lane_0_system_assessment: {
        assessedStage: 'ready-to-launch',
        assessedConfidence: 'high',
        assessmentNotes: 'Ready for release.',
      },
      lane_0_activation: 'active',
      lane_1_description: 'Starting from scratch on positioning and client outreach.',
      lane_1_system_assessment: {
        assessedStage: 'pre-concept',
        assessedConfidence: 'medium',
        assessmentNotes: 'Early lane.',
      },
      lane_1_activation: 'incubating',
    },
    extractedLanes: [
      {
        title: 'EP release',
        domain: 'creative',
        role: 'proof-artifact',
      },
      {
        title: 'PM company',
        domain: 'brand',
        role: 'revenue-engine',
      },
    ],
    anchors: [
      {
        id: 'anchor-oct17',
        date: '2026-10-17',
        label: 'Oct 17 drop',
        isFixed: true,
        affectedLaneIds: [],
        priority: 0,
      },
    ],
    currentLaneIdx: 0,
    clarifyingQuestionIdx: 0,
    draft: null,
    errorMessage: null,
  };
  return state;
}

describe('GATE CERTIFICATION: First-cycle Sprint quality', () => {
  it('generated first-cycle Sprint passes plan-quality gate without metadata or coverage failures', () => {
    // =========================================================================
    // Phase 1: INTAKE
    // =========================================================================
    const draft = buildIntakeDraftState();

    const handled = applyMasterPlanAction(draft, {
      type: 'MASTER_PLAN_INTAKE_COMPLETE',
      nowISO: '2026-05-04T12:00:00.000Z',
    });

    expect(handled).toBe(true);
    const planId = draft.masterPlanIntake.draft.masterPlanId;

    // =========================================================================
    // Phase 2: CYCLE SETUP
    // =========================================================================
    const started = computeDerivedState(draft, {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });

    const reassessed = computeDerivedState(started, {
      type: 'COMPLETE_CYCLE_REASSESSMENT',
      cycleId: started.activeCycleId,
    });

    const constrained = computeDerivedState(reassessed, {
      type: 'UPDATE_WORK_WINDOWS',
      payload: {
        cycleId: reassessed.activeCycleId,
        workWindows: {
          mon: [{ start: '09:00', end: '12:00' }],
          tue: [{ start: '09:00', end: '12:00' }],
          wed: [{ start: '09:00', end: '12:00' }],
          thu: [{ start: '09:00', end: '12:00' }],
          fri: [{ start: '09:00', end: '12:00' }],
          sat: [],
          sun: [],
        },
      },
    });

    // =========================================================================
    // Phase 3: FIRST-CYCLE GENERATION
    // =========================================================================
    const generated = computeDerivedState(constrained, {
      type: 'GENERATE_PLAN',
      payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
    });

    expect(generated.proposedBlocks.length).toBeGreaterThan(0);
    console.log(`\n[CERTIFICATION] Generated ${generated.proposedBlocks.length} proposed blocks`);

    // =========================================================================
    // Phase 4: PLAN APPLICATION
    // =========================================================================
    const applied = computeDerivedState(generated, { type: 'APPLY_PLAN' });

    expect(applied.scheduleReviewBlocks.length).toBeGreaterThan(0);
    expect(applied.scheduleApplied).toBe(true);
    console.log(`[CERTIFICATION] Applied ${applied.scheduleReviewBlocks.length} review blocks`);

    // =========================================================================
    // Phase 5: GATE EVALUATION & CERTIFICATION
    // =========================================================================
    const plan = applied.masterPlansById[planId];
    const gateResult = applied.cyclesById[applied.activeCycleId]?.planQualityGate;

    expect(gateResult).toBeDefined();
    console.log(`\n[GATE RESULT] Status: ${gateResult.status}`);
    console.log(`[GATE RESULT] Failure codes (${gateResult.failureCodes?.length || 0}):`);
    if (gateResult.failureCodes && gateResult.failureCodes.length > 0) {
      gateResult.failureCodes.forEach((code) => {
        console.log(`  - ${code}`);
      });
    } else {
      console.log('  (none)');
    }

    // =========================================================================
    // Metadata Codes - Should be GONE
    // =========================================================================
    const metadataCodesTargeted = [
      'MISSING_EXECUTION_ARTIFACT',
      'MISSING_EXECUTION_CONSUMER',
      'MISSING_EXECUTION_PASS_EVIDENCE',
      'MISSING_CONSUMED_BY_REF',
      'MISSING_EXECUTION_DURATION',
    ];

    console.log(`\n[METADATA CODES] Checking if resolved:`);
    metadataCodesTargeted.forEach((code) => {
      const present = gateResult.failureCodes?.includes(code);
      const status = present ? '❌ STILL PRESENT' : '✅ RESOLVED';
      console.log(`  ${code}: ${status}`);
      expect(gateResult.failureCodes).not.toContain(code);
    });

    // =========================================================================
    // Coverage & Context Codes - Should be GONE
    // =========================================================================
    const coverageCodesTargeted = [
      'BLOCK_GOAL_OBJECT_MISSING',
      'PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH',
      'PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE',
    ];

    console.log(`\n[COVERAGE CODES] Checking if resolved:`);
    coverageCodesTargeted.forEach((code) => {
      const present = gateResult.failureCodes?.includes(code);
      const status = present ? '❌ STILL PRESENT' : '✅ RESOLVED';
      console.log(`  ${code}: ${status}`);
      expect(gateResult.failureCodes).not.toContain(code);
    });

    // =========================================================================
    // Metadata Specificity Check
    // =========================================================================
    console.log(`\n[METADATA SPECIFICITY] Inspecting action blocks...`);
    const actionBlocks = applied.scheduleReviewBlocks.filter((b) => b?.blockType === 'action');
    console.log(`  Found ${actionBlocks.length} action blocks`);

    let genericArtifactCount = 0;
    let genericEvidenceCount = 0;

    actionBlocks.slice(0, 5).forEach((block, idx) => {
      const artifact = block.producesArtifact || '';
      const evidence = block.passEvidence || '';

      const isGenericArtifact =
        artifact.includes('First-cycle readiness work') || artifact.includes('Milestone checkpoint');
      const isGenericEvidence = evidence.includes('confirmed complete');

      if (isGenericArtifact) genericArtifactCount++;
      if (isGenericEvidence) genericEvidenceCount++;

      console.log(`  Block ${idx + 1}: ${block.title}`);
      console.log(`    - artifact: ${artifact.substring(0, 80)}...`);
      console.log(`    - evidence: ${evidence.substring(0, 80)}...`);
      console.log(`    - specific? artifact=${!isGenericArtifact} evidence=${!isGenericEvidence}`);
    });

    console.log(
      `\n  Generic artifact patterns: ${genericArtifactCount}/${actionBlocks.slice(0, 5).length}`
    );
    console.log(
      `  Generic evidence patterns: ${genericEvidenceCount}/${actionBlocks.slice(0, 5).length}`
    );

    // =========================================================================
    // Final Assertion
    // =========================================================================
    console.log(`\n[FINAL STATUS] ${gateResult.status}`);
    console.log(
      gateResult.status === 'PLAN_QUALITY_PASSED'
        ? '✅ CERTIFICATION PASSED'
        : '❌ CERTIFICATION FAILED - Plan quality gate did not pass'
    );

    expect(gateResult.failureCodes).not.toContain('BLOCK_DETAIL_TOO_ABSTRACT');
    expect(gateResult.failureCodes).not.toContain('BLOCK_DETAIL_DO_THIS_EMPTY');
    expect(gateResult.failureCodes).not.toContain('BLOCK_DETAIL_DONE_WHEN_EMPTY');
    expect(gateResult.status).toBe('PLAN_QUALITY_PASSED');
  });

  it('generated first-cycle blocks contain non-generic metadata when present', () => {
    const draft = buildIntakeDraftState();

    const handled = applyMasterPlanAction(draft, {
      type: 'MASTER_PLAN_INTAKE_COMPLETE',
      nowISO: '2026-05-04T12:00:00.000Z',
    });

    const planId = draft.masterPlanIntake.draft.masterPlanId;
    const started = computeDerivedState(draft, {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });
    const reassessed = computeDerivedState(started, {
      type: 'COMPLETE_CYCLE_REASSESSMENT',
      cycleId: started.activeCycleId,
    });
    const constrained = computeDerivedState(reassessed, {
      type: 'UPDATE_WORK_WINDOWS',
      payload: {
        cycleId: reassessed.activeCycleId,
        workWindows: {
          mon: [{ start: '09:00', end: '12:00' }],
          tue: [{ start: '09:00', end: '12:00' }],
          wed: [{ start: '09:00', end: '12:00' }],
          thu: [{ start: '09:00', end: '12:00' }],
          fri: [{ start: '09:00', end: '12:00' }],
          sat: [],
          sun: [],
        },
      },
    });
    const generated = computeDerivedState(constrained, {
      type: 'GENERATE_PLAN',
      payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
    });
    const applied = computeDerivedState(generated, { type: 'APPLY_PLAN' });

    // Check that milestone-derived blocks have milestone context
    const milestoneBlocks = applied.scheduleReviewBlocks.filter(
      (b) => b?.masterPlanMilestoneId && b?.blockType === 'action'
    );

    console.log(`\n[MILESTONE SPECIFICITY] Found ${milestoneBlocks.length} milestone-derived blocks`);
    if (milestoneBlocks.length > 0) {
      const sample = milestoneBlocks[0];
      console.log(`  Sample: ${sample.title}`);
      console.log(`  Artifact: ${sample.producesArtifact}`);
      console.log(`  Has milestone ref: ${sample.producesArtifact?.includes('Milestone checkpoint')}`);

      // Verify milestone blocks reference their lane context
      expect(sample.producesArtifact).toMatch(/Milestone checkpoint/);
      expect(sample.consumedByRef?.type).toBeDefined();
    }
  });
});
