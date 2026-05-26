# Execution Model

JERICHO transforms a goal contract into a scheduled plan and tracks execution against it deterministically — no LLM calls at runtime, no randomness in plan generation.

## Pipeline

```
Goal Intake
  └─ GoalAdmissionPolicy.ts        — hard gate: 7 validation phases, all must pass
  └─ GoalIntakeContract.ts         — structured intake form (multi-step UI flow)
  └─ GoalExecutionContract.ts      — typed contract written to state on admission

Auto-Generation
  └─ autoStrategy.ts               — detects goal archetype (15+ types), generates StrategyDeliverables
  └─ mechanismClass.ts             — classifies goal text into 6 MechanismClasses (CREATE/PUBLISH/MARKET/LEARN/OPS/REVIEW)
  └─ autoDeliverables.ts           — generates deliverable lists from MechanismClass templates
  └─ goalToDeliverables.ts         — maps goal contract to deliverable + action graph

Plan Generation
  └─ deterministicPlanGenerator.ts — produces reproducible block schedules (same inputs → same blocks)
  └─ deadline.ts                   — deadline arithmetic; workable day counting
  └─ planProof.ts                  — slack/intensity ratio from equation inputs

Plan Quality Gate
  └─ evaluatePlanQualityGate.ts    — validates plan structure before activation (see docs/reference/plan-quality-gate.md)

Derived State (re-run on every mutation)
  └─ identityCompute.js            — computeDerivedState: calls all downstream computations
  └─ feasibility.ts                — FEASIBLE/REQUIRED/INFEASIBLE from remaining blocks vs workable days
  └─ probabilityScore.ts           — POS score + trust state (see docs/reference/pos-trust-state.md)
  └─ fullHorizonScheduleExpansion  — expands master plan into calendar blocks

Execution
  └─ todayAuthority.ts             — immutable execution event ledger (see docs/reference/execution-event-ledger.md)
  └─ executionContract.ts          — guards canEmitExecutionEvent before any log append
  └─ profileExecutionContainment.ts — friction events for missed/skipped blocks
```

## Key Invariants

**Determinism.** Same goal contract + same `nowISO` always produces identical deliverables, block schedule, feasibility result, and POS inputs. No random values anywhere in the generation path.

**Immutable event ledger.** `executionEvents` is append-only. No derived projection (today blocks, weekly summaries) may be mutated and replayed back into the ledger. See `docs/reference/execution-event-ledger.md`.

**Engine authority.** `src/state/invariants/engineAuthority.ts` exports `assertEngineAuthority`. Any new engine computation must call this to prevent derived fields from being written directly from UI. See `docs/architecture/authority-maps.md`.

**Plan quality gate.** A plan must pass `evaluatePlanQualityGate` before POS is computed as `trusted`. Gate failures return typed `PlanQualityFailureCode` values. See `docs/reference/plan-quality-gate.md`.

**One write path per artifact.** `docs/architecture/source-of-truth.md` is the runtime ownership lock. No mirror field may be mutated; mirrors are read-only adapters only.

## State Persistence

- **Primary:** LocalStorage via `identityStore.js` — the browser is the single source of truth for local development.
- **Secondary:** Backend sync via `src/services/syncService.js` — debounced push on state change, pull on mount. Sync uses device-ID-based JWT auth (`/api/auth/device`). State blob is stored as JSON in `UserState` model.
- The backend is authoritative only for restoring state across devices/browser resets; LocalStorage takes precedence during a session.

## Domain Subdirectories

| Directory | Responsibility |
|---|---|
| `src/domain/goal/` | Goal admission, rejection codes, intake contract, terminal endpoint detection |
| `src/domain/masterPlan/` | Full-horizon schedule expansion, coverage audit, render-truth audit |
| `src/domain/planQuality/` | Plan quality gate and all sub-detectors |
| `src/domain/autoStrategy.ts` | Goal-type detection + deliverable template generation |
| `src/state/engine/` | Feasibility, POS scoring, execution events, execution contract |
| `src/core/` | Mechanism class, auto-deliverables, deterministic plan generator, deadline math |
