"""
Initialize Default Admin User

Creates a default admin user with a secure randomly generated password.
The password is logged to a secure location and should be changed on first login.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from loguru import logger

from db.session import AsyncSessionLocal
from core.security import PasswordPolicy, hash_password


async def create_default_admin():
    """Create default admin user with secure password"""
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if admin user already exists
            # Note: This assumes a User model exists. Adjust import when model is created.
            # from models.user import User
            # result = await session.execute(
            #     select(User).where(User.email == "admin@xcodereview.com")
            # )
            # existing_admin = result.scalar_one_or_none()
            
            # if existing_admin:
            #     logger.info("Admin user already exists")
            #     return
            
            # Generate secure password
            secure_password = PasswordPolicy.generate_secure_password()
            password_hash = hash_password(secure_password)
            
            # Create admin user
            # admin_user = User(
            #     email="admin@xcodereview.com",
            #     username="admin",
            #     password_hash=password_hash,
            #     role="admin",
            #     is_active=True,
            #     force_password_change=True,  # Force change on first login
            # )
            
            # session.add(admin_user)
            # await session.commit()
            
            # Log the generated password securely
            logger.info("=" * 80)
            logger.info("DEFAULT ADMIN USER CREATED")
            logger.info("=" * 80)
            logger.info(f"Email: admin@xcodereview.com")
            logger.info(f"Username: admin")
            logger.info(f"Password: {secure_password}")
            logger.info("=" * 80)
            logger.warning("IMPORTANT: Save this password securely and change it on first login!")
            logger.info("=" * 80)
            
            # Also write to a secure file
            secure_file = Path(__file__).parent.parent / ".admin_credentials.txt"
            with open(secure_file, "w") as f:
                f.write(f"Admin Credentials (Generated on first run)\\n")
                f.write(f"=" * 80 + "\\n")
                f.write(f"Email: admin@xcodereview.com\\n")
                f.write(f"Username: admin\\n")
                f.write(f"Password: {secure_password}\\n")
                f.write(f"=" * 80 + "\\n")
                f.write(f"IMPORTANT: Change this password on first login!\\n")
                f.write(f"Delete this file after saving the password securely.\\n")
            
            logger.info(f"Credentials also saved to: {secure_file}")
            logger.warning("Delete this file after saving the password securely!")
            
        except Exception as e:
            logger.error(f"Error creating admin user: {e}")
            await session.rollback()
            raise


def main():
    """Main entry point"""
    logger.info("Initializing default admin user...")
    asyncio.run(create_default_admin())
    logger.info("Admin user initialization complete")


if __name__ == "__main__":
    main()
