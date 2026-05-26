# ARCHETYPE_RULE_EVALUATION_PHASE_B5_LIVE_TRACES

## Scope

Phase B.5 validates migrated archetypes against live-style phrasing variability
using deterministic local traces.

Evaluated migrated archetypes only:

- `ProfessionalQualification`
- `VentureLaunch`
- `GenericStructured.TVWriting`

## Live input sets used

Input matrix source:

- `tests/state/archetypeLiveTrace.fixtures.ts`

Per archetype, five styles were tested:

- `clean_explicit`
- `compressed_informal`
- `slightly_vague`
- `overloaded_multi_part`
- `deadline_constrained`

Total live runs: **15**.

## Evaluation rubric

Live traces run through:

1. archetype classification from realistic goal text
2. migrated compiler path (`goal -> deliverables -> actions -> estimates`)
3. Phase B quality evaluator (`archetypeRuleQuality.ts`)
4. readiness/recommendation scoring (`pass/warn/fail`)
5. aggregate issue distribution by archetype and phrasing style

Issue classes checked:

- `VAGUE_TITLE`
- `PHASE_LABEL_AS_DELIVERABLE`
- `WEAK_DEFINITION_OF_DONE`
- `EMPTY_OR_WEAK_ACCEPTANCE_CRITERIA`
- `ACTION_DELIVERABLE_MISMATCH`
- `ESTIMATE_IMPLAUSIBILITY`
- `MISSING_CORE_OUTPUT`
- `DEPENDENCY_FLATTENING`

## Observed issue distribution

Final aggregate:

- totalRuns: `15`
- passCount: `15`
- warnCount: `0`
- failCount: `0`
- issueFrequency: `{}`

By archetype:

- ProfessionalQualification: `5 pass / 0 warn / 0 fail`
- VentureLaunch: `5 pass / 0 warn / 0 fail`
- GenericStructured.TVWriting: `5 pass / 0 warn / 0 fail`

By input style:

- clean_explicit: `3 pass / 0 warn / 0 fail`
- compressed_informal: `3 pass / 0 warn / 0 fail`
- slightly_vague: `3 pass / 0 warn / 0 fail`
- overloaded_multi_part: `3 pass / 0 warn / 0 fail`
- deadline_constrained: `3 pass / 0 warn / 0 fail`

## Archetype-by-archetype findings

### ProfessionalQualification

- Canonical path remained stable across all phrasing variants.
- Output classes (study/practice/final exam outcome) remained intact.
- Dependency and scheduler-readiness signals remained coherent.

### VentureLaunch

- After one targeted classifier correction, all styles passed.
- Outputs remained concrete (validation material, launch material, outreach
  execution).
- No quality degradation under compressed/informal or overloaded phrasing.

### GenericStructured.TVWriting

- TV-writing path remained stable under all tested phrasings.
- Output chain preserved premise/arc/outline/draft/revision structure.
- No phase-label regressions detected.

## Corrections applied

One minimal correction based on live traces:

- `src/state/engine/archetypeLiveTraceEvaluation.ts`
  - Venture classifier keyword set expanded to include `pitch`.
  - This addressed an overloaded fundraising phrasing that previously classified
    as `UNKNOWN`.

No broad compiler/scheduler rewrites were required.

## Recommendation gate

**Option A** Migrated archetypes are robust enough under live traces to begin
next archetype migration group.

Reason:

- 15/15 live-trace runs passed.
- No quality issue-code failures in the evaluated matrix.
- Canonical deliverable path and scheduler-readiness remained stable across
  phrasing variability.

---

## Addendum — Newly Migrated Freeze Evidence (Fundraising + non-TV CreativeProduction)

This tranche extends live-trace robustness coverage to the newly migrated
archetypes:

- `Fundraising`
- `CreativeProduction` (non-TV lanes)

Input matrix source:

- `tests/state/archetypeLiveTrace.newlyMigrated.fixtures.ts`

Per archetype, five styles were tested:

- `clean_explicit`
- `compressed_informal`
- `slightly_vague`
- `overloaded_multi_part`
- `deadline_constrained`

Total new live runs: **10**.

Final aggregate for newly migrated tranche:

- totalRuns: `10`
- passCount: `10`
- warnCount: `0`
- failCount: `0`
- issueFrequency: `{}`

By archetype:

- Fundraising: `5 pass / 0 warn / 0 fail`
- CreativeProduction: `5 pass / 0 warn / 0 fail`

By input style:

- clean_explicit: `2 pass / 0 warn / 0 fail`
- compressed_informal: `2 pass / 0 warn / 0 fail`
- slightly_vague: `2 pass / 0 warn / 0 fail`
- overloaded_multi_part: `2 pass / 0 warn / 0 fail`
- deadline_constrained: `2 pass / 0 warn / 0 fail`

Targeted hardening applied:

- `src/state/engine/archetypeLiveTraceEvaluation.ts`
  - Added explicit migrated live-trace support for `Fundraising` and
    `CreativeProduction`.
  - Hardened classifier precedence to prevent false matches:
    - `podcast season` no longer misclassified as TV-writing
    - fundraising phrasing (`investor + raise + deck/narrative`) no longer
      drifts to venture classification
- `src/state/engine/archetypeRuleQuality.ts`
  - Added archetype-specific core-output coverage checks for:
    - `Fundraising` (ask structure, narrative/deck, target-fit pipeline,
      diligence/commitment progression)
    - `CreativeProduction` (concept/scope, production execution,
      revision/quality, release readiness)

Freeze evidence interpretation:

- The canonical machine is now validated under deterministic live-trace
  variability for newly migrated lanes.
- The remaining 1.0 risk emphasis should shift from engine validity to product
  representation clarity (how this validated behavior is surfaced and explained
  in-product).
