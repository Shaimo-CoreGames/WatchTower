import datetime
from sqlalchemy import Integer, String, ForeignKey, DateTime, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class HealthCheck(Base):
    __tablename__ = "health_checks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    monitor_id: Mapped[int] = mapped_column(ForeignKey("monitors.id", ondelete="CASCADE"), index=True, nullable=False)
    
    # Performance Metrics
    status_code: Mapped[int] = mapped_column(Integer, nullable=True)  # e.g., 200, 404, 502
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)   # Response delay tracking down to millisecond precision
    error_message: Mapped[str] = mapped_column(String(500), nullable=True) # Logs explicit exceptions if target fails entirely
    
    # Accurate execution mark
    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
    )

    # Inside class HealthCheck(Base):
    monitor = relationship("Monitor", back_populates="health_checks")
    # Composite indexing configuration for historical range lookup optimization
    __table_args__ = (
        Index("idx_monitor_timestamp", "monitor_id", "timestamp"),
    )