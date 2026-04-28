"""International seed (Milan, Barcelona, Paris, Lisbon, Miami, NY, Dubai, Mykonos, Ibiza).

Each city gets a small starter set spanning dinner / bar / club so the multi-city
flow works end-to-end. Admins curate further via the dashboard.
"""
from .generate_venues import bar, club, lounge, restaurant, rooftop, slugify


def _b(city, country, name, type_, addr, lat, lng, hood, hours, **kw):
    return {
        "slug": slugify(f"{city}-{name}"),
        "name": name,
        "city": city,
        "country": country,
        "type": type_,
        "description": kw.get("description") or f"{name} in {city.title()}.",
        "address": addr,
        "lat": lat,
        "lng": lng,
        "neighborhood": hood,
        "opening_hours": hours,
        "best_arrival_time": kw.get("best_arrival_time"),
        "price_level": kw.get("price_level", 3),
        "avg_price_eur": kw.get("avg_price_eur", 80),
        "dress_code": kw.get("dress_code", "elegant"),
        "music_types": kw.get("music_types", []),
        "crowd_types": kw.get("crowd_types", ["international"]),
        "vibe_tags": kw.get("vibe_tags", []),
        "cuisine_tags": kw.get("cuisine_tags", []),
        "reservation_required": kw.get("reservation_required", True),
        "walk_in_ok": kw.get("walk_in_ok", False),
        "vip_available": kw.get("vip_available", False),
        "guestlist_required": kw.get("guestlist_required", False),
        "contact": kw.get("contact", {}),
        "photos": [],
        "menu_url": None,
        "booking_url": None,
        "capacity": kw.get("capacity", 200),
        "partner_status": kw.get("partner_status", "none"),
        "commission_pct": 0.0,
        "promoted": kw.get("promoted", False),
        "quality_score": kw.get("quality_score", 0.85),
        "best_nights": ["fri", "sat"],
        "active": True,
        "admin_notes": None,
    }


