#!/usr/bin/env python3
"""
创建管理员用户脚本
用于快速创建一个管理员账户用于开发测试
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

from core.config import settings
from models.user import User
from db.base import Base


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_admin_user():
    """创建管理员用户"""
    
    # 创建数据库引擎
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=True,
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
                print("❌ 管理员用户已存在！")
                print(f"   用户名: {existing_admin.username}")
                print(f"   邮箱: {existing_admin.email}")
                return
            
            # 创建管理员用户
            admin_password = "Admin123!"  # 开发环境默认密码
            hashed_password = pwd_context.hash(admin_password)
            
            admin_user = User(
                username="admin",
                email="admin@example.com",
                hashed_password=hashed_password,
                full_name="Administrator",
                role="admin",
                is_active=True,
                is_superuser=True,
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
            await session.rollback()
            raise
        finally:
            await engine.dispose()


async def create_test_users():
    """创建测试用户"""
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    test_users = [
        {
            "username": "developer",
            "email": "dev@example.com",
            "password": "Dev123!",
            "full_name": "Developer User",
            "role": "user",
        },
        {
            "username": "tester",
            "email": "test@example.com",
            "password": "Test123!",
            "full_name": "Test User",
            "role": "user",
        },
    ]
    
    async with async_session() as session:
        try:
            from sqlalchemy import select
            
            for user_data in test_users:
                # 检查用户是否已存在
                result = await session.execute(
                    select(User).where(User.username == user_data["username"])
                )
                existing_user = result.scalar_one_or_none()
                
                if existing_user:
                    print(f"⚠️  用户 {user_data['username']} 已存在，跳过")
                    continue
                
                # 创建用户
                hashed_password = pwd_context.hash(user_data["password"])
                user = User(
                    username=user_data["username"],
                    email=user_data["email"],
                    hashed_password=hashed_password,
                    full_name=user_data["full_name"],
                    role=user_data["role"],
                    is_active=True,
                )
                
                session.add(user)
                print(f"✅ 创建测试用户: {user_data['username']}")
            
            await session.commit()
            print("\n✅ 所有测试用户创建完成！")
            
        except Exception as e:
            print(f"❌ 创建测试用户失败: {e}")
            await session.rollback()
            raise
        finally:
            await engine.dispose()


async def main():
    """主函数"""
    print("=" * 60)
    print("XCodeReviewer - 创建管理员和测试用户")
    print("=" * 60)
    print()
    
    # 创建管理员
    await create_admin_user()
    print()
    
    # 询问是否创建测试用户
    response = input("是否创建测试用户？(y/n): ").lower()
    if response == 'y':
        await create_test_users()
    
    print()
    print("=" * 60)
    print("完成！")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
