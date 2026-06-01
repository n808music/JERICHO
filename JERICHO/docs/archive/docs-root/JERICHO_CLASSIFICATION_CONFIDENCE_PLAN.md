# Classification Confidence and Boundary Honesty Plan

**Phase B of the Pre-Agent Hardening Sequence** **Prerequisite: Phase A complete
(see `JERICHO_PHASE_A_CLOSURE.md`)**

---

## Objective

The classifier in `classifyLiveInputToArchetype()` determines which execution
grammar a goal text routes to. After Phase A, all 9 archetypes have live-trace
presence and base actions. The remaining question is whether the classifier is
honest:

- Does it route canonical inputs to the right archetype?
- Does it refuse to route near-neighbor inputs to the wrong archetype?
- Does it return `UNKNOWN` when no archetype genuinely applies, rather than
  misfiring?
- Are its positive and exclusion rules documented well enough to be maintained?

This plan specifies the acceptance criteria, near-neighbor confusion cases, and
test structure required for Phase B closure.

---

## The 9 Execution Types

| Archetype                     | Family class          | Primary classification signal            |
| ----------------------------- | --------------------- | ---------------------------------------- |
| `ProfessionalQualification`   | internally_controlled | cert/exam/study toward a credential      |
| `VentureLaunch`               | internally_controlled | startup/product build with launch target |
| `GenericStructured.TVWriting` | internally_controlled | scripted narrative: show/series/pilot    |
| `JobSearchPipeline`           | externally_mediated   | job search with applications/interviews  |
| `PhysicalTraining`            | internally_controlled | physical conditioning or rehab program   |
| `CreativeProduction`          | internally_controlled | time-bounded media/artifact production   |
| `Fundraising`                 | externally_mediated   | raising external capital/support         |
| `SalesPipeline`               | externally_mediated   | moving prospects through a sales process |
| `BrandLaunch`                 | internally_controlled | defining and launching a brand identity  |

---

## Positive Signal Rules (Per Archetype)

Each archetype has a primary signal set. A confident positive classification
requires at least the documented minimum hit count.

### ProfessionalQualification

- **Primary tokens:** `cert`, `certification`, `exam`, `ccp`, `aws`
- **Minimum:** 2 hits
- **Additional markers:** study domain, practice test, pass/fail outcome
- **Anchor phrase:** "pass the [credential] exam", "study for [cert]"

### VentureLaunch

- **Primary tokens (ventureHits):** `startup`, `launch`, `mvp`, `product`,
  `feature`, `beta`, `user`
- **Pipeline tokens (venturePipelineHits):** `seed`, `investor`, `deck`,
  `pitch`, `outreach`, `startup`, `raise`
- **Minimum:** ventureHits ≥ 2, OR venturePipelineHits ≥ 2
- **Note:** `launch` alone is NOT sufficient — it fires for BrandLaunch first

### GenericStructured.TVWriting

- **Strong anchor tokens:** `tv`, `show`, `series`, `script`, `pilot`,
  `show bible`
- **Support tokens:** `season`, `episode`, `arc`, `continuity`
- **Minimum:** strongAnchorHits ≥ 1 AND (strongAnchorHits + supportHits) ≥ 2
- **Anchor phrase:** "write a pilot", "season arc", "script episodes"

### BrandLaunch _(checked before CreativeProduction)_

- **Primary tokens:** `brand`, `identity`, `positioning`, `visual`
- **Minimum path 1:** 2+ hits from primary set
- **Minimum path 2:** `brand` AND any of (`presence`, `profile`, `launch`)
- **Anchor phrase:** "brand identity", "brand positioning", "personal brand
  launch", "visual identity"
- **Note:** Must fire before `publish` or `content` trigger CreativeProduction

### CreativeProduction

- **Primary tokens:** `podcast`, `music`, `video`, `manuscript`, `longform`,
  `book`, `recording`, `editing`, `publish`
- **Minimum:** 1 hit
- **Exclusion:** BrandLaunch signals checked first — `brand` + `identity` takes
  priority over `publish`

### Fundraising _(checked first — most specific signal set)_

