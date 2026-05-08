# Phase B Closure — Classification Confidence and Boundary Honesty

**Status: COMPLETE** **Closed: 2026-03-25**

---

## What Phase B Was

Phase B hardened the classifier in `classifyLiveInputToArchetype()` against:

- Near-neighbor misfires (routing to the wrong archetype when signals are
  ambiguous)
- Path priority errors (BrandLaunch path 2 firing before VentureLaunch when
  venture tokens dominate)
- Undocumented boundary behavior (which signals win when two archetypes contest
  the same input)

The acceptance surface was the three-tier test structure from
`JERICHO_CLASSIFICATION_CONFIDENCE_PLAN.md`.

---

## Files Changed

### `JERICHO/src/state/engine/archetypeLiveTraceEvaluation.ts`

**One-line change — BrandLaunch path 2 guard:**

Before:

```typescript
if (
  text.includes('brand') &&
  ['presence', 'profile', 'launch'].some((t) => text.includes(t))
)
  return 'BrandLaunch';
```

After:

```typescript
if (
  text.includes('brand') &&
  ['presence', 'profile', 'launch'].some((t) => text.includes(t)) &&
  ventureHits < 2
)
  return 'BrandLaunch';
```

**Why this was the only change needed:** All Tier 1 (9 canonical) and Tier 3 (3
UNKNOWN) tests passed against the existing classifier without modification. Only
CB-007 failed: "brand launch for my new product startup" was returning
`BrandLaunch` instead of `VentureLaunch`. The root cause was BrandLaunch path 2
(`brand` + `launch`) firing unconditionally before the VentureLaunch check,
without guarding against inputs where venture signals (startup, product, launch)
score ≥ 2.

The fix mirrors the Fundraising `ventureHits < 2` guard pattern already in use.
It is consistent with the documented near-neighbor Case 4 rule: "VentureLaunch
tokens dominate when 2+ of startup/product/feature/mvp/user are present."

### `JERICHO/tests/state/classifyLiveInputToArchetype.unit.test.ts` (new)

29 tests organized in 5 describe blocks:

1. **Tier 1 — Canonical positive routing** (9 tests): one canonical input per
   archetype, each returning the correct type
2. **Tier 2 — Exclusion boundary / near-neighbor disambiguation** (8 tests):
   CB-001 through CB-008 per plan
3. **Tier 3 — UNKNOWN and weak signal behavior** (3 tests): CU-001, CU-002,
   CU-003 per plan
4. **Boundary invariants** (6 tests): exclusion table coverage from the plan's
   boundary rules section
5. **Accepted known gaps** (3 tests): C-GAP-001 through C-GAP-003, asserting
   current gap behavior

---

## Canonical Cases Covered

| Archetype                   | Canonical input                                                   | Result |
| --------------------------- | ----------------------------------------------------------------- | ------ |
| ProfessionalQualification   | "Pass the AWS Solutions Architect certification exam"             | ✓      |
| VentureLaunch               | "Build and launch an MVP for a startup product"                   | ✓      |
| GenericStructured.TVWriting | "Write a pilot script for a new TV show season"                   | ✓      |
| JobSearchPipeline           | "Submit 20 job applications and prepare for PM role interviews"   | ✓      |
| PhysicalTraining            | "Run a 5k and build a strength training program"                  | ✓      |
| CreativeProduction          | "Record and publish a 10-episode podcast"                         | ✓      |
| Fundraising                 | "Raise an angel round with investor deck and diligence data room" | ✓      |
| SalesPipeline               | "Build B2B sales pipeline and close service client deals"         | ✓      |
| BrandLaunch                 | "Define brand identity and visual positioning"                    | ✓      |

---

## Exclusion Boundary Cases Closed

| Test ID | Input                                                  | Expected           | Must NOT return    | Result                  |
| ------- | ------------------------------------------------------ | ------------------ | ------------------ | ----------------------- |
| CB-001  | "raise a seed round for my startup launch"             | VentureLaunch      | Fundraising        | ✓ CLOSED                |
| CB-002  | "angel investor deck and diligence data room"          | Fundraising        | VentureLaunch      | ✓ CLOSED                |
| CB-003  | "close b2b service clients this quarter"               | SalesPipeline      | JobSearchPipeline  | ✓ CLOSED                |
| CB-004  | "job search pipeline with applications and interviews" | JobSearchPipeline  | SalesPipeline      | ✓ CLOSED                |
| CB-005  | "brand identity and visual positioning for launch"     | BrandLaunch        | CreativeProduction | ✓ CLOSED                |
| CB-006  | "publish a longform book manuscript"                   | CreativeProduction | BrandLaunch        | ✓ CLOSED                |
| CB-007  | "brand launch for my new product startup"              | VentureLaunch      | BrandLaunch        | ✓ CLOSED (required fix) |
| CB-008  | "build sales pipeline and close deals b2b"             | SalesPipeline      | Fundraising        | ✓ CLOSED                |

---

## UNKNOWN Cases Preserved

| Test ID | Input                                  | Expected                    | Result |
| ------- | -------------------------------------- | --------------------------- | ------ |
| CU-001  | "launch something new this quarter"    | UNKNOWN                     | ✓      |
| CU-002  | "build a pipeline for my project"      | JobSearchPipeline (weak ok) | ✓      |
| CU-003  | "close a funding round for my company" | UNKNOWN (C-GAP-001)         | ✓      |

---

## Known Accepted Gaps (Unchanged)

| Gap ID    | Description                                                                           | Current behavior                      | Accepted?                                                        |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| C-GAP-001 | "close a funding round" → UNKNOWN, not Fundraising                                    | UNKNOWN                               | Yes — `funding`/`round` token addition deferred, regression risk |
| C-GAP-002 | "content strategy for brand" → not BrandLaunch (brand alone insufficient)             | not BrandLaunch                       | Yes — single token does not meet threshold                       |
| C-GAP-003 | Multi-archetype goal "launch startup and build brand identity" → dominant signal wins | BrandLaunch (brandHits=2 fires first) | Yes — Phase C composition is the correct fix                     |

---

## Regression Check

- `archetypeLiveTrace.*` all groups: **28/28 pass** (no regressions)
- `classifyLiveInputToArchetype.unit.test.ts`: **29/29 pass**

---

## Classifier Behavior Contract (Final State)

| Input quality                                          | Behavior                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Strong canonical (2+ discriminators, no near-neighbor) | Correct archetype, stable                                                     |
| Near-neighbor with dominant discriminator (CB series)  | Dominant archetype wins, boundary deterministic                               |
| VentureLaunch vs. BrandLaunch: venture tokens ≥ 2      | VentureLaunch wins — `ventureHits < 2` guard on BrandLaunch path 2            |
| Fundraising vs. VentureLaunch: venture tokens ≥ 2      | VentureLaunch wins — `ventureHits < 2` guard already on all Fundraising paths |
| Weak signal (1 discriminator, no near-neighbor)        | Correct archetype (JobSearchPipeline from `pipeline` alone)                   |
| Genuinely ambiguous (0–1 weak discriminators)          | UNKNOWN                                                                       |
| Multi-archetype (signals for 2 types)                  | Higher-priority type in check order wins (Phase C deferred)                   |

---

## Phase Transition

**Phase B → COMPLETE** **Phase C → NEXT:** Bounded composition — handling goals
that span multiple execution grammar families. Classification is now stable
enough to serve as the foundation for composition detection.
