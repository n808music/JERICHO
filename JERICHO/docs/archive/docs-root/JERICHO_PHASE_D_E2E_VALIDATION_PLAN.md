# Phase D — 9-Archetype End-to-End Chain Validation

**Phase D of the Pre-Agent Hardening Sequence** **Prerequisite: Phase C complete
(see `JERICHO_PHASE_C_CLOSURE.md`)**

---

## Objective

Phase B proved that classification is honest. Phase C proved that composition is
bounded and additive. Phase D proves that the full execution chain works
correctly for each of the 9 archetypes, across both single-archetype and
composed goals.

**What Phase D must prove:** A representative goal for each archetype can travel
the full chain without a break — from classification through deliverable
generation, scheduling, and P.O.S. trust derivation — and produce the right
output at each layer.

**What Phase D does NOT need to prove:** UI correctness, multi-cycle
progression, learning and calibration, or agent integration. Those are Phase E
and Phase F concerns.

---

## The Chain

The end-to-end chain for Phase D validation is:

```
raw goal text
  → [1] classification     classifyLiveInputToArchetype()
  → [2] admission          goalAdmission + GoalAdmissionPolicy
  → [3] composition        detectSecondaryArchetype() (if applicable)
  → [4] deliverables       compileGoalToDeliverables()
  → [5] scheduling         compileAutoAsanaPlan() / draftSchedule
  → [6] P.O.S. scoring     scoreGoalSuccessProbability()
  → [7] trust gate         externally-mediated only: qualifying external evidence gates trust
```

For composed goals, Layer 3 is non-null and Layer 4 includes bridge
deliverables.

**A chain break is any point where a downstream layer receives invalid or empty
input from the layer above.** The chain break definitions are in the Failure
Definitions section.

---

## What Is Already Proven

The following chain layers have existing test coverage. Phase D does not need to
re-prove these in isolation — but must verify they hold end-to-end across all 9
archetypes.

| Layer                                      | Existing Coverage                   | Files                                                        |
| ------------------------------------------ | ----------------------------------- | ------------------------------------------------------------ |
| Classification (Layer 1)                   | 29 unit tests, all archetypes       | `classifyLiveInputToArchetype.unit.test.ts`                  |
| Live-trace evaluation (all 8 gates)        | 28 tests across 4 fixture groups    | `archetypeLiveTrace.*`                                       |
| goalContract shape/validation              | 3 test files                        | `goalContract.{test,resolve,governance}.test.js`             |
| Deliverable generation (general)           | 9 test files                        | `goalToDeliverables.*`                                       |
| Schedule generation from work windows      | Multiple                            | `schedule.generatesFromWorkWindows.*`, `schedule.generate.*` |
| Apply draft schedule                       | Covered                             | `applyDraftSchedule.canonicalSource.test.js`                 |
| P.O.S. trust lifecycle                     | Covered                             | `pos.trustState.lifecycle.test.js`                           |
| P.O.S. external evidence trust gate        | Covered for JSP, Fundraising, Sales | `pos.externalEvidence.trustGate.test.js`                     |
| P.O.S. display policy                      | Covered                             | `pos.displayPolicy.test.js`                                  |
| Recovery baseline                          | Multiple                            | `recovery*.test.*`                                           |
| Composition detection                      | 23 tests                            | `compositionDetector.unit.test.ts`                           |
| Bridge deliverable injection               | 11 tests                            | `goalToDeliverables.*`                                       |
| Single pipeline integration (Fundraising)  | Covered                             | `singlePipeline.postFix.integration.test.ts`                 |
| Goal admission + execution graph bootstrap | Covered                             | `attemptGoalAdmission.executionGraphBootstrap.test.js`       |

**What is NOT yet covered end-to-end per archetype:**

- Archetype-stratified chain from classification → deliverables → schedule →
  P.O.S.
- GenericStructured.TVWriting through the full chain (TVWriting has no
  single-pipeline integration test)
- Composed goal through the full chain (bridge deliverables in the schedule
  path)
- The P.O.S. primary-only rule validated end-to-end under a composed contract
  (CP-002 specifically)

---

## Representative Scenarios

One scenario per archetype. The goal text is canonical, unambiguous, and matches
the existing live-trace fixture set where possible.

### Group 1 — Internally Controlled (6 archetypes)

