---
name: Terminal Endpoint Recognition — Frozen v1
description: Canonical detector for "what event counts as this goal being finished" — Phases B and C complete, frozen 2026-04-06, enforcement (Phase D) not yet started
type: project
---

Terminal Endpoint Recognition is the upstream doctrine layer beneath Outcome Validity. It answers: what exact event counts as this goal being finished? Authority classification and corridor enforcement reason about the target this layer identifies.

## Current status: FROZEN v1 (Phases B + C complete, 2026-04-06)

Phase B (detection only) is complete as of 2026-04-06.

**Canonical files:**
- `src/domain/goal/terminalEndpointDetector.ts` — `detectTerminalEndpoint(goalText, verificationText): TerminalEndpointResult`
- `GoalIntakeContract.terminalEndpoint: TerminalEndpointResult` — single call after `terminalOutcomeAuthority` in `buildGoalIntakeContract`

**Zero gate enforcement. Zero trust changes. Detection only.**

## Status taxonomy

```typescript
type TerminalEndpointStatus =
  | 'clear_explicit'  // terminal object directly stated
  | 'clear_inferred'  // inferred from framing verb + lane context
  | 'ambiguous'       // multiple plausible endpoints, cannot resolve
  | 'missing'         // no reliable endpoint detectable
  | 'split';          // multiple distinct terminal outcomes (LT-02 pattern)
```

`split` is not a weaker form of `ambiguous`. It means two clearly identified endpoints with different authority classes (e.g. LT-02: artifact_complete + offer_received).

## Audit pack probe matrix (observational, Phase B)

| Goal | Expected status | Expected primaryEndpoint |
|------|----------------|-------------------------|
| ST-01 (landing page) | clear_explicit | artifact_complete |
| ST-02 (fitness) | clear_explicit / missing (phrasing-dependent) | artifact_complete or unknown |
| ST-03 (brand launch) | split | artifact_complete + audience_threshold |
| LT-01 (podcast) | split | published_live + audience_threshold |
| LT-02 (fullstack + job) | split | artifact_complete + offer_received |
| LT-03 (job search) | clear_explicit | offer_received |
| LT-04 (fundraising) | clear_explicit | capital_secured |

LT-03 and LT-04 probe tests assert these values from the contract field.

## Binding invariant

Endpoint recognition is anchored on terminal objects and events, not generic completion verbs. Every pattern has a named load-bearing terminal object. If the object is removed and the pattern still fires, it is over-broad.

## Key doctrinal distinction from completionBoundary

`completionBoundary` is podcast-domain only (existing mechanism, unchanged). `terminalEndpoint` is the cross-domain generalization. They coexist independently on `GoalIntakeContract` and are not merged.

## Key correction during implementation

"full-time role" / "full-time position" are job-type labels, not terminal events → `clear_inferred` (offer implied), not `clear_explicit`. Terminal event is the hiring decision, not the job category description.

## Pattern fixes discovered under test (important for future additions)

- Hyphenated words ("full-stack") require `[\w-]+` not `\w+` in intervening-word slots
- Plurals ("offers", "episodes", "sign-ups") require `s?` / `sign.?ups?` — `\b` blocks plurals after singular nouns
- "sign-ups" requires `sign.?ups?` pattern — not captured by "subscribers" alone
- Split compound check must cover `artifactEndpointPresent + marketEndpointPresent` explicitly (not just `releaseEndpointPresent`)

## Phase D — enforcement: COMPLETE (2026-04-07)

Brief: `JERICHO_PHASE_D_ENDPOINT_GATE_CONSEQUENCE_BRIEF.md`
Detector: `src/domain/planQuality/splitEndpointCoverageDetector.ts`

Two new failure codes wired into `evaluatePlanQualityGate.ts`:
- `OUTCOME_ENDPOINT_MISSING`: externally_mediated/mixed goal with `missing` or `ambiguous` endpoint
- `OUTCOME_SPLIT_DIMENSION_UNCOVERED`: split goal whose secondary endpoint dimension has zero plan coverage

Dimension-presence check only — not corridor completeness. `unknown` endpoint and empty plan return true (no check). Full suite: 1699/1699, 341 files, zero regressions.

## Test surface

- `src/domain/goal/terminalEndpointDetector.test.ts` — 60 tests (Phase B)
- `src/domain/goal/audit_endpoint_recognition_probe.test.ts` — 38 tests (Phase C)
- Audit probe assertions: LT-02/03/04 Probe 3 — `terminalEndpoint` assertions on contract path
- Full suite: 1659/1659, 340 files, zero regressions

**Why:** The endpoint recognition layer prevents the system from measuring corridor coverage and authority against the wrong target. Without a canonical endpoint, all downstream gate logic (Outcome Validity) implicitly assumes the endpoint from lane heuristics, which becomes fragile as more lanes are added.

**How to apply:** Before touching `terminalEndpointDetector.ts` or any gate logic that references endpoint objects, check (1) whether the pattern has a named load-bearing terminal object, and (2) whether Phase C freeze criteria are met. No enforcement logic can be added until Phase C is closed.
