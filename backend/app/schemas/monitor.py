import datetime
from pydantic import BaseModel, Field, HttpUrl, ConfigDict

class MonitorBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["Primary API Gateway"])
    # We accept a string but validate its shape; string format preserves relative routing paths if needed
    url: str = Field(..., min_length=4, max_length=2048, examples=["https://api.watchtower.io"])
    check_interval: int = Field(default=60, ge=10, le=86400, description="Interval in seconds. Minimum 10s constraint.")
    is_active: bool = Field(default=True, description="Toggle to pause/resume monitoring pings")

# Payload configuration required to build a new target
class MonitorCreate(MonitorBase):
    pass

# Update payload validation (All fields become optional for partial PATCH operations)
class MonitorUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    check_interval: int | None = None
    is_active: bool | None = None

# Comprehensive payload representation returned to the frontend
class MonitorResponse(MonitorBase):
    id: int
    user_id: int
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)