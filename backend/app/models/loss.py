"""Loss Estimate Engine data model.

A `LossEstimate` is a versioned, immutable snapshot of "how much this
restaurant is losing per month" produced by `loss_engine`. Estimates
improve as data improves (profile-only → quick-audit → sales import),
so we never overwrite — each run is a new version, and the latest is
what the dashboard/reveal shows. The full input snapshot + evidence is
persisted so every euro on screen is traceable and auditable later.
"""
import datetime

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text

from ..core.database import Base


class LossEstimate(Base):
    __tablename__ = "loss_estimates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)

    # Which data path produced this estimate: "profile" | "audit" | "import".
    data_path = Column(String(20), nullable=False, default="profile")

    total_monthly_loss_low = Column(Float, nullable=False, default=0.0)
    total_monthly_loss_high = Column(Float, nullable=False, default=0.0)

    # breakdown: JSON list of {category, amount_low, amount_high, evidence[], confidence}
    breakdown_json = Column(Text, nullable=False, default="[]")
    # inputs_snapshot: JSON of the profile ranges + audit answers used, so the
    # figure is reproducible and every € traces to an input.
    inputs_json = Column(Text, nullable=False, default="{}")

    # Honest-guarantee hook (notes §4.1.5): if total_high < 500 the trial does
    # not auto-convert and the account is flagged for Bruno's review.
    guarantee_triggered = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
