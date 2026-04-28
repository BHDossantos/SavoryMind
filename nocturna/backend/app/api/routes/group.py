import secrets
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user_optional
from app.models import GroupPlan, GroupVote, Plan, User

router = APIRouter(prefix="/api/groups", tags=["groups"])


class GroupCreateIn(BaseModel):
    title: Optional[str] = None
    city: str = "rome"
    requested_for: datetime
    plan_ids: List[int] = Field(default_factory=list)


@router.post("")
def create_group(
    payload: GroupCreateIn,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    plans = db.query(Plan).filter(Plan.id.in_(payload.plan_ids)).all() if payload.plan_ids else []
    options = [{"plan_id": p.id, "label": p.plan_label, "vibe_score": p.vibe_score} for p in plans]
    g = GroupPlan(
        creator_id=user.id if user else None,
        invite_token=secrets.token_urlsafe(10),
        city=payload.city,
        requested_for=payload.requested_for,
        title=payload.title,
        options=options,
        status="open",
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return _group_dict(g, db)


class VoteIn(BaseModel):
    plan_id: int
    voter_token: str
    voter_name: Optional[str] = None
    vibe_pref: Optional[str] = None
    budget_pref: Optional[str] = None
    music_pref: Optional[str] = None
    neighborhood_pref: Optional[str] = None


@router.post("/{token}/vote")
def vote(
    token: str,
    payload: VoteIn,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    g = db.query(GroupPlan).filter(GroupPlan.invite_token == token).first()
    if not g:
        raise HTTPException(404, "Group not found")
    if g.status != "open":
        raise HTTPException(400, "Voting closed")
    existing = (
        db.query(GroupVote)
        .filter(GroupVote.group_plan_id == g.id, GroupVote.voter_token == payload.voter_token)
        .first()
    )
    if existing:
        existing.plan_id = payload.plan_id
        existing.voter_name = payload.voter_name or existing.voter_name
        existing.vibe_pref = payload.vibe_pref
        existing.budget_pref = payload.budget_pref
        existing.music_pref = payload.music_pref
        existing.neighborhood_pref = payload.neighborhood_pref
    else:
        db.add(GroupVote(
            group_plan_id=g.id,
            voter_token=payload.voter_token,
            voter_name=payload.voter_name,
            user_id=user.id if user else None,
            plan_id=payload.plan_id,
            vibe_pref=payload.vibe_pref,
            budget_pref=payload.budget_pref,
            music_pref=payload.music_pref,
            neighborhood_pref=payload.neighborhood_pref,
        ))
    db.commit()
    return _group_dict(g, db)


@router.get("/{token}")
def get_group(token: str, db: Session = Depends(get_db)):
    g = db.query(GroupPlan).filter(GroupPlan.invite_token == token).first()
    if not g:
        raise HTTPException(404, "Group not found")
    return _group_dict(g, db)


@router.post("/{token}/close")
def close_group(token: str, db: Session = Depends(get_db), user: Optional[User] = Depends(get_current_user_optional)):
    g = db.query(GroupPlan).filter(GroupPlan.invite_token == token).first()
    if not g:
        raise HTTPException(404, "Group not found")
    if user and g.creator_id and g.creator_id != user.id:
        raise HTTPException(403, "Only creator can close")
    votes = db.query(GroupVote).filter(GroupVote.group_plan_id == g.id).all()
    if votes:
        tally: dict[int, int] = {}
        for v in votes:
            tally[v.plan_id] = tally.get(v.plan_id, 0) + 1
        winner = max(tally, key=tally.get)
        g.selected_plan_id = winner
    g.status = "closed"
    db.commit()
    return _group_dict(g, db)


def _group_dict(g: GroupPlan, db: Session) -> dict:
    votes = db.query(GroupVote).filter(GroupVote.group_plan_id == g.id).all()
    tally: dict[int, int] = {}
    for v in votes:
        tally[v.plan_id] = tally.get(v.plan_id, 0) + 1
    return {
        "id": g.id,
        "invite_token": g.invite_token,
        "title": g.title,
        "city": g.city,
        "requested_for": g.requested_for.isoformat() if g.requested_for else None,
        "status": g.status,
        "selected_plan_id": g.selected_plan_id,
        "options": g.options,
        "tally": tally,
        "votes": [
            {
                "voter_name": v.voter_name,
                "plan_id": v.plan_id,
                "vibe_pref": v.vibe_pref,
                "budget_pref": v.budget_pref,
                "music_pref": v.music_pref,
                "neighborhood_pref": v.neighborhood_pref,
            }
            for v in votes
        ],
    }
