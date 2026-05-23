import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class HealthCheckBase(BaseModel):
    status_code: Optional[int] = Field(None, ge=100, le=599, description="Captured standard HTTP status code")
    latency_ms: int = Field(..., ge=0, description="Server response window execution in milliseconds")
    error_message: Optional[str] = Field(None, max_length=500, description="Captured string network errors if unreachable")

# Input payload schema passed from Service B (Worker Nodes) to Kafka/FastAPI
class HealthCheckCreate(HealthCheckBase):
    monitor_id: int

# Output layout to supply the real-time UI data updates, graphs, and Tremor lines
class HealthCheckResponse(HealthCheckBase):
    id: int
    monitor_id: int
    timestamp: datetime.datetime

    model_config = ConfigDict(from_attributes=True)