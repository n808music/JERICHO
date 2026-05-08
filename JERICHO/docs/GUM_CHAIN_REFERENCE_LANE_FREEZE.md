# GUM_CHAIN_REFERENCE_LANE_FREEZE

**Frozen:** 2026-04-30
**Branch:** proof-1.0.6
**Status:** LOCKED — do not reopen except under conditions in §6

---

## 1. Ordered Chain Now Verified

The caffeinated gum goal ("Build a caffeinated gum brand and take it to first real sales within 15 months...") has passed the complete ordered chain end-to-end. Each layer was verified independently and then chained in `gumChain.e2e.test.ts`.

**Layer 1 — Plan quality standardization**
`planQualityAudit` and `evaluatePlanQualityGate` accept the gum plan when structural quality is present (actionType coverage, lineage integrity, dependency readiness). BrandLaunch / non-podcast goals produce `endpointClarity = missing` and `planQuality.state = policy_degraded` by construction — this is the honest result, not a defect.

**Layer 2 — Feasibility qualification**
`deriveFeasibilitySubstrateLevel` produces `trusted_feasibility` when plan is valid and fully scheduled, `withheld` when violations are present. `GoalPolicy.buildGoalPolicySnapshot` maps substrate through `feasibilityFull.substrateLevel`. Feasibility state is independent of Live P.O.S.

**Layer 3 — Day-to-day execution evidence**
`COMPLETE_BLOCK`, `MISS_BLOCK`, and `SKIP_BLOCK` via `identityReducer` write canonical execution events with goalId, cycleId, blockId, actionId, dateISO, and status. Events survive rederivation. Schedule blocks are not mutated by execution events.

**Layer 4 — Course correction signal**
`evaluateExecutionCorrection` reads canonical execution events and action dependency metadata. Produces `correctionState` ∈ {insufficient\_evidence, on\_track, watch, adjustment\_recommended, recovery\_required}. Wired as `state.executionCorrectionByGoal[goalId]` via `applyExecutionCorrection` in `identityCompute.js`, which runs before `applyGoalPolicy` so correction state is available when the policy snapshot is built. Does not mutate schedule, feasibility, or Live P.O.S.

**Layer 5 — Live P.O.S. canonical surfacing**
`evaluateLivePosInputs` in `GoalPolicy.ts` reads canonical execution events directly. `buildGoalPolicySnapshot` applies post-processing: gate failures override livePos to withheld; correction state injects reason codes. `executionCorrectionByGoal` and `goalPolicyByGoalId.livePos` are independent fields — correction does not write into livePos directly.

---

## 2. Test Suites and Counts

All tests passing on branch `proof-1.0.6` as of 2026-04-30.

| Suite | Layer(s) | Tests |
|---|---|---|
| `tests/state/gumChain.e2e.test.ts` | 1–5 (chain) | 21 |
| `tests/state/livePOS.gumSchedule.test.ts` | 5 | 15 |
| `tests/state/executionCorrection.gumSchedule.test.ts` | 4 | 16 |
| `tests/state/todayExecution.gumSchedule.test.ts` | 3 | 19 |
| `src/domain/goal/GoalPolicy.test.ts` | 2, 5 | 59 |
| **Total** | | **130 / 130** |

---

## 3. Key Invariants Locked

These invariants are regression-tested. Any change that causes any of them to fail requires explicit review before merge.

**I-1: No execution evidence → livePos withheld**
`livePos.state = 'withheld'` with `LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE` when `canonicalExecutionEvents` is empty and no structural gate has fired. No fake score is produced.

**I-2: policy\_degraded alone does NOT gate livePos**
`planQuality.state = 'policy_degraded'` (e.g. from `endpointClarity = missing` on non-podcast goal) does not inject `LIVE_POS_WITHHELD_CANONICAL_TRUTH_THIN`. livePos is withheld only by the gate code path or by lack of evidence — never by plan degradation alone.

**I-3: Structural policy\_blocked / INFEASIBLE does NOT erase execution evidence**
`planProof.feasibilityStatus = 'INFEASIBLE'` causes `planQuality.state = 'policy_blocked'` but does not set `livePosGateWithheld = true`. The gate condition is `hasGateWithholdingFailure && livePosRaw.state === 'eligible'` — structural blocked without gate codes must not override eligible livePos.

**I-4: Explicit TRUST\_WITHHOLDING\_GATE\_CODES still gate livePos**
When `planQualityFailureCodes` contains any of `OUTCOME_COVERAGE_PREP_ONLY`, `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING`, `OUTCOME_ENDPOINT_MISSING`, `OUTCOME_SPLIT_DIMENSION_UNCOVERED`, livePos is overridden to `withheld` with `LIVE_POS_WITHHELD_CANONICAL_TRUTH_THIN` regardless of execution evidence.

**I-5: Execution evidence writes canonical identity**
Canonical execution events carry `goalId`, `cycleId`, `blockId`, `actionId`, `dateISO`, `status`, and `kind`. Events survive a subsequent `computeDerivedState` pass. Identity is immutable once written.

