"""Claude-driven generator for the wine / beer / spirits / recipe catalogs.

Run once (or whenever you want to refresh the data). Output lands in
``backend/app/data/{wines,beers,spirits,recipes}.json``. Review the diff
before committing — Claude is good but not perfect, and a bad row
poisons the whole catalog.

Usage
-----
    # All four catalogs, default sizes (~$10-15 in tokens):
    python scripts/generate_data.py --all

    # Just one category:
    python scripts/generate_data.py --recipes --per-cuisine 30
    python scripts/generate_data.py --wines --count 80
    python scripts/generate_data.py --beers --count 30
    python scripts/generate_data.py --spirits --count 30

    # Append vs. replace. Default replaces. Append merges into the
    # existing JSON (de-dup by name/title):
    python scripts/generate_data.py --recipes --append

Environment
-----------
    ANTHROPIC_API_KEY     required
    SAVORYMIND_DATA_DIR   optional override (defaults to backend/app/data)

Notes on quality
----------------
- The recipe generator asks for proper cuisine tags + keyword regex
  patterns so the existing filtering logic in recipe_service.py works
  out of the box.
- Wine entries are dict-keyed by grape slug (e.g. ``cabernet_sauvignon``)
  to match the lookup pattern in wine_service.PAIRING_RULES — if you
  add a new grape and want it to appear in pairings, also add an entry
  to PAIRING_RULES with the grape's slug.
- Recipes get sequential IDs starting from 1 (or max+1 in append mode).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

# ── Layout ─────────────────────────────────────────────────────────────────

_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_DATA_DIR = _REPO_ROOT / "backend" / "app" / "data"
DATA_DIR = Path(os.getenv("SAVORYMIND_DATA_DIR", _DEFAULT_DATA_DIR))

CUISINES_DEFAULT = [
    "Italian", "French", "Japanese", "Mexican", "Indian",
    "Thai", "Chinese", "American", "Mediterranean", "Spanish",
    "Greek", "Korean", "Middle Eastern", "Brazilian",
]


# ── Anthropic client ───────────────────────────────────────────────────────

def _client():
    """Lazy-init the Anthropic client so the script imports cleanly even
    when ANTHROPIC_API_KEY is unset (e.g. tooling smoke tests)."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise SystemExit(
            "ANTHROPIC_API_KEY is not set. Export it before running this script."
        )
    from anthropic import Anthropic
    return Anthropic()


def _call_claude(system_prompt: str, user_prompt: str, max_tokens: int = 8192) -> str:
    """One-shot Claude call. Returns raw text — caller parses the JSON.
    Uses the same model as the backend's claude_client for consistency."""
    client = _client()
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    # Claude returns content blocks; we expect a single text block.
    parts = [b.text for b in response.content if getattr(b, "type", None) == "text"]
    return "".join(parts).strip()


def _extract_json(text: str):
    """Robust JSON extraction. Claude sometimes wraps responses in
    ``` ```json fences or adds explanatory prose around the array. Pull
    out the first balanced JSON object/array."""
    # Strip code fences if present.
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)
    # Find the first { or [ and the matching closing bracket.
    start = min(
        (text.find(c) for c in "[{" if text.find(c) != -1),
        default=-1,
    )
    if start < 0:
        raise ValueError(f"no JSON found in response. First 200 chars:\n{text[:200]}")
    # Pair the brackets to find the matching close.
    open_char = text[start]
    close_char = "]" if open_char == "[" else "}"
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        c = text[i]
        if escape:
            escape = False
            continue
        if c == "\\":
            escape = True
            continue
        if c == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if c == open_char:
            depth += 1
        elif c == close_char:
            depth -= 1
            if depth == 0:
                return json.loads(text[start:i + 1])
    raise ValueError("unbalanced JSON in response")


def _slugify(name: str) -> str:
    """Wine catalog keys: 'Cabernet Sauvignon' → 'cabernet_sauvignon'."""
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


# ── Generators ─────────────────────────────────────────────────────────────

SYSTEM_DATA_PROMPT = """You are a structured-data generator for a food
intelligence app. Output ONLY valid JSON — no prose, no code fences,
no explanations. Be specific: real grape names, real regions, real
prices. No invented marketing fluff. Every entry must be cookable /
drinkable in the real world."""


