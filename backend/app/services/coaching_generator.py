"""Coaching plan generator (P2 §6.2).

Turns a staff member's last-30-days incidents into a dignity-preserving,
quantified coaching plan. Claude when configured (strict JSON, validated),
a deterministic rules fallback otherwise — so the feature works with or
without an API key.

Hard constraints baked into the prompt AND enforced structurally:
  - Every € / kg figure must come from real incident rows. The rules
    fallback only ever emits numbers it was handed; the Claude path is
    given the totals and told never to invent figures.
  - Coaching, never punishment: process fixes, no personal criticism.
  - Generated in the plan's target language (restaurant locale, or the
    employee's own language when set — it/en/es at minimum).
"""
from __future__ import annotations

import json

from . import claude_client

# Cause-tag → the fix language leans on process, not the person.
_PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "priority": {"type": "string", "enum": ["high", "medium", "low"]},
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "expected_recovery": {"type": "number"},
        "actions": {
            "type": "array", "minItems": 3, "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "due_hint": {"type": "string"},
                },
                "required": ["text", "due_hint"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["priority", "title", "summary", "expected_recovery", "actions"],
    "additionalProperties": False,
}

_LANG_NAME = {"it": "Italian", "en": "English", "es": "Spanish",
              "pt": "Portuguese", "fr": "French"}


def _system_prompt(language: str) -> str:
    lang = _LANG_NAME.get(language, "Italian")
    return f"""{claude_client.FLAVOR_PERSONA}

You write a PRIVATE coaching plan for one kitchen/floor staff member,
addressed to the restaurant owner who will deliver it. Write ENTIRELY in
{lang}.

Absolute rules:
- Use ONLY the euro and quantity figures provided in the incident data.
  Never invent or round to a different number. If you cite €X or Y kg, it
  must appear in the input.
- Coaching, never punishment. Fix the PROCESS, never criticise the person.
  No blame words, no "you failed". Dignity first — this lands on a real
  colleague.
- `summary` states the quantified pattern in one or two sentences
  (reference the real € total and the main cause).
- `actions`: 3-5 concrete, one-line process steps with a `due_hint`
  (e.g. "questa settimana", "prima di ogni servizio").
- `expected_recovery`: a conservative monthly € figure the plan could
  save — never more than the total loss shown.
- priority: high if the 30-day € impact is large or safety/quality is at
  stake; medium for recurring minor loss; low for a nearly-clean record
  (then frame it as reinforcement, warmly)."""


def _totals(incidents: list[dict]) -> dict:
    total_eur = round(sum(i.get("euro_impact", 0) or 0 for i in incidents), 2)
    by_type: dict[str, dict] = {}
    tags: dict[str, int] = {}
    for i in incidents:
        t = by_type.setdefault(i["type"], {"count": 0, "euro": 0.0, "qty": 0.0})
        t["count"] += 1
        t["euro"] = round(t["euro"] + (i.get("euro_impact", 0) or 0), 2)
        t["qty"] = round(t["qty"] + (i.get("quantity", 0) or 0), 2)
        for tag in (i.get("cause_tags") or []):
            tags[tag] = tags.get(tag, 0) + 1
    top_type = max(by_type.items(), key=lambda kv: kv[1]["euro"], default=(None, None))
    return {"total_eur": total_eur, "by_type": by_type,
            "top_type": top_type[0], "cause_tags": tags}


def generate(*, staff: dict, incidents: list[dict], restaurant: dict,
             language: str = "it") -> dict:
    """Return a plan dict: {priority, title, summary, euro_impact_total,
    expected_recovery, actions:[{text,done,due_hint}], generated_by_model}.
    Always returns a valid plan — Claude when available, rules otherwise."""
    totals = _totals(incidents)

    payload = {
        "staff": {"name": staff.get("name"), "role": staff.get("role")},
        "restaurant": {"cuisine": restaurant.get("cuisine"),
                       "size": restaurant.get("seating_capacity")},
        "period_days": 30,
        "incident_totals": totals,
        "incidents": incidents[:40],
    }
    result = claude_client.call_json(_system_prompt(language), payload, _PLAN_SCHEMA,
                                     max_tokens=1200, cache_system=False)
    if result:
        # Structural guard: never let expected_recovery exceed the real loss.
        er = min(float(result.get("expected_recovery") or 0), totals["total_eur"])
        return {
            "priority": result["priority"],
            "title": result["title"],
            "summary": result["summary"],
            "euro_impact_total": totals["total_eur"],
            "expected_recovery": round(er, 2),
            "actions": [{"text": a["text"], "done": False, "due_hint": a.get("due_hint", "")}
                        for a in result["actions"]],
            "generated_by_model": True,
        }
    return _rules_plan(staff, totals, language)


# ── Deterministic fallback (localized templates, real numbers only) ──────────

