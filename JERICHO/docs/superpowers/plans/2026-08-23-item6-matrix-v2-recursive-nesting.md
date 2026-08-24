# Item 6 — Matrix v2: Recursive Nesting

> **Provenance note (read first):** This document follows the same discipline as `docs/superpowers/specs/2026-08-23-e15-phase-assignment-rule.md`. Every section is tagged: **[CONVERSATIONAL-DECISION]**
> means a design call made in chat, never checked against the repo; **[CODE-VERIFIED]** means confirmed directly against committed code; **[REQUIRES-SCOPING-PASS]** means the section depends on facts
> about the live schema that have not yet been checked and must not be assumed. E15/E16 found, twice, that a doctrine field name (`initiative.terminalDeadline`, `project.targetDate`'s true semantics)
> did not mean what its name implied until someone actually read the write sites. Item 6 aggregates whatever the real schema turns out to be — treat every field this spec references as unverified
> until a scoping pass confirms it exists, at the grain claimed, populated from where claimed.

**Status:** SECTION 0 SCOPED (2026-08-23) — ready for Phase 4 (Build Plan)  
**Depends on:** E15 (Phase Assignment Rule, TECHNICALLY RESOLVED — Item 6 does not require E15's formal name-level diff to complete first, but does depend on Phase now being a reliable, computed-not-stored value at Project grain, which is true as of `f166780`/`b5b6441`).  
**Governs:** the general recursive-aggregation mechanism for the Matrix hierarchy (Entity → Initiative → Project → Deliverable/Artifact), not just Phase specifically — Phase is the first concrete field this mechanism will be exercised against, but the mechanism itself must be general.  
**Data Integrity Caveat:** Project's `owningInitiativeId` field is **optional and unvalidated at declaration time** (Section 0 finding, identityCompute.js:16570). Projects can exist without Initiative linkage or with invalid Initiative IDs. Build Plan must include explicit orphan-node handling to surface these as visible residuals, consistent with Section 2.1's "never terminal, always traceable" requirement.

---

## 0. Mandatory Pre-Implementation Scoping Pass ✓

**Status: COMPLETE** — See `2026-08-23-item6-section0-scoping-pass.md` and `2026-08-23-item6-section0-raw-output.md` for full evidence.

**Findings Summary:**
- 5 node types (Entity, Initiative, Project, Deliverable, Artifact) with complete field inventories, file:line references
- All parent-child linkage fields confirmed real and populated at declaration
- Initiative phase field void per E16; Project phase field void per E15
- `deriveMasterPlanPhaseModel()` confirmed orthogonal (timeline phases, not hierarchy)
- No grep false negatives detected in targeted verification

**Data Integrity Finding (added post-scoping):** Project's `owningInitiativeId` is optional and unvalidated. Orphan-node handling required in Phase 4.

---

## 1. Problem Statement `[CONVERSATIONAL-DECISION]`

The Matrix is currently flat at the operational level: Projects, Deliverables, and Artifacts exist as individually-declared nodes with parent references, but there is no mechanism to view or reason about a rolled-up state at the Initiative or Entity level — e.g. "how many P1 items under Global State Corp are behind schedule" requires manual traversal today. Item 6 is the design and implementation of a recursive nesting/aggregation layer over this hierarchy.

Two design forks were resolved earlier in this session (2026-08-22), before the E15/E16 detour, and are locked as the basis for this spec:

---

## 2. Locked Decisions `[CONVERSATIONAL-DECISION]`

### 2.1 Aggregation shape: drill-down, collapsed-by-default display

An aggregate value at any level (Initiative, Entity) is **never terminal** — it must always be traceable back to the originating leaf node(s) that produced it. A collapsed summary view (e.g. "Global State Corp: 3 P1 items behind schedule") is a **display preference layered on top of** full drill-down data, never a data-model shortcut that discards leaf-level identity.

Rationale (restated from the original decision): this is required for consistency with the Phase Diagnostic Resolution Rule, which depends on tracing a mismatch back to its originating date field rather than accepting an override at the aggregate level. A collapse-to-summary model with no path back to source leaves would break that diagnostic discipline one level up.

**Implication for schema:** whatever aggregation mechanism gets built must carry enough structure to answer "which specific leaf nodes produced this number" on demand, not just "what is the number."
This likely means the aggregation layer is a computed *view* over the existing flat hierarchy (read-time traversal, memoized/cached as needed for performance), not a new denormalized storage layer that could itself drift out of sync with the source nodes — the exact failure class E15 spent all night removing from Phase.

### 2.2 Urgency propagation: recompute-per-level, with a compounding floor

Each level of the hierarchy computes its own urgency signal from its own aggregate state (ADVISORY, per Sequencing Authority Doctrine — never CONSTRAINT at the rollup level). A child's CONSTRAINT-tagged urgency **never inherits verbatim** upward — an Entity-level "urgent" label is the system's own aggregate observation about its own level, not a re-assertion of a child's attested claim it was never given standing to make at that level.

**Compounding floor:** a child CONSTRAINT must still force the parent's computed urgency to reflect the compounding at minimum — the parent's own computation cannot silently mask a live CONSTRAINT below it. Concretely: if a parent's own aggregate state would compute to "not urgent" but it has a child in active CONSTRAINT escalation, the parent's displayed urgency must be at least as urgent as "compounding present," even though the *number* driving that isn't a verbatim copy of the child's value.

**Implication for schema:** urgency is **not** a stored field that gets written once and read many times — like Phase, it must be computed at read time from current child state, for the same staleness reasons the Phase Assignment Rule was built to prevent. Do not create a persisted `urgency` field on any node above the leaf CONSTRAINT-tagged item itself.

---

## 3. Aggregation Function Contract `[CONVERSATIONAL-DECISION — draft, now refined by Section 0]`

### `aggregatePhaseRollup(node, hierarchy): PhaseRollup`

**Input:** a node at any level (Initiative, Entity) and access to its full owned-subtree (via whatever real linkage Section 0 confirmed).  
**Output (draft shape):**
```
{
  ownNode: <id>,
  leafCounts: { P1: n, P2: n, P3: n, null: n },   // count of leaf Projects at each computed Phase, incl. residual/null
  leafRefs: { P1: [projectId, ...], P2: [...], P3: [...], null: [...] },  // drill-down: which leaves produced each count
  displaySummary: string,   // e.g. "3 P1 items behind schedule" — derived from leafCounts, never stored independently
  orphanedProjects: [projectId, ...],  // [NEW] Projects with missing/invalid owningInitiativeId — visible residual per Section 2.1
}
```

**Non-goal:** this function does not decide *what counts as* "behind schedule" — that's a separate concept (likely tied to Terminal Date vs. current date, or CONSTRAINT status) layered on top of the Phase rollup, not baked into it. Keep Phase aggregation and urgency aggregation as two distinct, composable functions rather than one function doing both — consistent with keeping each function's contract narrow, the same lesson `computeSpineWindowPhase()` reinforced by staying pure and not absorbing normalization logic that belonged in a caller.

### `aggregateUrgencyRollup(node, hierarchy): UrgencyRollup`

**Input:** same as above.  
**Output (draft shape):**
```
{
  ownNode: <id>,
  computedUrgency: 'none' | 'watch' | 'urgent',   // this level's own ADVISORY computation from its aggregate state
  compoundingFloor: 'none' | 'watch' | 'urgent',  // the minimum forced by any live child CONSTRAINT
  effectiveUrgency: max(computedUrgency, compoundingFloor),  // what actually displays
  constraintSources: [leafId, ...],  // drill-down: which specific child CONSTRAINTs are driving the floor, if any
}
```

**Both functions are read-time computations, not stored fields**, per Section 2's schema implication. Neither writes back to any node's stored state.

---

## 4. Build Plan `[CONVERSATIONAL-DECISION, refined by Section 0]`

Same discipline as E15: design-first, test-first, isolated branch, explicitly avoiding the Item 2/PR-#20 shape (no large bundled commits, no merge without a full-suite name-diff).

1. **Section 0 scoping pass** — ✓ COMPLETE (2026-08-23)
2. **Orphan-node handling design** — [NEW] Define what "orphan Project" (missing/invalid `owningInitiativeId`) means for aggregation, and ensure rollup functions surface them as visible residuals, not drop them silently. This is a direct requirement of Section 2.1 and Section 0's data-integrity finding.
3. **Traversal-code design** — Document that Artifact uses `producingProjectId` while Deliverable uses `owningProjectId` for parent linkage (different field names, same semantic). Traversal code must handle both explicitly.
4. **`aggregatePhaseRollup()`** implemented and unit-tested in isolation, against real schema confirmed by Section 0 — mirrors how `computeSpineWindowPhase()` was built and tested standalone before any call site touched it.
5. **`aggregateUrgencyRollup()`** implemented and unit-tested in isolation, same pattern.
6. **Wiring into a display consumer** (likely `MasterGridTab` or a new Entity/Initiative rollup view) — this is the equivalent of E15's Sites 1/4: the point where the pure function meets real call sites and where silent-mismatch bugs are most likely to surface (as they did repeatedly in E15's Site 4 wiring).
7. **Full-suite name-level diff** against whatever the frozen baseline is at the time Item 6 starts — not `785df54`, since that's now stale after tonight's E15/E16 commits; get the current baseline commit hash explicitly before starting, don't assume.

---

## 5. Definition of Done `[CONVERSATIONAL-DECISION]`

Item 6 may only move to RESOLVED-VERIFIED with all of the following pasted as raw output:

1. Section 0's field-and-linkage inventory, confirmed complete. ✓ DONE
2. Orphan-node handling specification (from step 2 of Build Plan).
3. Commit hash(es) for `aggregatePhaseRollup()` and `aggregateUrgencyRollup()`, each with their own isolated test suite output.
4. Commit hash(es) for the display-consumer wiring, with the same "drafted transformation shown before applied" discipline E15 used for Sites 1/4.
5. Full name-level test diff against the baseline in effect when Item 6 starts.
6. A drill-down spot-check: pick one real aggregate number the mechanism produces, and show the actual leaf nodes it traces back to, confirming Section 2.1's "never terminal" requirement holds in practice, not just in the type signature.

No partial closure. No narrative summaries substituting for raw output — same standing rule as E15.

---

## 6. Known Schema Integrity Gaps (from Section 0, must be handled in Phase 4)

### 6.1 Project's `owningInitiativeId` is Optional and Unvalidated

**Finding:** Project declaration (identityCompute.js:16570) accepts `owningInitiativeId` without validation. Projects can exist without Initiative linkage or with typo'd IDs.

**Impact on Item 6:** Initiative-level Phase rollup will silently miss Projects with invalid `owningInitiativeId`. Not an error condition — silent data loss.

**Required handling:** `aggregatePhaseRollup()` and `aggregateUrgencyRollup()` must detect and surface orphaned Projects as visible residuals, consistent with Section 2.1's "never terminal, always traceable" requirement. Example output shape: `orphanedProjects: [projectId, ...]` (see Section 3 updated output shape).

### 6.2 Different Parent-Linkage Field Names Across Node Types

**Finding:** Deliverable uses `owningProjectId` (identityCompute.js:16750); Artifact uses `producingProjectId` (identityCompute.js:16848). Same semantic relationship, different field names.

**Impact on Item 6:** Traversal code must explicitly handle both field names, or silently miss one child type during rollup.

**Required handling:** Phase 4's traversal-code design must document both names and test coverage must exercise both paths independently. Cannot assume one uniform field name.

---

## 7. Open Questions Deliberately Not Answered Here `[CONVERSATIONAL-DECISION]`

- Whether Entity-level aggregation needs different logic than Initiative-level (both are "above Project" but may have different real linkage patterns) — depends on Section 0's findings on Entity's actual owned-subtree mechanism. (Section 0 confirmed Entity ← Initiative via owningEntityIds array, so Entity rollup will traverse Initiatives first, then their Projects. Straightforward cascade; no special handling needed.)
- Performance/caching strategy for read-time recomputation at scale — deferred until real data volume is known to be a problem, not designed speculatively now.

---

**Ready for Phase 4: Build Plan (with orphan-node and field-name-handling requirements now explicit in the spec).**
