"""
Custom Exception Hierarchy

Defines application-specific exceptions for better error handling and debugging.
"""

from typing import Any, Dict, Optional


class XCodeReviewerException(Exception):
    """
    Base exception for all custom exceptions in XCodeReviewer.
    
    All custom exceptions should inherit from this class.
    """

    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize exception.
        
        Args:
            message: Human-readable error message
            code: Error code for programmatic handling
            details: Additional error details
        """
        super().__init__(message)
        self.message = message
        self.code = code or self.__class__.__name__
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary format"""
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }

    def __str__(self) -> str:
        """String representation of exception"""
        if self.details:
            return f"{self.message} (details: {self.details})"
        return self.message


class AuthenticationError(XCodeReviewerException):
    """
    Raised when authentication fails.
    
    Examples:
    - Invalid credentials
    - Expired token
    - Missing authentication
    """

    def __init__(
        self,
        message: str = "Authentication failed",
        code: str = "AUTHENTICATION_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, code, details)


class AuthorizationError(XCodeReviewerException):
    """
    Raised when user lacks required permissions.
    
    Examples:
    - Insufficient permissions
    - Role mismatch
    - Resource access denied
    """

    def __init__(
        self,
        message: str = "Authorization failed",
        code: str = "AUTHORIZATION_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, code, details)


class RateLimitExceeded(XCodeReviewerException):
    """
    Raised when rate limit is exceeded.
    
    Includes retry_after information for client guidance.
    """

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        code: str = "RATE_LIMIT_EXCEEDED",
        retry_after: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        if details is None:
            details = {}
        if retry_after is not None:
            details["retry_after"] = retry_after
        
        super().__init__(message, code, details)
        self.retry_after = retry_after


class CircuitBreakerOpen(XCodeReviewerException):
    """
    Raised when circuit breaker is open.
    
    Indicates that a service is temporarily unavailable due to repeated failures.
    """

    def __init__(
        self,
        service_name: str,
        message: Optional[str] = None,
        code: str = "CIRCUIT_BREAKER_OPEN",
        details: Optional[Dict[str, Any]] = None
    ):
        if message is None:
            message = f"Circuit breaker is open for service: {service_name}"
        
        if details is None:
            details = {}
        details["service_name"] = service_name
        
        super().__init__(message, code, details)
        self.service_name = service_name


class LLMProviderError(XCodeReviewerException):
    """
    Raised when LLM provider fails.
    
    Examples:
    - API timeout
    - Invalid API key
    - Rate limit from provider
    - Service unavailable
    """

    def __init__(
        self,
        provider: str,
        message: str,
        code: str = "LLM_PROVIDER_ERROR",
        original_error: Optional[Exception] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        if details is None:
            details = {}
        details["provider"] = provider
        if original_error:
            details["original_error"] = str(original_error)
        
        super().__init__(message, code, details)
        self.provider = provider
        self.original_error = original_error


class ValidationError(XCodeReviewerException):
    """
    Raised when input validation fails.
    
    Examples:
    - Invalid request parameters
    - Schema validation failure
    - Business rule violation
    """

    def __init__(
        self,
        message: str = "Validation failed",
        code: str = "VALIDATION_ERROR",
        field: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        if details is None:
            details = {}
        if field:
            details["field"] = field
        
        super().__init__(message, code, details)
        self.field = field


class ResourceNotFoundError(XCodeReviewerException):
    """
    Raised when a requested resource is not found.
    
    Examples:
    - Project not found
    - Task not found
    - User not found
    """

    def __init__(
        self,
        resource_type: str,
        resource_id: str,
        message: Optional[str] = None,
        code: str = "RESOURCE_NOT_FOUND",
        details: Optional[Dict[str, Any]] = None
    ):
        if message is None:
            message = f"{resource_type} not found: {resource_id}"
        
        if details is None:
            details = {}
        details["resource_type"] = resource_type
        details["resource_id"] = resource_id
        
        super().__init__(message, code, details)
        self.resource_type = resource_type
        self.resource_id = resource_id


class DatabaseError(XCodeReviewerException):
    """
    Raised when database operation fails.
    
    Examples:
    - Connection failure
    - Query timeout
    - Constraint violation
    """

    def __init__(
        self,
        message: str = "Database operation failed",
        code: str = "DATABASE_ERROR",
        operation: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        if details is None:
            details = {}
        if operation:
            details["operation"] = operation
        
        super().__init__(message, code, details)
        self.operation = operation


class CacheError(XCodeReviewerException):
    """
    Raised when cache operation fails.
    
    Examples:
    - Redis connection failure
    - Cache key error
    - Serialization failure
    """

    def __init__(
        self,
        message: str = "Cache operation failed",
        code: str = "CACHE_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, code, details)


class TaskError(XCodeReviewerException):
    """
    Raised when task processing fails.
    
    Examples:
    - Task execution failure
    - Task timeout
    - Task cancellation
    """

    def __init__(
        self,
        task_id: str,
        message: str,
        code: str = "TASK_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        if details is None:
            details = {}
        details["task_id"] = task_id
        
        super().__init__(message, code, details)
        self.task_id = task_id


class RepositoryScanError(XCodeReviewerException):
    """
    Raised when repository scanning fails.
    
    Examples:
    - GitHub API failure
    - GitLab API failure
    - ZIP extraction failure
    - Invalid repository
    """

    def __init__(
        self,
        message: str,
        code: str = "REPOSITORY_SCAN_ERROR",
        source_type: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        if details is None:
            details = {}
        if source_type:
            details["source_type"] = source_type
        
        super().__init__(message, code, details)
        self.source_type = source_type


# Alias for convenience
RepositoryError = RepositoryScanError


class ConfigurationError(XCodeReviewerException):
    """
    Raised when configuration is invalid or missing.
    
    Examples:
    - Missing environment variable
    - Invalid configuration value
    - Configuration file not found
    """

    def __init__(
        self,
        message: str,
        code: str = "CONFIGURATION_ERROR",
        config_key: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        if details is None:
            details = {}
        if config_key:
            details["config_key"] = config_key
        
        super().__init__(message, code, details)
        self.config_key = config_key


# Aliases for convenience
NotFoundError = ResourceNotFoundError
