---
name: e8-recovercanonicalcontractforcycle-staleness-regression
description: Regression — time-relative field write-back bug (Item 1 Step 3) is live on main again after Item 1 was reverted and its fix was not re-applied.
metadata: 
  node_type: memory
  type: project
  originSessionId: 3f4fbcb8-fe43-45d0-8046-2afa4ee9464a
  modified: 2026-08-21T02:18:10.854Z
---

## E8: `recoverCanonicalContractForCycle` Staleness Regression — LIVE ON MAIN

**Severity: HIGH** (regression of previously-closed, verified work; silently corrupts data used by Items 3-5)

**Date Confirmed: 2026-08-20**

### The Problem

Item 1 Step 3 diagnosed and fixed a staleness bug in `recoverCanonicalContractForCycle` (identityCompute.js):
- **Bug:** Function computes fresh values for `startDayKey`, `endDayKey`, `deadlineISO` but then **writes them back** into `cycle.goalContract` and `state.goalExecutionContract`
- **Effect:** These time-relative fields get frozen on first calculation, then re-read stale on every subsequent action (the "day N even on day N+30" bug)
- **Original fix:** Strip the write-back for these three fields; keep only legitimate one-time repairs (goalId, goalText, goalLabel)
- **Verification:** Item 1 Step 3 was tested and verified (RTK Remediation #1 completed 2026-06-04)

### Current Status

**Regression confirmed 2026-08-20:**
- Item 1's file (`activeScheduledLoop.ts`) was deleted in revert at `5de6c78`
- Item 1's bug fix in `recoverCanonicalContractForCycle` was **NOT re-applied** when Item 2 was re-implemented
- Inspection of main shows `repairedContract` still includes `startDayKey`, `endDayKey`, `deadlineISO` and these are still written to cycle/state (identityCompute.js lines ~35-44)

### Impact Chain

Items 3-5 depend on accurate day-relative calculations:
- **Item 3 (Backlog re-entry):** Tracks days-in-backlog via `daysInBacklog` calculation in `resolveBacklogBlocks()`
- **Item 5 (CONSTRAINT escalation):** Derives urgency tiers (URGENT ≤3, ELEVATED 3-7, NORMAL >7) directly from `daysInBacklog`
- **If `startDayKey` is stale:** `daysInBacklog` calculations become silently wrong → Items 3-5's logic runs on corrupted input

### Fix

One-line: Remove `startDayKey`, `endDayKey`, `deadlineISO` from the `repairedContract` object in `recoverCanonicalContractForCycle`.

The fix is already documented (Item 1 Step 3 commit message names the exact lines). Apply it to identityCompute.js in current main.

### Decision Point

**Fix E8 before Item 6 proceeds.** Item 6 is dual-parent aggregation (new work); E8 is a regression of a verified fix (foundation work). Building recursive aggregation on potentially corrupted `daysInBacklog` values is risk-compounding.

### References
- Item 1 Step 3 (commit f7f7c0a): Root cause diagnosis and fix design
- RTK Remediation #1 (2026-06-04): Original fix verification
- [[phase-2-item-5-constraint-escalation]] — escalation tiers depend on daysInBacklog
- [[phase-2-items-3-4-merged]] — Backlog re-entry depends on daysInBacklog