| #     | Archetype                   | Goal text                                             | Deadline | Chain layers to prove |
| ----- | --------------------------- | ----------------------------------------------------- | -------- | --------------------- |
| SC-01 | ProfessionalQualification   | "Pass the AWS Solutions Architect certification exam" | 60 days  | 1–6                   |
| SC-02 | VentureLaunch               | "Build and launch an MVP for a startup product"       | 90 days  | 1–6                   |
| SC-03 | GenericStructured.TVWriting | "Write a pilot script for a new TV show season"       | 90 days  | 1–6                   |
| SC-04 | PhysicalTraining            | "Run a 5k and build a strength training program"      | 90 days  | 1–6                   |
| SC-05 | CreativeProduction          | "Record and publish a 10-episode podcast"             | 60 days  | 1–6                   |
| SC-06 | BrandLaunch                 | "Define brand identity and visual positioning"        | 60 days  | 1–6                   |

For these archetypes: P.O.S. must reach `eligible` or `trusted` based on
internal execution evidence alone. No external evidence gate applies.

### Group 2 — Externally Mediated (3 archetypes)

| #     | Archetype         | Goal text                                                         | Deadline | Chain layers to prove |
| ----- | ----------------- | ----------------------------------------------------------------- | -------- | --------------------- |
| SC-07 | JobSearchPipeline | "Submit 20 job applications and prepare for PM role interviews"   | 90 days  | 1–6 + Layer 7         |
| SC-08 | Fundraising       | "Raise an angel round with investor deck and diligence data room" | 90 days  | 1–6 + Layer 7         |
| SC-09 | SalesPipeline     | "Build B2B sales pipeline and close service client deals"         | 90 days  | 1–6 + Layer 7         |

For these archetypes: P.O.S. must prove:

1. With internal execution evidence only → `trustState = 'provisional'`
2. With at least one qualifying external evidence event →
   `trustState = 'trusted'`

Each archetype has its own qualifying stages (authoritative source:
`QUALIFYING_EXTERNAL_STAGES` in `probabilityScore.ts`).

### Group 3 — Composed Goals (2 scenarios)

| #     | Composition pair                     | Goal text                                                  | Primary archetype | Why this scenario                                                                                      |
| ----- | ------------------------------------ | ---------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| SC-C1 | CP-002 (VentureLaunch + Fundraising) | "Build my startup MVP and raise an angel seed round"       | VentureLaunch     | Tests P.O.S. primary-only rule: primary is internally_controlled despite externally_mediated secondary |
| SC-C2 | CP-004 (JobSearchPipeline + PQ)      | "Job search for PM roles while studying for AWS cert exam" | JobSearchPipeline | Tests PARALLEL injection: bridge deliverables schedule independently without primary dependency        |

For SC-C1: `familyClass` on the goalContract must be `internally_controlled`.
Bridge deliverables link after `define:001:deck`. For SC-C2: `familyClass` on
the goalContract must be `externally_mediated`. Bridge deliverables have no
primary dependency.

---

## Chain Layer Validation per Scenario

This matrix defines what must be true at each layer for each scenario group.

### Layer 1 — Classification

| Requirement                                                             | Failure condition                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `classifyLiveInputToArchetype(goalText)` returns the expected archetype | Returns wrong archetype or `UNKNOWN` for a canonical scenario input |

Already proven for all 9 canonical inputs by Phase B. Phase D verifies the same
inputs pass through the full chain without break.

### Layer 2 — Admission

| Requirement                                                            | Failure condition                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `executionType` on admitted goalContract matches the classifier output | executionType missing or mismatches classifier                                        |
| `familyClass` is set correctly per archetype family                    | `familyClass` absent, or `externally_mediated` for an internally-controlled archetype |
| `deadlineISO` / `endDayKey` is populated and valid                     | Deadline absent or unparseable                                                        |

### Layer 3 — Composition (composed scenarios only)

| Requirement                                                                | Failure condition                                                                   |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `compositeGrammar` present on the contract for SC-C1 and SC-C2             | `compositeGrammar` absent when goal text contains secondary signals above threshold |
| `compositeGrammar.pairId` matches expected pair                            | Wrong pair detected                                                                 |
| `compositeGrammar.injectionPoint` is the correct action ID or `'PARALLEL'` | Wrong injection point                                                               |
| For all single-archetype scenarios: `compositeGrammar` absent              | `compositeGrammar` populated on a single-archetype input                            |

### Layer 4 — Deliverable Generation

