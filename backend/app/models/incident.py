
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    monitor_id = Column(Integer, ForeignKey("monitors.id", ondelete="CASCADE"), nullable=False)
    
    # Granular detail regarding what caused the crash (e.g., "500 Internal Server Error" or "Timeout")
    error_details = Column(String, nullable=True)
    
    # Timestamps to measure Mean Time to Repair (MTTR)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    
    is_resolved = Column(Boolean, default=False, nullable=False)

    # Relationship linking back to the parent target profile configuration
    monitor = relationship("Monitor", back_populates="incidents")