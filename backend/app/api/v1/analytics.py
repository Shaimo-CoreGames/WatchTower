from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import cast, Integer, func

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.monitor import Monitor
from app.models.health_check import HealthCheck
from app.schemas.health_check import HealthCheckResponse  # Verify this schema path matches your project structure
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

# 🟢 FIX 1: Explicitly tie the sub-route prefix to /analytics right here
router = APIRouter(prefix="/analytics", tags=["Analytics Telemetry"])


# 🟢 FIX 2: Route parameter mapped relative to the prefix string (evaluates to /api/v1/analytics/monitor/{monitor_id})
@router.get("/monitor/{monitor_id}", response_model=List[HealthCheckResponse])
async def get_monitor_metrics(
    monitor_id: int,
    limit: int = Query(default=30, ge=1, le=100, description="Max time-series log entries to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches sequential validation logs for a target monitor to render dashboard sparklines.
    """
    # Verify ownership and existence constraints
    monitor_query = select(Monitor).where(Monitor.id == monitor_id, Monitor.user_id == current_user.id)
    monitor_result = await db.execute(monitor_query)
    if not monitor_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The target monitor profile was not found or access is denied."
        )

    # Query metrics backwards sequentially
    metrics_query = (
        select(HealthCheck)
        .where(HealthCheck.monitor_id == monitor_id)
        .order_by(HealthCheck.timestamp.desc())
        .limit(limit)
    )
    metrics_result = await db.execute(metrics_query)
    records = metrics_result.scalars().all()
    
    # Reverse entries to sort them chronologically (left-to-right) on the frontend sparkline charts
    return list(reversed(records))

@router.get("/global-stats")
async def get_global_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Aggregates dashboard-wide tracking statistics, status percentages, and mean 
    processing latency bounded strictly to a rolling 24-hour transaction matrix.
    """
    # 1. Check if the user even has any targets provisioned
    total_monitors = (await db.execute(
        select(func.count(Monitor.id)).where(Monitor.user_id == current_user.id)
    )).scalar() or 0

    # 🛡️ IMMEDIATE ZERO-CASE FALLBACK: Wipes the slate clean if everything is deleted
    if total_monitors == 0:
        return {
            "global_uptime": 100.00,
            "avg_latency": 0,
            "active_channels": "0 / 0"
        }

    # ⏰ Define our strict 24-hour evaluation boundary
    time_boundary = datetime.now(timezone.utc) - timedelta(hours=24)

    # 2. Compute rolling 24-hour average latency
    latency_query = (
        select(cast(func.avg(HealthCheck.latency_ms), Integer))
        .join(Monitor, HealthCheck.monitor_id == Monitor.id)
        .where(
            Monitor.user_id == current_user.id,
            HealthCheck.timestamp >= time_boundary,
            HealthCheck.latency_ms > 0, # Exclude total drops/connection drops from latency averages
            HealthCheck.status_code == 200 # Average latency should only track working responses
        )
    )
    latency_res = await db.execute(latency_query)
    avg_latency = latency_res.scalar() or 0

    # 3. Compute rolling 24-hour uptime values
    total_query = (
        select(func.count(HealthCheck.id))
        .join(Monitor)
        .where(Monitor.user_id == current_user.id, HealthCheck.timestamp >= time_boundary)
    )
    success_query = (
        select(func.count(HealthCheck.id))
        .join(Monitor)
        .where(
            Monitor.user_id == current_user.id, 
            HealthCheck.timestamp >= time_boundary, 
            HealthCheck.status_code == 200
        )
    )
    
    total_count = (await db.execute(total_query)).scalar() or 0
    success_count = (await db.execute(success_query)).scalar() or 0
    
    # If the app just booted up and has zero checks in the last 24h, report nominal health
    uptime_percentage = 100.0 if total_count == 0 else round((success_count / total_count) * 100, 2)

    # 4. Compile channel allocations
    active_monitors = (await db.execute(
        select(func.count(Monitor.id)).where(Monitor.user_id == current_user.id, Monitor.is_active == True)
    )).scalar() or 0

    return {
        "global_uptime": uptime_percentage,
        "avg_latency": avg_latency,
        "active_channels": f"{active_monitors} / {total_monitors}"
    }
class LatencySparklineSchema(BaseModel):
    id: int
    latency_ms: int
    status_code: int  # 🎯 FIX: Add this property to your data validation engine
    timestamp: datetime

    class Config:
        from_attributes = True


@router.get("/monitor/{monitor_id}/sparkline", response_model=list[LatencySparklineSchema])
async def get_monitor_sparkline(monitor_id: int, db: AsyncSession = Depends(get_db)):
    """
    Returns the last 40 latency metrics ordered chronologically 
    to match frontend sparkline slicing windows precisely.
    """
    query = (
        select(HealthCheck)
        .where(HealthCheck.monitor_id == monitor_id)
        .order_by(HealthCheck.timestamp.desc())
        .limit(40)  # 🎯 FIXED: Increased from 20 to 40 to match UI state sync limits
    )
    result = await db.execute(query)
    metrics = result.scalars().all()
    
    mutable_metrics = list(metrics)
    mutable_metrics.reverse()
    return mutable_metrics