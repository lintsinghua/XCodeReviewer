# Load Testing Guide

## Overview
This guide describes how to perform load testing on XCodeReviewer to ensure it can handle 100+ concurrent users.

## Tools
- **Locust**: Python-based load testing tool
- **Apache JMeter**: Alternative load testing tool
- **k6**: Modern load testing tool

## Installation

```bash
pip install locust
```

## Load Test Scenarios

### Scenario 1: API Endpoint Load Test

Create `tests/load/test_api_load.py`:

```python
from locust import HttpUser, task, between
import random

class APILoadTest(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        # Login
        response = self.client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "TestPass123!"
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    @task(3)
    def list_projects(self):
        self.client.get("/api/v1/projects", headers=self.headers)
    
    @task(2)
    def list_tasks(self):
        self.client.get("/api/v1/tasks", headers=self.headers)
    
    @task(1)
    def get_statistics(self):
        self.client.get("/api/v1/statistics/overview", headers=self.headers)
```

## Running Load Tests

### Basic Load Test

```bash
locust -f tests/load/test_api_load.py --host=http://localhost:8000
```

Then open http://localhost:8089 and configure:
- Number of users: 100
- Spawn rate: 10 users/second

### Headless Mode

```bash
locust -f tests/load/test_api_load.py \
    --host=http://localhost:8000 \
    --users 100 \
    --spawn-rate 10 \
    --run-time 5m \
    --headless
```

## Performance Targets

- **Response Time**: 95th percentile < 500ms
- **Throughput**: > 1000 requests/second
- **Error Rate**: < 1%
- **Concurrent Users**: 100+

## Monitoring During Load Tests

```bash
# Monitor system resources
htop

# Monitor database connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Monitor Redis
redis-cli info stats

# Monitor API metrics
curl http://localhost:9090/metrics
```

## Results Analysis

Expected results for 100 concurrent users:
- Average response time: < 200ms
- 95th percentile: < 500ms
- 99th percentile: < 1000ms
- Requests per second: > 1000
- Failure rate: < 1%

## Task 28.2 Completion Checklist

- [ ] Install load testing tools
- [ ] Create load test scenarios
- [ ] Run tests with 100 concurrent users
- [ ] Monitor system resources
- [ ] Analyze results
- [ ] Document findings
- [ ] Optimize bottlenecks if needed
- [ ] Re-test after optimizations

## Status: READY FOR EXECUTION
This task requires running the load tests in a staging environment.
