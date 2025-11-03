"""create_default_admin_user

Revision ID: fb855179f3f0
Revises: 9a275bba67b4
Create Date: 2025-11-03 12:58:09.128799

"""
from typing import Sequence, Union
from datetime import datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column, String, DateTime, Boolean
from passlib.context import CryptContext


# revision identifiers, used by Alembic.
revision: str = 'fb855179f3f0'
down_revision: Union[str, None] = '9a275bba67b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def upgrade() -> None:
    """Create default admin user if not exists"""
    
    # Define users table for bulk insert
    users_table = table(
        'users',
        column('username', String),
        column('email', String),
        column('password_hash', String),
        column('full_name', String),
        column('role', String),
        column('is_active', Boolean),
        column('is_verified', Boolean),
        column('created_at', DateTime),
        column('updated_at', DateTime),
    )
    
    # Check if admin user already exists
    connection = op.get_bind()
    result = connection.execute(
        sa.text("SELECT COUNT(*) FROM users WHERE username = 'admin'")
    ).scalar()
    
    if result == 0:
        # Create default admin user
        admin_password = "Admin123!"  # Default password for development
        hashed_password = pwd_context.hash(admin_password)
        now = datetime.utcnow()
        
        op.bulk_insert(
            users_table,
            [
                {
                    'username': 'admin',
                    'email': 'admin@example.com',
                    'password_hash': hashed_password,
                    'full_name': 'Administrator',
                    'role': 'admin',  # UserRole.ADMIN
                    'is_active': True,
                    'is_verified': True,
                    'created_at': now,
                    'updated_at': now,
                }
            ]
        )
        print("✅ Default admin user created successfully!")
        print(f"   Username: admin")
        print(f"   Password: {admin_password}")
        print(f"   ⚠️  Please change the password in production!")
    else:
        print("✅ Admin user already exists, skipping creation.")


def downgrade() -> None:
    """Remove default admin user"""
    connection = op.get_bind()
    connection.execute(
        sa.text("DELETE FROM users WHERE username = 'admin' AND email = 'admin@example.com'")
    )
    print("✅ Default admin user removed.")
