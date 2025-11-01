"""API Endpoint Integration Tests
Comprehensive tests for all API endpoints.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from models.user import User
from models.project import Project
from models.audit_task import AuditTask, TaskStatus, TaskPriority
from models.audit_issue import AuditIssue, IssueSeverity, IssueCategory
from models.report import Report
from core.security import get_password_hash


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user"""
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password=get_password_hash("TestPass123!"),
        is_active=True,
        role="user"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def auth_headers(client: AsyncClient, test_user: User) -> dict:
    """Get authentication headers"""
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "username": "testuser",
            "password": "TestPass123!"
        }
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def test_project(db_session: AsyncSession, test_user: User) -> Project:
    """Create a test project"""
    project = Project(
        name="Test Project",
        description="A test project",
        source_type="github",
        source_url="https://github.com/test/repo",
        branch="main",
        owner_id=test_user.id
    )
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)
    return project


@pytest.fixture
async def test_task(db_session: AsyncSession, test_project: Project, test_user: User) -> AuditTask:
    """Create a test task"""
    task = AuditTask(
        name="Test Task",
        description="A test task",
        status=TaskStatus.COMPLETED,
        priority=TaskPriority.NORMAL,
        progress=100,
        project_id=test_project.id,
        created_by=test_user.id,
        total_issues=5,
        critical_issues=1,
        high_issues=2,
        medium_issues=1,
        low_issues=1,
        overall_score=75.0
    )
    db_session.add(task)
    await db_session.commit()
    await db_session.refresh(task)
    return task


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    async def test_register_user(self, client: AsyncClient):
        """Test user registration"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "username": "newuser",
                "password": "SecurePass123!"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["username"] == "newuser"
        assert "id" in data
    
    async def test_register_duplicate_email(self, client: AsyncClient, test_user: User):
        """Test registration with duplicate email"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "username": "anotheruser",
                "password": "SecurePass123!"
            }
        )
        
        assert response.status_code == 400
    
    async def test_login_success(self, client: AsyncClient, test_user: User):
        """Test successful login"""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "username": "testuser",
                "password": "TestPass123!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
    
    async def test_login_invalid_credentials(self, client: AsyncClient, test_user: User):
        """Test login with invalid credentials"""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "username": "testuser",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401


