from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Integration(Base):
    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # "Slack Webhook", "Discord Webhook", or "Generic Custom HTTP Webhook"
    channel_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    
    # Destination notification target URI string credentials
    webhook_url = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Inverse relation mapping
    user = relationship("User")