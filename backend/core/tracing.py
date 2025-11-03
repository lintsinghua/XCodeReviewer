"""Tracing Module (No-op Implementation)
OpenTelemetry has been removed. This module provides no-op stubs for compatibility.
"""
from typing import Optional, Any
from contextlib import contextmanager


class NoOpSpan:
    """No-operation span for compatibility"""
    
    def set_attribute(self, key: str, value: Any):
        """No-op set attribute"""
        pass
    
    def add_event(self, name: str, attributes: Optional[dict] = None):
        """No-op add event"""
        pass
    
    def set_status(self, status: Any):
        """No-op set status"""
        pass
    
    def record_exception(self, exception: Exception):
        """No-op record exception"""
        pass
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        pass


class NoOpTracer:
    """No-operation tracer for compatibility"""
    
    @contextmanager
    def start_as_current_span(self, name: str):
        """No-op context manager that yields a no-op span"""
        yield NoOpSpan()


def get_tracer(name: str = __name__):
    """Get a no-op tracer instance"""
    return NoOpTracer()


def get_current_span():
    """Get a no-op span"""
    return NoOpSpan()


def add_span_attributes(**attributes):
    """No-op add span attributes"""
    pass


def add_span_event(name: str, attributes: Optional[dict] = None):
    """No-op add span event"""
    pass


def set_span_status(status_code: Any, description: Optional[str] = None):
    """No-op set span status"""
    pass


def record_exception(exception: Exception):
    """No-op record exception"""
    pass


# Dummy classes for compatibility
class TracingConfig:
    """Dummy tracing configuration"""
    pass


class StatusCode:
    """Dummy status code enum"""
    OK = "OK"
    ERROR = "ERROR"
    UNSET = "UNSET"


# No-op propagator
class NoOpPropagator:
    """No-op propagator"""
    pass


propagator = NoOpPropagator()
tracing_config: Optional[TracingConfig] = None
