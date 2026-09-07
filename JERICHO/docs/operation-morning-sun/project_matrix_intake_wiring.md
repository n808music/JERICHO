---
name: matrix-intake-wiring
description: "MatrixIntake WAVE 2 — primary intake path, all 10 slots, goal admission, loop-to-completeness, relevance scoping, skip, honest-incompleteness gate fix"
metadata: 
  node_type: memory
  type: project
  originSessionId: a37a1361-29d8-4f24-944f-5a166012f14f
---

`MatrixIntake.jsx` is the sole primary intake path as of WAVE 2. All three tiers rebuilt.

**What was built (WAVE 2):**

**PART A — Cutover:**
- `StructurePageConsolidated.jsx` — removed `GoalAdmissionPage` and `MasterPlanIntake` from render; `MatrixIntake` is the primary intake in both MODULE 1 (blank-state `!showMasterPlanFlow`) and `MasterPlanStructureSection`
- `MatrixIntake.jsx` — full rewrite with 5-phase state machine: `goal → scope → engine → loop → done`
- Phase 0 (goal entry): collects goal text + deadline; calls `store.masterPlanIntakeStart(profileId)` + `store.masterPlanIntakeAnswer(goalText)` + `store.attemptGoalAdmission({ contract: { goalId, goalText, terminalOutcome, deadline } })`. After admission, transitions to scope/engine phases.

**PART B — Seven governing rules:**
1. Cell-derived questions: enforced by engine (unchanged)
2. Natural phrasing: `PROBE_OVERRIDES` map in MatrixIntake overrides schema-heavy `probe.spine` for known fieldNames (verificationSourceId, completionEvidence, dependencyType, edgeType, bindingDimension, needStatement, gapStatement, activationState, classification)
3. Strict fill-order: `FULL_SLOT_ORDER` const defines entity→...→bootstrap order
4. Loop-to-completeness: after each slot engine hits `step.done`, enters `loop` phase; "Is there another X?" → Yes re-enters same slot engine with updated matrix; No advances
5. Relevance scoping: `OPTIONAL_SECTIONS` set + `SCOPE_QUESTIONS` map; non-optional slots (entity, project, bootstrap) enter directly; optional slots show scope question first
6. Honest incompleteness: `hasAuthoredSubstance.ts` — added `HONEST_INCOMPLETENESS_RE` before jargon check; "not started", "unknown", "tbd", "haven't decided" etc. pass gates without reprobe
7. Never trap: `advanceSlot()` wired to "Skip this section →" button on every engine probe

**PART C — Mechanical fixes:**
- Button run-together: `gap: 8` on PickSetInput flex container
- Probe framing: `SECTION_FRAMING` dict adds brief intent line above each probe
- Reprobe visual distinction: amber `↩` icon box with hint to say "not started" if unknown

**Slot management (key invariant):**
- `enterQueue(queue, matrix)` walks queue, skips empty slots (step.done immediately), stops at optional section (scope) or first slot with probes (engine)
- `pendingRefresh` useEffect runs after dispatches update store.matrix — refreshes engine, detects step.done (→ loop) vs more probes (→ engine)
- Remount after goal admission is handled: MatrixIntake mounted with `hasAdmittedGoal=true` starts in `'entering'` phase which immediately calls `enterQueue([...FULL_SLOT_ORDER], matrix)`

**True baseline:** 17 failures in `tests/state/`, 29 total across suite (all pre-existing — confirmed by git stash verification). Zero new failures introduced by WAVE 2.

**Next:** Verification — run the Global State Solutions goal end-to-end and check all 7 outcomes.

**How to apply:** The `enterQueue(queue, matrix)` pattern is the correct way to advance slot state — it handles empty slots, optional sections, and done state in one pass. Don't try to advance slot state outside this function.
