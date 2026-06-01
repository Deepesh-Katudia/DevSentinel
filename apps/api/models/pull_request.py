import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.database import Base


class PullRequest(Base):
    __tablename__ = "pull_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String, index=True)
    repo_id: Mapped[str] = mapped_column(ForeignKey("repos.id", ondelete="CASCADE"))
    github_pr_number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(500))
    author_github_login: Mapped[str] = mapped_column(String(120))
    head_branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    review_score: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    summary: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    comments: Mapped[list["ReviewComment"]] = relationship(back_populates="pull_request", cascade="all, delete")


class ReviewComment(Base):
    __tablename__ = "review_comments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    pull_request_id: Mapped[str] = mapped_column(ForeignKey("pull_requests.id", ondelete="CASCADE"))
    file_path: Mapped[str] = mapped_column(String(500))
    line_number: Mapped[int] = mapped_column(Integer)
    severity: Mapped[str] = mapped_column(String(20))  # critical|warning|info
    body: Mapped[str] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    pull_request: Mapped["PullRequest"] = relationship(back_populates="comments")
