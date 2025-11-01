# Monitoring and Observability Guide

This guide explains how to set up and use the monitoring and observability stack for XCodeReviewer backend.

## Overview

The monitoring stack includes:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Metrics visualization and dashboards
- **Alertmanager**: Alert routing and management
- **Jaeger**: Distributed tracing
- **Structured Logging**: JSON-formatted logs with correlation IDs

## Quick Start

### 1. Start Monitoring Stack

```bash
# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Check service status
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Access UIs

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Jaeger**: http://localhost:16686

### 3. Configure Backend

Update your `.env` file:

```bash
# Enable monitoring
PROMETHEUS_PORT=9090
TRACING_ENABLED=true
OTLP_ENDPOINT=http://localhost:4317

# Optional: Sentry for error tracking
SENTRY_DSN=your-sentry-dsn
```

## Metrics

### Available Metrics

#### HTTP Metrics
- `http_requests_total`: Total HTTP requests (labels: method, endpoint, status_code)
- `http_request_duration_seconds`: Request duration histogram
- `http_request_size_bytes`: Request size histogram
- `http_response_size_bytes`: Response size histogram

#### Agent Metrics
- `agent_calls_total`: Total agent calls (labels: agent_name, status)
- `agent_call_duration_seconds`: Agent call duration histogram
- `agent_tokens_total`: Total tokens processed (labels: agent_name, type)

#### LLM Metrics
- `llm_calls_total`: Total LLM API calls (labels: provider, model, status)
- `llm_call_duration_seconds`: LLM call duration histogram
- `llm_tokens_total`: Total tokens used (labels: provider, model, type)
- `llm_cost_total`: Total LLM cost in USD (labels: provider, model)

#### Circuit Breaker Metrics
- `circuit_breaker_state`: Circuit breaker state (0=closed, 1=open, 2=half_open)
- `circuit_breaker_failures_total`: Total failures
- `circuit_breaker_successes_total`: Total successes

#### Database Metrics
- `database_connections_active`: Active database connections
- `database_query_duration_seconds`: Query duration histogram

#### Cache Metrics
- `cache_operations_total`: Total cache operations (labels: operation, status)
- `cache_operation_duration_seconds`: Cache operation duration histogram

### Querying Metrics

#### Prometheus Queries

```promql
# Request rate per endpoint
rate(http_requests_total[5m])

# Error rate
sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# 95th percentile response time
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# LLM cost per hour
sum(increase(llm_cost_total[1h])) by (provider)

# Cache hit rate
sum(rate(cache_operations_total{operation="get",status="hit"}[5m])) / sum(rate(cache_operations_total{operation="get"}[5m]))
```

### Recording Custom Metrics

```python
from core.metrics import metrics

# Record HTTP request
metrics.record_request(
    method="POST",
    endpoint="/api/analyze",
    status_code=200,
    duration=1.5,
    request_size=1024,
    response_size=2048
)

# Record agent call
metrics.record_agent_call(
    agent_name="code_quality",
    duration=5.2,
    status="success",
    input_tokens=500,
    output_tokens=300
)

# Record LLM call
metrics.record_llm_call(
    provider="openai",
    model="gpt-4",
    duration=3.5,
    status="success",
    prompt_tokens=400,
    completion_tokens=200,
    cost=0.012
)

# Record circuit breaker state
metrics.record_circuit_breaker_state("llm_provider", "open")

# Record database query
metrics.record_db_query("select", 0.05)

# Record cache operation
metrics.record_cache_operation("get", "hit", 0.001)
```

## Alerting

### Alert Rules

Alerts are defined in `monitoring/prometheus_rules.yml`:

#### API Alerts
- **HighErrorRate**: Error rate > 5% for 2 minutes
- **VeryHighErrorRate**: Error rate > 20% for 1 minute
- **HighResponseTime**: 95th percentile > 2s for 5 minutes
- **LowRequestRate**: Request rate < 0.1 req/s for 5 minutes

#### Agent Alerts
- **HighAgentFailureRate**: Agent failure rate > 10% for 3 minutes
- **SlowAgentResponse**: 95th percentile > 30s for 5 minutes

#### LLM Alerts
- **HighLLMFailureRate**: LLM failure rate > 15% for 3 minutes
- **HighLLMCost**: Cost > $10/hour for 5 minutes
- **VeryHighLLMCost**: Cost > $50/hour for 1 minute

#### Circuit Breaker Alerts
- **CircuitBreakerOpen**: Circuit breaker open for 2 minutes
- **HighCircuitBreakerFailures**: Failure rate > 1/s for 3 minutes

#### Database Alerts
- **HighDatabaseConnections**: Active connections > 25 for 5 minutes
- **SlowDatabaseQueries**: 95th percentile > 1s for 5 minutes

#### Cache Alerts
- **LowCacheHitRate**: Hit rate < 50% for 10 minutes
- **HighCacheErrorRate**: Error rate > 5% for 3 minutes

### Configuring Notifications

Edit `monitoring/alertmanager.yml`:

#### Slack Notifications

```yaml
receivers:
  - name: 'slack-alerts'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: |
          {{ range .Alerts }}
          *Alert:* {{ .Labels.alertname }}
          *Severity:* {{ .Labels.severity }}
          *Summary:* {{ .Annotations.summary }}
          *Description:* {{ .Annotations.description }}
          {{ end }}
