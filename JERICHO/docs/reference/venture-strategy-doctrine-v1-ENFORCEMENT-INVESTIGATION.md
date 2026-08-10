# Venture Strategy Doctrine v1 — Enforcement Investigation Report

**Date:** 2026-08-09  
**Investigator:** Claude Code (System Audit)  
**Scope:** Codebase integration points for doctrine recommendations

---

## Summary

Of the nine doctrine blocks (+ Legal Formation), **none are enforced today as system gates**. All are either human-judgment-by-design OR simply unbuilt infrastructure.

**Wireable Candidates (require new intake questions):**
- Revenue Streams (Pricing) — Sequencing Risk Classification (Shape A) — requires 3 intake questions
- Legal/Regulatory Formation — (Shape B) — requires gating logic only (data structure exists)

**Human-Judgment-Only (by design):**
- Customer Segments, Value Proposition, Channels, Customer Relationships, Key Resources, Key Activities, Key Partnerships, Revenue Streams (Funding Timing)

**Key Finding:** Doctrine recommendations exist as guidance but have no enforcement layer in C4 (Adjacent Claim Typing) or intake contract. Wiring them would require:
1. New intake questions for strategic decisions
2. Gate logic to enforce legal formation requirement
3. Optional advisory layer (operator can override any gate)

---

## Per-Block Investigation

### 1. Customer Segments (Shape B) — Niche vs. Broad

**Current Intake Capture:** None. No questions about target audience definition or niche strategy.

**Matrix Fields:** None exist for customer segment definition.

**Doctrine Requirement:** Capture whether this is a niche-first or broad-first strategy.

**Enforcement Status:** ⚠️ **Simply unbuilt**
- No intake questions exist
- No matrix fields exist
- Could be wired as: multi-choice question (niche-first vs broad-first vs unknown)
- Would require: 1 new intake question

**Recommendation for Next Phase:** If customer-segment doctrine enforcement is desired, add a strategic-decision probe to goal/Initiative intake.

---

### 2. Value Proposition (Contested) — Clear Position Required

**Current Intake Capture:** None. No structured capture of "what makes this different?"

**Matrix Fields:** `purpose` field on Initiative captures "what does it do?" but not positioning or differentiation basis.

**Doctrine Requirement:** Capture stated basis of advantage (differentiation, cost leadership, hybrid, or unknown).

**Enforcement Status:** ⚠️ **Human-judgment-by-design**
- Operator must state their position; system doesn't infer it
- `purpose` field could be co-opted, but it's already committed to "what does it do?"
- Would require: 1 new field + 1 new intake question

**Recommendation for Next Phase:** Treat as inherently non-automatable — operator's responsibility to avoid stuck-in-the-middle. Add optional advisory prompt during Initiative intake.

---

### 3. Channels (Shape C) — Hybrid Default

**Current Intake Capture:** None. No questions about channel strategy.

**Matrix Fields:** None exist.

**Doctrine Requirement:** Capture channel model (direct, partner, hybrid) and conflict-management approach.

**Enforcement Status:** ⚠️ **Simply unbuilt**
- No intake questions or fields
- Would require: 2 new intake questions (channel choice + conflict management)

**Recommendation for Next Phase:** Defer; lower priority than Pricing or Legal Formation.

---

### 4. Customer Relationships (Shape C) — Segmented, Not Venture-Level

**Current Intake Capture:** None. No per-segment customer relationship definition.

**Matrix Fields:** None exist.

**Doctrine Requirement:** Define per-customer-segment relationship strategy (high-touch vs. low-touch).

**Enforcement Status:** ⚠️ **Human-judgment-by-design + Simply unbuilt**
- Requires per-customer-segment analysis (not a venture-level single choice)
- No intake infrastructure exists for customer-segment definition
- Depends on Customer Segments being defined first (prerequisite)

**Recommendation for Next Phase:** Defer; requires Customer Segments infrastructure first.

---

### 5. Revenue Streams (Pricing Strategy) — Shape A via Sequencing Risk Classification

**Current Intake Capture:** None. No questions about pricing strategy or sequencing risk.