def gen_wines(count: int) -> dict:
    user_prompt = f"""Generate a JSON OBJECT of {count} wine grape varietals,
keyed by lowercase_underscore slug (e.g. "cabernet_sauvignon", "pinot_grigio").

Each value must be an object with EXACTLY these keys:
- name: human-readable grape name (string)
- style: one of "Full-bodied Red", "Medium-bodied Red", "Light-bodied Red",
  "Full-bodied White", "Medium-bodied White", "Light-bodied White",
  "Sparkling", "Rosé", "Dessert Wine", "Fortified Wine", "Orange Wine"
- flavor_profile: 5-8 specific flavour descriptors separated by ", "
  (e.g. "Blackcurrant, cedar, tobacco, dark chocolate, cassis")
- regions: array of 2-4 famous regions ("Region, Country" format)
- price_range: string like "$15 – $200+"
- serving_temp: "X–Y°C (X–Y°F)" e.g. "16–18°C (61–64°F)"
- decant: boolean
- decant_time: string ("30–60 minutes") or empty string if decant is false

Cover BOTH classic Old World (Bordeaux, Burgundy, Rioja, Chianti, Barolo, Champagne)
AND New World (Napa, Mendoza, Marlborough, Stellenbosch, Margaret River) regions.
Include reds, whites, rosés, sparklings, dessert + fortified wines.

Output the raw JSON object only."""
    text = _call_claude(SYSTEM_DATA_PROMPT, user_prompt)
    return _extract_json(text)


def gen_beers(count: int) -> list:
    user_prompt = f"""Generate a JSON ARRAY of {count} real beer styles
representing a global craft + traditional beer catalog.

Each entry must be an object with EXACTLY these keys:
- name: descriptive name (e.g. "West Coast IPA", "Belgian Witbier")
- style: short style descriptor (e.g. "IPA", "Wheat Beer", "Stout")
- brewery: real brewery name OR "Various Craft" if it's a style not a brand
- abv: number (alcohol %, e.g. 6.5)
- flavour: 3-5 flavour descriptors comma-separated
- serve: serving guidance like "8–10°C, tall glass"

Cover IPAs, lagers, pilsners, stouts, porters, wheat beers, sours, saisons,
trappists, Belgian dubbels/triples, German hefeweizens, English bitters,
Czech pilsners, Mexican lagers, fruit beers, barrel-aged.

Output the raw JSON array only."""
    text = _call_claude(SYSTEM_DATA_PROMPT, user_prompt)
    return _extract_json(text)


def gen_spirits(count: int) -> list:
    user_prompt = f"""Generate a JSON ARRAY of {count} real spirits and
cocktail bases representing a global premium spirits catalog.

Each entry must be an object with EXACTLY these keys:
- name: descriptive name (e.g. "Single Malt Scotch", "Reposado Tequila")
- spirit: spirit category (e.g. "Whisky", "Tequila", "Rum", "Gin", "Vodka",
  "Cognac", "Mezcal", "Pisco", "Cachaça", "Soju", "Sake", "Vermouth")
- region: country or famous region (e.g. "Highlands, Scotland", "Jalisco, Mexico")
- abv: number (alcohol %, typically 35-50)
- flavour: 3-5 flavour descriptors comma-separated
- serve: serving guidance like "Neat, tulip glass" or "Margarita cocktail, salted rim"

Cover whiskies (Scotch, Bourbon, Rye, Japanese, Irish), tequila + mezcal,
rum (white, gold, dark, rhum agricole), gin (London Dry, contemporary),
cognac, brandy, vodka, aquavit, pisco, cachaça, baijiu, soju, sake,
vermouth, amari, fortified aperitifs.

Output the raw JSON array only."""
    text = _call_claude(SYSTEM_DATA_PROMPT, user_prompt)
    return _extract_json(text)


RECIPE_SYSTEM = SYSTEM_DATA_PROMPT + """

For recipe `keywords`: regex pattern (Python re syntax) matching common
search terms users would type. Use lowercase, word boundaries (\\b),
alternation. Example: "\\\\bbeef\\\\b|steak|red meat|cozy|winter"."""