class TestProjectEndpoints:
    """Test project management endpoints"""
    
    async def test_create_project(self, client: AsyncClient, auth_headers: dict):
        """Test project creation"""
        response = await client.post(
            "/api/v1/projects",
            headers=auth_headers,
            json={
                "name": "New Project",
                "description": "A new project",
                "source_type": "github",
                "source_url": "https://github.com/user/repo",
                "branch": "main"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Project"
        assert data["source_type"] == "github"
    
    async def test_list_projects(self, client: AsyncClient, auth_headers: dict, test_project: Project):
        """Test listing projects"""
        response = await client.get(
            "/api/v1/projects",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) > 0
        assert data["items"][0]["name"] == "Test Project"
    
    async def test_get_project(self, client: AsyncClient, auth_headers: dict, test_project: Project):
        """Test getting project details"""
        response = await client.get(
            f"/api/v1/projects/{test_project.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_project.id
        assert data["name"] == "Test Project"
    
    async def test_update_project(self, client: AsyncClient, auth_headers: dict, test_project: Project):
        """Test updating project"""
        response = await client.put(
            f"/api/v1/projects/{test_project.id}",
            headers=auth_headers,
            json={
                "name": "Updated Project",
                "description": "Updated description"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Project"
    
    async def test_delete_project(self, client: AsyncClient, auth_headers: dict, test_project: Project):
        """Test deleting project"""
        response = await client.delete(
            f"/api/v1/projects/{test_project.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 204
    
    async def test_unauthorized_access(self, client: AsyncClient):
        """Test accessing projects without authentication"""
        response = await client.get("/api/v1/projects")
        assert response.status_code == 401


class TestTaskEndpoints:
    """Test task management endpoints"""
    
    async def test_create_task(self, client: AsyncClient, auth_headers: dict, test_project: Project):
        """Test task creation"""
        response = await client.post(
            "/api/v1/tasks",
            headers=auth_headers,
            json={
                "name": "New Task",
                "description": "A new task",
                "project_id": test_project.id,
                "priority": "normal"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Task"
        assert data["status"] == "pending"
    
    async def test_list_tasks(self, client: AsyncClient, auth_headers: dict, test_task: AuditTask):
        """Test listing tasks"""
        response = await client.get(
            "/api/v1/tasks",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) > 0
    
    async def test_get_task(self, client: AsyncClient, auth_headers: dict, test_task: AuditTask):
        """Test getting task details"""
        response = await client.get(
            f"/api/v1/tasks/{test_task.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_task.id
        assert data["name"] == "Test Task"
    
    async def test_cancel_task(self, client: AsyncClient, auth_headers: dict, test_task: AuditTask):
        """Test canceling task"""
        response = await client.put(
            f"/api/v1/tasks/{test_task.id}/cancel",
            headers=auth_headers
        )
        
        # Task is already completed, so this should fail
        assert response.status_code in [400, 409]


class TestIssueEndpoints:
    """Test issue management endpoints"""
    
    @pytest.fixture
    async def test_issue(self, db_session: AsyncSession, test_task: AuditTask) -> AuditIssue:
        """Create a test issue"""
        issue = AuditIssue(
            task_id=test_task.id,
            file_path="src/test.py",
            line_number=10,
            severity=IssueSeverity.HIGH,
            category=IssueCategory.SECURITY,
            title="Security Issue",
            description="A security issue",
            code_snippet="print('test')",
            suggestion="Fix the issue"
        )
        db_session.add(issue)
        await db_session.commit()
        await db_session.refresh(issue)
        return issue
    
    async def test_list_issues(self, client: AsyncClient, auth_headers: dict, test_issue: AuditIssue):
        """Test listing issues"""
        response = await client.get(
            "/api/v1/issues",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) > 0
    
    async def test_get_issue(self, client: AsyncClient, auth_headers: dict, test_issue: AuditIssue):
        """Test getting issue details"""
        response = await client.get(
            f"/api/v1/issues/{test_issue.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_issue.id
        assert data["title"] == "Security Issue"
    
    async def test_update_issue(self, client: AsyncClient, auth_headers: dict, test_issue: AuditIssue):
        """Test updating issue"""
        response = await client.put(
            f"/api/v1/issues/{test_issue.id}",
            headers=auth_headers,
            json={
                "status": "resolved"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "resolved"


class TestReportEndpoints:
    """Test report management endpoints"""
    
    async def test_create_report(self, client: AsyncClient, auth_headers: dict, test_task: AuditTask):
        """Test report creation"""
        response = await client.post(
            "/api/v1/reports",
            headers=auth_headers,
            json={
                "task_id": test_task.id,
                "format": "markdown",
                "include_code_snippets": True,
                "include_suggestions": True
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["task_id"] == test_task.id
        assert data["format"] == "markdown"
        assert data["status"] == "pending"
    
    async def test_list_reports(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_task: AuditTask, test_user: User):
        """Test listing reports"""
        # Create a report first
        report = Report(
            task_id=test_task.id,
            format="json",
            status="completed",
            created_by=test_user.id
        )
        db_session.add(report)
        await db_session.commit()
        
        response = await client.get(
            "/api/v1/reports",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) > 0
    
    async def test_get_report(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_task: AuditTask, test_user: User):
        """Test getting report details"""
        # Create a report first
        report = Report(
            task_id=test_task.id,
            format="json",
            status="completed",
            created_by=test_user.id
        )
        db_session.add(report)
        await db_session.commit()
        await db_session.refresh(report)
        
        response = await client.get(
            f"/api/v1/reports/{report.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == report.id


class TestStatisticsEndpoints:
    """Test statistics endpoints"""
    
    async def test_get_overview(self, client: AsyncClient, auth_headers: dict, test_task: AuditTask):
        """Test getting overview statistics"""
        response = await client.get(
            "/api/v1/statistics/overview",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "total_projects" in data
        assert "total_tasks" in data
        assert "total_issues" in data
    
    async def test_get_trends(self, client: AsyncClient, auth_headers: dict):
        """Test getting trend statistics"""
        response = await client.get(
            "/api/v1/statistics/trends",
            headers=auth_headers,
            params={"days": 30}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "daily_stats" in data
    
    async def test_get_quality_metrics(self, client: AsyncClient, auth_headers: dict, test_project: Project):
        """Test getting quality metrics"""
        response = await client.get(
            f"/api/v1/statistics/quality/{test_project.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "project_id" in data


class TestInputValidation:
    """Test input validation"""
    
    async def test_invalid_email_format(self, client: AsyncClient):
        """Test registration with invalid email"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "invalid-email",
                "username": "testuser",
                "password": "SecurePass123!"
            }
        )
        
        assert response.status_code == 422
    
    async def test_weak_password(self, client: AsyncClient):
        """Test registration with weak password"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "username": "testuser",
                "password": "weak"
            }
        )
        
        assert response.status_code == 422
    
    async def test_missing_required_fields(self, client: AsyncClient, auth_headers: dict):
        """Test creating project without required fields"""
        response = await client.post(
            "/api/v1/projects",
            headers=auth_headers,
            json={
                "name": "Test"
                # Missing source_type and source_url
            }
        )
        
        assert response.status_code == 422


class TestErrorHandling:
    """Test error handling"""
    
    async def test_not_found(self, client: AsyncClient, auth_headers: dict):
        """Test accessing non-existent resource"""
        response = await client.get(
            "/api/v1/projects/99999",
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    async def test_unauthorized(self, client: AsyncClient):
        """Test accessing protected endpoint without auth"""
        response = await client.get("/api/v1/projects")
        assert response.status_code == 401
    
    async def test_invalid_token(self, client: AsyncClient):
        """Test accessing with invalid token"""
        response = await client.get(
            "/api/v1/projects",
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code == 401
