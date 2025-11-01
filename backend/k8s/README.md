# Kubernetes Deployment

This directory contains Kubernetes manifests for deploying XCodeReviewer backend.

## Directory Structure

```
k8s/
├── base/                      # Base Kubernetes resources
│   ├── configmap.yaml        # Application configuration
│   ├── secret.yaml           # Sensitive credentials (template)
│   ├── deployment.yaml       # Backend deployment
│   ├── service.yaml          # Kubernetes service
│   ├── ingress.yaml          # Ingress configuration
│   ├── pvc.yaml              # Persistent volume claims
│   ├── serviceaccount.yaml   # Service account and RBAC
│   ├── hpa.yaml              # Horizontal Pod Autoscaler
│   ├── pdb.yaml              # Pod Disruption Budget
│   └── kustomization.yaml    # Kustomize base config
├── overlays/                  # Environment-specific overlays
│   ├── dev/                  # Development environment
│   ├── staging/              # Staging environment
│   └── prod/                 # Production environment
└── docs/                      # Documentation
    ├── port-configuration.md
    └── secret-rotation.md
```

## Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- kustomize (or kubectl with kustomize support)
- Container registry access
- Storage class configured (for PVCs)

## Quick Start

### 1. Build and Push Docker Image

```bash
# Build image
docker build -t xcodereview/backend:v2.0.0 .

# Tag for registry
docker tag xcodereview/backend:v2.0.0 your-registry.com/xcodereview/backend:v2.0.0

# Push to registry
docker push your-registry.com/xcodereview/backend:v2.0.0
```

### 2. Create Namespace

```bash
# Development
kubectl create namespace xcodereview-dev

# Staging
kubectl create namespace xcodereview-staging

# Production
kubectl create namespace xcodereview-prod
```

### 3. Configure Secrets

**Option A: Manual Secret Creation**

```bash
# Create secret from file
kubectl create secret generic xcodereview-backend-secrets \
  --from-env-file=.env.production \
  --namespace=xcodereview-prod
```

**Option B: Using Sealed Secrets (Recommended)**

```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Create sealed secret
kubeseal --format=yaml < k8s/base/secret.yaml > k8s/base/sealed-secret.yaml

# Apply sealed secret
kubectl apply -f k8s/base/sealed-secret.yaml
```

**Option C: Using External Secrets Operator (Recommended for Cloud)**

See [secret-rotation.md](docs/secret-rotation.md) for details.

### 4. Deploy Application

**Development:**
```bash
kubectl apply -k k8s/overlays/dev
```

**Staging:**
```bash
kubectl apply -k k8s/overlays/staging
```

**Production:**
```bash
kubectl apply -k k8s/overlays/prod
```

### 5. Verify Deployment

```bash
# Check pods
kubectl get pods -n xcodereview-prod

# Check services
kubectl get svc -n xcodereview-prod

# Check ingress
kubectl get ingress -n xcodereview-prod

# Check logs
kubectl logs -l app=xcodereview-backend -n xcodereview-prod --tail=100
```

## Configuration

### Environment Variables

Configure via ConfigMap (`k8s/base/configmap.yaml`):

```yaml
data:
  PORT: "8000"
  LOG_LEVEL: "INFO"
  # ... other config
```

### Secrets

Configure via Secret (`k8s/base/secret.yaml`):

```yaml
stringData:
  DATABASE_URL: "postgresql+asyncpg://..."
  SECRET_KEY: "your-secret-key"
  # ... other secrets
```

### Resource Limits

Configure in Deployment (`k8s/base/deployment.yaml`):

```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi
```

### Autoscaling

Configure in HPA (`k8s/base/hpa.yaml`):

```yaml
spec:
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## Ingress Configuration

### Nginx Ingress Controller

```bash
# Install Nginx Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.0/deploy/static/provider/cloud/deploy.yaml

# Verify installation
kubectl get pods -n ingress-nginx
```

### AWS ALB Ingress Controller

```bash
# Install AWS Load Balancer Controller
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=your-cluster-name
```

### TLS/SSL Configuration

**Option A: cert-manager (Recommended)**

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

**Option B: Manual Certificate**

```bash
# Create TLS secret
kubectl create secret tls xcodereview-tls-cert \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem \
  --namespace=xcodereview-prod
```

## Monitoring

### Prometheus Integration

The deployment includes Prometheus annotations:

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8000"
  prometheus.io/path: "/metrics"
```

