"""Tests for the Model Capability Registry."""
from pathlib import Path

import pytest

from jyriko.llm.registry import ModelProfile, get_model_profile, load_registry

REGISTRY_PATH = Path(__file__).parents[2] / "config" / "model_registry.yaml"


def test_load_registry_returns_tuple_of_profiles():
    registry = load_registry(REGISTRY_PATH)
    assert isinstance(registry, tuple)
    assert len(registry) >= 1
    assert all(isinstance(p, ModelProfile) for p in registry)


def test_load_registry_has_expected_models():
    registry = load_registry(REGISTRY_PATH)
    model_ids = {p.model_id for p in registry}
    assert "bitnet-2b" in model_ids
    assert "llama3-8b-instruct" in model_ids
    assert "stub" in model_ids


def test_get_bitnet_profile():
    registry = load_registry(REGISTRY_PATH)
    profile = get_model_profile("bitnet-2b", registry)
    assert profile.model_id == "bitnet-2b"
    assert profile.inference_backend == "bitnet"
    assert profile.recommended_pass_count == 2
    assert profile.self_critique_required is True


def test_get_llamacpp_profile():
    registry = load_registry(REGISTRY_PATH)
    profile = get_model_profile("llama3-8b-instruct", registry)
    assert profile.inference_backend == "llamacpp"
    assert profile.recommended_pass_count == 3


def test_profiles_have_base_url():
    registry = load_registry(REGISTRY_PATH)
    for profile in registry:
        assert hasattr(profile, "base_url")


def test_get_model_profile_not_found_raises():
    registry = load_registry(REGISTRY_PATH)
    with pytest.raises(KeyError, match="nonexistent"):
        get_model_profile("nonexistent", registry)


def test_model_profile_is_frozen():
    registry = load_registry(REGISTRY_PATH)
    profile = registry[0]
    with pytest.raises((AttributeError, TypeError)):
        profile.model_id = "changed"  # type: ignore[misc]


def test_pass_count_matches_registry_entry():
    """OQ-08: pass count in registry is the single source of truth — not hardcoded anywhere."""
    registry = load_registry(REGISTRY_PATH)
    stub = get_model_profile("stub", registry)
    assert stub.recommended_pass_count == 1
    assert stub.self_critique_required is False
