# Venture Strategy Doctrine v1 (Draft)

**Date:** 2026-08-09  
**Status:** Ready for Enforcement Investigation  
**Provenance:** Derived from systematic research against the Business Model Canvas (Osterwalder & Pigneur) — nine building blocks across four areas (Customers, Offer, Infrastructure, Financial Viability), plus Legal/Regulatory Formation as adjacent.

---

## Methodology (Reusable for Future Candidate Gaps)

1. **Name the fork precisely** — a specific, real decision, not a vague topic.
2. **Search for convergent evidence** — multiple independent sources.
3. **Classify the evidence shape:**
   - **Shape A** — Classified Fork: two legitimate strategies, evidence splits by a real venture characteristic. Resolve via classification, not a default.
   - **Shape B** — Convergent Default + Exception: one generally-correct answer with a specific, checkable override condition.
   - **Shape C** — False Binary / Hybrid: the fork as originally framed doesn't survive evidence; the real answer is a segmentation or hybrid rule.
   - **Shape D** — Checklist, not Timing: no real convergence on when; evidence converges on how to evaluate well, regardless of timing.
4. **Write only as precisely as evidence supports.** Narrow rather than force resolution when contested.
5. **Wire into C4 (Adjacent Claim Typing)** — every output is a recommendation the operator authors into a real edge, never an automatic system decision.

---

## Core Classifier: Sequencing Risk Classification

**Definition:** Ventures face two distinct risk categories that recommend opposite pricing strategies:
- **Differentiation Risk** — feature/capability completeness, market positioning, brand credibility. Solved by premium pricing (skimming strategy).
- **Validation Risk** — demand proof, customer willingness-to-pay, product-market fit. Solved by penetration pricing (low-price strategy).

**Three-Question Procedure:**
1. Category Precedent: Has this category seen proven, non-commoditized winners?
2. Audience Precedent: Do target customers have prior successful relationships with similar offerings?
3. Competitive Density: Is the category highly competitive (many entrants)?

**Status:** Reused across multiple blocks (Revenue Streams/Pricing). Confirmed transferable to Pricing; disconfirmed for Customer Segments — same classification, opposite-pointing implications. Do not assume transfer; verify per block.

---

## Block-by-Block Findings

### Customer Segments — Shape B

**Doctrine:** Target a narrow, specific niche first (cheaper validation, defensible relationships, avoids resourced incumbents).

**Exception:** Genuinely universal/proven demand + resources to support broad reach.

**Enforcement Status:** ⚠️ Human-judgment-by-design (not checkable against matrix data today).

---

### Value Proposition — Contested, Narrow Claim Only

**Doctrine:** Require a clear, stated primary basis of advantage. Avoid "stuck in the middle" with no position.

**Explicit Non-Claim:** Do NOT encode a directional default toward differentiation or cost leadership. The literature disagrees with itself:
- Porter's original neutrality (no inherent winner)
- Peters & Waterman's differentiation-favoring critique
- More recent hybrid-favoring research

**Enforcement Status:** ⚠️ Human-judgment-by-design (operator authors the position, not inferred).

---

### Channels — Shape C

**Doctrine:** Default to hybrid (direct + partner). Actively manage channel conflict rather than avoiding hybrid.

**Enforcement Status:** ⚠️ Human-judgment-by-design (not a system-checkable rule).

---

### Customer Relationships — Shape C

**Doctrine:** Not a venture-level choice. Segment by customer value/complexity:
- High-touch for high-value/complex customers
- Low-touch/automated by default for others

**Enforcement Status:** ⚠️ Human-judgment-by-design (requires per-segment analysis).

---

### Revenue Streams (Pricing Strategy) — Shape A, via Sequencing Risk Classification

**Doctrine:** Use the three-question Sequencing Risk Classification procedure to determine:
- **Differentiation Risk dominates** → premium/skimming supported
- **Validation Risk dominates** → penetration/low-price supported, unless capital is scarce or premium positioning is core to brand identity

