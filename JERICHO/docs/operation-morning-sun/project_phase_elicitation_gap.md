---
name: project_phase_elicitation_gap
description: "Pre-intake prerequisite — phase is never elicited, so the real intake run produces an all-residual grid"
metadata: 
  node_type: memory
  type: project
  originSessionId: feac5dd7-2e86-45df-bfa8-d2e3870ea6e5
---

Confirmed 2026-07-16 by inspecting the live backend store (`profile-james-endgame`, block count 3): every project AND every initiative carries `phase: null`, only 1 dependency edge. The intake pipeline **never elicits phase**. Consequence: on the real intake run the hardened Master Grid renders exactly the live screenshot — **0·0·0, eighteen RESIDUAL-PHASE questions** — which is the grid being *honest*, not broken.

**Named pre-intake prerequisite (operator ruling, 2026-07-16):** "phase elicitation exists and commits to the matrix" — sits alongside the matrix-inspector gate / name-persistence / taxonomy-workbook prerequisites. Operator read: folds into the existing intake remediation (not its own initiative) — it's a missing probe slot in the deterministic elicitation engine, and the ten-section Structure survey is where phase attestation naturally lives. Must land on the prerequisite list BEFORE the real run, else it's discovered as 18 questions mid-run.

Separate from Gate 5's render correctness (the grid is correct). See [[project_per_profile_matrix_storage]] for the storage trace + backend-DB access path. Related: [[project_matrix_intake_wiring]].