| Requirement                                                           | Failure condition                                                                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `usesCanonicalDeliverablePath = true`                                 | Legacy fallback used for a migrated executionType with non-zero actions            |
| `deliverables.length >= 1`                                            | Zero deliverables generated                                                        |
| All deliverables pass `isCanonicalDeliverable()`                      | Missing title, definitionOfDone, or acceptanceCriteria                             |
| No deliverable title matches `PHASE_LABEL_PATTERN`                    | Phase labels leaked into deliverable titles                                        |
| `estimatedSessionCount >= 1`                                          | Zero session estimate                                                              |
| For composed scenarios: bridge deliverables present                   | Bridge deliverables absent when compositeGrammar is set                            |
| For CP-004 (PARALLEL): bridge deliverables have empty `dependencyIds` | Bridge deliverables linked to a primary deliverable when injectionPoint = PARALLEL |

### Layer 5 — Schedule Generation

| Requirement                                                                                | Failure condition                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `proposedBlocks.length >= 1` for a cycle with valid work windows and non-zero deliverables | Zero blocks proposed                             |
| All proposed blocks have `dayKey` within the cycle's start/end window                      | Blocks outside cycle boundary                    |
| For composed scenarios: bridge deliverables represented in the scheduling horizon          | Bridge deliverables are unknown to the scheduler |

### Layer 6 — P.O.S. Scoring

| Requirement                                                                                                                             | Failure condition                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `scoreGoalSuccessProbability()` returns a result without error                                                                          | Error returned or null score                       |
| `trustState` is one of the valid states (`aspirational`, `provisional`, `eligible`, `trusted`, `at_risk`)                               | Unknown trust state                                |
| For internally_controlled archetypes with execution activity: `trustState` can reach `eligible` or `trusted` on internal evidence alone | Stuck at `aspirational` despite execution evidence |
| For externally_mediated archetypes: `trustState = 'provisional'` until qualifying external evidence arrives                             | Wrong trust state without external evidence        |

### Layer 7 — External Evidence Trust Gate (SC-07, SC-08, SC-09 only)

| Requirement                                                                                          | Failure condition                                               |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| With 7 days of internal completion evidence + 0 external evidence: `trustState = 'provisional'`      | Trust reaches `eligible` or `trusted` without external evidence |
| After adding one qualifying external evidence event: `trustState = 'trusted'`                        | Trust stays `provisional` after qualifying evidence             |
| Qualifying stage varies per archetype — must use the correct stage from `QUALIFYING_EXTERNAL_STAGES` | Upgrade triggered by wrong stage name                           |

---

## End-to-End Failure Definitions

A scenario fails Phase D validation if any of the following conditions are met:

| Failure code | Condition                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `D-FAIL-01`  | `usesCanonicalDeliverablePath = false` for a migrated executionType with non-zero actions                                    |
| `D-FAIL-02`  | `deliverables.length = 0` after successful classification of a known migrated archetype                                      |
| `D-FAIL-03`  | Any deliverable in the output fails `isCanonicalDeliverable()`                                                               |
| `D-FAIL-04`  | `proposedBlocks.length = 0` for a cycle with valid work windows and non-zero deliverables                                    |
| `D-FAIL-05`  | `trustState = 'trusted'` for an externally_mediated goal with zero qualifying external evidence events                       |
| `D-FAIL-06`  | `trustState` stays `'provisional'` after one qualifying external evidence event is present                                   |
| `D-FAIL-07`  | `familyClass` on the goalContract is `externally_mediated` for an internally_controlled primary archetype in a composed goal |
| `D-FAIL-08`  | Bridge deliverables absent from the deliverable list when `compositeGrammar` is populated                                    |
| `D-FAIL-09`  | CP-004 bridge deliverables have non-empty `dependencyIds` (should be PARALLEL / no dependency)                               |
| `D-FAIL-10`  | Classification returns wrong archetype or `UNKNOWN` for a canonical scenario input                                           |

---

## What Phase D Does NOT Need to Prove

| Topic                                                   | Reason deferred                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Multi-cycle progression (cycle rollover, carry-forward) | Phase E scope                                                                                        |
| Learning and calibration after multiple cycles          | Phase E scope                                                                                        |
| UI rendering correctness per archetype                  | Frontend concern, not chain integrity                                                                |
| Recovery recommendation quality under realistic drift   | `recovery*.test.*` already covers the baseline; Phase E validates under archetype-specific scenarios |
| 3-way composition (3 archetypes)                        | Not supported in 1.0 (Phase C limitation CP-LIM-005)                                                 |
| GenericStructured.TVWriting as secondary in composition | Not supported in 1.0                                                                                 |
| Agent integration and LLM call quality                  | Phase F scope                                                                                        |
| Performance under load                                  | Stress tests already exist separately                                                                |

