"""
OQ-08: Model Registry drift detection.

Compares OTEL-aggregated latency data against registry latency profiles.
Trigger threshold: 20% divergence over 50 samples → open a PR to update the registry.

Usage:
    python scripts/check_registry_drift.py [--registry PATH] [--metrics PATH]

The metrics file is a JSON export of aggregated OTEL spans, shaped as:
    {"llama3-8b": {"count": 120, "p50_seconds": 38.5}, ...}

When no metrics file is available (e.g. fresh install), the script exits cleanly.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REGISTRY_PATH = Path(__file__).parents[1] / "backend" / "config" / "model_registry.yaml"

# Maps latency_profile → expected p50 in seconds
_LATENCY_PROFILE_SECONDS: dict[str, float] = {
    "fast": 5.0,
    "medium": 30.0,
    "slow": 90.0,
}


def _load_registry_latencies(registry_path: Path) -> dict[str, float]:
    import yaml

    raw = yaml.safe_load(registry_path.read_text())
    return {
        entry["model_id"]: _LATENCY_PROFILE_SECONDS[entry["latency_profile"]]
        for entry in raw["models"]
    }


def check_drift(
    registry_path: Path,
    metrics_path: Path | None,
    drift_threshold: float = 0.20,
    min_samples: int = 50,
) -> bool:
    """
    Compare observed latencies to registry expectations.
    Returns True (no action needed) or False (update registry via PR).
    """
    expected = _load_registry_latencies(registry_path)

    if metrics_path is None or not metrics_path.exists():
        print("No metrics file found — skipping drift check.")
        print("To collect metrics: configure OTEL_EXPORTER_OTLP_ENDPOINT and run the server.")
        return True

    with open(metrics_path) as f:
        observed: dict[str, dict[str, float]] = json.load(f)

    all_ok = True
    print(f"Checking {len(expected)} model(s) against registry ({registry_path.name})...")

    for model_id, expected_p50 in expected.items():
        if model_id not in observed:
            print(f"  [SKIP] {model_id} — no observed data yet")
            continue

        data = observed[model_id]
        sample_count = int(data.get("count", 0))

        if sample_count < min_samples:
            print(f"  [SKIP] {model_id} — only {sample_count}/{min_samples} samples collected")
            continue

        observed_p50 = data.get("p50_seconds", 0.0)
        divergence = abs(observed_p50 - expected_p50) / max(expected_p50, 0.001)
        status = "OK   " if divergence < drift_threshold else "DRIFT"

        print(
            f"  [{status}] {model_id}: "
            f"expected={expected_p50:.1f}s  observed={observed_p50:.1f}s  "
            f"divergence={divergence:.1%}  n={sample_count}"
        )

        if divergence >= drift_threshold:
            all_ok = False

    return all_ok


def main() -> None:
    parser = argparse.ArgumentParser(description="Check model registry latency drift (OQ-08).")
    parser.add_argument("--registry", type=Path, default=REGISTRY_PATH)
    parser.add_argument(
        "--metrics", type=Path, default=None,
        help="Path to JSON OTEL metrics export. Omit to skip comparison.",
    )
    parser.add_argument(
        "--threshold", type=float, default=0.20,
        help="Divergence fraction that triggers a DRIFT flag (default: 0.20).",
    )
    parser.add_argument(
        "--min-samples", type=int, default=50,
        help="Minimum sample count before a model is evaluated (default: 50).",
    )
    args = parser.parse_args()

    print(f"Registry : {args.registry}")
    print(f"Threshold: {args.threshold:.0%} over {args.min_samples} samples")
    print("=" * 60)
    ok = check_drift(args.registry, args.metrics, args.threshold, args.min_samples)
    print("=" * 60)
    print("PASS — registry is current" if ok else "DRIFT DETECTED — update registry via PR")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
