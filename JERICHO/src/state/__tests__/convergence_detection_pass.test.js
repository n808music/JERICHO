/**
 * Convergence Detection Pass — Acceptance & Integration Tests (Task 8, final)
 *
 * Validates the full detection pass wired up across Tasks 1-7:
 *  - detectConvergenceCandidates / updateConvergenceDetectionState (identityCompute.js)
 *  - the memoization guard in computeDerivedState()
 *  - the RESPOND_CONVERGENCE_DETECTION_QUESTION reducer case (identityStore.js)
 *  - buildConvergenceCandidateAdvisory() (convergenceCandidateAdvisory.js)
 *
 * 9 tests total: 4 acceptance criteria + 5 supplementary.
 *
 * Three corrections to the literal task-8-brief.md examples, made after direct
 * verification against the codebase (see inline notes at each site):
 *
 *  1. RESPOND_CONVERGENCE_DETECTION_QUESTION is handled inside `identityReducer`
 *     (src/state/identityStore.js), NOT inside `computeDerivedState`'s switch
 *     (src/state/identityCompute.js). Dispatching it via computeDerivedState()
 *     directly is a silent no-op (confirmed by direct test run). Tests 2 and 3
 *     dispatch it via `identityReducer` instead, which itself calls
 *     computeDerivedState() internally once the disposition is recorded.
 *
 *  2. UPDATE_DELIVERABLE (identityCompute.js `case 'UPDATE_DELIVERABLE'`) is the
 *     legacy cycle-scoped `deliverablesByCycleId` workspace mutator — it does not
 *     touch `matrix.deliverablesById` at all (confirmed by reading
 *     `updateDeliverable()`). The matrix reducer has no update action for
 *     deliverables, only DECLARE_DELIVERABLE / REMOVE_DELIVERABLE. Supplementary
 *     Test 2 therefore uses the brief's documented fallback: REMOVE_DELIVERABLE
 *     followed by a re-DECLARE_DELIVERABLE with the new targetDate.
 *
 *  3. computeDerivedState() unconditionally `structuredClone()`s the entire input
 *     state on every call (identityCompute.js line ~480), regardless of whether
 *     the convergence memoization guard skips detection. This was verified with
 *     a throwaway probe: pendingQuestions is a *new* array reference after every
 *     computeDerivedState() call, memoized or not, so comparing the pre-call
 *     `state.matrix.convergenceDetectionState.pendingQuestions` reference against
 *     the post-call one can never pass `toBe()` — it fails identically whether or
 *     not the guard actually fired. Supplementary Test 3 instead proves
 *     non-recomputation the way the source code's own `_internal` export is
 *     documented to be used ("Allows vi.spyOn(_internal, 'detectConvergenceCandidates')
 *     to prove the memoization guard...skips redundant runs" — see identityCompute.js):
 *     it spies on `_internal.detectConvergenceCandidates` and asserts zero calls,
 *     which is a strictly more direct proof of "detection did not rerun" than
 *     array identity could ever provide here.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildBlankIdentityState, identityReducer } from '../identityStore.js';
import { computeDerivedState, _internal } from '../identityCompute.js';

// ── Shared setup helpers ────────────────────────────────────────────────
// DECLARE_DELIVERABLE requires an existing owningProjectId AND owningInitiativeId
// (identityCompute.js `declareMatrixDeliverable`), DECLARE_PROJECT requires an
// existing owningEntityId + verificationSourceId, and DECLARE_INITIATIVE requires
// purpose/classification/doneWhen. Every test builds the same minimal prerequisite
// chain (verification source -> entity -> initiative -> project) under a unique
// suffix before declaring deliverables, so clusters never collide across tests.

function declarePrereqChain(state, suffix) {
  let s = computeDerivedState(state, {
    type: 'DECLARE_VERIFICATION_SOURCE',
    payload: { id: `vs-${suffix}`, domain: 'testing', source: 'manual_verification' },
  });
  s = computeDerivedState(s, {
    type: 'DECLARE_ENTITY',
    payload: {
      id: `entity-${suffix}`,
      name: `Entity ${suffix}`,
      roleTags: ['sponsor'],
      purpose: 'Test sponsor entity',
      formationState: 'founded',
      statusEvidence: 'Active operations',
    },
  });
  s = computeDerivedState(s, {
    type: 'DECLARE_INITIATIVE',
    payload: {
      id: `init-${suffix}`,
      name: `Initiative ${suffix}`,
      purpose: 'Test initiative purpose',
      classification: 'objective',
      doneWhen: 'All deliverables complete',
      owningEntityId: `entity-${suffix}`,
    },
  });
  s = computeDerivedState(s, {
    type: 'DECLARE_PROJECT',
    payload: {
      id: `proj-${suffix}`,
      name: `Project ${suffix}`,
      owningEntityId: `entity-${suffix}`,
      successMetric: 'Deliverables verified complete',
      verificationSourceId: `vs-${suffix}`,
      owningInitiativeId: `init-${suffix}`,
    },
  });
  return s;
}

function declareDeliverable(state, id, suffix, targetDate) {
  return computeDerivedState(state, {
    type: 'DECLARE_DELIVERABLE',
    payload: {
      id,
      name: `Deliverable ${id}`,
      owningInitiativeId: `init-${suffix}`,
      owningProjectId: `proj-${suffix}`,
      targetDate,
      requiredBlocks: 1,
    },
  });
}

describe('Convergence Detection Pass', () => {
  let state;

  beforeEach(() => {
    state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ACCEPTANCE CRITERION 1: Operator Asked Exactly Once Per Cluster
  // ═══════════════════════════════════════════════════════════════════════

  it('should surface each shared-deadline cluster exactly once', () => {
    let s = declarePrereqChain(state, '1');
    s = declareDeliverable(s, 'd1', '1', '2026-09-15');
    s = declareDeliverable(s, 'd2', '1', '2026-09-15');

    expect(s.lastPlanError).toBeFalsy();

    const detection = s.matrix.convergenceDetectionState;
    expect(detection.pendingQuestions).toHaveLength(1);

    const question = detection.pendingQuestions[0];
    expect(question.sourceIds).toEqual(['d1', 'd2']);
    expect(question.targetDate).toBe('2026-09-15');
    expect(typeof question.id).toBe('string');
    expect(question.id.length).toBeGreaterThan(0);
    expect(detection.answered).toEqual({});
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ACCEPTANCE CRITERION 2: "No" (DeadlineAlignment) Permanently Recorded
  // ═══════════════════════════════════════════════════════════════════════

  it('should record DeadlineAlignment disposition and never re-ask', () => {
    let s = declarePrereqChain(state, '2');
    s = declareDeliverable(s, 'd3', '2', '2026-09-20');
    s = declareDeliverable(s, 'd4', '2', '2026-09-20');

    const questionId = s.matrix.convergenceDetectionState.pendingQuestions[0].id;

    // RESPOND_CONVERGENCE_DETECTION_QUESTION lives in identityReducer, not in
    // computeDerivedState's own switch — see file-header note (1).
    s = identityReducer(s, {
      type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
      payload: { questionId, disposition: 'DeadlineAlignment' },
    });

    expect(s.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
    expect(s.matrix.convergenceDetectionState.answered[questionId]).toEqual({
      disposition: 'DeadlineAlignment',
      recordedAtISO: expect.any(String),
    });
    expect(s.ui?.navigationIntent).toBeFalsy();

    // Re-running derived-state computation must not resurrect the question.
    s = computeDerivedState(s, { type: 'NO_OP' });
    expect(s.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
    expect(s.matrix.convergenceDetectionState.answered[questionId].disposition).toBe(
      'DeadlineAlignment'
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ACCEPTANCE CRITERION 3: "Yes" (Declared) Routes to Forward-Declaration
  // ═══════════════════════════════════════════════════════════════════════

  it('should set navigation intent on Declared without creating edge', () => {
    let s = declarePrereqChain(state, '3');
    s = declareDeliverable(s, 'd5', '3', '2026-09-25');
    s = declareDeliverable(s, 'd6', '3', '2026-09-25');

    const questionId = s.matrix.convergenceDetectionState.pendingQuestions[0].id;

    s = identityReducer(s, {
      type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
      payload: { questionId, disposition: 'Declared' },
    });

    expect(s.matrix.convergenceDetectionState.answered[questionId]).toEqual({
      disposition: 'Declared',
      recordedAtISO: expect.any(String),
    });

    expect(s.ui.navigationIntent).toBeDefined();
    expect(s.ui.navigationIntent.route).toBe('#/forward-declaration');
    expect(s.ui.navigationIntent.prefilledConvergence.sourceIds).toEqual(['d5', 'd6']);
    expect(s.ui.navigationIntent.prefilledConvergence.targetDate).toBe('2026-09-25');
    expect(s.ui.navigationIntent.prefilledConvergence.detectionQuestionId).toBe(questionId);

    // "Declared" only sets navigation intent — no convergence edge is created here.
    expect(s.matrix.convergenceEdgesById).toEqual({});
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ACCEPTANCE CRITERION 4: Dependency-Excluded Pairs Never Surfaced
  // ═══════════════════════════════════════════════════════════════════════

  it('should exclude pairs with sequential dependencies from detection', async () => {
    let s = declarePrereqChain(state, '4');
    s = declareDeliverable(s, 'd7', '4', '2026-09-30');

    // The dependency must exist BEFORE the second deliverable forms the cluster:
    // updateConvergenceDetectionState's stale-pruning only re-validates an
    // already-pending question's source-existence and targetDate, not whether a
    // dependency was added after the fact (that is a real Task 4 gap, out of
    // scope for this suite) — so declaring d8 first and then the dependency would
    // leave the already-surfaced question in place. Declaring the dependency
    // first means the cluster is correctly excluded from the moment it is first
    // detected. DECLARE_DEPENDENCY only accepts project/initiative/artifact node
    // ids (DEPENDENCY_NODE_SLICES), not deliverables, so the edge is injected
    // directly; detectConvergenceCandidates reads matrix.dependenciesById raw,
    // with no opinion on how it got there.
    s.matrix.dependenciesById['dep-d7-d8'] = {
      id: 'dep-d7-d8',
      upstreamId: 'd7',
      downstreamId: 'd8',
      type: 'hard_gate',
      label: null,
      declaredAtISO: s.appTime.nowISO,
    };

    s = declareDeliverable(s, 'd8', '4', '2026-09-30');

    expect(s.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);

    const { buildConvergenceCandidateAdvisory } = await import('../convergenceCandidateAdvisory.js');
    expect(buildConvergenceCandidateAdvisory(s)).toBeNull();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 1: Stale Question Pruning (Source Deleted)
  // ═══════════════════════════════════════════════════════════════════════

  it('should delete questions when source is removed', () => {
    let s = declarePrereqChain(state, '5');
    s = declareDeliverable(s, 'd9', '5', '2026-10-01');
    s = declareDeliverable(s, 'd10', '5', '2026-10-01');

    expect(s.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(1);

    s = computeDerivedState(s, {
      type: 'REMOVE_DELIVERABLE',
      payload: { id: 'd9' },
    });

    expect(s.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 2: Stale Question Pruning (Date Changed)
  // ═══════════════════════════════════════════════════════════════════════

  it('should delete questions when targetDate changes on a source', () => {
    let s = declarePrereqChain(state, '6');
    s = declareDeliverable(s, 'd11', '6', '2026-10-05');
    s = declareDeliverable(s, 'd12', '6', '2026-10-05');

    expect(s.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(1);

    // UPDATE_DELIVERABLE mutates the legacy deliverablesByCycleId workspace, not
    // matrix.deliverablesById — see file-header note (2). Use the brief's documented
    // fallback: REMOVE_DELIVERABLE then re-DECLARE_DELIVERABLE with the new date.
    s = computeDerivedState(s, {
      type: 'REMOVE_DELIVERABLE',
      payload: { id: 'd11' },
    });
    s = declareDeliverable(s, 'd11', '6', '2026-10-10');

    expect(s.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(0);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 3: Memoization Guard
  // ═══════════════════════════════════════════════════════════════════════

  it('should not recompute detection when matrix data unchanged', () => {
    let s = declarePrereqChain(state, '7');
    s = declareDeliverable(s, 'd13', '7', '2026-10-15');
    s = declareDeliverable(s, 'd14', '7', '2026-10-15');

    const hashBefore = s.matrix.convergenceDetectionState.lastComputedFrom;
    const pendingBefore = s.matrix.convergenceDetectionState.pendingQuestions;

    // See file-header note (3): computeDerivedState() structuredClone()s the whole
    // state on every call, so array-reference identity across the call boundary
    // cannot itself prove the guard fired — it would fail identically whether or
    // not detection reran. Spy on the exact hook identityCompute.js exports for
    // this purpose instead.
    const spy = vi.spyOn(_internal, 'detectConvergenceCandidates');

    const nextState = computeDerivedState(s, { type: 'NO_OP' });

    expect(spy).not.toHaveBeenCalled();
    expect(nextState.matrix.convergenceDetectionState.lastComputedFrom).toEqual(hashBefore);
    expect(nextState.matrix.convergenceDetectionState.pendingQuestions).toEqual(pendingBefore);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 4: Deterministic Question ID
  // ═══════════════════════════════════════════════════════════════════════

  it('should generate same questionId for same cluster across runs', () => {
    const buildClusterState = () => {
      let s = buildBlankIdentityState();
      s.appTime = { nowISO: '2026-08-06T10:00:00Z' };
      s = declarePrereqChain(s, '8');
      s = declareDeliverable(s, 'd15', '8', '2026-10-20');
      s = declareDeliverable(s, 'd16', '8', '2026-10-20');
      return s;
    };

    const state1 = buildClusterState();
    const state2 = buildClusterState();

    expect(state1.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(1);
    expect(state2.matrix.convergenceDetectionState.pendingQuestions).toHaveLength(1);

    const id1 = state1.matrix.convergenceDetectionState.pendingQuestions[0].id;
    const id2 = state2.matrix.convergenceDetectionState.pendingQuestions[0].id;

    expect(id1).toBe(id2);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 5: No Duplicate Questions
  // ═══════════════════════════════════════════════════════════════════════

  it('should not create duplicate questions if same cluster detected again', () => {
    let s = declarePrereqChain(state, '9');
    s = declareDeliverable(s, 'd17', '9', '2026-10-25');
    s = declareDeliverable(s, 'd18', '9', '2026-10-25');

    const countAfterFirst = s.matrix.convergenceDetectionState.pendingQuestions.length;
    expect(countAfterFirst).toBe(1);

    s = computeDerivedState(s, { type: 'NO_OP' });

    const countAfterSecond = s.matrix.convergenceDetectionState.pendingQuestions.length;
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTARY TEST 6: Cluster Supersession Pruning
  // ═══════════════════════════════════════════════════════════════════════
  //
  // When a cluster grows (e.g., dc1+dc2 exists, then dc3 joins to form
  // dc1+dc2+dc3), the older smaller-cluster question should be pruned, not
  // preserved as a duplicate. This test reproduces the issue discovered by
  // the independent review subagent during Task 8 verification.

  it('should prune smaller clusters when larger clusters with same members are detected', () => {
    // SETUP: Create dc1 + dc2 sharing targetDate
    let s = declarePrereqChain(state, 'super');
    s = declareDeliverable(s, 'dc1', 'super', '2026-11-15');
    s = declareDeliverable(s, 'dc2', 'super', '2026-11-15');

    // STEP 1: Verify the 2-member cluster generates exactly one pending question
    const pending1 = s.matrix.convergenceDetectionState.pendingQuestions;
    expect(pending1).toHaveLength(1);
    expect(pending1[0].sourceIds).toEqual(['dc1', 'dc2']);
    const oldQuestionId = pending1[0].id;

    // STEP 2: Add dc3 to the same targetDate
    s = declareDeliverable(s, 'dc3', 'super', '2026-11-15');

    // STEP 3: Verify the 3-member cluster is detected AND the 2-member
    // question is pruned (not duplicated)
    const pending2 = s.matrix.convergenceDetectionState.pendingQuestions;
    expect(pending2).toHaveLength(1, 'Should have exactly 1 pending question, not 2');
    expect(pending2[0].sourceIds).toEqual(['dc1', 'dc2', 'dc3']);

    // STEP 4: Confirm the old 2-member question is completely gone (not just
    // moved to answered)
    const answerMap = s.matrix.convergenceDetectionState.answered || {};
    expect(answerMap[oldQuestionId]).toBeUndefined(
      'Old question should not be in answered (pruned outright, not marked as answered)'
    );
  });
});
