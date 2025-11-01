"""User Model"""

from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List
import enum

from db.base import Base


class UserRole(str, enum.Enum):
    """User role enumeration"""
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"


class User(Base):
    """User model for authentication and authorization"""
    
    __tablename__ = "users"
    
    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # Authentication
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Profile
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(500), nullable=True)
    
    # Authorization
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole),
        default=UserRole.USER,
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Security
    force_password_change: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(default=0, nullable=False)
    locked_until: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
    
    # Relationships
    projects: Mapped[List["Project"]] = relationship(
        "Project",
        back_populates="owner",
        cascade="all, delete-orphan"
    )
    
    audit_tasks: Mapped[List["AuditTask"]] = relationship(
        "AuditTask",
        back_populates="created_by_user",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
    
    @property
    def is_admin(self) -> bool:
        """Check if user is admin"""
        return self.role == UserRole.ADMIN
    
    @property
    def is_locked(self) -> bool:
        """Check if account is locked"""
        if self.locked_until is None:
            return False
        return datetime.utcnow() < self.locked_until
