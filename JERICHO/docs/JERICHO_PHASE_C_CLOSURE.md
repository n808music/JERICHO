# Phase C Closure — Bounded Composition Support

**Status: COMPLETE** **Closed: 2026-03-25**

---

## What Phase C Was

Phase C added bounded composition support: the ability to detect, store, and
route goals that have a primary execution grammar AND a meaningful secondary
grammar worth preserving.

The guiding constraint: composition must never make a correctly-classified
single-archetype goal worse. All additions are additive, not corrective.

The completion boundary rule: Secondary grammar may enrich the path, but may not
redefine the primary completion boundary in 1.0. Bridge deliverables may depend
on primary actions; primary actions may never depend on bridge deliverables.

---

## Files Changed

### `JERICHO/src/state/engine/compositionDetector.ts` (new)

Complete implementation of the bounded composition layer:

**Types exported:**

- `CompositionPairId` — union of `'CP-001' | 'CP-002' | 'CP-003' | 'CP-004'`
- `SupportedCompositionPair` — return type of `detectSecondaryArchetype()`,
  includes `primary`, `secondary`, `pairId`, `detectionSignals`,
  `injectionPoint`
- `CompositeGrammarMetadata` — shape of the `compositeGrammar` goalContract
  field: `secondary`, `pairId`, `detectionSignals`, `injectionPoint`
- `BridgeDeliverableSpec` — per-deliverable bridge spec with dependency linkage
  flags

**Constants exported:**

- `MAX_BRIDGE_DELIVERABLES = 3` — enforced maximum bridge deliverables per pair
- `BRIDGE_DELIVERABLES_BY_PAIR` — catalog of 2 bridge deliverables per pair (all
  4 pairs)

**Function exported:**

- `detectSecondaryArchetype(goalText, primary): SupportedCompositionPair | null`
  - Returns `null` if primary is not in a supported pairing or secondary signals
    are below threshold
  - Does NOT modify classification; primary remains the output of
    `classifyLiveInputToArchetype()`

**Injection points per pair:** | Pair | Injection point | | --- | --- | | CP-001
(VentureLaunch + BrandLaunch) | `define:001:deck` | | CP-002 (VentureLaunch +
Fundraising) | `define:001:deck` | | CP-003 (BrandLaunch + CreativeProduction) |
`asset:002:brand-kit` | | CP-004 (JobSearchPipeline + ProfessionalQualification)
| `PARALLEL` |

### `JERICHO/src/state/engine/goalToDeliverables.ts` (updated)

Bridge deliverable injection added to `compileGoalToDeliverables()`:

1. Primary deliverables generated as normal (full set, unchanged path)
2. Compiler checks `contract?.compositeGrammar` for presence of `pairId` and
   `injectionPoint`
3. If present: looks up bridge specs from `BRIDGE_DELIVERABLES_BY_PAIR[pairId]`
4. For each bridge spec:
   - If `dependsOnInjectionPoint` and a primary deliverable contains the
     injection point action ID → link `dependencyIds` to that deliverable
   - If `dependsOnPrevBridge` → link to the immediately preceding bridge
     deliverable
   - CP-004 (`PARALLEL`): neither flag set → bridge deliverables have no primary
     dependency
5. Bridge deliverables are appended after all primary deliverables
6. No changes to scaffold groups, action seeds, or primary deliverable
   generation path

### `JERICHO/tests/state/compositionDetector.unit.test.ts` (new)

23 tests across 6 describe blocks:

1. **Tier 1 — Detection (4 tests, CC-001 to CC-004):** canonical multi-archetype
   inputs → correct pair returned
2. **Tier 2 — Non-detection (4 tests, CN-001 to CN-004):** single-archetype
   inputs → `null`
3. **Tier 3 — Unsupported pairing fallback (2 tests, CX-001 to CX-002):**
   unsupported pairings → `null`
4. **Tier 4 — goalContract field shape (4 tests, CF-001 to CF-004):** shape
   validation on CP-002 as reference
5. **Tier 5 — P.O.S. primary-only rule (2 tests, CP-POS-001 to CP-POS-002):**
   family class derivation rule
6. **Threshold boundary (4 tests):** single-signal inputs below threshold →
   `null` (with CP-003 exception documented)
7. **Bridge deliverable catalog integrity (3 tests):** catalog structure guard

---

## Detection Tests (Tier 1–3) Closed

### Tier 1 — Detection

| Test ID | Input                                                          | Primary           | Expected pair                                         | Result   |
| ------- | -------------------------------------------------------------- | ----------------- | ----------------------------------------------------- | -------- |
| CC-001  | "build my startup MVP and launch with a strong brand identity" | VentureLaunch     | CP-001 (VentureLaunch, BrandLaunch)                   | ✓ CLOSED |
| CC-002  | "launch my product and raise an angel seed round"              | VentureLaunch     | CP-002 (VentureLaunch, Fundraising)                   | ✓ CLOSED |
| CC-003  | "define my brand identity system and launch a weekly podcast"  | BrandLaunch       | CP-003 (BrandLaunch, CreativeProduction)              | ✓ CLOSED |
| CC-004  | "job search for PM roles while studying for AWS cert exam"     | JobSearchPipeline | CP-004 (JobSearchPipeline, ProfessionalQualification) | ✓ CLOSED |

### Tier 2 — Non-detection

