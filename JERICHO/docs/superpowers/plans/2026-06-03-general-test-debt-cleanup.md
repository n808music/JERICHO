# General Test Debt Cleanup

**Status:** Backlog. Triage on demand only.
**Created:** 2026-06-03
**Source:** Residual test failures observed after Plan Quality Remediation initiative closed (commit `7292769`).

## Scope boundary

This initiative is **explicitly separate from Plan Quality Remediation**, which closed when a fresh Operation Endgame plan started producing `PLAN_QUALITY_PASSED` with 0 plan-quality failure codes (PR #10). Do **not** roll any of the items below into Plan Quality work — completion criteria must not expand after completion.

## Snapshot at close

23 failing tests on `main` at `7292769`. None are plan-quality regressions; the engine itself passes its own gate cleanly. These are pre-existing test debt in unrelated areas.

## Clusters

### 1. Cycle lifecycle stale fixture failures (11 tests)

- `tests/state/cycle.archive_review_mode.test.js` (1)
- `tests/state/cycle.delete_clears_active.test.js` (1)
- `tests/state/cycle.ux.test.js` (3)
- `tests/state/identityCycles.test.js` (3)
- `tests/state/startNewCycleWithDecision.lifecycle.test.js` (2)
- `tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx` (2)

**Root cause:** test fixtures create an `activeCycleId` without an associated goal. The reducer now enforces `ACTIVE_CYCLE_GOAL_MISSING` orphan invariant. Cycles get orphaned; downstream assertions about `today.blocks`, `activeCycleId`, etc. then fail.

**Required fix:** update each test's setup helper to include a minimal goal contract alongside the active cycle. No engine changes needed.

### 2. autoAsana title expectation conflict (5 tests)

- `src/state/__tests__/autoAsana.scheduler.v1_1.test.js` (2 — prefer deliverable titles)
- `tests/state/autoAsanaPlan.distribution.spread.test.ts` (3 — rewrite commercial shell titles into operational steps)

**Root cause:** two test families assert opposite intents about the same title-rewriter. One expects user-supplied `deliverableTitle` ("Film episode 1") used verbatim; the other expects the engine to rewrite shell action titles ("Resolve gum formula…") into specific multi-step operational sequences. Naive fixes to one set break the other.

**Required fix:** product judgment on title-rewriter precedence. When should the engine respect user-supplied deliverable titles vs. when should it rewrite for operational specificity? A documented rule, then both test sets aligned to it.

### 3. Local-only gitignored fixture snapshots (2 tests)

- `src/components/zion/ExportFullScheduleButton.test.jsx`
- `src/domain/masterPlan/exportFullHorizonSchedule.test.js`

**Root cause:** both gated on `tmp-live-jericho-identity.json` (gitignored, only present locally). The fixture was captured before Phase 5 descriptor additions; agenda hashes have drifted. **Both auto-skip in CI**.

**Required fix:** regenerate the local fixture from the current engine output, or `git rm -f` it from local working tree. No commit to repo needed.

### 4. AppShell routing (already in cluster 1, listed for completeness)

The two `AppShell.onboardingToGoalAdmission.flow.test.jsx` failures share the same `ACTIVE_CYCLE_GOAL_MISSING` setup issue from cluster 1.

### 5. BlockColumn UI (1 test)

- `tests/components/BlockColumn.selection.test.jsx`

**Root cause:** unknown. UI selection-press assertion. Investigate as a one-off when UI work next touches block columns.

### 6. Regulated consumable acceptance (1 test)

- `tests/state/regulatedConsumable.energyGum.acceptance.test.ts`

**Root cause:** asserts a generated plan matches a specific Illinois white-label founder template. Failure mode unknown without investigation. Likely a plan-generator template specialization that has drifted.

### 7. Podcast full-plan apply (1 test)

- `tests/state/podcast.fullPlan.apply.test.js`

**Root cause:** unknown. Asserts the full generated proposal set is committed across the horizon. Likely related to either the autoAsana cluster #2 conflict or the cycle cluster #1 setup issue.

### 8. masterPlanBlockDisplayProjection (1 test)

- `tests/state/masterPlanBlockDisplayProjection.test.js`

**Root cause:** asserts canonical titles remain trusted even when display titles are compressed. Possibly related to my Phase 5/8 title changes; needs verification.

## Triage policy

**Default:** do nothing.

**Only tackle when:**
- A specific failure cluster is blocking active feature work on its surface (e.g., touching cycle code → fix cycle fixtures first).
- The user explicitly requests a cluster.

**Do not:**
- Treat this as a "finish all tests" backlog.
- Bundle these fixes into any other initiative's PR.
- Update assertions without understanding the test's intent — several of these have legitimate product questions behind them (cluster 2 especially).

## Reference: Plan Quality Remediation closure

The closed initiative shipped:
- PR #6 — Phases 1-4 (outcome target, owners, gate criteria) → `6a6d159`
- PR #7 — Phases 5-8 (BD mechanics, ratio, active-cycle gate, regression) → `ccf0c72`
- PR #8 — Descriptor pool cleanup → `ed0369a`
- PR #9 — Cycle-creation rebase → `4a6864c`
- PR #10 — Engine produces clean `PLAN_QUALITY_PASSED` → `2232869`
- PR #11 — Verb vocabulary unification → `0ee53a9`
- PR #12 — Lane-level gating + snapshot updates → `7292769`

Engine self-audit at close: fresh 1,081-block Operation Endgame plan returns `PLAN_QUALITY_PASSED` with 0 failure codes.
