"""Loss Estimate Engine — the money number.

A transparent, rule-based v1 (NOT a black box — owners must be able to see
the reasoning). Given a restaurant profile plus whichever data path is
available (profile-only, a 12-question quick-audit, or an imported sales
summary), it estimates monthly recoverable loss across three categories:

  1. Food waste     — a % of monthly food purchases, 4–10% industry band,
                      position within the band set by audit discipline.
  2. Over-portioning — excess food cost from portions exceeding recipe.
  3. Staff time     — labour spent on avoidable inefficiency (duplicated
                      prep, manual counting, no par levels).

Every euro on screen traces to an `evidence` item carrying the code +
parameters that produced it. Output shape (notes §4.1.3):

    {
      "total_monthly_loss_low":  float,
      "total_monthly_loss_high": float,
      "breakdown": [
        {category, amount_low, amount_high, evidence: [...], confidence}
      ],
    }

Pure and dependency-free so the same function powers onboarding (P1) and
the public waste calculator (P3). No DB, no I/O.

HARD RULE (notes §12): no fake numbers. Missing inputs widen the band and
lower confidence — they never inflate the estimate.
"""
from __future__ import annotations

# ── Tunable coefficients (all explicit, all documented) ──────────────────────

WASTE_PCT_MIN = 0.04          # industry band floor (disciplined kitchen)
WASTE_PCT_MAX = 0.10          # industry band ceiling (no controls)
WASTE_BAND_HALF = 0.015       # ± around the point estimate, clamped to the band

FOOD_COST_SHARE = 0.30        # COGS as a share of revenue, used only to
                              # *estimate* food purchases when not provided
PORTION_OVER_MAX = 0.15       # worst-case portion overage (15% over recipe)
PORTION_RECOVERABLE = 0.6     # only part of overage is realistically recoverable

STAFF_WASTE_HRS_MAX = 3.0     # worst-case avoidable hours/week per staff member
DEFAULT_WAGE_EUR = 9.0        # configurable; Rome kitchen baseline
WEEKS_PER_MONTH = 4.33


# ── Quick-audit definition (Path B) ──────────────────────────────────────────
# Each question's chosen option contributes a 0..1 "risk" to one or more
# levers: waste discipline, portion control, staff efficiency. 0 = best
# practice, 1 = no control. The engine interpolates the money figures from
# these levers, so every answer visibly moves the number.

AUDIT_QUESTIONS = [
    {"id": "waste_tracking", "lever": "waste",
     "options": {"digital": 0.0, "paper": 0.4, "mental": 0.7, "never": 1.0}},
    {"id": "inventory_frequency", "lever": "waste",
     "options": {"daily": 0.0, "weekly": 0.3, "monthly": 0.7, "never": 1.0}},
    {"id": "leftover_policy", "lever": "waste",
     "options": {"repurposed": 0.0, "staff_meal": 0.3, "sometimes_tossed": 0.7, "tossed": 1.0}},
    {"id": "supplier_check", "lever": "waste",
     "options": {"always": 0.0, "sometimes": 0.5, "never": 1.0}},
    {"id": "par_levels", "lever": "staff",
     "options": {"yes_followed": 0.0, "yes_ignored": 0.5, "no": 1.0}},
    {"id": "portion_control", "lever": "portion",
     "options": {"scales_recipes": 0.0, "eyeballed_trained": 0.4, "eyeballed": 0.8, "no_standard": 1.0}},
    {"id": "top_dish_portion", "lever": "portion",
     "options": {"matches": 0.0, "slightly_over": 0.5, "often_over": 1.0}},
    {"id": "menu_food_cost", "lever": "portion",
     "options": {"every_dish": 0.0, "some_dishes": 0.5, "none": 1.0}},
    {"id": "prep_duplication", "lever": "staff",
     "options": {"never": 0.0, "rarely": 0.4, "often": 1.0}},
    {"id": "prep_method", "lever": "staff",
     "options": {"planned_miseenplace": 0.0, "loose": 0.5, "adhoc": 1.0}},
    {"id": "counting_method", "lever": "staff",
     "options": {"app": 0.0, "spreadsheet": 0.4, "paper": 0.7, "memory": 1.0}},
    {"id": "staff_training", "lever": "staff",
     "options": {"regular": 0.0, "onboarding_only": 0.5, "none": 1.0}},
]

_LEVER_QUESTIONS = {
    "waste":   [q for q in AUDIT_QUESTIONS if q["lever"] == "waste"],
    "portion": [q for q in AUDIT_QUESTIONS if q["lever"] == "portion"],
    "staff":   [q for q in AUDIT_QUESTIONS if q["lever"] == "staff"],
}


def _lever_score(audit: dict | None, lever: str) -> float | None:
    """Average risk (0..1) for a lever from answered questions. None when no
    question for the lever was answered — the caller then uses a neutral
    default and drops confidence."""
    if not audit:
        return None
    vals = []
    for q in _LEVER_QUESTIONS[lever]:
        ans = audit.get(q["id"])
        if ans is not None and ans in q["options"]:
            vals.append(q["options"][ans])
    if not vals:
        return None
    return sum(vals) / len(vals)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


# ── Core estimator ───────────────────────────────────────────────────────────

