# JERICHO_OUTCOME_VALIDITY_PACKAGE_FREEZE.md

## Status

**Frozen — Outcome Validity Package v1**
Grounded in: audit pack evidence ST-01 through LT-04
Date: 2026-04-06

---

## What this document records

This document freezes the first coherent Outcome Validity subsystem. It names
the canonical files, the enforcement boundaries, the failure codes, and the
test surface. It is the authoritative record of what was built in Phases 1–3
and what is now stable.

Future phases that extend this package must reference this document and state
explicitly what they add, remove, or change.

---

## Package boundary

The Outcome Validity package consists of:

### Canonical files

| File | Role |
|------|------|
| `src/domain/goal/terminalOutcomeAuthority.ts` | Authority classification — detects whether a goal's terminal event is fully_controllable, externally_mediated, market_dependent, mixed, or unknown |
| `src/domain/planQuality/contactStageDetector.ts` | Phase 2 — detects whether any deliverable represents direct external engagement |
| `src/domain/planQuality/corridorLaneDetector.ts` | Phase 3 — detects which corridor lane applies (JobSearch, Fundraising, unknown) |
| `src/domain/planQuality/terminalStageDetector.ts` | Phase 3 — detects whether the deliverable set reaches the terminal stage for a known lane |

### Contract attachment

`GoalIntakeContract.terminalOutcomeAuthority: TerminalOutcomeAuthorityResult`

All downstream reads of authority class must go through this field.
No recomputation at call sites outside `buildGoalIntakeContract`.

### Gate enforcement

All outcome validity checks live in `evaluatePlanQualityGate.ts` in a single
contiguous block after the structural deliverable loop. The Phase 2 and Phase 3
checks are sequential and share the authority result derived once at the top of
the block.

### Failure codes (new, all in this package)

```typescript
| 'OUTCOME_COVERAGE_PREP_ONLY'               // Phase 2
| 'OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING'  // Phase 3
```

Both live in `PlanQualityFailureCode` union in `planQualityTypes.ts`.

---

## What each phase established

### Phase 1 — Authority detection

**Freeze criterion met:** `terminalOutcomeAuthority` is computed canonically and
stored on `GoalIntakeContract`. All 7 audit pack goals classify correctly. Zero
gate behavior changed.

**Audit pack verification matrix:**

| Goal | Authority | Confidence |
|------|-----------|------------|
| ST-01 (landing page) | fully_controllable | high |
| ST-02 (fitness goal) | fully_controllable | high |
| ST-03 (brand launch) | mixed | high |
| LT-01 (podcast) | mixed | high |
| LT-02 (fullstack + job) | mixed | high |
| LT-03 (job search) | externally_mediated | high |
| LT-04 (fundraising) | externally_mediated | high |

### Phase 2 — Prep-only enforcement

**Freeze criterion met:** Externally mediated and mixed-authority plans with no
contact-stage deliverable now emit `OUTCOME_COVERAGE_PREP_ONLY` and withhold.
Valid full-pipeline externally mediated plans are not affected.

**What changes under Phase 2:**

| Plan shape | Before Phase 2 | After Phase 2 |
|-----------|---------------|---------------|
| LT-04 packagePrepMode (no investor meetings) | PASSED | WITHHELD — `OUTCOME_COVERAGE_PREP_ONLY` |
| LT-03 skill_acquisition contamination path | PASSED | WITHHELD — `OUTCOME_COVERAGE_PREP_ONLY` |
| LT-04 full pipeline | PASSED | PASSED (contact stage present) |
| Fully controllable goals (podcast, landing page) | unchanged | unchanged |

**Detection authority:** `contactStageDetector.ts`. No parallel detection
elsewhere. Bounded vocabulary with explicit negative cases for every
ambiguous term.

**Key pattern discipline:** "pitch deck" is a prep artifact (no contact verb
fires on "build pitch deck"). "Send pitch deck to investors" fires via the
send-pattern, not the pitch-pattern. Exclusion: `deck` removed from pitch
qualifier list after false-positive detection in packagePrepMode test.

### Phase 3 — Terminal-stage enforcement for audited lanes

**Freeze criterion met:** Plans with contact-stage coverage but no terminal-stage
deliverable now emit `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` for known corridor
lanes. Unknown-lane goals are explicitly skipped. Valid full-corridor plans are
not affected.

**Audited lanes:**

| Lane | Terminal event | Terminal object anchors |
|------|---------------|------------------------|
| JobSearch | Employer extends job offer | `offer`, `offer letter`, `job offer` |
| Fundraising | Investor signs and transfers funds | `term sheet`, `commitment`, `wire transfer`, `close round`, `legal close`, `signed agreement` |

**What changes under Phase 3:**

