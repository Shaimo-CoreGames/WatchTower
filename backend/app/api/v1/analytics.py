from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.monitor import Monitor
from app.models.health_check import HealthCheck
from app.schemas.health_check import HealthCheckResponse

router = APIRouter(prefix="/analytics", tags=["Analytics & Telemetry"])


@router.get("/monitor/{monitor_id}", response_model=List[HealthCheckResponse])
async def get_monitor_metrics(
    monitor_id: int,
    limit: int = Query(default=30, ge=1, le=100, description="Number of historical evaluation logs to pull"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches the latest time-series data entries for a specific monitor.
    Utilizes our composite B-Tree database indexes for rapid delivery.
    """
    # 1. Enforce rigorous permission scoping by verifying ownership of the monitor target
    monitor_query = select(Monitor).where(Monitor.id == monitor_id, Monitor.user_id == current_user.id)
    monitor_result = await db.execute(monitor_query)
    if not monitor_result.scalars().first():
        raise HTTPException(
            status_code=404,
            detail="The requested metric target does not exist or you lack viewing authorization."
        )

    # 2. Extract logs in reverse chronological order using the index, then flip for linear chart displays
    metrics_query = (
        select(HealthCheck)
        .where(HealthCheck.monitor_id == monitor_id)
        .order_by(HealthCheck.timestamp.desc())
        .limit(limit)
    )
    metrics_result = await db.execute(metrics_query)
    records = metrics_result.scalars().all()
    
    # Return chronologically ascending sequence (left-to-right temporal progression)
    return List(reversed(records))