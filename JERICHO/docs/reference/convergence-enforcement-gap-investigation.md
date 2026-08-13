# Convergence Enforcement Gap — Investigation & Scope Directive

**Date:** 2026-08-12 22:50 CDT  
**Status:** Pre-implementation scoping and definitional decision  
**Scope:** Terminal Deadline definition (1 decision) + Convergence enforcement (3 investigations) + Drift detection generalization (1 investigation)

---

## Step 1: Terminal Deadline Definition (Decision, Not Build)

**Current doctrine:** "Terminal Deadline ≥ Release Date always" (partial)

**Confirm definition before proceeding:**
- **Terminal Deadline = end of post-release work**, not ship date
- This is distinct from Release Date (customer-facing ship)
- All Convergence Declaration reasoning assumes this definition

**Open decision: Grandfathering**

Existing Terminal Dates in code (OFL tapes, Operation Endgame, etc.) may have been set with "Release = Terminal" assumption (old doctrine).

**Two options (pick one):**
- **Option A (Sweep Retroactively):** Review existing Terminal Dates, update any that conflate Release with Terminal, align all with new definition
- **Option B (Grandfather):** Leave existing Terminal Dates as-is with explicit exception flag; new Convergence work uses correct definition going forward

**Why this matters:** Convergence enforcement assumes Terminal Deadline accuracy. If old dates are wrong, enforcement runs against garbage. But sweeping is out-of-scope for this phase if existing tests rely on old dates. Grandfathering is safer (no test churn), clearer (one exception, documented).

**Recommendation:** Option B (grandfather existing, document exception, use correct definition for Phase 2 onward).

---

## Step 2: Convergence Enforcement Gap — Three Scope Investigations

### Investigation 1: Feasibility Gate Integration
**Question:** Where would Convergence enforcement actually live — does the feasibility gate read Convergence Declarations at all today?

**To answer this, explore:**
1. Does feasibility gate check Convergence Declarations currently? (grep `convergence` in evaluatePlanQualityGate, feasibility.ts, etc.)
2. If not: is reading Convergence Declarations a net-new read path for the gate?
3. Where does the gate currently get Project Terminal Dates? (masterPlansById? matrix? per-cycle?)
4. Would Convergence enforcement need a new gate failure code, or can it reuse existing codes?

**Output:** Map of current feasibility gate structure + identify integration point for Convergence read.

### Investigation 2: "Enforce" Definition
**Question:** What does "enforce" mean concretely for Convergence?

**Options (explore and recommend):**

**Option A (Hard Block):**
- Scheduler cannot let one lane's date move if it's a Convergence source
- If operator tries to reschedule a Convergence source to a new date, gate blocks with "Convergence Violation" error
- Requires operator to either:
  - Reconfigure the entire Convergence Declaration (pick new shared date for all lanes)
  - Or remove this lane from Convergence

