# Sequencing Risk UI — Phase 2 Implementation Directive (Option C, Locked)

**Date:** 2026-08-12 22:40 CDT  
**Decision:** Option C (Lightweight Intake + Reconfigurable Later)  
**Status:** Ready for implementation, two investigations needed before code.

---

## Locked Decisions (Do Not Re-Derive)

### ✅ UI Placement
**Lightweight classification question during Initiative creation/intake flow** (not a standalone button)

**Rationale:** Unlike Pricing's prospective planning, Sequencing Risk's output is a dependency-edge CONSTRAINT enforced by feasibility gate. Asking after blocks are built = too late. Asking at creation costs nothing (no blocks exist yet to reorder). Initiative operators must pick Foundation-vs-Output ordering upfront.

### ✅ Reconfiguration Path
**Pending:** Investigate where operators should reconfigure their answer post-creation (see "Investigation 2" below)

**Two options, pick one (default to first unless investigation finds existing edit surface):**
- **Option A (default):** Reconfigure button on Initiative view (same pattern as Pricing, consistent discovery)
- **Option B:** Inline on existing Initiative edit/detail surface (if one already exists)

### ✅ Classification Mechanism (Proven, Reuse Exactly)
- **Shared field:** `riskClassification` (already on schema via Pricing)
- **Three-question probe:** Extract logic from `pricingStrategySlot.js` (don't rewrite)
  1. Category precedent — proven non-commoditized winners?
  2. Audience precedent — target customers engaged with similar offerings?
  3. Competitive density — competitive or underserved?
- **Logic:** 2+ same-direction → classify; split → inconclusive
- **Storage:** Same `riskClassification` field, no second field

### ✅ Probe-Skip Logic
If `riskClassification` already set (e.g., via Pricing button before intake):
- **In intake:** Show existing classification + recommendation, skip probe questions
- **On reconfiguration:** Show existing recommendation + "Change Classification" link

**Payoff of shared architecture:** If operator configured Pricing first, Sequencing visibly reuses that decision.

### ✅ Output Mapping (Evidence-Grounded, Locked)

**Differentiation Risk → Foundation-First**
- Recommendation: Foundation (business plan, brand, positioning) precedes or runs with first Output
- Reasoning: Strong category + audience precedent = Foundation investment well-justified
- **Default edge:** Foundation → Output (real CONSTRAINT, operator must explicitly accept)
- Exception: Downweight if proven product-market fit exists (requires reasoning)

**Validation Risk → Output-First**
- Recommendation: Minimal, falsifiable Output test precedes heavy Foundation investment
- Reasoning: Weak precedent = demand uncertainty primary risk; get signal before heavy spend
- **Default edge:** Output → Foundation (real CONSTRAINT, operator must explicitly accept)
- Exception: Flip if founder track record / institutional backing substitutes for product evidence (requires reasoning)

**Inconclusive → Explicit Operator Choice**
- No silent default
- "Foundation-First" OR "Output-First" buttons with reasoning text field
- Operator picks based on risk tolerance

### ✅ Enforcement Pattern (Locked from Pricing, Applies Here)
- Classification produces **recommendation + default edge**
- Operator must **explicitly accept** before edge becomes a real CONSTRAINT in feasibility gate
- If operator rejects: no edge, but recommendation still available
- Reasoning capture for all overrides (same as Pricing)

### ✅ Cross-Effect Disclosure (Locked)
Modal/intake warning (inverse of Pricing's):
```
⚠️ Important:
This classification is shared with your pricing strategy planning.
If you change it here, it will affect pricing recommendations too.
```

---

## Investigations Before Implementation Code

### Investigation 1: Intake Flow Architecture
**Question:** Where in MatrixIntake.jsx should the Sequencing Risk classification sit?

**To answer this, explore:**
1. How is MatrixIntake structured? (Section-based slots? Linear flow?)
2. Where do other Foundation-level decisions live? (e.g., entity ownership, role tags, phase selection)
3. Is Initiative classification already asked somewhere? (if so, natural place to add Sequencing Risk question nearby)
4. Current Initiative intake flow:
   - Does probe happen after entity + name are set?
   - Or earlier, when Initiative slot is first declared?
   - Are role-tags (system/project) asked during intake, or post-creation?

**Output:** Recommend specific slot/section location + whether probe should be mandatory or optional during intake.

### Investigation 2: Reconfiguration Surface
**Question:** Does an Initiative already have an edit/detail view where reconfiguration naturally belongs?

**To answer this, explore:**
1. Is there a read-only Initiative detail panel already?
2. Does it allow inline edits of any fields (e.g., phase, purpose)?
3. Or is reconfiguration always modal-based (like Pricing)?
4. What's the pattern for changing other shared-decision fields (e.g., if phase is editable, how)?

**Output:** Confirm reconfiguration path (A: new button, or B: inline on existing surface). If B, describe the existing surface.

---

## Implementation Outline (Once Investigations Complete)

### New Files
1. **`src/components/zion/SequencingStrategyProbe.jsx`** (or integrate into MatrixIntake)
   - Three-question probe component for intake
   - Probe-skip logic if `riskClassification` exists
   
2. **`src/components/zion/SequencingStrategyReconfigureButton.jsx`** (if Investigation 2 picks Option A)
   - Button for post-creation reconfiguration
   - Opens modal with recommendation + choice UI

3. **`src/state/__tests__/sequencingStrategyAdvisory.test.js`**
   - Tests for output mapping (Differentiation → Foundation-first, etc.)
   - Tests for edge recommendation logic

### Modified Files
1. **`src/state/sequencingStrategyAdvisory.js`** (NEW)
   - Advisory builder: takes `riskClassification`, returns Foundation-vs-Output recommendation + default edge

2. **`src/ui/masterPlan/MatrixIntake.jsx`**
   - Add Sequencing Risk probe to Initiative slot intake (or create separate slot, depending on Investigation 1)
   - Probe-skip logic

3. **`src/state/identityCompute.js`**
   - Add `DECLARE_SEQUENCING_STRATEGY` reducer case
   - Modifies Initiative with operator's Foundation-vs-Output choice
   - Stores default edge as recommendation (not auto-authored yet)

4. **`src/components/zion/InitiativeDetailPanel.jsx`** (or wherever Initiative edit lives)
   - Add reconfiguration button (Option A) or inline editor (Option B per Investigation 2)

5. **`src/domain/elicitation/pricingStrategySlot.js`**
   - Extract probe logic into shared utility if needed
   - Or mark clearly where probe logic is shared (don't duplicate)

---

## Evidence Standard (Unchanged)

Same as Pricing Phase 1:
- ✅ Named test files, isolation-verified
- ✅ Cross-checked against baseline doc
- ✅ No "within range" language
- ✅ Real diffs for all files
- ✅ No auto-authored edges until operator accepts

**Current baseline:** 36 failures + 5 known-flaky tests (documented by name in baseline-test-failures-2026-08-07.md)

---

## Next Steps (Order Matters)

1. **Investigation 1:** Where in intake flow? (< 15 minutes exploration)
2. **Investigation 2:** Where for reconfiguration? (< 15 minutes exploration)
3. **Confirm locations** → Ready for implementation code
4. **Implementation** follows Pricing's proven order:
   - Advisory function (pure)
   - Probe + classification logic
   - Reducer case
   - UI components (intake probe + reconfiguration button/inline)
   - Tests
5. **Evidence verification:** Same standard as Pricing

---

## Key Invariants (Do Not Violate)

🔒 One `riskClassification` field, not two  
🔒 Reuse (don't duplicate) the three-question probe logic  
🔒 Probe-skip if classification exists (benefit of shared architecture)  
🔒 Foundation-vs-Output ordering is a real CONSTRAINT recommendation (unlike Pricing's advisory-only)  
🔒 Operator must explicitly accept before edge is enforced  
🔒 Inconclusive requires explicit choice (no silent defaults)  
🔒 Cross-effect disclosure in both directions  
🔒 Evidence standard: named tests, isolation-verified, baseline cross-checked  

---

**Ready:** Start with investigations (1 + 2 above), confirm locations, then implement.  
**Timeline:** Investigation < 30 min. Implementation follows proven Pricing v1 method.
