import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Float, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String, index=True)
    repo_id: Mapped[str | None] = mapped_column(String, nullable=True)
    sentry_issue_id: Mapped[str | None] = mapped_column(String, nullable=True)
    title: Mapped[str] = mapped_column(String(500))
    severity: Mapped[str] = mapped_column(String(5), default="P2")  # P1-P4
    status: Mapped[str] = mapped_column(String(20), default="active")
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_fix: Mapped[str | None] = mapped_column(Text, nullable=True)
    affected_files: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array string
    users_affected: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    mttr: Mapped[int | None] = mapped_column(Integer, nullable=True)  # minutes
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    messages: Mapped[list["IncidentMessage"]] = relationship(back_populates="incident", cascade="all, delete")


class IncidentMessage(Base):
    __tablename__ = "incident_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    author_name: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)
    is_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    incident: Mapped["Incident"] = relationship(back_populates="messages")