def gen_recipes_for_cuisine(cuisine: str, count: int, start_id: int) -> list:
    user_prompt = f"""Generate a JSON ARRAY of {count} authentic {cuisine}
recipes spanning the cuisine's full range: starters, mains, desserts,
weekday quick + weekend project, classic + modern.

Each entry must be an object with EXACTLY these keys:
- id: integer, starting from {start_id} and incrementing by 1
- title: dish name in English, capitalised
- cuisine: "{cuisine}"
- mood: array of 1-3 from ["cozy", "romantic", "adventurous", "healthy",
  "indulgent", "quick", "celebratory", "brunch"]
- keywords: regex pattern (Python re syntax) for keyword search.
  Use \\\\b word boundaries, lowercase, alternation. Example for steak:
  "\\\\bbeef\\\\b|steak|red meat|cozy|winter"
- difficulty: one of "Easy", "Medium", "Hard"
- time_minutes: integer (5-600). Use realistic values: quick weeknight
  ≤30, mains 30-90, projects 90+
- servings: integer (typically 2-6)
- image_emoji: a single relevant emoji for the dish
- description: 1-2 sentence summary, evocative not bland
- ingredients: array of 6-15 specific quantities ("400g spaghetti",
  "120g guanciale, diced", "3 large egg yolks")
- steps: array of 4-8 instruction strings, each one actionable
- wine_pairing: specific wine recommendation (e.g. "Chianti Classico" or
  "Sauvignon Blanc from Marlborough")
- beer_pairing: specific beer style (e.g. "Pilsner" or "Belgian Witbier")

Use authentic ingredient + technique names — Italian recipes should
say "guanciale" not "bacon", Mexican should say "masa harina" not
"corn flour", Indian should say "ghee" not "clarified butter" except
when explaining. Cover a real spread: pasta + rice + seafood + meat +
vegetable mains + desserts for cuisines where it applies.

Output the raw JSON array only — NO surrounding object, NO prose."""
    text = _call_claude(RECIPE_SYSTEM, user_prompt, max_tokens=16000)
    recipes = _extract_json(text)
    # Re-stamp IDs in case Claude drifted.
    for i, r in enumerate(recipes):
        r["id"] = start_id + i
    return recipes


# ── Top-level orchestration ────────────────────────────────────────────────

def _read_existing(name: str):
    path = DATA_DIR / f"{name}.json"
    if not path.exists():
        return {} if name == "wines" else []
    with open(path) as f:
        return json.load(f)


def _write(name: str, data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / f"{name}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  → wrote {path} ({len(data)} entries)")


def cmd_wines(count: int, append: bool):
    print(f"Generating {count} wines via Claude…")
    new = gen_wines(count)
    if append:
        existing = _read_existing("wines")
        existing.update(new)  # dict merge, new entries overwrite
        new = existing
    _write("wines", new)


def cmd_beers(count: int, append: bool):
    print(f"Generating {count} beers via Claude…")
    new = gen_beers(count)
    if append:
        existing = _read_existing("beers")
        seen = {b["name"].lower() for b in existing}
        new = existing + [b for b in new if b["name"].lower() not in seen]
    _write("beers", new)


def cmd_spirits(count: int, append: bool):
    print(f"Generating {count} spirits via Claude…")
    new = gen_spirits(count)
    if append:
        existing = _read_existing("spirits")
        seen = {s["name"].lower() for s in existing}
        new = existing + [s for s in new if s["name"].lower() not in seen]
    _write("spirits", new)


def cmd_recipes(per_cuisine: int, cuisines: list[str], append: bool):
    existing = _read_existing("recipes") if append else []
    next_id = max([r.get("id", 0) for r in existing], default=0) + 1
    new = list(existing)

    for cuisine in cuisines:
        print(f"  Generating {per_cuisine} {cuisine} recipes (ids {next_id}+)…")
        batch = gen_recipes_for_cuisine(cuisine, per_cuisine, next_id)
        new.extend(batch)
        next_id += len(batch)

    _write("recipes", new)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--all", action="store_true", help="Generate all four catalogs at default sizes")
    parser.add_argument("--wines", action="store_true")
    parser.add_argument("--beers", action="store_true")
    parser.add_argument("--spirits", action="store_true")
    parser.add_argument("--recipes", action="store_true")
    parser.add_argument("--count", type=int, default=80, help="Count for wines/beers/spirits")
    parser.add_argument("--per-cuisine", type=int, default=30, help="Recipes per cuisine")
    parser.add_argument("--cuisines", nargs="+", default=CUISINES_DEFAULT,
                        help=f"Cuisine list. Default: {' '.join(CUISINES_DEFAULT)}")
    parser.add_argument("--append", action="store_true",
                        help="Merge into existing catalog instead of replacing")
    args = parser.parse_args()

    if args.all:
        args.wines = args.beers = args.spirits = args.recipes = True

    if not any([args.wines, args.beers, args.spirits, args.recipes]):
        parser.error("specify --all or one of --wines/--beers/--spirits/--recipes")

    if args.wines:   cmd_wines(args.count, args.append)
    if args.beers:   cmd_beers(args.count, args.append)
    if args.spirits: cmd_spirits(args.count, args.append)
    if args.recipes: cmd_recipes(args.per_cuisine, args.cuisines, args.append)

    print("\nDone. Review the JSON diffs before committing.")


if __name__ == "__main__":
    sys.exit(main() or 0)
