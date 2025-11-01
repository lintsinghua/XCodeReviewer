"""End-to-End Workflow Tests
Tests complete user workflows from start to finish.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio

from app.main import app
from models.user import User
from models.project import Project, ProjectSource
from models.audit_task import AuditTask, TaskStatus
from core.security import get_password_hash


@pytest.fixture
async def test_client():
    """Create test client"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
async def authenticated_user(db_session: AsyncSession):
    """Create and authenticate a test user"""
    user = User(
        email="e2e@example.com",
        username="e2euser",
        hashed_password=get_password_hash("TestPass123!"),
        is_active=True,
        role="user"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def auth_token(test_client: AsyncClient, authenticated_user: User):
    """Get authentication token"""
    response = await test_client.post(
        "/api/v1/auth/login",
        json={
            "username": "e2euser",
            "password": "TestPass123!"
        }
    )
    assert response.status_code == 200
    return response.json()["access_token"]


class TestCompleteAnalysisWorkflow:
    """Test complete code analysis workflow"""
    
    @pytest.mark.asyncio
    async def test_full_analysis_workflow(
        self,
        test_client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession
    ):
        """
        Test complete workflow:
        1. Create project
        2. Create analysis task
        3. Monitor task progress
        4. View results
        5. Generate report
        6. Download report
        """
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Step 1: Create project
        project_response = await test_client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "name": "E2E Test Project",
                "description": "End-to-end test project",
                "source_type": "github",
                "source_url": "https://github.com/test/repo",
                "branch": "main"
            }
        )
        assert project_response.status_code == 201
        project = project_response.json()
        project_id = project["id"]
        
        # Step 2: Create analysis task
        task_response = await test_client.post(
            "/api/v1/tasks",
            headers=headers,
            json={
                "name": "E2E Analysis Task",
                "description": "Test analysis",
                "project_id": project_id,
                "priority": "normal"
            }
        )
        assert task_response.status_code == 201
        task = task_response.json()
        task_id = task["id"]
        
        # Step 3: Monitor task progress
        # In real scenario, task would be processed by Celery
        # For testing, we'll check task status
        task_status_response = await test_client.get(
            f"/api/v1/tasks/{task_id}",
            headers=headers
        )
        assert task_status_response.status_code == 200
        task_status = task_status_response.json()
        assert task_status["id"] == task_id
        
        # Step 4: View issues (if any)
        issues_response = await test_client.get(
            "/api/v1/issues",
            headers=headers,
            params={"task_id": task_id}
        )
        assert issues_response.status_code == 200
        
        # Step 5: Generate report
        report_response = await test_client.post(
            "/api/v1/reports",
            headers=headers,
            json={
                "task_id": task_id,
                "format": "json",
                "include_code_snippets": True,
                "include_suggestions": True
            }
        )
        assert report_response.status_code == 201
        report = report_response.json()
        report_id = report["id"]
        
        # Step 6: Check report status
        report_status_response = await test_client.get(
            f"/api/v1/reports/{report_id}",
            headers=headers
        )
        assert report_status_response.status_code == 200
        
        # Cleanup
        await test_client.delete(f"/api/v1/projects/{project_id}", headers=headers)


class TestUserJourney:
    """Test typical user journey"""
    
    @pytest.mark.asyncio
    async def test_new_user_onboarding(self, test_client: AsyncClient):
        """Test new user registration and first project"""
        
        # Step 1: Register
        register_response = await test_client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "username": "newuser",
                "password": "SecurePass123!"
            }
        )
        assert register_response.status_code == 201
        
        # Step 2: Login
        login_response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "username": "newuser",
                "password": "SecurePass123!"
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 3: View dashboard (statistics)
        stats_response = await test_client.get(
            "/api/v1/statistics/overview",
            headers=headers
        )
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert stats["total_projects"] == 0
        
        # Step 4: Create first project
        project_response = await test_client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "name": "My First Project",
                "source_type": "github",
                "source_url": "https://github.com/user/repo"
            }
        )
        assert project_response.status_code == 201
        
        # Step 5: View updated statistics
        stats_response2 = await test_client.get(
            "/api/v1/statistics/overview",
            headers=headers
        )
        assert stats_response2.status_code == 200
        stats2 = stats_response2.json()
        assert stats2["total_projects"] == 1