- **Primary tokens:** `angel`, `seed round`, `friends and family`, `grant`,
  `non-dilutive`, `sponsor`, `sponsorship`, `partnership`, `diligence`,
  `data room`, `raise`, `fundraising`
- **Minimum path 1:** 2+ hits AND ventureHits < 2
- **Minimum path 2:** `fundraising` alone AND ventureHits < 2
- **Minimum path 3:** `investor` + `raise` + (`deck` or `narrative`) AND
  ventureHits < 2

### SalesPipeline _(checked before JobSearchPipeline)_

- **Primary tokens:** `sales`, `b2b`, `prospect`, `deal`, `client`, `close`
- **Minimum:** 2 hits
- **Anchor phrase:** "b2b clients", "sales pipeline", "prospect and close",
  "first deal"
- **Note:** Must fire before `pipeline` triggers JobSearchPipeline

### JobSearchPipeline

- **Primary tokens:** `job`, `role`, `resume`, `application`, `interview`,
  `offer`, `pipeline`, `pm`, `operations`
- **Minimum:** 1 hit
- **Note:** `pipeline` is a weak signal that SalesPipeline classification
  pre-empts when stronger sales signals present

### PhysicalTraining

- **Primary tokens:** `training`, `rehab`, `5k`, `strength`, `conditioning`,
  `weight`, `pound`, `lbs`, `mobility`, `lift`, `run`
- **Minimum:** 1 hit

---

## Exclusion Boundary Rules

Exclusion rules prevent one archetype from capturing inputs that rightfully
belong to another.

| Input type                     | Incorrect routing risk | Exclusion rule                                                     |
| ------------------------------ | ---------------------- | ------------------------------------------------------------------ |
| "pipeline for clients"         | JobSearchPipeline      | SalesPipeline check fires first if salesHits ≥ 2                   |
| "brand content publish"        | CreativeProduction     | BrandLaunch check fires first if brandHits ≥ 2                     |
| "raise money for my startup"   | VentureLaunch          | Fundraising check fires first; ventureHits < 2 condition preserved |
| "launch my product"            | BrandLaunch            | VentureLaunch tokens dominate ('product', 'launch'); brandHits = 1 |
| "angel investor deck outreach" | VentureLaunch          | venturePipelineHits guard: fundraisingHits ≥ 2 fires first         |
| "write a book about my brand"  | BrandLaunch            | CreativeProduction check: `book` token fires; brandHits = 1        |
| "job search sales role"        | SalesPipeline          | salesHits = 1 ('sales' in "sales role") — jobHits fires instead ✓  |

---

## Near-Neighbor Confusion Cases

These are the highest-risk classification pairs. Each needs both a positive test
(correct type is returned) and a negative test (near-neighbor is NOT returned).

### Case 1: Fundraising vs. VentureLaunch

- **Confused by:** `investor`, `deck`, `pitch`, `raise`, `startup`, `seed`
- **Discriminating signal for Fundraising:** `angel`, `grant`, `non-dilutive`,
  `fundraising`, `diligence`, `data room`, `friends and family`
- **Discriminating signal for VentureLaunch:** 2+ of `startup`, `mvp`,
  `product`, `feature`, `beta`, `user`
- **Key:** Fundraising guard checks `ventureHits < 2` — a goal with `startup` +
  `product` + `raise` → VentureLaunch

### Case 2: SalesPipeline vs. JobSearchPipeline

- **Confused by:** `pipeline`, `outreach`, `role`
- **Discriminating signal for SalesPipeline:** `b2b`, `prospect`, `deal`,
  `close`, `client`, `sales`
- **Discriminating signal for JobSearchPipeline:** `job`, `resume`,
  `application`, `interview`, `offer`, `pm`
- **Key:** salesHits fires before jobHits; `pipeline` alone → JobSearchPipeline
  (no sales discriminators)

### Case 3: BrandLaunch vs. CreativeProduction

- **Confused by:** `publish`, `content`, `video` (in "brand video")
- **Discriminating signal for BrandLaunch:** `identity`, `positioning`,
  `visual`, `presence`, `profile` + `brand`
