# XCodeReviewer API Documentation

## Overview

The XCodeReviewer API provides programmatic access to code analysis, project management, and reporting features.

**Base URL**: `https://api.your-domain.com/api/v1`

**Authentication**: Bearer Token (JWT)

**Content Type**: `application/json`

## Quick Start

### 1. Register

```bash
curl -X POST https://api.your-domain.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "username",
    "password": "SecurePass123!"
  }'
```

### 2. Login

```bash
curl -X POST https://api.your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "username",
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

### 3. Use API

```bash
curl -X GET https://api.your-domain.com/api/v1/projects \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Authentication

### Register User

**POST** `/auth/register`

Creates a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "SecurePass123!"
}
```

**Response** (201 Created):
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "username",
  "role": "user",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Login

**POST** `/auth/login`

Authenticates user and returns JWT tokens.

**Request Body**:
```json
{
  "username": "username",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "username"
  }
}
```

### Refresh Token

**POST** `/auth/refresh`

Refreshes access token using refresh token.

**Request Body**:
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

## Projects

### Create Project

**POST** `/projects`

Creates a new project.

**Headers**: `Authorization: Bearer {token}`

**Request Body**:
```json
{
  "name": "My Project",
  "description": "Project description",
  "source_type": "github",
  "source_url": "https://github.com/user/repo",
  "branch": "main"
}
```

**Response** (201 Created):
```json
{
  "id": 1,
  "name": "My Project",
  "description": "Project description",
  "source_type": "github",
  "source_url": "https://github.com/user/repo",
  "branch": "main",
  "owner_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "total_tasks": 0,
  "total_issues": 0
}
```

### List Projects

**GET** `/projects`

Returns paginated list of projects.

**Query Parameters**:
- `page` (integer): Page number (default: 1)
- `page_size` (integer): Items per page (default: 10, max: 100)
- `search` (string): Search query

**Response** (200 OK):
```json
{
  "items": [
    {
      "id": 1,
      "name": "My Project",
      "source_type": "github",
      "total_tasks": 5,
      "total_issues": 23
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10
}
```

### Get Project

**GET** `/projects/{id}`

Returns project details.

**Response** (200 OK):
```json
{
  "id": 1,
  "name": "My Project",
  "description": "Project description",
  "source_type": "github",
  "source_url": "https://github.com/user/repo",
  "branch": "main",
  "created_at": "2024-01-01T00:00:00Z",
  "total_tasks": 5,
  "total_issues": 23
}
```

### Update Project

**PUT** `/projects/{id}`

Updates project details.

**Request Body**:
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

### Delete Project

**DELETE** `/projects/{id}`

Deletes a project and all associated data.

**Response** (204 No Content)

## Tasks

### Create Task

**POST** `/tasks`

Creates a new analysis task.

**Request Body**:
```json
{
  "name": "Security Audit",
  "description": "Security analysis",
  "project_id": 1,
  "priority": "high",
  "agents_used": {
    "security": true,
    "performance": true
  }
}
```

**Response** (201 Created):
```json
{
  "id": 1,
  "name": "Security Audit",
  "status": "pending",
  "priority": "high",
  "progress": 0,
  "project_id": 1,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### List Tasks

**GET** `/tasks`

**Query Parameters**:
- `project_id` (integer): Filter by project
- `status` (string): Filter by status
- `priority` (string): Filter by priority

### Get Task

**GET** `/tasks/{id}`

Returns task details including progress and results.

### Cancel Task

**PUT** `/tasks/{id}/cancel`

Cancels a running task.

## Issues

### List Issues

**GET** `/issues`

**Query Parameters**:
- `task_id` (integer): Filter by task
- `severity` (string): critical, high, medium, low
- `category` (string): security, performance, etc.
- `status` (string): open, resolved, ignored

**Response** (200 OK):
```json
{
  "items": [
    {
      "id": 1,
      "title": "SQL Injection Vulnerability",
      "severity": "critical",
      "category": "security",
      "file_path": "src/main.py",
      "line_start": 42,
      "description": "Potential SQL injection...",
      "suggestion": "Use parameterized queries"
    }
  ],
  "total": 23,
  "page": 1,
  "page_size": 20
}
```

### Update Issue

**PUT** `/issues/{id}`

Updates issue status.

**Request Body**:
```json
{
  "status": "resolved"
}
```

## Reports

### Generate Report

**POST** `/reports`

Generates analysis report.

**Request Body**:
```json
{
  "task_id": 1,
  "format": "markdown",
  "include_code_snippets": true,
  "include_suggestions": true
}
```

**Response** (201 Created):
```json
{
  "id": 1,
  "task_id": 1,
  "format": "markdown",
  "status": "pending",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Download Report

**GET** `/reports/{id}/download`

Downloads generated report file.

**Response**: File download

## Statistics

### Get Overview

**GET** `/statistics/overview`

Returns dashboard statistics.

**Response** (200 OK):
```json
{
  "total_projects": 10,
  "total_tasks": 45,
  "total_issues": 234,
  "critical_issues": 12,
  "average_score": 78.5
}
```

### Get Trends

**GET** `/statistics/trends`

**Query Parameters**:
- `days` (integer): Number of days (default: 30)

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

## Error Response Format

```json
{
  "detail": "Error message",
  "status_code": 400
}
```

## Rate Limiting

- **Per Minute**: 60 requests
- **Per Hour**: 1000 requests

Rate limit headers:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Pagination

All list endpoints support pagination:

**Query Parameters**:
- `page`: Page number (starts at 1)
- `page_size`: Items per page (max 100)

**Response**:
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 10
}
```

## WebSocket

### Connect

**WS** `/ws/tasks`

Real-time task progress updates.

**Authentication**: Pass token as query parameter
```
ws://api.your-domain.com/ws/tasks?token=YOUR_TOKEN
```

**Messages**:
```json
{
  "type": "task_progress",
  "data": {
    "task_id": 1,
    "progress": 45,
    "current_step": "Analyzing files",
    "status": "running"
  }
}
```

## SDKs and Libraries

### Python

```python
from xcodereviewer import Client

client = Client(api_key="your_api_key")
projects = client.projects.list()
```

### JavaScript/TypeScript

```typescript
import { XCodeReviewerClient } from '@xcodereviewer/client';

const client = new XCodeReviewerClient({
  apiKey: 'your_api_key'
});

const projects = await client.projects.list();
```

## Support

- **Documentation**: https://docs.your-domain.com
- **API Status**: https://status.your-domain.com
- **Support Email**: support@your-domain.com
- **GitHub Issues**: https://github.com/your-org/xcodereviewer/issues
