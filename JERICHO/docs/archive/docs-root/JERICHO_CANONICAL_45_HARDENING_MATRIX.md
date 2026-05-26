# JERICHO Canonical 45 Hardening Matrix

**Version:** 1.0 **Date:** 2026-03-20 **Scope:** Maturity state of all 45
canonical lanes (9 archetypes × 5 lanes) as of plan-quality phase exit.

---

## Maturity States

| State      | Definition                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pass`     | Archetype validated through 7-gate matrix AND structural scorecard baseline clean (≥3 deliverables, ≥3 action classes, schedule pattern, correction pattern, ≥1 milestone). |
| `degraded` | Structural scorecard baseline clean, but 7-gate archetype validation not complete. Known gaps documented below.                                                             |
| `blocked`  | Structural grammar missing or fundamental engine issue preventing validation.                                                                                               |

---

## Reference Families

Reference families are the primary proving families for the plan-quality phase.
All lanes in reference families have passed the 7-gate archetype validation
matrix and the structural scorecard baseline.

**Reference family membership:**

| Family Label             | Archetypes                                  |
| ------------------------ | ------------------------------------------- |
| Creative / Release Media | CreativeProduction                          |
| Capability / Credential  | ProfessionalQualification, SkillAcquisition |
| Physical Progression     | PhysicalTraining                            |
| Revenue / Capital        | VentureLaunch                               |
| Employment Pipeline      | JobSearchPipeline                           |

---

## Degraded Families

Degraded families have structural execution grammar locked in the canonical
matrix and pass the scorecard baseline, but have not been run through the 7-gate
archetype validation. Explicit gaps and closure queues are in the section below
the per-lane table.

**Degraded family membership:**

| Family            | Archetype     | Gap Summary                                                            |
| ----------------- | ------------- | ---------------------------------------------------------------------- |
| Brand / Identity  | BrandLaunch   | No 7-gate validation. No live trace coverage.                          |
| Sales Execution   | SalesPipeline | No 7-gate validation. No live trace coverage.                          |
| Capital Formation | Fundraising   | No 7-gate validation. Live trace coverage exists (newly migrated set). |

---

## Per-Lane Maturity Table

### VentureLaunch — Revenue / Capital (reference)

| Lane                    | State  | Notes                                                             |
| ----------------------- | ------ | ----------------------------------------------------------------- |
| SaaS Product Launch     | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |
| Consumer Product Launch | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |
| Service Business Launch | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |
| Marketplace Launch      | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |
| Local Business Launch   | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |

### SkillAcquisition — Capability / Credential (reference)

| Lane                              | State  | Notes                                                             |
| --------------------------------- | ------ | ----------------------------------------------------------------- |
| Software Skill Acquisition        | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |
| Design Skill Acquisition          | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |
| Communication Skill Acquisition   | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |
| Technical Trade Skill Acquisition | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |
| Creative Skill Acquisition        | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |

### ProfessionalQualification — Capability / Credential (reference)

| Lane                           | State  | Notes                                                             |
| ------------------------------ | ------ | ----------------------------------------------------------------- |
| Certification Exam             | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |
| Licensure Exam                 | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |
| Compliance Training Completion | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |
| Portfolio-Based Qualification  | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |
| Interview-Based Qualification  | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. |

### PhysicalTraining — Physical Progression (reference)

| Lane                           | State  | Notes                                                                     |
| ------------------------------ | ------ | ------------------------------------------------------------------------- |
| Strength Program               | `pass` | Archetype in 7-gate validation matrix. Periodized compile path validated. |
| Endurance Performance          | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean.         |
| Weight Loss / Body Composition | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean.         |
| Rehab Return to Training       | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean.         |
| General Conditioning           | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean.         |

### JobSearchPipeline — Employment Pipeline (reference)

| Lane                         | State  | Notes                                                                                                                                                                                                                           |
| ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Corporate Role Search        | `pass` | Archetype in 7-gate validation matrix. Pipeline compile path validated. **Known correction:** `JOB_SEARCH_PIPELINE` action category currently maps to `VENTURE_LAUNCH` for validator compatibility; dedicated category pending. |
| Remote Knowledge Work Search | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. Same known correction applies.                                                                                                                                |
| Creative Role Search         | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. Same known correction applies.                                                                                                                                |
| Skilled Trade Role Search    | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. Same known correction applies.                                                                                                                                |
| Career Transition Search     | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean. Same known correction applies.                                                                                                                                |

**Archetype-level correction item:** Add dedicated `JOB_SEARCH_PIPELINE` action
category when category taxonomy is expanded. Non-blocking; behavior is correct,
classification is approximate.

### CreativeProduction — Creative / Release Media (reference)

| Lane                     | State  | Notes                                                                                                                                      |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| TV / Series Writing      | `pass` | Archetype in 7-gate validation matrix. Dedicated live baseline freeze exists (`TV_BASELINE_REFERENCE_1.0.6.4.md`). Primary reference lane. |
| Podcast Production       | `pass` | Archetype in 7-gate validation matrix. Live trace coverage in newly migrated set. Structural baseline clean.                               |
| Music Project Production | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean.                                                                          |
| Video Production         | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean.                                                                          |
| Book / Longform Writing  | `pass` | Archetype in 7-gate validation matrix. Structural baseline clean.                                                                          |

**Note:** TV / Series Writing is the primary baseline reference lane. The other
4 lanes share archetype-level engine validation; they do not have dedicated
lane-level freeze baselines.

---

### BrandLaunch — Brand / Identity (degraded)

| Lane                          | State      | Notes                                                                                           |
| ----------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| Personal Brand Launch         | `degraded` | Structural baseline clean. No 7-gate validation. No live trace coverage. Compile path untested. |
| Business Brand Launch         | `degraded` | Structural baseline clean. No 7-gate validation. No live trace coverage. Compile path untested. |
| Product Brand Launch          | `degraded` | Structural baseline clean. No 7-gate validation. No live trace coverage. Compile path untested. |
| Artist / Creator Brand Launch | `degraded` | Structural baseline clean. No 7-gate validation. No live trace coverage. Compile path untested. |
| Campaign Brand Launch         | `degraded` | Structural baseline clean. No 7-gate validation. No live trace coverage. Compile path untested. |

**Explicit gaps:**

1. No 7-gate archetype validation run for BrandLaunch.
2. No live trace fixture set exists for BrandLaunch.
3. Action compile path not verified against engine output (identity/messaging
   action classes exist in grammar; not confirmed to emit correctly through
   compiler).
4. Initial P.O.S. numeric path not validated for any BrandLaunch lane.
5. Recovery/renegotiation options not validated for BrandLaunch lanes.

**Closure requirement:** Run 7-gate validation for BrandLaunch using a
representative goal (Personal Brand Launch recommended as highest-frequency
lane). Acceptance proof: all 7 gates PASS.

---

### SalesPipeline — Sales Execution (degraded)

| Lane                                   | State      | Notes                                                                                           |
| -------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| B2B Service Sales                      | `degraded` | Structural baseline clean. No 7-gate validation. No live trace coverage. Compile path untested. |
| B2C Product Sales                      | `degraded` | Structural baseline clean. No 7-gate validation. No live trace coverage. Compile path untested. |
| High-Ticket Consultative Sales         | `degraded` | Structural baseline clean. No 7-gate validation. No live trace coverage. Compile path untested. |
| Retail / Local Offer Sales             | `degraded` | Structural baseline clean. No 7-gate validation. No live trace coverage. Compile path untested. |
| Subscription / Recurring Revenue Sales | `degraded` | Structural baseline clean. No 7-gate validation. No live trace coverage. Compile path untested. |

**Explicit gaps:**

1. No 7-gate archetype validation run for SalesPipeline.
2. No live trace fixture set exists for SalesPipeline.
3. Action compile path not verified. Sales action classes (prospecting,
   outreach, qualification, close) exist in grammar but engine output not
   confirmed.
4. Conversion-stage actions involve external mediation (deal acceptance by
   counterparty); P.O.S. truth model for externally-gated sales stages not
   validated.
5. Recovery/renegotiation options not validated for SalesPipeline lanes.

**Closure requirement:** Run 7-gate validation for SalesPipeline using a
representative goal (B2B Service Sales recommended). Acceptance proof: all 7
gates PASS. Secondary requirement: confirm P.O.S. truth model correctly reflects
external-evidence dependency for conversion-stage gates.

---

### Fundraising — Capital Formation (degraded)

| Lane                            | State      | Notes                                                                                                 |
| ------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| Friends and Family Raise        | `degraded` | Structural baseline clean. Live trace coverage in newly migrated set. 7-gate validation not complete. |
| Angel Raise                     | `degraded` | Structural baseline clean. Live trace coverage in newly migrated set. 7-gate validation not complete. |
| Seed Round Raise                | `degraded` | Structural baseline clean. Live trace coverage in newly migrated set. 7-gate validation not complete. |
| Grant / Non-Dilutive Funding    | `degraded` | Structural baseline clean. Live trace coverage in newly migrated set. 7-gate validation not complete. |
| Sponsorship / Partnership Raise | `degraded` | Structural baseline clean. Live trace coverage in newly migrated set. 7-gate validation not complete. |

**Explicit gaps:**

1. No 7-gate archetype validation run for Fundraising.
2. Live trace fixture set exists (`newlyMigrated` set, 5 inputs) but 7-gate
   matrix not run against it.
3. Fundraising involves externally mediated commitment (investor/donor
   decision); P.O.S. truth model for externally-gated commitment stages not
   validated.
4. Recovery/renegotiation options not validated for Fundraising lanes.

**Closure path (shortest of the three degraded families):** Live trace inputs
already exist. Run 7-gate validation using existing fixture set. Acceptance
proof: all 7 gates PASS for at least one Fundraising lane.

---

## Summary

| State      | Lane Count | Archetype Count |
| ---------- | ---------- | --------------- |
| `pass`     | 30         | 6               |
| `degraded` | 15         | 3               |
| `blocked`  | 0          | 0               |

**Total:** 45 lanes / 9 archetypes.

---

## Cross-Archetype Corrections (Non-Blocking, Open)

These corrections apply across validated archetypes and are tracked here as
explicit items, not vague backlog:

| ID    | Correction                                                                                             | Scope                                                | Status                                        |
| ----- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------- |
| C-001 | Add dedicated `JOB_SEARCH_PIPELINE` action category to replace VENTURE_LAUNCH mapping                  | JobSearchPipeline (all 5 lanes)                      | Open — non-blocking                           |
| C-002 | Manual live freeze audit pending for TV Writing, Venture Launch, Job Search Pipeline                   | CreativeProduction, VentureLaunch, JobSearchPipeline | Open — required before final freeze promotion |
| C-003 | Keep unsupported option honesty for scope reduction until canonical scope-mutation contract is defined | All archetypes                                       | Open — non-blocking                           |
| C-004 | Continue calibration of overload thresholds with live usage data across archetypes                     | All archetypes                                       | Open — non-blocking                           |

---

## Governance Rule

**This document is the authoritative per-lane maturity record for the
canonical 45.**

- Update lane state to `pass` only after the archetype clears 7-gate validation.
- Update `degraded` gaps when new evidence is produced.
- Promote `blocked` to `degraded` only when structural grammar is locked in the
  canonical matrix.
- Do not remove a gap from a `degraded` lane without a passing proof.
