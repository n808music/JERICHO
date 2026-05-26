# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start everything (frontend + backend concurrently)
npm run dev

# Frontend only (port 5183, strict)
npm run dev:client

# Backend only (FastAPI via venv)
npm run dev:api

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a specific test file
npx vitest run src/domain/goal/GoalPolicy.test.ts

# Run v1 reference test suite (key e2e + domain tests)
npm run test:v1-reference

# Lint
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check

# Full pre-ship check
npm run check-all
```

**Backend (Python):**
```bash
cd backend
./venv/bin/pip install -r requirements.txt
./venv/bin/python main.py
# Tests (pytest)
./venv/bin/pytest app/tests/
```

## Architecture Overview

JERICHO is a deterministic goal planning system. The user sets a goal; the system auto-generates deliverables, schedules time blocks, tracks execution, and computes a live probability-of-success (POS) score—without LLM calls at runtime.

### Frontend: React/Vite (src/)

**State layer** (`src/state/`) is the heart of the frontend. It is a single large React context (`IdentityContext`, wired in `identityStore.js`) that holds the entire profile state and dispatches mutations through a reducer. The derived state is recomputed on every mutation via `computeDerivedState` in `identityCompute.js`. Persistence is LocalStorage; the backend sync (`syncService.js → /api/sync/push|pull`) is secondary and opt-in.

Key state concepts:
- **`identityStore.js`** — context provider, reducer, all action dispatchers. Primary write surface.
- **`identityCompute.js`** — pure derived-state computation (called after every mutation). Calls the master plan expansion, plan quality gate, POS score, feasibility, etc.
- **`masterPlanStore.js` / `coreMissionContractStore.js`** — sub-stores sliced into the identity state for multi-goal horizon planning.

**Domain layer** (`src/domain/`) — pure TypeScript business logic, no React. Subdivided:
- `goal/` — `GoalPolicy.ts`, `GoalAdmissionPolicy.ts`, `GoalIntakeContract.ts`, `terminalEndpointDetector.ts`, `terminalOutcomeAuthority.ts`. These enforce what constitutes a valid goal and whether a terminal outcome has been reached.
- `masterPlan/` — full-horizon schedule expansion, coverage audit, plan quality scoring, render-truth audit. All pure functions.
- `planQuality/` — `evaluatePlanQualityGate.ts` is the single gate that blocks plan activation if structural requirements aren't met (contact stage, terminal stage, corridor lane, branch coverage).
- `autoStrategy.ts` — pattern-based goal-type detection (15+ archetypes) → deliverable templates. No LLM.

**Core layer** (`src/core/`) — lower-level deterministic primitives:
- `mechanismClass.ts` — classifies goal text into 6 mechanism classes (CREATE/PUBLISH/MARKET/LEARN/OPS/REVIEW) used for template selection.
- `autoDeliverables.ts` — generates deliverable lists from mechanism class.
- `deterministicPlanGenerator.ts` — produces reproducible block schedules given a goal contract + constraints.
- `deadline.ts` — deadline arithmetic utilities.

**Engine layer** (`src/state/engine/`) — execution and scoring:
- `probabilityScore.ts` — computes POS; exports `TrustState` (`withheld | provisional | trusted`) and `derivePosDisplayPolicy`.
- `feasibility.ts` — FEASIBLE/REQUIRED/INFEASIBLE determination from remaining blocks vs. workable days.
- `planProof.ts` — slack/intensity ratios from goal equation inputs.
- `todayAuthority.ts` — immutable execution event ledger; all block completions are appended, never mutated.
- `executionContract.ts` — guards that prevent invalid execution event emission.
- `profileExecutionContainment.ts` — friction events for missed/skipped blocks.

**UI layer** (`src/components/`, `src/ui/`) — React components. `src/components/zion/` contains the main dashboard views (Workspace, DaySchedulePanel, WeekGrid, MonthMatrix, etc.). `src/ui/goalAdmission/` is the multi-step goal intake flow. `src/ui/masterPlan/` is the timeline UI.

**Authority contract** (`src/contracts/uiAuthorityMap.ts`) — typed registry mapping every UI surface to AUTHORITATIVE / ADVISORY / REFLECTIVE. Consult this when adding new UI controls.

### Backend: FastAPI/Python (backend/)

- `main.py` — FastAPI app, CORS, router registration, table creation.
- `app/api/` — routers: `auth.py` (device-based JWT), `goals.py`, `blocks.py`, `sync.py` (push/pull state blobs).
- `app/models/` — SQLAlchemy ORM models: `user.py`, `master_plan.py`, `core_mission_contract.py`, `user_state.py`.
- `app/core/config.py` — settings via pydantic-settings; SQLite in dev (`jericho_dev.db`), PostgreSQL in prod.
- Auth is device-ID-based (no user accounts); each device auto-registers and gets a JWT.

### Testing

Tests live in both `src/**/*.test.{ts,tsx,js,jsx}` and `tests/**/*.test.*`. Vitest runs them all. `tests/setup.ts` extends `expect` with jest-dom matchers. The `tests/state/` directory contains freeze-package tests (snapshot-style regression tests for plan output).

`QUALIFYING_EXTERNAL_STAGES` in `src/state/engine/probabilityScore.ts` is the authoritative list for externally-mediated grammar that affects POS trust state.

### Key Invariants

- **Determinism**: same goal contract + same date always produces identical deliverables, blocks, and POS inputs. No randomness anywhere in the plan generation path.
- **Immutable event ledger**: execution events are appended-only (`todayAuthority.ts`). Mutations are never applied to past events.
- **Engine authority**: `src/state/invariants/engineAuthority.ts` exports `assertEngineAuthority` — call this in any new engine computation to enforce that derived fields are never written directly from UI.
- **Plan quality gate**: `evaluatePlanQualityGate.ts` must pass before a plan is considered live. Gate failures produce typed `PlanQualityFailureCode` values.

### Environment Variables (frontend)

Set via `vite.config.mjs` `define.process.env`:
- `JERICHO_DISABLE_GENERATE_TRACE` — disables generation trace logging
- `JERICHO_DEBUG_PERF_ACTIONS` — enables perf action logging
- `JERICHO_DEBUG_SCHEDULER` — enables scheduler debug output
- `VITE_REDUCE_UI` — strips non-essential UI panels (used in prod)