---

## Acceptance Test Structure

Phase D adds three test files, one per scenario group:

### `tests/state/e2eChain.internallyControlled.test.ts`

Covers SC-01 through SC-06. Uses `getRepresentativeGoals1_0()` fixture data
where available.

Each scenario:

1. Calls `classifyLiveInputToArchetype()` → asserts correct archetype
2. Builds a minimal admitted goalContract with correct `executionType`,
   `familyClass`, valid deadline
3. Calls `compileGoalToDeliverables()` with base actions from
   `BASE_ACTIONS_BY_ARCHETYPE`
4. Asserts Layer 4 requirements
5. Calls `compileAutoAsanaPlan()` with minimal work windows
6. Asserts Layer 5 requirements (≥1 proposed block, within window)
7. Calls `scoreGoalSuccessProbability()` with execution activity
8. Asserts Layer 6 requirements (trustState can reach eligible/trusted on
   internal evidence)

### `tests/state/e2eChain.externallyMediated.test.ts`

Covers SC-07, SC-08, SC-09. Uses the same harness pattern as
`pos.externalEvidence.trustGate.test.js`.

Each scenario runs twice:

- Pass A: with execution evidence + zero external evidence →
  `trustState = 'provisional'`
- Pass B: with execution evidence + one qualifying external evidence event →
  `trustState = 'trusted'`

Qualifying stage per archetype:

- JobSearchPipeline: `'recruiter_reply'`
- Fundraising: `'investor_reply'`
- SalesPipeline: `'qualified_response'`

### `tests/state/e2eChain.composed.test.ts`

Covers SC-C1 and SC-C2.

SC-C1 (CP-002):

1. Classifies to VentureLaunch
2. `detectSecondaryArchetype()` returns CP-002
3. GoalContract has `executionType = 'VentureLaunch'`,
   `familyClass = 'internally_controlled'`,
   `compositeGrammar = { secondary: 'Fundraising', pairId: 'CP-002', ... }`
4. `compileGoalToDeliverables()` produces primary deliverables + 2 bridge
   deliverables
5. Bridge deliverable for CP-002 links to the deliverable containing
   `define:001:deck`
6. P.O.S. `familyClass` is `internally_controlled` — trust gate is internal, not
   external

SC-C2 (CP-004):

1. Classifies to JobSearchPipeline
2. `detectSecondaryArchetype()` returns CP-004
3. GoalContract has `executionType = 'JobSearchPipeline'`,
   `familyClass = 'externally_mediated'`,
   `compositeGrammar = { secondary: 'ProfessionalQualification', pairId: 'CP-004', injectionPoint: 'PARALLEL' }`
4. `compileGoalToDeliverables()` produces primary deliverables + bridge
   deliverables with empty `dependencyIds`
5. P.O.S. `familyClass` is `externally_mediated` — external evidence gate
   applies

---

## Regression Guard

All of the following test suites must remain green throughout Phase D
implementation:

| Suite                                       | Count    | Standard         |
| ------------------------------------------- | -------- | ---------------- |
| `classifyLiveInputToArchetype.unit.test.ts` | 29       | Zero regressions |
| `archetypeLiveTrace.*` all groups           | 28       | Zero regressions |
| `compositionDetector.unit.test.ts`          | 23       | Zero regressions |
| `goalToDeliverables.*`                      | 11       | Zero regressions |
| `pos.externalEvidence.trustGate.test.js`    | Existing | Zero regressions |
| `pos.trustState.lifecycle.test.js`          | Existing | Zero regressions |

---

## Fixture Invariants

These rules apply to every Phase D harness fixture without exception. Violating
them produces false negatives or false ambiguity in trust-critical assertions.

