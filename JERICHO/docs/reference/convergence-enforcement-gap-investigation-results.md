# Convergence Enforcement Gap + Drift Detection — Investigation Results

**Date:** 2026-08-12 23:15 CDT  
**Status:** Four investigations complete, ready for approval before implementation

---

## Investigation 1: Feasibility Gate Integration

**Finding:** Feasibility gate **does NOT currently read Convergence Declarations** — this would be a **net-new read path**.

### Current Data Flow

**Feasibility Gate (`computeFeasibility`):**
- Called from `identityCompute.js:7632`
- Receives: `{ goalId, deadlineISO, executionType }, state, constraints, nowISO`
- Reads: execution blocks, work items, capacity constraints, deadline
- **Does NOT inspect:** `state.matrix.convergenceEdgesById` or convergence data

**Convergence Data:**
- Stored in `state.matrix.convergenceEdgesById` (edges between Projects)
- Tracked in `state.matrix.convergenceDetectionState` (detection candidates)
- **Never read during feasibility computation** (confirmed via grep: zero `convergence` references in `feasibility.ts`)

### Scope Impact

Adding Convergence enforcement requires:
1. **New read path:** Pass `convergenceEdgesById` to feasibility gate
2. **New validation logic:** Check if Project's Terminal Date change breaks registered Convergence edges
3. **New gate failure code:** e.g., `CONVERGENCE_VIOLATION_DETECTED`

**Decision point:** This is architectural — feasibility gate's current scope is per-goal, per-cycle. Convergence violations are cross-goal (one lane's change breaks another lane's deadline). Recommend separate validation pass (Investigation 3) rather than modifying feasibility gate directly.

---

## Investigation 2: "Enforce" Definition

**Finding:** Per Learning Boundary, enforcement means **ADVISORY + SURFACING**, not blocking.

### Recommended Pattern (Option B from original)

**Advisory Warning Pattern:**
- Scheduler allows Project Terminal Date to change
- **Validation detects** the conflict: "Project X (Convergence source) is now DATE_NEW; this breaks Convergence edge with Project Y (expected shared date DATE_OLD)"
- **Gate flags** with structured warning (not error)
- **Operator sees** the warning, chooses:
  - Accept change (divergence acknowledged)
  - Or: reconfigure Convergence Declaration to include new date

**Why not Option A (Hard Block):**
- Blocks operator from making deliberate trade-offs
- Violates Learning Boundary (advisory only, operator accepts)
- Consistent with Pricing (recommendation-only, operator chooses)
- Consistent with Sequencing Risk (recommendation-only, operator chooses)

### Gate Semantics

**Not a failure code.** Convergence drift is not "failed validation," it's "inconsistency detected."

Recommendation: New advisoryFlag (like plan-quality flags), separate from gate failure codes.

---

## Investigation 3: Minimal Viable Version

**Finding:** **Pre-commit validation pass is sufficient for Phase 1.**

### Real-Time vs. Pre-Commit

**Real-Time Checking (NOT required for Phase 1):**
- Wired into every Project Terminal Date change (scheduler, drag-drop, reschedule)
- Instant feedback, but:
  - Higher complexity (more code paths to instrument)
  - More computation overhead (check on every keystroke)
  - More noisy warnings (operator may be mid-drag)

**Pre-Commit Validation Pass (RECOMMENDED for Phase 1):**
- Single validation function: check all Convergence edges when plan is about to be applied/committed
- Triggered: before cycle save, before plan apply
- Simple, contained, low risk
- Sufficient: operator sees conflicts before committing, can adjust

**Minimal Viable for Phase 1:**
```
function validateConvergenceConsistency(state) {
  // For each Convergence edge in matrix.convergenceEdgesById:
  //   - Get all source Projects' Terminal Dates
  //   - Compare against shared deadline expectation
  //   - If mismatch: add advisory flag (don't block)
  // Return: { isConsistent, warnings: [...] }
}
```

Call this before: cycle apply, plan commit, schedule save

### Scope

- No changes to real-time scheduling paths
- No new gate failure codes
- New advisory flag type (like plan-quality flags)
- One validation pass function

---

## Investigation 4: Drift Detection Generalization

**Finding:** **YES — one generalized cross-reference integrity checker can cover both Convergence enforcement and drift detection.**

### Three Drift Patterns (All Cross-Reference Mismatches)

