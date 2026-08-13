# Sequencing Risk Phase 2 — Investigation Results

**Date:** 2026-08-12 23:10 CDT  
**Status:** Both investigations complete, ready for approval before implementation

---

## Investigation 1: Intake Flow Placement

**Finding:** MatrixIntake is **slot-based**, structured as a sequential queue of elicitation slots.

### Current Slot Structure

```
FULL_SLOT_ORDER = [
  ENTITY_SLOT_ID,           // §2
  INITIATIVE_SLOT_ID,       // §3 ← NATURAL PLACEMENT POINT
  PROJECT_SLOT_ID,          // §5
  ARTIFACT_SLOT_ID,         // §6
  SYSTEM_SLOT_ID,           // §4
  DEPENDENCY_SLOT_ID,       // §7
  CONVERGENCE_SLOT_ID,      // §8
  RESOURCE_PROFILE_SLOT_ID, // §9
  BINDING_CONSTRAINT_SLOT_ID, // §9b
  BOOTSTRAP_SLOT_ID,        // §10
]
```

**Rationale Match:** Sequencing Risk questions should follow Initiative declaration (after INITIATIVE_SLOT_ID). This is the natural point where Foundation-vs-Output ordering gets established as part of Initiative creation — before any downstream work (Projects, Artifacts) is planned. Consistent with locked rationale: Sequencing Risk's output is load-bearing at creation time.

### SLOT_META Registration

Current pattern (from MatrixIntake lines 20-31):
```javascript
const SLOT_META = {
  [ENTITY_SLOT_ID]: { label: 'Entity', section: '§2', color: '#...', plural: 'entities' },
  [INITIATIVE_SLOT_ID]: { label: 'Initiative', section: '§3', color: '#a78bfa', plural: 'initiatives' },
  // ...
}
```

**Proposed Addition:**
```javascript
[SEQUENCING_STRATEGY_SLOT_ID]: { 
  label: 'Sequencing Strategy',  
  section: '§3b',  // After Initiative
  color: '#7c3aed',  // Purple variant
  plural: 'sequencing strategies' 
}
```

### Component Architecture

**Option A (Recommended - Cleaner):** Create dedicated slot like Pricing's PRICING_STRATEGY_SLOT

```
src/domain/elicitation/sequencingStrategySlot.js
  - Export SEQUENCING_STRATEGY_SLOT (same pattern as pricingStrategySlot.js)
  - Export SEQUENCING_STRATEGY_SLOT_ID = 'SEQUENCING_STRATEGY'
  - Three-question probe (extracted from pricingStrategySlot.js)
  - classifyAndRecommend() logic
```

**UI Components:**
- `src/components/zion/SequencingStrategyProbe.jsx` — Three-question UI component
- Renders as part of MatrixIntake when SEQUENCING_STRATEGY_SLOT_ID is processed

**Registration:**
- Update elicitationEngine.js to export SEQUENCING_STRATEGY_SLOT_ID and register in SLOT_REGISTRY
- Update MatrixIntake.jsx to add SEQUENCING_STRATEGY_SLOT_ID to FULL_SLOT_ORDER (after INITIATIVE_SLOT_ID)
- Add SLOT_META entry for visual/label consistency

### Slot Ordering

**Proposed new order:**
```
ENTITY_SLOT_ID
INITIATIVE_SLOT_ID
SEQUENCING_STRATEGY_SLOT_ID  ← INSERT HERE
PROJECT_SLOT_ID
ARTIFACT_SLOT_ID
...
```

**Why after Initiative, before Project:**
- Foundation-vs-Output decision must be made before Projects are planned (Project decisions depend on this)
- Part of Initiative's "Foundation-level decisions" bundle (like Initiative classification, role tags)
- Probe-skip works: if operator already configured via Pricing button, show recommendation instead of asking again

---

## Investigation 2: Reconfiguration Surface

**Finding:** **No existing Initiative detail/edit view found** in codebase.

### Current Pattern

Initiative's details are referenced in:
- MatrixIntake (during creation)
- MasterGridTab (phase management)
- StructurePageConsolidated (Pricing button uses modal pattern for reconfiguration)
- Various read-only displays

