import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user_optional
from app.models import ChatMessage, ChatThread, User
from app.services import ai_chat

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatStartIn(BaseModel):
    city: str = "rome"


class ChatSendIn(BaseModel):
    session_token: str
    message: str


@router.post("/start")
def start(
    payload: ChatStartIn,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    t = ChatThread(
        user_id=user.id if user else None,
        session_token=secrets.token_urlsafe(12),
        city=payload.city,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    greeting = (
        "Ciao! I'm your Nocturna concierge. Tell me where you are, your vibe, "
        "your budget, and who you're with — I'll plan tonight."
    )
    db.add(ChatMessage(thread_id=t.id, role="assistant", content=greeting))
    db.commit()
    return {"session_token": t.session_token, "greeting": greeting}


@router.post("/send")
def send(payload: ChatSendIn, db: Session = Depends(get_db)):
    t = db.query(ChatThread).filter(ChatThread.session_token == payload.session_token).first()
    if not t:
        raise HTTPException(404, "Thread not found")
    return ai_chat.chat(db, t, payload.message)


@router.get("/{token}")
def history(token: str, db: Session = Depends(get_db)):
    t = db.query(ChatThread).filter(ChatThread.session_token == token).first()
    if not t:
        raise HTTPException(404, "Thread not found")
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.thread_id == t.id)
        .order_by(ChatMessage.id.asc())
        .all()
    )
    return {
        "session_token": t.session_token,
        "city": t.city,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "tool_payload": m.tool_payload,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in msgs
        ],
    }
