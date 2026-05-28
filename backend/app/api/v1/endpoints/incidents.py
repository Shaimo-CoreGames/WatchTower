from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.incident import Incident
from app.models.monitor import Monitor

router = APIRouter(prefix="/incidents", tags=["Incidents Engine"])

@router.get("/")
async def list_incidents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches the historical and active incident logs for all monitors 
    belonging exclusively to the authenticated user context.
    """
    # Join with the Monitor table to filter logs safely by user_id
    query = (
        select(Incident)
        .join(Incident.monitor)
        .where(Monitor.user_id == current_user.id)
        .order_by(Incident.started_at.desc())
        .options(joinedload(Incident.monitor)) # Eagerly load monitor names/URLs
    )
    
    result = await db.execute(query)
    incidents = result.scalars().all()
    
    return [
        {
            "id": incident.id,
            "monitor_id": incident.monitor_id,
            "monitor_name": incident.monitor.name,
            "monitor_url": incident.monitor.url,
            "error_details": incident.error_details,
            "started_at": incident.started_at.isoformat(),
            "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
            "is_resolved": incident.is_resolved
        }
        for incident in incidents
    ]