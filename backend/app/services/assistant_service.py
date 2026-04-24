import re

KB = [
    {
        "tags": ["sauce", "breaking", "broken", "split", "curdled", "separated"],
        "title": "Sauce is breaking / splitting",
        "answer": (
            "Remove from heat immediately. Whisk in 1–2 tbsp of cold water or cream off-heat, "
            "then very slowly drizzle the sauce back in while whisking constantly. "
            "For butter-based sauces, a small ice cube whisked in can rescue the emulsion. "
            "Prevention: never let the pan get too hot and add fat slowly."
        ),
    },
    {
        "tags": ["sauce", "thick", "too thick", "gluey", "heavy"],
        "title": "Sauce is too thick",
        "answer": (
            "Add warm liquid a splash at a time — water, stock, wine, or cream depending on the sauce. "
            "Stir continuously over low heat. For tomato sauces a little pasta water works beautifully "
            "because the starch helps smooth the texture."
        ),
    },
    {
        "tags": ["sauce", "thin", "too thin", "watery", "won't thicken"],
        "title": "Sauce won't thicken",
        "answer": (
            "Simmer uncovered on medium-low so water evaporates. For faster results: mix 1 tsp cornstarch "
            "with 2 tsp cold water, stir into the sauce, and cook 1–2 minutes. "
            "Or whisk in a beurre manié (equal parts softened butter + flour)."
        ),
    },
    {
        "tags": ["sauce", "lumpy", "lumps", "clumpy"],
        "title": "Sauce has lumps",
        "answer": (
            "Strain through a fine-mesh sieve or blitz briefly with an immersion blender. "
            "To prevent lumps: always sift flour before adding, and whisk cold milk into a hot roux gradually."
        ),
    },
    {
        "tags": ["seasoning", "salty", "over-salted", "too salty"],
        "title": "Food is too salty",
        "answer": (
            "Add bulk to dilute: more unsalted potato, rice, pasta, cream, or unsalted stock. "
            "A raw peeled potato simmered in a liquid dish for 15 min absorbs some salt. "
            "A small squeeze of lemon or dash of vinegar can also balance perceived saltiness."
        ),
    },
    {
        "tags": ["seasoning", "bland", "tasteless", "flat", "no flavour", "no flavor"],
        "title": "Food tastes bland",
        "answer": (
            "Season in layers: add salt, then taste. Add acid (lemon juice, vinegar) — it brightens everything. "
            "A pinch of sugar balances savoury dishes. Finish with a drizzle of good olive oil or a knob of butter "
            "for richness, and fresh herbs for fragrance."
        ),
    },
    {
        "tags": ["seasoning", "spicy", "too spicy", "too hot", "burn", "chilli"],
        "title": "Dish is too spicy",
        "answer": (
            "Add dairy — cream, coconut milk, yogurt, or sour cream neutralises capsaicin. "
            "Increase starch or bulk (rice, potato, bread). A spoonful of sugar or honey also helps. "
            "Avoid adding water — it spreads the heat rather than reducing it."
        ),
    },
    {
        "tags": ["seasoning", "sweet", "too sweet", "over-sweet"],
        "title": "Dish is too sweet",
        "answer": (
            "Balance with acid: a splash of lemon juice, wine vinegar, or tamarind. "
            "A pinch of salt also counteracts sweetness. In savoury dishes, add more aromatics "
            "(onion, garlic) to add depth that competes with sweetness."
        ),
    },
    {
        "tags": ["seasoning", "sour", "too sour", "acidic", "too acidic"],
        "title": "Dish is too sour / acidic",
        "answer": (
            "Add a pinch of sugar or honey and stir through over low heat. "
            "A small knob of butter stirred in smooths sharp acidity. "
            "Baking soda (¼ tsp at a time) neutralises acid chemically — use sparingly."
        ),
    },
    {
        "tags": ["meat", "tough", "chewy", "hard", "rubbery"],
        "title": "Meat is tough / chewy",
        "answer": (
            "Tough meat needs more time, not more heat. Return it to low heat with liquid (stock, wine, water) "
            "and braise covered for 30–60 min more. The collagen will eventually convert to gelatin. "
            "Next time: use a meat mallet before cooking, or marinate in acid (yogurt, citrus) for 2–4 hours."
        ),
    },
    {
        "tags": ["meat", "dry", "dried out", "overcooked"],
        "title": "Meat is dry / overcooked",
        "answer": (
            "Slice thinly against the grain and serve with a sauce or pan jus. "
            "For chicken/pork you can simmer dry slices in warm broth for 5 min to rehydrate slightly. "
            "Prevention: use a thermometer — chicken is done at 74°C / 165°F, beef medium at 63°C / 145°F."
        ),
    },
    {
        "tags": ["meat", "won't sear", "sticking", "not browning", "grey"],
        "title": "Meat won't sear / is going grey",
        "answer": (
            "Pat the surface completely dry with paper towels — moisture is the enemy of browning. "
            "Get the pan smoking hot before the meat goes in. Don't move it for 2–3 min. "
            "Use a pan that retains heat (cast iron or stainless) and don't crowd it."
        ),
    },
    {
        "tags": ["pasta", "sticky", "clumping", "sticking together"],
        "title": "Pasta is sticky / clumping",
        "answer": (
            "Toss immediately with sauce or a drizzle of olive oil after draining. "
            "Never rinse pasta — the starch helps sauce cling. If already clumped, "
            "dunk briefly in the pasta water still in the pot, then toss with sauce."
        ),
    },
    {
        "tags": ["pasta", "mushy", "overcooked", "soft"],
        "title": "Pasta is mushy / overcooked",
        "answer": (
            "There's no way to reverse overcooked pasta, but you can salvage it: "
            "spread on a tray and oven-toast at 200°C / 400°F for 10 min, then toss with sauce for a baked dish. "
            "Or pan-fry in oil for a crispy pasta cake. Next time pull it 2 min before the packet says."
        ),
    },
    {
        "tags": ["rice", "mushy", "sticky", "overcooked", "wet"],
        "title": "Rice is mushy / too wet",
        "answer": (
            "Spread on a baking tray and place in a 150°C / 300°F oven for 5–10 min to dry out. "
            "Or lay a folded tea towel under the lid for the last 5 min of cooking to absorb steam. "
            "Prevention: use a 1:1.5 rice-to-water ratio for most long-grain varieties."
        ),
    },
    {
        "tags": ["eggs", "scrambled", "scrambled eggs", "rubbery", "watery"],
        "title": "Scrambled eggs are rubbery / watery",
        "answer": (
            "Rubbery eggs were cooked too hot too fast. Next time: use low heat, stir constantly, "
            "and remove from heat while still slightly underdone — carry-over cooking finishes them. "
            "A splash of cream and a knob of butter in the pan helps keep them soft."
        ),
    },
    {
        "tags": ["eggs", "poached", "poaching", "falling apart"],
        "title": "Poached eggs falling apart",
        "answer": (
            "Add 1 tbsp white vinegar to the water — it helps the whites set faster. "
            "Water should be simmering, not boiling. Create a gentle whirlpool and drop the egg in the centre. "
            "Very fresh eggs hold together much better than older ones."
        ),
    },
    {
        "tags": ["baking", "not rising", "flat", "dense", "heavy"],
        "title": "Baked good is not rising / too dense",
        "answer": (
            "Check your raising agent: baking powder loses potency after 6 months. "
            "Don't over-mix the batter — this deflates air and develops gluten. "
            "Make sure your oven is fully preheated. For yeast doughs, the yeast may be dead — "
            "proof it first: mix with warm water (40°C) and a pinch of sugar, should foam in 10 min."
        ),
    },
    {
        "tags": ["baking", "burning", "burnt", "too dark", "over-brown"],
        "title": "Baked good is burning on top",
        "answer": (
            "Tent with foil immediately to block direct heat. Lower the oven by 10–15°C and continue baking. "
            "For future batches: place the rack one level lower, and check 10 min before the timer."
        ),
    },
    {
        "tags": ["bread", "dough", "not coming together", "crumbly dough", "too dry"],
        "title": "Bread dough is too dry / crumbly",
        "answer": (
            "Add water 1 tbsp at a time, kneading between each addition. "
            "It's easier to add liquid than to fix a wet dough. "
            "If you've over-floured the surface, dampen your hands instead of adding more water directly."
        ),
    },
    {
        "tags": ["vegetables", "mushy", "overcooked", "soggy"],
        "title": "Vegetables are mushy / overcooked",
        "answer": (
            "Plunge immediately into ice water to stop cooking. Drain and pat dry. "
            "Serve as-is or pan-fry briefly in butter/oil to add some texture back. "
            "Next time: blanch for 2–3 min only and shock in ice water straight after."
        ),
    },
    {
        "tags": ["onion", "onions", "burning", "burnt onions"],
        "title": "Onions are burning",
        "answer": (
            "Lower the heat and add a splash of water or stock — it deglazes the pan and slows browning. "
            "Stir more frequently. If already bitter-burnt, start fresh; burnt onions can't be recovered "
            "and will make the whole dish taste acrid."
        ),
    },
    {
        "tags": ["timing", "time", "how long", "when is it done", "is it ready"],
        "title": "How to tell when it's done",
        "answer": (
            "Use a probe thermometer for meat. For cakes: a skewer inserted in the centre comes out clean. "
            "For pasta: taste it — it should have a slight bite (al dente). "
            "For vegetables: pierce with a knife; it should slide in with light resistance. "
            "Colour and smell are also signals: golden and fragrant usually means ready."
        ),
    },
    {
        "tags": ["substitute", "substitution", "replacement", "don't have", "missing ingredient"],
        "title": "Ingredient substitutions",
        "answer": (
            "Common swaps: butter → equal amount coconut oil or neutral oil; "
            "buttermilk → milk + 1 tbsp lemon juice (let sit 5 min); "
            "egg → 3 tbsp aquafaba (chickpea water) or 1 tbsp chia seeds + 3 tbsp water; "
            "cream → coconut cream or evaporated milk; "
            "fresh herbs → ⅓ the amount of dried. When in doubt, add gradually and taste."
        ),
    },
]

FALLBACK = (
    "I'm not sure about that one — try adjusting heat or seasoning first, those fix most problems. "
    "If the dish is truly beyond saving, there's no shame in starting fresh with what you've learned!"
)

_FILLER = re.compile(
    r"\b(the|a|an|is|are|my|i|its|it|how|do|to|why|what|when|can|should|"
    r"be|get|make|have|keep|help|please|need)\b",
    re.IGNORECASE,
)


def _score(entry: dict, tokens: list[str]) -> int:
    return sum(
        1
        for tok in tokens
        for tag in entry["tags"]
        if tok in tag or tag in tok
    )


def answer(question: str) -> dict:
    tokens = _FILLER.sub("", question.lower()).split()
    tokens = [t.strip(".,?!") for t in tokens if len(t) > 2]

    scored = [(e, _score(e, tokens)) for e in KB]
    scored.sort(key=lambda x: x[1], reverse=True)

    best_entry, best_score = scored[0]
    if best_score == 0:
        return {"title": "General Tip", "answer": FALLBACK}
    return {"title": best_entry["title"], "answer": best_entry["answer"]}
