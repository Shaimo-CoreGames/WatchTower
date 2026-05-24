from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.monitor import Monitor
from app.schemas.monitor import MonitorCreate, MonitorUpdate, MonitorResponse

router = APIRouter(prefix="/monitors", tags=["Monitor Configurations"])


@router.post("/", response_model=MonitorResponse, status_code=status.HTTP_201_CREATED)
async def create_monitor(
    monitor_in: MonitorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Spins up a new web target or API connection configuration profile tied to 
    the active authenticated user account.
    """
    new_monitor = Monitor(
        name=monitor_in.name,
        url=monitor_in.url,
        check_interval=monitor_in.check_interval,
        is_active=monitor_in.is_active,
        user_id=current_user.id
    )
    
    db.add(new_monitor)
    await db.commit()
    await db.refresh(new_monitor)
    return new_monitor


@router.get("/", response_model=List[MonitorResponse])
async def list_user_monitors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches all active and paused monitor configurations belonging exclusively
    to the authenticated user context.
    """
    query = select(Monitor).where(Monitor.user_id == current_user.id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{monitor_id}", response_model=MonitorResponse)
async def get_monitor_by_id(
    monitor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the granular configuration metrics for a single explicit monitor target.
    """
    query = select(Monitor).where(Monitor.id == monitor_id, Monitor.user_id == current_user.id)
    result = await db.execute(query)
    monitor = result.scalars().first()
    
    if not monitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested monitor was not found or you lack permission to view it."
        )
    return monitor


@router.patch("/{monitor_id}", response_model=MonitorResponse)
async def update_monitor(
    monitor_id: int,
    monitor_in: MonitorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Handles partial modifications (PATCH updates) to target structures like 
    toggling active status or modifying tracking paths.
    """
    query = select(Monitor).where(Monitor.id == monitor_id, Monitor.user_id == current_user.id)
    result = await db.execute(query)
    monitor = result.scalars().first()
    
    if not monitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested monitor target does not exist or you lack editing clearance."
        )
        
    # Unpack update attributes type-safely using Pydantic extraction loops
    update_data = monitor_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(monitor, key, value)
        
    await db.commit()
    await db.refresh(monitor)
    return monitor


@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_monitor(
    monitor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Removes a target entirely from the tracking dashboard ecosystem along with all 
    cascading historical metric time-series logs.
    """
    query = select(Monitor).where(Monitor.id == monitor_id, Monitor.user_id == current_user.id)
    result = await db.execute(query)
    monitor = result.scalars().first()
    
    if not monitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested monitor profile was not found."
        )
        
    await db.delete(monitor)
    await db.commit()
    return None