class TestMultiAgentAnalysis:
    """Test multi-agent analysis workflow"""
    
    @pytest.mark.asyncio
    async def test_multi_agent_coordination(
        self,
        test_client: AsyncClient,
        auth_token: str
    ):
        """Test analysis with multiple agents"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create project
        project_response = await test_client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "name": "Multi-Agent Test",
                "source_type": "github",
                "source_url": "https://github.com/test/repo"
            }
        )
        project_id = project_response.json()["id"]
        
        # Create task with specific agents
        task_response = await test_client.post(
            "/api/v1/tasks",
            headers=headers,
            json={
                "name": "Multi-Agent Analysis",
                "project_id": project_id,
                "agents_used": {
                    "security": True,
                    "performance": True,
                    "quality": True
                }
            }
        )
        assert task_response.status_code == 201
        task = task_response.json()
        
        # Verify agents configuration
        assert task["agents_used"] is not None


class TestReportGeneration:
    """Test report generation workflow"""
    
    @pytest.mark.asyncio
    async def test_multiple_report_formats(
        self,
        test_client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
        authenticated_user: User
    ):
        """Test generating reports in different formats"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create project and task
        project = Project(
            name="Report Test Project",
            source_type=ProjectSource.GITHUB,
            source_url="https://github.com/test/repo",
            owner_id=authenticated_user.id
        )
        db_session.add(project)
        await db_session.commit()
        await db_session.refresh(project)
        
        task = AuditTask(
            name="Report Test Task",
            project_id=project.id,
            created_by=authenticated_user.id,
            status=TaskStatus.COMPLETED,
            total_issues=5
        )
        db_session.add(task)
        await db_session.commit()
        await db_session.refresh(task)
        
        # Generate JSON report
        json_report = await test_client.post(
            "/api/v1/reports",
            headers=headers,
            json={
                "task_id": task.id,
                "format": "json"
            }
        )
        assert json_report.status_code == 201
        
        # Generate Markdown report
        md_report = await test_client.post(
            "/api/v1/reports",
            headers=headers,
            json={
                "task_id": task.id,
                "format": "markdown"
            }
        )
        assert md_report.status_code == 201
        
        # List all reports
        reports_list = await test_client.get(
            "/api/v1/reports",
            headers=headers,
            params={"task_id": task.id}
        )
        assert reports_list.status_code == 200
        reports = reports_list.json()
        assert reports["total"] >= 2


class TestErrorHandling:
    """Test error handling in workflows"""
    
    @pytest.mark.asyncio
    async def test_invalid_project_creation(
        self,
        test_client: AsyncClient,
        auth_token: str
    ):
        """Test error handling for invalid project"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Missing required fields
        response = await test_client.post(
            "/api/v1/projects",
            headers=headers,
            json={"name": "Test"}
        )
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_unauthorized_access(self, test_client: AsyncClient):
        """Test unauthorized access handling"""
        
        # No token
        response = await test_client.get("/api/v1/projects")
        assert response.status_code == 401
        
        # Invalid token
        response = await test_client.get(
            "/api/v1/projects",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_resource_not_found(
        self,
        test_client: AsyncClient,
        auth_token: str
    ):
        """Test 404 handling"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = await test_client.get(
            "/api/v1/projects/99999",
            headers=headers
        )
        assert response.status_code == 404


class TestConcurrentOperations:
    """Test concurrent operations"""
    
    @pytest.mark.asyncio
    async def test_concurrent_project_creation(
        self,
        test_client: AsyncClient,
        auth_token: str
    ):
        """Test creating multiple projects concurrently"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        async def create_project(index: int):
            return await test_client.post(
                "/api/v1/projects",
                headers=headers,
                json={
                    "name": f"Concurrent Project {index}",
                    "source_type": "github",
                    "source_url": f"https://github.com/test/repo{index}"
                }
            )
        
        # Create 5 projects concurrently
        tasks = [create_project(i) for i in range(5)]
        responses = await asyncio.gather(*tasks)
        
        # All should succeed
        for response in responses:
            assert response.status_code == 201


class TestDataConsistency:
    """Test data consistency across operations"""
    
    @pytest.mark.asyncio
    async def test_cascade_delete(
        self,
        test_client: AsyncClient,
        auth_token: str
    ):
        """Test that deleting project cascades to tasks and issues"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create project
        project_response = await test_client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "name": "Cascade Test",
                "source_type": "github",
                "source_url": "https://github.com/test/repo"
            }
        )
        project_id = project_response.json()["id"]
        
        # Create task
        task_response = await test_client.post(
            "/api/v1/tasks",
            headers=headers,
            json={
                "name": "Test Task",
                "project_id": project_id
            }
        )
        task_id = task_response.json()["id"]
        
        # Delete project
        delete_response = await test_client.delete(
            f"/api/v1/projects/{project_id}",
            headers=headers
        )
        assert delete_response.status_code == 204
        
        # Verify task is also deleted
        task_check = await test_client.get(
            f"/api/v1/tasks/{task_id}",
            headers=headers
        )
        assert task_check.status_code == 404
