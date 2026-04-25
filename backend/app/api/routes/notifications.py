from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notes = notification_service.get_unread(db, current_user.id)
    return [
        {
            "id": n.id,
            "message": n.message,
            "link": n.link,
            "created_at": n.created_at.isoformat(),
        }
        for n in notes
    ]


@router.patch("/read")
def mark_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification_service.mark_all_read(db, current_user.id)
    return {"ok": True}
