#!/usr/bin/env python3
"""
非交互式创建管理员用户脚本
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import settings
from models.user import User, UserRole
from core.security import get_password_hash


async def create_admin_user():
    """创建管理员用户"""
    
    # 创建数据库引擎
    engine = create_async_engine(
        str(settings.DATABASE_URL),
        echo=False,
    )
    
    # 创建会话工厂
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        try:
            # 检查管理员是否已存在
            from sqlalchemy import select
            result = await session.execute(
                select(User).where(User.username == "admin")
            )
            existing_admin = result.scalar_one_or_none()
            
            if existing_admin:
                print("✅ 管理员用户已存在！")
                print(f"   用户名: {existing_admin.username}")
                print(f"   邮箱: {existing_admin.email}")
                print(f"   角色: {existing_admin.role}")
                return
            
            # 创建管理员用户
            admin_password = "Admin123!"  # 开发环境默认密码
            hashed_password = get_password_hash(admin_password)
            
            admin_user = User(
                username="admin",
                email="admin@example.com",
                password_hash=hashed_password,
                full_name="Administrator",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            
            session.add(admin_user)
            await session.commit()
            await session.refresh(admin_user)
            
            print("✅ 管理员用户创建成功！")
            print(f"   用户名: {admin_user.username}")
            print(f"   邮箱: {admin_user.email}")
            print(f"   密码: {admin_password}")
            print(f"   角色: {admin_user.role}")
            print("\n⚠️  请在生产环境中立即修改密码！")
            
        except Exception as e:
            print(f"❌ 创建管理员用户失败: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    print("=" * 60)
    print("XCodeReviewer - 创建管理员用户")
    print("=" * 60)
    print()
    asyncio.run(create_admin_user())
    print()
    print("=" * 60)