- **Discriminating signal for CreativeProduction:** `podcast`, `music`,
  `manuscript`, `recording`, `editing`
- **Key:** BrandLaunch fires before CreativeProduction; `brand` alone without
  co-signals → CreativeProduction wins

### Case 4: BrandLaunch vs. VentureLaunch

- **Confused by:** `launch`, `product`
- **Discriminating signal for BrandLaunch:** `brand`, `identity`, `positioning`,
  `visual`
- **Discriminating signal for VentureLaunch:** 2+ of `startup`, `product`,
  `feature`, `mvp`, `user`
- **Key:** BrandLaunch fires before VentureLaunch; "launch a product brand" with
  2 venture tokens → VentureLaunch

### Case 5: SalesPipeline vs. Fundraising

- **Confused by:** `outreach`, `investor` (as a lead)
- **Discriminating signal for SalesPipeline:** `b2b`, `prospect`, `deal`,
  `close`, `client`
- **Discriminating signal for Fundraising:** `angel`, `raise`, `diligence`,
  `grant`, `investor` + `raise` + `deck`
- **Key:** Fundraising fires first — goal text with `raise` + `investor` +
  `deck` → Fundraising even if `client` present

---

## Ambiguous Wording Patterns

These patterns are genuinely ambiguous and should return UNKNOWN or classify to
the dominant signal:

| Wording pattern                            | Expected result      | Rationale                                                                       |
| ------------------------------------------ | -------------------- | ------------------------------------------------------------------------------- |
| "Build a pipeline and grow my business"    | `JobSearchPipeline`  | No sales discriminators; `pipeline` fires jobHits                               |
| "Launch something new this quarter"        | `UNKNOWN`            | `launch` = 1 ventureHit; no other anchors                                       |
| "Get my content out and build an audience" | `CreativeProduction` | `content` not in tokens, but `build` + `audience` → UNKNOWN likely              |
| "Raise awareness for my brand"             | `BrandLaunch`        | `brand` + `launch` (path 2 fires) — acceptable                                  |
| "Write and publish my framework"           | `CreativeProduction` | `publish` fires; `brand` not present                                            |
| "Close a funding round"                    | `Fundraising`        | `close` = salesHit, `funding` / `round` → neither fires clearly; likely UNKNOWN |

The last case is a known gap: "close a funding round" has one sales token
(`close`) and no fundraising tokens. Current behavior → UNKNOWN. Correct
behavior for Phase B → Fundraising. A `round` token or `funding` token would
resolve this.

---

## Confidence and Behavior Contract

The current classifier is binary: it returns a `MigratedArchetype` or `UNKNOWN`.
There is no confidence score. This is intentional for now — confidence scoring
introduces calibration complexity that should not be added until boundary rules
are stable.

The target behavior contract for Phase B:

| Input quality                                | Expected classification behavior                                      |
| -------------------------------------------- | --------------------------------------------------------------------- |
| Strong canonical signals (2+ discriminators) | Correct archetype, `classificationMatchesIntended: true`              |
| Weak canonical signal (1 discriminator)      | Correct archetype if no near-neighbor risk, else UNKNOWN              |
| Near-neighbor with dominant discriminator    | Dominant archetype, negative test confirms near-neighbor not returned |
| Genuinely ambiguous (no clear discriminator) | `UNKNOWN` — warn, do not force misclassify                            |
| Multi-archetype text                         | Primary archetype wins by signal priority order                       |

**Block behavior:** The system does not currently block execution on UNKNOWN —
it warns and continues. Phase B does not change this. Classification
block/gating is a Phase C concern (bounded composition).

---

## Acceptance Tests Required

### Tier 1 — Canonical positive (9 tests, one per archetype)

Each test: a clean, unambiguous goal text → correct archetype returned,
`classificationMatchesIntended: true`.

These are covered by the existing fixture suites (`originalGroup`,
`newlyMigrated`, `nextGroup`, `closureGroup`) for the 9 archetypes in live-trace
form. Explicit unit tests of `classifyLiveInputToArchetype()` directly are the
remaining gap.

