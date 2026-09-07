---
name: project_disclosure_standard
description: "Doctrine — every gate-generated question/flag must disclose its rule, its plain-words violation, and a compliant example"
metadata: 
  node_type: memory
  type: project
  originSessionId: feac5dd7-2e86-45df-bfa8-d2e3870ea6e5
---

Named 2026-07-17. **The question-layer sibling of the Attestation Contract:** the Attestation Contract governs what the *operator* attests to the system; the Disclosure Standard governs what the *system* must disclose whenever it asks the operator for anything. It is clarity enforcement at the question boundary.

**Every gate-generated question or flag must carry three parts:**
1. **The rule, cited** — which R-rule / A-predicate / gate condition fired (e.g. R4, A7), so the flag is auditable against the Block Standard, not free-floating.
2. **The violation, in plain words** — what the system observed, *naming any internal object it references*. If telemetry exists, the question says what it is and what it showed — no invisible referents.
3. **The compliant shape, shown** — a concrete example of what a passing answer/block looks like, not just "fix it."

Mnemonic: **no question without its rule, no rule without its example, no referent without its introduction.**

**Reference example (already compliant):** the Master Grid RESIDUAL-PHASE questions — each names the node ("Alternative Smoke Pens"), states the observed fact ("has no attested phase, raw: absent"), and gives exact resolution paths ("assign phase 1, 2, or 3, or confirm residual"). Use as the template.

**Its own initiative, NOT a Gate 6 line item** (operator ruling — folding it into Gate 6 would be scope-creep-by-doctrine). Sits on the remediation ledger alongside [[project_phase_elicitation_gap]]. **Audit target:** apply across all gate outputs — elicitation probes (the referent-binding defect class from Gaps 1–4 is the same one), generator block titles, and gate-generated flags generally. Belongs near the intake remediation, since opaque probes are felt there first.

The two `fullHorizonScheduleExpansion.js` "Revise … requirements from P1/P2 telemetry review and user-feedback summary" titles were referent-bound during Gate 6 closeout as the first concrete application (they were inside Gate 6's blast radius). Related: [[project_matrix_intake_wiring]].
