"""SavoryMind's business agent (ported from Jennifer), for admins only.

Gated behind the same ADMIN_EMAILS allowlist as the pilots view, and off
until BUSINESS_AGENT_ENABLED=true and ANTHROPIC_API_KEY are set on the
server. The agent only proposes: the result is returned here and nothing
is sent, posted, stored or changed. The model sees aggregate counts only,
never names or contact details.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...business_agent import BUSINESS_AGENT, SHARED_APPROVALS, run_business_task
from ...business_agent.provider import agent_off_reason, provider_from_env
from ...core.database import get_db
from ...models.loss import LossEstimate
from ...models.user import User
from .admin_pilots import require_admin

router = APIRouter(prefix="/admin/business-agent", tags=["admin"])


class RunRequest(BaseModel):
    taskId: str = Field(max_length=40)
    # Optional notes from the admin, such as replies to look at. Treated as untrusted.
    notes: Optional[str] = Field(default=None, max_length=8000)


def _counts(db: Session) -> List[Dict[str, Any]]:
    restaurants = db.query(User).filter(User.account_type == "restaurant")
    total = restaurants.count()
    if not total:
        return []
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
    onboarded = restaurants.filter(User.onboarding_completed.is_(True)).count()
    recent = restaurants.filter(User.created_at >= since).count()
    with_estimate = db.query(LossEstimate.user_id).distinct().count()
    return [{
        "sourceId": "app:restaurants",
        "title": "SavoryMind restaurant accounts",
        "trusted": True,
        "text": f"Restaurant accounts: {total}. Onboarded: {onboarded}. New in the last 30 days: {recent}. With a loss estimate: {with_estimate}.",
    }]


@router.get("")
def charter(_admin: User = Depends(require_admin)):
    return {"agent": BUSINESS_AGENT, "sharedApprovals": SHARED_APPROVALS, "off": agent_off_reason()}


@router.post("/run")
def run(body: RunRequest, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    off = agent_off_reason()
    if off:
        raise HTTPException(status_code=503, detail=off)
    evidence = _counts(db)
    if body.notes:
        evidence.append({"sourceId": "admin:notes", "title": "Notes from the admin", "text": body.notes})
    return run_business_task(BUSINESS_AGENT, body.taskId, evidence, model=provider_from_env())
