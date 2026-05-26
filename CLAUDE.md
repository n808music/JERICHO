# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Commands

### JavaScript (Node.js — legacy, Phase 0 transition)

```bash
npm install          # install JS dependencies
npm run dev          # Node API (port 3000) + Vite client (port 5173) concurrently
npm run dev:api      # Node API only — uses STATE_PATH=src/data/state_good.json
npm run dev:client   # Vite client only
npm test             # Jest suite with coverage (src/core only)
npm run lint         # ESLint + Prettier rules
npm run build        # lint + test + vite build
```

Run a single JS test: `NODE_OPTIONS=--experimental-vm-modules jest tests/core/scoring-engine.test.js`

### Python (FastAPI — primary backend, port 8000)

```bash
cd backend
uv venv .venv && source .venv/bin/activate   # one-time setup
uv pip install -e ".[test]"                  # install all deps including test extras
uv run uvicorn jericho.main:app --reload     # run FastAPI dev server
uv run pytest                                # full unit suite (offline, no LLM/DB needed)
uv run pytest tests/domain/ --no-cov -v     # domain-only tests, verbose
uv run pytest tests/domain/test_pipeline.py -v --no-cov   # single file
```

Integration tests (require local Supabase via Colima):

```bash
cd infra/supabase && docker compose up -d   # start Supabase stack
SUPABASE_URL=http://localhost:8000 \
SUPABASE_SERVICE_ROLE_KEY=<key> \
uv run pytest tests/db/ -v --no-cov         # RLS + repository tests
```

DB migrations (run inside Docker network — macOS host can't reach container IPs directly):

```bash
cd backend
docker run --rm --network supabase_default \
  -v $(pwd):/backend -w /backend \
  python:3.12-slim \
  sh -c "pip install -q alembic psycopg2-binary sqlalchemy && alembic upgrade head"
```

LLM env vars (stub mode when unset — tests always run offline):

```
DEFAULT_MODEL_ID=bitnet-2b                   # active backend (default: bitnet-2b)
BITNET_BASE_URL=http://localhost:8081/v1     # BitNet llama-server
LLAMACPP_BASE_URL=http://localhost:8080/v1   # llama.cpp llama-server
VLLM_BASE_URL=                               # vLLM (future)
COREML_BASE_URL=                             # CoreML (future, iOS/macOS on-device)
```

### Cutover (switching frontend from Node to FastAPI)

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev:client
python scripts/compare_routes.py            # verify parity before cutover
```

## Architecture

The system is a **closed-loop behavioral execution engine** targeting momentum over task completion rate. The Python pipeline is the canonical spine:

```
Goal Input → validateGoal → deriveIdentityRequirements → computeCapabilityGaps
  → generateTasksForCycle → computeIntegrityScore → applyIdentityUpdate
  → (nightly: run_feathering → reschedule overdue tasks)
```

### Layer map

| Layer     | Path                        | Role                                                        |
| --------- | --------------------------- | ----------------------------------------------------------- |
| Domain    | `backend/jericho/domain/`   | Pure functions, no I/O. All business logic.                 |
| LLM       | `backend/jericho/llm/`      | Instructor + openai client. Stubs when backend URL unset.   |
| DB        | `backend/jericho/db/`       | Supabase async repositories + Alembic migrations.           |
| Routers   | `backend/jericho/routers/`  | Thin FastAPI HTTP layer — no logic.                         |
| Workers   | `backend/jericho/workers/`  | APScheduler nightly rescheduler (23:59 cron).               |
| Calendar  | `backend/jericho/calendar/` | Google + CalDAV backends behind `CalendarBackend` Protocol. |
| UI        | `src/ui/`                   | React/Vite client (unchanged throughout migration).         |
| Legacy JS | `src/core/`, `src/api/`     | Node.js — kept idle post-cutover, then retired.             |
| Infra     | `infra/supabase/`           | Self-hosted Supabase Docker stack (Colima).                 |

### Key design decisions

- **Pure functions everywhere in `backend/jericho/domain/`** — frozen dataclasses, no I/O, no side effects. Side effects are injected (`ledger_writer`, `calendar_sync` callables).
- **LLM stub by default** — resolution order: `profile.base_url` → env var → `""` (stub). No hardcoded localhost defaults, so the full test suite runs offline.
- **LLM backends**: Pluggable via `DEFAULT_MODEL_ID`. BitNet (port 8081, default), llama.cpp (port 8080), vLLM (future), CoreML (future iOS/macOS). All use OpenAI-compatible API via `instructor.from_openai(OpenAI(base_url=...))`. BitNet also supports `subprocess://` fallback via `llama-cli`.
- **Supabase RLS** — every table has `instance_id` isolation. FastAPI middleware injects `SET LOCAL app.instance_id` per request from JWT.
- **DB migrations run inside Docker** — macOS host can't directly reach container IPs; use `docker run --network supabase_default`.
- **`str+Enum` pattern** — domain enums inherit from both `str` and `Enum` (e.g. `class TaskStatus(str, Enum)`) for DB serialization compatibility.

### Domain modules

`domain/pipeline.py` orchestrates the full cycle (entry point for understanding the system).

Key pure-function modules: `viability.py` (load ratio + pause triggers), `capacity_profile.py` (EWA + cold-start), `cognitive_load.py`, `state_machine.py` (valid transitions as frozenset), `look_ahead.py` (two-pass feathering), `scoring_engine.py` (integrity score 0–100).

### LLM registry

`config/model_registry.yaml` defines `ModelProfile` entries. Each profile specifies `inference_backend` (`bitnet` | `llamacpp` | `vllm` | `coreml` | `stub`), `recommended_pass_count`, and `self_critique_required`. `DEFAULT_MODEL_ID` selects the active profile. The adapter resolves `base_url` at call time — empty string triggers stub mode.

### Scoring

`scoring_engine.py` computes `integrityScore` (0–100) weighting task outcomes by `estimatedImpact × difficultyWeight × timelinessWeight`. Missed tasks subtract; pending excluded. Score feeds pacing mode (`stabilize` / `build` / `advance`) and identity updates.
