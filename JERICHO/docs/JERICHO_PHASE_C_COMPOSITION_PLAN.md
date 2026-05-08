# Phase C — Bounded Composition Support

**Phase C of the Pre-Agent Hardening Sequence** **Prerequisite: Phase B complete
(see `JERICHO_PHASE_B_CLOSURE.md`)**

---

## Objective

After Phase B, the classifier is honest for single-archetype goals. The
remaining ontology gap is goals that legitimately span two grammar families —
where a single execution type is technically correct but loses meaningful
secondary execution context.

Phase C adds bounded composition: the ability to detect, represent, and route
goals that have a primary execution grammar AND a distinct secondary grammar
worth preserving. It does not build a full parallel execution engine. It defines
how composition is detected, stored, and honored at each system layer without
destabilizing single-archetype behavior.

**The guiding constraint:** composition must never make a correctly-classified
single-archetype goal worse. It is additive, not corrective.

**The completion boundary rule:** Secondary grammar may enrich the path, but may
not redefine the primary completion boundary in 1.0. Bridge deliverables may
depend on primary actions; primary actions may never depend on bridge
deliverables.

---

## Why Bounded, Not Full

Full composition would mean:

- Two parallel action graphs
- Two P.O.S. scoring tracks
- Two scheduler integration paths
- Complex ordering rules between grammar families

That is a Phase E+ problem. It requires validated single-archetype end-to-end
chains first.

Bounded composition means:

- Primary archetype governs the full execution chain
- Secondary archetype contributes bridge deliverables at defined injection
  points
- P.O.S. follows the primary family class only
- No parallel dependency chains
- No mid-cycle reclassification

---

## Supported Pairings (1.0)

Four Tier A pairings are supported. These are the most common real-world
compositions and have compatible dependency structures.

| Pair ID | Primary           | Secondary                 | Rationale                                                                                                                 |
| ------- | ----------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| CP-001  | VentureLaunch     | BrandLaunch               | Building a company requires establishing its brand identity — brand work is a bridge deliverable within the venture build |
| CP-002  | VentureLaunch     | Fundraising               | Building the product and raising capital are tightly coupled — deck and investor materials parallel the venture build     |
| CP-003  | BrandLaunch       | CreativeProduction        | Identity must precede content — once brand is established, content production is the natural next grammar                 |
| CP-004  | JobSearchPipeline | ProfessionalQualification | Certification during job search strengthens candidacy — cert work is a parallel bridge deliverable                        |

### Why These Four

- All four pairings have clear primary/secondary hierarchy (the primary drives
  the critical timeline)
- All four have identifiable injection points where secondary deliverables enter
  the primary chain
- None create P.O.S. gating conflicts at the 1.0 level (see P.O.S. rules below)
- All four appear regularly in real goal text

### What Is Not Supported in 1.0

| Pairing                                      | Reason deferred                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| SalesPipeline + Fundraising                  | Both externally mediated — conflicting P.O.S. gates, no clear primary             |
| SalesPipeline + BrandLaunch                  | Real, but brand-as-primary is more honest — flip to CP-003 variant if brand leads |
| VentureLaunch + SalesPipeline                | High overlap; early-stage venture sales are part of venture grammar already       |
| Any 3-archetype composition                  | No structural support in 1.0; Phase E is the correct home                         |
| GenericStructured.TVWriting as any component | Domain-specific; composition adds noise without value                             |
| PhysicalTraining as secondary                | No cross-grammar bridge deliverables that make semantic sense                     |

---

## Primary vs. Secondary Grammar Rules

**Primary archetype:**

- Governs `executionType` in the goalContract (unchanged from single-archetype
  behavior)
- Drives the full action graph and dependency chain
- Governs `familyClass` and P.O.S. trust gating
- Defines the deadline horizon
- Cannot be changed mid-cycle

**Secondary archetype:**

- Stored in `compositeGrammar.secondary` in the goalContract (new field —
  additive)
- Contributes 2–3 bridge deliverables injected into the primary deliverable list
- Bridge deliverables are tagged `sourceArchetype: secondary`
- Bridge deliverables link to the primary chain at a defined injection point
  (see per-pair rules)
