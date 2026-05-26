"""
Model Capability Registry — loads config/model_registry.yaml once at startup.

Each ModelProfile is a frozen dataclass; the registry is an immutable tuple.
base_url: when empty, adapter resolves via BITNET_BASE_URL env var;
still empty after resolution → stub mode (no network call).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

import yaml

InferenceBackend = Literal["bitnet", "llamacpp", "vllm", "coreml", "stub"]


@dataclass(frozen=True)
class ModelProfile:
    model_id: str
    inference_backend: InferenceBackend
    context_window_tokens: int
    structured_output_reliability: Literal["low", "medium", "high"]
    reasoning_depth: Literal["low", "medium", "high"]
    recommended_pass_count: int
    self_critique_required: bool
    timeout_threshold_seconds: int
    latency_profile: Literal["fast", "medium", "slow"]
    supports_tool_use: bool
    base_url: str = field(default="")


def load_registry(path: Path) -> tuple[ModelProfile, ...]:
    """Load and parse the model registry YAML. Called once at startup."""
    raw = yaml.safe_load(path.read_text())
    return tuple(ModelProfile(**entry) for entry in raw["models"])


def get_model_profile(model_id: str, registry: tuple[ModelProfile, ...]) -> ModelProfile:
    """Return the profile for model_id. Raises KeyError if not registered."""
    for profile in registry:
        if profile.model_id == model_id:
            return profile
    raise KeyError(f"Model '{model_id}' not found in registry")