**Option B (Advisory Warning):**
- Scheduler allows the date change
- Gate flags: "This Project is a Convergence source; moving it to DATE will break convergence with LANE1, LANE2... across shared date DATE_OLD → DATE_NEW"
- Operator sees warning, can proceed anyway (learning boundary: operator's choice to accept divergence)
- Next day, when shared deadline is re-evaluated, gate can flag "Convergence Declaration no longer achievable" as advisory

**Recommendation:** Option B (advisory, consistent with learning boundary and tonight's pattern).

**Output:** Recommend enforcement semantics (hard block vs. advisory).

### Investigation 3: Real-Time vs. Pre-Commit Validation
**Question:** Minimal viable version — does Convergence enforcement need real-time checking, or is a pre-commit validation pass sufficient?

**Options (explore and recommend):**

**Option A (Real-Time):**
- Every time a Project's Terminal Date changes (user drag-and-drop in calendar, scheduler reschedule, etc.), immediately check if this Project is a Convergence source
- If yes, compare new date against all other sources in the same Convergence Declaration
- If mismatch, gate flags in real-time

**Option B (Pre-Commit Validation):**
- Only check Convergence consistency when a cycle is about to be applied or committed
- Single validation pass: "For each Convergence Declaration, check all source Projects' Terminal Dates match"
- If mismatch found, gate flags before commit

**Minimal Viable (lowest scope):** Pre-commit validation only. Real-time checking can be Phase 2.

**Output:** Recommend validation timing (real-time or pre-commit).

---

## Step 3: Drift Detection Generalization — One Investigation

**Question:** Can Convergence enforcement be built as part of a general cross-reference integrity checker?

**Current drift problems (all examples of cross-reference inconsistency):**
1. **Convergence date drift:** Convergence Declaration says "all lanes meet DATE" but Project Terminal Dates don't match
2. **Deliverable↔Artifact parent links:** Artifact names a parent Deliverable that no longer exists (naming drift, parent deletion)
3. **Naming consistency (Desiree-style):** Project name changes, but Convergence Declaration still references old name (or vice versa)

**To answer this, explore:**
1. Do Deliverable↔Artifact references use IDs (safe) or names (drift-prone)?
2. Is Convergence→Project reference by ID or name?
3. Current pattern: Are there any cross-reference validation passes already? (e.g., when Artifact is declared, does anything check if parent Deliverable exists?)
4. What's the pattern in other parts of codebase for "cross-tab integrity"?

**Goal:** Design single validation mechanism that covers all three, not three separate checkers.

**Reference pattern:** "Two mechanisms cover everything" — Venture Strategy Doctrine research showed convergence problems cluster into just two validation flavors: temporal (dates) and referential (links). Drift detection should follow that same economy.

**Output:** Recommend whether to build (1) Convergence-specific + Deliverable↔Artifact-specific checkers, or (2) one generalized cross-reference integrity checker covering all three.

---

## Learning Boundary Guardrail (Applies Throughout)

**All work in Steps 2–3 stays ADVISORY.** No auto-fixes, no silent rewrites.

Examples of WRONG (auto-correction):
- Gate detects Convergence date mismatch → automatically rewrites all project dates to match
- Gate detects orphaned Artifact reference → automatically removes the Artifact
- Gate detects naming drift → automatically updates the Convergence Declaration

Examples of RIGHT (advisory, operator accepts):
- Gate flags: "Convergence Declaration for DATE expects all lanes to complete by DATE, but Project X has Terminal Date DIFFERENT_DATE"
- Operator sees the flag, decides: keep Project date + update Convergence, or update Project date to match Convergence, or remove from Convergence
- All rewrites are operator-initiated, not auto

**Consistent with:** Pricing Phase 1, Sequencing Risk Phase 2 pattern (recommendation-only, operator accepts).

---

## Evidence Standard (Same as Tonight)

When implementation follows (Phase 3 after investigations complete):
- ✅ Named test files, isolation-verified
- ✅ Cross-checked against baseline doc (current: 37 = 36 baseline + 5 known-flaky)
- ✅ No "within range" language
- ✅ Real diffs for all files
- ✅ No silent auto-corrections

---

## Execution Order

1. **Terminal Deadline Definition (Decision)**
   - Pick Option A or B for grandfathering
   - Document in code/doctrine which definition applies where
   - Blocks nothing; unblocks everything else

2. **Three Investigations (In Any Order, Can Parallelize)**
   - Investigation 1: Feasibility gate integration point
   - Investigation 2: Recommend "enforce" semantics (hard block vs. advisory)
   - Investigation 3: Recommend validation timing (real-time vs. pre-commit)

3. **One Investigation (Depends on #2-3 conclusions)**
   - Drift detection generalization: should enforcement be Convergence-specific or one general checker?

4. **Implementation** (After all investigations + decision complete)
   - Follows proven Pricing v1 method
   - Same evidence standard, same advisory-only guardrail

---

## Key Invariants (Do Not Violate)

🔒 Terminal Deadline = end of post-release work (not Release Date)  
🔒 All enforcement stays ADVISORY (flags, never silently fixes)  
🔒 Operator explicitly accepts any date/reference changes  
🔒 Convergence Declaration is source-of-truth for shared deadline intent  
🔒 No auto-authored edges or date rewrites  
🔒 Cross-reference integrity is checked, not assumed  
🔒 Evidence standard: named tests, isolation-verified, baseline cross-checked  

---

**Next:** Complete all four decision points + three investigations, then implementation is straightforward and unblocked.