- The secondary does NOT create its own dependency chain
- The secondary does NOT produce a separate P.O.S. track
- The secondary does NOT alter the scheduler's view of block priority

---

## Detection Protocol

Composition detection is separate from the classifier. The classifier returns
the primary. A second function checks for secondary signals:

### Function contract

```typescript
type SupportedCompositionPair = {
  primary: MigratedArchetype;
  secondary: MigratedArchetype;
  pairId: 'CP-001' | 'CP-002' | 'CP-003' | 'CP-004';
};

function detectSecondaryArchetype(
  goalText: string,
  primary: MigratedArchetype
): SupportedCompositionPair | null;
```

Returns `null` if no supported secondary is detected. Returns the pair if
secondary signals meet the threshold.

### Detection rules per pair

**CP-001 (VentureLaunch + BrandLaunch):**

- Primary already returned `VentureLaunch`
- Secondary signal: `count(['brand', 'identity', 'positioning', 'visual']) >= 2`
- Example triggers: "launch a startup with a strong brand identity", "build my
  product and define the brand positioning"

**CP-002 (VentureLaunch + Fundraising):**

- Primary already returned `VentureLaunch` (with `ventureHits >= 2` blocking the
  Fundraising primary path)
- Secondary signal:
  `count(['angel', 'seed round', 'friends and family', 'grant', 'non-dilutive', 'sponsor', 'diligence', 'data room', 'raise', 'fundraising']) >= 2`
- Example triggers: "build my startup MVP and raise a seed round", "launch my
  product and close angel funding"

**CP-003 (BrandLaunch + CreativeProduction):**

- Primary already returned `BrandLaunch`
- Secondary signal:
  `count(['podcast', 'music', 'video', 'manuscript', 'longform', 'book', 'recording', 'editing', 'publish']) >= 1`
- Note: lower threshold because creative signal is specific and non-overlapping
  with brand tokens
- Example triggers: "build my brand identity and launch a podcast", "define
  visual identity and publish content"

**CP-004 (JobSearchPipeline + ProfessionalQualification):**

- Primary already returned `JobSearchPipeline`
- Secondary signal:
  `count(['cert', 'certification', 'exam', 'ccp', 'aws']) >= 2`
- Example triggers: "job search while studying for AWS cert exam", "apply for PM
  roles and get certified"

### Threshold rationale

Secondary detection thresholds match the minimum for primary classification.
This ensures that only goals with genuinely meaningful secondary signals are
composed — not goals where a secondary token appears incidentally.

The exception is CP-003 (CreativeProduction secondary with threshold=1) because
creative tokens are highly specific domain markers with minimal false-positive
risk.

---

## goalContract Extension

The composition result is stored as an optional field on the goalContract.
Existing shape is not changed.

```typescript
// New optional field added to cycle.goalContract
compositeGrammar?: {
  secondary: MigratedArchetype;
  pairId: 'CP-001' | 'CP-002' | 'CP-003' | 'CP-004';
  detectionSignals: string[];   // tokens that triggered secondary detection
  injectionPoint: string;       // primary action ID at which secondary deliverables inject
}
```

`executionType` remains the primary archetype string. `compositeGrammar` is
additive metadata. Systems that do not read `compositeGrammar` are unaffected.

---

## Per-Layer Behavior

### Admission

**Current:** goal admitted with single `executionType` and `familyClass`.

**Phase C:** after admission, `detectSecondaryArchetype(goalText, primary)`
runs. If a supported pair is found:

- `compositeGrammar` is written to the goalContract
- No other admission fields change
- If unsupported: `compositeGrammar` is not written; `executionType` is used
  as-is

Admission gates do not change. Composition is post-admission enrichment, not a
gate.

### Deliverables (goalToDeliverables compiler)

**Current:** compiler takes `executionType` → generates full deliverable set for
primary archetype.

**Phase C:** compiler checks for `compositeGrammar` in the contract. If present:

1. Generate primary deliverables as normal (full set)
2. Inject 2–3 bridge deliverables from the secondary grammar
3. Bridge deliverables are tagged `sourceArchetype: compositeGrammar.secondary`
4. Bridge deliverables link to the primary chain at
   `compositeGrammar.injectionPoint`

**Bridge deliverable count and injection points per pair:**

