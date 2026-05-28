from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.integration import Integration
from app.schemas.integration import IntegrationCreate, IntegrationResponse

router = APIRouter(prefix="/integrations", tags=["Notification Engine"])

@router.get("/", response_model=List[IntegrationResponse])
async def get_integrations(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetches all notification profiles owned by the logged-in operator."""
    query = select(Integration).where(Integration.user_id == current_user.id)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def create_integration(payload: IntegrationCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Registers a fresh outbound communication link."""
    new_hook = Integration(
        user_id=current_user.id,
        name=payload.name,
        channel_type=payload.channel_type,
        webhook_url=payload.webhook_url,
        is_active=True
    )
    db.add(new_hook)
    await db.commit()
    await db.refresh(new_hook)
    return new_hook

@router.patch("/{integration_id}/toggle")
async def toggle_integration(integration_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Toggles active processing states on or off cleanly."""
    query = select(Integration).where(Integration.id == integration_id, Integration.user_id == current_user.id)
    res = await db.execute(query)
    hook = res.scalar_one_or_none()
    if not hook:
        raise HTTPException(status_code=404, detail="Integration profile not located.")
    
    hook.is_active = not hook.is_active
    await db.commit()
    return {"status": "updated", "is_active": hook.is_active}

@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_integration(integration_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Permanently drops an active webhook link from the database."""
    query = select(Integration).where(Integration.id == integration_id, Integration.user_id == current_user.id)
    res = await db.execute(query)
    hook = res.scalar_one_or_none()
    if not hook:
        raise HTTPException(status_code=404, detail="Integration profile not located.")
    
    await db.delete(hook)
    await db.commit()
    return