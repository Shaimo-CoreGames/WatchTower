from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# 1. Create the asynchronous database engine with connection pooling optimized for high I/O
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # Set to True if you need to debug raw SQL queries in your terminal
    pool_size=20,
    max_overflow=10,
)

# 2. Create the session maker bound to our async engine
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)

# 3. Base class for declarative ORM models
class Base(DeclarativeBase):
    pass

# 4. Dependency injector to provide standalone async database sessions to endpoints
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()