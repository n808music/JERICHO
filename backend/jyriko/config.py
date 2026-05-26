"""
Application settings loaded from environment variables / .env file.
All external config goes through this module — nothing reads os.environ directly.
"""
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # State persistence (Phase 0: JSON file; Phase 2: replaced by Supabase)
    state_path: Path = Field(
        default=Path("../src/data/state_good.json"),
        description="Path to JSON state file (Phase 0 only).",
    )

    # Supabase (Phase 2+)
    supabase_url: str = Field(default="", description="Supabase project URL.")
    supabase_anon_key: str = Field(default="", description="Supabase anonymous key.")
    supabase_service_role_key: str = Field(default="", description="Supabase service-role key.")

    # LLM — base_url empty = stub mode (no network call)
    default_model_id: str = Field(
        default="bitnet-2b",
        description="Active model profile from model_registry.yaml. All callsites use this.",
    )
    bitnet_base_url: str = Field(default="", description="BitNet llama-server OpenAI-compat endpoint.")
    llamacpp_base_url: str = Field(default="", description="llama.cpp llama-server OpenAI-compat endpoint.")
    vllm_base_url: str = Field(default="", description="vLLM OpenAI-compat endpoint (future).")
    coreml_base_url: str = Field(default="", description="CoreML endpoint (future, iOS/macOS on-device).")
    bitnet_binary_path: str = Field(
        default="~/BitNet/build/bin/llama-cli",
        description="Path to llama-cli binary for subprocess fallback.",
    )
    bitnet_model_path: str = Field(
        default="~/BitNet/models/BitNet-b1.58-2B-4T/ggml-model-i2_s.gguf",
        description="Path to BitNet GGUF model file.",
    )

    # Security
    jwt_secret: str = Field(default="changeme")
    credential_encryption_key: str = Field(default="")

    # Google OAuth (Phase 3+)
    google_client_id: str = Field(default="")
    google_client_secret: str = Field(default="")
    google_oauth_redirect_uri: str = Field(default="http://localhost:8000/calendar/google/callback")

    # OpenTelemetry (Phase 1+)
    # Empty string → console exporter (local dev). Set to OTLP endpoint in prod.
    otel_exporter_otlp_endpoint: str = Field(default="")
    otel_service_name: str = Field(default="jyriko-backend")

    # Server
    port: int = Field(default=8000)

    # Model registry
    model_registry_path: Path = Field(
        default=Path(__file__).parent.parent / "config" / "model_registry.yaml",
    )


_settings: Settings | None = None


def get_settings() -> Settings:
    """Return a cached Settings instance (singleton)."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