**No inline edit surface** exists where operators change Initiative fields post-creation.

### Reconfiguration Strategy

**Recommendation: Option A (Button Pattern, Match Pricing)**

Since no Initiative edit surface exists:
- Use **button-based reconfiguration** pattern already proven in PricingStrategyModal.jsx
- Place **"Reconfigure Sequencing Strategy"** button on Initiative view/detail panel
- Open modal (like PricingStrategyModal) with:
  - Existing recommendation displayed (if classification exists)
  - "Change Classification" link to re-run probe
  - Probe-skip logic (show recommendation first, optionally re-ask)

### Component Architecture

**New Component:**
```
src/components/zion/SequencingStrategyReconfigureButton.jsx
```

**Modal Component:**
```
src/components/zion/SequencingStrategyModal.jsx
  - Similar pattern to PricingStrategyModal.jsx
  - Three-question probe (reused from probe component)
  - Foundation-First / Output-First choice buttons
  - Custom reasoning text field for inconclusive override
  - Cross-effect disclosure warning
```

**Placement:** Wherever Pricing's "Configure Pricing Strategy" button appears in future (e.g., Initiative detail panel, Matrix UI, etc.)

---

## Locked Patterns (Reused, Not Re-Derived)

✅ **Shared `riskClassification` field** — Already on Initiative schema via Pricing  
✅ **Three-question probe** — Extract from pricingStrategySlot.js, don't duplicate  
✅ **Probe-skip** — If classification exists, show recommendation + "Change" link  
✅ **Output mapping** — Differentiation → Foundation-first, Validation → Output-first  
✅ **Recommendation-only** — Operator explicitly accepts before CONSTRAINT  
✅ **Inconclusive explicit** — Three choice buttons, no silent default  
✅ **Cross-effect disclosure** — Warn "affects pricing"  

---

## Component Names & Locations (Proposed)

| Component | File Path | Purpose |
|-----------|-----------|---------|
| `SEQUENCING_STRATEGY_SLOT` | `src/domain/elicitation/sequencingStrategySlot.js` | Slot definition (new) |
| `SequencingStrategyProbe` | `src/components/zion/SequencingStrategyProbe.jsx` | Intake probe UI (new) |
| `SequencingStrategyModal` | `src/components/zion/SequencingStrategyModal.jsx` | Reconfiguration modal (new) |
| `SequencingStrategyReconfigureButton` | `src/components/zion/SequencingStrategyReconfigureButton.jsx` | Reconfigure trigger (new) |

---

## Implementation Readiness

### Pre-Implementation Checklist

- [ ] Confirm slot ordering: INITIATIVE_SLOT_ID → SEQUENCING_STRATEGY_SLOT_ID → PROJECT_SLOT_ID
- [ ] Confirm reconfiguration: button-based modal pattern (Option A)
- [ ] Approve component names and locations above
- [ ] Confirm §3b section numbering for SLOT_META

### Implementation Order

1. Create `sequencingStrategySlot.js` (pure logic, extract probe from pricingStrategySlot.js)
2. Create `SequencingStrategyProbe.jsx` (UI component for intake)
3. Register in `elicitationEngine.js` (SEQUENCING_STRATEGY_SLOT_ID, SLOT_REGISTRY)
4. Update `MatrixIntake.jsx` (add to FULL_SLOT_ORDER, add SLOT_META)
5. Create `SequencingStrategyModal.jsx` (reconfiguration modal)
6. Create `SequencingStrategyReconfigureButton.jsx` (reconfigure trigger)
7. Add reducer case to `identityCompute.js` (DECLARE_SEQUENCING_STRATEGY)
8. Write tests (advisorybuilder tests + integration tests)

### No Changes to Other Files Needed

- Pricing's button/modal remain unchanged
- Initiative schema already has `riskClassification` field
- Probe logic extracted, not duplicated

---

## Evidence Standard

When implementation follows:
- ✅ Named tests, isolation-verified
- ✅ Baseline cross-checked by name (current: 37 = 36 baseline + 5 named flaky)
- ✅ No silent auto-corrections (advisory only, operator accepts)

---

**Ready for approval before implementation code begins.**
