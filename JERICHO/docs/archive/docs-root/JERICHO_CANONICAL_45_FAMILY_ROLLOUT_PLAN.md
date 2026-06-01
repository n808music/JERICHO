# JERICHO Canonical 45 Family Rollout Plan

**Version:** 1.0 **Date:** 2026-03-20 **Scope:** Sequencing and closure plan for
all 9 archetypes / 45 lanes through plan-quality hardening to P.O.S. handoff.

---

## Current Rollout Focus

**Phase boundary:** Plan-quality hardening complete for 6 reference archetypes
(30 lanes). Entering P.O.S. hardening.

**Active focus:** P.O.S. hardening initialization (probability baseline, trust
transitions, evidence model).

**Parallel obligation:** 3 degraded archetypes (15 lanes) have explicit closure
queues below. Closure work is finite and bounded; it does not block P.O.S.
hardening from beginning.

---

## Phase 1 — Completed (Reference Family Validation)

All 6 reference archetypes are through 7-gate archetype validation. Plan-quality
hardening is complete for these families.

| Archetype                 | Family                   | Validation Status      | Completion Artifact                                     |
| ------------------------- | ------------------------ | ---------------------- | ------------------------------------------------------- |
| CreativeProduction        | Creative / Release Media | `pass` — 7-gate matrix | `GENERALIZATION_ARCHETYPE_VALIDATION_MATRIX_1.0.7.0.md` |
| VentureLaunch             | Revenue / Capital        | `pass` — 7-gate matrix | `GENERALIZATION_ARCHETYPE_VALIDATION_MATRIX_1.0.7.0.md` |
| ProfessionalQualification | Capability / Credential  | `pass` — 7-gate matrix | `GENERALIZATION_ARCHETYPE_VALIDATION_MATRIX_1.0.7.0.md` |
| PhysicalTraining          | Physical Progression     | `pass` — 7-gate matrix | `GENERALIZATION_ARCHETYPE_VALIDATION_MATRIX_1.0.7.0.md` |
| SkillAcquisition          | Capability / Credential  | `pass` — 7-gate matrix | `GENERALIZATION_ARCHETYPE_VALIDATION_MATRIX_1.0.7.0.md` |
| JobSearchPipeline         | Employment Pipeline      | `pass` — 7-gate matrix | `GENERALIZATION_ARCHETYPE_VALIDATION_MATRIX_1.0.7.0.md` |

**Reference baseline:** TV / Series Writing lane has a dedicated live baseline
freeze (`TV_BASELINE_REFERENCE_1.0.6.4.md`). This is the primary reference
implementation.

**Structural baseline:** All 45 lanes pass scorecard baseline (45/45 pass, 0
fail, 0 warn) as of `archetypeExecutionScorecard.baseline.test.ts`.

**Stress validation:** All 8 stress scenarios pass as of
`GENERALIZATION_STRESS_MATRIX_1.0.7.0.md`.

---

## Phase 1 — Open Corrections (Non-Blocking)

These items are open within the already-validated families. They are named,
bounded, and do not change the definition of a quality plan. They are closure
work, not definition work.

### Manual Live Freeze Audit (pending)

**Artifact:** `FREEZE_AUDIT_ACTION_FIRST_1.0.7.1.md` **Status:** Automated gates
all PASS. Manual live gate execution pending. **Required archetypes:** TV
Writing + Venture Launch (minimum). Job Search Pipeline as validation reserve.
**Acceptance criterion:** All 8 UI gate checks PASS for both required
archetypes. **Unblocks:** Final promotion from `PRE-FREEZE` to `FREEZE`.

### Action Category Taxonomy (open)

**Item:** Add dedicated `JOB_SEARCH_PIPELINE` action category (currently maps to
`VENTURE_LAUNCH`). **Scope:** JobSearchPipeline (5 lanes). **Impact:**
Behavioral correctness is intact; classification is approximate. Non-blocking
for P.O.S. hardening. **Acceptance criterion:** Category emits
`JOB_SEARCH_PIPELINE` correctly and validator confirms correct routing.

---

## Phase 2 — Degraded Family Closure (sequenced by leverage)

These 3 archetypes are degraded: structural grammar is complete, but 7-gate
validation has not been run. Sequenced by leverage and gap size.

### Priority 1: Fundraising

**Leverage rationale:** Live trace fixture set already exists (`newlyMigrated`
set, 5 inputs). Shortest path to 7-gate pass. Externally-mediated commitment
model is important to validate before P.O.S. hardening extends to investor/donor
goals.

**Current state:** `degraded` — structural baseline clean, live trace coverage
exists, 7-gate not run.

**Closure queue:**

| Item                                                                                                                                                                        | Acceptance Proof                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| F-001: Run 7-gate validation against existing Fundraising live trace inputs                                                                                                 | All 7 gates PASS for at least one Fundraising lane                                                  |
| F-002: Confirm P.O.S. truth model reflects external-evidence dependency for commitment stages (investor/donor decision is externally mediated, not internally controllable) | P.O.S. test asserts `provisional` or `withheld` state until external commitment evidence is present |
| F-003: Validate recovery/renegotiation options for Fundraising (e.g., reduce target round size, extend timeline, pivot to different investor class)                         | Recovery options surface and at least one supported option applies in-cycle                         |

**Representative goal:**
`Raise a $100,000 angel round in 60 days with investor deck, target list, and first meetings completed.`

**Lane to close first:** Angel Raise (highest frequency; external mediation
model is clearest).

---

### Priority 2: SalesPipeline

