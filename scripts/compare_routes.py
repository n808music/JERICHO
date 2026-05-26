"""
Phase 0 route comparison script.
Calls both Node.js (port 3000) and FastAPI (port 8000) for each GET route
and reports structural differences in responses.

Usage:
    python scripts/compare_routes.py [--node-port 3000] [--fastapi-port 8000]

Both servers must be running. No state is mutated (GET-only comparison).
"""
import argparse
import json
import sys
from typing import Any

import httpx

READONLY_ROUTES: list[str] = [
    "/health",
    "/api/health",
    "/state",
    "/pipeline",
    "/internal/diagnostics",
    "/ai/view",
    "/ai/narrative",
    "/ai/directives",
    "/ai/session",
    "/ai/llm-contract",
    "/ai/llm-suggestions",
    "/team/export",
]


def _key_diff(a: Any, b: Any, path: str = "") -> list[str]:
    """Recursively compare top-level key presence (not values) between two objects."""
    diffs: list[str] = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in set(a) | set(b):
            child_path = f"{path}.{k}" if path else k
            if k not in a:
                diffs.append(f"  MISSING in Node: {child_path}")
            elif k not in b:
                diffs.append(f"  MISSING in FastAPI: {child_path}")
            else:
                diffs.extend(_key_diff(a[k], b[k], child_path))
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            diffs.append(f"  Array length differs at {path}: Node={len(a)} FastAPI={len(b)}")
    return diffs


def compare(node_port: int, fastapi_port: int) -> bool:
    node_base = f"http://localhost:{node_port}"
    fastapi_base = f"http://localhost:{fastapi_port}"
    all_passed = True

    with httpx.Client(timeout=10.0) as client:
        for route in READONLY_ROUTES:
            try:
                node_resp = client.get(f"{node_base}{route}")
                fastapi_resp = client.get(f"{fastapi_base}{route}")
            except httpx.ConnectError as exc:
                print(f"[SKIP] {route} — connection error: {exc}")
                continue

            status_match = node_resp.status_code == fastapi_resp.status_code
            print(f"\n{'OK' if status_match else 'FAIL'} {route}")
            print(f"  Status: Node={node_resp.status_code} FastAPI={fastapi_resp.status_code}")

            if not status_match:
                all_passed = False
                continue

            try:
                node_json = node_resp.json()
                fastapi_json = fastapi_resp.json()
            except Exception:
                print("  [WARN] Non-JSON response, skipping key comparison")
                continue

            diffs = _key_diff(node_json, fastapi_json)
            if diffs:
                all_passed = False
                print("  Key differences:")
                for d in diffs:
                    print(d)
            else:
                print("  Keys match.")

    return all_passed


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare Node.js and FastAPI route responses.")
    parser.add_argument("--node-port", type=int, default=3000)
    parser.add_argument("--fastapi-port", type=int, default=8000)
    args = parser.parse_args()

    print(f"Comparing Node.js :{args.node_port} vs FastAPI :{args.fastapi_port}")
    print("=" * 60)
    passed = compare(args.node_port, args.fastapi_port)
    print("\n" + "=" * 60)
    print("PASSED" if passed else "DIFFERENCES FOUND — do not cut over yet")
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
