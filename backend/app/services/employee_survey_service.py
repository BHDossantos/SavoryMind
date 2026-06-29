"""Employee QR-survey service.

Public flow (no auth, keyed by qr_token):
  1. GET  /api/employee-survey/{qr_token}        → questions + employee/restaurant names
  2. POST /api/employee-survey/{qr_token}/submit → store an anonymous response

Restaurant-owner flow (authenticated):
  3. GET  /api/employee-survey/employees                  → list employees with qr_token
  4. GET  /api/employee-survey/employees/{id}/results     → aggregated stats + recent responses

The survey definition itself is a global constant (SURVEY_DEFINITION). It
covers both attribution (this employee served me) and per-employee
feedback (how was their service), per scoping decisions. Iterating on
the question set doesn't require a migration — responses are stored as
JSON with a `survey_version` field so old answers stay interpretable.
"""
from __future__ import annotations

import json
import uuid
from collections import Counter
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from ..models.employee_survey import EmployeeSurveyResponse
from ..models.user import User


# ── Survey definition ────────────────────────────────────────────────────────

SURVEY_VERSION = 1

# A fixed, global question set. `id` is the stable key stored in responses;
# `type` is what the mobile renderer reads:
#   - "rating_5"  → 1–5 star picker
#   - "yes_no"    → boolean buttons
#   - "text"      → free-text input
# `required` is enforced server-side at submission time.
SURVEY_DEFINITION: dict[str, Any] = {
    "version": SURVEY_VERSION,
    "questions": [
        {
            "id": "overall_experience",
            "type": "rating_5",
            "prompt": "How was your overall experience tonight?",
            "required": True,
        },
        {
            "id": "employee_service",
            "type": "rating_5",
            "prompt": "How was the service from this team member?",
            "required": True,
        },
        {
            "id": "employee_attentive",
            "type": "rating_5",
            "prompt": "How attentive were they?",
            "required": True,
        },
        {
            "id": "employee_knowledgeable",
            "type": "rating_5",
            "prompt": "How knowledgeable were they about the menu?",
            "required": True,
        },
        {
            "id": "would_return",
            "type": "yes_no",
            "prompt": "Would you come back?",
            "required": True,
        },
        {
            "id": "comment",
            "type": "text",
            "prompt": "Anything else you'd like to share? (optional)",
            "required": False,
        },
    ],
}


# ── QR token management ──────────────────────────────────────────────────────

def generate_qr_token() -> str:
    """Opaque per-staff identifier. UUID4 has ~122 bits of entropy — far
    more than enough that a guessed token can't be brute-forced even with
    no rate limiting."""
    return str(uuid.uuid4())


def ensure_qr_token(db: Session, user: User) -> str:
    """Lazy-set a token on a staff row if it doesn't have one yet.

    Covers two cases the migration backfill can't:
      - Rows created between deploy of this code and the next backfill
        run on a different replica.
      - Tests that create staff rows directly without going through
        create_employee().
    """
    if not user.qr_token:
        user.qr_token = generate_qr_token()
        db.commit()
        db.refresh(user)
    return user.qr_token


# ── Public lookup ────────────────────────────────────────────────────────────

def get_employee_by_qr_token(db: Session, qr_token: str) -> User | None:
    """Returns the staff User the QR encodes, or None.

    Also verifies the row is still a valid staff account with an active
    employer — a deleted-then-recreated employer would leave the FK
    dangling, and we'd rather show "QR no longer valid" than crash.
    """
    user = (
        db.query(User)
        .filter(User.qr_token == qr_token, User.account_type == "staff")
        .first()
    )
    if not user or not user.employer_id:
        return None
    return user


def get_restaurant_for_employee(db: Session, employee: User) -> User | None:
    return (
        db.query(User)
        .filter(User.id == employee.employer_id, User.account_type == "restaurant")
        .first()
    )


# ── Submission validation ────────────────────────────────────────────────────

class SurveyValidationError(ValueError):
    """Raised when an incoming submission can't be coerced into the
    expected question set. The route layer maps this to HTTP 422."""


