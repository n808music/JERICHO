---
name: e10-bucket-breakdown-structure
description: "E10 systematic bucket-based classification framework for 75 unclear appTime.nowISO sites—no defer, no shortcuts, evidence per bucket."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 4c65669e-b710-4918-84d5-ccba4b0c8443
  modified: 2026-08-21T18:21:42.149Z
---

# E10 — Bucket Breakdown Structure for the 75 Unclear `appTime.nowISO` Sites

**Purpose:** Classify the 75 "UNCLEAR" sites from the E10 categorization pass, one bucket at a time, without re-deriving methodology each session.

**Mandate:** Do not skip ahead. Classify a full bucket, migrate/confirm with tests, verify against freshly-pulled main, *then* move to next bucket. No batching across buckets, no partial-bucket migration.

## Domain Buckets (starting split — confirm/adjust once site list is in hand)

For each bucket: list file(s) + line numbers before starting classification. If a site doesn't fit a bucket, put it in **Bucket 7 (Unsorted)** rather than forcing.

| # | Bucket | Why it's a plausible cluster |
|---|--------|-------------------------------|
| 1 | Execution contracts (`goalExecutionContract`, `cycle.goalContract` writes/reads) | Same family as E8's original bug — high scrutiny warranted |
| 2 | Cycle state (`activeCycleId`, cycle recovery/rollover) | Adjacent to `recoverCanonicalContractForCycle`, already touched by E8 |
| 3 | Goal admission / intake-adjacent logic | Distinct from scheduling — may be staleness-tolerant by nature |
| 4 | Scheduler prep / scheduling windows (non-E9 sites) | Same family as E9's bug — check whether any have the *same* workday-floor gap E9 does |
| 5 | Backlog / missed-block logic (Items 2–3 territory) | `daysInBacklog`-adjacent — flagged as depending on correct day computation |
| 6 | Narrative / completion feed (Item 4 territory) | Check whether any read `nowISO` for attestation timestamps (would push toward "truly needs fresh now") |
| 7 | Unsorted / doesn't fit above | Anything that doesn't cleanly match 1–6 — do not force-fit |

## Per-Site Classification Template

For every site in a bucket, capture:

```
File: 
Line: 
Surrounding function: 
What it does with the value (verbatim, 1 line): 
Does it compare against another timestamp/day boundary? (Y/N — if Y, which?)
Does it derive a day-granularity value, or does it need sub-day precision?
Category assigned: [Truly-fresh-now | Migratable-to-activeDayKey | Staleness-tolerant | Still-unclear]
Confidence: [High | Medium | Low]
Notes / open question if Low confidence:
```

**Category definitions (same as original 3, for consistency with 21 already-classified sites):**
- **Truly needs fresh NOW** — sub-day precision matters, or it's a creation/audit timestamp that should reflect wall-clock time, not day-key.
- **Migratable to `activeDayKey`** — only day-granularity is used; migration is low-risk.
- **Staleness-tolerant** — debug output, UI-only display, non-authoritative — safe either way.
- **Still-unclear** — needs second pair of eyes or runtime trace before placed; do not force-fit.

## Per-Bucket Exit Checklist (before moving to next bucket)

- [ ] Every site in the bucket has a completed classification template (or explicitly carried to "Still-unclear")
- [ ] Sites classified **Migratable** have a test written first (asserting current day-key-based behavior), then migrated, then test re-run passing
- [ ] Sites classified **Truly-fresh-now** are left untouched, reasoning written down (so future pass doesn't re-litigate)
- [ ] Sites classified **Staleness-tolerant** are left untouched, reasoning written down
- [ ] Full test suite run against freshly-pulled main (exact numbers recorded, not rounded) — no bucket marked done on tone
- [ ] Bucket's findings appended to running E10 log before starting next bucket

## Running Log (append after each bucket, do not overwrite)

```
## Bucket X — Session YYYY-MM-DD HH:MM

Sites classified: X / total-in-bucket
Migrated: X
Left as truly-fresh-now: X
Left as staleness-tolerant: X
Still-unclear (carried forward): X
Test results (exact, cited): [PASS X/Y] or [FAIL X, cite line/name]
Commit hash(es) this session: 
Verified against main commit: 
```

## Final Step (only after all 7 buckets + still-unclear resolved)

1. Confirm zero remaining reads of `appTime.nowISO` unaccounted for (grep count = sum of classified sites + original 21)
2. Remove `nowISO` from persistence at line 935
3. Full-suite regression run against freshly-pulled main, exact counts cited
4. Only then mark E10 closed — with evidence, not tone

---

Related: [[e9-scheduler-nowiso-freshness]], [[state-apptime-dual-field-design]]
