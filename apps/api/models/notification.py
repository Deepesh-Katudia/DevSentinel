import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.database import Base


class NotificationChannel(Base):
    __tablename__ = "notification_channels"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    channel_type: Mapped[str] = mapped_column(String(20), default="email")
    name: Mapped[str] = mapped_column(String(120))
    config: Mapped[str] = mapped_column(Text)   # JSON: {"emails": [...]}
    events: Mapped[str] = mapped_column(Text)   # JSON: ["incident_created", "pr_review_completed"]
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    org: Mapped["Organization"] = relationship()  # type: ignore[name-defined]
