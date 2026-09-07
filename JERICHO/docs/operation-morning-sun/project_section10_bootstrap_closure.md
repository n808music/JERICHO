---
name: section10-bootstrap-closure
description: "Section 10 (Bootstrap) closed 2026-07-01 — computed-selection surface complete, 10/10 matrix sections done, 22 tests pass, baseline 27 held"
metadata: 
  node_type: memory
  type: project
  originSessionId: a37a1361-29d8-4f24-944f-5a166012f14f
---

Section 10 (Bootstrap) closed 2026-07-01. The matrix elicitation layer is complete — 10 of 10 sections implemented and gated.

**Why:** Bootstrap inverts the elicitation pattern. Rather than prompting the operator to author a field, the engine computes DAG roots (artifacts not downstream of any `hard_gate` edge), orders by binding constraint tier, and the operator selects one. This is the only computed-selection surface in the matrix.

**Key implementation decisions:**
- `computeBootstrapCandidates(matrix)` — filters artifacts using `hard_gate` edges only; directional/informational do not block candidacy
- Binding constraint ordering: reads `bindingConstraint.bindingDimension` (NOT `.dimension`) from matrix; walks `artifact → producingProjectId → project.owningInitiativeId → resourceProfilesById[id].dimensions[dim].gap`; tiers: no-gap=0, unknown=1, gap=2
- Missing profile/initiative/owningInitiativeId all produce `unknown` tier — graceful degradation, never exclusion
- `DECLARE_BOOTSTRAP` reducer validates `selectedNodeId ∈ candidates` from the payload; stores `matrix.bootstrap = { candidates, selectedNodeId }`
- Gate `BOOTSTRAP_SELECTION_NOT_CANDIDATE` receives `ctx.matrixSnapshot` via the engine gate ladder

**Test strategy:** Direct `matrixWith()` construction (not reducer chain) for all graph traversal and ordering tests. Reducer chain only for dispatch/landing tests. Gate predicates tested directly via `BOOTSTRAP_SLOT.gate.find(...)`.

**Baseline:** 27 failures (unchanged). 22 new bootstrap tests all pass.

**Next move:** From-scratch run through the completed 10-section intake, which is now possible for the first time.

**How to apply:** When revisiting bootstrap or adding new computed-selection surfaces, the pattern is: compute candidates from graph state → order by constraint → operator picks → reducer validates candidate membership from payload.
