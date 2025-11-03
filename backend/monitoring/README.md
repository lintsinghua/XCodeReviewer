# Monitoring Stack

This directory contains configuration files for the XCodeReviewer monitoring and observability stack.

## Quick Start

```bash
# Start monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f

# Stop services
docker-compose -f docker-compose.monitoring.yml down
```

## Services

### Prometheus (Port 9090)
- Metrics collection and storage
- Access: http://localhost:9090
- Config: `prometheus.yml`
- Rules: `prometheus_rules.yml`

### Grafana (Port 3001)
- Metrics visualization
- Access: http://localhost:3001
- Default credentials: admin/admin
- Datasources: `grafana/datasources/`
- Dashboards: `grafana/dashboards/`

### Alertmanager (Port 9093)
- Alert routing and management
- Access: http://localhost:9093
- Config: `alertmanager.yml`

### Jaeger (Port 16686)
- Distributed tracing
- Access: http://localhost:16686
- OTLP endpoint: localhost:4317

## Configuration Files

```
monitoring/
├── prometheus.yml          # Prometheus configuration
├── prometheus_rules.yml    # Alert rules
├── alertmanager.yml        # Alert routing configuration
└── grafana/
    ├── datasources/        # Grafana datasource configs
    │   └── prometheus.yml
    └── dashboards/         # Grafana dashboard configs
        └── dashboard.yml
```

## Metrics Endpoint

The backend exposes metrics at:
```
http://localhost:8000/metrics
```

## Alert Configuration

Edit `alertmanager.yml` to configure notification channels:

### Slack
```yaml
slack_configs:
  - api_url: 'YOUR_WEBHOOK_URL'
    channel: '#alerts'
```

### Email
```yaml
email_configs:
  - to: 'team@example.com'
    from: 'alerts@example.com'
    smarthost: 'smtp.gmail.com:587'
```

### PagerDuty
```yaml
pagerduty_configs:
  - service_key: 'YOUR_SERVICE_KEY'
```

## Custom Dashboards

1. Open Grafana at http://localhost:3001
2. Login with admin/admin
3. Create new dashboard
4. Add panels with Prometheus queries
5. Save dashboard

Example queries:
```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# Response time (95th percentile)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

## Troubleshooting

### Prometheus not scraping metrics
1. Check backend is running: `curl http://localhost:8000/metrics`
2. Check Prometheus targets: http://localhost:9090/targets
3. Verify network connectivity between containers

### Alerts not firing
1. Check alert rules: http://localhost:9090/alerts
2. Verify Alertmanager config: http://localhost:9093
3. Check Alertmanager logs: `docker logs xcodereview-alertmanager`

### Jaeger not receiving traces
1. Verify OTLP endpoint is accessible
2. Check backend environment: `TRACING_ENABLED=true`
3. Check Jaeger logs: `docker logs xcodereview-jaeger`

## Documentation

For detailed documentation, see:
- [Monitoring Guide](../docs/monitoring.md)
- [Tracing Guide](../docs/tracing.md)

## Production Considerations

- [ ] Configure persistent storage for Prometheus data
- [ ] Set up remote storage for long-term metrics
- [ ] Configure authentication for Grafana
- [ ] Set up SSL/TLS for all services
- [ ] Configure backup strategy
- [ ] Set up log rotation
- [ ] Configure resource limits
- [ ] Set up high availability (if needed)
