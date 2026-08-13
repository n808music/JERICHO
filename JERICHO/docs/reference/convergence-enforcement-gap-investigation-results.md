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

**Finding:** **Application-level "before-save" validation is sufficient for Phase 1.**

### Real-Time vs. Before-Save (Application-Level)

**Terminology clarification:** "Pre-commit" here means **application-level checkpoint before save**, NOT a git pre-commit hook. Operator must see conflicts when actually editing Jericho data, not just in developer commits.

**Real-Time Checking (NOT required for Phase 1):**
- Wired into every Project Terminal Date change (scheduler, drag-drop, reschedule)
- Instant feedback, but:
  - Higher complexity (more code paths to instrument)
  - More computation overhead (check on every keystroke)
  - More noisy warnings (operator may be mid-drag)

**Before-Save Validation (RECOMMENDED for Phase 1):**
- Single validation function: check all Convergence edges when plan is about to be applied/saved to store
- Triggered: before `store.dispatch()` that changes a Project's Terminal Date or applies cycle
- Application-level, inside Jericho (not git hook)
- Simple, contained, low risk
- Sufficient: operator sees conflicts before save completes, can abort or reconfigure

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

**Calling pattern (application-level, before dispatch):**
```
const issues = validateConvergenceConsistency(state);
if (issues.length > 0) {
  // Show advisory UI, operator can proceed or abort
  showAdvisoryWarning(issues);
}
// Then proceed with dispatch
```

NOT a git pre-commit hook — runs inside the Jericho app when operator saves/applies changes.

### Scope

- No changes to real-time scheduling paths
- No new gate failure codes
- New advisory flag type (like plan-quality flags)
- One validation pass function

---

## Investigation 4: Drift Detection Generalization

**Finding:** **YES — one generalized cross-reference integrity checker can cover both Convergence enforcement and drift detection.**

### Four Drift Patterns Identified (Grounding & Scope)

**Pattern 1: Convergence date consistency** ⏳ HYPOTHESIZED (preventative, not yet observed)
- Convergence edge declares "sources meet at DATE"
- Project Terminal Dates don't match expected shared date
- **Why Phase 1:** Shares underlying validation logic with Pattern 3 (both check "does this value/reference match expectation?"). Cheap to add when building Pattern 3's reference checker.
- **Severity:** High if it occurs (breaks shared deadline assumption)

**Pattern 2: Convergence source reference validity** ⏳ HYPOTHESIZED (preventative, not yet observed)
- Convergence edge references a source Project by ID
- Project is deleted or ceases to exist
- Edge points to nothing
- **Cost Analysis:** Doesn't naturally share code with Pattern 4. Pattern 2 is forward lookup ("does this reference resolve?"), Pattern 4 is backward impact ("what breaks when name changes?"). HOWEVER, if Pattern 4's validator uses an extensible reference-resolver registry, Pattern 2 becomes cheap — just register one more resolver. Recommend: design Pattern 4 with resolver registry from start, makes Pattern 2 free to add.
- **Decision:** Include in Phase 1 if Pattern 4 uses resolver pattern; defer if Pattern 4 hardcodes entity types.
- **Severity:** High (broken reference in Convergence Declaration)

**Pattern 3: Deliverable↔Artifact parent reference validity** ✅ OBSERVED (IC Season 1-4/F8 GUM gap)
- Artifact names parent Deliverable ID
- Parent Deliverable is deleted
- Reference is now broken
- **Why Phase 1:** Real incident, already identified. Core check for structural integrity.
- **Severity:** Medium (lineage broken, but UI can still render)

**Pattern 4: Cross-Tab Naming Consistency** ✅ OBSERVED (Desiree project name drift)
- Any entity's name changes (e.g., Project renamed)
- References elsewhere still use old name (e.g., Convergence edge, Deliverable parent)
- References become stale/broken
- **Why Phase 1:** Real incident from tonight. Foundational for maintaining referential integrity across state.
- **Severity:** Variable (depends on reference criticality)

### Generalized Validator Pattern (Extensible From Start)

**Architecture Options:**

