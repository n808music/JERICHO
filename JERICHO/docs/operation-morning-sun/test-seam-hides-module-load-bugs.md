---
name: test-seam-hides-module-load-bugs
description: A test seam that re-runs module-scope initialization AFTER evaluation cannot exercise module-load-time bugs — it tests a scenario that cannot occur in production. Cost three data-destruction rounds in JERICHO.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e0471748-6c80-4011-a027-a66ffd515a87
  modified: 2026-08-26T23:07:34.320Z
---

`__recapturePreSeedSnapshotForTests()` in `src/state/identityStore.js` exists
because `PRE_SEED_LOCAL_SNAPSHOT` is captured once per module load, which a test
process (one import, reused) cannot re-trigger. Every sync test called it. All
10 passed. They were green against a scenario that can never happen in a browser.

The real module-load path was throwing a `ReferenceError` — `readLocalUpdatedAt()`
read a `const` declared ~2100 lines lower, still in its temporal dead zone — which
the function's own `catch` swallowed, making the local timestamp unconditionally
`null` and silently disabling the "adopt server copy" branch of the mount pull.
Fixed in `b9a4905`.

**Why:** the seam moves the read past the dead zone. Recapturing *after* module
evaluation is precisely the condition under which the bug is invisible. The seam
that made the tests writable is the seam that made them blind, and the passing
count actively bought false confidence across three rounds of overwriting a
populated server row on 2026-08-26.

**How to apply:**
- When a module does real work at import time (reads storage, seeds state, stamps
  a clock), at least one test must `vi.resetModules()` + `await import(...)` with
  the environment already staged, and must NOT call the recapture seam.
- Treat any `catch` that returns a benign default as capable of hiding a
  `ReferenceError`, not just the I/O error it was written for. A swallowed TDZ
  looks exactly like "the key wasn't set".
- Prove a new regression test fails without the fix. Revert the source, run the
  test, keep the output. A test written after the diagnosis will often pass for
  reasons unrelated to the bug.
- Order invariants that span thousands of lines deserve a structural assertion
  (source index of declaration < source index of use) alongside the behavioural
  one — module caching in a runner can mask a dead zone; source order cannot.

Related: [[open-flake-zion-today-execution-controls]] for why the verification had
to be a named diff rather than a count.
