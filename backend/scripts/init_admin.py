"""
Initialize Default Admin User

Creates a default admin user on first application startup.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from loguru import logger

from db.session import AsyncSessionLocal
from models.user import User, UserRole
from core.security import get_password_hash


async def create_default_admin():
    """Create default admin user if not exists"""
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if any admin user already exists
            result = await session.execute(
                select(User).where(User.role == UserRole.ADMIN)
            )
            existing_admin = result.scalar_one_or_none()
            
            if existing_admin:
                logger.info(f"✅ Admin user already exists: {existing_admin.username}")
                return
            
            # Create default admin user with fixed credentials
            admin_password = "Admin123!"  # Default password for development
            password_hash = get_password_hash(admin_password)
            
            admin_user = User(
                email="admin@xcodereview.com",
                username="admin",
                password_hash=password_hash,
                full_name="Administrator",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            
            session.add(admin_user)
            await session.commit()
            
            # Log the credentials
            logger.info("=" * 80)
            logger.info("✅ DEFAULT ADMIN USER CREATED")
            logger.info("=" * 80)
            logger.info(f"📧 Email: admin@xcodereview.com")
            logger.info(f"👤 Username: admin")
            logger.info(f"🔑 Password: {admin_password}")
            logger.info("=" * 80)
            logger.warning("⚠️  IMPORTANT: Change this password in production!")
            logger.info("=" * 80)
            
        except Exception as e:
            logger.error(f"❌ Error creating admin user: {e}")
            await session.rollback()
            # Don't raise - allow app to continue even if admin creation fails


def main():
    """Main entry point"""
    logger.info("Initializing default admin user...")
    asyncio.run(create_default_admin())
    logger.info("Admin user initialization complete")


if __name__ == "__main__":
    main()