**I-6: Course correction reads canonical evidence and does not mutate schedule**
`evaluateExecutionCorrection` is a pure read. After `MISS_BLOCK`, `executionCorrectionByGoal[goalId].correctionState` is populated but schedule blocks remain at their prior status. `feasibility.state` is not mutated to `live_pos` or any livePos value.

**I-7: unknown outcomeAuthorityClass creates provisional authority ceiling**
`outcomeAuthorityClass = 'unknown'` (and `externally_mediated`, `market_dependent`, `mixed`) cap `posTrust.state` to `'provisional'` with reason code `POS_TRUST_PROVISIONAL_AUTHORITY_CEILING` when `planQuality.state = 'policy_clean'`. This ceiling is tested for all four capped classes.

**I-8: Feasibility substrate remains separate from Live P.O.S.**
`feasibility.substrateLevel` is computed from plan quality gate status, not from livePos state. `livePos` is computed from execution evidence, not from feasibility substrate. The two fields are independent.

---

## 4. Current Gum-Specific Limitations

These are documented Phase 1 boundaries, not bugs. They are tested and their behavior is specified.

**L-1: authority = 'unknown' for "first real sales" text**
`deriveTerminalOutcomeAuthority` returns `authority = 'unknown'` for the gum goal text because "first real sales" contains no numeric threshold metric (`\d+ listeners/subscribers/customers`), no revenue/MRR pattern, and no named external actor. This is documented as RC-22 in the authority audit records. Phase 1 runs on combined text and does not attempt to separate outcome framing from evidence language.

**L-2: unknown authority is intentionally capped**
`authority = 'unknown'` is included in the provisional ceiling check alongside `externally_mediated`, `market_dependent`, and `mixed`. A goal whose authority cannot be characterized cannot receive trusted P.O.S. This is the correct and intended behavior.

**L-3: BrandLaunch produces endpointClarity = missing**
Non-podcast goals always have `completionBoundaryStatus = 'missing'` because the text-based boundary detector only runs for the podcast domain. This produces `planQuality.state = 'policy_degraded'`. The gum goal will remain policy\_degraded until either (a) a non-podcast boundary resolver is added, or (b) the goal is answered with an explicit completion boundary via `answeredContext`. This is expected.

**L-4: policy\_degraded does not prevent planning or execution**
`readiness.isReadyForPlanning = true` for the gum goal (it is `assumption_marked_draft`, not `intake_blocked`). Plan quality degradation signals a missing structural property; it does not block the goal from being scheduled or executed.

---

## 5. Migration Rule for CreativeProduction Lane

The CreativeProduction / EP release lane must be brought through the same ordered chain before any P.O.S. surface work begins.

**Required order:**

1. **Plan quality** — `evaluatePlanQualityGate` must pass for a representative CreativeProduction plan (e.g. podcast episodes). Verify no regressions against `GoalPolicy.test.ts`.
2. **Feasibility qualification** — `deriveFeasibilitySubstrateLevel` wired through `GoalPolicy`. Substrate not orphaned from the policy snapshot.
3. **Day-to-day execution** — `COMPLETE_BLOCK` / `MISS_BLOCK` / `SKIP_BLOCK` write canonical execution events for CreativeProduction blocks with correct goalId, cycleId, blockId, actionId, dateISO.
4. **Course correction** — `evaluateExecutionCorrection` reads CreativeProduction evidence. `correctionState` produced. Schedule not mutated. Regression: `executionCorrectionByGoal` populated, `goalPolicyByGoalId.livePos` unchanged by correction alone.
5. **Live P.O.S.** — livePos withheld without evidence, eligible with evidence. Authority ceiling fires for CreativeProduction execution type if outcome authority class warrants it. No fake score on withheld state.

**No jumping directly to P.O.S.** Layers 1–4 must be verified before Layer 5 assertions are written.

**Reference test pattern:** `gumChain.e2e.test.ts` is the canonical template. CreativeProduction should produce a `creativeProdChain.e2e.test.ts` that mirrors this structure with episode-specific fixtures.

---

## 6. Do-Not-Reopen Conditions

The gum reference lane is frozen. Do not reopen unless one of the following conditions is triggered:

| Condition | Signal |
|---|---|
| Canonical execution identity breaks | `goalId`, `cycleId`, `blockId`, `actionId`, or `dateISO` missing or incorrect on a completion or miss event |
| livePos gated by generic policy\_degraded | `LIVE_POS_WITHHELD_CANONICAL_TRUTH_THIN` appears without a gate failure code present |
| INFEASIBLE erases execution evidence | livePos.state becomes withheld when only `planProof.feasibilityStatus = 'INFEASIBLE'` is set and no gate codes are present |
| substrateLevel orphaned from GoalPolicy | `feasibility.substrateLevel` is not derived from plan quality gate status, or is computed outside `buildGoalPolicySnapshot` |
| Course correction mutates schedule | Any block status changes as a side effect of `applyExecutionCorrection` or `evaluateExecutionCorrection` |
| Authority ceiling bypassed | `posTrust.state = 'trusted'` for a goal with `outcomeAuthorityClass` ∈ {unknown, externally\_mediated, market\_dependent, mixed} on a policy\_clean plan |
| gumChain.e2e.test.ts regression | Any of the 21 chain tests fail on a non-gum-lane code change |