### Grafana Dashboards

Import dashboards from `monitoring/grafana/dashboards/`.

### Jaeger Tracing

Configure OTLP endpoint in ConfigMap:

```yaml
data:
  TRACING_ENABLED: "true"
  OTLP_ENDPOINT: "http://jaeger-collector:4317"
```

## Maintenance

### Rolling Updates

```bash
# Update image
kubectl set image deployment/xcodereview-backend \
  backend=xcodereview/backend:v2.0.1 \
  -n xcodereview-prod

# Check rollout status
kubectl rollout status deployment/xcodereview-backend -n xcodereview-prod

# Rollback if needed
kubectl rollout undo deployment/xcodereview-backend -n xcodereview-prod
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment xcodereview-backend --replicas=5 -n xcodereview-prod

# Check HPA status
kubectl get hpa -n xcodereview-prod
```

### Database Migrations

```bash
# Run migrations as a Job
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  namespace: xcodereview-prod
spec:
  template:
    spec:
      containers:
        - name: migration
          image: xcodereview/backend:v2.0.0
          command: ["alembic", "upgrade", "head"]
          envFrom:
            - configMapRef:
                name: xcodereview-backend-config
            - secretRef:
                name: xcodereview-backend-secrets
      restartPolicy: Never
  backoffLimit: 3
EOF

# Check job status
kubectl get jobs -n xcodereview-prod
kubectl logs job/db-migration -n xcodereview-prod
```

### Backup and Restore

```bash
# Backup database
kubectl exec -it deployment/postgres -n xcodereview-prod -- \
  pg_dump -U xcodereviewer xcodereviewer > backup.sql

# Restore database
kubectl exec -i deployment/postgres -n xcodereview-prod -- \
  psql -U xcodereviewer xcodereviewer < backup.sql
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n xcodereview-prod

# Check events
kubectl get events -n xcodereview-prod --sort-by='.lastTimestamp'

# Check logs
kubectl logs <pod-name> -n xcodereview-prod
```

### Service Not Accessible

```bash
# Check service endpoints
kubectl get endpoints xcodereview-backend -n xcodereview-prod

# Test service from within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://xcodereview-backend.xcodereview-prod.svc.cluster.local/health
```

### Ingress Issues

```bash
# Check ingress
kubectl describe ingress xcodereview-backend -n xcodereview-prod

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

### Database Connection Issues

```bash
# Test database connectivity
kubectl exec -it deployment/xcodereview-backend -n xcodereview-prod -- \
  python -c "from db.session import engine; print('DB OK')"

# Check database logs
kubectl logs deployment/postgres -n xcodereview-prod
```

## Security Best Practices

1. **Use RBAC**: Limit service account permissions
2. **Network Policies**: Restrict pod-to-pod communication
3. **Pod Security Standards**: Enforce security contexts
4. **Secret Management**: Use external secret managers
5. **Image Scanning**: Scan images for vulnerabilities
6. **TLS Everywhere**: Use TLS for all communications
7. **Resource Limits**: Set appropriate resource limits
8. **Regular Updates**: Keep Kubernetes and images updated

## Performance Tuning

### Resource Optimization

```yaml
# Adjust based on load testing
resources:
  requests:
    cpu: 1000m      # Guaranteed CPU
    memory: 1Gi     # Guaranteed memory
  limits:
    cpu: 2000m      # Max CPU
    memory: 2Gi     # Max memory
```

### Connection Pooling

```yaml
# Increase database pool size for high traffic
data:
  DATABASE_POOL_SIZE: "30"
  DATABASE_MAX_OVERFLOW: "20"
```

### Caching

```yaml
# Increase Redis connections
data:
  REDIS_MAX_CONNECTIONS: "100"
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Kubernetes

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build and push image
        run: |
          docker build -t ${{ secrets.REGISTRY }}/xcodereview/backend:${{ github.sha }} .
          docker push ${{ secrets.REGISTRY }}/xcodereview/backend:${{ github.sha }}
      
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/xcodereview-backend \
            backend=${{ secrets.REGISTRY }}/xcodereview/backend:${{ github.sha }} \
            -n xcodereview-prod
```

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kustomize Documentation](https://kustomize.io/)
- [Helm Charts](https://helm.sh/)
- [cert-manager](https://cert-manager.io/)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [External Secrets Operator](https://external-secrets.io/)
