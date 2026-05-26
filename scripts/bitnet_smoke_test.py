"""
BitNet E2E smoke test — verifies structured output through all LLM schemas.

Usage:
  BITNET_BASE_URL=http://localhost:8081/v1 python scripts/bitnet_smoke_test.py

Requires the BitNet llama-server to be running on the configured port.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

# Add backend to path so we can import jyriko modules
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from jyriko.llm.adapter import call_llm
from jyriko.llm.registry import ModelProfile, load_registry, get_model_profile
from jyriko.llm.schemas import DecomposedGoal, NarrativeText, SelfCritiqueRevision, TaskDecomposition

REGISTRY_PATH = Path(__file__).parent.parent / "backend" / "config" / "model_registry.yaml"


def _check_server(base_url: str) -> bool:
    """Verify the inference server is reachable."""
    import httpx
    try:
        r = httpx.get(f"{base_url}/models", timeout=5.0)
        return r.status_code == 200
    except Exception as exc:
        print(f"  Server check failed: {exc}")
        return False


def _test_schema(
    name: str,
    prompt: str,
    schema: type,
    profile: ModelProfile,
) -> tuple[bool, float]:
    """Test a single schema, return (success, latency_ms)."""
    t0 = time.perf_counter()
    try:
        result = call_llm(prompt, schema, profile)
        elapsed = (time.perf_counter() - t0) * 1000
        # Basic validation: result should be an instance of the schema
        assert isinstance(result, schema), f"Expected {schema.__name__}, got {type(result)}"
        return True, elapsed
    except Exception as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        print(f"  FAIL: {exc}")
        return False, elapsed


def main() -> None:
    base_url = os.getenv("BITNET_BASE_URL", "")
    if not base_url:
        print("BITNET_BASE_URL not set. Set it to run the smoke test.")
        print("Example: BITNET_BASE_URL=http://localhost:8081/v1 python scripts/bitnet_smoke_test.py")
        sys.exit(1)

    print(f"BitNet Smoke Test")
    print(f"Server: {base_url}")
    print()

    if not _check_server(base_url):
        print("Server not reachable. Is llama-server running?")
        print("  ~/BitNet/build/bin/llama-server --port 8081 -m ~/BitNet/models/BitNet-b1.58-2B-4T/ggml-model-i2_s.gguf")
        sys.exit(1)

    print("Server: OK")
    print()

    registry = load_registry(REGISTRY_PATH)
    model_id = os.getenv("DEFAULT_MODEL_ID", "bitnet-2b")
    profile = get_model_profile(model_id, registry)
    print(f"Model: {profile.model_id} (backend: {profile.inference_backend})")
    print()

    tests = [
        ("NarrativeText", "Write a brief motivational message about completing weekly goals. Keep it under 50 words.", NarrativeText),
        ("DecomposedGoal", "Break down this goal: 'Launch a personal website by end of month'", DecomposedGoal),
        ("SelfCritiqueRevision", 'Review this decomposition and suggest improvements: {"goal_title": "test", "tasks": [{"title": "Design layout", "instructions": "Create wireframes", "estimated_cost": "0.00", "estimated_duration_minutes": 60, "cognitive_load": 0.6, "task_type": "creative", "importance_tier": "routine", "dependencies": []}], "dependency_rationale": "Single task, no deps"}', SelfCritiqueRevision),
    ]

    passed = 0
    failed = 0

    for name, prompt, schema in tests:
        print(f"Testing {name}...", end=" ", flush=True)
        ok, latency = _test_schema(name, prompt, schema, profile)
        if ok:
            print(f"PASS ({latency:.0f}ms)")
            passed += 1
        else:
            print(f"FAIL ({latency:.0f}ms)")
            failed += 1

    print()
    print(f"Results: {passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
