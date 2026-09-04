---
name: named-test-diff-needs-whitespace-trim
description: Named test-name diffs on the Jericho vitest suite must trim trailing whitespace or they invent phantom regressions and fixes
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 124fde5c-c2c6-43d0-8320-7a567e1dc348
  modified: 2026-08-30T00:22:35.154Z
---

When diffing failing-test NAMES across a baseline on this repo's vitest suite, normalize
trailing whitespace (`sed 's/[[:space:]]*$//'`) before `comm`/`diff`. Vitest's verbose
reporter appends a duration (`1136ms`) to some test lines and not others, non-deterministically
across runs. Stripping only the digits (`sed 's/[0-9]*ms$//'`) leaves a trailing space, so the
SAME test appears in both the "regressions" and "fixes" columns.

Observed 2026-08-29 during the Bug A P5 consumer sweep: a raw name-diff reported 5 regressions
and 5 fixes; 3 of each were the same three tests differing only by a trailing space. After
trimming: 2 real regressions, 2 real fixes. Reporting the untrimmed diff would have claimed
regressions in convergence_step3 and ZionDashboard that never happened.

**Why:** this is the failure mode the name-diff rule exists to prevent, reintroduced one layer
down. Counts are unreliable on this suite ([[open-flake-zion-today-execution-controls]]), so
names are the evidence — but an unnormalized name is not a name.

**How to apply:** `grep -E "^\s*×" | sed 's/[0-9]*ms$//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sort -u`,
then `comm -13 base after` for regressions and `comm -23 base after` for fixes. Capture the
baseline by `git stash`-ing the work and running the full suite from HEAD, not from an older
recorded number. Also: run the suite at an intermediate point in a multi-file sweep, not only
at the end — the [[resolve-node-phase-second-order-bug]] was only visible between steps.
