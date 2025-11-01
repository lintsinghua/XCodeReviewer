# Distributed Tracing Guide

This document explains how to use distributed tracing in the XCodeReviewer backend.

## Overview

The application uses OpenTelemetry for distributed tracing, which allows you to:
- Track requests across multiple services
- Identify performance bottlenecks
- Debug complex distributed systems
- Monitor service dependencies

## Configuration

### Environment Variables

```bash
# Enable/disable tracing
TRACING_ENABLED=true

# OTLP collector endpoint (Jaeger, Tempo, etc.)
OTLP_ENDPOINT=http://localhost:4317

# Optional: Direct Jaeger endpoint
JAEGER_ENDPOINT=http://localhost:14268/api/traces
```

### Docker Compose Setup

Add Jaeger to your `docker-compose.yml`:

```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # Jaeger UI
      - "4317:4317"    # OTLP gRPC receiver
      - "4318:4318"    # OTLP HTTP receiver
    environment:
      - COLLECTOR_OTLP_ENABLED=true
```

## Usage

### Automatic Instrumentation

The following are automatically instrumented:
- FastAPI endpoints (HTTP requests/responses)
- SQLAlchemy database queries
- Redis operations
- HTTP requests via `requests` library

### Manual Instrumentation

#### Creating Custom Spans

```python
from core.tracing import get_tracer

tracer = get_tracer(__name__)

def my_function():
    with tracer.start_as_current_span("my_operation") as span:
        # Your code here
        span.set_attribute("custom.attribute", "value")
        
        # Do some work
        result = perform_operation()
        
        # Add events
        span.add_event("operation_completed", {
            "result_count": len(result)
        })
        
        return result
```

#### Adding Attributes to Current Span

```python
from core.tracing import add_span_attributes

def process_request(user_id: str, project_id: str):
    # Add custom attributes to the current span
    add_span_attributes(
        user_id=user_id,
        project_id=project_id,
        operation="process_request"
    )
    
    # Your code here
```

#### Recording Events

```python
from core.tracing import add_span_event

def analyze_code(code: str):
    add_span_event("analysis_started", {
        "code_length": len(code),
        "language": "python"
    })
    
    # Perform analysis
    result = analyze(code)
    
    add_span_event("analysis_completed", {
        "issues_found": len(result.issues)
    })
    
    return result
```

#### Recording Exceptions

```python
from core.tracing import record_exception
from opentelemetry.trace import StatusCode

def risky_operation():
    try:
        # Your code here
        result = perform_operation()
        return result
    except Exception as e:
        # Record the exception in the trace
        record_exception(e)
        raise
```

#### Setting Span Status

```python
from core.tracing import set_span_status
from opentelemetry.trace import StatusCode

def validate_input(data: dict):
    if not data.get("required_field"):
        set_span_status(
            StatusCode.ERROR,
            "Missing required field"
        )
        raise ValueError("Missing required field")
    
    set_span_status(StatusCode.OK)
    return True
```

### Tracing LLM Calls

```python
from core.tracing import get_tracer
from opentelemetry.trace import StatusCode

tracer = get_tracer(__name__)

async def call_llm(prompt: str, model: str):
    with tracer.start_as_current_span("llm_call") as span:
        span.set_attribute("llm.provider", "openai")
        span.set_attribute("llm.model", model)
        span.set_attribute("llm.prompt_length", len(prompt))
        
        try:
            response = await llm_client.complete(prompt, model)
            
            span.set_attribute("llm.response_length", len(response))
            span.set_attribute("llm.tokens", response.usage.total_tokens)
            span.set_status(StatusCode.OK)
            
            return response
        except Exception as e:
            span.record_exception(e)
            span.set_status(StatusCode.ERROR, str(e))
            raise
```

### Tracing Agent Operations

