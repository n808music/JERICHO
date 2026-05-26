# Documentation Refactor Design

**Date:** 2026-05-26
**Branch:** long-horizon-calendar-visibility

## Goal

Restructure the JERICHO repository documentation to serve two primary audiences:

1. **You (primary author)** — find decisions, specs, and invariants without hunting through ~140 accumulated working documents
2. **Claude Code / AI agents** — load accurate, focused reference material at session start rather than picking up noise from historical working docs

## Approach

Curated migration: archive all historical working documents into a single `docs/archive/` tree, then promote the best existing docs into a clean two-track structure (`architecture/` and `reference/`), writing new synthesis docs only where key invariants currently live only in code.

## Target Structure

```
docs/
  README.md                        ← master index; short, navigable, AI-loadable
  architecture/
    execution-model.md             ← end-to-end pipeline: goal → deliverables → blocks → execution → POS
    authority-maps.md              ← merged UI authority map + probability authority map
    scheduling-semantics.md        ← promoted from docs/scheduling_contract.md
    source-of-truth.md             ← promoted from docs/source-of-truth-ownership.md
  reference/
    pos-trust-state.md             ← withheld/provisional/trusted rules + QUALIFYING_EXTERNAL_STAGES
    plan-quality-gate.md           ← evaluatePlanQualityGate invariants (5 checks)
    terminal-endpoint-rules.md     ← what constitutes a terminal endpoint; extracted from freeze doc
    goal-admission-policy.md       ← GoalAdmissionPolicy rules + GoalRejectionCode catalog
    execution-event-ledger.md      ← promoted from docs/execution-events.md
    goal-to-deliverable.md         ← promoted from docs/GOAL_TO_DELIVERABLE_COMPILER_CONTRACT.md
  development/                     ← unchanged (SETUP, TESTING, CONTRIBUTING, CI-CD)
  archive/
    root/                          ← all ~50 root-level .md files
    docs-root/                     ← non-promoted docs/ root files + retired architecture/ files
    phases/                        ← docs/phases/ contents
    modules/                       ← docs/modules/ contents
    misc/                          ← docs/open-questions/, docs/freeze/, loose audit docs
```

## Content Plan

### Straight promotions (git mv + update H1 if it contains a phase-version stamp; no other edits)

| Source | Destination |
|---|---|
| `docs/scheduling_contract.md` | `docs/architecture/scheduling-semantics.md` |
| `docs/source-of-truth-ownership.md` | `docs/architecture/source-of-truth.md` |
| `docs/execution-events.md` | `docs/reference/execution-event-ledger.md` |
| `docs/GOAL_TO_DELIVERABLE_COMPILER_CONTRACT.md` | `docs/reference/goal-to-deliverable.md` |

### Merges (two files become one)

| Sources | Destination |
|---|---|
| `docs/architecture/UI_AUTHORITY_MAP.md` + `docs/architecture/PROBABILITY_AUTHORITY_MAP.md` | `docs/architecture/authority-maps.md` |

### New synthesis docs

Each is written from the listed sources; content is synthesized, not copied verbatim. Short decision-record format unless the subject requires structural explanation.

| File | Sources | Format |
|---|---|---|
| `docs/architecture/execution-model.md` | `docs/architecture/EXECUTION_PLAN.md`, `docs/architecture.md`, `docs/architecture/probabilitySpec.md` | Structural explanation |
| `docs/reference/pos-trust-state.md` | `src/state/engine/probabilityScore.ts` (TrustState + derivePosDisplayPolicy), `JERICHO_TRUST_STATE_SEMANTICS_BRIEF.md`, `LIVE_POS_CANONICAL_STACK_FREEZE_PACKAGE.md` | Short decision record |
| `docs/reference/plan-quality-gate.md` | `src/domain/planQuality/evaluatePlanQualityGate.ts` (all five checks), `PLAN_QUALITY_GATE_FREEZE_PACKAGE.md` | Short decision record |
| `docs/reference/terminal-endpoint-rules.md` | `src/domain/goal/terminalEndpointDetector.ts`, `JERICHO_TERMINAL_ENDPOINT_RECOGNITION_FREEZE.md` | Short decision record |
| `docs/reference/goal-admission-policy.md` | `src/domain/goal/GoalAdmissionPolicy.ts`, `src/domain/goal/GoalRejectionCode.ts`, `src/domain/goal/GoalIntakeContract.ts` | Short catalog |
| `docs/README.md` | Written last; links all live docs with one-line descriptions | Index |

### Archive destinations

| Source | Archive destination |
|---|---|
| All ~50 root-level `.md` files | `docs/archive/root/` |
| Non-promoted `docs/` root files | `docs/archive/docs-root/` |
| Retired `docs/architecture/` files (EXECUTION_PLAN, MVP3_AUDIT_NOTES, STRUCTURE_TAB_REDESIGN, UI_AUDIT_REPORT, README, architecture.md, probabilitySpec.md) | `docs/archive/docs-root/` |
| `docs/phases/` | `docs/archive/phases/` |
| `docs/modules/` | `docs/archive/modules/` |
| `docs/open-questions/`, `docs/freeze/`, loose audit docs | `docs/archive/misc/` |

`docs/archive/` gets a one-line `README.md` explaining it holds historical working documents.

## Sequencing

### Phase 1 — Archive moves (one commit, mechanical)

All `git mv` operations, no content edits. Easy to verify and revert:
- Root `.md` files → `docs/archive/root/`
- Non-promoted `docs/` root files → `docs/archive/docs-root/`
- `docs/phases/` → `docs/archive/phases/`
- `docs/modules/` → `docs/archive/modules/`
- `docs/open-questions/`, `docs/freeze/`, loose audits → `docs/archive/misc/`
- Retired `docs/architecture/` files → `docs/archive/docs-root/`

### Phase 2 — Promotions and merge (one commit)

- `git mv` four straight-promotion files to new paths
- Write `docs/architecture/authority-maps.md` as merge of two authority files
- Archive the two source files

### Phase 3 — New synthesis docs (one commit)

Written in this order:
1. `docs/architecture/execution-model.md` — establishes the pipeline context
2. `docs/reference/pos-trust-state.md`
3. `docs/reference/plan-quality-gate.md`
4. `docs/reference/terminal-endpoint-rules.md`
5. `docs/reference/goal-admission-policy.md`
6. `docs/README.md` — written last so links are accurate

## Verification Criteria

- Repo root contains no loose `.md` files except `CLAUDE.md` and `README.md`
- `docs/archive/` has a `README.md` with a one-liner
- `docs/README.md` links every live doc with a one-line description
- All `docs/reference/` docs are short enough to be loaded as AI session context without token pressure
