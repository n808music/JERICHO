---
name: goal-admission-gate
description: "Goal admission gate doctrine change — two-check presence doctrine (objective + deadline), multiplicity-blind, duplicate detection retained"
metadata: 
  node_type: memory
  type: project
  originSessionId: a37a1361-29d8-4f24-944f-5a166012f14f
---

Admission gate in `identityStore.js` (`attemptGoalAdmissionPure`) replaced `detectCompoundGoal` + `validateGoalAdmission` with a two-check presence doctrine. Implemented 2026-07-03.

**New gate doctrine:**
1. **Duplicate check** — reject if active cycle already holds identical `inscription.contractHash` OR identical `terminalOutcome.text`. Code: `activeCyclesForDupe` + `isDuplicate` block.
2. **Objective presence** — reject if `rawObjectiveText.length < 5` → `NO_DISCERNIBLE_OBJECTIVE`
3. **Deadline presence** — reject if `deadlineDayKeyForGate` is null → `INTAKE_DEADLINE_MISSING`
4. Then fall through to `buildGoalIntakeContract` (existing downstream check)

**Why:** `detectCompoundGoal` fired on "both...and" description clauses (not multiple goals). `validateGoalAdmission` required `planGenerationMechanismClass`, `commitmentDisclosureAccepted`, `inscription.contractHash`, `isConcrete`, `verificationCriteria` — all missing from MatrixIntake's minimal contract.

**Gate is blind to:** scope, multiplicity, mechanism class, inscription, causalChain, workWindows, reinforcement. Those are elicitation engine concerns.

**Files changed:**
- `src/state/identityStore.js` — removed imports `validateGoalAdmission`, `detectCompoundGoal`; replaced both blocks with duplicate+objective+deadline checks
- `src/state/__tests__/deterministic.store.integration.test.js` — 3 mechanism-class tests updated to expect ADMITTED (mechanism class no longer gates)

**How to apply:** If adding new admission checks, add them in this gate block. Never reintroduce mechanism class, inscription, or form-completeness checks at the gate — those belong downstream in `buildGoalIntakeContract` or the elicitation engine.