| Plan shape | Before Phase 3 | After Phase 3 |
|-----------|---------------|---------------|
| LT-03 probe pipeline (applications + interview prep, no offer stage) | PASSED | WITHHELD — `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` |
| LT-04 full pipeline | PASSED | PASSED ("term discussions" satisfies Fundraising terminal stage) |
| LT-04 packagePrepMode | WITHHELD (Phase 2) | WITHHELD — both Phase 2 and Phase 3 codes co-fire |
| Podcast, landing page goals | unchanged | unchanged (lane: unknown) |
| Market-dependent goals | unchanged | unchanged (authority filter, unknown lane) |

**Detection authority:** `terminalStageDetector.ts`. Lane routing via
`corridorLaneDetector.ts`. No parallel detection elsewhere.

**Binding invariant:** Terminal-stage detection is anchored on lane-specific
terminal objects, not on generic completion verbs. Every pattern has a named
load-bearing terminal object. A pattern that fires when the terminal object is
removed is over-broad and must be tightened before merge.

**Key pattern fix during implementation:** `\boffer\b` → `\boffers?\b`. Plural
forms were blocked by word-boundary rule. Fix is minimal, semantically faithful,
and still object-anchored.

---

## Test surface

| File | Tests | Role |
|------|-------|------|
| `src/domain/goal/terminalOutcomeAuthority.test.ts` | 29 | Phase 1 — authority classification |
| `src/domain/planQuality/contactStageDetector.test.ts` | 45 | Phase 2 — contact stage detection |
| `src/domain/planQuality/terminalStageDetector.test.ts` | 66 | Phase 3 — lane detection + terminal stage detection |

All 140 package-specific tests pass. Full suite: 1561/1561 tests across 338 test
files — zero regressions from Phases 1, 2, or 3.

---

## Enforcement scope

The outcome validity checks fire only when:

1. `authority === 'externally_mediated' || authority === 'mixed'`
2. (Phase 3 additionally) `lane !== 'unknown'`

Fully controllable and market-dependent goals are **not affected** by any Phase
1–3 gate check. No trust state has been modified. No probability or feasibility
logic has been changed.

---

## Failure code semantics

| Code | Condition | Distinction |
|------|-----------|-------------|
| `OUTCOME_COVERAGE_PREP_ONLY` | No contact-stage deliverable | Plan never engaged the external party |
| `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` | Contact-stage present, no terminal-stage deliverable | Plan engaged the external party but did not model the corridor to the decision event |

Both codes may co-fire on the same plan. This is correct: a prep-only plan has
two distinct insufficiencies — no contact and no terminal stage. Neither code
implies the other. They are independent checks.

---

## What this package does not address

The following remain open and are explicitly out of scope for this freeze:

1. **Trust state extension** — `provisional_external` and `provisional_market`
   trust state variants are defined in `JERICHO_OUTCOME_VALIDITY_GATE_SPEC.md`
   but not yet implemented. Phase 5 work.

2. **RC-13: endpoint recognition** — `completionBoundaryStatus: missing` for
   all non-podcast goals is a separate defect, independent of authority
   classification.

3. **RC-20: full external dependency encoding** — the gate now enforces corridor
   sufficiency but does not yet record that the terminal event is externally
   controlled in a way that propagates to trust or probability. The RC-20
   observation (gate passed without checking investor decision dependency) remains
   visible in the LT-04 probe because trust semantics have not changed.

4. **Mixed-authority decomposition** — goals with mixed authority satisfy Phase 3
   if any terminal stage is detected for the identified lane. Full decomposition
   (requiring terminal coverage for each authority class independently) is
   deferred.

5. **Unaudited lanes** — SalesPipeline, Publishing, and any future lane require
   their own audit probe before lane patterns are added. Unknown-lane no-op is
   the freeze behavior.

6. **Intermediate corridor stages** — Stage 2 (evaluation/diligence) is not
   individually mandated. Stage compression remains valid. Intermediate stage
   enforcement is not in scope for this package.

7. **`OUTCOME_VERIFICATION_TEXT_NOT_COVERED`** — verification text clause
   parsing, deferred to implementation Phase 4 (spec Phase 3). Requires
   sentence boundary detection and semantic overlap evaluation.

---

## Freeze conditions

This package is frozen as of 2026-04-06 when:

1. All three phase canonical files exist and export their documented interfaces
2. `GoalIntakeContract` carries `terminalOutcomeAuthority` on every call
3. Both failure codes exist in `PlanQualityFailureCode`
4. Gate enforcement fires correctly for audited cases and does not fire for
   out-of-scope cases (fully_controllable, market_dependent, unknown lane)
5. 1561/1561 tests pass across 338 test files
6. No trust state, probability, or feasibility logic has been modified

**Reopening criteria:** any of the following invalidates this freeze and requires
a new brief before further changes:

- A new lane is added without an audit probe
- A pattern addition violates the object-over-verb invariant
- A trust state change touches authority-class logic
- The gate check block is split across multiple insertion points
- The contract field is recomputed at a call site other than `buildGoalIntakeContract`