| Pair                           | Bridge deliverables                                                      | Injection point (primary action ID)                                 |
| ------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| CP-001 (Venture + Brand)       | "Brand positioning brief complete", "Visual identity direction complete" | After `define:001:deck` or equivalent narrative action              |
| CP-002 (Venture + Fundraising) | "Investor narrative materials complete", "Target investor list complete" | After `define:001:deck` (deck is shared narrative foundation)       |
| CP-003 (Brand + Creative)      | "First content production batch complete"                                | After `asset:002:brand-kit` (brand kit is the content prerequisite) |
| CP-004 (Job + PQ)              | "Certification exam completed", "Study schedule milestone reached"       | Parallel from start (cert work is concurrent, not dependent)        |

If `compositeGrammar.injectionPoint` refers to a primary action that does not
exist in the current action graph, bridge deliverables are appended at the end
of the primary deliverable list with no dependency link.

### Blocks and Schedule

**No change required at the scheduler layer.** The scheduler receives
deliverables + action seeds from the compiler and generates blocks. Bridge
deliverables are already in the deliverable list with proper injection links.
The scheduler treats them as regular deliverables.

Secondary bridge deliverables will generally schedule after their injection
point dependency in the primary chain. For CP-004, they schedule from the start
since they have no primary dependency.

### P.O.S.

**Rule: P.O.S. follows primary archetype exclusively.**

- `familyClass` on the goalContract is derived from the primary archetype
- `QUALIFYING_EXTERNAL_STAGES` gate applies only to the primary archetype
- If primary is `internally_controlled` (e.g., VentureLaunch), no external
  evidence gate applies — even if secondary is `externally_mediated` (e.g.,
  Fundraising)
- If primary is `externally_mediated` (e.g., JobSearchPipeline), external
  evidence gate applies per the primary's qualifying stages — secondary's stages
  do not add gates

**Why:** dual P.O.S. gating requires two independent trust tracks, separate
evidence models, and separate display policies. This is a Phase E concern. For
1.0, P.O.S. must remain a single coherent signal per goal.

**Implication for CP-002 (VentureLaunch + Fundraising):**

- Fundraising as secondary → `externally_mediated` family class is NOT applied
- P.O.S. is internally controlled (VentureLaunch primary)
- Investor commitments received do NOT unlock trusted via external evidence gate
- This is a known accepted limitation of 1.0 composition

---

## Acceptance Tests Required

### Tier 1 — Detection (4 tests, one per supported pair)

Each test: canonical multi-archetype goal text → `detectSecondaryArchetype()`
returns the correct pair.

| Test ID | Input                                                          | Expected pair                                         |
| ------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| CC-001  | "build my startup MVP and launch with a strong brand identity" | CP-001 (VentureLaunch, BrandLaunch)                   |
| CC-002  | "launch my product and raise an angel seed round"              | CP-002 (VentureLaunch, Fundraising)                   |
| CC-003  | "define my brand identity system and launch a weekly podcast"  | CP-003 (BrandLaunch, CreativeProduction)              |
| CC-004  | "job search for PM roles while studying for AWS cert exam"     | CP-004 (JobSearchPipeline, ProfessionalQualification) |

### Tier 2 — Non-detection (4 tests)

Each test: single-archetype input → `detectSecondaryArchetype()` returns null.

| Test ID | Input                                                             | Primary           | Expected |
| ------- | ----------------------------------------------------------------- | ----------------- | -------- |
| CN-001  | "build and launch an MVP for a startup"                           | VentureLaunch     | null     |
| CN-002  | "define brand identity and visual positioning"                    | BrandLaunch       | null     |
| CN-003  | "submit job applications and prep for interviews"                 | JobSearchPipeline | null     |
| CN-004  | "raise an angel round with investor deck and diligence data room" | Fundraising       | null     |

### Tier 3 — Unsupported pairing fallback (2 tests)

Each test: multi-archetype input with an unsupported pairing → returns null (not
a forced composition).

| Test ID | Input                                                              | Observation                                                   |
| ------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| CX-001  | "build sales pipeline and close deals while raising angel funding" | SalesPipeline + Fundraising → null (unsupported pairing)      |
| CX-002  | "launch startup brand and run a physical training program"         | VentureLaunch + PhysicalTraining → null (unsupported pairing) |

