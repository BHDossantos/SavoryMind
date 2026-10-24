"""In-process recurring-job scheduler (APScheduler).

Runs the jobs that used to be driven by Google Cloud Scheduler — now inside the
always-on API process, so there's no external cron and no per-run billing.
Enabled only when ENABLE_SCHEDULER is truthy, so tests, local dev, and any
extra/worker instances stay quiet. The /internal/jobs/* HTTP endpoints remain
for manual or backup runs.

Run this on a SINGLE always-on instance. Most jobs dedupe (via *_sent_at /
last_sent_date / skip-if-exists), but running N instances would still duplicate
the non-idempotent sends.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_scheduler = None


def _truthy(v: str) -> bool:
    return (v or "").strip().lower() in ("1", "true", "yes", "on")


def _run(label, fn):
    """Run a job with its own DB session and full error isolation — a failing
    job must never take down the scheduler or the app."""
    from .database import SessionLocal
    db = SessionLocal()
    try:
        stats = fn(db)
        logger.info("scheduler[%s] ok: %s", label, stats)
    except Exception:
        logger.exception("scheduler[%s] failed", label)
    finally:
        db.close()


# ── owner-loop jobs (mirror the matching /internal/jobs endpoints) ──────────
def _coaching_regenerate(db):
    from ..services import coaching_service
    from ..models.user import User
    owners = db.query(User).filter(User.account_type == "restaurant").all()
    total = 0
    for o in owners:
        try:
            total += len(coaching_service.generate_all(db, o))
        except Exception:
            logger.exception("coaching-regenerate failed for user %s", o.id)
    return {"restaurants": len(owners), "plans_refreshed": total}


def _marketing_triggers(db):
    from ..services import marketing_automation_service
    from ..models.user import User
    owners = db.query(User).filter(User.account_type == "restaurant").all()
    total = 0
    for o in owners:
        try:
            total += len(marketing_automation_service.run_triggers(db, o))
        except Exception:
            logger.exception("marketing-triggers failed for user %s", o.id)
    return {"restaurants": len(owners), "new_triggers": total}


def _owner_weekly_report(db):
    from ..services import coaching_service, whatsapp_service
    from ..models.user import User
    owners = db.query(User).filter(User.account_type == "restaurant").all()
    sent = 0
    for o in owners:
        if not (o.phone and whatsapp_service.is_configured()):
            continue
        try:
            stats = coaching_service.recovered_this_month(db, o.id)
            body = whatsapp_service.owner_weekly_body(stats, o.language or "it")
            if whatsapp_service.send(db, user_id=o.id, to=o.phone,
                                     template="owner_weekly", body=body):
                sent += 1
        except Exception:
            logger.exception("owner-weekly-report failed for user %s", o.id)
    return {"owners": len(owners), "sent": sent}


def start_scheduler():
    """Start the background scheduler if ENABLE_SCHEDULER is set. Idempotent;
    returns the scheduler (or None when disabled / unavailable)."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    if not _truthy(os.getenv("ENABLE_SCHEDULER", "")):
        logger.info("scheduler disabled (set ENABLE_SCHEDULER=true on the "
                    "always-on API instance to enable recurring jobs).")
        return None
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        logger.error("APScheduler not installed — recurring jobs will NOT run.")
        return None

    from ..services import (
        daily_briefing_service, inventory_digest_service, menu_sms_service,
        reminder_service, square_pos_service, weekly_digest_service,
        ml_recommender_service,
    )

    sched = BackgroundScheduler(timezone="UTC")

    def add(label, trigger, fn):
        sched.add_job(lambda: _run(label, fn), trigger, id=label,
                      replace_existing=True, max_instances=1, coalesce=True)

    # (all times UTC; services do per-restaurant timezone filtering)
    add("booking-reminders",   CronTrigger(minute="*/15"),                        reminder_service.send_due_reminders)
    add("menu-of-the-day",     CronTrigger(minute=17),                            menu_sms_service.send_due_menus)
    add("pos-sync",            CronTrigger(minute=37),                            square_pos_service.sync_all_connected)
    add("inventory-digest",    CronTrigger(day_of_week="mon", minute=25),         inventory_digest_service.run_digest)
    add("daily-briefing",      CronTrigger(hour=7, minute=0),                     daily_briefing_service.send_daily_briefings)
    add("marketing-triggers",  CronTrigger(hour=7, minute=15),                    _marketing_triggers)
    add("weekly-digest",       CronTrigger(day_of_week="mon", hour=7, minute=0),  weekly_digest_service.send_weekly_digests)
    add("coaching-regenerate", CronTrigger(day_of_week="mon", hour=7, minute=30), _coaching_regenerate)
    add("ml-retrain",          CronTrigger(hour=3, minute=20),                    ml_recommender_service.retrain)
    add("owner-weekly-report", CronTrigger(day_of_week="sun", hour=18, minute=0), _owner_weekly_report)

    sched.start()
    _scheduler = sched
    logger.info("scheduler started with %d jobs: %s",
                len(sched.get_jobs()), [j.id for j in sched.get_jobs()])
    return sched


def shutdown_scheduler():
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass
        _scheduler = None
