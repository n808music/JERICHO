"""
LLM adapter — BitNet-only inference via Instructor + OpenAI-compatible client.

Resolution order (per profile):
  1. profile.base_url (if set in YAML)
  2. BITNET_BASE_URL env var
  3. "" → subprocess fallback if binary exists, else stub mode

No network call is ever made during testing (env vars absent → stub).
"""

from __future__ import annotations

import asyncio
import os
import re
import json
import subprocess
import time
from pathlib import Path
from typing import Any, TypeVar

from jyriko.llm.registry import ModelProfile
from jyriko.llm.schemas import DecomposedGoal, NarrativeText

T = TypeVar("T")

# ---------------------------------------------------------------------------
# Stub instances — deterministic, no I/O
# ---------------------------------------------------------------------------

_STUB_DECOMPOSED_GOAL = DecomposedGoal(
    goal_title="Stub goal",
    tasks=[],
    dependency_rationale="Stub mode — no LLM call made.",
)
_STUB_NARRATIVE = NarrativeText(text="Stub narrative — no LLM call made.")

_BACKEND_ENV: dict[str, str] = {
    "bitnet": "BITNET_BASE_URL",
    "llamacpp": "LLAMACPP_BASE_URL",
    "vllm": "VLLM_BASE_URL",
    "coreml": "COREML_BASE_URL",
}


# ---------------------------------------------------------------------------
# URL resolution
# ---------------------------------------------------------------------------

def _resolve_base_url(profile: ModelProfile) -> str:
    """Return the base_url for this profile, or '' to trigger stub/subprocess mode.

    Resolution order: profile.base_url → env var → '' (stub or subprocess).
    No hardcoded defaults so the test suite always stays offline.
    """
    if profile.inference_backend == "stub":
        return ""
    if profile.base_url:
        return profile.base_url
    env_key = _BACKEND_ENV.get(profile.inference_backend, "")
    return os.getenv(env_key, "") if env_key else ""


def _is_stub(profile: ModelProfile) -> bool:
    """True when no server URL is available.

    Subprocess fallback requires BITNET_BASE_URL=subprocess:// — empty URL
    always means stub mode so the test suite runs offline by default.
    """
    return not _resolve_base_url(profile)


def _binary_exists() -> bool:
    """Check whether the BitNet llama-cli binary is available for subprocess fallback."""
    from jyriko.config import get_settings
    binary = Path(os.path.expanduser(get_settings().bitnet_binary_path))
    return binary.is_file()


# ---------------------------------------------------------------------------
# Stub builder
# ---------------------------------------------------------------------------

def _build_stub(schema: type[T]) -> T:
    """Return a deterministic stub instance for the given schema type."""
    if schema is DecomposedGoal:
        return _STUB_DECOMPOSED_GOAL  # type: ignore[return-value]
    if schema is NarrativeText:
        return _STUB_NARRATIVE  # type: ignore[return-value]
    try:
        return schema.model_construct()  # type: ignore[return-value, union-attr]
    except Exception:
        return None  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Server mode — Instructor + OpenAI client
# ---------------------------------------------------------------------------

def _call_server(
    prompt: str,
    schema: type[T],
    model_profile: ModelProfile,
    base_url: str,
) -> T:
    """Call BitNet llama-server via Instructor-patched OpenAI client."""
    import instructor
    from openai import OpenAI

    client = instructor.from_openai(
        OpenAI(base_url=base_url, api_key="no-key"),
        mode=instructor.Mode.JSON,
    )
    return client.chat.completions.create(
        model=model_profile.model_id,
        response_model=schema,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2048,
        max_retries=2,
    )


# ---------------------------------------------------------------------------
# Subprocess fallback — llama-cli binary
# ---------------------------------------------------------------------------

def _run_bitnet_inference(prompt: str, schema: type[T]) -> T:
    """Run BitNet inference via llama-cli binary directly (offline fallback)."""
    from jyriko.config import get_settings

    settings = get_settings()
    binary_path = os.path.expanduser(settings.bitnet_binary_path)
    model_path = os.path.expanduser(settings.bitnet_model_path)

    full_prompt = prompt + "\nRespond with valid JSON only, no other text."

    cmd = [
        binary_path,
        "-m", model_path,
        "-p", full_prompt,
        "-n", "512",
        "-t", "4",
        "-c", "2048",
        "--temp", "0.7",
        "-ngl", "0",
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            cwd=os.path.dirname(binary_path),
        )
        if result.returncode != 0:
            raise RuntimeError(f"bitnet subprocess failed: {result.stderr[:500]}")

        output = result.stdout.strip()
        json_match = re.search(r"\{[\s\S]*\}", output)
        if not json_match:
            raise ValueError(f"No JSON found in output: {output[:500]}")

        parsed = json.loads(json_match.group(0))
        return schema.model_validate(parsed)

    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("BitNet inference timed out after 60s") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"BitNet output not valid JSON: {exc}") from exc


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def call_llm(
    prompt: str,
    schema: type[T],
    model_profile: ModelProfile,
    otel_span: Any = None,
) -> T:
    """Single LLM call returning structured output.

    Dispatch: stub → server mode (Instructor) → subprocess fallback.
    """
    t0 = time.perf_counter()

    base_url = _resolve_base_url(model_profile)

    if _is_stub(model_profile):
        result: T = _build_stub(schema)
    elif base_url.startswith("subprocess://"):
        # Explicit subprocess mode: BITNET_BASE_URL=subprocess://local
        result = _run_bitnet_inference(prompt, schema)
    else:
        result = _call_server(prompt, schema, model_profile, base_url)

    if otel_span is not None:
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        otel_span.set_attribute("llm.model_id", model_profile.model_id)
        otel_span.set_attribute("llm.backend", model_profile.inference_backend)
        otel_span.set_attribute("llm.latency_ms", elapsed_ms)

    return result


# ---------------------------------------------------------------------------
# Subagent + fallback utilities
# ---------------------------------------------------------------------------

def subagent_spawn(
    prompt: str,
    schema: type[T],
    model_profile: ModelProfile,
    pass_number: int = 1,
    otel_span: Any = None,
) -> T:
    """Fresh LLM context per call — no conversation history bleeds across passes."""
    if otel_span is not None:
        otel_span.set_attribute("llm.pass_number", pass_number)
    return call_llm(prompt, schema, model_profile, otel_span=otel_span)


async def with_fallback(
    primary_fn: Any,
    fallback_fn: Any,
    timeout_seconds: float,
) -> Any:
    """Run primary_fn under a deadline; on timeout or exception use fallback_fn."""
    loop = asyncio.get_event_loop()

    async def _run(fn: Any) -> Any:
        if asyncio.iscoroutinefunction(fn):
            return await fn()
        return await loop.run_in_executor(None, fn)

    try:
        return await asyncio.wait_for(_run(primary_fn), timeout=timeout_seconds)
    except Exception:
        return await _run(fallback_fn)