| Test ID | Input                                                             | Primary           | Expected | Result   |
| ------- | ----------------------------------------------------------------- | ----------------- | -------- | -------- |
| CN-001  | "build and launch an MVP for a startup"                           | VentureLaunch     | null     | ✓ CLOSED |
| CN-002  | "define brand identity and visual positioning"                    | BrandLaunch       | null     | ✓ CLOSED |
| CN-003  | "submit job applications and prep for interviews"                 | JobSearchPipeline | null     | ✓ CLOSED |
| CN-004  | "raise an angel round with investor deck and diligence data room" | Fundraising       | null     | ✓ CLOSED |

### Tier 3 — Unsupported pairing fallback

| Test ID | Input                                                              | Observation                                           | Result   |
| ------- | ------------------------------------------------------------------ | ----------------------------------------------------- | -------- |
| CX-001  | "build sales pipeline and close deals while raising angel funding" | SalesPipeline + Fundraising → null (unsupported)      | ✓ CLOSED |
| CX-002  | "launch startup brand and run a physical training program"         | VentureLaunch + PhysicalTraining → null (unsupported) | ✓ CLOSED |

### Tier 4 — goalContract field shape

| Test ID | Assertion                                                           | Result   |
| ------- | ------------------------------------------------------------------- | -------- |
| CF-001  | `compositeGrammar.secondary` is correct MigratedArchetype           | ✓ CLOSED |
| CF-002  | `compositeGrammar.pairId` is correct pair ID (CP-XXX format)        | ✓ CLOSED |
| CF-003  | `compositeGrammar.detectionSignals` is a non-empty array of strings | ✓ CLOSED |
| CF-004  | `compositeGrammar.injectionPoint` is a non-empty string             | ✓ CLOSED |

### Tier 5 — P.O.S. primary-only rule

| Test ID    | Assertion                                                                                                                                                | Result   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| CP-POS-001 | CP-002: primary is VentureLaunch (internally_controlled), secondary is Fundraising (externally_mediated) — primary governs familyClass                   | ✓ CLOSED |
| CP-POS-002 | CP-004: primary is JobSearchPipeline (externally_mediated), secondary is ProfessionalQualification (internally_controlled) — primary governs familyClass | ✓ CLOSED |

---

## Final Test Counts

| Suite                                        | Tests | Status                      |
| -------------------------------------------- | ----- | --------------------------- |
| `compositionDetector.unit.test.ts`           | 23/23 | All pass                    |
| `classifyLiveInputToArchetype.unit.test.ts`  | 29/29 | All pass (zero regressions) |
| `archetypeLiveTrace.*` all groups (28 files) | 28/28 | All pass (zero regressions) |
| `goalToDeliverables.*` (9 files)             | 11/11 | All pass (zero regressions) |

---

## Known Limitations Accepted for 1.0

| Limitation | Description                                                                                                          | Accepted?                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| CP-LIM-001 | VentureLaunch+Fundraising: Fundraising is secondary, so investor commitment evidence does NOT gate P.O.S. to trusted | Yes — dual P.O.S. is Phase E                                                                                           |
| CP-LIM-002 | Bridge deliverables use fixed injection points, not dynamically inferred from action graph                           | Yes — dynamic injection requires compiler-level composition                                                            |
| CP-LIM-003 | If injection point action does not exist in generated graph, bridge deliverables fall to end with no dependency link | Yes — acceptable fallback behavior                                                                                     |
| CP-LIM-004 | Unsupported pairings (SalesPipeline+Fundraising, etc.) return null and use primary-only routing                      | Yes — 4 supported pairs is the bounded scope                                                                           |
| CP-LIM-005 | No composition for GenericStructured.TVWriting, PhysicalTraining as secondary                                        | Yes — domain specificity prevents useful bridging                                                                      |
| CP-LIM-006 | `cert` substring fires within `certification` — two PQ tokens hit from one word                                      | Yes — known behavior, CP-004 threshold of 2 is still met correctly for canonical inputs; documented in test commentary |

---

## Behavioral Contract (Final State)

**Detection:**

- `detectSecondaryArchetype(goalText, primary)` runs AFTER the primary
  classifier returns
- Returns `SupportedCompositionPair | null` — additive, never modifies
  `executionType`
- 4 supported pairs only: CP-001 through CP-004

**goalContract extension:**

- `compositeGrammar?: CompositeGrammarMetadata` — optional, additive field
- Systems that do not read `compositeGrammar` are completely unaffected
- `executionType` remains the primary archetype string

**Compiler:**

- Primary deliverables generated first, full set, unchanged path
- Bridge deliverables injected after primary set when `compositeGrammar` is
  present
- Bridge deliverables respect `dependsOnInjectionPoint` and
  `dependsOnPrevBridge` linkage flags
- CP-004 (`PARALLEL`): bridge deliverables have no primary dependency

**P.O.S.:**

- `familyClass` on goalContract is derived from primary archetype
- Secondary archetype family class does NOT apply — no dual scoring tracks
- This is the primary-only rule; dual P.O.S. is deferred to Phase E

---

## Phase Transition

**Phase C → COMPLETE** **Phase D → NEXT:** Full 9-archetype end-to-end
validation — demonstrate full execution chain (goal admission → deliverables →
scheduler → P.O.S.) for representative goals from all 9 archetypes. This
requires Phase C composition layer to be stable, which it now is.
