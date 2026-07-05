import datetime
import enum
from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, func, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class MonitorType(str, enum.Enum):
    STANDARD = "STANDARD"        # Normal endpoint, expects 200
    SECURE_EDGE = "SECURE_EDGE"  # Behind Vercel/Cloudflare-style edge firewall;
                                  # 403/401 on automated probes is expected, not downtime


class Monitor(Base):
    __tablename__ = "monitors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)

    check_interval: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # NEW: classification driving alert-rule branching
    monitor_type: Mapped[MonitorType] = mapped_column(
        Enum(MonitorType), default=MonitorType.STANDARD, nullable=False
    )

    # NEW: explicit, per-monitor list of status codes considered "up".
    # STANDARD monitors default to [200]; SECURE_EDGE monitors can be
    # configured as [200, 401, 403] since those codes prove the edge
    # node is alive and responding, just gatekeeping automated clients.
    expected_status_codes: Mapped[list[int]] = mapped_column(
        JSON, default=lambda: [200], nullable=False
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    incidents = relationship("Incident", back_populates="monitor", cascade="all, delete-orphan")
    health_checks = relationship("HealthCheck", back_populates="monitor", cascade="all, delete-orphan")
    user = relationship("User", back_populates="monitors")