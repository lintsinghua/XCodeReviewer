# Secret Rotation Guide

This document describes the process for rotating secrets in the XCodeReviewer backend.

## Overview

Regular secret rotation is a security best practice that helps:
- Limit the impact of compromised credentials
- Comply with security policies
- Reduce the window of vulnerability

## Rotation Schedule

| Secret Type | Rotation Frequency | Priority |
|-------------|-------------------|----------|
| JWT Secret Key | Every 90 days | High |
| Database Password | Every 90 days | High |
| LLM API Keys | Every 180 days | Medium |
| Encryption Key | Every 180 days | High |
| MinIO/S3 Keys | Every 90 days | Medium |
| GitHub/GitLab Tokens | Every 180 days | Low |

## Prerequisites

- Access to Kubernetes cluster
- kubectl configured with appropriate permissions
- Backup of current secrets
- Maintenance window scheduled (for critical secrets)

## Rotation Procedures

### 1. JWT Secret Key Rotation

**Impact**: All existing JWT tokens will be invalidated. Users will need to re-authenticate.

**Steps**:

```bash
# 1. Generate new secret key
NEW_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# 2. Create new secret (keep old one temporarily)
kubectl create secret generic xcodereview-backend-secrets-new \
  --from-literal=SECRET_KEY="$NEW_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Update deployment to use new secret
kubectl set env deployment/xcodereview-backend \
  SECRET_KEY="$NEW_SECRET"

# 4. Wait for rollout to complete
kubectl rollout status deployment/xcodereview-backend

# 5. Verify application is working
kubectl logs -l app=xcodereview-backend --tail=50

# 6. Delete old secret after grace period (24 hours)
kubectl delete secret xcodereview-backend-secrets-old
```

### 2. Database Password Rotation

**Impact**: Database connections will be temporarily disrupted during rotation.

**Steps**:

```bash
# 1. Create new database user with new password
psql -h $DB_HOST -U postgres -c "CREATE USER xcodereviewer_new WITH PASSWORD 'new_secure_password';"
psql -h $DB_HOST -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE xcodereviewer TO xcodereviewer_new;"

# 2. Update secret with new credentials
NEW_DB_URL="postgresql+asyncpg://xcodereviewer_new:new_secure_password@postgres:5432/xcodereviewer"
kubectl create secret generic xcodereview-backend-secrets \
  --from-literal=DATABASE_URL="$NEW_DB_URL" \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Restart pods to pick up new secret
kubectl rollout restart deployment/xcodereview-backend

# 4. Wait for rollout
kubectl rollout status deployment/xcodereview-backend

# 5. Verify database connectivity
kubectl exec -it deployment/xcodereview-backend -- python -c "from db.session import engine; print('DB OK')"

# 6. Drop old database user after grace period
psql -h $DB_HOST -U postgres -c "DROP USER xcodereviewer_old;"
```

### 3. LLM API Key Rotation

**Impact**: Minimal - LLM calls will use new keys immediately.

**Steps**:

```bash
# 1. Generate new API key from provider (OpenAI, Gemini, etc.)
# Visit provider's dashboard to create new key

# 2. Update secret
kubectl create secret generic xcodereview-backend-secrets \
  --from-literal=OPENAI_API_KEY="sk-new-key-here" \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Restart pods
kubectl rollout restart deployment/xcodereview-backend

# 4. Verify LLM calls are working
kubectl logs -l app=xcodereview-backend | grep "llm_call"

# 5. Revoke old API key from provider dashboard
```

### 4. Encryption Key Rotation

**Impact**: High - Requires re-encryption of all encrypted data.

**Steps**:

```bash
# 1. Generate new encryption key
NEW_ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# 2. Run migration script to re-encrypt data
kubectl exec -it deployment/xcodereview-backend -- python scripts/rotate_encryption_key.py \
  --old-key="$OLD_ENCRYPTION_KEY" \
  --new-key="$NEW_ENCRYPTION_KEY"

# 3. Update secret
kubectl create secret generic xcodereview-backend-secrets \
  --from-literal=ENCRYPTION_KEY="$NEW_ENCRYPTION_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

# 4. Restart pods
kubectl rollout restart deployment/xcodereview-backend

# 5. Verify encrypted data can be decrypted
kubectl exec -it deployment/xcodereview-backend -- python scripts/verify_encryption.py
```

### 5. MinIO/S3 Access Keys Rotation

**Impact**: Minimal - Object storage access will use new keys.

**Steps**:

```bash
# 1. Create new access key in MinIO/S3
# For MinIO: mc admin user add myminio newuser newpassword

# 2. Update secret
kubectl create secret generic xcodereview-backend-secrets \
  --from-literal=MINIO_ACCESS_KEY="newuser" \
  --from-literal=MINIO_SECRET_KEY="newpassword" \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Restart pods
kubectl rollout restart deployment/xcodereview-backend

# 4. Verify object storage access
kubectl exec -it deployment/xcodereview-backend -- python -c "from services.storage import storage_client; print(storage_client.list_buckets())"

# 5. Delete old access key
# For MinIO: mc admin user remove myminio olduser
```

## Using External Secrets Operator

For automated secret rotation, use External Secrets Operator with cloud secret managers.

