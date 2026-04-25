from sqlalchemy.orm import Session
from ..models.notification import Notification


def create(db: Session, user_id: int, message: str, link: str | None = None) -> None:
    db.add(Notification(user_id=user_id, message=message, link=link))


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
