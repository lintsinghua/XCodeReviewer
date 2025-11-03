# Developer Guide

## Project Structure

```
backend/
├── api/v1/              # API endpoints
├── models/              # Database models
├── schemas/             # Pydantic schemas
├── services/            # Business logic
│   ├── llm/            # LLM adapters
│   ├── reports/        # Report generators
│   ├── repository/     # Repository scanning
│   └── storage/        # File storage
├── tasks/              # Celery tasks
├── core/               # Core utilities
├── db/                 # Database config
├── tests/              # Test files
└── docs/               # Documentation
```

## Architecture Decisions

### 1. FastAPI Framework
- Async/await support
- Automatic OpenAPI documentation
- Type hints and validation
- High performance

### 2. SQLAlchemy ORM
- Async support with asyncpg
- Type-safe queries
- Migration support with Alembic

### 3. Celery for Background Tasks
- Async task processing
- Retry mechanisms
- Progress tracking
- Distributed workers

### 4. Multi-LLM Support
- Adapter pattern for providers
- Factory pattern for instantiation
- Unified interface

## Development Workflow

### 1. Setup
```bash
git clone <repo>
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### 2. Database Migrations
```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

### 3. Running Tests
```bash
# All tests
pytest

# Specific test
pytest tests/test_api_endpoints.py::TestAuthEndpoints::test_login

# With coverage
pytest --cov=. --cov-report=html
```

### 4. Code Quality
```bash
# Format code
ruff format .

# Lint
ruff check .

# Type check
mypy .
```

## Coding Standards

### Python Style
- Follow PEP 8
- Use type hints
- Maximum line length: 100
- Use docstrings for public APIs

### Example:
```python
async def create_project(
    data: ProjectCreate,
    db: AsyncSession,
    current_user: User
) -> Project:
    \"\"\"
    Create a new project.
    
    Args:
        data: Project creation data
        db: Database session
        current_user: Authenticated user
        
    Returns:
        Created project
        
    Raises:
        HTTPException: If validation fails
    \"\"\"
    project = Project(**data.dict(), owner_id=current_user.id)
    db.add(project)
    await db.commit()
    return project
```

## Adding New Features

### 1. Create Model
```python
# models/new_model.py
class NewModel(Base):
    __tablename__ = "new_models"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
```

### 2. Create Schema
```python
# schemas/new_model.py
class NewModelCreate(BaseModel):
    name: str

class NewModelResponse(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True
```

### 3. Create API Endpoint
```python
# api/v1/new_endpoint.py
@router.post("", response_model=NewModelResponse)
async def create(
    data: NewModelCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Implementation
    pass
```

### 4. Add Tests
```python
# tests/test_new_endpoint.py
async def test_create_new_model(test_client, auth_token):
    response = await test_client.post(
        "/api/v1/new-endpoint",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"name": "Test"}
    )
    assert response.status_code == 201
```

## Common Tasks

### Adding LLM Provider
1. Create adapter in `services/llm/adapters/`
2. Extend `BaseLLMAdapter`
3. Register in `LLMFactory`
4. Add configuration to `.env`
5. Write tests

### Adding Report Format
1. Create generator in `services/reports/`
2. Extend `BaseReportGenerator`
3. Implement `generate()` method
4. Add to report task
5. Write tests

## Debugging

### Enable Debug Logging
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Database Queries
```python
# Log all SQL queries
DATABASE_ECHO=true
```

### Celery Tasks
```bash
# Monitor tasks
celery -A tasks.celery_app inspect active

# Purge queue
celery -A tasks.celery_app purge
```

## Best Practices

1. **Always use async/await** for I/O operations
2. **Use dependency injection** for database sessions
3. **Validate input** with Pydantic schemas
4. **Handle errors** with proper HTTP status codes
5. **Write tests** for new features
6. **Document APIs** with docstrings
7. **Use transactions** for multi-step operations
8. **Cache expensive operations** with Redis
9. **Log important events** with structured logging
10. **Monitor performance** with metrics

## Troubleshooting

### Import Errors
```bash
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

### Database Connection
```bash
# Check connection
psql -h localhost -U postgres -d xcodereviewer_dev
```

### Redis Connection
```bash
redis-cli ping
```

## Resources

- FastAPI: https://fastapi.tiangolo.com/
- SQLAlchemy: https://docs.sqlalchemy.org/
- Celery: https://docs.celeryproject.org/
- Pytest: https://docs.pytest.org/
