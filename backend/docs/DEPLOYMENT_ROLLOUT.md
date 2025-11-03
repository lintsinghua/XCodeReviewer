# XCodeReviewer Deployment & Rollout Procedures

## Overview

This document outlines the complete deployment and rollout procedures for XCodeReviewer's backend architecture migration, including staging deployment, production rollout, monitoring, and rollback procedures.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Staging Deployment](#staging-deployment)
- [Production Rollout Strategy](#production-rollout-strategy)
- [Monitoring & Validation](#monitoring--validation)
- [Rollback Procedures](#rollback-procedures)
- [Post-Deployment Tasks](#post-deployment-tasks)
- [Incident Response](#incident-response)

---

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (unit, integration, E2E)
- [ ] Test coverage ≥ 80%
- [ ] Code review completed and approved
- [ ] No critical security vulnerabilities
- [ ] Performance benchmarks met

### Documentation
- [ ] API documentation updated
- [ ] Deployment guide reviewed
- [ ] Runbook updated
- [ ] Change log prepared
- [ ] User-facing documentation ready

### Infrastructure
- [ ] Database migrations tested
- [ ] Backup procedures verified
- [ ] Monitoring alerts configured
- [ ] Resource limits set
- [ ] Secrets rotated

### Team Readiness
- [ ] Team trained on new architecture
- [ ] On-call schedule confirmed
- [ ] Communication plan ready
- [ ] Rollback plan reviewed
- [ ] Stakeholders notified

---

## Staging Deployment

### Phase 1: Infrastructure Setup

#### 1.1 Database Setup
```bash
# Create staging database
kubectl apply -f k8s/staging/postgres-pvc.yaml
kubectl apply -f k8s/staging/postgres-deployment.yaml
kubectl apply -f k8s/staging/postgres-service.yaml

# Verify database is running
kubectl get pods -l app=postgres -n staging
kubectl logs -f deployment/postgres -n staging

# Run migrations
kubectl exec -it deployment/backend -n staging -- alembic upgrade head

# Verify migrations
kubectl exec -it deployment/postgres -n staging -- \
  psql -U xcodereviewer -d xcodereviewer -c "\dt"
```

#### 1.2 Redis Setup
```bash
# Deploy Redis
kubectl apply -f k8s/staging/redis-deployment.yaml
kubectl apply -f k8s/staging/redis-service.yaml

# Verify Redis
kubectl get pods -l app=redis -n staging
kubectl exec -it deployment/redis -n staging -- redis-cli ping
```

#### 1.3 Storage Setup
```bash
# Deploy MinIO (S3-compatible storage)
kubectl apply -f k8s/staging/minio-pvc.yaml
kubectl apply -f k8s/staging/minio-deployment.yaml
kubectl apply -f k8s/staging/minio-service.yaml

# Create buckets
kubectl exec -it deployment/minio -n staging -- \
  mc mb local/xcodereviewer-reports
```

### Phase 2: Application Deployment

#### 2.1 Backend API
```bash
# Create ConfigMap and Secrets
kubectl create configmap backend-config \
  --from-env-file=.env.staging \
  -n staging

kubectl create secret generic backend-secrets \
  --from-env-file=.env.staging.secrets \
  -n staging

# Deploy backend
kubectl apply -f k8s/staging/backend-deployment.yaml
kubectl apply -f k8s/staging/backend-service.yaml
kubectl apply -f k8s/staging/backend-ingress.yaml

# Verify deployment
kubectl get pods -l app=backend -n staging
kubectl logs -f deployment/backend -n staging

# Check health endpoint
curl https://staging-api.your-domain.com/health
```

#### 2.2 Celery Workers
```bash
# Deploy Celery workers
kubectl apply -f k8s/staging/celery-worker-deployment.yaml

# Verify workers
kubectl get pods -l app=celery-worker -n staging
kubectl logs -f deployment/celery-worker -n staging

# Check worker status
kubectl exec -it deployment/celery-worker -n staging -- \
  celery -A tasks.celery_app inspect active
```

#### 2.3 Celery Beat (Scheduler)
```bash
# Deploy Celery Beat
kubectl apply -f k8s/staging/celery-beat-deployment.yaml

# Verify scheduler
kubectl get pods -l app=celery-beat -n staging
kubectl logs -f deployment/celery-beat -n staging
```

### Phase 3: Monitoring Setup

#### 3.1 Prometheus & Grafana
```bash
# Deploy monitoring stack
kubectl apply -f k8s/staging/monitoring/prometheus-config.yaml
kubectl apply -f k8s/staging/monitoring/prometheus-deployment.yaml
kubectl apply -f k8s/staging/monitoring/grafana-deployment.yaml

# Import dashboards
kubectl apply -f k8s/staging/monitoring/grafana-dashboards.yaml

# Access Grafana
kubectl port-forward svc/grafana 3000:3000 -n staging
# Open http://localhost:3000
```

#### 3.2 Log Aggregation
```bash
# Deploy Loki for log aggregation
kubectl apply -f k8s/staging/monitoring/loki-deployment.yaml

# Configure log shipping
kubectl apply -f k8s/staging/monitoring/promtail-daemonset.yaml
```

### Phase 4: Validation

#### 4.1 Smoke Tests
```bash
# Run smoke tests
cd backend
pytest tests/smoke/ -v

# Test API endpoints
./scripts/test_staging_api.sh

# Test WebSocket connection
./scripts/test_websocket.sh staging-api.your-domain.com
```

#### 4.2 Load Testing
```bash
# Run load tests with k6
k6 run tests/load/api_load_test.js \
  --vus 50 \
  --duration 5m \
  --env BASE_URL=https://staging-api.your-domain.com

# Monitor during load test
watch kubectl top pods -n staging
```

#### 4.3 E2E Testing
```bash
# Run E2E workflow tests
pytest tests/test_e2e_workflows.py -v --env=staging

# Verify all workflows pass
./scripts/verify_e2e.sh
```

---

## Production Rollout Strategy

### Rollout Approach: Phased Canary Deployment

We'll use a phased canary deployment with feature flags to gradually roll out the new backend to production users.

### Phase 1: Infrastructure Preparation (Week 1)

#### Day 1-2: Database Setup
```bash
# Create production database with replication
kubectl apply -f k8s/production/postgres-statefulset.yaml
kubectl apply -f k8s/production/postgres-service.yaml

# Set up read replicas
kubectl apply -f k8s/production/postgres-replica-statefulset.yaml

# Configure backup
kubectl apply -f k8s/production/postgres-backup-cronjob.yaml

# Run migrations (during maintenance window)
kubectl exec -it postgres-0 -n production -- \
  psql -U xcodereviewer -d xcodereviewer < migrations/production.sql

# Verify replication
kubectl exec -it postgres-0 -n production -- \
  psql -U xcodereviewer -c "SELECT * FROM pg_stat_replication;"
```

#### Day 3-4: Cache & Queue Setup
```bash
# Deploy Redis cluster
kubectl apply -f k8s/production/redis-cluster.yaml

# Verify cluster
kubectl exec -it redis-0 -n production -- redis-cli cluster info

# Deploy Redis Sentinel for HA
kubectl apply -f k8s/production/redis-sentinel.yaml
```

#### Day 5: Storage & Monitoring
```bash
# Configure S3 buckets (or MinIO)
aws s3 mb s3://xcodereviewer-reports-prod
aws s3 mb s3://xcodereviewer-backups-prod

# Deploy monitoring
kubectl apply -f k8s/production/monitoring/

# Configure alerts
kubectl apply -f k8s/production/monitoring/alert-rules.yaml
```

### Phase 2: Canary Deployment (Week 2)

#### Day 1: Deploy Canary (5% traffic)
```bash
# Deploy canary version
kubectl apply -f k8s/production/backend-canary-deployment.yaml

# Configure traffic split (5% to canary)
kubectl apply -f k8s/production/backend-virtual-service.yaml

# Monitor canary metrics
kubectl logs -f deployment/backend-canary -n production
```

**Canary Configuration:**
```yaml
# k8s/production/backend-virtual-service.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: backend
spec:
  hosts:
  - api.your-domain.com
  http:
  - match:
    - headers:
        x-canary:
          exact: "true"
    route:
    - destination:
        host: backend-canary
        port:
          number: 8000
  - route:
    - destination:
        host: backend-stable
        port:
          number: 8000
      weight: 95
    - destination:
        host: backend-canary
        port:
          number: 8000
      weight: 5
```

**Monitoring Checklist:**
- [ ] Error rate < 0.1%
- [ ] P95 latency < 500ms
- [ ] No database connection issues
- [ ] No memory leaks
- [ ] Celery tasks completing successfully

#### Day 2-3: Increase to 25% traffic
```bash
# Update traffic split
kubectl patch virtualservice backend -n production \
  --type merge \
  -p '{"spec":{"http":[{"route":[{"destination":{"host":"backend-stable"},"weight":75},{"destination":{"host":"backend-canary"},"weight":25}]}]}}'

# Monitor for 48 hours
./scripts/monitor_canary.sh
```

#### Day 4-5: Increase to 50% traffic
```bash
# Update traffic split to 50/50
kubectl patch virtualservice backend -n production \
  --type merge \
  -p '{"spec":{"http":[{"route":[{"destination":{"host":"backend-stable"},"weight":50},{"destination":{"host":"backend-canary"},"weight":50}]}]}}'

# Continue monitoring
```

### Phase 3: Full Rollout (Week 3)

#### Day 1: 100% Canary Traffic
```bash
# Route all traffic to canary
kubectl patch virtualservice backend -n production \
  --type merge \
  -p '{"spec":{"http":[{"route":[{"destination":{"host":"backend-canary"},"weight":100}]}]}}'

# Monitor for 24 hours
```

#### Day 2: Promote Canary to Stable
```bash
# Update stable deployment with canary version
kubectl set image deployment/backend-stable \
  backend=your-registry/backend:v2.0.0 \
  -n production

# Scale up stable
kubectl scale deployment/backend-stable --replicas=10 -n production

# Route traffic back to stable
kubectl patch virtualservice backend -n production \
  --type merge \
  -p '{"spec":{"http":[{"route":[{"destination":{"host":"backend-stable"},"weight":100}]}]}}'

# Remove canary deployment
kubectl delete deployment backend-canary -n production
```

#### Day 3-5: Frontend Migration

**Enable Feature Flags Gradually:**

```typescript
// src/shared/config/featureFlags.ts
export const featureFlags = {
  useBackendAPI: {
    enabled: true,
    rolloutPercentage: 100, // Gradually increase: 10 -> 25 -> 50 -> 100
    allowedUsers: [], // Beta users first
  },
};
```

**Rollout Schedule:**
- Day 3: 10% of users (beta testers)
- Day 4: 50% of users
- Day 5: 100% of users

```bash
# Update feature flag configuration
kubectl create configmap frontend-config \
  --from-file=featureFlags.json \
  -n production \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart frontend pods to pick up new config
kubectl rollout restart deployment/frontend -n production
```

### Phase 4: Data Migration (Week 4)

#### Day 1-2: Migrate Historical Data
```bash
# Run data migration script
kubectl exec -it deployment/backend -n production -- \
  python scripts/migrate_indexeddb_data.py \
  --batch-size 1000 \
  --dry-run

# Verify migration plan
# Run actual migration
kubectl exec -it deployment/backend -n production -- \
  python scripts/migrate_indexeddb_data.py \
  --batch-size 1000
```

#### Day 3-4: Validation
```bash
# Validate migrated data
kubectl exec -it deployment/backend -n production -- \
  python scripts/validate_migration.py

# Compare counts
kubectl exec -it postgres-0 -n production -- \
  psql -U xcodereviewer -c "SELECT COUNT(*) FROM projects;"
```

#### Day 5: Cleanup
```bash
# Remove IndexedDB migration code (after 30 days)
# Keep for rollback capability initially
```

---

## Monitoring & Validation

### Key Metrics to Monitor

#### Application Metrics
```promql
# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Request latency (P95)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active connections
sum(backend_active_connections)

# Celery queue length
celery_queue_length{queue="default"}

# Task success rate
rate(celery_task_success_total[5m]) / rate(celery_task_total[5m])
```

#### Infrastructure Metrics
```promql
# CPU usage
rate(container_cpu_usage_seconds_total[5m])

# Memory usage
container_memory_usage_bytes / container_spec_memory_limit_bytes

# Database connections
pg_stat_database_numbackends

# Redis memory
redis_memory_used_bytes / redis_memory_max_bytes
```

### Alerts Configuration

```yaml
# k8s/production/monitoring/alert-rules.yaml
groups:
- name: backend_alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      
  - alert: HighLatency
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "High latency detected"
      
  - alert: DatabaseConnectionPoolExhausted
    expr: pg_stat_database_numbackends > 90
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Database connection pool nearly exhausted"
      
  - alert: CeleryQueueBacklog
    expr: celery_queue_length > 1000
    for: 15m
    labels:
      severity: warning
    annotations:
      summary: "Large Celery queue backlog"
```

### Validation Checklist

After each rollout phase:

- [ ] Error rate within acceptable limits (< 0.1%)
- [ ] Latency within SLA (P95 < 500ms)
- [ ] No increase in customer support tickets
- [ ] Database performance stable
- [ ] No memory leaks detected
- [ ] Celery tasks processing normally
- [ ] WebSocket connections stable
- [ ] Report generation working
- [ ] All integrations functional
- [ ] Monitoring dashboards showing green

---

## Rollback Procedures

### Automatic Rollback Triggers

Automatic rollback will be triggered if:
- Error rate > 1% for 5 minutes
- P95 latency > 2 seconds for 10 minutes
- Database connection failures > 10% for 5 minutes
- Critical alert fired

### Manual Rollback Decision

Consider manual rollback if:
- Data corruption detected
- Security vulnerability discovered
- Critical functionality broken
- Customer impact severe

### Rollback Execution

#### Level 1: Traffic Rollback (Fastest - 2 minutes)
```bash
# Immediately route all traffic back to stable version
kubectl patch virtualservice backend -n production \
  --type merge \
  -p '{"spec":{"http":[{"route":[{"destination":{"host":"backend-stable"},"weight":100}]}]}}'

# Verify traffic shifted
kubectl get virtualservice backend -n production -o yaml

# Monitor error rate
watch 'kubectl logs deployment/backend-stable -n production | grep ERROR | tail -20'
```

#### Level 2: Deployment Rollback (5 minutes)
```bash
# Rollback to previous deployment
kubectl rollout undo deployment/backend -n production

# Check rollout status
kubectl rollout status deployment/backend -n production

# Verify pods running previous version
kubectl get pods -l app=backend -n production \
  -o jsonpath='{.items[*].spec.containers[*].image}'
```

#### Level 3: Database Rollback (30 minutes)
```bash
# Restore from backup (if migrations need reversal)
# Stop application first
kubectl scale deployment/backend --replicas=0 -n production

# Restore database
kubectl exec -it postgres-0 -n production -- \
  pg_restore -U xcodereviewer -d xcodereviewer \
  /backups/pre-migration-backup.dump

# Verify restoration
kubectl exec -it postgres-0 -n production -- \
  psql -U xcodereviewer -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;"

# Restart application
kubectl scale deployment/backend --replicas=10 -n production
```

#### Level 4: Full System Rollback (1-2 hours)
```bash
# Complete rollback to previous architecture
# 1. Disable feature flags
kubectl create configmap frontend-config \
  --from-literal=USE_BACKEND_API=false \
  -n production \
  --dry-run=client -o yaml | kubectl apply -f -

# 2. Rollback all services
kubectl rollout undo deployment/backend -n production
kubectl rollout undo deployment/celery-worker -n production
kubectl rollout undo deployment/frontend -n production

# 3. Restore database
# (See Level 3 above)

# 4. Verify all services
./scripts/verify_rollback.sh

# 5. Notify stakeholders
./scripts/send_rollback_notification.sh
```

### Post-Rollback Actions

1. **Immediate (0-1 hour)**
   - [ ] Verify system stability
   - [ ] Notify stakeholders
   - [ ] Update status page
   - [ ] Begin incident investigation

2. **Short-term (1-24 hours)**
   - [ ] Root cause analysis
   - [ ] Document lessons learned
   - [ ] Fix identified issues
   - [ ] Update rollback procedures

3. **Long-term (1-7 days)**
   - [ ] Implement fixes
   - [ ] Enhanced testing
   - [ ] Update deployment plan
   - [ ] Schedule retry

---

## Post-Deployment Tasks

### Week 1: Intensive Monitoring
- [ ] Monitor all metrics 24/7
- [ ] Daily team sync meetings
- [ ] Review support tickets
- [ ] Check performance trends
- [ ] Validate data integrity

### Week 2-4: Stabilization
- [ ] Optimize performance bottlenecks
- [ ] Fine-tune resource limits
- [ ] Update documentation
- [ ] Collect user feedback
- [ ] Plan improvements

### Month 2: Optimization
- [ ] Analyze usage patterns
- [ ] Optimize database queries
- [ ] Tune cache settings
- [ ] Review and adjust scaling policies
- [ ] Cost optimization

### Month 3: Cleanup
- [ ] Remove old code paths
- [ ] Clean up feature flags
- [ ] Archive old documentation
- [ ] Update training materials
- [ ] Celebrate success! 🎉

---

## Incident Response

### Severity Levels

**P0 - Critical**
- Complete service outage
- Data loss or corruption
- Security breach
- Response time: Immediate
- Escalation: CTO, CEO

**P1 - High**
- Major feature broken
- Significant performance degradation
- Affecting >50% of users
- Response time: 15 minutes
- Escalation: Engineering Manager

**P2 - Medium**
- Minor feature broken
- Affecting <50% of users
- Workaround available
- Response time: 1 hour
- Escalation: Team Lead

**P3 - Low**
- Cosmetic issues
- Minimal user impact
- Response time: Next business day
- Escalation: None

### Incident Response Process

1. **Detection** (0-5 min)
   - Alert triggered or user report
   - Verify incident
   - Assess severity
   - Create incident ticket

2. **Response** (5-15 min)
   - Assemble incident team
   - Establish communication channel
   - Begin investigation
   - Update status page

3. **Mitigation** (15-60 min)
   - Implement temporary fix
   - Consider rollback
   - Verify mitigation
   - Monitor stability

4. **Resolution** (1-24 hours)
   - Implement permanent fix
   - Deploy fix
   - Verify resolution
   - Close incident

5. **Post-Mortem** (1-7 days)
   - Root cause analysis
   - Document timeline
   - Identify improvements
   - Update procedures

### Communication Templates

#### Status Page Update
```
[INVESTIGATING] We are currently investigating reports of [issue description].
Updates will be provided every 30 minutes.

[IDENTIFIED] We have identified the root cause as [description].
Working on a fix. ETA: [time]

[MONITORING] A fix has been deployed. Monitoring for stability.

[RESOLVED] The issue has been resolved. All systems operational.
```

#### Internal Communication
```
Incident: [Title]
Severity: [P0/P1/P2/P3]
Status: [Investigating/Identified/Monitoring/Resolved]
Impact: [Description]
Current Actions: [What we're doing]
Next Update: [Time]
Incident Commander: [Name]
```

---

## Deployment Checklist Summary

### Pre-Deployment
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Team trained
- [ ] Stakeholders notified
- [ ] Backup verified
- [ ] Rollback plan ready

### Deployment
- [ ] Infrastructure deployed
- [ ] Database migrated
- [ ] Application deployed
- [ ] Monitoring configured
- [ ] Smoke tests passed
- [ ] Load tests passed

### Post-Deployment
- [ ] Metrics within SLA
- [ ] No critical errors
- [ ] User feedback positive
- [ ] Documentation updated
- [ ] Team debriefed
- [ ] Lessons learned documented

---

## Contact Information

### Deployment Team
- **Deployment Lead**: John Doe (john@your-domain.com)
- **Database Admin**: Jane Smith (jane@your-domain.com)
- **DevOps Lead**: Bob Johnson (bob@your-domain.com)
- **On-Call Engineer**: See PagerDuty schedule

### Emergency Contacts
- **Engineering Manager**: +1-555-0101
- **CTO**: +1-555-0102
- **CEO**: +1-555-0103

### Communication Channels
- **Slack**: #deployment-prod
- **Incident Channel**: #incident-response
- **Status Page**: https://status.your-domain.com
- **PagerDuty**: https://your-org.pagerduty.com

---

**Good luck with the deployment!** 🚀

*Last updated: 2024*
*Version: 1.0*
