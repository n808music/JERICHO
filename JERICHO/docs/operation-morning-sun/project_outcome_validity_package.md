---
name: Outcome Validity Package — Frozen v1
description: Three-phase subsystem for terminal outcome authority detection and gate enforcement — what was built, what is frozen, what is deliberately out of scope
type: project
---

Outcome Validity is a frozen package as of 2026-04-06. It is a bounded subsystem independent of the pre-agent hardening phases (A–F) tracked in project_phase_status.md.

## What was built

**Phase 1 — Authority detection (canonical contract truth)**
`src/domain/goal/terminalOutcomeAuthority.ts` — classifies goal terminal events as `fully_controllable`, `externally_mediated`, `market_dependent`, `mixed`, or `unknown`. Field `terminalOutcomeAuthority: TerminalOutcomeAuthorityResult` added to `GoalIntakeContract`. All reads go through the contract; no recomputation at call sites.

Audit pack matrix (all 7 goals classify correctly):
- ST-01 landing page → fully_controllable
- ST-02 fitness → fully_controllable
- ST-03 brand launch → mixed
- LT-01 podcast → mixed
- LT-02 fullstack+job → mixed
- LT-03 job search → externally_mediated
- LT-04 fundraising → externally_mediated

**Phase 2 — Prep-only enforcement**
`src/domain/planQuality/contactStageDetector.ts` — fires `OUTCOME_COVERAGE_PREP_ONLY` when an externally_mediated or mixed goal has no contact-stage deliverable. Bounded vocabulary; "pitch deck" is prep, not contact.

**Phase 3 — Terminal-stage enforcement for audited lanes**
`src/domain/planQuality/corridorLaneDetector.ts` + `terminalStageDetector.ts` — fires `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` when an audited-lane goal has contact-stage coverage but no terminal-stage deliverable. Two audited lanes: JobSearch (terminal object: `offer`/`offer letter`) and Fundraising (terminal objects: `term sheet`, `commitment`, `wire transfer`, `close round`, `legal close`). Unknown-lane goals are skipped.

Binding invariant: terminal-stage detection is anchored on lane-specific terminal objects, not generic completion verbs. A pattern that fires when the terminal object is removed is over-broad.

**Phase D — Endpoint-presence and split-dimension enforcement (2026-04-07)**
`src/domain/planQuality/splitEndpointCoverageDetector.ts` — fires:
- `OUTCOME_ENDPOINT_MISSING`: externally_mediated/mixed goal with `missing` or `ambiguous` terminal endpoint
- `OUTCOME_SPLIT_DIMENSION_UNCOVERED`: split goal whose secondary endpoint dimension has zero plan coverage

Dimension-presence check only (broader than terminal-stage patterns). `unknown` endpoint and empty plan return true. Brief: `JERICHO_PHASE_D_ENDPOINT_GATE_CONSEQUENCE_BRIEF.md`.

## Key freeze artifacts

- `JERICHO_PHASE_3_TERMINAL_CORRIDOR_COMPLETENESS_BRIEF.md` — Phase 3 doctrine and corridor maps
- `JERICHO_OUTCOME_VALIDITY_PACKAGE_FREEZE.md` — full package boundary, test surface, reopening criteria
- `JERICHO_TERMINAL_OUTCOME_AUTHORITY_FRAMEWORK.md` — policy framework
- `JERICHO_OUTCOME_VALIDITY_GATE_SPEC.md` — full 5-phase roadmap (Phases 1–3 now complete, Phase D added)
- `JERICHO_PHASE_D_ENDPOINT_GATE_CONSEQUENCE_BRIEF.md` — Phase D doctrine

## Test surface (all passing, 1699/1699 total, 341 files)

- `terminalOutcomeAuthority.test.ts` — 29 tests (Phase 1)
- `contactStageDetector.test.ts` — 45 tests (Phase 2)
- `terminalStageDetector.test.ts` — 66 tests (Phase 3)
- `splitEndpointCoverageDetector.test.ts` — 40 tests (Phase D)

## What is deliberately out of scope (frozen exclusions)

- Trust state extension (`provisional_external`, `provisional_market`) — Phase 5 per spec
- RC-13: completionBoundaryStatus missing for non-podcast goals — separate defect
- RC-20: full external dependency encoding in trust state — residual open
- Mixed-authority decomposition beyond authority filter
- Unaudited lanes (SalesPipeline, Publishing) — require audit probe before patterns added
- Intermediate corridor stage enforcement (Stage 2 optional)
- `OUTCOME_VERIFICATION_TEXT_NOT_COVERED` clause parsing — deferred to impl Phase 4

## Reopening conditions

Any of these invalidates the freeze and requires a new brief:
1. New lane added without audit probe
2. Pattern addition violates object-over-verb invariant
3. Trust state change touches authority-class logic
4. Gate check block split across multiple insertion points
5. Contract field recomputed outside `buildGoalIntakeContract`

**Why:** These are direct defenses against failure modes (RC-23 class lexical drift, canonical ownership fragmentation) already observed in the audit pack sessions.

**How to apply:** Before touching any of the four package files or the gate block in `evaluatePlanQualityGate.ts`, check whether the change stays inside the frozen package contract or trips a reopening condition.
