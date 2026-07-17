"""WhatsApp delivery — provider interface, no-op safety, message logging."""
import os
from unittest.mock import patch

from app.models.messaging import MessageLog
from app.models.restaurant_ext import Staff
from app.models.user import User
from app.services import whatsapp_service, coaching_service

from .conftest import register_user


def _restaurant(client, db_session, email):
    token, user = register_user(client, email=email, account_type="restaurant")
    row = db_session.query(User).filter(User.id == user["id"]).first()
    db_session.commit()
    return row


def test_noop_when_unconfigured_logs_skipped(db_session):
    with patch.dict(os.environ, {}, clear=False):
        for k in ("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"):
            os.environ.pop(k, None)
        ok = whatsapp_service.send(db_session, user_id=1, to="+393331234567",
                                   template="staff_digest", body="hi")
    assert ok is False
    log = db_session.query(MessageLog).order_by(MessageLog.id.desc()).first()
    assert log.status == "skipped"
    assert log.error == "not_configured"


def test_invalid_recipient_skipped(db_session):
    env = {"WHATSAPP_ACCESS_TOKEN": "t", "WHATSAPP_PHONE_NUMBER_ID": "1"}
    with patch.dict(os.environ, env):
        ok = whatsapp_service.send(db_session, user_id=1, to="not-a-number",
                                   template="staff_digest", body="hi")
    assert ok is False
    log = db_session.query(MessageLog).order_by(MessageLog.id.desc()).first()
    assert log.status == "skipped"
    assert log.error == "invalid_recipient"


def test_meta_send_success_logs_sent(db_session):
    env = {"WHATSAPP_PROVIDER": "meta", "WHATSAPP_ACCESS_TOKEN": "t",
           "WHATSAPP_PHONE_NUMBER_ID": "123"}
    with patch.dict(os.environ, env), \
         patch("app.services.whatsapp_service._http_post",
               return_value={"messages": [{"id": "wamid.ABC"}]}) as post:
        ok = whatsapp_service.send(db_session, user_id=1, to="+393331234567",
                                   template="staff_digest", body="ciao")
    assert ok is True
    assert post.called
    log = db_session.query(MessageLog).order_by(MessageLog.id.desc()).first()
    assert log.status == "sent"
    assert log.provider_message_id == "wamid.ABC"
    assert log.provider == "meta"


def test_meta_send_failure_logs_failed(db_session):
    env = {"WHATSAPP_PROVIDER": "meta", "WHATSAPP_ACCESS_TOKEN": "t",
           "WHATSAPP_PHONE_NUMBER_ID": "123"}
    with patch.dict(os.environ, env), \
         patch("app.services.whatsapp_service._http_post", side_effect=Exception("boom")):
        ok = whatsapp_service.send(db_session, user_id=1, to="+393331234567",
                                   template="staff_digest", body="ciao")
    assert ok is False
    log = db_session.query(MessageLog).order_by(MessageLog.id.desc()).first()
    assert log.status == "failed"


def test_provider_swap_is_config_only(db_session):
    with patch.dict(os.environ, {"WHATSAPP_PROVIDER": "twilio",
                                 "TWILIO_ACCOUNT_SID": "s", "TWILIO_AUTH_TOKEN": "a",
                                 "TWILIO_WHATSAPP_FROM": "whatsapp:+15550000000"}):
        assert whatsapp_service.provider() == "twilio"
        assert whatsapp_service.is_configured() is True


def test_digest_body_localized():
    plan = {"title": "Piano", "actions": [{"text": "Pesa le porzioni", "done": False},
                                          {"text": "Checklist", "done": True}]}
    it = whatsapp_service.staff_digest_body(plan, "it")
    assert "Focus di oggi" in it
    assert "Pesa le porzioni" in it
    assert "Checklist" not in it  # done actions excluded


def test_approved_plan_sends_whatsapp_when_consented(client, db_session):
    owner = _restaurant(client, db_session, "wa-owner@example.com")
    staff = Staff(user_id=owner.id, name="Carlos", role="chef", shift="evening",
                  whatsapp_number="+393331234567")
    from datetime import datetime
    staff.whatsapp_consent_at = datetime.utcnow()
    db_session.add(staff); db_session.commit(); db_session.refresh(staff)
    coaching_service.log_incident(db_session, owner.id, staff_id=staff.id,
                                  type="waste", euro_impact=40.0)
    plan = coaching_service.generate_plan_for_staff(db_session, owner, staff)

    env = {"WHATSAPP_PROVIDER": "meta", "WHATSAPP_ACCESS_TOKEN": "t",
           "WHATSAPP_PHONE_NUMBER_ID": "1"}
    with patch.dict(os.environ, env), \
         patch("app.services.whatsapp_service._http_post",
               return_value={"messages": [{"id": "x"}]}):
        coaching_service.approve_plan(db_session, owner.id, plan.id)

    log = (db_session.query(MessageLog)
           .filter(MessageLog.template == "staff_digest").order_by(MessageLog.id.desc()).first())
    assert log is not None and log.status == "sent"


def test_no_whatsapp_without_consent(client, db_session):
    owner = _restaurant(client, db_session, "wa-owner2@example.com")
    staff = Staff(user_id=owner.id, name="Ana", role="server", shift="evening",
                  whatsapp_number="+393339999999")  # number but NO consent timestamp
    db_session.add(staff); db_session.commit(); db_session.refresh(staff)
    coaching_service.log_incident(db_session, owner.id, staff_id=staff.id,
                                  type="waste", euro_impact=40.0)
    plan = coaching_service.generate_plan_for_staff(db_session, owner, staff)
    before = db_session.query(MessageLog).count()
    coaching_service.approve_plan(db_session, owner.id, plan.id)
    assert db_session.query(MessageLog).count() == before  # nothing sent
