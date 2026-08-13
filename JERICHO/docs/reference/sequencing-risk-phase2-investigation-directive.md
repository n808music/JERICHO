# Sequencing Risk Phase 2 — Investigation Directive

**Date:** 2026-08-12 23:05 CDT  
**Status:** Ready for Claude Code execution  
**Scope:** Two investigations before implementation code

---

## Read First

`docs/reference/sequencing-risk-phase2-locked-directive.md` on main — all decisions in that doc are locked, do not re-derive.

This message covers only the two open investigations blocking implementation.

---

## Investigation 1: Intake Flow Placement

**Question:** Where in MatrixIntake should the Sequencing Risk classification question sit?

**Map current structure:**
1. Is MatrixIntake slot-based (following elicitation engine pattern) or linear flow?
2. Find natural point near other Foundation-level decisions
3. Rationale (locked, do not re-derive): Sequencing Risk is more load-bearing at creation time than Pricing was — its output is an enforced dependency edge, not discretionary recommendation

**Deliverable:**
- Recommend specific slot/section location
- Match naming pattern PRICING_STRATEGY_SLOT used in elicitationEngine.js registration
- Propose component structure (e.g., SequencingStrategyProbe.jsx or integrate into Initiative slot)

---

## Investigation 2: Reconfiguration Surface

**Question:** Does Initiative have an existing edit/detail view where post-creation changes live?

**Explore:**
1. Initiative detail panel — does it exist today?
2. Does it allow inline edits of other fields (phase, purpose)?
3. If yes → confirm that's reconfiguration location (Option B)
4. If no → default to button pattern (proven in Pricing, don't invent new pattern)

**Deliverable:**
- Confirm reconfiguration path (new button like Pricing, or existing edit surface)
- If existing surface: describe it (component name, current edit capabilities)
- If new button: name it consistently (e.g., SequencingStrategyReconfigureButton.jsx)

---

## Locked (Reused, Not Re-Derived)

Do not touch these, they are proven and persist from Pricing Phase 1:

- ✅ Shared `riskClassification` field (already on Initiative schema)
- ✅ Three-question probe (extract from `pricingStrategySlot.js`, don't duplicate)
- ✅ Probe-skip logic (if classification exists, show recommendation + change link, skip questions)
- ✅ Output mapping (Differentiation → Foundation-first; Validation → Output-first)
- ✅ Recommendation only, no auto-edges (operator explicitly accepts before CONSTRAINT)
- ✅ Inconclusive explicit (three operator choice buttons, no silent default)
- ✅ Cross-effect disclosure (intake warns: "affects pricing too")

---

## Evidence Standard

Same as Pricing Phase 1:
- Named tests, isolation-verified
- Baseline cross-checked by name (current: 37 = 36 baseline + 5 named flaky tests)
- No "within range" language

---

## Deliverable for This Pass

**Before writing any implementation code:**
1. Answer Investigation 1: intake slot/section location + component names
2. Answer Investigation 2: reconfiguration path (button or existing surface) + component names
3. Proposal doc ready for approval

**Then:** Implementation follows proven Pricing v1 method (advisory → probe → reducer → UI → tests).

---

**Start with investigations. Propose, don't implement. Wait for approval before code.**