### Tier 4 — goalContract field correctness (4 tests)

Each test: after composition detection, `compositeGrammar` field has correct
shape.

| Test ID | Assertion                                                           |
| ------- | ------------------------------------------------------------------- |
| CF-001  | `compositeGrammar.secondary` is correct MigratedArchetype           |
| CF-002  | `compositeGrammar.pairId` is correct pair ID                        |
| CF-003  | `compositeGrammar.detectionSignals` is a non-empty array of strings |
| CF-004  | `compositeGrammar.injectionPoint` is a non-empty string             |

### Tier 5 — P.O.S. primary-only rule (2 tests)

| Test ID    | Assertion                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| CP-POS-001 | Composed VentureLaunch+Fundraising goal: P.O.S. `familyClass` = `internally_controlled` (primary wins)                           |
| CP-POS-002 | Composed JobSearchPipeline+PQ goal: P.O.S. `familyClass` = `externally_mediated` (primary wins), PQ external gate does not apply |

### Tier 6 — Regression guard

All existing tests must pass after Phase C implementation:

- 29 classification unit tests
- 28 liveTrace tests (all groups)
- 73 P.O.S. tests

---

## Known Limitations Accepted for 1.0

| Limitation | Description                                                                                                          | Accepted?                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| CP-LIM-001 | VentureLaunch+Fundraising: Fundraising is secondary, so investor commitment evidence does NOT gate P.O.S. to trusted | Yes — dual P.O.S. is Phase E                                |
| CP-LIM-002 | Bridge deliverables use fixed injection points, not dynamically inferred from action graph                           | Yes — dynamic injection requires compiler-level composition |
| CP-LIM-003 | If injection point action does not exist in generated graph, bridge deliverables fall to the end                     | Yes — acceptable fallback                                   |
| CP-LIM-004 | Unsupported pairings (including SalesPipeline+Fundraising) return null and use primary-only routing                  | Yes — 4 supported pairs is the bounded scope                |
| CP-LIM-005 | No composition for GenericStructured.TVWriting, PhysicalTraining as secondary                                        | Yes — domain specificity prevents useful bridging           |

---

## Implementation Sequence

1. **Define types:** `SupportedCompositionPair`, `CompositeGrammarMetadata` in
   `archetypeLiveTraceEvaluation.ts` or a new `compositionDetector.ts`
2. **Implement `detectSecondaryArchetype()`** with the 4 pair detection rules
3. **Write Tier 1–3 detection tests** first — let tests define the expected
   behavior
4. **Implement goalContract extension** — add `compositeGrammar` field, write
   Tier 4 tests
5. **Add P.O.S. primary-only rule tests** (Tier 5) — verify no change to
   existing P.O.S. behavior
6. **Implement bridge deliverable injection** in goalToDeliverables compiler —
   minimal addition
7. **Regression guard** — run full suite, confirm 0 new failures
8. **Write `JERICHO_PHASE_C_CLOSURE.md`**

---

## File Touchpoints (Expected)

| File                                                                                 | Change                                                            |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `src/state/engine/archetypeLiveTraceEvaluation.ts` (or new `compositionDetector.ts`) | Add `detectSecondaryArchetype()`, `SupportedCompositionPair` type |
| `src/state/engine/goalToDeliverables.ts`                                             | Add bridge deliverable injection when `compositeGrammar` present  |
| `src/state/engine/probabilityScore.ts`                                               | No change (P.O.S. already reads `familyClass` from primary)       |
| Tests                                                                                | New `compositionDetector.unit.test.ts` covering Tiers 1–5         |

---

## Phase C Closure Criteria

Phase C is closed when:

- [ ] `detectSecondaryArchetype()` implemented and exported
- [ ] `SupportedCompositionPair` type defined
- [ ] `compositeGrammar` goalContract field defined
- [ ] Tier 1–4 detection tests all pass
- [ ] Tier 5 P.O.S. primary-only rule tests pass
- [ ] Bridge deliverable injection implemented and tested
- [ ] Zero regressions in classification, liveTrace, and P.O.S. test suites
- [ ] `JERICHO_PHASE_C_CLOSURE.md` written with final test counts and limitation
      inventory
