# API Usage Examples

This document provides practical examples for using the XCodeReviewer API.

## Authentication

### Register User

```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "newuser",
    "password": "SecurePass123!",
    "full_name": "John Doe"
  }'
```

### Login

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "SecurePass123!"
  }'
```

Response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

### Use Access Token

```bash
# Set token as variable
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGc..."

# Make authenticated request
curl -X GET "http://localhost:8000/api/v1/users/me" \
  -H "Authorization: Bearer $TOKEN"
```

## Agent Operations

### Chat with Agent

```bash
curl -X POST "http://localhost:8000/api/v1/agents/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Review this Python code for security issues",
    "code": "import os\npassword = os.getenv(\"PASSWORD\")\nquery = f\"SELECT * FROM users WHERE id = {user_id}\"",
    "language": "python",
    "agent_name": "security"
  }'
```

### Analyze Code

```bash
curl -X POST "http://localhost:8000/api/v1/agents/analyze" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def calculate(a, b):\n    return a / b",
    "language": "python",
    "analysis_type": "full"
  }'
```

### Reset Agent Session

```bash
curl -X POST "http://localhost:8000/api/v1/agents/reset/security" \
  -H "Authorization: Bearer $TOKEN"
```

## Data Migration

### Export User Data

```bash
curl -X POST "http://localhost:8000/api/v1/migration/export" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "include_projects": true,
    "include_tasks": true,
    "include_issues": true,
    "include_settings": true
  }' \
  -o export.json
```

### Download Export

```bash
curl -X GET "http://localhost:8000/api/v1/migration/export/download" \
  -H "Authorization: Bearer $TOKEN" \
  -o "export_$(date +%Y%m%d).json"
```

### Validate Import Data

```bash
curl -X POST "http://localhost:8000/api/v1/migration/validate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @export.json
```

### Import Data

```bash
curl -X POST "http://localhost:8000/api/v1/migration/import" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @export.json
```

### Upload and Import File

```bash
curl -X POST "http://localhost:8000/api/v1/migration/import/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@export.json" \
  -F "skip_existing=true"
```

## Monitoring (Admin Only)

### System Health Check

```bash
curl -X GET "http://localhost:8000/api/v1/monitoring/health" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Database Pool Statistics

```bash
curl -X GET "http://localhost:8000/api/v1/monitoring/database/pool" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Redis Cache Statistics

```bash
curl -X GET "http://localhost:8000/api/v1/monitoring/redis/cache" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Clear Redis Cache

```bash
curl -X POST "http://localhost:8000/api/v1/monitoring/redis/cache/clear" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pattern": "cache:*"
  }'
```

### Celery Workers

```bash
curl -X GET "http://localhost:8000/api/v1/monitoring/celery/workers" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Active Tasks

```bash
curl -X GET "http://localhost:8000/api/v1/monitoring/celery/tasks/active" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Revoke Task

```bash
curl -X POST "http://localhost:8000/api/v1/monitoring/celery/tasks/TASK_ID/revoke" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "terminate": true
  }'
```

### LLM Pool Statistics

```bash
curl -X GET "http://localhost:8000/api/v1/monitoring/llm/pools" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Specific Provider Stats

```bash
curl -X GET "http://localhost:8000/api/v1/monitoring/llm/pools/openai" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Python Client Examples

### Using requests

```python
import requests

# Base URL
BASE_URL = "http://localhost:8000/api/v1"

# Login
response = requests.post(
    f"{BASE_URL}/auth/login",
    json={
        "username": "user@example.com",
        "password": "SecurePass123!"
    }
)
tokens = response.json()
access_token = tokens["access_token"]

# Set headers
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

# Chat with agent
response = requests.post(
    f"{BASE_URL}/agents/chat",
    headers=headers,
    json={
        "message": "Review this code",
        "code": "print('hello')",
        "language": "python"
    }
)
result = response.json()
print(result)
```

### Using httpx (async)

