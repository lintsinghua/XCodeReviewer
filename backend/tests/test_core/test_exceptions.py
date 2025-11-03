"""
Unit tests for custom exceptions
"""

import pytest
from core.exceptions import (
    XCodeReviewerException,
    AuthenticationError,
    AuthorizationError,
    RateLimitExceeded,
    CircuitBreakerOpen,
    LLMProviderError,
    ValidationError,
    ResourceNotFoundError,
    DatabaseError,
    CacheError,
    TaskError,
    RepositoryScanError,
    ConfigurationError,
)


class TestXCodeReviewerException:
    """Tests for base exception"""

    def test_basic_exception(self):
        """Test basic exception creation"""
        exc = XCodeReviewerException("Test error")
        
        assert str(exc) == "Test error"
        assert exc.message == "Test error"
        assert exc.code == "XCodeReviewerException"
        assert exc.details == {}

    def test_exception_with_code(self):
        """Test exception with custom code"""
        exc = XCodeReviewerException("Error", code="CUSTOM_ERROR")
        
        assert exc.code == "CUSTOM_ERROR"

    def test_exception_with_details(self):
        """Test exception with details"""
        details = {"field": "email", "value": "invalid"}
        exc = XCodeReviewerException("Error", details=details)
        
        assert exc.details == details
        assert "details:" in str(exc)

    def test_to_dict(self):
        """Test converting exception to dictionary"""
        exc = XCodeReviewerException(
            "Test error",
            code="TEST_ERROR",
            details={"key": "value"}
        )
        
        result = exc.to_dict()
        
        assert result["error"]["code"] == "TEST_ERROR"
        assert result["error"]["message"] == "Test error"
        assert result["error"]["details"] == {"key": "value"}


class TestAuthenticationError:
    """Tests for AuthenticationError"""

    def test_default_message(self):
        """Test default authentication error"""
        exc = AuthenticationError()
        
        assert exc.message == "Authentication failed"
        assert exc.code == "AUTHENTICATION_ERROR"

    def test_custom_message(self):
        """Test custom authentication error"""
        exc = AuthenticationError("Invalid token")
        
        assert exc.message == "Invalid token"

    def test_with_details(self):
        """Test authentication error with details"""
        exc = AuthenticationError(
            "Token expired",
            details={"token_type": "access"}
        )
        
        assert exc.details["token_type"] == "access"


class TestAuthorizationError:
    """Tests for AuthorizationError"""

    def test_default_message(self):
        """Test default authorization error"""
        exc = AuthorizationError()
        
        assert exc.message == "Authorization failed"
        assert exc.code == "AUTHORIZATION_ERROR"

    def test_custom_message(self):
        """Test custom authorization error"""
        exc = AuthorizationError("Admin access required")
        
        assert exc.message == "Admin access required"


class TestRateLimitExceeded:
    """Tests for RateLimitExceeded"""

    def test_default_message(self):
        """Test default rate limit error"""
        exc = RateLimitExceeded()
        
        assert exc.message == "Rate limit exceeded"
        assert exc.code == "RATE_LIMIT_EXCEEDED"
        assert exc.retry_after is None

    def test_with_retry_after(self):
        """Test rate limit with retry_after"""
        exc = RateLimitExceeded(retry_after=60)
        
        assert exc.retry_after == 60
        assert exc.details["retry_after"] == 60

    def test_custom_message_and_retry(self):
        """Test custom message with retry_after"""
        exc = RateLimitExceeded(
            "Too many requests",
            retry_after=120
        )
        
        assert exc.message == "Too many requests"
        assert exc.retry_after == 120


class TestCircuitBreakerOpen:
    """Tests for CircuitBreakerOpen"""

    def test_basic_creation(self):
        """Test basic circuit breaker error"""
        exc = CircuitBreakerOpen("llm_service")
        
        assert exc.service_name == "llm_service"
        assert "llm_service" in exc.message
        assert exc.code == "CIRCUIT_BREAKER_OPEN"

    def test_custom_message(self):
        """Test circuit breaker with custom message"""
        exc = CircuitBreakerOpen(
            "database",
            message="Database circuit breaker is open"
        )
        
        assert exc.message == "Database circuit breaker is open"
        assert exc.service_name == "database"

    def test_details_include_service(self):
        """Test that details include service name"""
        exc = CircuitBreakerOpen("api_service")
        
        assert exc.details["service_name"] == "api_service"


class TestLLMProviderError:
    """Tests for LLMProviderError"""

    def test_basic_creation(self):
        """Test basic LLM provider error"""
        exc = LLMProviderError("openai", "API timeout")
        
        assert exc.provider == "openai"
        assert exc.message == "API timeout"
        assert exc.details["provider"] == "openai"

    def test_with_original_error(self):
        """Test LLM error with original exception"""
        original = ValueError("Invalid API key")
        exc = LLMProviderError(
            "gemini",
            "Authentication failed",
            original_error=original
        )
        
        assert exc.original_error is original
        assert "Invalid API key" in exc.details["original_error"]

    def test_custom_code(self):
        """Test LLM error with custom code"""
        exc = LLMProviderError(
            "claude",
            "Rate limited",
            code="LLM_RATE_LIMIT"
        )
        
        assert exc.code == "LLM_RATE_LIMIT"


