"""
OpenTelemetry tracing setup.

setup_tracing() is called once in the FastAPI lifespan event.
Uses OTLP export when an endpoint is configured; falls back to console
exporter for local development (no external collector required).
"""
from __future__ import annotations

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter


def setup_tracing(
    service_name: str,
    otlp_endpoint: str | None = None,
) -> TracerProvider:
    """
    Initialize OpenTelemetry tracing.
    OTLP export when endpoint provided; console exporter otherwise.
    """
    resource = Resource(attributes={"service.name": service_name})
    provider = TracerProvider(resource=resource)

    if otlp_endpoint:
        exporter = OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
    else:
        exporter = ConsoleSpanExporter()

    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return provider


def get_tracer(name: str = "jyriko") -> trace.Tracer:
    """Return a tracer scoped to the given instrumentation name."""
    return trace.get_tracer(name)
