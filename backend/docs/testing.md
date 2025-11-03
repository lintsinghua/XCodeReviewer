# Testing Guide

This document describes the testing strategy and how to run tests for XCodeReviewer.

## Test Structure

```
tests/
├── test_api_endpoints.py       # API endpoint tests
├── test_e2e_workflows.py        # End-to-end workflow tests
├── test_llm_service.py          # LLM service tests
├── test_repository_scanner.py   # Repository scanning tests
├── test_report_generation.py    # Report generation tests
└── conftest.py                  # Shared fixtures
```

## Test Categories

### Unit Tests
Test individual components in isolation.

```bash
pytest tests/ -m unit
```

### Integration Tests
Test interactions between components.

```bash
pytest tests/ -m integration
```

### End-to-End Tests
Test complete user workflows.

```bash
pytest tests/ -m e2e
```

## Running Tests

### Run All Tests

```bash
# Using pytest directly
pytest

# Using test script
./scripts/run_tests.sh
```

### Run Specific Test File

```bash
pytest tests/test_api_endpoints.py
```

### Run Specific Test Class

```bash
pytest tests/test_api_endpoints.py::TestAuthEndpoints
```

### Run Specific Test

```bash
pytest tests/test_api_endpoints.py::TestAuthEndpoints::test_register_user
```

### Run with Coverage

```bash
pytest --cov=. --cov-report=html
```

### Run in Parallel

```bash
pytest -n auto
```

## Coverage Reports

### Generate Coverage Report

```bash
pytest --cov=. --cov-report=html --cov-report=term
```

### View HTML Report

```bash
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
start htmlcov/index.html  # Windows
```

### Coverage Threshold

The project requires minimum 80% code coverage. Tests will fail if coverage is below this threshold.

## Test Fixtures

Common fixtures are defined in `conftest.py`:

- `db_session`: Database session for tests
- `test_client`: HTTP client for API tests
- `authenticated_user`: Pre-authenticated test user
- `auth_token`: Authentication token

## Writing Tests

### Unit Test Example

```python
def test_password_validation():
    """Test password validation logic"""
    from core.security import validate_password
    
    # Valid password
    assert validate_password("SecurePass123!")
    
    # Invalid password
    assert not validate_password("weak")
```

### Integration Test Example

```python
@pytest.mark.asyncio
async def test_create_project(test_client, auth_token):
    """Test project creation via API"""
    response = await test_client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={
            "name": "Test Project",
            "source_type": "github"
        }
    )
    assert response.status_code == 201
```

### E2E Test Example

```python
@pytest.mark.e2e
@pytest.mark.asyncio
async def test_complete_workflow(test_client, auth_token):
    """Test complete analysis workflow"""
    # Create project
    project = await create_project(test_client, auth_token)
    
    # Create task
    task = await create_task(test_client, auth_token, project["id"])
    
    # Generate report
    report = await generate_report(test_client, auth_token, task["id"])
    
    assert report["status"] == "completed"
```

## Mocking

### Mock External Services

```python
from unittest.mock import patch, MagicMock

@patch('services.llm.openai_adapter.OpenAI')
def test_llm_call(mock_openai):
    """Test LLM service with mocked API"""
    mock_openai.return_value.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Test response"))]
    )
    
    # Test code here
```

### Mock Database

```python
@pytest.fixture
async def mock_db():
    """Mock database session"""
    from unittest.mock import AsyncMock
    
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    
    return session
```

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Scheduled daily runs

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run tests
        run: ./scripts/run_tests.sh
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

## Performance Testing

### Load Testing with Locust

```python
from locust import HttpUser, task, between

class APIUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def list_projects(self):
        self.client.get("/api/v1/projects")
```

Run load test:

```bash
locust -f tests/load_test.py --host=http://localhost:8000
```

## Security Testing

### SQL Injection Tests

```python
def test_sql_injection_protection(test_client, auth_token):
    """Test SQL injection protection"""
    response = test_client.get(
        "/api/v1/projects",
        params={"search": "'; DROP TABLE projects; --"}
    )
    assert response.status_code != 500
```

### Authentication Tests

```python
def test_unauthorized_access(test_client):
    """Test unauthorized access is blocked"""
    response = test_client.get("/api/v1/projects")
    assert response.status_code == 401
```

## Debugging Tests

### Run with Debug Output

```bash
pytest -vv --tb=long
```

### Run with PDB

```bash
pytest --pdb
```

### Run Specific Failed Tests

```bash
pytest --lf  # Last failed
pytest --ff  # Failed first
```

## Best Practices

1. **Test Naming**: Use descriptive names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests clearly
3. **One Assertion**: Focus each test on one behavior
4. **Independent Tests**: Tests should not depend on each other
5. **Fast Tests**: Keep unit tests fast (< 1 second)
6. **Mock External Services**: Don't make real API calls in tests
7. **Clean Up**: Use fixtures to clean up test data
8. **Coverage**: Aim for 80%+ coverage
9. **Documentation**: Add docstrings to test functions
10. **Markers**: Use pytest markers to categorize tests

## Troubleshooting

### Tests Hanging

```bash
# Add timeout
pytest --timeout=30
```

### Database Conflicts

```bash
# Use separate test database
export TEST_DATABASE_URL=sqlite+aiosqlite:///./test.db
```

### Import Errors

```bash
# Add project root to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

### Async Tests Failing

```bash
# Ensure pytest-asyncio is installed
pip install pytest-asyncio
```

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Coverage.py Documentation](https://coverage.readthedocs.io/)
- [Testing Best Practices](https://docs.python-guide.org/writing/tests/)