**Enforcement Status:** ✅ Partially wireable today (requires Sequencing Risk Classification stored on goal/Initiative edge); ⚠️ Requires new intake questions for classification inputs.

---

### Revenue Streams (Funding Timing) — Shape B

**Doctrine:** Default: Validate traction before seeking external capital.

**Traction Signals:** Revenue, engagement, retention, waitlist, or partnership signals.

**Exception:** Prior verifiable founder success OR existing strong investor relationship/network.

**Enforcement Status:** ⚠️ Human-judgment-by-design (traction validation is not automatically checkable).

---

### Key Resources (Organizational Hiring) — Shape B

**Doctrine:** Don't hire ahead of a demonstrated bottleneck.

**Trigger Condition:** ~15+ hours/week of founder time on a task outside core competency, OR explicit market-validated demand for capacity.

**Exclusion:** Production/crew sourcing for bounded Deliverables — that's solved by C4 (is crew part of Deliverable's definition of done), not a strategic hiring question.

**Enforcement Status:** ⚠️ Partially wireable (if founder time tracking exists in execution layer); ⚠️ Requires new intake questions for market-validated demand signals.

---

### Key Activities — Shape A/B, via Core/Context (Geoffrey Moore Framework)

**Doctrine:** 
- **Build Core (differentiating) activities in-house** — eventually, not necessarily immediately.
- **Outsource Context (non-differentiating) always.**
- **Never build in-house in reaction to a single demand spike** — require a proven, recurring pattern first.

**Enforcement Status:** ⚠️ Human-judgment-by-design (Core vs. Context classification is strategic, not system-checkable).

---

### Key Partnerships — Shape D (Checklist, Not Timing)

**Doctrine:** No reliable timing rule found. Evidence converges on an evaluation checklist instead:

1. **Internal operational readiness** — can you deliver on the partnership's requirements?
2. **No single-champion dependency** — avoid relying on one person at partner org.
3. **Avoid concentration risk** — prevent over-customization/exclusivity from locking you in.
4. **Written terms with exit provisions** — contractual clarity and off-ramps.

**Enforcement Status:** ⚠️ Human-judgment-by-design (checklist requires per-partnership analysis, no timing automation).

---

### Legal/Regulatory Formation (Outside the BMC, Adjacent Category) — Shape B

**Doctrine (Strongest Convergence of Any Block):** Formalize legal entity status **before any of:**
- Revenue-generating activity
- Contract signing
- Vendor-facing activity
- Public-facing activity

NOT after. No credible opposing evidence found; only counter-consideration was administrative convenience, not strategic advantage.

**Enforcement Status:** ✅ Checkable today (is legal entity status recorded on founder profile or goal entity?). ⚠️ Requires gate logic wiring to block revenue/contract actions until entity is formalized.

---

## Explicit Gaps (Named, Not Hidden)

1. **Cost Structure** — Never independently researched; partially covered via Funding Timing. Flagged as a real gap, not silently assumed closed.

2. **Key Partnerships Transferability** — Resolved to a checklist, not a decision doctrine — genuinely weaker evidence than the other eight blocks.

3. **Sequencing Risk Classification Transferability** — Confirmed for Pricing; disconfirmed for Customer Segments; untested for the rest. Do not assume it applies elsewhere without verification.

4. **Taxonomy Completeness** — This structure (BMC + Legal) may not be exhaustive of every real venture decision. It's the best bounded, authoritative structure found, not a claim of completeness beyond what it names.

---

## Enforcement Investigation Required

**Directive:** Investigate what in the codebase actually consumes/uses these recommendations.

For each block:
- **Enforced today** — system actively checks or gates on this doctrine
- **Human-judgment-by-design** — operator authors the recommendation, system does not enforce
- **Simply unbuilt** — infrastructure doesn't exist yet, but is technically feasible

Per-block report required. Do not collapse into one aggregate status.

See: `ENFORCEMENT-INVESTIGATION.md` (to be completed after codebase scan).

---

**Commitment Status:** Ready for investigation phase. No speculative building; investigation and report only, unless something is trivially already wireable.
