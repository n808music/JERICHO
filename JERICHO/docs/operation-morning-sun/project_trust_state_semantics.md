---
name: Trust-State Semantics — Implemented
description: Authority-ceiling and gate-failure propagation added to both trust evaluators; implemented 2026-04-07 after probe pass
type: project
---

Trust-state semantics layer closes the mismatch between rich upstream truth surfaces (endpoint, authority, gate failures) and the trust layer that was blind to them.

## Status: IMPLEMENTED (2026-04-07)

Brief: `JERICHO_TRUST_STATE_SEMANTICS_BRIEF.md`

State names unchanged: `trusted | provisional | withheld`. What changed is the assignment conditions.

## Two evaluators updated

### 1. `buildGoalPolicySnapshot` — `GoalPolicy.ts`

**What changed:**
- `GoalPolicyInput` extended: `outcomeAuthorityClass` + `planQualityFailureCodes` (both nullable, backward-compatible)
- New reason code: `POS_TRUST_PROVISIONAL_AUTHORITY_CEILING`
- Gate failure codes (`OUTCOME_COVERAGE_PREP_ONLY`, `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING`, `OUTCOME_ENDPOINT_MISSING`, `OUTCOME_SPLIT_DIMENSION_UNCOVERED`) → force `withheld`
- Authority ceiling: `externally_mediated | mixed | unknown` → max `provisional` with `POS_TRUST_PROVISIONAL_AUTHORITY_CEILING` (not `PLAN_DEGRADED`)
- `fully_controllable` with clean structure and no gate failures → still reaches `trusted`

### 2. `deriveTrustState` — `probabilityScore.ts`

**What changed:**
- Accepts new `outcomeAuthorityClass` option
- Prefers canonical `terminalOutcomeAuthority` result over raw `familyClass` contract field
- `familyClass` retained as fallback for legacy contracts only
- `mixed` authority treated as externally mediated for ceiling purposes

## Key doctrinal rules now enforced

- A structurally clean externally_mediated plan cannot reach `trusted` pre-execution
- Any of the four outcome-validity gate failure codes force `withheld` (not provisional)
- `POS_TRUST_PROVISIONAL_AUTHORITY_CEILING` distinguishes ceiling from degradation — evidence can lift ceiling; evidence cannot fix plan degradation
- `familyClass` (raw archetype field) is no longer the canonical authority signal for scoring-layer trust

## Test surface

12 new tests in `GoalPolicy.test.ts`:
- fully_controllable reaches `trusted`
- externally_mediated, mixed, unknown cap at `provisional` with correct reason code
- all four gate codes force `withheld`
- non-withholding codes don't interfere
- gate failure takes precedence over authority ceiling

Full suite: 1711/1711, 341 files, zero regressions.

**Why:** Trust was the last layer that could claim more about terminal attainability than authority and evidence allow. An externally_mediated goal with a clean plan was reaching `trusted` while the gate simultaneously knew the plan never contacted the external decision-maker.

**How to apply:** When passing inputs to `buildGoalPolicySnapshot`, populate `outcomeAuthorityClass` from `intakeContract.terminalOutcomeAuthority.authority` and `planQualityFailureCodes` from the gate result. Both are optional — callers that omit them preserve prior behavior.