**Leverage rationale:** Revenue-generating archetype. Conversion-stage external
mediation (deal acceptance) must be confirmed as correctly separated from
internally-controllable activity. Second priority because no live trace exists
yet.

**Current state:** `degraded` — structural baseline clean, no live trace
coverage, no 7-gate validation.

**Closure queue:**

| Item                                                                                                                                                            | Acceptance Proof                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| S-001: Create live trace fixture set for SalesPipeline (minimum: 3 inputs, clean/explicit + compressed + deadline-constrained)                                  | Fixture set exists and live trace suite returns stable summaries            |
| S-002: Run 7-gate validation against SalesPipeline fixture inputs                                                                                               | All 7 gates PASS for at least one SalesPipeline lane                        |
| S-003: Confirm P.O.S. truth model correctly marks conversion-stage gates as externally mediated (deal close depends on buyer decision, not seller effort alone) | P.O.S. test confirms conversion stage is treated as externally gated        |
| S-004: Validate recovery/renegotiation options for SalesPipeline (e.g., increase pipeline volume, tighten ICP, reduce deal complexity)                          | Recovery options surface and at least one supported option applies in-cycle |

**Representative goal:**
`Close 3 B2B service contracts in 60 days via targeted outreach, qualification, and proposal pipeline.`

**Lane to close first:** B2B Service Sales (highest-leverage; structure is
clearest for pipeline modeling).

---

### Priority 3: BrandLaunch

**Leverage rationale:** Identity/positioning archetype. Less directly connected
to P.O.S. evidence transitions than Fundraising and SalesPipeline. Sequenced
last because it also has the fewest natural external-evidence gates. Lower
leverage for P.O.S. hardening than the other two.

**Current state:** `degraded` — structural baseline clean, no live trace
coverage, no 7-gate validation.

**Closure queue:**

| Item                                                                                                                                                                                                                        | Acceptance Proof                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| B-001: Create live trace fixture set for BrandLaunch (minimum: 3 inputs)                                                                                                                                                    | Fixture set exists and live trace suite returns stable summaries            |
| B-002: Run 7-gate validation against BrandLaunch fixture inputs                                                                                                                                                             | All 7 gates PASS for at least one BrandLaunch lane                          |
| B-003: Confirm P.O.S. starting state for BrandLaunch — identify whether brand launch goals produce `provisional` initial P.O.S. (internally controllable, externally unverifiable) or `withheld` (no audience evidence yet) | P.O.S. test confirms correct initial state for a launch-preparedness goal   |
| B-004: Validate recovery/renegotiation options for BrandLaunch (e.g., reduce launch scope to single channel, defer secondary brand touchpoints)                                                                             | Recovery options surface and at least one supported option applies in-cycle |

**Representative goal:**
`Launch personal brand presence with positioning, visual identity, and first content set published in 45 days.`

**Lane to close first:** Personal Brand Launch (highest frequency and clearest
production path).

---

## Phase 3 — P.O.S. Hardening (current entry point)

**Entry condition:** Plan-quality phase exit checklist satisfied (Sections 1–6).

**Status:** Entering Phase 3 now. Reference families are pass. Degraded family
closure is bounded and parallel.

### Phase 3 Setup Tasks

These must be completed to formally begin P.O.S. hardening:

| Task    | Description                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POS-001 | Define P.O.S. baseline truth rules at admission and activation                                                                                         |
| POS-002 | Define trust state transitions: `withheld → provisional → trusted`                                                                                     |
| POS-003 | Define how execution evidence (completed blocks, missed blocks, drift) changes P.O.S. over time                                                        |
| POS-004 | Define how externally-mediated families (Employment Pipeline, Fundraising, SalesPipeline) change trust differently from internally-controlled families |
| POS-005 | Define recovery-state realism rules: how missed-block accumulation, renegotiation attempts, and drift affect probability                               |
| POS-006 | Define the threshold at which P.O.S. is honest enough to become a core user-facing signal instead of a guarded policy state                            |

---

## Family Sequencing Rationale

The ordering above reflects leverage, not convenience:

1. **Reference families first** — established the reusable execution grammar and
   trust model. Required before any probability modeling could be honest.
2. **Fundraising before SalesPipeline** — live trace coverage already exists;
   external-mediation model is cleaner (fewer intermediate stages).
3. **SalesPipeline before BrandLaunch** — revenue impact is higher;
   external-mediation at conversion stage is directly relevant to P.O.S.
   hardening.
4. **BrandLaunch last** — internally-controllable production path is valuable,
   but external-evidence gates are less structurally defined than Fundraising or
   Sales.

---

## Rollout State Summary

| Phase                                      | Archetypes | Lanes  | Status              |
| ------------------------------------------ | ---------- | ------ | ------------------- |
| Phase 1 — Reference validation complete    | 6          | 30     | Complete            |
| Phase 2 — Degraded closure (Fundraising)   | 1          | 5      | Queued — Priority 1 |
| Phase 2 — Degraded closure (SalesPipeline) | 1          | 5      | Queued — Priority 2 |
| Phase 2 — Degraded closure (BrandLaunch)   | 1          | 5      | Queued — Priority 3 |
| Phase 3 — P.O.S. hardening                 | all 9      | all 45 | **Active**          |

---

## Governance Rule

**This document is the live control surface for canonical 45 rollout
sequencing.**

- Do not reorder family sequencing without an explicit leverage argument.
- Do not mark a degraded family as closed without all acceptance proofs passing.
- Do not remove a closure queue item without a documented proof.
- Update the rollout state table when each phase boundary is crossed.
