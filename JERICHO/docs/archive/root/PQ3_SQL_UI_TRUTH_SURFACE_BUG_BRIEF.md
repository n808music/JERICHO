# PQ3_SQL_UI_TRUTH_SURFACE_BUG_BRIEF.md

## Purpose

Capture the two remaining frontend truth-surface issues visible after the SQL
lane PQ3 2B builder improvement:

1. Structure formal plan chart shows zero scheduled blocks while execution views
   show scheduled blocks
2. Calendar block titles are truncated so aggressively that object/method/output
   meaning is partially lost

This brief is for UI/reconciliation work only. It does not reopen builder
doctrine or evaluator scope.

---

## Current Status

### Green

The SQL builder slice materially improved plan substance.

Visible improvements:

- deliverables now read like a real SQL/interview roadmap
- projects are semantically distinct
- interview readiness is operationalized
- execution blocks are domain-specific rather than generic phase labels

### Remaining visible gaps

- Structure formal plan chart appears out of sync with scheduled execution state
- calendar card titles still over-truncate meaningful block content

---

## Problem 1

### Structure plan chart shows zero scheduled blocks while execution views show many blocks

Observed frontend truth mismatch:

- Today/Month execution views visibly contain scheduled SQL blocks
- Structure view formal plan chart shows all deliverables with `0` scheduled
  blocks

This is a real truth-surface failure until proven otherwise.

### Why it matters

The Structure chart is meant to support comparison and plan inspection. If it
reports zero scheduled blocks while the calendar shows a populated schedule, the
user cannot trust the chart.

### Likely failure classes

1. Structure chart is reading a different source than the active execution
   calendar
2. Applied/review blocks are not being mapped back to deliverables correctly
3. The chart is using stale or pre-apply state while the month view is using
   canonical execution state
4. Deliverable/block linkage exists in execution state but the chart lookup path
   is using the wrong key surface

### Required audit question

Why does the Structure formal plan chart not reconcile with the canonical
scheduled block source that Today/Month is already rendering?

### Expected fix standard

The Structure chart must reflect the same canonical scheduled block truth that
the execution calendar reflects.

If there are scheduled blocks:

- deliverables with scheduled blocks must show non-zero counts
- rows must show the linked block titles and scheduled dates
- zero-count rows must only appear when there is truly no linked scheduled work

---

## Problem 2

### Calendar block titles still lose too much meaning through truncation

Observed examples:

- `Write SELECT, ...`
- `Define schema...`
- `Import CSV da...`
- `Scope busines...`
- `Answer busine...`
- `Design advanc...`
- `Build advance...`
- `Prepare READ...`

The backend builder is now preserving more domain payload than the calendar card
surface is able to show.

### Why it matters

The current truncation hides:

- the exact object
- the exact method
- the exact output

That means the frontend is reintroducing visible meaning loss even after the
builder fixed it upstream.

### Failure class

This is primarily a rendering-density problem, not a builder problem.

### Expected fix standard

Block titles in the month view must preserve enough visible meaning that a user
can infer:

- what domain-specific work they are doing
- what object is being worked on
- what method/output is involved

without opening a separate inspector for every block

### Acceptable solution shapes

- slightly longer visible title budget
- two-line block titles
- smarter truncation that preserves the leading semantic object and operation
- lane-aware abbreviation only if it preserves domain meaning

### Unacceptable solution shapes

- leaving builder titles correct but hiding them behind severe UI clipping
- reducing title length in generation to fit the card
- replacing meaningful titles with shorter generic labels

---

## Scope Boundary

This pass should remain bounded to frontend truth presentation:

- source reconciliation for the Structure chart
- title fidelity in the month/calendar cards

It should not:

- reopen SQL builder logic unless the chart bug proves the execution state
  itself is wrong
- relax evaluator standards
- broaden into general UI redesign

---

## Acceptance Standard

The pass is successful only if both are true:

1. Structure formal plan chart and execution calendar report the same scheduled
   block truth
2. Calendar cards preserve enough visible domain meaning that the SQL lane
   remains recognizably specific on the surface

---

## Suggested Verification

### A. Reconciliation check

For a generated and applied SQL cycle:

- count scheduled blocks in Today/Month
- count linked scheduled blocks in Structure formal plan chart
- verify deliverable rows match the applied execution plan

### B. Title fidelity check

For visible month cards:

- can a reviewer infer the domain
- can they infer the object
- can they infer the output/method
- can sibling blocks still be distinguished from one another

If not, the rendering is still over-compressing.

---

## Bottom Line

The SQL builder slice succeeded.

The remaining product weakness is now a frontend truth-surface problem:

- execution truth is not fully reconciled across Structure vs calendar views
- visible block meaning is being lost through UI truncation

That is the next bounded pass.
