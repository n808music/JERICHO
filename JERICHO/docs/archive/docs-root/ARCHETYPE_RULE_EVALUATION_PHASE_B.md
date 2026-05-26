# ARCHETYPE_RULE_EVALUATION_PHASE_B

## 1. Scope

Phase B evaluates migrated archetypes on top of Phase A deliverable-first
compiler foundation. Evaluated archetypes:

- `ProfessionalQualification`
- `VentureLaunch`
- `GenericStructured.TVWriting`

This pass focuses on quality/structure checks, not broad migration.

## 2. Migrated archetypes evaluated

- ProfessionalQualification (certification / exam)
- VentureLaunch (launch/fundraising style output chain)
- GenericStructured.TVWriting (content/show-writing output chain)

## 3. Quality rubric / heuristic rules

Deterministic checks added in `src/state/engine/archetypeRuleQuality.ts`:

- `VAGUE_TITLE`
- `PHASE_LABEL_AS_DELIVERABLE`
- `WEAK_DEFINITION_OF_DONE`
- `EMPTY_OR_WEAK_ACCEPTANCE_CRITERIA`
- `ACTION_DELIVERABLE_MISMATCH`
- `ESTIMATE_IMPLAUSIBILITY`
- `MISSING_CORE_OUTPUT`
- `DEPENDENCY_FLATTENING`

Coverage and readiness outputs include:

- concrete output check
- DoD coverage check
- acceptance criteria coverage check
- dependency non-triviality
- session estimate presence
- scheduler-readiness coherence flags

## 4. Baseline findings

- Migrated archetypes are structurally coherent on deliverable-first path.
- Deliverables remain output-oriented and avoid known phase-label regressions.
- Action derivation and dependency linkage are coherent for evaluated fixtures.
- Session estimates are present and deterministic.
- Scheduler compatibility remains intact via action-driven downstream path.

## 5. Corrections applied in Phase B

- Added archetype quality evaluation helper and deterministic issue taxonomy.
- Tightened action/deliverable token overlap normalization (singularization
  step) to reduce false mismatch positives.
- No broad compiler rewrite was needed after quality evaluation; existing
  migrated archetype outputs were already strong enough under current rubric.

## 6. Remaining weaknesses

- Quality checks are heuristic and fixture-driven; they are deterministic but
  not semantic NLP truth.
- Coverage checks are archetype-bucket based and should be calibrated with live
  app traces beyond fixture sets.
- Non-migrated archetypes still run legacy path and are outside this phase’s
  quality guarantee.

## 7. Recommendation

**Option B** Migrated archetypes are structurally sound and scheduler-ready, but
broader rollout should include one additional refinement loop using live
generated traces (not just fixtures) before scaling migration to all archetypes.

Rationale:

- Core quality gates passed for migrated set.
- No critical structural failures detected.
- Remaining risk is calibration breadth (heuristic thresholds + real-world text
  variance), not architecture failure.
