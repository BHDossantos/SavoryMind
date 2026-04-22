from sqlalchemy.orm import Session
from ..models.kitchen import FoodWasteLog, DishTimeLog
from ..models.restaurant_ext import Staff


def get_training_recommendations(db: Session, user_id: int) -> dict:
    waste_logs = db.query(FoodWasteLog).filter(FoodWasteLog.user_id == user_id).all()
    time_logs = db.query(DishTimeLog).filter(DishTimeLog.user_id == user_id).all()
    staff_list = db.query(Staff).filter(Staff.user_id == user_id, Staff.active == True).all()  # noqa: E712

    staff_names = {s.name: s for s in staff_list}

    # Build waste profile per staff
    waste_by_staff: dict[str, dict] = {}
    for w in waste_logs:
        if w.staff_name not in waste_by_staff:
            waste_by_staff[w.staff_name] = {"cost": 0, "kg": 0, "incidents": 0, "reasons": []}
        waste_by_staff[w.staff_name]["cost"] += w.estimated_cost
        waste_by_staff[w.staff_name]["kg"] += w.quantity_kg
        waste_by_staff[w.staff_name]["incidents"] += 1
        if w.reason:
            waste_by_staff[w.staff_name]["reasons"].append(w.reason)

    # Build time profile per staff
    time_by_staff: dict[str, list] = {}
    for t in time_logs:
        if t.staff_name not in time_by_staff:
            time_by_staff[t.staff_name] = []
        time_by_staff[t.staff_name].append(t.prep_minutes + t.cook_minutes)

    recommendations = []

    # Waste-based recommendations
    if waste_by_staff:
        avg_waste_cost = sum(v["cost"] for v in waste_by_staff.values()) / len(waste_by_staff)
        for name, w in waste_by_staff.items():
            if w["cost"] > avg_waste_cost * 1.5:
                top_reasons = list(set(w["reasons"]))[:2]
                reason_text = f" Main causes: {', '.join(top_reasons)}." if top_reasons else ""
                recommendations.append({
                    "staff": name,
                    "priority": "high",
                    "type": "waste_reduction",
                    "title": f"Food Waste Alert — {name}",
                    "detail": (
                        f"{name} has wasted £{w['cost']:.2f} across {w['incidents']} incidents, "
                        f"{w['kg']:.1f} kg total.{reason_text} "
                        "Recommend: portion control training, mise-en-place review, and spot-check supervision."
                    ),
                    "actions": [
                        "Schedule portion control workshop",
                        "Review mise-en-place procedures",
                        "Add supervisor spot-checks for first 2 weeks",
                    ],
                })

    # Time-based recommendations
    if time_by_staff:
        all_avgs = [sum(v) / len(v) for v in time_by_staff.values()]
        global_avg = sum(all_avgs) / len(all_avgs)
        for name, times in time_by_staff.items():
            avg_time = sum(times) / len(times)
            if avg_time > global_avg * 1.3:
                recommendations.append({
                    "staff": name,
                    "priority": "medium",
                    "type": "speed_coaching",
                    "title": f"Prep Speed Coaching — {name}",
                    "detail": (
                        f"{name} averages {avg_time:.0f} min per dish vs. team average of {global_avg:.0f} min. "
                        "Shadow a faster colleague, review knife skills, and practice mise-en-place drills."
                    ),
                    "actions": [
                        f"Shadow fastest team member for 3 shifts",
                        "Knife skills refresher session",
                        "Time-and-motion review on slowest dishes",
                    ],
                })

    # Low rating staff
    for s in staff_list:
        if s.rating < 3.5:
            recommendations.append({
                "staff": s.name,
                "priority": "high",
                "type": "performance_review",
                "title": f"Performance Review — {s.name}",
                "detail": (
                    f"{s.name} ({s.role}) has a {s.rating:.1f}/5 rating. "
                    "Schedule a 1-on-1 review to identify blockers, review customer feedback, "
                    "and set a 30-day improvement plan."
                ),
                "actions": [
                    "Book 1-on-1 review this week",
                    "Review customer feedback logs",
                    "Set SMART 30-day improvement targets",
                ],
            })
        elif s.punctuality_score < 85:
            recommendations.append({
                "staff": s.name,
                "priority": "medium",
                "type": "punctuality",
                "title": f"Punctuality Plan — {s.name}",
                "detail": (
                    f"{s.name} punctuality is {s.punctuality_score}%. "
                    "Discuss scheduling conflicts, set clear expectations, and monitor for 4 weeks."
                ),
                "actions": [
                    "Discuss shift scheduling conflicts",
                    "Set clear lateness policy reminder",
                    "Monitor punctuality weekly for 4 weeks",
                ],
            })

    # General recommendations if no specific ones
    if not recommendations:
        recommendations.append({
            "staff": "All Team",
            "priority": "low",
            "type": "general",
            "title": "Team is Performing Well",
            "detail": "No major issues detected. Consider advanced training to further elevate service quality.",
            "actions": [
                "Arrange wine/food pairing knowledge session",
                "Cross-train staff in different roles",
                "Schedule a team-building event",
            ],
        })

    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    recommendations.sort(key=lambda x: priority_order.get(x["priority"], 3))

    return {
        "recommendations": recommendations,
        "total": len(recommendations),
        "high_priority": sum(1 for r in recommendations if r["priority"] == "high"),
    }
