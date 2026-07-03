from sqlalchemy.orm import Session
from ..models.notification import Notification


def create(db: Session, user_id: int, message: str, link: str | None = None,
           *, push_title: str = "SavoryMind", push: bool = True) -> None:
    """Create an in-app notification and, best-effort, deliver it as a native
    push if the user has an Expo token. Push failures never affect the
    in-app row."""
    db.add(Notification(user_id=user_id, message=message, link=link))
    if push:
        try:
            from . import push_service
            push_service.send_to_user(db, user_id, push_title, message,
                                      data={"link": link} if link else None)
        except Exception:
            pass


def get_unread(db: Session, user_id: int) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.read == False)  # noqa: E712
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )


def mark_all_read(db: Session, user_id: int) -> None:
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.read == False,  # noqa: E712
    ).update({"read": True})
    db.commit()
