"""
Metrics Middleware

Collects and exposes Prometheus metrics for monitoring.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import time


class MetricsMiddleware(BaseHTTPMiddleware):
    """
    Middleware for collecting HTTP metrics.
    
    Tracks:
    - Request count
    - Request duration
    - Response status codes
    """
    
    async def dispatch(self, request: Request, call_next):
        """Process request and collect metrics"""
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log metrics (in production, send to Prometheus)
        # For now, just pass through
        
        return response