1. **Convergence date drift** (existing bug, e.g., Academy/79th St)
   - Convergence edge says "sources meet at DATE"
   - Project Terminal Dates don't match

2. **Convergence naming drift** (e.g., Desiree)
   - Convergence edge references Project by name
   - Project name changes, edge is orphaned
   - Or: Project is deleted, edge still points to it

3. **Deliverable↔Artifact parent drift** (structural consistency)
   - Artifact names parent Deliverable ID
   - Parent Deliverable is deleted or renamed
   - Reference is now broken

### One Generalized Validator

**Pattern:** Cross-reference integrity checker

```
interface CrossReferenceCheck {
  name: string;
  validate(state): { isValid: boolean, issues: Issue[] }
}

// Registered checks:
ConvergenceDateConsistencyCheck
ConvergenceReferenceCheck (names, IDs)
DeliverableArtifactParentCheck
NamingConsistencyCheck
```

Each check:
- Runs independently
- Returns structured issues (not hard failures)
- Issues are advisory flags, not gate failures

**Benefits:**
- One validation infrastructure, multiple checks
- Extensible (new checks added without restructuring)
- Separates concern (each check is responsible for one relationship)
- Efficient (batch all at once, not scattered through code)

### Implementation Scope

Create one `crossReferenceIntegrityValidator.js`:
```javascript
export function validateCrossReferenceIntegrity(state) {
  const issues = [];
  
  // Check 1: Convergence date consistency
  issues.push(...validateConvergenceDates(state));
  
  // Check 2: Convergence references validity
  issues.push(...validateConvergenceReferences(state));
  
  // Check 3: Deliverable↔Artifact parent links
  issues.push(...validateArtifactParents(state));
  
  // Check 4: Naming consistency
  issues.push(...validateNamingConsistency(state));
  
  return { isConsistent: issues.length === 0, issues };
}
```

Call same function for:
- Convergence enforcement
- Drift detection
- Pre-commit validation
- Data integrity audits

---

## Phase 1 Minimal Build (Recommended Scope)

### What's In

1. **Pre-commit validation pass** (Investigation 3)
   - Single function: `validateConvergenceConsistency(state)`
   - Check Convergence edges before cycle apply
   - Return advisory flags (not blocking)

2. **Cross-reference integrity checker** (Investigation 4, v1)
   - Start with two checks: Convergence dates + Deliverable↔Artifact parents
   - Extensible pattern for future checks
   - Same call signature for all validation scenarios

3. **Advisory flag type** (new)
   - Like plan-quality flags
   - Rendered in UI without blocking

### What's NOT In Phase 1

- Real-time checking wired into every date change (defer to Phase 2)
- Hard-blocking gate failure codes (advisory-only per Learning Boundary)
- All four drift patterns (start with two, add naming + reference checks in Phase 2)

### Scope Justification

- **Minimal:** one validation pass function, advisory only
- **Shipped:** solves the immediate Convergence drift bug (Academy/79th St)
- **Extensible:** infrastructure handles all drift patterns without restructuring
- **Safe:** no gate changes, no scheduler changes, pure validation layer

---

## Evidence Standard

**Named findings verified against codebase:**
✅ Feasibility gate grep search confirms zero Convergence references in feasibility.ts  
✅ computeFeasibility call site confirms Convergence data not passed  
✅ Convergence storage location confirmed in matrix.convergenceEdgesById  
✅ Three drift patterns identified and mapped to generalization  

**Cross-checked against Learning Boundary:**
✅ All enforcement is advisory (not blocking, not silent auto-correction)  
✅ Operator agency preserved (operator accepts any changes)  
✅ Consistent with Pricing + Sequencing Risk patterns  

---

## Ready for Approval

Investigation results documented above.

**Phase 1 Scope (Recommended):**
- Pre-commit validation pass
- Cross-reference integrity checker (v1: 2 of 4 patterns)
- Advisory flags (no blocking, no gate changes)

**Estimated Files:**
- `src/state/engine/crossReferenceIntegrityValidator.js` (new)
- `src/state/identityCompute.js` (modify: add validation call before cycle apply)
- `src/state/advisoryFlags.js` or integrate into existing flag infrastructure

**No changes needed to:**
- Feasibility gate
- Scheduling engine
- Convergence edge storage

---

**Awaiting approval before implementation code begins.**
