# Environment Variables Documentation

This document describes all environment variables used in the XCodeReviewer application.

## Table of Contents

- [Application Settings](#application-settings)
- [Database Configuration](#database-configuration)
- [Redis Configuration](#redis-configuration)
- [Security Settings](#security-settings)
- [Storage Configuration](#storage-configuration)
- [LLM Provider Settings](#llm-provider-settings)
- [External Integrations](#external-integrations)
- [Monitoring & Logging](#monitoring--logging)
- [Performance Tuning](#performance-tuning)

## Application Settings

### APP_NAME
- **Description**: Application name
- **Default**: `XCodeReviewer`
- **Required**: No

### APP_ENV
- **Description**: Environment name
- **Values**: `development`, `staging`, `production`
- **Default**: `development`
- **Required**: Yes

### DEBUG
- **Description**: Enable debug mode
- **Values**: `true`, `false`
- **Default**: `false`
- **Required**: No
- **Warning**: Must be `false` in production

### LOG_LEVEL
- **Description**: Logging level
- **Values**: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`
- **Default**: `INFO`
- **Required**: No

## Database Configuration

### DATABASE_URL
- **Description**: Database connection string
- **Format**: 
  - SQLite: `sqlite+aiosqlite:///./database.db`
  - PostgreSQL: `postgresql+asyncpg://user:pass@host:port/dbname`
- **Required**: Yes
- **Example**: `postgresql+asyncpg://postgres:password@localhost:5432/xcodereviewer`

### DATABASE_POOL_SIZE
- **Description**: Connection pool size
- **Default**: `20`
- **Required**: No
- **Production**: `20-50` depending on load

### DATABASE_MAX_OVERFLOW
- **Description**: Maximum overflow connections
- **Default**: `10`
- **Required**: No

### DATABASE_POOL_TIMEOUT
- **Description**: Pool timeout in seconds
- **Default**: `30`
- **Required**: No

### DATABASE_POOL_RECYCLE
- **Description**: Connection recycle time in seconds
- **Default**: `3600`
- **Required**: No

## Redis Configuration

### REDIS_URL
- **Description**: Redis connection URL
- **Format**: `redis://host:port/db`
- **Default**: `redis://localhost:6379/0`
- **Required**: Yes
- **Example**: `redis://redis-server:6379/0`

### REDIS_MAX_CONNECTIONS
- **Description**: Maximum Redis connections
- **Default**: `50`
- **Required**: No
- **Production**: `50-100`

### REDIS_SOCKET_TIMEOUT
- **Description**: Socket timeout in seconds
- **Default**: `5`
- **Required**: No

## Security Settings

### SECRET_KEY
- **Description**: Application secret key for encryption
- **Required**: Yes
- **Minimum Length**: 32 characters
- **Warning**: MUST be changed in production
- **Generation**: `python -c "import secrets; print(secrets.token_urlsafe(32))"`

### JWT_SECRET_KEY
- **Description**: JWT token signing key
- **Required**: Yes
- **Minimum Length**: 32 characters
- **Warning**: MUST be different from SECRET_KEY
- **Generation**: `python -c "import secrets; print(secrets.token_urlsafe(32))"`

### JWT_ALGORITHM
- **Description**: JWT signing algorithm
- **Default**: `HS256`
- **Values**: `HS256`, `HS384`, `HS512`
- **Required**: No

### ACCESS_TOKEN_EXPIRE_MINUTES
- **Description**: Access token expiration time
- **Default**: `30`
- **Development**: `30-60`
- **Production**: `15-30`
- **Required**: No

### REFRESH_TOKEN_EXPIRE_DAYS
- **Description**: Refresh token expiration time
- **Default**: `7`
- **Required**: No

### PASSWORD_MIN_LENGTH
- **Description**: Minimum password length
- **Default**: `8`
- **Production**: `12`
- **Required**: No

## Storage Configuration

### STORAGE_TYPE
- **Description**: Storage backend type
- **Values**: `local`, `minio`, `s3`
- **Default**: `local`
- **Required**: Yes

### LOCAL_STORAGE_PATH
- **Description**: Local storage directory path
- **Default**: `./storage`
- **Required**: Only if STORAGE_TYPE=local

### MINIO_ENDPOINT
- **Description**: MinIO server endpoint
- **Format**: `host:port`
- **Example**: `minio.example.com:9000`
- **Required**: Only if STORAGE_TYPE=minio

### MINIO_ACCESS_KEY
- **Description**: MinIO access key
- **Required**: Only if STORAGE_TYPE=minio
- **Warning**: Keep secure

### MINIO_SECRET_KEY
- **Description**: MinIO secret key
- **Required**: Only if STORAGE_TYPE=minio
- **Warning**: Keep secure

### MINIO_BUCKET
- **Description**: MinIO bucket name
- **Default**: `xcodereviewer`
- **Required**: Only if STORAGE_TYPE=minio

### MINIO_SECURE
- **Description**: Use HTTPS for MinIO
- **Values**: `true`, `false`
- **Default**: `false`
- **Production**: `true`
- **Required**: No

## LLM Provider Settings

### LLM_MODE
- **Description**: LLM operation mode
- **Values**: `mock`, `production`
- **Default**: `mock`
- **Development**: `mock` for testing
- **Production**: `production`
- **Required**: Yes

### OPENAI_API_KEY
- **Description**: OpenAI API key
- **Format**: `sk-...`
- **Required**: If using OpenAI
- **Get Key**: https://platform.openai.com/api-keys

### OPENAI_MODEL
- **Description**: OpenAI model to use
- **Values**: `gpt-4`, `gpt-3.5-turbo`, etc.
- **Default**: `gpt-4`
- **Required**: No

### ANTHROPIC_API_KEY
- **Description**: Anthropic Claude API key
- **Format**: `sk-ant-...`
- **Required**: If using Claude
- **Get Key**: https://console.anthropic.com/

### GOOGLE_API_KEY
- **Description**: Google Gemini API key
- **Required**: If using Gemini
- **Get Key**: https://makersuite.google.com/app/apikey

### OLLAMA_BASE_URL
- **Description**: Ollama server URL
- **Default**: `http://localhost:11434`
- **Required**: If using Ollama

## External Integrations

### GITHUB_TOKEN
- **Description**: GitHub personal access token
- **Format**: `ghp_...`
- **Required**: For GitHub repository scanning
- **Scopes**: `repo`, `read:org`
- **Get Token**: https://github.com/settings/tokens

### GITLAB_TOKEN
- **Description**: GitLab personal access token
- **Format**: `glpat-...`
- **Required**: For GitLab repository scanning
- **Scopes**: `read_api`, `read_repository`
- **Get Token**: https://gitlab.com/-/profile/personal_access_tokens

### GITLAB_URL
- **Description**: GitLab instance URL
- **Default**: `https://gitlab.com`
- **Required**: No

## Monitoring & Logging

### ENABLE_METRICS
- **Description**: Enable Prometheus metrics
- **Values**: `true`, `false`
- **Default**: `true`
- **Required**: No

### METRICS_PORT
- **Description**: Metrics endpoint port
- **Default**: `9090`
- **Required**: No

### SENTRY_DSN
- **Description**: Sentry error tracking DSN
- **Format**: `https://...@sentry.io/...`
- **Required**: For error tracking
- **Get DSN**: https://sentry.io/

### SENTRY_ENVIRONMENT
- **Description**: Sentry environment name
- **Values**: `development`, `staging`, `production`
- **Required**: If using Sentry

### LOG_FORMAT
- **Description**: Log output format
- **Values**: `json`, `text`
- **Default**: `json`
- **Production**: `json`
- **Required**: No

### LOG_FILE
- **Description**: Log file path
- **Default**: `./logs/app.log`
- **Required**: No

## Performance Tuning

### WORKERS
- **Description**: Number of worker processes
- **Default**: `4`
- **Formula**: `(2 * CPU_CORES) + 1`
- **Required**: No

### GUNICORN_TIMEOUT
- **Description**: Worker timeout in seconds
- **Default**: `120`
- **Required**: No

### CELERY_WORKER_CONCURRENCY
- **Description**: Celery worker concurrency
- **Default**: `4`
- **Required**: No

### RATE_LIMIT_PER_MINUTE
- **Description**: API rate limit per minute
- **Default**: `60`
- **Production**: `30`
- **Required**: No

### RATE_LIMIT_PER_HOUR
- **Description**: API rate limit per hour
- **Default**: `1000`
- **Production**: `500`
- **Required**: No

## Environment-Specific Recommendations

### Development
```bash
APP_ENV=development
DEBUG=true
LOG_LEVEL=DEBUG
DATABASE_URL=sqlite+aiosqlite:///./dev.db
STORAGE_TYPE=local
LLM_MODE=mock
ENABLE_SWAGGER=true
```

### Staging
```bash
APP_ENV=staging
DEBUG=false
LOG_LEVEL=INFO
DATABASE_URL=postgresql+asyncpg://...
STORAGE_TYPE=minio
LLM_MODE=production
ENABLE_SWAGGER=true
```

### Production
```bash
APP_ENV=production
DEBUG=false
LOG_LEVEL=WARNING
DATABASE_URL=postgresql+asyncpg://...
STORAGE_TYPE=minio
LLM_MODE=production
ENABLE_SWAGGER=false
SENTRY_DSN=https://...
```

## Security Best Practices

1. **Never commit `.env` files** with real credentials to version control
2. **Use different keys** for each environment
3. **Rotate secrets regularly** (every 90 days recommended)
4. **Use environment-specific** service accounts
5. **Enable HTTPS** in production (MINIO_SECURE=true)
6. **Restrict CORS origins** to known domains
7. **Use strong passwords** (min 12 characters in production)
8. **Enable rate limiting** in production
9. **Monitor failed authentication** attempts
10. **Keep dependencies updated** for security patches

## Generating Secure Keys

```bash
# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate JWT_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate random password
python -c "import secrets; import string; chars = string.ascii_letters + string.digits + string.punctuation; print(''.join(secrets.choice(chars) for _ in range(16)))"
```

## Troubleshooting

### Database Connection Issues
- Check DATABASE_URL format
- Verify database server is running
- Check network connectivity
- Verify credentials

### Redis Connection Issues
- Check REDIS_URL format
- Verify Redis server is running
- Check firewall rules

### Storage Issues
- For local: Check LOCAL_STORAGE_PATH permissions
- For MinIO: Verify MINIO_ENDPOINT is accessible
- Check credentials and bucket exists

### LLM API Issues
- Verify API keys are valid
- Check API rate limits
- Verify network connectivity
- Check LLM_MODE setting

## Support

For additional help:
- Documentation: `/docs`
- Issues: GitHub Issues
- Email: support@your-domain.com