```python
from core.tracing import get_tracer, add_span_attributes

tracer = get_tracer(__name__)

class CodeReviewAgent:
    async def analyze(self, code: str):
        with tracer.start_as_current_span("agent_analyze") as span:
            span.set_attribute("agent.name", "code_review")
            span.set_attribute("code.length", len(code))
            
            # Parse code
            with tracer.start_as_current_span("parse_code"):
                ast = parse_code(code)
            
            # Call LLM
            with tracer.start_as_current_span("llm_analysis"):
                analysis = await self.llm.analyze(ast)
            
            # Generate report
            with tracer.start_as_current_span("generate_report"):
                report = self.generate_report(analysis)
            
            span.set_attribute("issues.count", len(report.issues))
            
            return report
```

## Viewing Traces

### Jaeger UI

1. Open http://localhost:16686 in your browser
2. Select "xcodereview-backend" from the service dropdown
3. Click "Find Traces" to see recent traces
4. Click on a trace to see detailed span information

### Trace Analysis

Look for:
- **Long spans**: Identify slow operations
- **Error spans**: Find failed operations
- **Span relationships**: Understand service dependencies
- **Custom attributes**: Debug with contextual information

## Best Practices

### 1. Meaningful Span Names

```python
# Good
with tracer.start_as_current_span("analyze_python_code"):
    pass

# Bad
with tracer.start_as_current_span("operation"):
    pass
```

### 2. Add Relevant Attributes

```python
span.set_attribute("user.id", user_id)
span.set_attribute("project.id", project_id)
span.set_attribute("file.path", file_path)
span.set_attribute("file.size", file_size)
```

### 3. Record Important Events

```python
span.add_event("cache_miss")
span.add_event("fallback_triggered", {"reason": "circuit_breaker_open"})
span.add_event("retry_attempt", {"attempt": 2, "max_attempts": 3})
```

### 4. Always Record Exceptions

```python
try:
    result = risky_operation()
except Exception as e:
    span.record_exception(e)
    span.set_status(StatusCode.ERROR)
    raise
```

### 5. Use Context Propagation

When making HTTP requests to other services:

```python
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

propagator = TraceContextTextMapPropagator()
headers = {}
propagator.inject(headers)

response = requests.get(url, headers=headers)
```

## Performance Considerations

### Sampling

For high-traffic applications, configure sampling:

```python
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased

# Sample 10% of traces
sampler = TraceIdRatioBased(0.1)
```

### Batch Processing

Spans are batched before export to reduce overhead:

```python
from opentelemetry.sdk.trace.export import BatchSpanProcessor

processor = BatchSpanProcessor(
    exporter,
    max_queue_size=2048,
    schedule_delay_millis=5000,
    max_export_batch_size=512
)
```

## Troubleshooting

### Traces Not Appearing

1. Check `TRACING_ENABLED=true` in environment
2. Verify OTLP endpoint is accessible
3. Check Jaeger/collector logs
4. Ensure firewall allows port 4317

### High Overhead

1. Reduce sampling rate
2. Increase batch size
3. Disable tracing for health checks (already done)
4. Use async exporters

### Missing Spans

1. Ensure proper context propagation
2. Check for exceptions in span creation
3. Verify instrumentation is loaded
4. Check span processor queue size

## Integration with Metrics

Combine tracing with metrics for complete observability:

```python
from core.metrics import metrics
from core.tracing import get_tracer

tracer = get_tracer(__name__)

async def process_request():
    with tracer.start_as_current_span("process_request") as span:
        start_time = time.time()
        
        try:
            result = await do_work()
            
            # Record metrics
            metrics.record_request(
                method="POST",
                endpoint="/api/process",
                status_code=200,
                duration=time.time() - start_time
            )
            
            span.set_status(StatusCode.OK)
            return result
        except Exception as e:
            metrics.record_request(
                method="POST",
                endpoint="/api/process",
                status_code=500,
                duration=time.time() - start_time
            )
            
            span.record_exception(e)
            span.set_status(StatusCode.ERROR)
            raise
```

## References

- [OpenTelemetry Python Documentation](https://opentelemetry.io/docs/instrumentation/python/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Distributed Tracing Best Practices](https://opentelemetry.io/docs/concepts/signals/traces/)