**Option A: Flat check registry (simpler, less extensible for Pattern 2)**
```javascript
interface CheckResult { isValid: boolean, issues: Issue[] }

export function validateCrossReferenceIntegrity(state) {
  const issues = [];
  issues.push(...validateConvergenceDates(state));
  issues.push(...validateConvergenceReferences(state));
  issues.push(...validateArtifactParents(state));
  issues.push(...validateNamingConsistency(state));
  return { isConsistent: issues.length === 0, issues };
}
```
**Cost of Pattern 2:** Bespoke lookup logic, ~50 lines, deferred to Phase 2.

**Option B: Reference resolver registry (more extensible, makes Pattern 2 cheap)**
```javascript
const REFERENCE_RESOLVERS = {
  'artifact-parent': (state, parentId) => state.projects.byId[parentId],
  'convergence-source': (state, sourceId) => state.matrix.projectsById[sourceId],
  // new resolvers register here easily
};

export function validateReferenceIntegrity(state) {
  const issues = [];
  // All checks use resolver registry
  issues.push(...validateConvergenceDates(state, REFERENCE_RESOLVERS));
  issues.push(...validateArtifactParents(state, REFERENCE_RESOLVERS));
  issues.push(...validateNamingConsistency(state, REFERENCE_RESOLVERS));
  issues.push(...validateConvergenceSources(state, REFERENCE_RESOLVERS)); // Pattern 2, cheap
  return { isConsistent: issues.length === 0, issues };
}
```
**Cost of Pattern 2:** One resolver registration, ~5 lines, included in Phase 1.

**Recommendation:** Build Option B from start. Minimal extra complexity, but enables Pattern 2 to be included in Phase 1 with zero implementation cost.

### Implementation Scope (Phase 1, 3 or 4 checks depending on architecture choice)

Create one `crossReferenceIntegrityValidator.js`:
- **Option A implementation:** 3 checks (Patterns 1, 3, 4)
- **Option B implementation:** 4 checks (Patterns 1, 2, 3, 4)

Recommended: **Option B** for extensibility and to include Pattern 2 with no extra cost.

Call same function for:
- Convergence enforcement
- Drift detection
- Pre-commit validation
- Data integrity audits

---

## Phase 1 Minimal Build (3 Confirmed + 1 Conditional Pattern)

### What's Definitely In

1. **Before-Save Validation Pass** (Investigation 3)
   - Single function: `validateConvergenceConsistency(state)`
   - Check Convergence edges before cycle apply/save (application-level)
   - Return advisory flags (not blocking)

2. **Cross-Reference Integrity Checker** (Investigation 4)
   
   **Pattern 1: Convergence Date Consistency** ✅ IN PHASE 1
   - Check all Convergence edges against Project Terminal Dates
   - Shares validation logic with Pattern 3 (both check value/reference match)
   - Hypothesized (preventative infrastructure for future Convergence edits)
   - Low cost: reuses Pattern 3's reference checker framework
   
   **Pattern 3: Deliverable↔Artifact Parent Integrity** ✅ IN PHASE 1
   - Check Artifacts' parent Deliverable references
   - OBSERVED: IC Season 1-4/F8 GUM gap
   - Core structural integrity check
   
   **Pattern 4: Cross-Tab Naming Consistency** ✅ IN PHASE 1
   - Check if entity name changes break references elsewhere
   - OBSERVED: Desiree project name drift
   - Foundational for referential integrity across state
   
3. **Advisory Flag Type** (new)
   - Like plan-quality flags
   - Rendered in UI without blocking
   - Operator can see conflicts and choose to proceed or reconfigure

### Pattern 2: Conditional on Validator Design

**Pattern 2: Convergence Source Reference Validity**
- Check if Projects referenced in Convergence edges still exist
- Hypothesized (preventative infrastructure)
- **Cost depends on implementation architecture:**
  - If Pattern 4's validator uses extensible reference-resolver registry: Pattern 2 is cheap (~1 resolver registration)
  - If Pattern 4 hardcodes entity types: Pattern 2 needs separate lookup logic (~50 lines)

**Recommendation:** Include Pattern 2 in Phase 1 IF validator is designed with resolver registry from start (makes Pattern 2 free). Otherwise defer to Phase 2.

**Decision point:** User approval needed on validator architecture before final Phase 1 scope is locked.

### What's NOT In Phase 1

- Real-time checking wired into every date change (event overhead too high, noisy warnings)
- Hard-blocking gate failure codes (violates Learning Boundary: advisory-only, operator accepts)

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
