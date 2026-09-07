---
name: e9-diagnostic-test-strategy
description: "E9 diagnostic test scaffold to confirm/kill the resume/guard hypothesis before more bucket work proceeds."
metadata:
  type: project
  originSessionId: session_019SiVcPUeU6PEVKTjmdmYPJ
  modified: 2026-08-21T20:35:44.291Z
---

# E9 Diagnostic Test Strategy

**Status:** READY TO EXECUTE  
**Purpose:** Confirm or kill the resume/guard hypothesis in under 30 minutes, BEFORE proceeding with Buckets 3–7.

## The Hypothesis

On resume (app reload, rehydrate from localStorage), `state.appTime` already exists with persisted stale values. The guard clause:

```javascript
if (!state.appTime.nowISO) {
  state.appTime.nowISO = new Date().toISOString();  // only if MISSING
}
```

sees `nowISO` as truthy (because it was persisted from the prior session), so **skips the refresh**. Values stay stale.

**Status:** UNCONFIRMED. Guard exists in code (identityStore.js:2534–2535), but:
- Unknown whether this code path actually runs on resume (vs. some other initialization path)
- Unknown whether `appTime` is actually persisted and reloaded before this guard is reached
- Unknown whether something else refreshes `appTime` between resume and this guard check
- **This is exactly what the diagnostic test exists to verify.** Don't treat guard existence as evidence of behavior until test runs.

## The Test Scaffold

See: `/private/tmp/claude-501/-Users-jamesdotson-vscode-JERICHO-JERICHO/scratchpad/e9-resume-staleness-diagnostic-test.js`

**Test 1 (Control):** True first-init (no prior appTime) → expects FRESH values ✓  
**Test 2 (Hypothesis):** Resume with stale appTime → expects STALE values remain (guard blocks refresh)  
**Test 3 (Edge):** Same-day resume → day-key correct but wall-clock stale

## How to Adapt It to Real Code

Before running, fill in:

1. **`initializeAppTimeIfNeeded(state)`** — copy the actual logic from identityStore.js:2521–2543 into the helper function
2. **`dayKeyFromISO(iso, timezone)`** — import the real helper from the codebase (probably from `src/core/deadline.ts` or similar)
3. **Time mocking** — verify Jest is intercepting `new Date()` at the call site (may need to check test setup)

## Test Result Interpretation

| Outcome | Conclusion | Next Step |
|---------|-----------|-----------|
| Test 1 ✓, Test 2 ✓ | Hypothesis CONFIRMED | Fix the guard (Options A/B/C documented in test file) |
| Test 1 ✓, Test 2 ✗ | Hypothesis FALSIFIED | Staleness from elsewhere; full resume trace needed; skip bucket work until root cause found |
| Test 1 ✗, Test 2 ✗ | Framework issue | Mock isolation broken; verify test harness or use debugger instead |

## If Hypothesis CONFIRMED

The fix becomes clear:
- **Option A (Simplest):** Remove the guard, always refresh: `state.appTime.nowISO = new Date().toISOString()`
- **Option B (Safer):** Refresh if noticeably stale (e.g., >1 min old)
- **Option C (Aligned with E9):** Compute fresh `activeDayKey` from current time without depending on persisted `nowISO`

Then re-run full test suite and compare to baseline (should improve, not regress).

## If Hypothesis FALSIFIED

Do NOT proceed with bucket work yet. Instead:
- Trace the actual resume entry point end-to-end (where does persisted state load? what happens after initialization?)
- Add a debugger trace in identityStore.js to confirm `new Date()` is being called
- Check whether another initialization path runs after this one and overwrites values
- Review whether state object in tests matches the state object used downstream

## Gate: Run This Before Buckets 3–7

Blocks: none (can run immediately)  
Unblocks: Bucket 3, Bucket 4, … (clear signal whether bucket approach is targeting the right root cause)

**Note on the 75-site enumeration:** The full list of "75 unclear sites" was never actually generated or saved as an artifact. Buckets 1 & 2 have 9 sites classified, but there's no authoritative roster against which to verify completion. Deliberate deferral: don't re-enumerate until AFTER this diagnostic test resolves whether E9 staleness is actually coming from the guard-block hypothesis. If hypothesis is false, the entire bucket classification strategy may need to pivot, making early enumeration wasted work. If hypothesis is true, enumeration becomes straightforward (enumerate once, partition into buckets, verify sum). 

**Do not claim the 75-site count is "solved"** — it's deferred pending E9 resolution.

## Related

[[e10-bucket-breakdown-structure]] — master bucket breakdown  
[[e10-bucket-1-execution-contracts-sites]] — Bucket 1 (5 sites, awaiting E9 clarification)  
[[e10-bucket-2-cycle-state-sites]] — Bucket 2 (4 sites, verified clean)
