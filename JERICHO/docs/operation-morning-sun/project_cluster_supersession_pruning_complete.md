---
name: cluster-supersession-pruning-complete
description: Cluster supersession pruning fixes merged to main (Task 8 follow-up)
metadata: 
  node_type: memory
  type: project
  originSessionId: c2ba0b68-a223-478b-a9a8-92cd67c23295
  modified: 2026-08-07T15:39:06.277Z
---

# Cluster Supersession Pruning Fixes — Merged to Main

**Status:** COMPLETE — Merged 2026-08-07

**Commits:**
- `7c200b9`: Initial fix (old pending vs new candidates)
- `299b7d6`: Complete fix (pending-vs-pending case)

## Background

Independent review of Task 8 (convergence detection pass) during verification discovered a defect in `updateConvergenceDetectionState()`: when a cluster grows (e.g., `{dc1, dc2}` → `{dc1, dc2, dc3}`), the old smaller-cluster question was retained alongside the new larger-cluster question, producing duplicate advisory prompts to the operator.

## The Fix

Three filter passes now cover all reachable comparison directions:

1. **validQuestionsDeduped** (lines 367–376): old pending vs other old pending
   - Handles: two pending questions from prior passes, one subset of the other, no new detection this pass
   - Example: Q1=[dc1,dc2], Q2=[dc1,dc2,dc3] both exist → Q1 pruned

2. **prunedValidQuestions** (lines 383–391): old pending vs new candidates
   - Handles: newly-detected larger cluster subsumes existing pending question
   - Example: Detect {dc1,dc2,dc3} while Q1=[dc1,dc2] pending → Q1 pruned

3. **finalNewQuestions** (lines 396–405): new candidate vs other new candidates
   - Handles: multiple clusters detected same pass, smaller subset of larger
   - Example: Detect both {dc1,dc2} and {dc1,dc2,dc3} same pass → {dc1,dc2} pruned

**Invariant confirmed:** `detectConvergenceCandidates()` groups all nodes for a targetDate into one cluster (never emits multiple differently-sized subsets). Fourth case (new smaller than old) is unreachable.

## Test Coverage

- **Supp-6:** Cluster growth case (dc1+dc2 → dc1+dc2+dc3 detection triggers pruning)
- **Supp-7:** Pending-vs-pending case (both from prior passes, direct updateConvergenceDetectionState call)
- **Full suite:** 344/355 PASS (11 pre-existing failures, zero new regressions)
- **convergence_detection_pass.test.js:** 11/11 PASS

## Verification Process

1. Initial fix (7c200b9) + test Supp-6: all existing tests pass, 1 new test, no regressions
2. Independent code review flagged missing pending-vs-pending case
3. Complete fix (299b7d6) + test Supp-7: all existing tests pass, +1 new test, no regressions
4. Invariant check: confirmed detection cannot emit multiple differently-sized clusters for same targetDate
5. Merged to main (fast-forward)

## Note

This is a follow-up to Task 8 of the convergence detection pass implementation. The original implementation (Tasks 1–7) was verified complete; Task 8's independent review discovered this gap during test verification. The gap was addressed in-place on execution-readiness-wip, verified independently, and merged complete.
