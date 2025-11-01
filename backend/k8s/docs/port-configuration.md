# Port Configuration Guide

This document describes all service ports used by XCodeReviewer and how to configure them.

## Default Port Assignments

### Application Services

| Service | Port | Protocol | Purpose | Configurable |
|---------|------|----------|---------|--------------|
| Backend API | 8000 | HTTP | Main API endpoint | Yes (PORT env var) |
| Prometheus Metrics | 8000 | HTTP | /metrics endpoint | Same as API |
| PostgreSQL | 5432 | TCP | Database connection | Yes |
| Redis | 6379 | TCP | Cache and message broker | Yes |
| MinIO API | 9000 | HTTP | Object storage API | Yes |
| MinIO Console | 9001 | HTTP | MinIO web UI | Yes |
| Celery Flower | 5555 | HTTP | Task monitoring UI | Yes |
| Qdrant | 6333 | HTTP | Vector database API | Yes |
| Qdrant gRPC | 6334 | gRPC | Vector database gRPC | Yes |

### Monitoring Services

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Prometheus | 9090 | HTTP | Metrics collection |
| Grafana | 3001 | HTTP | Metrics visualization |
| Alertmanager | 9093 | HTTP | Alert management |
| Jaeger UI | 16686 | HTTP | Tracing UI |
| Jaeger Collector (HTTP) | 14268 | HTTP | Trace collection |
| Jaeger Collector (gRPC) | 14250 | gRPC | Trace collection |
| OTLP gRPC | 4317 | gRPC | OpenTelemetry collector |
| OTLP HTTP | 4318 | HTTP | OpenTelemetry collector |
| Redis Exporter | 9121 | HTTP | Redis metrics |
| Postgres Exporter | 9187 | HTTP | PostgreSQL metrics |

## Configuration Methods

### 1. Environment Variables

Configure ports using environment variables:

```bash
# Backend API
export PORT=8000
export HOST=0.0.0.0

# Database
export DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/xcodereviewer

# Redis
export REDIS_URL=redis://localhost:6379/0

# MinIO
export MINIO_ENDPOINT=localhost:9000

# Qdrant
export QDRANT_URL=http://localhost:6333
```

### 2. Docker Compose Port Mapping

Override ports in `docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  backend:
    ports:
      - "8080:8000"  # Map host port 8080 to container port 8000
  
  postgres:
    ports:
      - "5433:5432"  # Use alternative port 5433 on host
  
  redis:
    ports:
      - "6380:6379"  # Use alternative port 6380 on host
  
  minio:
    ports:
      - "9100:9000"  # MinIO API on port 9100
      - "9101:9001"  # MinIO Console on port 9101
```

### 3. Kubernetes Service Configuration

Override ports in Kubernetes Service:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: xcodereview-backend
spec:
  type: ClusterIP
  ports:
    - port: 8080        # Service port (internal cluster)
      targetPort: 8000  # Container port
      protocol: TCP
      name: http
```

### 4. Kubernetes ConfigMap

Configure application ports via ConfigMap:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: xcodereview-backend-config
data:
  PORT: "8000"
  HOST: "0.0.0.0"
```

## Port Conflict Resolution

### Scenario 1: Port Already in Use

If a port is already in use on your system:

**Option A: Change Host Port (Docker Compose)**
```yaml
services:
  backend:
    ports:
      - "8001:8000"  # Use 8001 on host instead of 8000
```

**Option B: Change Application Port**
```bash
# .env file
PORT=8001
```

**Option C: Stop Conflicting Service**
```bash
# Find process using port
lsof -i :8000
# or
netstat -tulpn | grep 8000

# Kill process
kill -9 <PID>
```

### Scenario 2: Multiple Environments on Same Host

Use different port ranges for each environment:

**Development (8000-8099)**
```yaml
# docker-compose.dev.yml
services:
  backend:
    ports:
      - "8000:8000"
  postgres:
    ports:
      - "5432:5432"
```

**Staging (8100-8199)**
```yaml
# docker-compose.staging.yml
services:
  backend:
    ports:
      - "8100:8000"
  postgres:
    ports:
      - "5532:5432"
```

**Production (8200-8299)**
```yaml
# docker-compose.prod.yml
services:
  backend:
    ports:
      - "8200:8000"
  postgres:
    ports:
      - "5632:5432"
```

### Scenario 3: Kubernetes Port Conflicts

In Kubernetes, services use cluster-internal IPs, so port conflicts are rare. However:

**Option A: Use Different Namespaces**
```bash
# Development
kubectl create namespace xcodereview-dev

# Staging
kubectl create namespace xcodereview-staging

# Production
kubectl create namespace xcodereview-prod
```

**Option B: Use Different Service Names**
```yaml
# Development
apiVersion: v1
kind: Service
metadata:
  name: xcodereview-backend-dev
  namespace: xcodereview-dev

# Staging
apiVersion: v1
kind: Service
metadata:
  name: xcodereview-backend-staging
  namespace: xcodereview-staging
```

