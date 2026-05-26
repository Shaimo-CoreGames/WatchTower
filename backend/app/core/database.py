from typing import AsyncGenerator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

# ----------------------------------------------------
# 🌐 1. ASYNC SETUP (For FastAPI Web Endpoints Only)
# ----------------------------------------------------
# This reads your string exactly as it is: postgresql+asyncpg://...
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=20,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# ----------------------------------------------------
# ⚙️ 2. SYNC SETUP (For Celery Background Tasks Only)
# ----------------------------------------------------
# 💡 Dynamically replaces the driver scheme so SQLAlchemy can connect synchronously
SYNC_DATABASE_URL = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

sync_engine = create_engine(
    SYNC_DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=5,
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)

# ----------------------------------------------------
# 🏛️ 3. DECLARATIVE BASE
# ----------------------------------------------------
class Base(DeclarativeBase):
    pass