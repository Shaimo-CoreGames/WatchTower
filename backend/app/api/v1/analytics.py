from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.monitor import Monitor
from app.models.health_check import HealthCheck
from app.schemas.health_check import HealthCheckResponse

from fastapi import APIRouter, WebSocket, WebSocketDisconnect


router = APIRouter()

@router.get("/analytics/monitor/{monitor_id}", response_model=List[HealthCheckResponse])
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
    return list(reversed(records))


@router.get("/analytics/global-stats")
async def get_global_stats(db: AsyncSession = Depends(get_db)):
    """
    Computes global system-wide uptime statistics and average network 
    latency across all registered target monitors dynamically.
    """
    # 1. Calculate Average Network Latency
    latency_query = select(func.avg(HealthCheck.latency_ms)).where(HealthCheck.status_code.isnot(None))
    latency_result = await db.execute(latency_query)
    avg_latency = latency_result.scalar() or 0
    
    # 2. Compute Global System Uptime Percentage
    # Formula: (Total Successful 200 Checks / Total Executed Checks) * 100
    total_query = select(func.count(HealthCheck.id))
    success_query = select(func.count(HealthCheck.id)).where(HealthCheck.status_code == 200)
    
    total_res = await db.execute(total_query)
    success_res = await db.execute(success_query)
    
    total_count = total_res.scalar() or 0
    success_count = success_res.scalar() or 0
    
    uptime_percentage = 100.0
    if total_count > 0:
        uptime_percentage = (success_count / total_count) * 100
        
    # 3. Get Active Channel Count
    active_monitors_query = select(func.count(Monitor.id)).where(Monitor.is_active == True)
    total_monitors_query = select(func.count(Monitor.id))
    
    active_res = await db.execute(active_monitors_query)
    total_res_monitors = await db.execute(total_monitors_query)
    
    active_count = active_res.scalar() or 0
    total_count_monitors = total_res_monitors.scalar() or 0

    return {
        "global_uptime": round(uptime_percentage, 2),
        "avg_latency": int(avg_latency),
        "active_channels": f"{active_count} / {total_count_monitors}"
    }