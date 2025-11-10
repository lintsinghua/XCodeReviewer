"""API Dependencies

Provides reusable dependencies for FastAPI endpoints including authentication,
authorization, and database session management.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status, WebSocket
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError, jwt

from app.config import settings
from db.session import get_db
from core.exceptions import AuthenticationError, AuthorizationError


# Security scheme
security = HTTPBearer()


async def get_current_user_ws(
    websocket: WebSocket,
    token: Optional[str] = None
):
    """
    Get current user from WebSocket connection (simplified).
    
    In production, implement proper token-based authentication.
    
    Args:
        websocket: WebSocket connection
        token: Optional JWT token
        
    Returns:
        User object or None
    """
    # Simplified - in production, validate token properly
    return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current authenticated user from JWT token.
    
    Args:
        credentials: HTTP Bearer token from request header
        db: Database session
        
    Returns:
        User object
        
    Raises:
        AuthenticationError: If token is invalid or user not found
    """
    from models.user import User
    from sqlalchemy import select
    
    token = credentials.credentials
    
    try:
        # Decode JWT token
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        
        user_id: str = payload.get("sub")
        if user_id is None:
            raise AuthenticationError("Invalid token: missing user ID")
            
    except JWTError as e:
        raise AuthenticationError(f"Invalid token: {str(e)}")
    
    # Query user from database
    result = await db.execute(
        select(User).where(User.id == int(user_id))
    )
    user = result.scalar_one_or_none()
    
    if user is None:
        raise AuthenticationError("User not found")
    
    if not user.is_active:
        raise AuthenticationError("User account is inactive")
    
    return user


async def get_current_admin_user(
    current_user = Depends(get_current_user),
):
    """
    Get current user and verify admin role.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        User object with admin role
        
    Raises:
        AuthorizationError: If user is not an admin
    """
    # Check if user has admin role
    user_role = current_user.get("role") if isinstance(current_user, dict) else getattr(current_user, "role", None)
    
    if user_role != "admin":
        raise AuthorizationError("Admin access required")
    
    return current_user


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user if authenticated, otherwise return None.
    Useful for endpoints that work with or without authentication.
    
    Args:
        credentials: Optional HTTP Bearer token
        db: Database session
        
    Returns:
        User object or None
    """
    if credentials is None:
        return None
    
    try:
        return await get_current_user(credentials, db)
    except (AuthenticationError, AuthorizationError):
        return None


async def require_admin(
    current_user = Depends(get_current_user),
):
    """
    Require admin role for the current user.
    Alias for get_current_admin_user for consistency.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        User object with admin role
        
    Raises:
        AuthorizationError: If user is not an admin
    """
    # Check if user has admin role
    from models.user import UserRole
    
    user_role = current_user.role if hasattr(current_user, 'role') else None
    
    if user_role != UserRole.ADMIN:
        raise AuthorizationError("Admin access required")
    
    return current_user