class TestValidationError:
    """Tests for ValidationError"""

    def test_default_message(self):
        """Test default validation error"""
        exc = ValidationError()
        
        assert exc.message == "Validation failed"
        assert exc.code == "VALIDATION_ERROR"
        assert exc.field is None

    def test_with_field(self):
        """Test validation error with field"""
        exc = ValidationError("Invalid email format", field="email")
        
        assert exc.field == "email"
        assert exc.details["field"] == "email"

    def test_custom_message(self):
        """Test validation error with custom message"""
        exc = ValidationError("Password too short", field="password")
        
        assert exc.message == "Password too short"


class TestResourceNotFoundError:
    """Tests for ResourceNotFoundError"""

    def test_basic_creation(self):
        """Test basic resource not found error"""
        exc = ResourceNotFoundError("Project", "proj-123")
        
        assert exc.resource_type == "Project"
        assert exc.resource_id == "proj-123"
        assert "Project not found: proj-123" in exc.message

    def test_custom_message(self):
        """Test resource not found with custom message"""
        exc = ResourceNotFoundError(
            "User",
            "user-456",
            message="User account does not exist"
        )
        
        assert exc.message == "User account does not exist"

    def test_details_include_resource_info(self):
        """Test that details include resource information"""
        exc = ResourceNotFoundError("Task", "task-789")
        
        assert exc.details["resource_type"] == "Task"
        assert exc.details["resource_id"] == "task-789"


class TestDatabaseError:
    """Tests for DatabaseError"""

    def test_default_message(self):
        """Test default database error"""
        exc = DatabaseError()
        
        assert exc.message == "Database operation failed"
        assert exc.code == "DATABASE_ERROR"

    def test_with_operation(self):
        """Test database error with operation"""
        exc = DatabaseError("Connection timeout", operation="SELECT")
        
        assert exc.operation == "SELECT"
        assert exc.details["operation"] == "SELECT"


class TestCacheError:
    """Tests for CacheError"""

    def test_default_message(self):
        """Test default cache error"""
        exc = CacheError()
        
        assert exc.message == "Cache operation failed"
        assert exc.code == "CACHE_ERROR"

    def test_custom_message(self):
        """Test cache error with custom message"""
        exc = CacheError("Redis connection failed")
        
        assert exc.message == "Redis connection failed"


class TestTaskError:
    """Tests for TaskError"""

    def test_basic_creation(self):
        """Test basic task error"""
        exc = TaskError("task-123", "Task execution failed")
        
        assert exc.task_id == "task-123"
        assert exc.message == "Task execution failed"
        assert exc.details["task_id"] == "task-123"

    def test_custom_code(self):
        """Test task error with custom code"""
        exc = TaskError(
            "task-456",
            "Task timeout",
            code="TASK_TIMEOUT"
        )
        
        assert exc.code == "TASK_TIMEOUT"


class TestRepositoryScanError:
    """Tests for RepositoryScanError"""

    def test_basic_creation(self):
        """Test basic repository scan error"""
        exc = RepositoryScanError("Failed to fetch repository")
        
        assert exc.message == "Failed to fetch repository"
        assert exc.code == "REPOSITORY_SCAN_ERROR"

    def test_with_source_type(self):
        """Test repository scan error with source type"""
        exc = RepositoryScanError(
            "GitHub API rate limit",
            source_type="github"
        )
        
        assert exc.source_type == "github"
        assert exc.details["source_type"] == "github"


class TestConfigurationError:
    """Tests for ConfigurationError"""

    def test_basic_creation(self):
        """Test basic configuration error"""
        exc = ConfigurationError("Missing API key")
        
        assert exc.message == "Missing API key"
        assert exc.code == "CONFIGURATION_ERROR"

    def test_with_config_key(self):
        """Test configuration error with config key"""
        exc = ConfigurationError(
            "Invalid value",
            config_key="DATABASE_URL"
        )
        
        assert exc.config_key == "DATABASE_URL"
        assert exc.details["config_key"] == "DATABASE_URL"


class TestExceptionInheritance:
    """Tests for exception inheritance"""

    def test_all_inherit_from_base(self):
        """Test that all exceptions inherit from base"""
        exceptions = [
            AuthenticationError(),
            AuthorizationError(),
            RateLimitExceeded(),
            CircuitBreakerOpen("service"),
            LLMProviderError("provider", "message"),
            ValidationError(),
            ResourceNotFoundError("type", "id"),
            DatabaseError(),
            CacheError(),
            TaskError("id", "message"),
            RepositoryScanError("message"),
            ConfigurationError("message"),
        ]
        
        for exc in exceptions:
            assert isinstance(exc, XCodeReviewerException)
            assert isinstance(exc, Exception)

    def test_can_catch_with_base_exception(self):
        """Test that base exception can catch all custom exceptions"""
        try:
            raise AuthenticationError("Test")
        except XCodeReviewerException as e:
            assert e.message == "Test"
