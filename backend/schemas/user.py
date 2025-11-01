"""User Schemas"""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import datetime
from typing import Optional
from models.user import UserRole


class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)


class UserCreate(UserBase):
    """Schema for creating a user"""
    password: str = Field(..., min_length=12, max_length=100)
    role: UserRole = UserRole.USER
    
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{
                "email": "user@example.com",
                "username": "johndoe",
                "full_name": "John Doe",
                "password": "SecurePass123!@#",
                "role": "user"
            }]
        }
    )


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str
    
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{
                "email": "user@example.com",
                "password": "SecurePass123!@#"
            }]
        }
    )


class UserUpdate(BaseModel):
    """Schema for updating a user"""
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)
    avatar_url: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """Schema for user response"""
    id: int
    role: UserRole
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """Schema for token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
