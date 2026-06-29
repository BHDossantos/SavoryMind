"""Per-staff training recommendations from waste/time/rating data.

When ANTHROPIC_API_KEY is set, the staff profiles get sent to Claude for
contextual coaching plans citing the actual numbers ("Marco wasted £147
across 8 incidents — pattern: over-portioning the lamb dish"). Falls
back to the threshold-based templates when Claude is unavailable.
"""
from sqlalchemy.orm import Session

from . import claude_client
from ..models.kitchen import FoodWasteLog, DishTimeLog
from ..models.restaurant_ext import Staff


_RECOMMENDATIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "recommendations": {
            "type": "array",
            "minItems": 1,
            "maxItems": 8,
            "items": {
                "type": "object",
                "properties": {
                    "staff":    {"type": "string"},
                    "priority": {"type": "string", "enum": ["high", "medium", "low"]},
                    "type":     {"type": "string", "enum": [
                        "waste_reduction", "speed_coaching", "performance_review",
                        "punctuality", "general",
                    ]},
                    "title":    {"type": "string"},
                    "detail":   {"type": "string"},
                    "actions": {
                        "type": "array",
                        "minItems": 2,
                        "maxItems": 5,
                        "items": {"type": "string"},
                    },
                },
                "required": ["staff", "priority", "type", "title", "detail", "actions"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["recommendations"],
    "additionalProperties": False,
}


_SYSTEM_PROMPT = f"""{claude_client.FLAVOR_PERSONA}

You're helping a head chef write private coaching plans for their \
kitchen staff. Given per-staff waste / prep-time / rating profiles, \
produce specific recommendations. Each one:
- Names the staff member.
- `detail` cites at least one concrete number from their profile \
  (cost wasted, prep minutes vs team average, rating, punctuality). \
  Stays in voice — supportive, plain language, no euphemisms.
- `actions` are 2-4 concrete one-line steps the head chef can schedule.
- Priority: high for cost/quality issues (>1.5x team avg waste, \
  <3.5★ rating), medium for speed/punctuality, low for growth.
- type: waste_reduction | speed_coaching | performance_review | \
  punctuality | general

If everyone is performing well, return ONE recommendation with \
staff="All Team", priority=low, type=general, suggesting an upskilling \
activity that fits the team's profile.

Direct but kind — these recommendations land on real people."""


def get_training_recommendations(db: Session, user_id: int) -> dict:
    waste_logs = db.query(FoodWasteLog).filter(FoodWasteLog.user_id == user_id).all()
    time_logs  = db.query(DishTimeLog).filter(DishTimeLog.user_id == user_id).all()
    staff_list = db.query(Staff).filter(Staff.user_id == user_id, Staff.active == True).all()  # noqa: E712

    # Aggregate per-staff profiles (same as before — real data, just a
    # different consumer downstream).
    waste_by_staff: dict[str, dict] = {}
    for w in waste_logs:
        wp = waste_by_staff.setdefault(w.staff_name, {"cost": 0, "kg": 0, "incidents": 0, "reasons": []})
        wp["cost"]      += w.estimated_cost
        wp["kg"]        += w.quantity_kg
        wp["incidents"] += 1
        if w.reason:
            wp["reasons"].append(w.reason)

    time_by_staff: dict[str, list] = {}
    for t in time_logs:
        time_by_staff.setdefault(t.staff_name, []).append(t.prep_minutes + t.cook_minutes)

    profiles = _build_profiles(waste_by_staff, time_by_staff, staff_list)

    recommendations = _generate_with_claude_or_rules(profiles)

    priority_order = {"high": 0, "medium": 1, "low": 2}
    recommendations.sort(key=lambda x: priority_order.get(x["priority"], 3))

    return {
        "recommendations":    recommendations,
        "total":              len(recommendations),
        "high_priority":      sum(1 for r in recommendations if r["priority"] == "high"),
    }


# ── Profile shaping --------------------------------------------------------


def _build_profiles(waste_by_staff, time_by_staff, staff_list) -> dict:
    """Compact, JSON-serialisable summary of every signal we have on each
    staff member. Used by both the Claude path (as the user payload) and
    the rules path (as the raw input)."""
    avg_waste_cost = (
        sum(v["cost"] for v in waste_by_staff.values()) / len(waste_by_staff)
        if waste_by_staff else 0
    )
    all_avgs = [sum(v) / len(v) for v in time_by_staff.values()]
    global_avg_time = sum(all_avgs) / len(all_avgs) if all_avgs else 0

    per_staff = {}
    for name, w in waste_by_staff.items():
        per_staff.setdefault(name, {})["waste"] = {
            "cost":           round(w["cost"], 2),
            "kg":             round(w["kg"], 2),
            "incidents":      w["incidents"],
            "top_reasons":    list(set(w["reasons"]))[:3],
            "vs_team_avg":    round(w["cost"] / avg_waste_cost, 2) if avg_waste_cost else 1.0,
        }
    for name, times in time_by_staff.items():
        avg = sum(times) / len(times)
        per_staff.setdefault(name, {})["speed"] = {
            "avg_minutes":    round(avg, 1),
            "team_avg":       round(global_avg_time, 1),
            "vs_team_avg":    round(avg / global_avg_time, 2) if global_avg_time else 1.0,
            "samples":        len(times),
        }
    for s in staff_list:
        per_staff.setdefault(s.name, {})["profile"] = {
            "role":              s.role,
            "rating":            float(s.rating) if s.rating is not None else None,
            "punctuality_score": float(s.punctuality_score) if s.punctuality_score is not None else None,
        }

    return {
        "team_metrics": {
            "avg_waste_cost":    round(avg_waste_cost, 2),
            "avg_prep_minutes":  round(global_avg_time, 1),
            "team_size":         len(staff_list),
        },
        "staff": per_staff,
    }


# ── Claude / rules selection -----------------------------------------------


def _generate_with_claude_or_rules(profiles: dict) -> list[dict]:
    if claude_client.is_configured() and profiles["staff"]:
        result = claude_client.call_json(_SYSTEM_PROMPT, profiles, _RECOMMENDATIONS_SCHEMA)
        if result and isinstance(result.get("recommendations"), list) and result["recommendations"]:
            return result["recommendations"]
    return _rules_recommendations(profiles)


def _rules_recommendations(profiles: dict) -> list[dict]:
    """Original threshold-based logic — used as the fallback."""
    recs: list[dict] = []
    staff_data = profiles["staff"]

    for name, data in staff_data.items():
        waste = data.get("waste", {})
        speed = data.get("speed", {})
        prof  = data.get("profile", {})

        if waste and waste.get("vs_team_avg", 0) >= 1.5:
            top = waste.get("top_reasons", [])
            reason_text = f" Main causes: {', '.join(top)}." if top else ""
            recs.append({
                "staff":    name,
                "priority": "high",
                "type":     "waste_reduction",
                "title":    f"Food Waste Alert — {name}",
                "detail": (
                    f"{name} has wasted £{waste['cost']:.2f} across {waste['incidents']} incidents, "
                    f"{waste['kg']:.1f} kg total.{reason_text} "
                    "Recommend portion control training, mise-en-place review, and supervisor spot-checks."
                ),
                "actions": [
                    "Schedule portion control workshop",
                    "Review mise-en-place procedures",
                    "Add supervisor spot-checks for first 2 weeks",
                ],
            })

        if speed and speed.get("vs_team_avg", 0) >= 1.3:
            recs.append({
                "staff":    name,
                "priority": "medium",
                "type":     "speed_coaching",
                "title":    f"Prep Speed Coaching — {name}",
                "detail": (
                    f"{name} averages {speed['avg_minutes']:.0f} min per dish vs. team average of "
                    f"{speed['team_avg']:.0f} min. Shadow a faster colleague, review knife skills, "
                    "and practice mise-en-place drills."
                ),
                "actions": [
                    "Shadow fastest team member for 3 shifts",
                    "Knife skills refresher session",
                    "Time-and-motion review on slowest dishes",
                ],
            })

        rating = prof.get("rating")
        if rating is not None and rating < 3.5:
            recs.append({
                "staff":    name,
                "priority": "high",
                "type":     "performance_review",
                "title":    f"Performance Review — {name}",
                "detail": (
                    f"{name} ({prof.get('role', 'staff')}) has a {rating:.1f}/5 rating. "
                    "Schedule a 1-on-1 review to identify blockers, review customer feedback, "
                    "and set a 30-day improvement plan."
                ),
                "actions": [
                    "Book 1-on-1 review this week",
                    "Review customer feedback logs",
                    "Set SMART 30-day improvement targets",
                ],
            })
        elif prof.get("punctuality_score") is not None and prof["punctuality_score"] < 85:
            recs.append({
                "staff":    name,
                "priority": "medium",
                "type":     "punctuality",
                "title":    f"Punctuality Plan — {name}",
                "detail": (
                    f"{name} punctuality is {prof['punctuality_score']}%. "
                    "Discuss scheduling conflicts, set clear expectations, and monitor for 4 weeks."
                ),
                "actions": [
                    "Discuss shift scheduling conflicts",
                    "Set clear lateness policy reminder",
                    "Monitor punctuality weekly for 4 weeks",
                ],
            })

    if not recs:
        recs.append({
            "staff":    "All Team",
            "priority": "low",
            "type":     "general",
            "title":    "Team is Performing Well",
            "detail":   "No major issues detected. Consider advanced training to further elevate service quality.",
            "actions": [
                "Arrange wine/food pairing knowledge session",
                "Cross-train staff in different roles",
                "Schedule a team-building event",
            ],
        })
    return recs