### AWS Secrets Manager Example

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: xcodereview-backend-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: xcodereview-backend-secrets
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: xcodereview/prod/database-url
    - secretKey: SECRET_KEY
      remoteRef:
        key: xcodereview/prod/jwt-secret-key
    - secretKey: OPENAI_API_KEY
      remoteRef:
        key: xcodereview/prod/openai-api-key
```

### Rotation with External Secrets

```bash
# 1. Update secret in AWS Secrets Manager
aws secretsmanager update-secret \
  --secret-id xcodereview/prod/jwt-secret-key \
  --secret-string "new-secret-value"

# 2. External Secrets Operator will automatically sync (within refreshInterval)
# Or force immediate sync:
kubectl annotate externalsecret xcodereview-backend-secrets \
  force-sync=$(date +%s) --overwrite

# 3. Restart pods to pick up new secret
kubectl rollout restart deployment/xcodereview-backend
```

## Emergency Rotation

If a secret is compromised, perform emergency rotation immediately:

```bash
# 1. Revoke compromised credentials at source
# 2. Generate new credentials
# 3. Update Kubernetes secret
# 4. Force immediate pod restart
kubectl delete pods -l app=xcodereview-backend
# 5. Verify new credentials are working
# 6. Audit logs for unauthorized access
```

## Verification Checklist

After each rotation:

- [ ] Application pods are running and healthy
- [ ] No error logs related to authentication/authorization
- [ ] Health check endpoints are responding
- [ ] Database connectivity is working
- [ ] LLM API calls are successful
- [ ] Object storage access is working
- [ ] Monitoring and alerting are functional
- [ ] Old credentials have been revoked/deleted

## Rollback Procedure

If rotation causes issues:

```bash
# 1. Restore previous secret from backup
kubectl apply -f secret-backup.yaml

# 2. Restart pods
kubectl rollout restart deployment/xcodereview-backend

# 3. Verify application is working
kubectl logs -l app=xcodereview-backend --tail=100

# 4. Investigate root cause
# 5. Plan corrective action
```

## Backup Secrets

Before rotation, always backup current secrets:

```bash
# Backup all secrets
kubectl get secret xcodereview-backend-secrets -o yaml > secret-backup-$(date +%Y%m%d).yaml

# Store backup securely (encrypted)
gpg --encrypt --recipient admin@example.com secret-backup-$(date +%Y%m%d).yaml

# Store in secure location (not in git!)
```

## Automation

Consider automating secret rotation:

```bash
#!/bin/bash
# rotate-secrets.sh

# This script should be run from a secure CI/CD pipeline
# with appropriate access controls

set -e

SECRET_NAME="xcodereview-backend-secrets"
NAMESPACE="xcodereview"

# Backup current secret
kubectl get secret $SECRET_NAME -n $NAMESPACE -o yaml > backup-$(date +%Y%m%d).yaml

# Generate new secrets
NEW_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# Update secret
kubectl create secret generic $SECRET_NAME \
  --from-literal=SECRET_KEY="$NEW_SECRET_KEY" \
  --namespace=$NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart deployment
kubectl rollout restart deployment/xcodereview-backend -n $NAMESPACE

# Wait for rollout
kubectl rollout status deployment/xcodereview-backend -n $NAMESPACE

# Verify
kubectl exec -it deployment/xcodereview-backend -n $NAMESPACE -- curl -f http://localhost:8000/health

echo "Secret rotation completed successfully"
```

## Best Practices

1. **Never commit secrets to git** - Use .gitignore for secret files
2. **Use strong secrets** - Minimum 32 characters, random generation
3. **Rotate regularly** - Follow the rotation schedule
4. **Audit access** - Log all secret access and changes
5. **Use external secret managers** - AWS Secrets Manager, GCP Secret Manager, etc.
6. **Encrypt backups** - Always encrypt secret backups
7. **Test rotation** - Test rotation procedures in staging first
8. **Document changes** - Keep rotation log with dates and reasons
9. **Monitor after rotation** - Watch for errors and issues
10. **Have rollback plan** - Always be able to rollback quickly

## Troubleshooting

### Pods not starting after rotation

```bash
# Check pod events
kubectl describe pod -l app=xcodereview-backend

# Check secret is mounted correctly
kubectl exec -it deployment/xcodereview-backend -- env | grep SECRET

# Check logs
kubectl logs -l app=xcodereview-backend --tail=100
```

### Database connection errors

```bash
# Verify database URL format
kubectl get secret xcodereview-backend-secrets -o jsonpath='{.data.DATABASE_URL}' | base64 -d

# Test database connectivity
kubectl exec -it deployment/xcodereview-backend -- psql "$DATABASE_URL" -c "SELECT 1"
```

### LLM API errors

```bash
# Verify API key is set
kubectl get secret xcodereview-backend-secrets -o jsonpath='{.data.OPENAI_API_KEY}' | base64 -d

# Test API key
kubectl exec -it deployment/xcodereview-backend -- python -c "import openai; openai.api_key='$OPENAI_API_KEY'; print(openai.Model.list())"
```

## References

- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [External Secrets Operator](https://external-secrets.io/)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [GCP Secret Manager](https://cloud.google.com/secret-manager)
