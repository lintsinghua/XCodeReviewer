# Deployment Guide

This guide covers deploying XCodeReviewer in different environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Compose Deployment](#docker-compose-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Migration](#database-migration)
- [Monitoring Setup](#monitoring-setup)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- Python 3.11+
- PostgreSQL 15+ (production) or SQLite (development)
- Redis 7+
- Docker & Docker Compose (for containerized deployment)
- Kubernetes cluster (for production deployment)

### Required Accounts

- LLM Provider API keys (OpenAI, Anthropic, etc.)
- GitHub/GitLab tokens (for repository scanning)
- MinIO/S3 storage (for production)

## Local Development

### 1. Clone Repository

```bash
git clone https://github.com/your-org/xcodereviewer.git
cd xcodereviewer/backend
```

### 2. Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 5. Initialize Database

```bash
# Run migrations
alembic upgrade head

# Create initial admin user
python scripts/create_admin.py
```

### 6. Start Services

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Backend
uvicorn app.main:app --reload --port 8000

# Terminal 3: Start Celery Worker
celery -A tasks.celery_app worker --loglevel=info

# Terminal 4: Start Celery Beat (optional)
celery -A tasks.celery_app beat --loglevel=info
```

### 7. Access Application

- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Docker Compose Deployment

### Development Environment

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### Services Included

- **Backend API**: http://localhost:8000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **MinIO**: http://localhost:9000 (Console: http://localhost:9001)
- **Flower**: http://localhost:5555
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001

### Initial Setup

```bash
# Run migrations
docker-compose -f docker-compose.dev.yml exec backend alembic upgrade head

# Create admin user
docker-compose -f docker-compose.dev.yml exec backend python scripts/create_admin.py
```

## Kubernetes Deployment

### 1. Prerequisites

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Verify cluster access
kubectl cluster-info
```

### 2. Create Namespace

```bash
kubectl create namespace xcodereviewer
```

### 3. Configure Secrets

```bash
# Copy example secrets
cp k8s/secrets.yaml.example k8s/secrets.yaml

# Edit with actual values
nano k8s/secrets.yaml

# Apply secrets
kubectl apply -f k8s/secrets.yaml
```

### 4. Apply ConfigMaps

```bash
kubectl apply -f k8s/configmap.yaml
```

### 5. Deploy Application

```bash
# Deploy backend and workers
kubectl apply -f k8s/deployment.yaml

# Create services
kubectl apply -f k8s/service.yaml

# Configure ingress
kubectl apply -f k8s/ingress.yaml
```

### 6. Verify Deployment

```bash
# Check pods
kubectl get pods -n xcodereviewer

# Check services
kubectl get svc -n xcodereviewer

# Check ingress
kubectl get ingress -n xcodereviewer

# View logs
kubectl logs -f deployment/xcodereviewer-backend -n xcodereviewer
```

### 7. Run Migrations

```bash
# Get pod name
POD=$(kubectl get pod -n xcodereviewer -l component=backend -o jsonpath="{.items[0].metadata.name}")

# Run migrations
kubectl exec -it $POD -n xcodereviewer -- alembic upgrade head

# Create admin user
kubectl exec -it $POD -n xcodereviewer -- python scripts/create_admin.py
```

## Environment Configuration

### Development

```bash
# Use .env.development
cp .env.development .env
```

Key settings:
- `APP_ENV=development`
- `DEBUG=true`
- `DATABASE_URL=sqlite+aiosqlite:///./dev.db`
- `LLM_MODE=mock`

### Production

```bash
# Use .env.production
cp .env.production .env
```

Key settings:
- `APP_ENV=production`
- `DEBUG=false`
- `DATABASE_URL=postgresql+asyncpg://...`
- `LLM_MODE=production`
- Enable monitoring and error tracking

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for complete documentation.

## Database Migration

### Create Migration

```bash
# Auto-generate migration
alembic revision --autogenerate -m "Description of changes"

# Review generated migration
cat alembic/versions/xxx_description.py
```

### Apply Migration

```bash
# Upgrade to latest
alembic upgrade head

# Upgrade to specific version
alembic upgrade <revision>

# Downgrade one version
alembic downgrade -1
```

### Backup Database

```bash
# PostgreSQL backup
pg_dump -h localhost -U postgres xcodereviewer_prod > backup.sql

# Restore
psql -h localhost -U postgres xcodereviewer_prod < backup.sql
```

## Monitoring Setup

### Prometheus

1. Configure scrape targets in `monitoring/prometheus.yml`
2. Access Prometheus: http://localhost:9090
3. View metrics: http://localhost:8000/metrics

### Grafana

1. Access Grafana: http://localhost:3001
2. Login: admin/admin
3. Add Prometheus datasource
4. Import dashboards from `monitoring/grafana/dashboards/`

### Sentry (Error Tracking)

```bash
# Set Sentry DSN in environment
export SENTRY_DSN=https://...@sentry.io/...

# Restart application
```

## Troubleshooting

### Database Connection Issues

```bash
# Check database is running
docker-compose ps postgres

# Test connection
psql -h localhost -U postgres -d xcodereviewer_dev

# View logs
docker-compose logs postgres
```

### Redis Connection Issues

```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli ping

# View logs
docker-compose logs redis
```

### Celery Worker Issues

```bash
# Check worker status
celery -A tasks.celery_app inspect active

# Restart worker
docker-compose restart celery-worker

# View worker logs
docker-compose logs -f celery-worker
```

### Application Errors

```bash
# View application logs
docker-compose logs -f backend

# Check health endpoint
curl http://localhost:8000/health

# Check readiness
curl http://localhost:8000/ready
```

### Kubernetes Issues

```bash
# Check pod status
kubectl get pods -n xcodereviewer

# Describe pod
kubectl describe pod <pod-name> -n xcodereviewer

# View logs
kubectl logs <pod-name> -n xcodereviewer

# Get events
kubectl get events -n xcodereviewer --sort-by='.lastTimestamp'
```

## Performance Tuning

### Database

```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Add indexes
CREATE INDEX idx_tasks_status ON audit_tasks(status);
CREATE INDEX idx_issues_severity ON audit_issues(severity);
```

### Redis

```bash
# Monitor Redis
redis-cli monitor

# Check memory usage
redis-cli info memory

# Clear cache
redis-cli FLUSHDB
```

### Application

```python
# Enable query logging
DATABASE_ECHO=true

# Adjust worker count
WORKERS=4  # (2 * CPU_CORES) + 1

# Tune connection pool
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Generate secure SECRET_KEY and JWT_SECRET_KEY
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategy
- [ ] Review CORS settings
- [ ] Enable Sentry error tracking
- [ ] Set up log rotation
- [ ] Configure SSL certificates
- [ ] Enable database encryption
- [ ] Set up VPN for database access

## Maintenance

### Regular Tasks

- **Daily**: Monitor logs and metrics
- **Weekly**: Review error reports, check disk space
- **Monthly**: Update dependencies, rotate secrets
- **Quarterly**: Security audit, performance review

### Updates

```bash
# Update dependencies
pip install --upgrade -r requirements.txt

# Run tests
pytest

# Apply migrations
alembic upgrade head

# Restart services
docker-compose restart
```

## Support

For additional help:
- Documentation: `/docs`
- Issues: GitHub Issues
- Email: support@your-domain.com