```

#### Email Notifications

```yaml
receivers:
  - name: 'email-alerts'
    email_configs:
      - to: 'team@example.com'
        from: 'alertmanager@example.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alertmanager@example.com'
        auth_password: 'your-app-password'
```

#### PagerDuty Integration

```yaml
receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: 'your-pagerduty-service-key'
        description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'
```

## Structured Logging

### Log Format

All logs are in JSON format with the following fields:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "message": "request_completed",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user123",
  "session_id": "session456",
  "method": "POST",
  "path": "/api/analyze",
  "status_code": 200,
  "duration": 1.234
}
```

### Using Structured Logging

```python
from core.logging import log_info, log_error, log_warning

# Basic logging
log_info("operation_completed", result_count=10)

# Error logging
log_error("operation_failed", error=str(e), user_id=user_id)

# Warning logging
log_warning("rate_limit_approaching", current_rate=45, limit=50)

# Specialized logging
from core.logging import log_agent_call, log_llm_call

log_agent_call("code_quality", duration=5.2, status="success")
log_llm_call("openai", "gpt-4", duration=3.5, tokens=600, cost=0.012)
```

### Log Aggregation

For production, use a log aggregation service:

#### ELK Stack (Elasticsearch, Logstash, Kibana)

```yaml
# docker-compose.logging.yml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5000:5000"

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
```

#### Loki (Grafana Loki)

```yaml
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - ./logs:/var/log
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
```

## Distributed Tracing

See [tracing.md](./tracing.md) for detailed tracing documentation.

### Quick Example

```python
from core.tracing import get_tracer

tracer = get_tracer(__name__)

def process_request():
    with tracer.start_as_current_span("process_request") as span:
        span.set_attribute("user.id", user_id)
        
        # Your code here
        result = do_work()
        
        span.add_event("processing_completed")
        return result
```

## Grafana Dashboards

### Creating Custom Dashboards

1. Open Grafana at http://localhost:3001
2. Click "+" → "Dashboard"
3. Add panels with Prometheus queries
4. Save dashboard

### Example Dashboard Panels

#### Request Rate
```promql
sum(rate(http_requests_total[5m])) by (endpoint)
```

#### Error Rate
```promql
sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

#### Response Time (95th percentile)
```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint))
```

#### LLM Cost Over Time
```promql
sum(increase(llm_cost_total[1h])) by (provider)
```

## Best Practices

### 1. Metric Naming

- Use descriptive names: `http_request_duration_seconds` not `req_time`
- Follow Prometheus conventions: `<namespace>_<name>_<unit>`
- Use consistent labels across related metrics

### 2. Alert Thresholds

- Set thresholds based on historical data
- Use `for` clause to avoid flapping alerts
- Create both warning and critical severity levels

### 3. Log Levels

- **DEBUG**: Detailed diagnostic information
- **INFO**: General informational messages
- **WARNING**: Warning messages for potentially harmful situations
- **ERROR**: Error messages for serious problems

### 4. Sensitive Data

- Never log passwords, tokens, or API keys
- Mask sensitive data in logs (already implemented)
- Use correlation IDs instead of user IDs when possible

### 5. Performance

- Use sampling for high-traffic endpoints
- Batch metric updates when possible
- Set appropriate retention periods

## Troubleshooting

### High Cardinality Metrics

Problem: Too many unique label combinations

Solution:
- Limit label values (e.g., use `/api/users/{id}` not actual IDs)
- Use recording rules to pre-aggregate
- Increase Prometheus storage

### Missing Metrics

Problem: Metrics not appearing in Prometheus

Solution:
1. Check `/metrics` endpoint is accessible
2. Verify Prometheus scrape config
3. Check for metric name typos
4. Ensure labels are consistent

### Alert Fatigue

Problem: Too many alerts firing

Solution:
- Adjust thresholds based on actual usage
- Use inhibition rules to suppress related alerts
- Group related alerts together
- Set appropriate `for` durations

## Production Checklist

- [ ] Prometheus retention configured (default: 15 days)
- [ ] Alertmanager notifications configured
- [ ] Grafana dashboards created
- [ ] Log aggregation set up
- [ ] Tracing enabled and tested
- [ ] Alert thresholds tuned
- [ ] On-call rotation configured
- [ ] Runbooks created for common alerts
- [ ] Backup strategy for metrics data
- [ ] Security: Authentication enabled on all UIs

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Structured Logging Best Practices](https://www.structlog.org/en/stable/)
