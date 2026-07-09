"""Per-account feature override — the deploy-free flag toggle (notes §5.2).

Tier defaults (core/entitlements.FEATURE_MIN_TIER) decide what a plan
unlocks. A `FeatureOverride` row flips one feature on or off for one
restaurant regardless of tier — so support can grant a pilot an extra
module, or a Trattoria can trial a Ristorante feature, with a single DB
row and no deploy. Absence of a row = use the tier default.
"""
import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint

from ..core.database import Base


class FeatureOverride(Base):
    __tablename__ = "feature_overrides"
    __table_args__ = (UniqueConstraint("user_id", "feature", name="uq_feature_override"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    feature = Column(String(50), nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