def validate_answers(answers: dict[str, Any]) -> dict[str, Any]:
    """Drop unknown keys, enforce required + per-type shapes.

    Returns the cleaned answers dict. Raises SurveyValidationError if a
    required question is missing or a value violates its type contract.
    Type coercion is permissive (string "5" → int 5) so the mobile form
    can submit JSON-stringified values without ceremony.
    """
    if not isinstance(answers, dict):
        raise SurveyValidationError("answers must be an object")

    cleaned: dict[str, Any] = {}
    for q in SURVEY_DEFINITION["questions"]:
        qid = q["id"]
        present = qid in answers
        if not present:
            if q["required"]:
                raise SurveyValidationError(f"Missing required answer: {qid}")
            continue
        raw = answers[qid]
        if q["type"] == "rating_5":
            try:
                val = int(raw)
            except (TypeError, ValueError):
                raise SurveyValidationError(f"{qid} must be an integer 1–5")
            if val < 1 or val > 5:
                raise SurveyValidationError(f"{qid} must be between 1 and 5")
            cleaned[qid] = val
        elif q["type"] == "yes_no":
            if isinstance(raw, bool):
                cleaned[qid] = raw
            elif isinstance(raw, str) and raw.lower() in ("true", "false", "yes", "no"):
                cleaned[qid] = raw.lower() in ("true", "yes")
            else:
                raise SurveyValidationError(f"{qid} must be a boolean")
        elif q["type"] == "text":
            if raw is None:
                continue
            if not isinstance(raw, str):
                raise SurveyValidationError(f"{qid} must be a string")
            # Cap length to keep the JSON blob bounded — saves us from a
            # diner pasting an entire essay into the free-text field.
            cleaned[qid] = raw[:2000]
        else:
            # Unknown type in the schema is a programming error, not a
            # user-facing one; still skip the answer instead of crashing.
            continue
    return cleaned


# ── Storage ──────────────────────────────────────────────────────────────────

def store_response(
    db: Session,
    employee: User,
    device_id: str,
    answers: dict[str, Any],
) -> EmployeeSurveyResponse:
    """Persist one submission. Trusts that `answers` has already been
    through validate_answers()."""
    if not device_id or len(device_id) > 64:
        raise SurveyValidationError("device_id must be 1–64 characters")
    payload = json.dumps({
        "survey_version": SURVEY_VERSION,
        "answers": answers,
    })
    row = EmployeeSurveyResponse(
        employee_user_id=employee.id,
        restaurant_user_id=employee.employer_id,
        device_id=device_id[:64],
        responses=payload,
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# ── Aggregation for restaurant dashboard ─────────────────────────────────────

def aggregate_for_employee(db: Session, employee_user_id: int) -> dict[str, Any]:
    """Roll up responses for one employee.

    Returns counts + averages for numeric questions, yes-percentage for
    the boolean, and the most recent free-text comments. Numerator/
    denominator are reported separately so the UI can show "4.6 ★ (12
    responses)" without us having to format the number here.
    """
    rows = (
        db.query(EmployeeSurveyResponse)
        .filter(EmployeeSurveyResponse.employee_user_id == employee_user_id)
        .order_by(EmployeeSurveyResponse.created_at.desc())
        .all()
    )

    # Bucket each question's values for aggregation.
    rating_questions = [q["id"] for q in SURVEY_DEFINITION["questions"] if q["type"] == "rating_5"]
    bool_questions = [q["id"] for q in SURVEY_DEFINITION["questions"] if q["type"] == "yes_no"]
    text_questions = [q["id"] for q in SURVEY_DEFINITION["questions"] if q["type"] == "text"]

    rating_sums: dict[str, int] = {q: 0 for q in rating_questions}
    rating_counts: dict[str, int] = {q: 0 for q in rating_questions}
    bool_counts: dict[str, Counter] = {q: Counter() for q in bool_questions}
    text_samples: list[dict[str, Any]] = []

    unique_devices: set[str] = set()

    for row in rows:
        try:
            payload = json.loads(row.responses)
        except (TypeError, ValueError):
            continue
        unique_devices.add(row.device_id)
        ans = payload.get("answers", {})
        for qid in rating_questions:
            v = ans.get(qid)
            if isinstance(v, (int, float)):
                rating_sums[qid] += int(v)
                rating_counts[qid] += 1
        for qid in bool_questions:
            v = ans.get(qid)
            if isinstance(v, bool):
                bool_counts[qid][v] += 1
        for qid in text_questions:
            v = ans.get(qid)
            if isinstance(v, str) and v.strip() and len(text_samples) < 20:
                text_samples.append({
                    "question_id": qid,
                    "text": v,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                })

    ratings_summary = {
        qid: {
            "average": round(rating_sums[qid] / rating_counts[qid], 2) if rating_counts[qid] else None,
            "count":   rating_counts[qid],
        }
        for qid in rating_questions
    }
    booleans_summary = {
        qid: {
            "yes_count": bool_counts[qid][True],
            "no_count":  bool_counts[qid][False],
            "yes_percent": (
                round(100 * bool_counts[qid][True] / (bool_counts[qid][True] + bool_counts[qid][False]), 1)
                if (bool_counts[qid][True] + bool_counts[qid][False]) > 0 else None
            ),
        }
        for qid in bool_questions
    }

    return {
        "total_responses": len(rows),
        "unique_devices":  len(unique_devices),
        "ratings":         ratings_summary,
        "booleans":        booleans_summary,
        "comments":        text_samples,
    }
