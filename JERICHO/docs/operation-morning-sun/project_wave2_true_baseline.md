---
name: project_wave2_true_baseline
description: "True full-suite baseline at 5a1e50b is 29 fail + 1 suite error, not 27+1; Wave 2 regressed 2 generatePlan.calendarIntegration tests"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8164b06a-b4f7-4b17-82ee-8adc5e932509
---

The frozen full-suite baseline recorded during Wave 2 as "27 fail + 1 suite-level error" is **wrong**. Verified by clean-worktree runs on 2026-07-05:

- **56f7f45** (pre-Wave-2): 27 fail + 1 suite error (3366 pass / 3393). `generatePlan.calendarIntegration.test.jsx` was fully green (4/4).
- **5a1e50b** (Wave 2 HEAD): **29 fail + 1 suite error** (3625 pass / 3654). The 2 extra failures are both in `tests/components/generatePlan.calendarIntegration.test.jsx` ("requires explicit apply then activate…" and "writes one canonical full-horizon proposal set…").

So **Wave 2 (6de2e98..5a1e50b) introduced 2 regressions** in generatePlan calendar integration — tests that passed at 56f7f45 fail at 5a1e50b. The "27+1" number was the 56f7f45 count carried forward to 5a1e50b without re-running (the exact mistake the RTG protocol exists to catch, see [[feedback_rtg_run_the_goal]]).

The 1 suite-level error is `masterPlanFullHorizon.expression.test.js` failing to resolve import `../../src/diagnostics/fullHorizonTruthAudit.js` (missing file).

Commit **ff7c27f** ("Wave 2 close-out: fan-out, parity, ordering-pin tests") adds 8 passing tests (entity fan-out N=3/1/empty + stripEmbeddedPlanTitle ordering-pin) and exports `stripEmbeddedPlanTitle` from identityStore.js; its failure set is byte-identical to the 5a1e50b baseline (0 regressions).

**RESOLVED in commit 7daf832.** The generatePlan.calendarIntegration regression was bisected and found to be load-induced, NOT a code regression: the calendar/generate source is unchanged 56f7f45→5a1e50b and the file passes in isolation in ~5.5s at both commits. Under the full suite, accumulated-load slowdown pushed these heavy full-pipeline tests past the tight 90s per-test timeout (Wave 2 added ~261 tests of load); test 1's timeout left its render mounted, corrupting the module-global `capturedStore` and cascading into test 2. Fix (test-only): raised the 4 per-test timeouts 90s→300s and added `afterEach(cleanup)`. **Post-fix full suite: 27 fail + 1 suite (3635 pass) — baseline back to the pre-Wave-2 27+1, 0 new failures.** So the current true baseline is **27+1** as of 7daf832.
