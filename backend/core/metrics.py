"""
Metrics Collection

Provides Prometheus metrics for monitoring.
"""

from prometheus_client import Counter, Histogram, Gauge
from typing import Dict, Any


# HTTP Metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

# Database Metrics
db_connections_active = Gauge(
    'db_connections_active',
    'Active database connections'
)

db_query_duration_seconds = Histogram(
    'db_query_duration_seconds',
    'Database query duration in seconds',
    ['query_type']
)

# LLM Metrics
llm_requests_total = Counter(
    'llm_requests_total',
    'Total LLM API requests',
    ['provider', 'model']
)

llm_tokens_used = Counter(
    'llm_tokens_used',
    'Total tokens used',
    ['provider', 'model', 'type']
)

llm_request_duration_seconds = Histogram(
    'llm_request_duration_seconds',
    'LLM request duration in seconds',
    ['provider', 'model']
)

# Celery Metrics
celery_tasks_total = Counter(
    'celery_tasks_total',
    'Total Celery tasks',
    ['task_name', 'status']
)

celery_task_duration_seconds = Histogram(
    'celery_task_duration_seconds',
    'Celery task duration in seconds',
    ['task_name']
)

celery_queue_length = Gauge(
    'celery_queue_length',
    'Celery queue length',
    ['queue_name']
)

# Circuit Breaker Metrics
circuit_breaker_state = Gauge(
    'circuit_breaker_state',
    'Circuit breaker state (0=closed, 1=open, 2=half_open)',
    ['service']
)


class Metrics:
    """Metrics collection and management"""
    
    def __init__(self):
        self.http_requests = http_requests_total
        self.http_duration = http_request_duration_seconds
        self.db_connections = db_connections_active
        self.db_query_duration = db_query_duration_seconds
        self.llm_requests = llm_requests_total
        self.llm_tokens = llm_tokens_used
        self.llm_duration = llm_request_duration_seconds
        self.celery_tasks = celery_tasks_total
        self.celery_duration = celery_task_duration_seconds
        self.celery_queue = celery_queue_length
        self.circuit_breaker = circuit_breaker_state
    
    def record_http_request(self, method: str, endpoint: str, status: int, duration: float):
        """Record HTTP request metrics"""
        self.http_requests.labels(method=method, endpoint=endpoint, status=status).inc()
        self.http_duration.labels(method=method, endpoint=endpoint).observe(duration)
    
    def record_db_query(self, query_type: str, duration: float):
        """Record database query metrics"""
        self.db_query_duration.labels(query_type=query_type).observe(duration)
    
    def record_llm_request(
        self,
        provider: str,
        model: str,
        duration: float,
        tokens_used: Dict[str, int]
    ):
        """Record LLM request metrics"""
        self.llm_requests.labels(provider=provider, model=model).inc()
        self.llm_duration.labels(provider=provider, model=model).observe(duration)
        
        for token_type, count in tokens_used.items():
            self.llm_tokens.labels(
                provider=provider,
                model=model,
                type=token_type
            ).inc(count)
    
    def record_celery_task(self, task_name: str, status: str, duration: float):
        """Record Celery task metrics"""
        self.celery_tasks.labels(task_name=task_name, status=status).inc()
        self.celery_duration.labels(task_name=task_name).observe(duration)
    
    def set_db_connections(self, count: int):
        """Set active database connections"""
        self.db_connections.set(count)
    
    def set_queue_length(self, queue_name: str, length: int):
        """Set Celery queue length"""
        self.celery_queue.labels(queue_name=queue_name).set(length)
    
    def set_circuit_breaker_state(self, service: str, state: int):
        """Set circuit breaker state"""
        self.circuit_breaker.labels(service=service).set(state)


# Global metrics instance
metrics = Metrics()
