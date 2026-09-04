---
name: handoff-2-complete
description: "Handoff 2 stability work complete—ZionDashboard tests quarantined, Run 2 baseline established with known scattered flakiness"
metadata: 
  node_type: memory
  type: project
  originSessionId: c7ae7a84-9872-493a-812c-a1abcd94bc75
  modified: 2026-08-27T20:31:57.434Z
---

# Handoff 2: Quarantine & Baseline — Complete

**Date:** 2026-08-27  
**Branch:** item-6-phase4-classification-removal  
**Status:** ✅ COMPLETE — Ready for metricType retry

## Work Summary

**Handoff 2 objective:** Stabilize test suite for metricType retry by identifying and quarantining/fixing flaky tests.

**Executed:**
1. **Timeout investigation:** Found "8 timeouts" claim was unverified; actual logs showed 3-4 timeouts from 2 consistent tests (ZionDashboard #1-2) + 1 flaky (reschedule)
2. **Root-cause analysis:** Reschedule test flakiness traced to test isolation cascade (tests #1-2 timeout → don't clean up → test #3 fails)
3. **Isolation verification:** Reschedule test passes 3/3 runs in isolation → confirmed cascade theory
4. **Quarantine implementation:** Marked 3 ZionDashboard tests as `it.skip()` with specific, documented root causes
5. **4-run stability check:** Post-quarantine runs showed Run 2 ≡ Run 3 (identical), but Runs 1 & 4 differ → revealed scattered flakiness beyond ZionDashboard

## Key Finding

**Honest assessment of stability:**
- ZionDashboard: Identified root causes (perf timeout + test isolation), quarantined
- Remaining: ~47-50 failures per run; 4-run sample showed ±2 variance in different tests (calendar integration, memoization)
- **No full convergence achieved** — but Run 2-3 pair is stable subset suitable for baseline

**Decision:** Proceed with known scattered flakiness documented, not chase every flake indefinitely.

## Baseline Configuration

- **Reference Run:** Run 2 (2026-08-27 10:51 CDT)
- **Justification:** Runs 2-3 replicated identically (49 failures each)
- **Why not Run 4 (48 failures)?** Fewer is not evidence of stability; only replication is. Run 4 differed from all others.
- **Documented limitation:** ±2 test variance expected from known scattered flakes

## Next Action

**Proceed to metricType retry:**
1. Apply metricType changes
2. Run full suite
3. Diff against Run 2 baseline
4. Report NEW failures separately from baseline scatter (expect ±1-2 noise)

---

## Memo for Future Sessions

- **Where to find baseline:** `BASELINE.md` (checked in; commit [[?]] describes reasoning)
- **Quarantine details:** `tests/components/ZionDashboard.todayExecutionControls.test.jsx` (inline comments on each `it.skip()`)
- **If revisiting scattered flakes:** Calendar integration + memoization tests are candidates; 4-run evidence in `/tmp/baseline-quarantine-run-*.log`
- **Do not retry 3-run stability check** — 4-run sample showed it's diffuse, not converging; further chasing has diminishing returns

## Lessons Learned

1. **Two runs insufficient for stability claim** — caught early by asking for 3, should have been protocol from start
2. **"Expected variance" is not a baseline** — acceptance without identification masks real instability (the reschedule test showed this)
3. **Isolation testing is cheap verification** — reschedule test passed 3/3 alone, confirming cascade theory before quarantine
4. **Scattered flakiness requires evidence of pattern, not just observation** — 4-run check revealed diffuse rather than converging, preventing misdirected deep-dive

## Related Memories

- [[e15-site-1-verification-deferral]] — baseline practices; diff by NAME, not count; exact suite counts unreliable
- [[test-seam-hides-module-load-bugs]] — test isolation issues can hide real bugs; this ZionDashboard cascade is similar pattern
