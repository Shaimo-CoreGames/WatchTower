from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime

class IntegrationCreate(BaseModel):
    name: str
    channel_type: str  # "Slack" or "Discord"
    webhook_url: str   # Valid URL string

class IntegrationResponse(BaseModel):
    id: int
    name: str
    channel_type: str
    webhook_url: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True