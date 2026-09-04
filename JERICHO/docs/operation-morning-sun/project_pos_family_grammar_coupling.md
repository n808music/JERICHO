---
name: POS Stage Map → Family Grammar Coupling Rule
description: Wave 2 QUALIFYING_EXTERNAL_STAGES for SalesPipeline and Fundraising are authoritative constraints on Phase A deliverable and block grammar — mismatches require cross-layer corrections, not local overrides
type: project
---

QUALIFYING_EXTERNAL_STAGES in `probabilityScore.ts` (Wave 2) committed a binding partial domain model for SalesPipeline and Fundraising. These are no longer P.O.S. internals — they are family grammar.

**SalesPipeline stages:** `qualified_response`, `discovery_call_booked`, `proposal_requested`, `deal_advanced`
**Fundraising stages:** `investor_reply`, `meeting_booked`, `diligence_request`, `commitment_received`

**Why:** These are the first explicit statements of what counts as meaningful external advancement for those families. If Phase A deliverable grammar, block grammar, or closure proofs use different stage semantics, the system will have a split ontology — the plan says one thing, P.O.S. says another.

**How to apply:**
- First validation question for Phase A SalesPipeline/Fundraising work: do current family deliverables and measurable blocks line up with these committed stage definitions?
- Any discovered mismatch is a **required cross-layer correction** affecting: family grammar, acceptance plan, P.O.S. Wave 2 map, and trust-gating proofs. Not a local family override.
- Phase A cannot independently invent stage names, block milestones, or evidence thresholds for these families without checking against the Wave 2 map.
- If the stage definitions are found to be wrong: update all four layers as a controlled change.
