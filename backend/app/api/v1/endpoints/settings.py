from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.monitor import Monitor
from app.models.health_check import HealthCheck
from app.models.incident import Incident

router = APIRouter(prefix="/settings", tags=["System Settings"])

@router.get("/system-stats")
async def get_system_stats(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Fetches real-time system row counts and database engine performance diagnostics."""
    # Count rows across tables to show database metrics live
    monitor_count = (await db.execute(select(text("COUNT(*) FROM monitors")))).scalar() or 0
    check_count = (await db.execute(select(text("COUNT(*) FROM health_checks")))).scalar() or 0
    incident_count = (await db.execute(select(text("COUNT(*) FROM incidents")))).scalar() or 0
    
    return {
        "operator": {
            "name": "Shah Meer",
            "role": "Lead Systems Administrator",
            "joined": "September 2024"
        },
        "database_stats": {
            "engine": "PostgreSQL 15",
            "status": "CONNECTED",
            "total_monitors_provisioned": monitor_count,
            "total_telemetry_rows": check_count,
            "total_incidents_logged": incident_count
        },
        "retention_policy_days": 30
    }

@router.post("/purge-metrics")
async def purge_old_metrics(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Deletes old telemetry data to optimize database storage space."""
    # Production database optimization utility command
    await db.execute(text("DELETE FROM health_checks WHERE timestamp < NOW() - INTERVAL '30 days'"))
    await db.commit()
    return {"message": "Successfully purged telemetry data older than 30 days."}