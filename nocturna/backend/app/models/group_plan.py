from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, UniqueConstraint

from app.core.db import Base


class GroupPlan(Base):
    __tablename__ = "group_plans"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    invite_token = Column(String, unique=True, index=True, nullable=False)
    city = Column(String, default="rome", nullable=False)
    requested_for = Column(DateTime, nullable=False)
    title = Column(String, nullable=True)
    options = Column(JSON, default=list, nullable=False)
    # options: [{plan_id, label, summary}]
    status = Column(String, default="open", nullable=False)
    # open|closed|booked
    selected_plan_id = Column(Integer, ForeignKey("plans.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class GroupVote(Base):
    __tablename__ = "group_votes"
    __table_args__ = (UniqueConstraint("group_plan_id", "voter_token", name="ux_vote_per_voter"),)

    id = Column(Integer, primary_key=True, index=True)
    group_plan_id = Column(Integer, ForeignKey("group_plans.id", ondelete="CASCADE"), nullable=False)
    voter_token = Column(String, nullable=False)  # cookie/device id when not authed
    voter_name = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    plan_id = Column(Integer, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    vibe_pref = Column(String, nullable=True)
    budget_pref = Column(String, nullable=True)
    music_pref = Column(String, nullable=True)
    neighborhood_pref = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