| Invariant | Rule                                                                                                                                                            | Why                                                                                                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FI-01     | `executionType` must be the stored primary archetype form, not a subtype alias                                                                                  | `GenericStructured.TVWriting` is derived by `deriveExecutionTypeKey()` — storing it directly bypasses the routing logic. Store `'GenericStructured'` and set `goalText` / action text to match `TV_WRITING_PATTERN`.            |
| FI-02     | `familyClass` must always be set explicitly on `cycle.goalContract`                                                                                             | `resolveGoalFamilyInfo()` reads from `contract?.familyClass`. Absent → `null` → `isExternallyMediated = false` regardless of archetype. All tests would silently treat externally_mediated archetypes as internally controlled. |
| FI-03     | Externally-mediated scenarios must specify the exact qualifying stage from `QUALIFYING_EXTERNAL_STAGES`                                                         | Using the wrong stage name produces a false positive (trust stays provisional even with evidence). Each archetype has a different set.                                                                                          |
| FI-04     | Composed scenarios must specify both primary archetype (stored `executionType`) and `compositeGrammar` with correct `pairId`, `secondary`, and `injectionPoint` | Missing `compositeGrammar` means bridge deliverables are not injected. Test would silently assert the wrong deliverable set.                                                                                                    |
| FI-05     | No scenario may rely on implicit defaults for deadline, work windows, or governance contract                                                                    | `scoreGoalSuccessProbability` requires a governance contract with `probabilityEnabled: true`. Scheduler requires explicit `weeklyWindows` for `hasExplicitWeeklyWindows()` to return true.                                      |

These invariants are enforced by `tests/state/e2eChain.harness.ts`, which
provides the shared builder functions. Tests must use the harness builders
rather than inline objects for trust-critical fields.

---

## Implementation Sequence

1. **Write `e2eChain.internallyControlled.test.ts`** — 6 scenarios × Layers 1–6
   - Use `BASE_ACTIONS_BY_ARCHETYPE` from `archetypeLiveTraceEvaluation.ts` for
     action input
   - GenericStructured.TVWriting requires extra care:
     `executionType = 'GenericStructured'` + TV-matching contract text triggers
     `GenericStructured.TVWriting` path in `deriveExecutionTypeKey()`
2. **Run and diagnose** — identify any chain breaks per archetype
3. **Fix narrowly** — do not change production code broadly; fix only confirmed
   breaks
4. **Write `e2eChain.externallyMediated.test.ts`** — 3 scenarios × Layers 1–7
5. **Write `e2eChain.composed.test.ts`** — 2 composed scenarios
6. **Regression guard** — run full Phase A/B/C suite, confirm zero regressions
7. **Write `JERICHO_PHASE_D_CLOSURE.md`** — final test counts, any
   narrowly-scoped fixes, limitation inventory

---

## Key Architectural Notes for Phase D Tests

**GenericStructured.TVWriting routing:** `deriveExecutionTypeKey()` in
`goalToDeliverables.ts` handles `GenericStructured` via pattern matching against
action text + contract text. The test contract must include TV-pattern text
(`tv`, `show`, `script`, `pilot`) in `goalText` or action titles for the
TVWriting path to activate. Use `executionType = 'GenericStructured'` in the
admitted contract, not `GenericStructured.TVWriting` (the latter is derived, not
stored).

**familyClass setting:** `familyClass` is set on `cycle.goalContract` at
admission time and read by `probabilityScore.ts` via `resolveGoalFamilyInfo()`.
Phase D tests must set `familyClass` explicitly in the harness state to match
the primary archetype's family. Mapping:

- internally_controlled: ProfessionalQualification, VentureLaunch,
  GenericStructured.TVWriting, PhysicalTraining, CreativeProduction, BrandLaunch
- externally_mediated: JobSearchPipeline, SalesPipeline, Fundraising

**compositeGrammar on goalContract:** Set
`cycle.goalContract.compositeGrammar = { secondary, pairId, detectionSignals, injectionPoint }`
in the harness state for composed scenario tests. `compileGoalToDeliverables()`
reads this field directly from the `contract` parameter.

**BASE_ACTIONS_BY_ARCHETYPE:** Available from `archetypeLiveTraceEvaluation.ts`.
These are the canonical 5-action sets used by the live trace evaluation engine.
They are the correct input for chain tests — not mock actions.

---

## Phase D Closure Criteria

Phase D is closed when:

- [ ] `e2eChain.internallyControlled.test.ts` exists and all 6 scenarios pass
      Layers 1–6
- [ ] `e2eChain.externallyMediated.test.ts` exists and all 3 scenarios pass
      Layers 1–7 including trust gate
- [ ] `e2eChain.composed.test.ts` exists and SC-C1 and SC-C2 pass all chain
      layers
- [ ] All 3 family class variants validated: internally_controlled,
      externally_mediated (provisional), externally_mediated (trusted after
      evidence)
- [ ] Zero regressions in Phase A/B/C test suites
- [ ] `JERICHO_PHASE_D_CLOSURE.md` written with final test counts, any fixes
      applied, and known limitations
