"""Operations — tasks, checklists, compliance.

Wave E of the Restaurant OS (final module). Two surfaces:

  Tasks      — one-off / dated operational to-dos with a done flag.
  Checklists — reusable templates (Opening / Closing / Compliance) the
               operator instantiates into today's tasks in one tap.

Overdue tasks feed the dashboard Action Plan so nothing slips.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session

from ..models.restaurant_ext import ChecklistItem, ChecklistTemplate, OpsTask


class OperationsError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


# --- Tasks ------------------------------------------------------------------

def create_task(db: Session, user_id: int, *, title: str, category: str = "general",
                assignee: str = "", due_date: Optional[date] = None,
                source_template_id: Optional[int] = None) -> OpsTask:
    if not title.strip():
        raise OperationsError("Task title is required.")
    t = OpsTask(
        user_id=user_id, title=title.strip(), category=category or "general",
        assignee=(assignee or "").strip() or None, due_date=due_date,
        source_template_id=source_template_id,
    )
    db.add(t); db.commit(); db.refresh(t)
    return t


def set_done(db: Session, user_id: int, task_id: int, done: bool) -> Optional[OpsTask]:
    t = db.query(OpsTask).filter(OpsTask.id == task_id, OpsTask.user_id == user_id).first()
    if not t:
        return None
    t.done = done
    t.done_at = datetime.utcnow() if done else None
    db.commit(); db.refresh(t)
    return t


def delete_task(db: Session, user_id: int, task_id: int) -> bool:
    t = db.query(OpsTask).filter(OpsTask.id == task_id, OpsTask.user_id == user_id).first()
    if not t:
        return False
    db.delete(t); db.commit()
    return True


def _task_dict(t: OpsTask) -> dict:
    return {
        "id": t.id, "title": t.title, "category": t.category,
        "assignee": t.assignee, "due_date": str(t.due_date) if t.due_date else None,
        "done": t.done, "done_at": t.done_at.isoformat() if t.done_at else None,
    }


def today_tasks(db: Session, user_id: int, *, today: date | None = None) -> dict:
    """Tasks due today or earlier (undone carried forward) + undated open
    tasks. Grouped for the Operations page."""
    if today is None:
        today = date.today()
    rows = (
        db.query(OpsTask)
        .filter(
            OpsTask.user_id == user_id,
            ((OpsTask.due_date <= today) | (OpsTask.due_date.is_(None)) | (OpsTask.done == False)),  # noqa: E712
        )
        .order_by(OpsTask.done.asc(), OpsTask.due_date.asc().nullslast(), OpsTask.id)
        .all()
    )
    open_tasks = [t for t in rows if not t.done]
    done_tasks = [t for t in rows if t.done and t.due_date == today]
    overdue = [t for t in open_tasks if t.due_date and t.due_date < today]
    return {
        "open": [_task_dict(t) for t in open_tasks],
        "done": [_task_dict(t) for t in done_tasks],
        "overdue_count": len(overdue),
        "open_count": len(open_tasks),
    }


def overdue_tasks(db: Session, user_id: int, *, today: date | None = None) -> list[OpsTask]:
    if today is None:
        today = date.today()
    return (
        db.query(OpsTask)
        .filter(OpsTask.user_id == user_id, OpsTask.done == False,  # noqa: E712
                OpsTask.due_date.isnot(None), OpsTask.due_date < today)
        .order_by(OpsTask.due_date.asc())
        .all()
    )


# --- Checklist templates ----------------------------------------------------

def list_templates(db: Session, user_id: int) -> list[dict]:
    templates = (
        db.query(ChecklistTemplate)
        .filter(ChecklistTemplate.user_id == user_id)
        .order_by(ChecklistTemplate.name)
        .all()
    )
    out = []
    for tpl in templates:
        items = (
            db.query(ChecklistItem)
            .filter(ChecklistItem.template_id == tpl.id)
            .order_by(ChecklistItem.position, ChecklistItem.id)
            .all()
        )
        out.append({
            "id": tpl.id, "name": tpl.name, "category": tpl.category,
            "items": [{"id": i.id, "label": i.label} for i in items],
        })
    return out


def create_template(db: Session, user_id: int, *, name: str, category: str = "general",
                    items: list[str] | None = None) -> dict:
    if not name.strip():
        raise OperationsError("Checklist name is required.")
    tpl = ChecklistTemplate(user_id=user_id, name=name.strip(), category=category or "general")
    db.add(tpl); db.commit(); db.refresh(tpl)
    for pos, label in enumerate(items or []):
        if label.strip():
            db.add(ChecklistItem(template_id=tpl.id, label=label.strip(), position=pos))
    db.commit()
    return _template_dict(db, tpl)


def _template_dict(db: Session, tpl: ChecklistTemplate) -> dict:
    items = (
        db.query(ChecklistItem)
        .filter(ChecklistItem.template_id == tpl.id)
        .order_by(ChecklistItem.position, ChecklistItem.id)
        .all()
    )
    return {"id": tpl.id, "name": tpl.name, "category": tpl.category,
            "items": [{"id": i.id, "label": i.label} for i in items]}


def delete_template(db: Session, user_id: int, template_id: int) -> bool:
    tpl = db.query(ChecklistTemplate).filter(
        ChecklistTemplate.id == template_id, ChecklistTemplate.user_id == user_id,
    ).first()
    if not tpl:
        return False
    db.query(ChecklistItem).filter(ChecklistItem.template_id == tpl.id).delete()
    db.delete(tpl); db.commit()
    return True


def instantiate(db: Session, user_id: int, template_id: int, *, on_date: date | None = None) -> dict:
    """Turn a checklist template into a set of ops_tasks for the given day
    (default today). Returns the count created."""
    if on_date is None:
        on_date = date.today()
    tpl = db.query(ChecklistTemplate).filter(
        ChecklistTemplate.id == template_id, ChecklistTemplate.user_id == user_id,
    ).first()
    if not tpl:
        raise OperationsError("Checklist not found.", status_code=404)
    items = db.query(ChecklistItem).filter(ChecklistItem.template_id == tpl.id).all()
    created = 0
    for item in items:
        db.add(OpsTask(
            user_id=user_id, title=item.label, category=tpl.category,
            due_date=on_date, source_template_id=tpl.id,
        ))
        created += 1
    db.commit()
    return {"created": created, "template": tpl.name, "date": str(on_date)}
