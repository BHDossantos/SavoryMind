"""Rule-based recipe recommendation engine."""

import re

RECIPES = [
    {
        "id": 1,
        "title": "Classic Beef Bourguignon",
        "cuisine": "French",
        "mood": ["cozy", "romantic"],
        "keywords": r"beef|steak|red meat|french|winter|cozy",
        "difficulty": "Medium",
        "time_minutes": 180,
        "servings": 4,
        "image_emoji": "🥩",
        "description": "A rich, slow-braised French classic with red wine, bacon lardons, and pearl onions.",
        "ingredients": [
            "800g beef chuck, cut into chunks",
            "200ml Burgundy red wine",
            "150g bacon lardons",
            "200g pearl onions",
            "250g chestnut mushrooms",
            "2 carrots, chopped",
            "3 garlic cloves",
            "2 tbsp tomato paste",
            "Fresh thyme and bay leaves",
            "500ml beef stock",
        ],
        "steps": [
            "Season beef generously, brown in batches in a Dutch oven over high heat.",
            "Fry lardons until crispy, set aside. Sauté onions, carrots, and garlic in the same pot.",
            "Add tomato paste, cook 2 min. Pour in wine and stock. Return beef and lardons.",
            "Add herbs, bring to simmer, then cover and braise at 160°C for 2.5 hours.",
            "Sauté mushrooms separately in butter, add to pot for last 20 minutes.",
            "Serve with crusty bread or creamy mashed potato.",
        ],
        "wine_pairing": "Pinot Noir or Burgundy",
        "beer_pairing": "Dark Porter",
    },
    {
        "id": 2,
        "title": "Lemon Garlic Prawn Linguine",
        "cuisine": "Italian",
        "mood": ["light", "romantic", "summer"],
        "keywords": r"seafood|pasta|prawn|italian|light|lemon|summer",
        "difficulty": "Easy",
        "time_minutes": 25,
        "servings": 2,
        "image_emoji": "🍝",
        "description": "Silky pasta tossed with juicy prawns, zesty lemon, garlic, chilli, and fresh parsley.",
        "ingredients": [
            "200g linguine",
            "300g raw king prawns",
            "4 garlic cloves, sliced",
            "1 red chilli, finely sliced",
            "Zest and juice of 1 lemon",
            "4 tbsp extra-virgin olive oil",
            "Handful of flat-leaf parsley",
            "50ml dry white wine",
            "Salt and black pepper",
        ],
        "steps": [
            "Cook linguine in well-salted boiling water until al dente.",
            "Heat olive oil in a wide pan, fry garlic and chilli for 1 min until golden.",
            "Add prawns, cook 2 min per side. Splash in wine, cook 1 min.",
            "Drain pasta, reserving a cup of pasta water. Add to pan.",
            "Add lemon zest, juice, and parsley. Toss vigorously, adding pasta water to loosen.",
            "Season generously and serve immediately.",
        ],
        "wine_pairing": "Pinot Grigio or Vermentino",
        "beer_pairing": "Belgian Witbier",
    },
    {
        "id": 3,
        "title": "Spicy Thai Green Curry",
        "cuisine": "Thai",
        "mood": ["adventurous", "spicy", "group"],
        "keywords": r"thai|curry|spicy|coconut|asian|chicken|vegetarian",
        "difficulty": "Easy",
        "time_minutes": 35,
        "servings": 4,
        "image_emoji": "🍛",
        "description": "Aromatic Thai green curry with creamy coconut milk, fresh basil, and vibrant vegetables.",
        "ingredients": [
            "400ml coconut milk",
            "3 tbsp green curry paste",
            "500g chicken thighs or tofu",
            "200g green beans",
            "2 kaffir lime leaves",
            "1 lemongrass stalk",
            "2 tbsp fish sauce (or soy for vegan)",
            "1 tbsp palm sugar",
            "Fresh Thai basil",
            "Jasmine rice to serve",
        ],
        "steps": [
            "Fry curry paste in a little oil for 1 min until fragrant.",
            "Add coconut milk, lemongrass, and lime leaves. Bring to simmer.",
            "Add chicken or tofu, cook 15 min until cooked through.",
            "Add green beans, fish sauce, and sugar. Cook 5 min.",
            "Stir in fresh basil, taste and adjust seasoning.",
            "Serve over jasmine rice.",
        ],
        "wine_pairing": "Riesling or Gewürztraminer",
        "beer_pairing": "Session IPA or Sour Gose",
    },
    {
        "id": 4,
        "title": "Classic Eggs Benedict",
        "cuisine": "American",
        "mood": ["brunch", "weekend", "indulgent"],
        "keywords": r"eggs|brunch|breakfast|weekend|morning|bacon",
        "difficulty": "Medium",
        "time_minutes": 30,
        "servings": 2,
        "image_emoji": "🍳",
        "description": "Poached eggs on toasted English muffins with crispy Canadian bacon and velvety hollandaise.",
        "ingredients": [
            "4 large eggs",
            "2 English muffins, split and toasted",
            "4 slices Canadian bacon",
            "2 tbsp white wine vinegar",
            "For hollandaise: 3 egg yolks, 125g butter, 1 tbsp lemon juice, pinch cayenne",
        ],
        "steps": [
            "Make hollandaise: whisk yolks over bain-marie until thick, slowly whisk in melted butter, add lemon juice and cayenne.",
            "Bring a wide pan of water to gentle simmer, add vinegar.",
            "Crack each egg into a ramekin, swirl water, drop egg in gently. Poach 3 min.",
            "Warm bacon in a pan.",
            "Layer: muffin → bacon → egg → generous hollandaise.",
            "Season with salt, pepper, and a pinch of paprika. Serve immediately.",
        ],
        "wine_pairing": "Champagne or Cava",
        "beer_pairing": "Saison",
    },
    {
        "id": 5,
        "title": "Charred Aubergine Shakshuka",
        "cuisine": "Middle Eastern",
        "mood": ["vegetarian", "cozy", "spicy"],
        "keywords": r"vegetarian|vegan|eggs|spicy|middle eastern|aubergine|shakshuka",
        "difficulty": "Easy",
        "time_minutes": 40,
        "servings": 3,
        "image_emoji": "🍅",
        "description": "Silky charred aubergine folded into a spiced tomato sauce with eggs poached right in the pan.",
        "ingredients": [
            "2 large aubergines",
            "1 × 400g tin chopped tomatoes",
            "1 red pepper, diced",
            "1 onion, sliced",
            "4 garlic cloves",
            "1 tsp cumin, 1 tsp smoked paprika, ½ tsp harissa",
            "4 large eggs",
            "Feta and fresh coriander to serve",
            "Crusty bread or pitta",
        ],
        "steps": [
            "Char aubergines directly over a gas flame or under a hot grill until blackened all over. Peel and roughly chop.",
            "Fry onion and pepper in olive oil 8 min. Add garlic and spices, cook 2 min.",
            "Add tomatoes and charred aubergine. Simmer 15 min until sauce thickens.",
            "Make 4 wells in the sauce, crack an egg into each.",
            "Cover and cook 5–6 min until whites are just set.",
            "Top with feta, coriander, and a drizzle of good olive oil.",
        ],
        "wine_pairing": "Grenache or Tempranillo",
        "beer_pairing": "Amber Ale",
    },
    {
        "id": 6,
        "title": "Pan-Seared Duck Breast with Cherry Jus",
        "cuisine": "French",
        "mood": ["romantic", "special occasion", "indulgent"],
        "keywords": r"duck|romantic|special|french|game|dinner party",
        "difficulty": "Medium",
        "time_minutes": 45,
        "servings": 2,
        "image_emoji": "🦆",
        "description": "Restaurant-quality duck breast with crispy skin, roasted to perfection with a glossy cherry and red wine jus.",
        "ingredients": [
            "2 duck breasts",
            "150g fresh or frozen cherries, pitted",
            "100ml red wine",
            "200ml chicken stock",
            "1 tbsp balsamic vinegar",
            "1 shallot, diced",
            "Fresh thyme",
            "Salt and pepper",
        ],
        "steps": [
            "Score duck skin in a cross-hatch pattern. Season well.",
            "Start in a cold pan skin-side down, cook on medium heat 10–12 min until skin is golden and crispy.",
            "Flip and cook flesh side 4 min for medium-rare. Rest 8 min.",
            "Pour off most fat. Fry shallot in remaining fat 2 min. Add wine, reduce by half.",
            "Add stock and cherries. Simmer 8 min until syrupy. Add balsamic, adjust seasoning.",
            "Slice duck, fan over plates, spoon jus over.",
        ],
        "wine_pairing": "Pinot Noir or Pomerol",
        "beer_pairing": "Porter or Saison",
    },
    {
        "id": 7,
        "title": "Creamy Mushroom & Truffle Risotto",
        "cuisine": "Italian",
        "mood": ["cozy", "vegetarian", "romantic", "indulgent"],
        "keywords": r"mushroom|risotto|italian|vegetarian|truffle|cozy|creamy",
        "difficulty": "Medium",
        "time_minutes": 50,
        "servings": 2,
        "image_emoji": "🍄",
        "description": "Deeply umami-rich Arborio risotto with mixed mushrooms, Parmesan, and a drizzle of truffle oil.",
        "ingredients": [
            "200g Arborio rice",
            "300g mixed mushrooms (porcini, chestnut, shiitake)",
            "1L hot vegetable stock",
            "100ml dry white wine",
            "1 shallot, finely diced",
            "2 garlic cloves",
            "50g Parmesan, finely grated",
            "30g cold butter",
            "Truffle oil to finish",
            "Fresh parsley",
        ],
        "steps": [
            "Sauté shallot and garlic in butter until soft. Add rice and toast 2 min.",
            "Pour in wine and stir until absorbed. Begin adding hot stock one ladle at a time.",
            "Stir continuously, adding stock only when previous addition is absorbed. Approx 18 min.",
            "Meanwhile, sear mushrooms in a hot separate pan until golden.",
            "Fold mushrooms into risotto. Remove from heat, stir in Parmesan and cold butter vigorously.",
            "Serve immediately, drizzled with truffle oil and scattered with parsley.",
        ],
        "wine_pairing": "White Burgundy or aged Nebbiolo",
        "beer_pairing": "Hefeweizen",
    },
    {
        "id": 8,
        "title": "Quick Avocado & Feta Toast",
        "cuisine": "Modern Café",
        "mood": ["light", "brunch", "healthy", "quick"],
        "keywords": r"avocado|toast|light|healthy|brunch|quick|vegan|vegetarian",
        "difficulty": "Easy",
        "time_minutes": 10,
        "servings": 2,
        "image_emoji": "🥑",
        "description": "The perfect brunch — creamy smashed avocado on sourdough with tangy feta, chilli flakes, and a squeeze of lemon.",
        "ingredients": [
            "2 thick slices sourdough bread",
            "2 ripe avocados",
            "80g feta cheese, crumbled",
            "1 lemon",
            "Pinch of dried chilli flakes",
            "Extra-virgin olive oil",
            "Salt, black pepper, fresh mint",
        ],
        "steps": [
            "Toast sourdough until golden and crispy.",
            "Halve and pit avocados. Scoop into a bowl and smash roughly with a fork.",
            "Season with salt, pepper, and a squeeze of lemon juice.",
            "Spread generously on toast.",
            "Top with crumbled feta, chilli flakes, and a drizzle of olive oil.",
            "Garnish with fresh mint and serve immediately.",
        ],
        "wine_pairing": "Sauvignon Blanc",
        "beer_pairing": "Session IPA or Sour Gose",
    },
    {
        "id": 9,
        "title": "Korean BBQ Beef Bulgogi",
        "cuisine": "Korean",
        "mood": ["adventurous", "group", "fun"],
        "keywords": r"korean|asian|beef|bbq|group|adventurous|spicy|steak",
        "difficulty": "Easy",
        "time_minutes": 30,
        "servings": 4,
        "image_emoji": "🥩",
        "description": "Thin-sliced beef marinated in soy, sesame, and pear — cooked hot and fast for caramelised, smoky perfection.",
        "ingredients": [
            "600g beef sirloin or ribeye, thinly sliced",
            "4 tbsp soy sauce",
            "2 tbsp sesame oil",
            "1 pear or apple, grated (natural tenderiser)",
            "4 garlic cloves, minced",
            "1 tbsp brown sugar",
            "1 tsp black pepper",
            "Spring onions and sesame seeds to garnish",
            "Steamed rice and lettuce wraps to serve",
        ],
        "steps": [
            "Combine soy sauce, sesame oil, grated pear, garlic, sugar, and pepper. Marinate beef at least 30 min.",
            "Heat a griddle or wok to high heat until smoking.",
            "Cook beef in batches (don't crowd the pan) 2–3 min until caramelised.",
            "Garnish with sesame seeds and spring onion.",
            "Serve with steamed rice, kimchi, and lettuce leaves for wrapping.",
        ],
        "wine_pairing": "Grenache or off-dry Riesling",
        "beer_pairing": "American Amber Ale or IPA",
    },
    {
        "id": 10,
        "title": "Tiramisu Classico",
        "cuisine": "Italian",
        "mood": ["indulgent", "romantic", "dessert"],
        "keywords": r"dessert|tiramisu|italian|chocolate|coffee|cream|romantic|sweet",
        "difficulty": "Easy",
        "time_minutes": 30,
        "servings": 6,
        "image_emoji": "🍮",
        "description": "The iconic Italian dessert — espresso-soaked ladyfingers layered with mascarpone cream and dusted with cocoa.",
        "ingredients": [
            "500g mascarpone",
            "4 large eggs, separated",
            "100g caster sugar",
            "300ml strong espresso, cooled",
            "50ml dark rum or Marsala (optional)",
            "200g savoiardi ladyfingers",
            "Cocoa powder to dust",
        ],
        "steps": [
            "Whisk egg yolks and sugar until pale and thick. Beat in mascarpone.",
            "Whisk egg whites to stiff peaks. Fold into mascarpone mixture in three additions.",
            "Mix espresso with rum. Quickly dip each ladyfinger (don't soak) and layer in a dish.",
            "Spread half the cream over ladyfingers. Repeat with second layer.",
            "Cover and refrigerate at least 4 hours (overnight is best).",
            "Dust heavily with cocoa powder just before serving.",
        ],
        "wine_pairing": "Vin Santo or Passito di Pantelleria",
        "beer_pairing": "Chocolate Stout",
    },
    {
        "id": 11,
        "title": "Grilled Sea Bass with Chimichurri",
        "cuisine": "Mediterranean",
        "mood": ["light", "summer", "healthy"],
        "keywords": r"fish|sea bass|light|healthy|summer|mediterranean|grilled",
        "difficulty": "Easy",
        "time_minutes": 25,
        "servings": 2,
        "image_emoji": "🐟",
        "description": "Perfectly grilled sea bass with a vibrant chimichurri of parsley, garlic, and olive oil.",
        "ingredients": [
            "2 sea bass fillets",
            "For chimichurri: large bunch flat-leaf parsley, 4 garlic cloves, 1 red chilli, 80ml olive oil, 2 tbsp red wine vinegar",
            "Salt, pepper, lemon to serve",
        ],
        "steps": [
            "Blend chimichurri ingredients in a food processor until finely chopped but not a paste. Season and rest.",
            "Score skin of fish 3 times each side. Season well.",
            "Heat a griddle or pan to high. Cook skin-side down 4 min, pressing gently.",
            "Flip carefully and cook 2 min. The skin should be crispy and fish just cooked through.",
            "Serve immediately with chimichurri spooned over and lemon wedges.",
        ],
        "wine_pairing": "Albariño or Verdejo",
        "beer_pairing": "German Pilsner or Belgian Witbier",
    },
    {
        "id": 12,
        "title": "Slow-Cooked Lamb Shoulder with Harissa",
        "cuisine": "North African",
        "mood": ["group", "cozy", "weekend", "special occasion"],
        "keywords": r"lamb|slow|harissa|moroccan|north african|group|weekend|cozy",
        "difficulty": "Easy",
        "time_minutes": 240,
        "servings": 6,
        "image_emoji": "🍖",
        "description": "Meltingly tender lamb shoulder marinated in harissa and spices, roasted low-and-slow until it falls off the bone.",
        "ingredients": [
            "2kg bone-in lamb shoulder",
            "3 tbsp harissa paste",
            "1 tbsp honey",
            "1 tbsp cumin, 1 tsp cinnamon",
            "6 garlic cloves",
            "400ml lamb or chicken stock",
            "Preserved lemon",
            "Fresh mint and pomegranate to serve",
        ],
        "steps": [
            "Slash lamb all over. Mix harissa, honey, and spices, rub all over and into the slashes.",
            "Marinate at least 2 hours or overnight.",
            "Place in a roasting tin with stock, cover tightly with foil.",
            "Roast at 160°C for 3.5–4 hours until falling off the bone.",
            "Remove foil, increase to 200°C for 20 min to brown.",
            "Rest 15 min. Serve on a platter scattered with mint and pomegranate.",
        ],
        "wine_pairing": "Syrah or Côtes du Rhône",
        "beer_pairing": "Porter or American Amber Ale",
    },
]


