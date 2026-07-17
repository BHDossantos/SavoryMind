"""WhatsApp delivery with a provider interface (P2 §7).

Two interchangeable providers behind one `send()` contract:
  - "meta"   → Meta WhatsApp Cloud API (preferred; direct, cheaper)
  - "twilio" → Twilio WhatsApp (fallback)
Selected by WHATSAPP_PROVIDER; swapping is a config change only.

No-op and never-raise when unconfigured (same contract as twilio_client /
resend_client), so coaching delivery works in dev and the pilot without
WhatsApp wired up. Every attempt is written to message_log.

Env:
  WHATSAPP_PROVIDER            meta | twilio   (default meta)
  WHATSAPP_ACCESS_TOKEN        Meta Cloud API token
  WHATSAPP_PHONE_NUMBER_ID     Meta sender phone-number id
  (Twilio path reuses TWILIO_* + a whatsapp: sender via TWILIO_WHATSAPP_FROM)
"""
from __future__ import annotations

import json
import logging
import os
import urllib.request

from sqlalchemy.orm import Session

from ..models.messaging import MessageLog

logger = logging.getLogger(__name__)


def provider() -> str:
    return (os.getenv("WHATSAPP_PROVIDER") or "meta").lower()


def is_configured() -> bool:
    if provider() == "twilio":
        return all([os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"),
                    os.getenv("TWILIO_WHATSAPP_FROM")])
    return all([os.getenv("WHATSAPP_ACCESS_TOKEN"), os.getenv("WHATSAPP_PHONE_NUMBER_ID")])


def _valid_e164(num: str) -> bool:
    n = (num or "").strip()
    return n.startswith("+") and n[1:].replace(" ", "").replace("-", "").isdigit()


# Monkeypatched in tests to avoid real HTTP.
def _http_post(url: str, headers: dict, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _send_meta(to: str, body: str) -> tuple[bool, str | None, str | None]:
    token = os.getenv("WHATSAPP_ACCESS_TOKEN")
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    url = f"https://graph.facebook.com/v20.0/{phone_id}/messages"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {"messaging_product": "whatsapp", "to": to.lstrip("+"),
               "type": "text", "text": {"body": body}}
    try:
        resp = _http_post(url, headers, payload)
        mid = (resp.get("messages") or [{}])[0].get("id")
        return True, mid, None
    except Exception as exc:
        return False, None, type(exc).__name__


def _send_twilio(to: str, body: str) -> tuple[bool, str | None, str | None]:
    try:
        from twilio.rest import Client
        client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
        msg = client.messages.create(
            to=f"whatsapp:{to}", from_=os.getenv("TWILIO_WHATSAPP_FROM"), body=body)
        return True, getattr(msg, "sid", None), None
    except ImportError:
        return False, None, "twilio SDK missing"
    except Exception as exc:
        return False, None, type(exc).__name__


def send(db: Session, *, user_id: int, to: str, template: str, body: str) -> bool:
    """Send a WhatsApp message and log the attempt. Returns True on success.
    Never raises. Skips (logged) when unconfigured or recipient invalid."""
    log = MessageLog(user_id=user_id, channel="whatsapp", provider=provider(),
                     to_number=to or "", template=template, status="queued")
    db.add(log)

    if not is_configured():
        log.status = "skipped"; log.error = "not_configured"; log.provider = "none"
        db.commit()
        return False
    if not _valid_e164(to):
        log.status = "skipped"; log.error = "invalid_recipient"
        db.commit()
        return False

    ok, mid, err = (_send_twilio if provider() == "twilio" else _send_meta)(to, body)
    log.status = "sent" if ok else "failed"
    log.provider_message_id = mid
    log.error = err
    db.commit()
    return ok


# ── Message builders (localized, template-shaped) ────────────────────────────

def staff_digest_body(plan: dict, lang: str = "it") -> str:
    """Today's 1-2 focus actions from a staff member's active plan."""
    actions = [a["text"] for a in plan.get("actions", []) if not a.get("done")][:2]
    head = {"it": "Focus di oggi", "en": "Today's focus", "es": "Enfoque de hoy"}.get(lang, "Focus")
    lines = "\n".join(f"• {a}" for a in actions) or "—"
    return f"{head} — {plan.get('title', '')}\n{lines}\n\n— SavoryMind"


def owner_weekly_body(stats: dict, lang: str = "it") -> str:
    t = {
        "it": ("Report settimanale", "Perdite questa settimana", "Recuperato", "Continua così! 💪"),
        "en": ("Weekly report", "Losses this week", "Recovered", "Keep it up! 💪"),
        "es": ("Informe semanal", "Pérdidas esta semana", "Recuperado", "¡Sigue así! 💪"),
    }.get(lang, None) or ("Weekly report", "Losses this week", "Recovered", "Keep it up!")
    return (f"{t[0]} — SavoryMind\n{t[1]}: €{stats.get('current_month_loss', 0):.0f}\n"
            f"{t[2]}: €{stats.get('recovered_this_month', 0):.0f}\n{t[3]}")