**Matrix Fields:** Initiative fields exist: `purpose`, `purposeFor`, `purposeCompletion`, but not pricing or risk classification.

**Doctrine Requirement:** Classify Differentiation Risk vs. Validation Risk, then recommend pricing strategy accordingly.

**Three-Question Sequencing Risk Classification:**
1. Category Precedent: Has this category seen proven, non-commoditized winners?
2. Audience Precedent: Do target customers have prior successful relationships with similar offerings?
3. Competitive Density: Is the category highly competitive?

**Enforcement Status:** ✅ **Wireable with 3 new intake questions + optional advisory logic**
- Questions could be multi-choice probes in Project/Initiative intake
- Classification logic already exists (in doctrine spec)
- Would require: 3 new questions + optional advisory display
- Optional gate (advisory only, not blocking)

**Recommendation for Next Phase:** HIGH PRIORITY — wireable today if intake questions are added to Project slot. Consider:
- When to ask (at Initiative creation or later in Project creation?)
- Who answers (founder, or strategy stakeholder?)
- Whether advisory should block Project activation (probably not — operator may have good reasons to override)

---

### 6. Revenue Streams (Funding Timing) — Shape B

**Current Intake Capture:** None. No questions about capital raising strategy or traction requirements.

**Matrix Fields:** None exist for funding timing or traction signals.

**Doctrine Requirement:** Validate traction before external capital (exceptions: founder success history or investor relationships).

**Enforcement Status:** ⚠️ **Human-judgment-by-design + Simply unbuilt**
- "Validate traction" is not automatically checkable — requires judgment on what signals count
- Founder success/investor relationships are not recorded in current matrix
- Would require: 2 new fields (founder track record, investor relationships) + judgment probe

**Recommendation for Next Phase:** Defer founder track record tracking to founder/profile level, not goal level. Current scope does not support this.

---

### 7. Key Resources (Organizational Hiring) — Shape B

**Current Intake Capture:** None. No questions about hiring triggers or founder time constraints.

**Matrix Fields:** None exist for founder time tracking or hiring triggers.

**Doctrine Requirement:** Don't hire ahead of demonstrated bottleneck (~15+ hours/week or market-validated demand).

**Enforcement Status:** ⚠️ **Partially wireable (requires execution layer integration)**
- Founder time tracking exists in execution layer (blocks assigned to founder)
- Could calculate "founder hours on task X this month" as a trigger signal
- Market-validated demand is not automatically detected
- Would require: 1 new intake question (market demand signals) + backend calculation

**Recommendation for Next Phase:** Defer; requires execution layer (block completion data) to be actionable. Could implement as post-hoc analysis, not real-time gate.

---

### 8. Key Activities (Shape A/B) — Core vs. Context (Geoffrey Moore)

**Current Intake Capture:** None. No questions about Core vs. Context classification.

**Matrix Fields:** None exist.

**Doctrine Requirement:** Classify activities as Core (differentiating, build in-house) vs. Context (outsource).

**Enforcement Status:** ⚠️ **Human-judgment-by-design**
- Core vs. Context classification is inherently strategic, not automatable
- No system can reliably classify what's "differentiating" for a specific venture
- Would require: 1 new field + optional advisory prompt

**Recommendation for Next Phase:** Treat as operator responsibility. Add optional strategic checklist during Initiative/Project planning, but do not enforce.

---

### 9. Key Partnerships (Shape D) — Evaluation Checklist

**Current Intake Capture:** None. No questions about partnership strategy or evaluation criteria.

**Matrix Fields:** No dedicated partnership entity exists (partnerships could be stored as Deliverables or Projects, but are not explicitly structured).

**Doctrine Requirement:** Evaluate partnerships against four-point checklist (operational readiness, no single-champion dependency, avoid concentration risk, written terms with exit provisions).

**Enforcement Status:** ⚠️ **Human-judgment-by-design**
- Checklist is evaluative, not automatable
- No structure to record partnership terms or exit provisions
- Would require: 1 new entity type (Partnership) + field structure

**Recommendation for Next Phase:** Defer; low priority. Treat as operator checklist, not system-enforced gate.

---

### 10. Legal/Regulatory Formation (Adjacent, Outside BMC) — Shape B

