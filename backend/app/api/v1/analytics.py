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


# 🟢 FIX 3: Clean path string evaluation (maps cleanly to /api/v1/analytics/global-stats)
@router.get("/global-stats")
async def get_global_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)  # Scopes total checks counts safely to the user
):
    """
    Aggregates dashboard-wide tracking statistics, status percentages, and mean processing latency.
    """
    # 1. Compute rolling user-specific telemetry parameters
    latency_query = (
        select(cast(func.avg(HealthCheck.latency_ms), Integer))
        .join(Monitor, HealthCheck.monitor_id == Monitor.id)
        .where(Monitor.user_id == current_user.id, HealthCheck.latency_ms.isnot(None))
    )
    latency_res = await db.execute(latency_query)
    avg_latency = latency_res.scalar() or 0

    # 2. Extract uptime percentages
    total_query = select(func.count(HealthCheck.id)).join(Monitor).where(Monitor.user_id == current_user.id)
    success_query = select(func.count(HealthCheck.id)).join(Monitor).where(Monitor.user_id == current_user.id, HealthCheck.status_code == 200)
    
    total_count = (await db.execute(total_query)).scalar() or 0
    success_count = (await db.execute(success_query)).scalar() or 0
    
    uptime_percentage = 100.0 if total_count == 0 else round((success_count / total_count) * 100, 2)

    # 3. Compile structural channel allocations
    total_monitors = (await db.execute(select(func.count(Monitor.id)).where(Monitor.user_id == current_user.id))).scalar() or 0
    active_monitors = (await db.execute(select(func.count(Monitor.id)).where(Monitor.user_id == current_user.id, Monitor.is_active == True))).scalar() or 0

    return {
        "global_uptime": uptime_percentage,
        "avg_latency": avg_latency,
        "active_channels": f"{active_monitors} / {total_monitors}"
    }