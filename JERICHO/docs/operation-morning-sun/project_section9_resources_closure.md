---
name: project-section9-resources-closure
description: Section 9 (Resources) of the deterministic elicitation engine — closed 2026-06-30; per-initiative gap grid + binding constraint; 28-failure baseline held
metadata: 
  node_type: memory
  type: project
  originSessionId: a37a1361-29d8-4f24-944f-5a166012f14f
---

Section 9 closed 2026-06-30 with zero regressions (3579 total / 3551 pass / 28 fail — exactly pre-existing baseline).

**Schema**: replaced `resources: { available: {}, needed: {}, gap: {} }` with `resourceProfilesById: {}` and `bindingConstraint: null` at 3 sites (identityStore.js, identityCompute.js fresh-init + migration guard). Zero existing readers of old shape.

**Why:** Per-initiative gap grid (4 dimensions: money/time/skills/tech) + section-level binding constraint. Two-slot section.

**Key files:**
- `src/domain/elicitation/resourceDimensions.ts` — RESOURCE_DIMENSIONS + NO_GAP_SENTINEL='none'
- `src/domain/elicitation/resourceProfileSlot.ts` — RESOURCE_PROFILE_SLOT (18 gates via flatMap), BINDING_CONSTRAINT_SLOT (5 gates), isSection9Complete, unprofiledInitiatives, buildResourceProfileDeclarePayload, buildBindingConstraintDeclarePayload
- `src/domain/elicitation/resourceReprobes.ts` — 23 reprobe codes
- `tests/domain/elicitation/elicitationEngine.resourceSlot.test.js` — 35 tests, all green

**Coverage gate pattern**: `BINDING_COVERAGE_INCOMPLETE` as first gate on BINDING_CONSTRAINT_SLOT. Binding slot is stuck until `isSection9Complete(ctx.matrixSnapshot)` returns true (all initiativesById keys present in resourceProfilesById). No engine "keep-eliciting" mechanics needed.

**NO_GAP_SENTINEL**: stored value is `'none'` (user input), persisted as `null` in reducer. Distinct from unanswered (empty string).

**How to apply:** Section 10 (bootstrap) is the final section — reads completed graph including bindingConstraint to sequence where execution begins. Start by discovering what "bootstrap sequencing" means in the existing codebase.