```python
import httpx
import asyncio

async def main():
    async with httpx.AsyncClient() as client:
        # Login
        response = await client.post(
            "http://localhost:8000/api/v1/auth/login",
            json={
                "username": "user@example.com",
                "password": "SecurePass123!"
            }
        )
        tokens = response.json()
        
        # Set headers
        headers = {
            "Authorization": f"Bearer {tokens['access_token']}"
        }
        
        # Chat with agent
        response = await client.post(
            "http://localhost:8000/api/v1/agents/chat",
            headers=headers,
            json={
                "message": "Review this code",
                "code": "print('hello')",
                "language": "python"
            }
        )
        result = response.json()
        print(result)

asyncio.run(main())
```

## JavaScript/TypeScript Examples

### Using fetch

```javascript
// Login
const loginResponse = await fetch('http://localhost:8000/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'user@example.com',
    password: 'SecurePass123!'
  })
});

const { access_token } = await loginResponse.json();

// Chat with agent
const chatResponse = await fetch('http://localhost:8000/api/v1/agents/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'Review this code',
    code: "print('hello')",
    language: 'python'
  })
});

const result = await chatResponse.json();
console.log(result);
```

### Using axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  }
});

// Login
const loginResponse = await api.post('/auth/login', {
  username: 'user@example.com',
  password: 'SecurePass123!'
});

const { access_token } = loginResponse.data;

// Set token for future requests
api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

// Chat with agent
const chatResponse = await api.post('/agents/chat', {
  message: 'Review this code',
  code: "print('hello')",
  language: 'python'
});

console.log(chatResponse.data);
```

## Error Handling

### Handle API Errors

```python
import requests

try:
    response = requests.post(
        "http://localhost:8000/api/v1/agents/chat",
        headers=headers,
        json=data
    )
    response.raise_for_status()  # Raise exception for 4xx/5xx
    result = response.json()
except requests.exceptions.HTTPError as e:
    if e.response.status_code == 401:
        print("Unauthorized - token expired or invalid")
    elif e.response.status_code == 429:
        print("Rate limit exceeded")
    elif e.response.status_code == 500:
        print("Server error")
    else:
        print(f"HTTP error: {e}")
except requests.exceptions.RequestException as e:
    print(f"Request failed: {e}")
```

### Retry Logic

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10)
)
def call_api_with_retry():
    response = requests.post(
        "http://localhost:8000/api/v1/agents/chat",
        headers=headers,
        json=data
    )
    response.raise_for_status()
    return response.json()

try:
    result = call_api_with_retry()
except Exception as e:
    print(f"Failed after retries: {e}")
```

## Rate Limiting

The API implements rate limiting:
- **Per minute**: 60 requests
- **Per hour**: 1000 requests

When rate limited, you'll receive a 429 response with `Retry-After` header.

```python
response = requests.get(url, headers=headers)

if response.status_code == 429:
    retry_after = int(response.headers.get('Retry-After', 60))
    print(f"Rate limited. Retry after {retry_after} seconds")
    time.sleep(retry_after)
    response = requests.get(url, headers=headers)
```

## Pagination

For endpoints that return lists:

```bash
curl -X GET "http://localhost:8000/api/v1/projects?skip=0&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

```python
def get_all_projects(token):
    projects = []
    skip = 0
    limit = 100
    
    while True:
        response = requests.get(
            f"{BASE_URL}/projects",
            headers={"Authorization": f"Bearer {token}"},
            params={"skip": skip, "limit": limit}
        )
        batch = response.json()
        
        if not batch:
            break
            
        projects.extend(batch)
        skip += limit
    
    return projects
```

## WebSocket (Future)

```javascript
// Connect to WebSocket for real-time updates
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    type: 'auth',
    token: access_token
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

## Best Practices

1. **Always use HTTPS in production**
2. **Store tokens securely** (not in localStorage for sensitive apps)
3. **Implement token refresh** before expiration
4. **Handle rate limiting** gracefully
5. **Use connection pooling** for multiple requests
6. **Implement retry logic** with exponential backoff
7. **Validate responses** before using data
8. **Log errors** for debugging
9. **Use timeouts** to prevent hanging requests
10. **Monitor API usage** and performance

## References

- [API Documentation](http://localhost:8000/api/v1/docs)
- [Authentication Guide](authentication.md)
- [Error Codes](error-codes.md)
- [Rate Limiting](rate-limiting.md)
