"""Distributed Tracing Configuration
Provides OpenTelemetry-based distributed tracing.
"""
import os
from typing import Optional
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.trace import Status, StatusCode
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from fastapi import FastAPI


class TracingConfig:
    """Distributed tracing configuration"""
    
    def __init__(
        self,
        service_name: str = "xcodereview-backend",
        service_version: str = "0.1.0",
        otlp_endpoint: Optional[str] = None,
        enabled: bool = True
    ):
        """
        Initialize tracing configuration.
        
        Args:
            service_name: Name of the service
            service_version: Version of the service
            otlp_endpoint: OTLP collector endpoint (e.g., "http://jaeger:4317")
            enabled: Whether tracing is enabled
        """
        self.service_name = service_name
        self.service_version = service_version
        self.otlp_endpoint = otlp_endpoint or os.getenv(
            "OTLP_ENDPOINT",
            "http://localhost:4317"
        )
        self.enabled = enabled and os.getenv("TRACING_ENABLED", "true").lower() == "true"
        
        if self.enabled:
            self._setup_tracing()
    
    def _setup_tracing(self):
        """Set up OpenTelemetry tracing"""
        # Create resource with service information
        resource = Resource(attributes={
            SERVICE_NAME: self.service_name,
            SERVICE_VERSION: self.service_version,
            "environment": os.getenv("ENVIRONMENT", "development"),
        })
        
        # Create tracer provider
        provider = TracerProvider(resource=resource)
        
        # Create OTLP exporter
        otlp_exporter = OTLPSpanExporter(
            endpoint=self.otlp_endpoint,
            insecure=True  # Use insecure for development, configure TLS for production
        )
        
        # Add span processor
        provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        
        # Set global tracer provider
        trace.set_tracer_provider(provider)
    
    def instrument_app(self, app: FastAPI):
        """
        Instrument FastAPI application with tracing.
        
        Args:
            app: FastAPI application instance
        """
        if not self.enabled:
            return
        
        # Instrument FastAPI
        FastAPIInstrumentor.instrument_app(
            app,
            excluded_urls="/health,/ready,/metrics"  # Exclude health check endpoints
        )
        
        # Instrument SQLAlchemy
        SQLAlchemyInstrumentor().instrument()
        
        # Instrument Redis
        RedisInstrumentor().instrument()
        
        # Instrument HTTP requests
        RequestsInstrumentor().instrument()
    
    @staticmethod
    def get_tracer(name: str = __name__):
        """
        Get a tracer instance.
        
        Args:
            name: Name of the tracer
            
        Returns:
            Tracer instance
        """
        return trace.get_tracer(name)
    
    @staticmethod
    def get_current_span():
        """Get the current active span"""
        return trace.get_current_span()
    
    @staticmethod
    def add_span_attributes(**attributes):
        """
        Add attributes to the current span.
        
        Args:
            **attributes: Key-value pairs to add as span attributes
        """
        span = trace.get_current_span()
        if span:
            for key, value in attributes.items():
                span.set_attribute(key, value)
    
    @staticmethod
    def add_span_event(name: str, attributes: Optional[dict] = None):
        """
        Add an event to the current span.
        
        Args:
            name: Event name
            attributes: Optional event attributes
        """
        span = trace.get_current_span()
        if span:
            span.add_event(name, attributes=attributes or {})
    
    @staticmethod
    def set_span_status(status_code: StatusCode, description: Optional[str] = None):
        """
        Set the status of the current span.
        
        Args:
            status_code: Status code (OK, ERROR, UNSET)
            description: Optional status description
        """
        span = trace.get_current_span()
        if span:
            span.set_status(Status(status_code, description))
    
    @staticmethod
    def record_exception(exception: Exception):
        """
        Record an exception in the current span.
        
        Args:
            exception: Exception to record
        """
        span = trace.get_current_span()
        if span:
            span.record_exception(exception)
            span.set_status(Status(StatusCode.ERROR, str(exception)))


# Global tracing configuration
tracing_config: Optional[TracingConfig] = None


def init_tracing(
    app: FastAPI,
    service_name: str = "xcodereview-backend",
    service_version: str = "0.1.0",
    otlp_endpoint: Optional[str] = None,
    enabled: bool = True
):
    """
    Initialize distributed tracing for the application.
    
    Args:
        app: FastAPI application instance
        service_name: Name of the service
        service_version: Version of the service
        otlp_endpoint: OTLP collector endpoint
        enabled: Whether tracing is enabled
    """
    global tracing_config
    
    tracing_config = TracingConfig(
        service_name=service_name,
        service_version=service_version,
        otlp_endpoint=otlp_endpoint,
        enabled=enabled
    )
    
    tracing_config.instrument_app(app)


def get_tracer(name: str = __name__):
    """Get a tracer instance"""
    return TracingConfig.get_tracer(name)


def get_current_span():
    """Get the current active span"""
    return TracingConfig.get_current_span()


def add_span_attributes(**attributes):
    """Add attributes to the current span"""
    TracingConfig.add_span_attributes(**attributes)


def add_span_event(name: str, attributes: Optional[dict] = None):
    """Add an event to the current span"""
    TracingConfig.add_span_event(name, attributes)


def set_span_status(status_code: StatusCode, description: Optional[str] = None):
    """Set the status of the current span"""
    TracingConfig.set_span_status(status_code, description)


def record_exception(exception: Exception):
    """Record an exception in the current span"""
    TracingConfig.record_exception(exception)


# Trace context propagator for cross-service tracing
propagator = TraceContextTextMapPropagator()