**Current Intake Capture:** Partial. `legallyFormed` boolean exists on Entity.

**Matrix Fields:** Entity has `legallyFormed` (Boolean) and `formationState` (named-only, conceptual, in-development, functioning).

**Doctrine Requirement (Strongest Convergence):** Formalize legal entity **before** any revenue, contracts, vendor activity, or public activity.

**Enforcement Status:** ✅ **Partially wireable with gating logic**
- Entity `legallyFormed` field exists and is captured at intake
- Could wire gates to:
  - Block revenue operations (DECLARE_PROJECT, DECLARE_DELIVERABLE with revenue flag) if `legallyFormed === false`
  - Block contract-signing operations (would need to track, not currently in matrix)
  - Block vendor operations (would need vendor tracking, not currently in matrix)
  - Block public operations (would need "public release" tracking, not currently in matrix)
- Current state: Entity formation is tracked, but no gates enforce it
- Would require: 3–4 new gate checks + optional advisory display

**Recommendation for Next Phase:** HIGH PRIORITY — low-hanging fruit. Add gate logic to block certain operations until Entity is marked `legallyFormed === true`. Clarify which operations trigger the gate:
- Revenue? (highest impact, most defensible)
- Contracts? (medium impact, requires contract tracking)
- Vendor? (lowest impact, requires vendor definition)
- Public? (medium impact, requires definition of "public")

---

## Infrastructure Gaps

### What's Missing (Blocking Doctrine Enforcement)

1. **Strategic Decision Capture Infrastructure** — No standardized way to ask strategic questions (Customer Segments, Channels, etc.) and store answers.

2. **Customer Segment Entity Type** — Customer Segments are mentioned in Value Proposition and Customer Relationships doctrines but have no matrix structure.

3. **Partnership Entity Type** — Key Partnerships doctrine references partnerships, but they're not explicitly tracked.

4. **Founder Profile Fields** — Funding Timing doctrine requires tracking founder track record and investor relationships; currently not in scope.

5. **Execution Layer Integration** — Key Resources doctrine references founder time tracking, but would require querying execution blocks; no real-time integration.

6. **Contract/Vendor Tracking** — Legal Formation doctrine would benefit from tracking contracts and vendors; not currently in matrix.

7. **Revenue Operation Classification** — Multiple doctrines (Legal Formation, Funding Timing, Pricing) benefit from knowing if an operation is revenue-generating; no explicit flag today.

---

## Wiring Priority (If Doctrine Enforcement is Approved)

### Phase 1 (High Impact, Low Effort) — Recommend implementing now:
1. **Legal Formation Gate** — Block certain operations until Entity is `legallyFormed === true` (3–4 gate checks)
2. **Sequencing Risk Classification Intake** — Add 3 questions to Project slot for Pricing Strategy (optional advisory display)

### Phase 2 (Medium Impact, Medium Effort):
3. **Founder Track Record Tracking** — Add to founder/profile level for Funding Timing doctrine
4. **Strategic Decision Fields** — Standardized intake for Customer Segments, Value Proposition, Channels, Key Activities

### Phase 3 (Lower Priority, High Effort):
5. **Partnership Entity Type** — Full entity type for Key Partnerships doctrine
6. **Customer Segment Entity Type** — Support per-segment relationship strategies
7. **Execution Layer Integration** — Real-time founder-hours reporting for Key Resources doctrine

---

## Recommendation to Leadership

**None of the doctrine blocks are enforced today.** This is by design for most blocks (human judgment is intentionally dominant), but represents a gap for:

1. **Legal Formation** — Currently tracked but not gated. Strong evidence supports enforcement; recommend implementing gate logic.
2. **Sequencing Risk Classification (Pricing)** — Currently no intake or storage. Wireable with 3 questions; recommend adding optional advisory display (not blocking gate).

**All other blocks** are appropriately human-judgment-by-design and require no system enforcement.

**No speculative building recommended.** If doctrine enforcement is approved, prioritize Legal Formation + Pricing Strategy only.

---

**Investigation Completion Status:** ✅ Complete. Ready for architectural decision on which blocks (if any) should move from human-judgment to system enforcement.