def get_recipe_recommendations(
    mood: str = "",
    cuisine: str = "",
    keywords: str = "",
    ingredients: str = "",
    max_time: int = 0,
    difficulty: str = "",
    n: int = 12,
) -> dict:
    """Return scored recipe list. ``ingredients`` is a comma-separated string of items on hand."""
    query      = f"{mood} {cuisine} {keywords}".lower().strip()
    ing_tokens = [t.strip().lower() for t in ingredients.split(",") if t.strip()] if ingredients else []
    scored     = []

    for recipe in RECIPES:
        score = 0.0

        # Keyword match against recipe keyword pattern
        if query and re.search(recipe["keywords"], query):
            score += 0.8

        # Mood match
        if mood and mood.lower() in [m.lower() for m in recipe["mood"]]:
            score += 0.5

        # Cuisine match
        if cuisine and cuisine.lower() in recipe["cuisine"].lower():
            score += 0.4

        # Ingredients-on-hand match
        if ing_tokens:
            recipe_text = " ".join(recipe.get("ingredients", [])).lower()
            matched = sum(1 for t in ing_tokens if t in recipe_text)
            if matched > 0:
                score += 0.6 * (matched / len(ing_tokens))
                score += 0.3 * matched  # bonus per matched ingredient

        # Time filter (hard exclude if max_time specified)
        if max_time and recipe["time_minutes"] > max_time:
            continue

        # Difficulty filter
        if difficulty and recipe.get("difficulty", "").lower() != difficulty.lower():
            continue

        if score == 0:
            score = 0.1  # baseline so we always show something
        scored.append((score, recipe))

    scored.sort(key=lambda x: x[0], reverse=True)
    results = [r for _, r in scored[:n]]

    return {
        "query":   {"mood": mood, "cuisine": cuisine, "keywords": keywords, "ingredients": ingredients},
        "recipes": results,
        "total":   len(RECIPES),
    }


def get_recipe_by_id(recipe_id: int) -> dict | None:
    for r in RECIPES:
        if r["id"] == recipe_id:
            return r
    return None