### Tier 2 — Exclusion boundary (8 tests, one per near-neighbor pair)

Each test: a near-neighbor input → correct archetype returned, near-neighbor
archetype NOT returned.

| Test ID | Input                                                  | Expected             | Must NOT return      |
| ------- | ------------------------------------------------------ | -------------------- | -------------------- |
| CB-001  | "raise a seed round for my startup launch"             | `VentureLaunch`      | `Fundraising`        |
| CB-002  | "angel investor deck and diligence data room"          | `Fundraising`        | `VentureLaunch`      |
| CB-003  | "close b2b service clients this quarter"               | `SalesPipeline`      | `JobSearchPipeline`  |
| CB-004  | "job search pipeline with applications and interviews" | `JobSearchPipeline`  | `SalesPipeline`      |
| CB-005  | "brand identity and visual positioning for launch"     | `BrandLaunch`        | `CreativeProduction` |
| CB-006  | "publish a longform book manuscript"                   | `CreativeProduction` | `BrandLaunch`        |
| CB-007  | "brand launch for my new product startup"              | `VentureLaunch`      | `BrandLaunch`        |
| CB-008  | "build sales pipeline and close deals b2b"             | `SalesPipeline`      | `Fundraising`        |

### Tier 3 — UNKNOWN return (3 tests)

Each test: a genuinely ambiguous input → `UNKNOWN` returned, no misfire.

| Test ID | Input                                  | Expected                             |
| ------- | -------------------------------------- | ------------------------------------ |
| CU-001  | "launch something new this quarter"    | `UNKNOWN`                            |
| CU-002  | "build a pipeline for my project"      | `JobSearchPipeline` (weak signal ok) |
| CU-003  | "close a funding round for my company" | `UNKNOWN` (gap — acceptable for now) |

### Tier 4 — Regression guard (all existing fixture inputs pass)

Re-run `archetypeLiveTrace.originalGroup`, `newlyMigrated`, `nextGroup`,
`closureGroup` canonical path robustness tests after any classifier change. Zero
regressions permitted.

---

## Implementation Sequence

1. **Write `classifyLiveInputToArchetype.unit.test.ts`** — unit tests for Tier 1
   (9 canonical) and Tier 2 (8 boundary) and Tier 3 (3 UNKNOWN) cases directly
   against the pure function
2. **Diagnose failures** — identify which near-neighbor cases misfire under
   current rules
3. **Strengthen discriminators** — add token sets or reorder checks to fix
   misfires without introducing regressions
4. **Re-run full liveTrace suite** — all 28 existing + new unit tests must pass
5. **Document known gaps** — cases where UNKNOWN is the correct result and no
   fix is attempted (e.g., CB-003 inverse: "close funding round")
6. **Phase B closure declaration** — all Tier 1, 2, 3 tests passing; regressions
   zero

---

## Known Gaps Accepted for Phase B

These classification failures are known and accepted — fixing them requires
either adding new tokens (risk of regression) or is blocked on Phase C
composition work:

| Gap ID    | Description                                                                            | Accepted outcome                                                              |
| --------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| C-GAP-001 | "close a funding round" → UNKNOWN (should be Fundraising)                              | UNKNOWN acceptable — `funding` or `round` token addition deferred             |
| C-GAP-002 | "content strategy for brand" → CreativeProduction (brand without identity/positioning) | Acceptable — single `brand` not strong enough without co-signals              |
| C-GAP-003 | Multi-archetype goals (e.g., "launch startup and build brand") → VentureLaunch         | Acceptable — Phase C (composition) is the correct fix, not classifier hacking |

---

## Phase B Closure Criteria

Phase B is closed when:

- [x] `classifyLiveInputToArchetype.unit.test.ts` exists and all Tier 1/2/3
      tests pass (29/29)
- [x] No regressions in existing 28 liveTrace tests
- [x] Near-neighbor pairs CB-001 through CB-008 all pass
- [x] Known gaps documented in this file (not silently failing)
- [x] `JERICHO_PHASE_B_CLOSURE.md` written with final test counts and gap
      inventory

**CLOSED 2026-03-25**