def estimate(profile: dict, audit: dict | None = None,
             sales_summary: dict | None = None) -> dict:
    """Produce the money number. See module docstring for the output shape.

    profile keys (all optional; missing → wider band, lower confidence):
      covers_per_day, avg_ticket_eur, staff_count,
      monthly_food_purchases_eur, avg_hourly_wage_eur
    audit: {question_id: option_key} for answered quick-audit questions.
    sales_summary: {monthly_revenue, ...} from an imported sales export.
    """
    data_path = "import" if sales_summary else ("audit" if audit else "profile")

    covers = _num(profile.get("covers_per_day"))
    ticket = _num(profile.get("avg_ticket_eur"))
    staff = _num(profile.get("staff_count"))
    wage = _num(profile.get("avg_hourly_wage_eur")) or DEFAULT_WAGE_EUR

    # Monthly revenue: imported sales beat the covers×ticket estimate.
    monthly_revenue = None
    if sales_summary and sales_summary.get("monthly_revenue"):
        monthly_revenue = float(sales_summary["monthly_revenue"])
    elif covers and ticket:
        monthly_revenue = covers * ticket * 30.0

    # Monthly food purchases: use the stated value, else derive from revenue.
    purchases = _num(profile.get("monthly_food_purchases_eur"))
    purchases_estimated = False
    if not purchases and monthly_revenue:
        purchases = monthly_revenue * FOOD_COST_SHARE
        purchases_estimated = True

    breakdown = []
    b = _waste_category(purchases, purchases_estimated, audit)
    if b:
        breakdown.append(b)
    b = _portion_category(purchases, monthly_revenue, audit, data_path)
    if b:
        breakdown.append(b)
    b = _staff_category(staff, wage, audit)
    if b:
        breakdown.append(b)

    total_low = round(sum(c["amount_low"] for c in breakdown), 2)
    total_high = round(sum(c["amount_high"] for c in breakdown), 2)

    return {
        "data_path": data_path,
        "total_monthly_loss_low": total_low,
        "total_monthly_loss_high": total_high,
        "breakdown": breakdown,
    }


def _waste_category(purchases, purchases_estimated, audit):
    if not purchases:
        return None
    score = _lever_score(audit, "waste")
    confidence = "medium" if score is not None else "low"
    if purchases_estimated and confidence == "low":
        confidence = "low"
    s = 0.5 if score is None else score          # neutral default when unknown
    pct = WASTE_PCT_MIN + (WASTE_PCT_MAX - WASTE_PCT_MIN) * s
    low_pct = _clamp(pct - WASTE_BAND_HALF, WASTE_PCT_MIN, WASTE_PCT_MAX)
    high_pct = _clamp(pct + WASTE_BAND_HALF, WASTE_PCT_MIN, WASTE_PCT_MAX)
    # Unknown discipline → widen downward so we never over-claim.
    if score is None:
        low_pct = WASTE_PCT_MIN
    evidence = [{
        "code": "food_waste_pct",
        "pct_low": round(low_pct, 4),
        "pct_high": round(high_pct, 4),
        "monthly_food_purchases": round(purchases, 2),
        "purchases_estimated": purchases_estimated,
        "industry_band": [WASTE_PCT_MIN, WASTE_PCT_MAX],
    }]
    return {
        "category": "food_waste",
        "amount_low": round(purchases * low_pct, 2),
        "amount_high": round(purchases * high_pct, 2),
        "evidence": evidence,
        "confidence": confidence,
    }


def _portion_category(purchases, monthly_revenue, audit, data_path):
    base = purchases
    base_estimated = False
    if not base and monthly_revenue:
        base = monthly_revenue * FOOD_COST_SHARE
        base_estimated = True
    if not base:
        return None
    score = _lever_score(audit, "portion")
    # Import path without recipes can't verify portion vs recipe → low conf.
    if score is not None:
        confidence = "medium"
    else:
        confidence = "low"
    s = 0.5 if score is None else score
    over_pct = PORTION_OVER_MAX * s
    point = base * over_pct * PORTION_RECOVERABLE
    # Band: ±40% of point, and 0 floor when we truly don't know.
    low = point * 0.6 if score is not None else 0.0
    high = point * 1.4 if score is not None else point
    evidence = [{
        "code": "over_portion_pct",
        "over_pct": round(over_pct, 4),
        "recoverable_share": PORTION_RECOVERABLE,
        "base_food_cost": round(base, 2),
        "base_estimated": base_estimated,
    }]
    return {
        "category": "over_portioning",
        "amount_low": round(low, 2),
        "amount_high": round(high, 2),
        "evidence": evidence,
        "confidence": confidence,
    }


def _staff_category(staff, wage, audit):
    if not staff:
        return None
    score = _lever_score(audit, "staff")
    confidence = "medium" if score is not None else "low"
    s = 0.5 if score is None else score
    hrs_per_week = STAFF_WASTE_HRS_MAX * s
    point = staff * hrs_per_week * WEEKS_PER_MONTH * wage
    low = point * 0.6 if score is not None else point * 0.3
    high = point * 1.4 if score is not None else point
    evidence = [{
        "code": "staff_hours_wasted",
        "hours_per_week_per_staff": round(hrs_per_week, 2),
        "staff_count": staff,
        "hourly_wage": wage,
    }]
    return {
        "category": "staff_time",
        "amount_low": round(low, 2),
        "amount_high": round(high, 2),
        "evidence": evidence,
        "confidence": confidence,
    }


def _num(v):
    try:
        if v is None:
            return None
        v = float(v)
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None
