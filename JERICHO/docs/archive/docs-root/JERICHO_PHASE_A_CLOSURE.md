# Phase A Closure — Degraded Family Grammar and Live-Trace Validation

**Status: COMPLETE** **Closed: 2026-03-25**

---

## What Phase A Was

Phase A addressed the three execution-grammar families that entered the
pre-agent loop in a degraded state:

- **Fundraising** — live-trace tests passed but Angel Raise grammar had gaps
  against the P.O.S. Wave 2 stage model
- **SalesPipeline** — no live-trace presence, no base action grammar, no
  classifier path
- **BrandLaunch** — no live-trace presence, no base action grammar, no
  classifier path

"Degraded" meant: these families could not be relied on as validated execution
paths. They were queues of known missing work, not operational archetypes.

---

## What Closure Required

Each family required:

1. **Grammar alignment** with the authoritative stage model
   (`QUALIFYING_EXTERNAL_STAGES` in `probabilityScore.ts`)
2. **Base action set** — a representative action graph in
   `archetypeLiveTraceEvaluation.ts`
3. **Classifier path** — deterministic routing in
   `classifyLiveInputToArchetype()`
4. **Live-trace validation** — passing all 8 gates of the closure test suite

The 8 gates:

1. Canonical path robustness (`usesCanonicalDeliverablePath`,
   `classificationMatchesIntended`)
2. Anti-phase regression (no `PHASE_LABEL_AS_DELIVERABLE` issues)
3. Anti-vagueness (no `VAGUE_TITLE` issues)
4. Dependency coherence (`hasNonTrivialDependencies`, no
   `DEPENDENCY_FLATTENING`)
5. Coverage (`hasCoreOutputCoverage`, no `MISSING_CORE_OUTPUT`)
6. Scheduler readiness (`schedulerCompatible`, `proposedBlockCompatible`)
7. Issue aggregation (stable `byArchetype` and `byInputStyle` distribution)
8. Summary integrity (`deliverableCount > 0`, valid `recommendation`)

---

## Closure Work Completed

### Fundraising

**Grammar correction — `archetypeMatrix1_0.ts` Angel Raise `actionClasses`:**

Before:

```
['deck refinement', 'target research', 'outreach', 'meeting prep']
```

After:

```
['deck refinement', 'target research', 'outreach', 'meeting prep', 'diligence follow-up', 'commitment follow-up']
```

**Why this matters:** `diligence follow-up` and `commitment follow-up` are the
preparation-side action classes that correspond to the externally-mediated
evidence stages `diligence_request` and `commitment_received` in
`QUALIFYING_EXTERNAL_STAGES`. Without them, Angel Raise grammar had no path to
the P.O.S. trust gate that matters most for this family. Seed Round Raise
already had `diligence follow-up`. Friends and Family Raise already had
`commitment tracking`. Angel Raise was the only lane missing both.

**Validation:** All 4 `archetypeLiveTrace.newlyMigrated.*` tests continue to
pass.

### SalesPipeline

**Added to `archetypeLiveTraceEvaluation.ts`:**

- `MigratedArchetype` union extended with `'SalesPipeline'`
- 5 base actions added to `BASE_ACTIONS_BY_ARCHETYPE`:
  - `sales:001:offer-clarity` → offer sheet (no deps)
  - `sales:002:icp-targeting` → target account list
  - `sales:003:outreach-assets` → outreach scripts + objection library
  - `sales:005:first-outreach-wave` → first outreach batch logged
  - `sales:006:discovery-calls` → discovery call notes + CRM staging
- Classifier rule added before `jobHits` check:
  ```
  salesHits = count(['sales', 'b2b', 'prospect', 'deal', 'client', 'close'])
  if salesHits >= 2 → SalesPipeline
  ```
  This prevents 'pipeline' from routing SalesPipeline goal text to
  JobSearchPipeline.

### BrandLaunch

**Added to `archetypeLiveTraceEvaluation.ts`:**

