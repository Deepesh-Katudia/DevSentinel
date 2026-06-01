import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    plan: Mapped[str] = mapped_column(String(20), default="free")
    stripe_customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # GitHub App integration
    github_app_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    github_app_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    github_webhook_secret: Mapped[str | None] = mapped_column(String, nullable=True)
    github_private_key: Mapped[str | None] = mapped_column(String, nullable=True)
    github_installation_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    members: Mapped[list["Member"]] = relationship(back_populates="org", cascade="all, delete")
    repos: Mapped[list["Repo"]] = relationship(back_populates="org", cascade="all, delete")


class Member(Base):
    __tablename__ = "members"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String, index=True)  # Supabase user ID (sub claim)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="member")
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    org: Mapped["Organization"] = relationship(back_populates="members")


class Repo(Base):
    __tablename__ = "repos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    github_repo_id: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    installation_id: Mapped[int] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    org: Mapped["Organization"] = relationship(back_populates="repos")


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    email: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[str] = mapped_column(String(20), default="member")
    invited_by: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    org: Mapped["Organization"] = relationship()


class BranchAssignment(Base):
    __tablename__ = "branch_assignments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    repo_id: Mapped[str] = mapped_column(ForeignKey("repos.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String)        # Supabase user ID of the assigned engineer
    branch_name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[str] = mapped_column(String)     # Supabase user ID of the admin who assigned

    org: Mapped["Organization"] = relationship()
    repo: Mapped["Repo"] = relationship()