INTL_VENUES = [
    # Milan
    _b("milan", "IT", "Ceresio 7", "rooftop", "Via Ceresio 7", 45.4823, 9.1791, "Garibaldi", rooftop(),
       price_level=4, avg_price_eur=130, vibe_tags=["luxury", "rooftop_view", "trendy"],
       music_types=["lounge"], vip_available=True),
    _b("milan", "IT", "Bulgari Bar", "lounge", "Via Privata Fratelli Gabba 7B", 45.4694, 9.1882, "Brera", lounge(),
       price_level=4, avg_price_eur=120, vibe_tags=["luxury", "elegant"], vip_available=True),
    _b("milan", "IT", "Just Cavalli", "club", "Via Luigi Camoens", 45.4774, 9.1726, "Garibaldi", club(),
       price_level=3, avg_price_eur=80, vibe_tags=["wild", "vip_friendly"], vip_available=True, guestlist_required=True),
    _b("milan", "IT", "Trippa", "restaurant", "Via Giorgio Vasari 1", 45.4523, 9.2050, "Porta Nuova", restaurant(),
       price_level=3, avg_price_eur=70, vibe_tags=["trendy", "local_authentic"], cuisine_tags=["italian"]),
    _b("milan", "IT", "Bar Basso", "bar", "Via Plinio 39", 45.4806, 9.2123, "Porta Nuova", bar(),
       price_level=2, avg_price_eur=25, vibe_tags=["historic", "lively"], music_types=["lounge"]),

    # Barcelona
    _b("barcelona", "ES", "Bobby Gin", "bar", "Carrer de Francisco Giner 47", 41.3974, 2.1543, "Gracia", bar(),
       price_level=2, avg_price_eur=35, vibe_tags=["trendy", "speakeasy"], music_types=["lounge"]),
    _b("barcelona", "ES", "Opium Barcelona", "club", "Passeig Marítim de la Barceloneta 34", 41.3781, 2.1959, "Barceloneta", club(("00:00", "06:00")),
       price_level=3, avg_price_eur=80, vibe_tags=["wild", "vip_friendly", "rooftop_view"], vip_available=True, guestlist_required=True),
    _b("barcelona", "ES", "Tickets", "restaurant", "Avinguda del Paral·lel 164", 41.3743, 2.1601, "Poble Sec", restaurant(),
       price_level=4, avg_price_eur=160, vibe_tags=["luxury", "trendy", "michelin"], cuisine_tags=["spanish", "tapas"]),
    _b("barcelona", "ES", "El Xampanyet", "bar", "Carrer de Montcada 22", 41.3858, 2.1814, "El Born", bar(("19:00", "23:30")),
       price_level=1, avg_price_eur=20, vibe_tags=["local_authentic", "lively"], walk_in_ok=True, reservation_required=False),

    # Paris
    _b("paris", "FR", "Silencio des Prés", "club", "35 Rue de Montpensier", 48.8666, 2.3367, "Le Marais", club(("00:00", "06:00")),
       price_level=4, avg_price_eur=100, vibe_tags=["luxury", "wild", "celebrity"], vip_available=True, guestlist_required=True),
    _b("paris", "FR", "Le Mary Celeste", "bar", "1 Rue Commines", 48.8617, 2.3636, "Le Marais", bar(),
       price_level=3, avg_price_eur=45, vibe_tags=["trendy", "international"], music_types=["lounge"]),
    _b("paris", "FR", "Septime", "restaurant", "80 Rue de Charonne", 48.8542, 2.3826, "Bastille", restaurant(),
       price_level=4, avg_price_eur=130, vibe_tags=["michelin", "trendy"], cuisine_tags=["french"]),

    # Lisbon
    _b("lisbon", "PT", "Park Bar", "rooftop", "Calçada do Combro 58", 38.7104, -9.1466, "Bairro Alto", rooftop(),
       price_level=2, avg_price_eur=25, vibe_tags=["rooftop_view", "trendy", "hidden_gem"], music_types=["indie"]),
    _b("lisbon", "PT", "Lux Frágil", "club", "Av. Infante Dom Henrique Armazém A", 38.7223, -9.1185, "Cais do Sodré", club(("00:00", "06:00")),
       price_level=3, avg_price_eur=50, vibe_tags=["wild", "techno", "celebrity"], vip_available=True),
    _b("lisbon", "PT", "Belcanto", "restaurant", "Largo de São Carlos 10", 38.7106, -9.1419, "Chiado", restaurant(),
       price_level=4, avg_price_eur=180, vibe_tags=["luxury", "michelin"], cuisine_tags=["portuguese"]),

    # Miami
    _b("miami", "US", "LIV Nightclub", "club", "4441 Collins Ave", 25.8170, -80.1219, "South Beach", club(),
       price_level=4, avg_price_eur=200, avg_price_eur_=200, vibe_tags=["wild", "vip_friendly", "celebrity"], vip_available=True, guestlist_required=True),
    _b("miami", "US", "Komodo", "restaurant", "801 Brickell Ave", 25.7649, -80.1903, "Brickell", restaurant(),
       price_level=4, avg_price_eur=160, vibe_tags=["luxury", "trendy"], cuisine_tags=["asian"], vip_available=True),
    _b("miami", "US", "Sweet Liberty", "bar", "237 20th St", 25.7975, -80.1318, "South Beach", bar(),
       price_level=3, avg_price_eur=40, vibe_tags=["trendy", "tiki"], music_types=["lounge"]),

    # New York
    _b("new_york", "US", "Marquee New York", "club", "289 10th Ave", 40.7506, -74.0040, "Meatpacking", club(),
       price_level=4, avg_price_eur=180, vibe_tags=["wild", "vip_friendly", "celebrity"], vip_available=True, guestlist_required=True),
    _b("new_york", "US", "Le Bernardin", "restaurant", "155 W 51st St", 40.7615, -73.9817, "Manhattan", restaurant(),
       price_level=4, avg_price_eur=250, vibe_tags=["luxury", "michelin", "elegant"], cuisine_tags=["seafood"]),
    _b("new_york", "US", "Attaboy", "speakeasy", "134 Eldridge St", 40.7197, -73.9923, "Lower East Side", bar(),
       price_level=3, avg_price_eur=45, vibe_tags=["speakeasy", "hidden_gem"], music_types=["lounge"]),

    # Dubai
    _b("dubai", "AE", "WHITE Dubai", "club", "Meydan Racecourse Grandstand", 25.1572, 55.3025, "Downtown", club(),
       price_level=4, avg_price_eur=200, vibe_tags=["wild", "luxury", "rooftop_view"], vip_available=True, guestlist_required=True),
    _b("dubai", "AE", "Nobu Dubai", "restaurant", "Atlantis The Palm", 25.1308, 55.1170, "Palm Jumeirah", restaurant(),
       price_level=4, avg_price_eur=220, vibe_tags=["luxury", "international"], cuisine_tags=["japanese"], vip_available=True),
    _b("dubai", "AE", "CÉ LA VI Dubai", "rooftop", "Address Sky View Tower 2", 25.1986, 55.2745, "Downtown", rooftop(),
       price_level=4, avg_price_eur=160, vibe_tags=["luxury", "rooftop_view", "trendy"], music_types=["lounge"]),

    # Mykonos
    _b("mykonos", "GR", "Scorpios Mykonos", "club", "Paraga Beach", 37.4250, 25.3429, "Paradise Beach", club(("18:00", "04:00")),
       price_level=4, avg_price_eur=200, vibe_tags=["luxury", "beach", "wild"], vip_available=True, guestlist_required=True),
    _b("mykonos", "GR", "Nammos", "restaurant", "Psarou Beach", 37.4156, 25.3517, "Psarou", restaurant(("13:00", "01:00")),
       price_level=4, avg_price_eur=250, vibe_tags=["luxury", "beach", "celebrity"], cuisine_tags=["mediterranean"], vip_available=True),

    # Ibiza
    _b("ibiza", "ES", "Pacha Ibiza", "club", "Av. 8 d'Agost", 38.9176, 1.4422, "Ibiza Town", club(("23:30", "07:00")),
       price_level=4, avg_price_eur=150, vibe_tags=["wild", "house_music", "celebrity"], vip_available=True, guestlist_required=True),
    _b("ibiza", "ES", "Ushuaïa Ibiza", "club", "Platja d'en Bossa 10", 38.8855, 1.4035, "Playa d'en Bossa", club(("17:00", "00:00")),
       price_level=4, avg_price_eur=180, vibe_tags=["wild", "house_music", "open_air"], vip_available=True),
    _b("ibiza", "ES", "Cipriani Downtown Ibiza", "restaurant", "Marina Botafoch", 38.9152, 1.4423, "Ibiza Town", restaurant(),
       price_level=4, avg_price_eur=220, vibe_tags=["luxury", "celebrity"], cuisine_tags=["italian"]),
]