## Port Security

### 1. Firewall Rules

Only expose necessary ports:

```bash
# Allow only backend API
sudo ufw allow 8000/tcp

# Block direct database access from outside
sudo ufw deny 5432/tcp

# Allow monitoring (restrict to internal network)
sudo ufw allow from 10.0.0.0/8 to any port 9090
```

### 2. Kubernetes Network Policies

Restrict port access between pods:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-network-policy
spec:
  podSelector:
    matchLabels:
      app: xcodereview-backend
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow traffic from ingress controller
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8000
    # Allow traffic from monitoring
    - from:
        - namespaceSelector:
            matchLabels:
              name: monitoring
      ports:
        - protocol: TCP
          port: 8000
  egress:
    # Allow database access
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
    # Allow Redis access
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - protocol: TCP
          port: 6379
    # Allow DNS
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: UDP
          port: 53
```

### 3. Service Mesh (Istio)

Use service mesh for advanced traffic management:

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
spec:
  mtls:
    mode: STRICT  # Require mTLS for all traffic
```

## Testing Port Configuration

### 1. Check Port Availability

```bash
# Check if port is available
nc -zv localhost 8000

# Check all listening ports
netstat -tulpn | grep LISTEN

# Check Docker container ports
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

### 2. Test Service Connectivity

```bash
# Test HTTP endpoint
curl http://localhost:8000/health

# Test database connection
psql -h localhost -p 5432 -U xcodereviewer -d xcodereviewer

# Test Redis connection
redis-cli -h localhost -p 6379 ping

# Test MinIO connection
mc alias set local http://localhost:9000 minioadmin minioadmin
mc ls local
```

### 3. Kubernetes Port Forwarding

```bash
# Forward backend API port
kubectl port-forward svc/xcodereview-backend 8000:80

# Forward database port
kubectl port-forward svc/postgres 5432:5432

# Forward multiple ports
kubectl port-forward svc/xcodereview-backend 8000:80 9090:9090
```

## Common Port Issues

### Issue 1: "Address already in use"

**Cause**: Another process is using the port

**Solution**:
```bash
# Find and kill process
lsof -ti:8000 | xargs kill -9

# Or change port in configuration
```

### Issue 2: "Connection refused"

**Cause**: Service not listening on expected port

**Solution**:
```bash
# Check service is running
docker ps
kubectl get pods

# Check service logs
docker logs xcodereview-backend
kubectl logs -l app=xcodereview-backend

# Verify port configuration
docker inspect xcodereview-backend | grep -A 10 Ports
kubectl describe svc xcodereview-backend
```

### Issue 3: "Cannot connect to database"

**Cause**: Wrong port or host in connection string

**Solution**:
```bash
# Verify database URL
echo $DATABASE_URL

# Test connection
psql "$DATABASE_URL"

# Check database is listening
docker exec xcodereview-postgres pg_isready
```

### Issue 4: Kubernetes Service Not Accessible

**Cause**: Service selector doesn't match pod labels

**Solution**:
```bash
# Check service endpoints
kubectl get endpoints xcodereview-backend

# Verify pod labels match service selector
kubectl get pods --show-labels
kubectl describe svc xcodereview-backend
```

## Port Configuration Examples

### Example 1: Development with Custom Ports

```bash
# .env.development
PORT=8001
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5433/xcodereviewer
REDIS_URL=redis://localhost:6380/0
MINIO_ENDPOINT=localhost:9100
```

### Example 2: Production with Standard Ports

```bash
# .env.production
PORT=8000
DATABASE_URL=postgresql+asyncpg://user:pass@postgres.internal:5432/xcodereviewer
REDIS_URL=redis://redis.internal:6379/0
MINIO_ENDPOINT=minio.internal:9000
```

### Example 3: Multi-Tenant Setup

```bash
# Tenant 1
PORT=8000
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/tenant1

# Tenant 2
PORT=8001
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/tenant2

# Tenant 3
PORT=8002
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/tenant3
```

## Best Practices

1. **Use Standard Ports in Production**: Stick to default ports (8000, 5432, 6379) in production
2. **Document Custom Ports**: Always document any non-standard port configurations
3. **Use Environment Variables**: Make ports configurable via environment variables
4. **Avoid Port Conflicts**: Use different port ranges for different environments
5. **Secure Sensitive Ports**: Don't expose database/cache ports to the internet
6. **Use Service Discovery**: In Kubernetes, use service names instead of hardcoded ports
7. **Test Port Changes**: Always test after changing port configurations
8. **Monitor Port Usage**: Set up alerts for port connectivity issues
9. **Use Load Balancers**: Don't expose application ports directly in production
10. **Document Firewall Rules**: Keep firewall rules documented and version controlled

## References

- [Docker Compose Networking](https://docs.docker.com/compose/networking/)
- [Kubernetes Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Kubernetes Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Port Forwarding](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/)
