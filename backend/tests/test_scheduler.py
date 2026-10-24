"""The in-process recurring-job scheduler.

- Disabled by default (so tests/dev/extra instances never fire jobs).
- When ENABLE_SCHEDULER is set, it registers every job with the expected id.
"""
from app.core import scheduler


def test_scheduler_disabled_by_default(monkeypatch):
    monkeypatch.delenv("ENABLE_SCHEDULER", raising=False)
    scheduler._scheduler = None
    assert scheduler.start_scheduler() is None


def test_scheduler_registers_all_jobs_when_enabled(monkeypatch):
    monkeypatch.setenv("ENABLE_SCHEDULER", "true")
    scheduler._scheduler = None
    s = scheduler.start_scheduler()
    try:
        assert s is not None
        ids = {j.id for j in s.get_jobs()}
        expected = {
            "booking-reminders", "menu-of-the-day", "pos-sync", "inventory-digest",
            "daily-briefing", "marketing-triggers", "weekly-digest",
            "coaching-regenerate", "ml-retrain", "owner-weekly-report",
        }
        assert expected <= ids, f"missing jobs: {expected - ids}"
    finally:
        scheduler.shutdown_scheduler()
    # idempotent + fully shut down
    assert scheduler._scheduler is None