_T = {
    "it": {
        "title": "Piano di recupero — {name}",
        "clean_title": "Ottimo lavoro — {name}",
        "summary": "{name} ha generato circa €{eur} di perdite recuperabili in 30 giorni, soprattutto per {cause}.",
        "clean_summary": "{name} ha un record quasi pulito quesot mese — continuiamo così.",
        "waste": ("Rivedi le porzioni con bilancia sui piatti chiave", "questa settimana"),
        "portioning": ("Standardizza le porzioni con foto-ricetta in cucina", "prima del prossimo servizio"),
        "speed": ("Affianca 2 turni con un collega più rapido sulla stessa postazione", "questa settimana"),
        "punctuality": ("Concorda insieme un orario di arrivo realistico e un promemoria", "domani"),
        "quality": ("Checklist qualità a fine preparazione, 3 punti", "ogni servizio"),
        "reinforce": ("Condividi una tecnica con il resto del team", "questo mese"),
    },
    "en": {
        "title": "Recovery plan — {name}",
        "clean_title": "Great work — {name}",
        "summary": "{name} generated about €{eur} of recoverable loss in 30 days, mainly from {cause}.",
        "clean_summary": "{name} has a nearly clean record this month — let's keep it up.",
        "waste": ("Re-check portions with a scale on the key dishes", "this week"),
        "portioning": ("Standardise portions with a photo-recipe in the kitchen", "before next service"),
        "speed": ("Pair 2 shifts with a faster colleague on the same station", "this week"),
        "punctuality": ("Agree a realistic arrival time together, with a reminder", "tomorrow"),
        "quality": ("3-point quality checklist at the end of prep", "every service"),
        "reinforce": ("Share one technique with the rest of the team", "this month"),
    },
    "es": {
        "title": "Plan de recuperación — {name}",
        "clean_title": "Buen trabajo — {name}",
        "summary": "{name} generó cerca de €{eur} de pérdidas recuperables en 30 días, sobre todo por {cause}.",
        "clean_summary": "{name} tiene un registro casi limpio este mes — sigamos así.",
        "waste": ("Revisa las porciones con báscula en los platos clave", "esta semana"),
        "portioning": ("Estandariza las porciones con foto-receta en la cocina", "antes del próximo servicio"),
        "speed": ("Empareja 2 turnos con un compañero más rápido en la misma estación", "esta semana"),
        "punctuality": ("Acordad juntos una hora de llegada realista, con recordatorio", "mañana"),
        "quality": ("Checklist de calidad de 3 puntos al final de la preparación", "cada servicio"),
        "reinforce": ("Comparte una técnica con el resto del equipo", "este mes"),
    },
}

_CAUSE_LABEL = {
    "it": {"waste": "sprechi", "portioning": "porzioni eccessive", "speed": "tempi lenti",
           "punctuality": "puntualità", "quality": "qualità"},
    "en": {"waste": "waste", "portioning": "over-portioning", "speed": "slow prep times",
           "punctuality": "punctuality", "quality": "quality"},
    "es": {"waste": "desperdicio", "portioning": "porciones excesivas", "speed": "tiempos lentos",
           "punctuality": "puntualidad", "quality": "calidad"},
}


def _rules_plan(staff: dict, totals: dict, language: str) -> dict:
    lang = language if language in _T else "it"
    t = _T[lang]
    name = staff.get("name", "—")
    total_eur = totals["total_eur"]
    top = totals["top_type"]

    if total_eur < 5 or not top:
        return {
            "priority": "low",
            "title": t["clean_title"].format(name=name),
            "summary": t["clean_summary"].format(name=name),
            "euro_impact_total": total_eur,
            "expected_recovery": 0.0,
            "actions": [{"text": t["reinforce"][0], "done": False, "due_hint": t["reinforce"][1]}],
            "generated_by_model": False,
        }

    cause = _CAUSE_LABEL[lang].get(top, top)
    # Build 3 actions: the top-type fix + two supporting from other present types.
    ordered = sorted(totals["by_type"].items(), key=lambda kv: kv[1]["euro"], reverse=True)
    actions = []
    for typ, _ in ordered:
        if typ in t:
            actions.append({"text": t[typ][0], "done": False, "due_hint": t[typ][1]})
        if len(actions) >= 3:
            break
    while len(actions) < 3:
        actions.append({"text": t["reinforce"][0], "done": False, "due_hint": t["reinforce"][1]})

    priority = "high" if total_eur >= 100 else ("medium" if total_eur >= 25 else "low")
    return {
        "priority": priority,
        "title": t["title"].format(name=name),
        "summary": t["summary"].format(name=name, eur=f"{total_eur:.0f}", cause=cause),
        "euro_impact_total": total_eur,
        "expected_recovery": round(total_eur * 0.5, 2),  # conservative half
        "actions": actions[:5],
        "generated_by_model": False,
    }
