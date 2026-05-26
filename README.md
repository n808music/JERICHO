# Jericho 2.0

Closed-loop behavioral execution engine. Optimizes for the user's subjective sense of momentum over raw task completion rate. Decomposes goals into scheduled tasks using local LLM inference, adapts capacity estimates weekly, and reschedules overdue tasks nightly via a feathering algorithm.

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI 0.115, Python 3.12, uv |
| Database | Supabase (self-hosted Docker via Colima) + Alembic |
| LLM — heavy | llama.cpp (`/opt/local/bin/llama-server`, port 8080) — Llama-3.1-8B-Instruct Q4 |
| LLM — light | BitNet.cpp (`~/BitNet/build/bin/llama-server`, port 8081) — BitNet-b1.58-2B-4T |
| Frontend | React 18 + Vite (port 5173) — unchanged throughout migration |
| Calendar | Google Calendar API + CalDAV |

## Structure

```
JERICHO/
├── backend/                    ← Primary Python backend
│   ├── jericho/
│   │   ├── domain/             ← Pure functions, no I/O (pipeline, viability, look_ahead…)
│   │   ├── llm/                ← Instructor + openai client; stubs when URL unset
│   │   ├── db/                 ← Supabase repositories + Alembic migrations
│   │   ├── routers/            ← Thin FastAPI HTTP layer
│   │   ├── workers/            ← APScheduler nightly rescheduler
│   │   └── calendar/           ← Google + CalDAV backends
│   ├── config/
│   │   └── model_registry.yaml ← LLM profiles (llamacpp, bitnet, mlx, stub)
│   └── tests/
│       ├── domain/             ← Unit tests (always offline)
│       ├── llm/                ← Adapter + decomposition tests (stub mode)
│       ├── calendar/           ← Google + CalDAV (mocked)
│       ├── workers/            ← Nightly scheduler tests
│       └── db/                 ← Integration tests (require SUPABASE_URL)
├── infra/supabase/             ← Self-hosted Supabase Docker stack
├── src/ui/                     ← React/Vite frontend (unchanged)
└── src/api/server.js           ← Legacy Node.js (idle post-cutover)
```

## Running

### Backend

```bash
cd backend
uv venv .venv && source .venv/bin/activate
uv pip install -e ".[test]"
uv run uvicorn jericho.main:app --reload   # port 8000
```

### Frontend

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev:client   # port 5173
```

### Local LLM inference (optional — stubs without these)

```bash
# Heavy tasks (decomposition, self-critique)
# Note: AMD Radeon Pro 580 requires -ngl 0 (Metal unsupported for non-Apple-Silicon)
/opt/local/bin/llama-server \
  -m ~/models/llama3-8b-instruct/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf \
  --port 8080 --ctx-size 4096 -ngl 0

# Lightweight tasks (narrative, summaries)
cd ~/BitNet && ./build/bin/llama-server \
  -m models/BitNet-b1.58-2B-4T/ggml-model-i2_s.gguf \
  --port 8081 --ctx-size 2048
```

### Supabase (required for Phase 2+ features)

```bash
cd infra/supabase
docker compose up -d
# Run migrations (must be inside Docker network):
cd ../../backend
docker run --rm --network supabase_default -v $(pwd):/backend -w /backend \
  python:3.12-slim \
  sh -c "pip install -q alembic psycopg2-binary sqlalchemy && alembic upgrade head"
```

## Tests

```bash
cd backend

# Unit tests — always offline, no LLM or DB required
uv run pytest --no-cov -q

# Integration tests — require Supabase running (see above)
SUPABASE_URL=http://localhost:8000 \
SUPABASE_SERVICE_ROLE_KEY=<key> \
uv run pytest tests/db/ -v --no-cov

# Live LLM smoke test (both servers must be running)
LLAMACPP_BASE_URL=http://localhost:8080/v1 \
BITNET_BASE_URL=http://localhost:8081/v1 \
python3 -c "
from jericho.llm.adapter import call_llm
from jericho.llm.registry import load_registry, get_model_profile
from jericho.llm.schemas import DecomposedGoal
from pathlib import Path
reg = load_registry(Path('config/model_registry.yaml'))
p = get_model_profile('llama3-8b-instruct', reg)
r = call_llm('Break down: finish my album by Dec 2026', DecomposedGoal, p)
print(r.goal_title, len(r.tasks), 'tasks')
"
```

## Pipeline

```
Goal → validateGoal → deriveIdentityRequirements → computeCapabilityGaps
     → generateTasksForCycle → computeIntegrityScore → applyIdentityUpdate
     → (nightly) run_feathering → reschedule overdue tasks
```

All domain functions are pure (frozen dataclasses, injected side-effects). The LLM layer is a transparent stub when backend URLs are absent — the test suite never makes network calls.
