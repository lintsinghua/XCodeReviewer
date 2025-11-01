"""
Database Session Management

Provides async database session factory and dependency injection.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool, NullPool
from sqlalchemy import text
from typing import AsyncGenerator
from contextlib import asynccontextmanager

from app.config import settings


# Create engine based on configuration
if settings.USE_LOCAL_DB:
    # SQLite local mode
    engine = create_async_engine(
        settings.SQLITE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=settings.DEBUG,
    )
else:
    # PostgreSQL cloud mode
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        echo=settings.DEBUG,
    )

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Alias for compatibility
async_session_maker = AsyncSessionLocal


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Provides database session without auto-commit.
    Caller controls transaction boundaries.
    
    Usage:
        async with get_db_session() as session:
            user = User(...)
            session.add(user)
            await session.commit()  # Explicit commit
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for database sessions.
    
    Usage in endpoints:
        @app.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with get_db_session() as session:
        yield session


@asynccontextmanager
async def get_readonly_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Provides read-only database session.
    Prevents accidental modifications.
    """
    async with AsyncSessionLocal() as session:
        try:
            # Set session to read-only
            await session.execute(text("SET TRANSACTION READ ONLY"))
            yield session
        finally:
            await session.close()


@asynccontextmanager
async def atomic_transaction() -> AsyncGenerator[AsyncSession, None]:
    """
    Provides atomic transaction context.
    Automatically commits on success, rolls back on exception.
    
    Usage:
        async with atomic_transaction() as session:
            user = User(name="John")
            session.add(user)
            # Auto-commits when context exits successfully
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def atomic(func):
    """
    Decorator for atomic database operations.
    Wraps function in transaction that auto-commits on success.
    
    Usage:
        @atomic
        async def create_user(name: str):
            async with atomic_transaction() as session:
                user = User(name=name)
                session.add(user)
                return user
    """
    async def wrapper(*args, **kwargs):
        async with atomic_transaction() as session:
            # Inject session if function accepts it
            import inspect
            sig = inspect.signature(func)
            if 'session' in sig.parameters:
                kwargs['session'] = session
            return await func(*args, **kwargs)
    return wrapper