- `MigratedArchetype` union extended with `'BrandLaunch'`
- 5 base actions added to `BASE_ACTIONS_BY_ARCHETYPE`:
  - `brand:001:positioning-brief` → positioning brief (no deps)
  - `brand:002:message-architecture` → messaging map
  - `brand:003:identity-direction` → identity direction board
  - `asset:002:brand-kit` → brand kit + templates
  - `launch:002:announcement` → published announcement + CTA
- Classifier rules added before `creativeHits` check:
  ```
  brandHits = count(['brand', 'identity', 'positioning', 'visual'])
  if brandHits >= 2 → BrandLaunch
  if text has 'brand' AND any of ('presence', 'profile', 'launch') → BrandLaunch
  ```
  This prevents BrandLaunch goal text from routing to CreativeProduction via the
  `publish` token.

### Closure Test Suite

**New file:** `JERICHO/tests/state/archetypeLiveTrace.closureGroup.fixtures.ts`

- 10 inputs: 5 SalesPipeline + 5 BrandLaunch
- Input styles: `clean_explicit`, `compressed_informal`, `slightly_vague`,
  `overloaded_multi_part`, `deadline_constrained`

**New test files (8 gates):**

- `archetypeLiveTrace.closureGroup.canonicalPathRobustness.test.ts`
- `archetypeLiveTrace.closureGroup.antiPhaseRegression.test.ts`
- `archetypeLiveTrace.closureGroup.antiVagueness.test.ts`
- `archetypeLiveTrace.closureGroup.dependencyCoherence.test.ts`
- `archetypeLiveTrace.closureGroup.coverage.test.ts`
- `archetypeLiveTrace.closureGroup.schedulerReadiness.test.ts`
- `archetypeLiveTrace.closureGroup.issueAggregation.test.ts`
- `archetypeLiveTrace.closureGroup.summary.test.ts`

**Final test counts at closure:**

- `archetypeLiveTrace.*`: 28/28 pass
- `pos.*`: 73/73 pass
- `archetypeRuleQuality.*` + `compilerScorecard.*`: 23/23 pass
- `mockLLMActionGraph.*` + `goalToDeliverables.*`: 20/20 pass

---

## Cross-Layer Dependency Rule (Standing Integrity Constraint)

**Rule:** `QUALIFYING_EXTERNAL_STAGES` in `probabilityScore.ts` is the
authoritative stage model for externally-mediated families (Fundraising,
SalesPipeline, Fundraising). Phase A grammar must remain coherent with it.

**Applies to:** `archetypeMatrix1_0.ts` action classes,
`archetypeLiveTraceEvaluation.ts` base actions, P.O.S. Wave 2 trust gate tests.

**Protocol:** Any discovered mismatch is a required cross-layer correction
across all four surfaces (family grammar, acceptance plan,
`probabilityScore.ts`, Wave 2 trust tests). Local overrides are not permitted.

**Current alignment:**

| Family            | QUALIFYING_EXTERNAL_STAGES                                                   | Grammar coverage                                                    |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Fundraising       | investor_reply, meeting_booked, diligence_request, commitment_received       | meeting prep, outreach, diligence follow-up, commitment follow-up ✓ |
| SalesPipeline     | qualified_response, discovery_call_booked, proposal_requested, deal_advanced | outreach, discovery calls, proposal/follow-up ✓                     |
| JobSearchPipeline | recruiter_reply, interview_invite, screening_scheduled, offer_received       | applications, interview prep, pipeline ✓                            |

---

## What Phase A Does Not Prove

Phase A established grammar alignment and live-trace closure. It does not yet
prove:

- Classification is honest under ambiguous or near-neighbor inputs
- Composition works when a goal spans multiple grammar families
- The full end-to-end execution chain is demonstrable for these families
- P.O.S. scores are correctly gated for SalesPipeline and BrandLaunch against
  live state (Wave 2 tests cover JobSearchPipeline + Fundraising archetypes most
  directly)

These are Phase B, C, and E concerns.

---

## Phase Transition

**Phase A → COMPLETE** **Phase B → ACTIVE:** Classification confidence and
boundary honesty (see `JERICHO_CLASSIFICATION_CONFIDENCE_PLAN.md`)
